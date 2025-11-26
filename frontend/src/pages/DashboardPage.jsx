import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { useAuthStore } from '../store/authStore.js';
import {
  getFlowerRecommendations,
  listGreenhouses,
  createGreenhouse,
  updateGreenhouse,
  updateGreenhouseAlerts,
  evaluateGreenhouseMetrics,
  deleteGreenhouse
} from '../api/greenhouseService.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const generateEventId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const setTimeoutSafe = (callback, delay) =>
  (typeof window !== 'undefined' && typeof window.setTimeout === 'function'
    ? window.setTimeout(callback, delay)
    : setTimeout(callback, delay));

const clearTimeoutSafe = (handle) => {
  if (!handle) {
    return;
  }

  if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
    window.clearTimeout(handle);
  } else {
    clearTimeout(handle);
  }
};

const AUTOMATION_COOLING_DELAY_MS = 12000;
const ALERT_WATCHDOG_DELAY_MS = 3 * 60 * 1000;

const createInitialGreenhouseState = (name = 'Estufa Matriz') => ({
  greenhouseName: name,
  temperature: 24.6,
  humidity: 63,
  soilMoisture: 48,
  co2: 416,
  irrigation: 'Irrigação em stand-by',
  ventilation: 'Ventilação modulada',
  lighting: 'Iluminação automática',
  lastUpdate: new Date().toISOString()
});

const createInitialEventLog = (name = 'Estufa Matriz') => ([
  {
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    message: `Controlador da ${name} iniciado em modo seguro. Monitorando variáveis críticas.`
  }
]);

const computeNextGreenhouseState = (prev) => {
  const temperature = clamp(prev.temperature + (Math.random() - 0.5) * 0.6, 22, 28);
  const humidity = clamp(prev.humidity + (Math.random() - 0.5) * 2.4, 55, 78);
  const soilMoisture = clamp(prev.soilMoisture + (Math.random() - 0.5) * 4.2, 35, 68);
  const co2 = clamp(prev.co2 + (Math.random() - 0.5) * 36, 380, 540);

  const irrigation = soilMoisture < 42
    ? 'Irrigação acionada automaticamente'
    : soilMoisture > 60
      ? 'Irrigação pausada'
      : 'Irrigação em stand-by';

  const ventilation = temperature > 26.4
    ? 'Ventilação forçada'
    : temperature < 23.1
      ? 'Ventilação mínima'
      : 'Ventilação modulada';

  const lighting = humidity > 70
    ? 'Iluminação reduzida'
    : humidity < 58
      ? 'Iluminação reforçada'
      : 'Iluminação automática';

  return {
    ...prev,
    temperature,
    humidity,
    soilMoisture,
    co2,
    irrigation,
    ventilation,
    lighting,
    lastUpdate: new Date().toISOString()
  };
};

const buildEventMessage = (stats) => {
  if (stats.irrigation.startsWith('Irrigação acionada')) {
    return `Umidade do substrato em ${Math.round(stats.soilMoisture)}%. Bomba acionada por 2 minutos.`;
  }

  if (stats.ventilation === 'Ventilação forçada') {
    return `Ventilação acelerada para conter ${stats.temperature.toFixed(1)}°C.`;
  }

  if (stats.co2 > 510) {
    return `Injeção de CO₂ modulada para ${Math.round(stats.co2)} ppm.`;
  }

  if (stats.lighting === 'Iluminação reforçada') {
    return 'Luminosidade aumentada para compensar nebulosidade detectada.';
  }

  return 'Telemetria estável. Controlador em modo automático com ajustes contínuos.';
};

const formatTimestamp = (iso) => {
  if (!iso) {
    return '--';
  }

  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (_error) {
    return '--';
  }
};

const evaluateMetricRange = (value, range) => {
  if (!range) {
    return { ok: true, value: null, expected: range, direction: 'in-range' };
  }

  const normalized = typeof value === 'number' && Number.isFinite(value) ? value : null;

  if (normalized === null) {
    return { ok: false, value: null, expected: range, direction: 'unknown' };
  }

  if (normalized < range.min) {
    return {
      ok: false,
      value: normalized,
      expected: range,
      direction: 'low',
      deviation: range.min - normalized
    };
  }

  if (normalized > range.max) {
    return {
      ok: false,
      value: normalized,
      expected: range,
      direction: 'high',
      deviation: normalized - range.max
    };
  }

  return {
    ok: true,
    value: normalized,
    expected: range,
    direction: 'in-range',
    deviation: 0
  };
};

const buildAlertMessages = (profile, evaluation) => {
  const alerts = [];

  if (!evaluation.temperature.ok) {
    alerts.push(
      `Temperatura fora do ideal (${profile.temperature.min}°C - ${profile.temperature.max}°C).`
    );
  }

  if (!evaluation.humidity.ok) {
    alerts.push(
      `Umidade relativa fora do ideal (${profile.humidity.min}% - ${profile.humidity.max}%).`
    );
  }

  if (!evaluation.soilMoisture.ok) {
    alerts.push(
      `Umidade do substrato fora do ideal (${profile.soilMoisture.min}% - ${profile.soilMoisture.max}%).`
    );
  }

  return alerts;
};

const analyzeGreenhouseState = (state, profile) => {
  if (!state || !profile) {
    return {
      status: 'pending',
      alerts: [],
      metrics: {
        temperature: { ok: true, expected: profile?.temperature ?? null },
        humidity: { ok: true, expected: profile?.humidity ?? null },
        soilMoisture: { ok: true, expected: profile?.soilMoisture ?? null }
      }
    };
  }

  const metrics = {
    temperature: evaluateMetricRange(state.temperature, profile.temperature),
    humidity: evaluateMetricRange(state.humidity, profile.humidity),
    soilMoisture: evaluateMetricRange(state.soilMoisture, profile.soilMoisture)
  };

  const alerts = buildAlertMessages(profile, metrics);

  return {
    status: alerts.length === 0 ? 'ok' : 'alert',
    alerts,
    metrics
  };
};

