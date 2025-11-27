import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { useAuthStore } from '../store/authStore.js';
import { getSecurityLogs } from '../api/userService.js';

const formatLogTimestamp = (value) => {
  if (!value) {
    return 'Data indisponível';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const dateLabel = date.toLocaleDateString('pt-BR');
  const hours = date.getHours().toString().padStart(2, '0');
  return `${dateLabel} às ${hours}hrs`;
};

const extractFullName = (entry) => {
  const metadata = entry?.metadata ?? {};
  return (
    metadata.fullName ??
    metadata.nomeCompleto ??
    metadata.user?.fullName ??
    metadata.actor?.fullName ??
    null
  );
};

const extractEmail = (entry) => {
  const metadata = entry?.metadata ?? {};
  return (
    metadata.email ??
    metadata.mail ??
    metadata.user?.email ??
    metadata.actor?.email ??
    null
  );
};

export const SecurityLogsPage = () => {
  const { user } = useAuthStore((state) => ({ user: state.user }));
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = user?.role === 'Admin';

  const fetchLogs = async () => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getSecurityLogs();
      setLogs(result.logs ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Não foi possível carregar os logs de segurança.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900 p-8 text-sm text-slate-200 shadow-xl">
        <header>
          <h1 className="text-2xl font-semibold text-slate-100">Logs de segurança</h1>
          <p className="mt-2 text-sm text-slate-400">
            Apenas administradores (DPO e SOC) podem auditar a cadeia imutável de eventos.
          </p>
        </header>
        <p className="rounded border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Solicite ao time de governança para obter acesso. Todos os eventos continuam sendo registrados normalmente.
        </p>
      </div>
    );
  }

  const loginLogs = logs.filter((entry) => entry.action === 'login_success');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900 p-8 text-sm text-slate-200 shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Logs de segurança</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cadeia imutável com hash encadeado para auditoria forense e governança LGPD.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchLogs} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar logs'}
        </Button>
      </header>

      {error && (
        <p className="rounded border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      )}

      {loginLogs.length === 0 && !loading ? (
        <p className="rounded border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Nenhum acesso recente encontrado. Os registros aparecerão conforme novos logins forem realizados.
        </p>
      ) : (
        <div className="max-h-[480px] space-y-3 overflow-y-auto pr-2 text-xs text-slate-200">
          {loginLogs.map((entry) => {
            const fullName = extractFullName(entry);
            const email = extractEmail(entry);
            return (
            <article key={entry.id} className="rounded border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-sm font-semibold text-emerald-300">{formatLogTimestamp(entry.createdAt)}</p>
              <p className="mt-2 text-xs text-slate-300">
                Nome completo:{' '}
                <span className="text-slate-200">{fullName ?? 'Informação não disponível'}</span>
              </p>
              <p className="text-xs text-slate-300">
                E-mail:{' '}
                <span className="text-slate-200">{email ?? 'Informação não disponível'}</span>
              </p>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
