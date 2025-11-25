import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { InputField } from '../components/InputField.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import {
  getProfile,
  updateProfile,
  changePassword,
  requestDeletion,
  getSecurityLogs
} from '../api/userService.js';
import { getPublicKey, simulateSecureMessage } from '../api/cryptoService.js';
import { useAuthStore } from '../store/authStore.js';
import { isPasswordCompliant, passwordPattern, passwordPolicy } from '../utils/passwordPolicy.js';

export const DashboardPage = () => {
  const { user, updateUser, tokens, requiresPasswordReset, setRequiresPasswordReset } = useAuthStore((state) => ({
    user: state.user,
    updateUser: state.updateUser,
    tokens: state.tokens,
    requiresPasswordReset: state.requiresPasswordReset,
    setRequiresPasswordReset: state.setRequiresPasswordReset
  }));
  const [profile, setProfile] = useState(user);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [cryptoMessage, setCryptoMessage] = useState('Comando crítico: abrir estufa às 06h.');
  const [cryptoResult, setCryptoResult] = useState(null);
  const [cryptoPublicKey, setCryptoPublicKey] = useState(null);
  const [cryptoError, setCryptoError] = useState(null);
  const [loadingCrypto, setLoadingCrypto] = useState(false);

  const formatDate = useMemo(
    () =>
      (value, { includeTime = false } = {}) => {
        if (!value) {
          return '-';
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          return '-';
        }

        const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        const datePart = dateFormatter.format(parsed);

        if (!includeTime) {
          return datePart;
        }

        const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        return `${datePart} às ${timeFormatter.format(parsed)}`;
      },
    []
  );

  const formatShortTimestamp = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return (value) => {
      if (!value) {
        return '-';
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return '-';
      }

      const formatted = formatter.format(parsed);
      return formatted.replace(',', '');
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const result = await getProfile();
        setProfile(result.user);
        updateUser(result.user);
      } catch (error) {
        setFeedback(error.response?.data?.message ?? 'Não foi possível carregar o perfil.');
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [updateUser]);

  const handleProfileChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProfile((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const submitProfileUpdate = async () => {
    setConfirmUpdate(false);
    try {
      const result = await updateProfile({
        fullName: profile.fullName,
        phone: profile.phone,
        consentGiven: profile.consentGiven
      });
      updateUser(result.user);
      setProfile(result.user);
      setFeedback('Dados atualizados com sucesso.');
    } catch (error) {
      setFeedback(error.response?.data?.message ?? 'Falha ao atualizar dados.');
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordFeedback(null);
    if (!isPasswordCompliant(passwordForm.newPassword)) {
      setPasswordFeedback(passwordPolicy.message);
      return;
    }
    try {
      const result = await changePassword(passwordForm);
      setPasswordFeedback(result.message);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setRequiresPasswordReset(false);
    } catch (error) {
      setPasswordFeedback(error.response?.data?.message ?? 'Não foi possível alterar a senha.');
    }
  };

  const confirmDeletionRequest = async () => {
    setConfirmDeletion(false);
    try {
      const result = await requestDeletion({ reason: 'Demonstração LGPD' });
      setFeedback(result.message);
      setProfile((prev) => ({ ...prev, deletionRequested: true }));
    } catch (error) {
      setFeedback(error.response?.data?.message ?? 'Falha ao registrar solicitação.');
    }
  };

  const loadLogs = async () => {
    try {
      const result = await getSecurityLogs();
      setLogs(result.logs);
      setLogsLoaded(true);
    } catch (error) {
      setFeedback(error.response?.data?.message ?? 'Não foi possível carregar os logs.');
    }
  };

  const handleCryptoSimulation = async () => {
    try {
      setCryptoError(null);
      setLoadingCrypto(true);
      if (!cryptoPublicKey) {
        const keyResult = await getPublicKey();
        setCryptoPublicKey(keyResult.publicKey ?? '');
      }
      setCryptoResult(null);
      const result = await simulateSecureMessage({ message: cryptoMessage });
      setCryptoResult(result);
    } catch (error) {
      setCryptoError(error.response?.data?.message ?? 'Falha na simulação de criptografia.');
    } finally {
      setLoadingCrypto(false);
    }
  };

  const friendlyLogs = useMemo(() => {
    const allowedActions = new Set([
      'login_success',
      'logout',
      'user_profile_updated',
      'user_profile_update',
      'user_profile_change',
      'password_changed',
      'user_password_changed',
      'password_change',
      'login_completed',
      'user_login',
      'user_logout'
    ]);

    return logs.filter((entry) => {
      const action = entry?.action;
      if (!action) {
        return false;
      }
      const normalized = action.toLowerCase();
      if (normalized.includes('erro') || normalized.includes('error') || normalized.includes('fail') || normalized.includes('falha')) {
        return false;
      }
      if (allowedActions.has(normalized)) {
        return true;
      }
      const profileKeywords = ['profile', 'cadastr', 'dados'];
      const passwordKeywords = ['senha', 'password'];
      if (profileKeywords.some((keyword) => normalized.includes(keyword))) {
        return true;
      }
      if (passwordKeywords.some((keyword) => normalized.includes(keyword))) {
        return true;
      }
      return normalized.includes('login') || normalized.includes('logout') || normalized.includes('logoff');
    });
  }, [logs]);

  const formatActionLabel = (action) => {
    if (!action) {
      return 'Registro de acesso';
    }
    const normalized = action.toLowerCase();
    if (normalized.includes('logout') || normalized.includes('logoff') || normalized === 'logout') {
      return 'Logout realizado';
    }
    if (normalized.includes('login')) {
      return 'Login realizado';
    }
    if (normalized.includes('senha') || normalized.includes('password')) {
      return 'Senha atualizada';
    }
    if (normalized.includes('profile') || normalized.includes('cadastr') || normalized.includes('dados')) {
      return 'Dados do perfil atualizados';
    }
    return action
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\w/, (match) => match.toUpperCase());
  };

  const buildMetadataLines = (metadata) => {
    if (!metadata) {
      return [];
    }
    if (typeof metadata !== 'object') {
      return [String(metadata)];
    }
    const hiddenKeys = new Set([
      'passwordexpired',
      'senhaexpirada',
      'consentgiven',
      'consent',
      'expiresat'
    ]);
    return Object.entries(metadata)
      .filter(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return false;
        }
        const normalizedKey = String(key).toLowerCase().replace(/[^a-z]/g, '');
        return !hiddenKeys.has(normalizedKey);
      })
      .map(([key, value]) => {
        const readableKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/[_-]/g, ' ')
          .trim();
        const capitalizedKey = readableKey.charAt(0).toUpperCase() + readableKey.slice(1);
        return `${capitalizedKey}: ${String(value)}`;
      });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      {requiresPasswordReset && (
        <div className="rounded border border-amber-500/60 bg-amber-500/10 p-4 text-sm text-amber-200">
          É necessário alterar a senha, pois o prazo de expiração foi atingido.
        </div>
      )}
      {feedback && (
        <div className="rounded border border-emerald-500/60 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {feedback}
        </div>
      )}
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Meus dados</h2>
              <p className="text-xs text-slate-400">Minimização de dados e consentimento explícito.</p>
            </div>
            <Button variant="secondary" onClick={() => setConfirmUpdate(true)} disabled={loadingProfile}>
              Salvar alterações
            </Button>
          </header>
          <div className="flex flex-col gap-4">
            <InputField
              label="Nome completo"
              name="fullName"
              value={profile?.fullName ?? ''}
              onChange={handleProfileChange}
            />
            <InputField
              label="Telefone"
              name="phone"
              value={profile?.phone ?? ''}
              onChange={handleProfileChange}
            />
            <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100">
              Você segue autorizando o uso dos seus dados para controlar as estufas. Caso deseje revogar, peça a exclusão logo abaixo.
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
              <p>Última atualização: {formatDate(profile?.updatedAt, { includeTime: true })}</p>
              <p>Senha expira em: {formatDate(profile?.passwordExpiresAt)}</p>
            </div>
          </div>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Alterar senha</h2>
            <p className="text-xs text-slate-400">Requer autenticação atual e gera logs de auditoria.</p>
          </header>
          <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
            <InputField
              label="Senha atual"
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
              required
            />
            <InputField
              label="Nova senha"
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
              required
            />
            <Button type="submit">Atualizar senha</Button>
          </form>
          {passwordFeedback && (
            <p className="mt-4 rounded border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200">
              {passwordFeedback}
            </p>
          )}
        </article>
      </section>
      <section className="rounded-lg border border-rose-600/60 bg-rose-600/10 p-6 shadow-lg">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-rose-200">Excluir seu perfil</h2>
          <p className="text-sm text-rose-100/80">
            Ao clicar em excluir, todos os dados associados ao seu usuário serão removidos dos fluxos ativos e marcados para descarte seguro.
          </p>
          <Button variant="danger" onClick={() => setConfirmDeletion(true)} disabled={profile?.deletionRequested}>
            {profile?.deletionRequested ? 'Solicitação pendente' : 'Solicitar exclusão de dados'}
          </Button>
        </div>
      </section>
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Logs de auditoria</h2>
              <p className="text-xs text-slate-400">Eventos de login e encerramento de sessão.</p>
            </div>
            <Button variant="secondary" onClick={loadLogs} disabled={logsLoaded && logs.length === 0}>
              {logsLoaded ? 'Recarregar' : 'Carregar eventos'}
            </Button>
          </header>
          {friendlyLogs.length > 0 ? (
            <div className="max-h-64 space-y-3 overflow-y-auto text-sm text-slate-300">
              {friendlyLogs.map((entry) => {
                const metadataLines = buildMetadataLines(entry.metadata);
                const key = entry.id ?? `${entry.action}-${entry.createdAt}`;
                return (
                  <div key={key} className="rounded border border-slate-800 bg-slate-900/60 p-3">
                    <p className="font-semibold text-slate-100">{formatActionLabel(entry.action)}</p>
                    <p className="text-xs text-slate-400">
                      {formatShortTimestamp(entry.createdAt)}
                      {entry.userId ? ` · Usuário: ${entry.userId}` : ''}
                    </p>
                    {metadataLines.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-400">
                        {metadataLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : logsLoaded ? (
            <p className="text-sm text-slate-400">Nenhum login ou logout recente para exibir.</p>
          ) : (
            <p className="text-sm text-slate-400">Clique em carregar para consultar os eventos de acesso.</p>
          )}
      </section>
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-100">Criptografia ponta a ponta</h2>
              <p className="text-xs text-slate-400">Demonstração AES-256 com troca de chave RSA.</p>
            </header>
            <div className="flex flex-col gap-4">
              <textarea
                className="min-h-[120px] rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                value={cryptoMessage}
                onChange={(event) => setCryptoMessage(event.target.value)}
              />
              <Button variant="secondary" onClick={handleCryptoSimulation} disabled={loadingCrypto}>
                {loadingCrypto ? 'Processando...' : 'Simular comunicação segura'}
              </Button>
              {cryptoError && <p className="text-sm text-rose-300">{cryptoError}</p>}
              {cryptoPublicKey && (
                <details className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <summary className="cursor-pointer text-xs text-emerald-300">Chave pública RSA (PEM)</summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-slate-400">{cryptoPublicKey}</pre>
                </details>
              )}
              {cryptoResult && (
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                  <p>Mensagem criptografada: {cryptoResult.encryptedMessage}</p>
                  <p className="mt-2">Chave protegida: {cryptoResult.encryptedKey}</p>
                  <p className="mt-2">IV: {cryptoResult.iv}</p>
                  <p className="mt-2">Tag de autenticação: {cryptoResult.authTag}</p>
                  <p className="mt-2 text-emerald-300">Verificação do backend: {cryptoResult.verification}</p>
                </div>
              )}
            </div>
          </section>
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-100">Sessão ativa</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            Sua sessão expira em{' '}
            <span className="font-semibold text-slate-100">
              {formatDate(tokens?.accessExpiresAt, { includeTime: true })}
            </span>
          </p>
          <p>
            Renovação automática disponível até{' '}
            <span className="font-semibold text-slate-100">
              {formatDate(tokens?.refreshExpiresAt, { includeTime: true })}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            Refaça o login antes do vencimento para manter o acesso seguro aos módulos da plataforma.
          </p>
        </div>
      </section>
      <ConfirmDialog
        open={confirmUpdate}
        title="Confirmar atualização"
        description="Confirme que deseja atualizar seus dados pessoais de forma segura."
        onCancel={() => setConfirmUpdate(false)}
        onConfirm={submitProfileUpdate}
      />
      <ConfirmDialog
        open={confirmDeletion}
        title="Excluir meus dados"
        description="Esta ação registra seu pedido de exclusão conforme a LGPD e impedirá acessos futuros."
        confirmLabel="Solicitar exclusão"
        onCancel={() => setConfirmDeletion(false)}
        onConfirm={confirmDeletionRequest}
      />
    </div>
  );
};