const buildAlertFingerprint = (metrics) =>
  [metrics.temperature?.direction, metrics.humidity?.direction, metrics.soilMoisture?.direction]
    .filter(Boolean)
    .join('|');

const GreenhousePanel = ({
  greenhouse,
  telemetry,
  eventLog,
  evaluation,
  profiles,
  notifyFeedback,
  saving,
  alertsSaving,
  notifyBusy,
  onSave,
  onToggleAlerts,
  onNotify,
  onSimulateHeat,
  onDeleteRequest
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftName, setDraftName] = useState(greenhouse.name ?? 'Estufa Matriz');
  const [draftProfileId, setDraftProfileId] = useState(greenhouse.flowerProfileId ?? '');
  const [menuFeedback, setMenuFeedback] = useState(null);
  const menuRef = useRef(null);

  const currentProfile = useMemo(() => {
    if (greenhouse.profile) {
      return greenhouse.profile;
    }
    return profiles.find((profile) => profile.id === greenhouse.flowerProfileId) ?? null;
  }, [greenhouse.profile, greenhouse.flowerProfileId, profiles]);

  useEffect(() => {
    setDraftName(greenhouse.name ?? 'Estufa Matriz');
  }, [greenhouse.name]);

  useEffect(() => {
    setDraftProfileId(greenhouse.flowerProfileId ?? '');
  }, [greenhouse.flowerProfileId]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleSave = async (event) => {
    event.preventDefault();
    const trimmedName = draftName.trim();

    if (!trimmedName) {
      setMenuFeedback({ type: 'error', text: 'Informe um nome para a estufa.' });
      return;
    }

    if (!draftProfileId) {
      setMenuFeedback({ type: 'error', text: 'Selecione o tipo de cultivo para esta estufa.' });
      return;
    }

    const result = await onSave(greenhouse.id, {
      name: trimmedName,
      flowerProfileId: draftProfileId
    });

    if (result.ok) {
      setMenuFeedback({ type: 'success', text: 'Configurações atualizadas.' });
    } else {
      setMenuFeedback({ type: 'error', text: result.message });
    }
  };

  const handleToggleAlerts = async (event) => {
    const enabled = event.target.checked;
    const result = await onToggleAlerts(greenhouse.id, enabled);

    if (!result.ok) {
      setMenuFeedback({ type: 'error', text: result.message });
    }
  };

  const handleDeleteClick = () => {
    if (typeof onDeleteRequest === 'function') {
      onDeleteRequest(greenhouse.id);
    }
    setMenuFeedback(null);
    setMenuOpen(false);
  };

  const resolvedTelemetry = telemetry ?? createInitialGreenhouseState(greenhouse.name);
  const resolvedLog = eventLog ?? createInitialEventLog(greenhouse.name);
  const resolvedEvaluation = evaluation ?? { status: 'pending', alerts: [], metrics: {} };

  return (
    <section className="rounded-lg border border-emerald-500/40 bg-slate-950/70 p-6 shadow-lg">
      <header className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">
            Controlador automático
          </span>
          <h2 className="text-xl font-semibold text-emerald-100">
            {resolvedTelemetry.greenhouseName}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-emerald-100">
            <input
              type="checkbox"
              checked={Boolean(greenhouse.alertsEnabled)}
              onChange={handleToggleAlerts}
              disabled={alertsSaving}
              className="h-4 w-4 rounded border border-emerald-400/60 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
            />
            <span>{greenhouse.alertsEnabled ? 'Alertas ativos' : 'Alertas desativados'}</span>
          </label>
          <div className="relative" ref={menuRef}>
            <Button variant="secondary" onClick={() => setMenuOpen((open) => !open)}>
              Configurar
            </Button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-md border border-slate-800 bg-slate-950 p-4 shadow-xl">
                <form onSubmit={handleSave} className="space-y-3 text-sm text-slate-200">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Nome da estufa
                    </span>
                    <input
                      type="text"
                      value={draftName}
                      onChange={(event) => {
                        setDraftName(event.target.value.slice(0, 80));
                        setMenuFeedback(null);
                      }}
                      className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Flor principal
                    </span>
                    <select
                      value={draftProfileId}
                      onChange={(event) => {
                        setDraftProfileId(event.target.value);
                        setMenuFeedback(null);
                      }}
                      className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    >
                      <option value="">Selecione o cultivo</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {menuFeedback ? (
                    <div
                      className={`rounded border px-3 py-2 text-xs ${
                        menuFeedback.type === 'success'
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                          : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                      }`}
                    >
                      {menuFeedback.text}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setMenuOpen(false)}
                    >
                      Fechar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar alterações'}
                    </Button>
                  </div>
                  <div className="border-t border-slate-800 pt-3">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-rose-300/80">
                      Remover estufa
                    </span>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Remova esta estufa e encerre quaisquer simulações ativas.
                    </p>
                    <Button
                      type="button"
                      variant="danger"
                      className="mt-3 w-full"
                      onClick={handleDeleteClick}
                    >
                      Remover estufa
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <article className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-6">
          <header className="mb-4 flex items-center justify-between text-xs text-emerald-100/70">
            <span>Telemetria em tempo real</span>
            <span>Última atualização {formatTimestamp(resolvedTelemetry.lastUpdate)}</span>
          </header>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 text-emerald-100">
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Temperatura</p>
              <p className="text-2xl font-semibold">{resolvedTelemetry.temperature.toFixed(1)}°C</p>
              <p className="text-xs text-emerald-200/70">{resolvedTelemetry.ventilation}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Umidade relativa</p>
              <p className="text-2xl font-semibold">{Math.round(resolvedTelemetry.humidity)}%</p>
              <p className="text-xs text-emerald-200/70">Nebulização automática supervisionada</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Substrato</p>
              <p className="text-2xl font-semibold">{Math.round(resolvedTelemetry.soilMoisture)}%</p>
              <p className="text-xs text-emerald-200/70">{resolvedTelemetry.irrigation}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">CO₂ ambiente</p>
              <p className="text-2xl font-semibold">{Math.round(resolvedTelemetry.co2)} ppm</p>
              <p className="text-xs text-emerald-200/70">
                Fluxo {resolvedTelemetry.co2 > 500 ? 'alto' : 'modulado'}
              </p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 sm:col-span-2 xl:col-span-3">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Iluminação</p>
              <p className="text-sm font-semibold text-emerald-100">{resolvedTelemetry.lighting}</p>
              <p className="mt-1 text-xs text-emerald-200/70">
                O algoritmo ajusta fotoperíodo e ventilação de forma coordenada, enviando sinais MQTT para os controladores locais.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <header className="mb-3 flex items-center justify-between text-sm text-slate-200">
            <h3 className="text-lg font-semibold text-slate-100">Eventos da estufa</h3>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Simulação</span>
          </header>
          <p className="text-xs text-slate-400">
            Enquanto os sensores IoT reais não chegam, acompanhamos a estufa virtual para validar alertas e automações do controlador.
          </p>
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 text-sm text-slate-200">
            {resolvedLog.map((entry) => (
              <li key={entry.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-400">{formatTimestamp(entry.timestamp)}</p>
                <p className="mt-1 text-slate-100">{entry.message}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <article className="rounded-md border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">
          <h3 className="text-sm font-semibold text-slate-100">Cultivo configurado</h3>
          {currentProfile ? (
            <>
              <p className="mt-1 text-xs text-slate-400">{currentProfile.summary}</p>
              <dl className="mt-3 grid gap-3 text-xs text-slate-300 sm:grid-cols-3">
                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <dt className="text-[11px] uppercase tracking-widest text-slate-500">Temperatura</dt>
                  <dd>
                    {currentProfile.temperature.min}°C — {currentProfile.temperature.max}°C
                  </dd>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <dt className="text-[11px] uppercase tracking-widest text-slate-500">Umidade relativa</dt>
                  <dd>
                    {currentProfile.humidity.min}% — {currentProfile.humidity.max}%
                  </dd>
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <dt className="text-[11px] uppercase tracking-widest text-slate-500">Umidade do substrato</dt>
                  <dd>
                    {currentProfile.soilMoisture.min}% — {currentProfile.soilMoisture.max}%
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Use o menu "Configurar" para escolher a flor principal e personalizar limites automáticos.
            </p>
          )}
          <div className="mt-4">
            <h4 className="text-xs uppercase tracking-[0.18em] text-slate-500">Equipe responsável</h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {greenhouse.watchersDetails?.length > 0 ? (
                greenhouse.watchersDetails.map((watcher) => (
                  <li
                    key={watcher.id}
                    className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100"
                  >
                    {watcher.fullName ?? watcher.email}
                  </li>
                ))
              ) : (
                <li className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-500">
                  Administrador ainda não definiu equipe para esta estufa.
                </li>
              )}
            </ul>
          </div>
        </article>

        <article className="rounded-md border border-slate-800 bg-slate-950 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Status atual</h3>
          {resolvedEvaluation.status === 'pending' ? (
            <p className="mt-2 text-xs text-slate-500">
              Configure o cultivo para habilitar a validação automática dos parâmetros.
            </p>
          ) : (
            <>
              <p
                className={`mt-2 text-xs font-semibold ${
                  resolvedEvaluation.status === 'ok' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {resolvedEvaluation.status === 'ok'
                  ? 'Parâmetros dentro do esperado.'
                  : 'Atenção: ajustes necessários.'}
              </p>
              <div className="mt-3 grid gap-3 text-xs text-slate-200 sm:grid-cols-3">
                {['temperature', 'humidity', 'soilMoisture'].map((metricKey) => {
                  const metric = resolvedEvaluation.metrics[metricKey] ?? {};
                  const labelMap = {
                    temperature: 'Temperatura',
                    humidity: 'Umidade relativa',
                    soilMoisture: 'Umidade do substrato'
                  };
                  const unitMap = {
                    temperature: '°C',
                    humidity: '%',
                    soilMoisture: '%'
                  };
                  const className = metric.ok
                    ? 'border-emerald-400/40 bg-emerald-500/5 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-200';
                  return (
                    <div key={metricKey} className={`rounded border px-3 py-2 ${className}`}>
                      <p className="text-[11px] uppercase tracking-[0.2em]">{labelMap[metricKey]}</p>
                      <p className="text-sm font-semibold">
                        {typeof metric.value === 'number'
                          ? `${metric.value.toFixed(1)}${unitMap[metricKey]}`
                          : '—'}
                      </p>
                      <p className="text-[11px] text-white/70">
                        Ideal {metric.expected?.min ?? '—'}{unitMap[metricKey]} — {metric.expected?.max ?? '—'}{unitMap[metricKey]}
                      </p>
                    </div>
                  );
                })}
              </div>
              {resolvedEvaluation.alerts.length > 0 ? (
                <ul className="mt-3 space-y-2 text-xs text-amber-200">
                  {resolvedEvaluation.alerts.map((alert) => (
                    <li key={alert} className="flex items-start gap-2">
                      <span aria-hidden="true">•</span>
                      <span>{alert}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          <div className="mt-4 space-y-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => onSimulateHeat?.(greenhouse.id)}
              disabled={!onSimulateHeat}
            >
              Simular alerta térmico
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="secondary"
                type="button"
                disabled={
                  notifyBusy ||
                  !onNotify ||
                  resolvedEvaluation.status === 'pending'
                }
                onClick={() => onNotify?.(greenhouse.id)}
              >
                {notifyBusy
                  ? 'Processando...'
                  : resolvedEvaluation.status === 'alert'
                    ? 'Notificar equipe'
                    : 'Gerar avaliação'}
              </Button>
              <p className="text-[11px] text-slate-500">
                Alertas por e-mail respeitam pausa mínima de 15 minutos.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              A simulação gera um evento de alerta e dispara automaticamente a rotina de resfriamento.
            </p>
          </div>
          {notifyFeedback ? (
            <p
              className={`mt-3 rounded border px-3 py-2 text-xs ${
                notifyFeedback.type === 'success'
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                  : notifyFeedback.type === 'info'
                    ? 'border-slate-700 bg-slate-900/70 text-slate-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              }`}
            >
              {notifyFeedback.text}
            </p>
          ) : null}
        </article>
      </div>
    </section>
  );
};

export const DashboardPage = () => {
  const requiresPasswordReset = useAuthStore((state) => state.requiresPasswordReset);

  const [profiles, setProfiles] = useState([]);
  const [greenhouses, setGreenhouses] = useState([]);
  const [telemetryById, setTelemetryById] = useState({});
  const [eventLogById, setEventLogById] = useState({});
  const [evaluationById, setEvaluationById] = useState({});
  const [notifyFeedbackById, setNotifyFeedbackById] = useState({});
  const [savingById, setSavingById] = useState({});
  const [alertsSavingById, setAlertsSavingById] = useState({});
  const [notifyBusyById, setNotifyBusyById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const lastAlertFingerprintRef = useRef({});
  const simulationTimersRef = useRef({});
  const telemetryRef = useRef({});
  const profileMap = useMemo(() => {
    const map = {};
    profiles.forEach((profile) => {
      map[profile.id] = profile;
    });
    return map;
  }, [profiles]);

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profilesResult, greenhousesResult] = await Promise.all([
          getFlowerRecommendations(),
          listGreenhouses()
        ]);

        if (!active) {
          return;
        }

        setProfiles(profilesResult?.profiles ?? []);
        setGreenhouses(greenhousesResult?.greenhouses ?? []);
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.message ?? 'Não foi possível carregar as estufas.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (greenhouses.length === 0) {
      setTelemetryById({});
      setEventLogById({});
      setEvaluationById({});
      setNotifyFeedbackById({});
      lastAlertFingerprintRef.current = {};
      return;
    }

    setTelemetryById((prev) => {
      const next = { ...prev };
      const validIds = new Set();
      greenhouses.forEach((greenhouse) => {
        validIds.add(greenhouse.id);
        if (!next[greenhouse.id]) {
          next[greenhouse.id] = createInitialGreenhouseState(greenhouse.name);
        } else if (next[greenhouse.id].greenhouseName !== greenhouse.name) {
          next[greenhouse.id] = {
            ...next[greenhouse.id],
            greenhouseName: greenhouse.name ?? next[greenhouse.id].greenhouseName
          };
        }
      });
      Object.keys(next).forEach((id) => {
        if (!validIds.has(id)) {
          delete next[id];
        }
      });
      return next;
    });

    setEventLogById((prev) => {
      const next = { ...prev };
      const validIds = new Set();
      greenhouses.forEach((greenhouse) => {
        validIds.add(greenhouse.id);
        if (!next[greenhouse.id]) {
          next[greenhouse.id] = createInitialEventLog(greenhouse.name);
        }
      });
      Object.keys(next).forEach((id) => {
        if (!validIds.has(id)) {
          delete next[id];
        }
      });
      return next;
    });

    setNotifyFeedbackById((prev) => {
      const next = {};
      greenhouses.forEach((greenhouse) => {
        if (prev[greenhouse.id]) {
          next[greenhouse.id] = prev[greenhouse.id];
        }
      });
      return next;
    });

    setSavingById((prev) => {
      const next = {};
      const validIds = new Set(greenhouses.map((entry) => entry.id));
      greenhouses.forEach((greenhouse) => {
        next[greenhouse.id] = prev[greenhouse.id] ?? false;
      });
      Object.keys(prev).forEach((id) => {
        if (!validIds.has(id) && next[id]) {
          delete next[id];
        }
      });
      return next;
    });

    setAlertsSavingById((prev) => {
      const next = {};
      const validIds = new Set(greenhouses.map((entry) => entry.id));
      greenhouses.forEach((greenhouse) => {
        next[greenhouse.id] = prev[greenhouse.id] ?? false;
      });
      Object.keys(prev).forEach((id) => {
        if (!validIds.has(id) && next[id]) {
          delete next[id];
        }
      });
      return next;
    });

    setEvaluationById((prev) => {
      const next = {};
      const validIds = new Set(greenhouses.map((entry) => entry.id));
      greenhouses.forEach((greenhouse) => {
        next[greenhouse.id] = prev[greenhouse.id] ?? {
          status: 'pending',
          alerts: [],
          metrics: {}
        };
      });
      Object.keys(prev).forEach((id) => {
        if (!validIds.has(id) && next[id]) {
          delete next[id];
        }
      });
      return next;
    });

    const previousFingerprints = lastAlertFingerprintRef.current ?? {};
    const nextFingerprints = {};
    greenhouses.forEach((greenhouse) => {
      if (previousFingerprints[greenhouse.id]) {
        nextFingerprints[greenhouse.id] = previousFingerprints[greenhouse.id];
      }
    });
    lastAlertFingerprintRef.current = nextFingerprints;
  }, [greenhouses]);

  useEffect(
    () => () => {
      Object.values(simulationTimersRef.current).forEach((timers) => {
        if (!timers) {
          return;
        }

        if (timers.coolingTimer) {
          clearTimeoutSafe(timers.coolingTimer);
        }

        if (timers.watchdogTimer) {
          clearTimeoutSafe(timers.watchdogTimer);
        }
      });
      simulationTimersRef.current = {};
    },
    []
  );

  useEffect(() => {
    const validIds = new Set(greenhouses.map((greenhouse) => greenhouse.id));
    Object.keys(simulationTimersRef.current).forEach((greenhouseId) => {
      if (!validIds.has(greenhouseId)) {
        const timers = simulationTimersRef.current[greenhouseId];
        if (timers?.coolingTimer) {
          clearTimeoutSafe(timers.coolingTimer);
        }
        if (timers?.watchdogTimer) {
          clearTimeoutSafe(timers.watchdogTimer);
        }
        delete simulationTimersRef.current[greenhouseId];
      }
    });
  }, [greenhouses]);

  useEffect(() => {
    telemetryRef.current = telemetryById;
  }, [telemetryById]);

  useEffect(() => {
    if (greenhouses.length === 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const telemetrySnapshot = {};

      setTelemetryById((previous) => {
        const next = {};
        greenhouses.forEach((greenhouse) => {
          const baseline = previous[greenhouse.id] ?? createInitialGreenhouseState(greenhouse.name);
          const updated = computeNextGreenhouseState(baseline);
          telemetrySnapshot[greenhouse.id] = updated;
          next[greenhouse.id] = updated;
        });
        return next;
      });

      if (Object.keys(telemetrySnapshot).length === 0) {
        return;
      }

      setEventLogById((previous) => {
        const next = { ...previous };
        greenhouses.forEach((greenhouse) => {
          const existing = next[greenhouse.id] ?? createInitialEventLog(greenhouse.name);
          const telemetry = telemetrySnapshot[greenhouse.id];
          if (!telemetry) {
            next[greenhouse.id] = existing;
            return;
          }
          const entry = {
            id: generateEventId(),
            timestamp: telemetry.lastUpdate,
            message: buildEventMessage(telemetry)
          };
          next[greenhouse.id] = [entry, ...existing].slice(0, 24);
        });
        return next;
      });
    }, 6500);

    return () => window.clearInterval(interval);
  }, [greenhouses]);

  useEffect(() => {
    if (greenhouses.length === 0) {
      setEvaluationById({});
      return;
    }

    const nextEvaluation = {};
    const notifyUpdates = {};

    greenhouses.forEach((greenhouse) => {
      const telemetry = telemetryById[greenhouse.id];
      const profile = greenhouse.profile ?? profileMap[greenhouse.flowerProfileId];

      if (!profile) {
        nextEvaluation[greenhouse.id] = {
          status: 'pending',
          alerts: [],
          metrics: {}
        };
        return;
      }

      const evaluation = analyzeGreenhouseState(telemetry, profile);
      nextEvaluation[greenhouse.id] = evaluation;

      const fingerprint = buildAlertFingerprint(evaluation.metrics ?? {});
      const lastFingerprint = lastAlertFingerprintRef.current[greenhouse.id];

      if (evaluation.status === 'alert') {
        if (fingerprint && fingerprint !== lastFingerprint) {
          notifyUpdates[greenhouse.id] = {
            type: 'info',
            text: 'Parâmetros críticos detectados. Revise ou notifique a equipe.'
          };
          lastAlertFingerprintRef.current[greenhouse.id] = fingerprint;
        }
      } else if (evaluation.status === 'ok') {
        if (lastFingerprint && lastFingerprint !== 'ok') {
          notifyUpdates[greenhouse.id] = {
            type: 'success',
            text: 'Estufa voltou para a faixa ideal.'
          };
        }
        lastAlertFingerprintRef.current[greenhouse.id] = 'ok';
      }
    });

    setEvaluationById(nextEvaluation);

    if (Object.keys(notifyUpdates).length > 0) {
      setNotifyFeedbackById((prev) => ({
        ...prev,
        ...notifyUpdates
      }));
    }
  }, [telemetryById, greenhouses, profileMap]);

  const handleRequestDeleteGreenhouse = useCallback(
    (greenhouseId) => {
      const target = greenhouses.find((entry) => entry.id === greenhouseId);
      setDeleteBusy(false);
      setDeleteTarget({
        id: greenhouseId,
        name: target?.name ?? 'esta estufa',
        isLast: greenhouses.length <= 1
      });
    },
    [greenhouses]
  );

  const handleCancelDelete = useCallback(() => {
    if (deleteBusy) {
      return;
    }
    setDeleteTarget(null);
  }, [deleteBusy]);

  const handleCreateGreenhouse = useCallback(async () => {
    if (creating) {
      return;
    }

    setCreating(true);
    setError(null);

    const defaultProfileId = profiles[0]?.id ?? null;
    const generatedName = `Nova estufa ${greenhouses.length + 1}`;

    try {
      const response = await createGreenhouse({
        name: generatedName,
        flowerProfileId: defaultProfileId
      });

      const created = response?.greenhouse ?? response;

      if (created?.id) {
        setGreenhouses((prev) => [...prev, created]);
        setTelemetryById((prev) => ({
          ...prev,
          [created.id]: createInitialGreenhouseState(created.name)
        }));
        setEventLogById((prev) => ({
          ...prev,
          [created.id]: createInitialEventLog(created.name)
        }));
        setNotifyFeedbackById((prev) => ({
          ...prev,
          [created.id]: {
            type: 'info',
            text: 'Estufa criada. Ajuste o cultivo no menu Configurar.'
          }
        }));
      }
    } catch (createError) {
      setError(createError.response?.data?.message ?? 'Não foi possível criar a estufa agora.');
    } finally {
      setCreating(false);
    }
  }, [creating, profiles, greenhouses.length]);

  const handleSaveGreenhouse = useCallback(async (greenhouseId, payload) => {
    setSavingById((prev) => ({
      ...prev,
      [greenhouseId]: true
    }));

    try {
      const response = await updateGreenhouse(greenhouseId, payload);
      const updated = response?.greenhouse ?? response;

      if (updated) {
        setGreenhouses((prev) =>
          prev.map((greenhouse) => (greenhouse.id === greenhouseId ? { ...greenhouse, ...updated } : greenhouse))
        );
      }

      return { ok: true };
    } catch (updateError) {
      return {
        ok: false,
        message: updateError.response?.data?.message ?? 'Não foi possível atualizar a estufa.'
      };
    } finally {
      setSavingById((prev) => ({
        ...prev,
        [greenhouseId]: false
      }));
    }
  }, []);

  const handleToggleAlerts = useCallback(async (greenhouseId, enabled) => {
    setAlertsSavingById((prev) => ({
      ...prev,
      [greenhouseId]: true
    }));

    try {
      const response = await updateGreenhouseAlerts(greenhouseId, {
        alertsEnabled: Boolean(enabled)
      });
      const updated = response?.greenhouse ?? response;

      if (updated) {
        setGreenhouses((prev) =>
          prev.map((greenhouse) => (greenhouse.id === greenhouseId ? { ...greenhouse, ...updated } : greenhouse))
        );
      }

      setNotifyFeedbackById((prev) => ({
        ...prev,
        [greenhouseId]: {
          type: enabled ? 'success' : 'info',
          text: enabled
            ? 'Alertas automáticos ativados para esta estufa.'
            : 'Alertas automáticos desativados. Você ainda pode notificar manualmente.'
        }
      }));

      return { ok: true };
    } catch (toggleError) {
      return {
        ok: false,
        message:
          toggleError.response?.data?.message ??
          'Não foi possível atualizar as preferências de alertas agora.'
      };
    } finally {
      setAlertsSavingById((prev) => ({
        ...prev,
        [greenhouseId]: false
      }));
    }
  }, []);

  const handleNotifyTeam = useCallback(async (greenhouseId) => {
    const telemetry = telemetryById[greenhouseId];

    if (!telemetry) {
      setNotifyFeedbackById((prev) => ({
        ...prev,
        [greenhouseId]: {
          type: 'error',
          text: 'Telemetria ainda não está disponível para esta estufa.'
        }
      }));
      return;
    }

    setNotifyBusyById((prev) => ({
      ...prev,
      [greenhouseId]: true
    }));

    setNotifyFeedbackById((prev) => ({
      ...prev,
      [greenhouseId]: {
        type: 'info',
        text: 'Enviando avaliação e alerta para a equipe...'
      }
    }));

    try {
      const result = await evaluateGreenhouseMetrics(greenhouseId, {
        metrics: {
          temperature: telemetry.temperature,
          humidity: telemetry.humidity,
          soilMoisture: telemetry.soilMoisture
        },
        notify: true
      });

      if (result?.greenhouse) {
        setGreenhouses((prev) =>
          prev.map((greenhouse) =>
            greenhouse.id === greenhouseId ? { ...greenhouse, ...result.greenhouse } : greenhouse
          )
        );
      }

      if (result?.metricsEvaluation) {
        setEvaluationById((prev) => ({
          ...prev,
          [greenhouseId]: {
            status: result.status,
            alerts: result.alerts,
            metrics: result.metricsEvaluation
          }
        }));
      }

      if (result?.notified) {
        setNotifyFeedbackById((prev) => ({
          ...prev,
          [greenhouseId]: {
            type: 'success',
            text: 'Equipe notificada com sucesso.'
          }
        }));
      } else if (result?.throttled) {
        setNotifyFeedbackById((prev) => ({
          ...prev,
          [greenhouseId]: {
            type: 'info',
            text: 'Um alerta recente já foi enviado. Aguarde o intervalo de 15 minutos.'
          }
        }));
      } else if (result?.status === 'ok') {
        setNotifyFeedbackById((prev) => ({
          ...prev,
          [greenhouseId]: {
            type: 'success',
            text: 'Nenhum alerta crítico detectado neste ciclo.'
          }
        }));
      } else if (Array.isArray(result?.alerts) && result.alerts.length > 0) {
        setNotifyFeedbackById((prev) => ({
          ...prev,
          [greenhouseId]: {
            type: 'info',
            text: 'Alertas registrados. Monitoramento manual recomendado.'
          }
        }));
      } else {
        setNotifyFeedbackById((prev) => ({
          ...prev,
          [greenhouseId]: {
            type: 'info',
            text: 'Validação concluída.'
          }
        }));
      }
    } catch (notifyError) {
      setNotifyFeedbackById((prev) => ({
        ...prev,
        [greenhouseId]: {
          type: 'error',
          text: notifyError.response?.data?.message ?? 'Falha ao notificar a equipe.'
        }
      }));
    } finally {
      setNotifyBusyById((prev) => ({
        ...prev,
        [greenhouseId]: false
      }));
    }
  }, [telemetryById]);

  const clearSimulationTimers = useCallback((greenhouseId, options = { cooling: true, watchdog: true }) => {
    const entry = simulationTimersRef.current[greenhouseId];

    if (!entry) {
      return;
    }

    const shouldClearCooling = options.cooling !== undefined ? options.cooling : true;
    const shouldClearWatchdog = options.watchdog !== undefined ? options.watchdog : true;

    if (shouldClearCooling && entry.coolingTimer) {
      clearTimeoutSafe(entry.coolingTimer);
      entry.coolingTimer = null;
    }

    if (shouldClearWatchdog && entry.watchdogTimer) {
      clearTimeoutSafe(entry.watchdogTimer);
      entry.watchdogTimer = null;
    }

    if (!entry.coolingTimer && !entry.watchdogTimer) {
      delete simulationTimersRef.current[greenhouseId];
    }
  }, []);

  const handleConfirmDeleteGreenhouse = useCallback(async () => {
    if (!deleteTarget || deleteBusy) {
      return;
    }

    setDeleteBusy(true);
    setError(null);

    try {
      const response = await deleteGreenhouse(deleteTarget.id);
      const nextGreenhouses = Array.isArray(response?.greenhouses) ? response.greenhouses : null;

      clearSimulationTimers(deleteTarget.id);
      if (telemetryRef.current) {
        delete telemetryRef.current[deleteTarget.id];
      }

      setTelemetryById((prev) => {
        if (!prev[deleteTarget.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });

      setEventLogById((prev) => {
        if (!prev[deleteTarget.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });

      setEvaluationById((prev) => {
        if (!prev[deleteTarget.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });

      setNotifyFeedbackById((prev) => {
        if (!prev[deleteTarget.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });

      setNotifyBusyById((prev) => {
        if (!prev[deleteTarget.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });

      setSavingById((prev) => {
        if (!prev[deleteTarget.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });

      setAlertsSavingById((prev) => {
        if (!prev[deleteTarget.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });

      if (lastAlertFingerprintRef.current) {
        delete lastAlertFingerprintRef.current[deleteTarget.id];
      }

      if (nextGreenhouses) {
        setGreenhouses(nextGreenhouses);
      } else {
        setGreenhouses((prev) => prev.filter((entry) => entry.id !== deleteTarget.id));
      }

      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError.response?.data?.message ?? 'Não foi possível remover a estufa agora.');
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteTarget, deleteBusy, clearSimulationTimers, deleteGreenhouse]);

  const applyAutomaticCooling = useCallback((greenhouseId) => {
    const greenhouse = greenhouses.find((entry) => entry.id === greenhouseId);

    clearSimulationTimers(greenhouseId);

    if (!greenhouse) {
      return;
    }

    const greenhouseName = greenhouse.name ?? 'Estufa Matriz';
    const profile = greenhouse.profile
      ?? (greenhouse.flowerProfileId ? profileMap[greenhouse.flowerProfileId] : null);
    const nowIso = new Date().toISOString();
    const minTemp = profile?.temperature?.min ?? 19;
    const maxTemp = profile?.temperature?.max ?? 27;
    const target = profile
      ? (profile.temperature.min + profile.temperature.max) / 2
      : 24;

    const baselineTelemetry = telemetryRef.current[greenhouseId]
      ?? createInitialGreenhouseState(greenhouseName);

    const cooledTelemetry = {
      ...baselineTelemetry,
      greenhouseName,
      temperature: clamp(target, minTemp, maxTemp),
      ventilation: 'Ventilação modulada',
      lighting: 'Iluminação automática',
      lastUpdate: nowIso
    };

    setTelemetryById((prev) => ({
      ...prev,
      [greenhouseId]: cooledTelemetry
    }));

    setEventLogById((prev) => {
      const existing = prev[greenhouseId] ?? createInitialEventLog(greenhouseName);
      const entry = {
        id: generateEventId(),
        timestamp: nowIso,
        message:
          'Automação Plantelligence executou resfriamento e comunicou por e-mail que o alerta foi sanado.'
      };
      return {
        ...prev,
        [greenhouseId]: [entry, ...existing].slice(0, 24)
      };
    });

    setNotifyFeedbackById((prev) => ({
      ...prev,
      [greenhouseId]: {
        type: 'success',
        text: 'Automação resfriou a estufa e registrou por e-mail que o incidente foi corrigido.'
      }
    }));
  }, [greenhouses, profileMap, clearSimulationTimers]);

  const runWatchdogCheck = useCallback(
    (greenhouseId) => {
      clearSimulationTimers(greenhouseId, { cooling: false, watchdog: true });

      const greenhouse = greenhouses.find((entry) => entry.id === greenhouseId);

      if (!greenhouse) {
        return;
      }

      const greenhouseName = greenhouse.name ?? 'Estufa Matriz';
      const profile = greenhouse.profile
        ?? (greenhouse.flowerProfileId ? profileMap[greenhouse.flowerProfileId] : null);
      const telemetry = telemetryRef.current[greenhouseId];
      const evaluation = analyzeGreenhouseState(telemetry, profile);

      if (evaluation.status !== 'alert') {
        setNotifyFeedbackById((prev) => ({
          ...prev,
          [greenhouseId]: {
            type: 'success',
            text: 'Alerta normalizado antes do limite de 3 minutos.'
          }
        }));
        return;
      }

      const nowIso = new Date().toISOString();

      setEventLogById((prev) => {
        const existing = prev[greenhouseId] ?? createInitialEventLog(greenhouseName);
        const entry = {
          id: generateEventId(),
          timestamp: nowIso,
          message: 'Alerta térmico continua após 3 minutos. Intervenção manual requisitada.'
        };
        return {
          ...prev,
          [greenhouseId]: [entry, ...existing].slice(0, 24)
        };
      });

      setNotifyFeedbackById((prev) => ({
        ...prev,
        [greenhouseId]: {
          type: 'error',
          text: 'Aquecimento persiste há mais de 3 minutos. Verifique os controladores in loco.'
        }
      }));

      if (!greenhouse.alertsEnabled || !telemetry) {
        return;
      }

      evaluateGreenhouseMetrics(greenhouseId, {
        metrics: {
          temperature: telemetry.temperature,
          humidity: telemetry.humidity,
          soilMoisture: telemetry.soilMoisture
        },
        notify: true
      }).catch(() => {
        setNotifyFeedbackById((prev) => ({
          ...prev,
          [greenhouseId]: {
            type: 'error',
            text: 'Não foi possível notificar a equipe sobre o alerta persistente.'
          }
        }));
      });
    },
    [greenhouses, profileMap, clearSimulationTimers]
  );

  const handleSimulateHeat = useCallback(
    (greenhouseId) => {
      const greenhouse = greenhouses.find((entry) => entry.id === greenhouseId);

      if (!greenhouse) {
        return;
      }

      const greenhouseName = greenhouse.name ?? 'Estufa Matriz';
      const nowIso = new Date().toISOString();

      clearSimulationTimers(greenhouseId);

      let simulatedTelemetry;

      setTelemetryById((prev) => {
        const current = prev[greenhouseId] ?? createInitialGreenhouseState(greenhouseName);
        const nextTemperature = clamp((current.temperature ?? 24) + 5.5, 10, 48);
        simulatedTelemetry = {
          ...current,
          greenhouseName,
          temperature: nextTemperature,
          ventilation: 'Ventilação forçada',
          lighting: 'Iluminação reduzida',
          lastUpdate: nowIso
        };
        return {
          ...prev,
          [greenhouseId]: simulatedTelemetry
        };
      });

      setEventLogById((prev) => {
        const existing = prev[greenhouseId] ?? createInitialEventLog(greenhouseName);
        const entry = {
          id: generateEventId(),
          timestamp: nowIso,
          message: 'Simulação: sensores detectaram temperatura elevada. Alertas automáticos acionados.'
        };
        return {
          ...prev,
          [greenhouseId]: [entry, ...existing].slice(0, 24)
        };
      });

      setNotifyFeedbackById((prev) => ({
        ...prev,
        [greenhouseId]: {
          type: 'info',
          text: 'Alerta térmico simulado. Rotina de resfriamento automático será executada em instantes.'
        }
      }));

      setNotifyBusyById((prev) => ({
        ...prev,
        [greenhouseId]: true
      }));

      evaluateGreenhouseMetrics(greenhouseId, {
        metrics: {
          temperature: simulatedTelemetry?.temperature,
          humidity: simulatedTelemetry?.humidity,
          soilMoisture: simulatedTelemetry?.soilMoisture
        },
        notify: true,
        forceNotify: true
      })
        .then((result) => {
          if (result?.metricsEvaluation) {
            setEvaluationById((prev) => ({
              ...prev,
              [greenhouseId]: {
                status: result.status,
                alerts: result.alerts,
                metrics: result.metricsEvaluation
              }
            }));
          }

          if (result?.greenhouse) {
            setGreenhouses((prev) =>
              prev.map((item) => (item.id === greenhouseId ? { ...item, ...result.greenhouse } : item))
            );
          }

          if (result?.notified) {
            setNotifyFeedbackById((prev) => ({
              ...prev,
              [greenhouseId]: {
                type: 'success',
                text: 'Equipe notificada: alerta simulado identificado e comunicando resfriamento automático.'
              }
            }));
          } else if (result?.throttled) {
            setNotifyFeedbackById((prev) => ({
              ...prev,
              [greenhouseId]: {
                type: 'info',
                text: 'Notificação simulada foi registrada localmente (cooldown ativo).'
              }
            }));
          }
        })
        .catch(() => {
          setNotifyFeedbackById((prev) => ({
            ...prev,
            [greenhouseId]: {
              type: 'error',
              text: 'Falha ao requisitar envio de e-mail do alerta simulado.'
            }
          }));
        })
        .finally(() => {
          setNotifyBusyById((prev) => ({
            ...prev,
            [greenhouseId]: false
          }));
        });

      const coolingTimer = setTimeoutSafe(() => {
        applyAutomaticCooling(greenhouseId);
      }, AUTOMATION_COOLING_DELAY_MS);

      const watchdogTimer = setTimeoutSafe(() => {
        runWatchdogCheck(greenhouseId);
      }, ALERT_WATCHDOG_DELAY_MS);

      simulationTimersRef.current[greenhouseId] = {
        coolingTimer: coolingTimer ?? null,
        watchdogTimer: watchdogTimer ?? null
      };
    },
    [greenhouses, clearSimulationTimers, applyAutomaticCooling, runWatchdogCheck]
  );

  if (requiresPasswordReset) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16 text-slate-100">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6">
          <h1 className="text-2xl font-semibold text-amber-200">Redefina sua senha</h1>
          <p className="mt-4 text-sm text-amber-100/90">
            Para acessar o painel multi-estufas é necessário redefinir a senha temporária. Essa etapa garante a conformidade com a política de segurança LGPD da Plantelligence.
          </p>
          <Link
            to="/password-reset"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-200 hover:text-amber-50"
          >
            Ir para redefinição de senha
          </Link>
        </div>
      </div>
    );
  }

  const isLoadingInitial = loading && greenhouses.length === 0;
  const shouldShowEmptyState = !loading && greenhouses.length === 0;
  const deleteDialogTargetName = deleteTarget?.name?.trim() || 'esta estufa';
  const deleteDialogDescription = deleteTarget
    ? deleteTarget.isLast
      ? `Remover a estufa ${deleteDialogTargetName}? Uma estufa padrão será criada automaticamente para manter o monitoramento disponível.`
      : `Remover a estufa ${deleteDialogTargetName}? Esta ação não poderá ser desfeita.`
    : '';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Painel principal</span>
          <h1 className="text-3xl font-semibold text-emerald-100">Controlador das estufas</h1>
          <p className="mt-2 max-w-2xl text-sm text-emerald-100/70">
            Gerencie múltiplas estufas, acompanhe telemetria em tempo real e envie alertas sob demanda respeitando o intervalo mínimo de 15 minutos entre notificações automáticas.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Button variant="secondary" type="button" onClick={handleCreateGreenhouse} disabled={creating}>
            {creating ? 'Criando estufa...' : 'Nova estufa'}
          </Button>
          <Link
            to="/settings"
            className="inline-flex items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
          >
            Configurações da conta
          </Link>
        </div>
      </header>

      {error ? (
        <div className="mt-6 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {isLoadingInitial ? (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {[0, 1].map((placeholder) => (
            <div
              key={placeholder}
              className="h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70"
            />
          ))}
        </div>
      ) : null}

      {shouldShowEmptyState ? (
        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/70 p-10 text-center text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">Nenhuma estufa cadastrada ainda</h2>
          <p className="mt-3 text-sm text-slate-400">
            Cadastre sua primeira estufa para acompanhar parâmetros críticos, definir o perfil de cultivo e habilitar alertas automáticos para a equipe responsável.
          </p>
          <Button
            type="button"
            className="mt-5"
            onClick={handleCreateGreenhouse}
            disabled={creating}
          >
            {creating ? 'Criando estufa...' : 'Criar estufa agora'}
          </Button>
        </div>
      ) : null}

      {greenhouses.length > 0 ? (
        <div className="mt-12 space-y-10">
          {greenhouses.map((greenhouse) => (
            <GreenhousePanel
              key={greenhouse.id}
              greenhouse={greenhouse}
              telemetry={telemetryById[greenhouse.id]}
              eventLog={eventLogById[greenhouse.id]}
              evaluation={evaluationById[greenhouse.id]}
              profiles={profiles}
              notifyFeedback={notifyFeedbackById[greenhouse.id]}
              saving={Boolean(savingById[greenhouse.id])}
              alertsSaving={Boolean(alertsSavingById[greenhouse.id])}
              notifyBusy={Boolean(notifyBusyById[greenhouse.id])}
              onSave={handleSaveGreenhouse}
              onToggleAlerts={handleToggleAlerts}
              onNotify={handleNotifyTeam}
              onSimulateHeat={handleSimulateHeat}
              onDeleteRequest={handleRequestDeleteGreenhouse}
            />
          ))}
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remover estufa"
        description={deleteDialogDescription}
        confirmLabel={deleteBusy ? 'Removendo...' : 'Remover estufa'}
        confirmDisabled={deleteBusy}
        cancelDisabled={deleteBusy}
        onConfirm={handleConfirmDeleteGreenhouse}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};
