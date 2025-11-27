import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Button } from '../components/Button.jsx';
import { InputField } from '../components/InputField.jsx';
import {
  getProfile,
  updateProfile,
  changePassword,
  requestDeletion,
  startOtpEnrollment,
  confirmOtpEnrollment,
  requestPasswordChangeChallenge
} from '../api/userService.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { useAuthStore } from '../store/authStore.js';

export const UserSettingsPage = () => {
  const { user, updateUser, requiresPasswordReset, setRequiresPasswordReset } = useAuthStore((state) => ({
    user: state.user,
    updateUser: state.updateUser,
    requiresPasswordReset: state.requiresPasswordReset,
    setRequiresPasswordReset: state.setRequiresPasswordReset
  }));

  const [profile, setProfile] = useState(user);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [confirmSaveProfile, setConfirmSaveProfile] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordMfaMethod, setPasswordMfaMethod] = useState(() =>
    user?.mfa?.otp?.configuredAt ? 'otp' : 'email'
  );
  const [passwordOtpCode, setPasswordOtpCode] = useState('');
  const [passwordChallenge, setPasswordChallenge] = useState(null);
  const [passwordChallengeCode, setPasswordChallengeCode] = useState('');
  const [passwordChallengeLoading, setPasswordChallengeLoading] = useState(false);
  const [passwordChallengeFeedback, setPasswordChallengeFeedback] = useState(null);
  const [passwordChallengeError, setPasswordChallengeError] = useState(null);

  const [enrollment, setEnrollment] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMessage, setOtpMessage] = useState(null);
  const [otpError, setOtpError] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoadingProfile(true);
      setProfileError(null);
      try {
        const result = await getProfile();
        setProfile(result.user);
        updateUser(result.user);
      } catch (err) {
        setProfileError(err.response?.data?.message ?? 'Não foi possível carregar o perfil.');
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [updateUser]);

  const otpConfigured = Boolean(profile?.mfa?.otp?.configuredAt);

  useEffect(() => {
    setPasswordMfaMethod((prev) => {
      if (!otpConfigured && prev === 'otp') {
        return 'email';
      }
      if (!prev) {
        return otpConfigured ? 'otp' : 'email';
      }
      return prev;
    });
  }, [otpConfigured]);

  useEffect(() => {
    if (passwordMfaMethod === 'otp') {
      setPasswordChallenge(null);
      setPasswordChallengeCode('');
      setPasswordChallengeFeedback(null);
      setPasswordChallengeError(null);
    } else if (passwordMfaMethod === 'email') {
      setPasswordOtpCode('');
    }
  }, [passwordMfaMethod]);

  const handleProfileChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProfile((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const submitProfileUpdate = async () => {
    setConfirmSaveProfile(false);
    setProfileFeedback(null);
    setProfileError(null);
    try {
      const result = await updateProfile({
        fullName: profile?.fullName,
        phone: profile?.phone,
        consentGiven: profile?.consentGiven
      });
      setProfile(result.user);
      updateUser(result.user);
      setProfileFeedback('Dados atualizados com sucesso.');
    } catch (err) {
      setProfileError(err.response?.data?.message ?? 'Falha ao atualizar dados.');
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordFeedback(null);
    setPasswordError(null);
     setPasswordChallengeError(null);
    try {
      let verification;

      if (passwordMfaMethod === 'otp') {
        if (passwordOtpCode.trim().length !== 6) {
          setPasswordError('Informe o código de 6 dígitos do autenticador.');
          return;
        }
        verification = { otpCode: passwordOtpCode.trim() };
      } else {
        if (!passwordChallenge?.challengeId) {
          setPasswordError('Solicite um código MFA por e-mail antes de alterar a senha.');
          return;
        }
        if (passwordChallengeCode.trim().length !== 6) {
          setPasswordError('Informe o código de 6 dígitos enviado por e-mail.');
          return;
        }
        verification = {
          challengeId: passwordChallenge.challengeId,
          code: passwordChallengeCode.trim()
        };
      }

      const result = await changePassword({
        ...passwordForm,
        verification
      });
      setPasswordFeedback(result.message);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setPasswordOtpCode('');
      setPasswordChallenge(null);
      setPasswordChallengeCode('');
      setPasswordChallengeFeedback(null);
      setRequiresPasswordReset(false);
    } catch (err) {
      setPasswordError(err.response?.data?.message ?? 'Não foi possível alterar a senha.');
    }
  };

  const handleRequestPasswordChallenge = async () => {
    setPasswordChallengeError(null);
    setPasswordChallengeFeedback(null);
    setPasswordChallengeLoading(true);
    try {
      const challenge = await requestPasswordChangeChallenge();
      setPasswordChallenge(challenge);
      setPasswordChallengeCode('');
      setPasswordChallengeFeedback('Código MFA enviado para o e-mail corporativo.');
    } catch (err) {
      setPasswordChallengeError(err.response?.data?.message ?? 'Não foi possível enviar o código MFA.');
    } finally {
      setPasswordChallengeLoading(false);
    }
  };

  const handleDeletionRequest = async () => {
    setConfirmDeletion(false);
    setProfileFeedback(null);
    setProfileError(null);
    try {
      const result = await requestDeletion({ reason: 'Pedido via portal do usuário' });
      setProfileFeedback(result.message);
      setProfile((prev) => ({ ...prev, deletionRequested: true }));
    } catch (err) {
      setProfileError(err.response?.data?.message ?? 'Falha ao registrar solicitação.');
    }
  };

  const handleStartEnrollment = async () => {
    setOtpError(null);
    setOtpMessage(null);
    setOtpCode('');
    setOtpLoading(true);
    try {
      const result = await startOtpEnrollment();
      setEnrollment(result);
      setOtpMessage('Escaneie o QR Code e confirme com o primeiro código gerado.');
    } catch (err) {
      setOtpError(err.response?.data?.message ?? 'Não foi possível iniciar a configuração do autenticador.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleCancelEnrollment = () => {
    setEnrollment(null);
    setOtpCode('');
    setOtpMessage(null);
    setOtpError(null);
  };

  const handleConfirmEnrollment = async (event) => {
    event.preventDefault();

    if (!enrollment?.enrollmentId) {
      setOtpError('Inicie a configuração antes de validar o código.');
      return;
    }

    if (otpCode.trim().length !== 6) {
      setOtpError('Informe o código de 6 dígitos gerado pelo aplicativo.');
      return;
    }

    setOtpLoading(true);
    setOtpError(null);
    try {
      const result = await confirmOtpEnrollment({
        enrollmentId: enrollment.enrollmentId,
        code: otpCode.trim()
      });

      if (result?.user) {
        updateUser(result.user);
        setProfile(result.user);
      }

      setEnrollment(null);
      setOtpCode('');
      setOtpMessage('Autenticador configurado com sucesso.');
    } catch (err) {
      setOtpError(err.response?.data?.message ?? 'Não foi possível validar o código informado.');
    } finally {
      setOtpLoading(false);
    }
  };

  const otpConfiguredAt = profile?.mfa?.otp?.configuredAt ?? null;
  const passwordChallengeExpiresLabel = passwordChallenge?.expiresAt
    ? (() => {
        const expires = new Date(passwordChallenge.expiresAt);
        return Number.isNaN(expires.getTime())
          ? null
          : expires.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            });
      })()
    : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-xl">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Configurações e Segurança</h1>
        <p className="mt-2 text-sm text-slate-400">
          Atualize seus dados, controle o consentimento LGPD e mantenha o segundo fator de autenticação em dia.
        </p>
      </header>

      {requiresPasswordReset && (
        <div className="rounded border border-amber-500/60 bg-amber-500/10 p-4 text-sm text-amber-200">
          Sua senha expirada precisa ser atualizada para manter o acesso às estufas.
        </div>
      )}

      {profileError && (
        <div className="rounded border border-rose-500/60 bg-rose-500/10 p-4 text-sm text-rose-200">
          {profileError}
        </div>
      )}
      {profileFeedback && (
        <div className="rounded border border-emerald-500/60 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {profileFeedback}
        </div>
      )}

      <section id="dados" className="rounded-md border border-slate-800 bg-slate-950 p-6 text-sm text-slate-200">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Informações pessoais</h2>
            <p className="text-xs text-slate-400">Somente dados essenciais para operar o controlador da estufa.</p>
          </div>
          <Button variant="secondary" onClick={() => setConfirmSaveProfile(true)} disabled={loadingProfile}>
            Salvar alterações
          </Button>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Nome completo"
            name="fullName"
            value={profile?.fullName ?? ''}
            onChange={handleProfileChange}
            disabled={loadingProfile}
          />
          <InputField
            label="Telefone"
            name="phone"
            value={profile?.phone ?? ''}
            onChange={handleProfileChange}
            disabled={loadingProfile}
          />
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            name="consentGiven"
            checked={profile?.consentGiven ?? false}
            onChange={handleProfileChange}
            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring focus:ring-emerald-500/40"
            disabled={loadingProfile}
          />
          <span>
            Continuo autorizando o tratamento dos meus dados pessoais exclusivamente para automação e monitoramento das estufas, e confirmo que li e estou de acordo com os Termos de Uso e a Política de Privacidade. Posso revogar este consentimento ou solicitar a exclusão dos meus dados a qualquer momento. Para mais informações, consulte os links disponíveis no rodapé do site.
          </span>
        </label>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 text-xs text-slate-400">
          <div>
            <dt className="font-semibold text-slate-300">E-mail corporativo</dt>
            <dd>{profile?.email}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-300">Função / RBAC</dt>
            <dd>{profile?.role}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-300">Último acesso</dt>
            <dd>{profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : 'Nunca registrado'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-300">Senha expira em</dt>
            <dd>{profile?.passwordExpiresAt ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section id="senha" className="rounded-md border border-slate-800 bg-slate-950 p-6 text-sm text-slate-200">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Senha e autenticação primária</h2>
          <p className="text-xs text-slate-400">Trocar a senha invalida tokens antigos e registra auditoria.</p>
        </header>
        {passwordError && (
          <p className="mb-4 rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {passwordError}
          </p>
        )}
        {passwordChallengeError && (
          <p className="mb-4 rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {passwordChallengeError}
          </p>
        )}
        {passwordFeedback && (
          <p className="mb-4 rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {passwordFeedback}
          </p>
        )}
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
            autoComplete="current-password"
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
            autoComplete="new-password"
          />
          <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Confirmação MFA</p>
            <p className="mt-1 text-xs text-slate-500">
              Confirme com o segundo fator antes de concluir a troca de senha.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {otpConfigured && (
                <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                  <input
                    type="radio"
                    name="password-mfa-method"
                    value="otp"
                    checked={passwordMfaMethod === 'otp'}
                    onChange={() => setPasswordMfaMethod('otp')}
                    className="h-3 w-3"
                  />
                  Aplicativo autenticador
                </label>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                <input
                  type="radio"
                  name="password-mfa-method"
                  value="email"
                  checked={passwordMfaMethod === 'email'}
                  onChange={() => setPasswordMfaMethod('email')}
                  className="h-3 w-3"
                />
                E-mail corporativo
              </label>
            </div>
            {passwordMfaMethod === 'otp' ? (
              <div className="mt-4">
                <InputField
                  label="Código do autenticador"
                  name="passwordOtpCode"
                  value={passwordOtpCode}
                  onChange={(event) => setPasswordOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
                <p className="mt-2 text-xs text-slate-500">
                  Use o aplicativo autenticador configurado para esta conta.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRequestPasswordChallenge}
                    disabled={passwordChallengeLoading}
                  >
                    {passwordChallengeLoading ? 'Enviando...' : 'Enviar código por e-mail'}
                  </Button>
                  <span className="text-xs text-slate-400">
                    {passwordChallengeExpiresLabel
                      ? `Expira às ${passwordChallengeExpiresLabel}.`
                      : 'Código válido por aproximadamente 5 minutos.'}
                  </span>
                </div>
                {passwordChallengeFeedback && (
                  <p className="rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    {passwordChallengeFeedback}
                  </p>
                )}
                <InputField
                  label="Código recebido por e-mail"
                  name="passwordChallengeCode"
                  value={passwordChallengeCode}
                  onChange={(event) => setPasswordChallengeCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
                {passwordChallenge?.debugCode && (
                  <p className="text-xs text-amber-300">
                    Código de depuração: {passwordChallenge.debugCode}
                  </p>
                )}
              </div>
            )}
          </div>
          <Button type="submit">Atualizar senha</Button>
        </form>
      </section>

      <section id="autenticador" className="rounded-md border border-emerald-500/60 bg-emerald-500/5 p-6 text-sm text-slate-200">
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-emerald-200">Aplicativo autenticador (MFA)</h2>
          <p className="text-xs text-emerald-100/80">
            Gere códigos temporários mesmo sem acesso ao e-mail corporativo. Isso garante operação offline das estufas.
          </p>
        </header>
        {otpError && (
          <p className="mb-4 rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{otpError}</p>
        )}
        {otpMessage && (
          <p className="mb-4 rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{otpMessage}</p>
        )}
        <p className="text-xs text-emerald-100/70">
          Status atual: {otpConfiguredAt ? `Configurado em ${new Date(otpConfiguredAt).toLocaleString()}` : 'Ainda não configurado'}.
        </p>
        {!enrollment ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleStartEnrollment} disabled={otpLoading}>
              {otpConfiguredAt ? 'Reconfigurar autenticador' : 'Configurar autenticador'}
            </Button>
            {otpConfiguredAt && (
              <span className="text-xs text-emerald-200/70">A reconfiguração substitui o segredo atual.</span>
            )}
          </div>
        ) : null}

        {profile?.mfa?.email && (
          <p className="mt-4 text-xs text-emerald-100/70">
            Código por e-mail configurado em {profile.mfa.email.configuredAt ? new Date(profile.mfa.email.configuredAt).toLocaleString() : 'data não registrada'}.
          </p>
        )}

        {enrollment ? (
          <div className="mt-6 flex flex-col gap-4 rounded-md border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-200">
              Escaneie o QR Code abaixo ou utilize a chave secreta no aplicativo autenticador.
            </p>
            <div className="flex flex-col items-center gap-3">
              {enrollment.uri ? (
                <QRCode value={enrollment.uri} size={180} bgColor="#0f172a" fgColor="#34d399" />
              ) : null}
              <p className="text-xs text-slate-400">
                Conta: {enrollment.accountName} • Emissor: {enrollment.issuer}
              </p>
              <p className="break-all rounded-md bg-slate-950 px-3 py-2 font-mono text-base tracking-wider text-emerald-300">
                {enrollment.secret}
              </p>
              {enrollment.debugCode && (
                <p className="text-xs text-amber-300">Modo de depuração (OTP): {enrollment.debugCode}</p>
              )}
            </div>
            <form className="flex flex-col gap-3" onSubmit={handleConfirmEnrollment}>
              <InputField
                label="Código do autenticador"
                name="otpCode"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                required
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={otpLoading || otpCode.length !== 6}>
                  {otpLoading ? 'Validando...' : 'Confirmar autenticador'}
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancelEnrollment} disabled={otpLoading}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      <section id="lgpd" className="rounded-md border border-rose-600/60 bg-rose-600/10 p-6 text-sm text-rose-100">
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-rose-200">Direito ao esquecimento</h2>
          <p className="text-xs text-rose-100/80">
            Registramos o pedido e garantimos a anonimização conforme os fluxos LGPD do Plantelligence.
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="danger" onClick={() => setConfirmDeletion(true)} disabled={profile?.deletionRequested}>
            {profile?.deletionRequested ? 'Solicitação pendente' : 'Solicitar exclusão de dados'}
          </Button>
          {profile?.deletionRequested && (
            <span className="text-xs text-rose-100/70">Pedido registrado. O DPO notificará quando a remoção for concluída.</span>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmSaveProfile}
        title="Confirmar atualização"
        description="Confirme que deseja atualizar os dados pessoais armazenados pelo Plantelligence."
        onCancel={() => setConfirmSaveProfile(false)}
        onConfirm={submitProfileUpdate}
      />
      <ConfirmDialog
        open={confirmDeletion}
        title="Excluir meus dados"
        description="Esta ação registra o pedido de exclusão conforme a LGPD e suspende acessos ao controlador."
        confirmLabel="Solicitar exclusão"
        onCancel={() => setConfirmDeletion(false)}
        onConfirm={handleDeletionRequest}
      />
    </div>
  );
};
