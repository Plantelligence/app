import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputField } from '../components/InputField.jsx';
import { Button } from '../components/Button.jsx';
import { register, confirmRegistration, finalizeRegistration } from '../api/authService.js';
import { isPasswordCompliant, passwordPattern, passwordPolicy } from '../utils/passwordPolicy.js';

const initialState = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  consent: false
};

export const RegisterPage = () => {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form');
  const [challenge, setChallenge] = useState(null);
  const [emailCode, setEmailCode] = useState('');
  const [otpSetup, setOtpSetup] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [debugEmailCode, setDebugEmailCode] = useState(null);
  const [debugOtpCode, setDebugOtpCode] = useState(null);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (step === 'form') {
      if (form.password !== form.confirmPassword) {
        setError('As senhas precisam coincidir.');
        return;
      }
      if (!isPasswordCompliant(form.password)) {
        setError(passwordPolicy.message);
        return;
      }
      if (!form.consent) {
        setError('Consentimento LGPD é obrigatório para o cadastro.');
        return;
      }

      setLoading(true);
      try {
        const result = await register({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          consent: form.consent
        });
        setChallenge(result);
        setDebugEmailCode(result.debugCode ?? null);
        setStep('email');
        setSuccess('Enviamos um código de verificação para o seu e-mail. Informe-o para seguir com a configuração do autenticador.');
        setEmailCode('');
        setOtpSetup(null);
        setOtpCode('');
      } catch (err) {
        setError(err.response?.data?.message ?? 'Não foi possível iniciar o cadastro.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 'email') {
      if (!challenge?.challengeId) {
        setError('Solicitação de cadastro expirada. Reenvie os dados.');
        setStep('form');
        setChallenge(null);
        setDebugEmailCode(null);
        return;
      }

      if (!emailCode.trim()) {
        setError('Informe o código recebido por e-mail.');
        return;
      }

      setLoading(true);
      try {
        const response = await confirmRegistration({
          challengeId: challenge.challengeId,
          code: emailCode.trim()
        });

        if (response.nextStep === 'otp') {
          setOtpSetup(response);
          setDebugOtpCode(response.debugCode ?? null);
          setStep('otp');
          setSuccess('E-mail confirmado! Configure o aplicativo autenticador e informe o primeiro código gerado.');
          setOtpCode('');
        } else {
          setError('Fluxo de cadastro inválido.');
        }
      } catch (err) {
        setError(err.response?.data?.message ?? 'Não foi possível confirmar o código enviado por e-mail.');
      } finally {
        setLoading(false);
      }

      return;
    }

    if (step === 'otp') {
      if (!otpSetup?.otpSetupId) {
        setError('Configuração OTP expirada. Reinicie o cadastro.');
        setStep('form');
        setOtpSetup(null);
        setOtpCode('');
        setDebugOtpCode(null);
        return;
      }

      if (!otpCode.trim()) {
        setError('Informe o código exibido no aplicativo autenticador.');
        return;
      }

      setLoading(true);
      try {
        await finalizeRegistration({
          otpSetupId: otpSetup.otpSetupId,
          otpCode: otpCode.trim()
        });
        setSuccess('Cadastro concluído! Redirecionando para login...');
        setForm(initialState);
        setChallenge(null);
        setEmailCode('');
        setOtpSetup(null);
        setOtpCode('');
        setDebugEmailCode(null);
        setDebugOtpCode(null);
        setStep('form');
        setTimeout(() => navigate('/login'), 1200);
      } catch (err) {
        setError(err.response?.data?.message ?? 'Não foi possível validar o aplicativo autenticador.');
      } finally {
        setLoading(false);
      }

      return;
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);

    if (step !== 'email') {
      setError('Reenvio de código disponível apenas na etapa de verificação por e-mail.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('As senhas precisam coincidir.');
      setStep('form');
      return;
    }

    if (!isPasswordCompliant(form.password)) {
      setError(passwordPolicy.message);
      setStep('form');
      return;
    }

    if (!form.consent) {
      setError('Consentimento LGPD é obrigatório para o cadastro.');
      setStep('form');
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        consent: form.consent
      });
      setChallenge(result);
      setDebugEmailCode(result.debugCode ?? null);
      setSuccess('Um novo código foi enviado para o seu e-mail.');
      setEmailCode('');
    } catch (err) {
      setError(err.response?.data?.message ?? 'Não foi possível reenviar o código.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setStep('form');
    setChallenge(null);
    setEmailCode('');
    setOtpSetup(null);
    setOtpCode('');
    setDebugEmailCode(null);
    setDebugOtpCode(null);
    setSuccess(null);
    setError(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Cadastro com consentimento</h1>
        <p className="mt-2 text-sm text-slate-400">
          Coletamos apenas dados mínimos necessários para acesso seguro. Consentimento explícito é exigido para atender a LGPD.
        </p>
      </div>
      {error && <p className="rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
      {success && <p className="rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{success}</p>}
      {step === 'form' ? (
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <InputField
            label="Nome completo"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            autoComplete="name"
            required
          />
          <InputField
            label="Telefone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            autoComplete="tel"
          />
          <InputField
            label="E-mail"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
          <InputField
            label="Senha"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            pattern={passwordPattern}
            title={passwordPolicy.message}
            required
          />
          <InputField
            label="Confirme a senha"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            pattern={passwordPattern}
            title={passwordPolicy.message}
            required
          />
          <p className="md:col-span-2 text-xs text-slate-400">
            {passwordPolicy.message}
          </p>
          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300 md:col-span-2">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="consent"
                checked={form.consent}
                onChange={handleChange}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring focus:ring-emerald-500/40"
                required
              />
              <span>
                Confirmo que li e estou de acordo com os Termos de Uso e a Política de Privacidade, autorizando o tratamento dos meus dados pessoais exclusivamente para utilização da Plantelligence Platform. Posso revogar este consentimento ou solicitar a exclusão dos meus dados a qualquer momento. Para mais informações, consulte os links disponíveis no rodapé do site.
              </span>
            </label>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Enviando...' : 'Criar conta segura'}
            </Button>
          </div>
        </form>
      ) : null}
      {step === 'email' && (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="rounded border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">
            <p>Enviamos um código de verificação para <strong>{form.email}</strong>.</p>
            <p className="mt-1 text-emerald-200/80">Informe o código abaixo para avançar para a configuração do autenticador.</p>
          </div>
          {debugEmailCode && (
            <p className="text-xs text-amber-300">Modo de depuração ativo (e-mail): código {debugEmailCode}</p>
          )}
          <InputField
            label="Código recebido por e-mail"
            name="emailCode"
            value={emailCode}
            onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            required
          />
          <div className="flex flex-col gap-3 md:flex-row">
            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading ? 'Validando...' : 'Confirmar e-mail'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleResend}
              disabled={loading}
              className="w-full md:w-auto"
            >
              Reenviar código
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleEdit}
              disabled={loading}
              className="w-full md:w-auto"
            >
              Editar dados
            </Button>
          </div>
        </form>
      )}
      {step === 'otp' && otpSetup && (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="rounded border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-200">Configure o aplicativo autenticador</p>
            <p className="mt-1 text-emerald-200/80">
              Escaneie o QR code ou utilize a chave abaixo em um aplicativo como Microsoft Authenticator, Google Authenticator ou Authy.
            </p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200">
            <p className="text-xs text-slate-400">Chave secreta (copie para seu autenticador)</p>
            <p className="mt-1 font-mono text-lg tracking-wider text-emerald-300">{otpSetup.secret}</p>
            {otpSetup.uri && (
              <p className="mt-2 text-xs text-slate-400">
                Link direto: <a href={otpSetup.uri} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">otpauth://</a>
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Conta: {otpSetup.accountName} • Emissor: {otpSetup.issuer}
            </p>
          </div>
          {debugOtpCode && (
            <p className="text-xs text-amber-300">Modo de depuração ativo (OTP): código {debugOtpCode}</p>
          )}
          <InputField
            label="Primeiro código do autenticador"
            name="otpCode"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
          <div className="flex flex-col gap-3 md:flex-row">
            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading ? 'Validando...' : 'Finalizar cadastro seguro'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleEdit}
              disabled={loading}
              className="w-full md:w-auto"
            >
              Reiniciar cadastro
            </Button>
          </div>
        </form>
      )}
      <p className="text-sm text-slate-400">
        Já possui conta?{' '}
        <Link to="/login" className="text-emerald-400 hover:text-emerald-300">
          Voltar para login
        </Link>
      </p>
    </div>
  );
};
