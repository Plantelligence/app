import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputField } from '../components/InputField.jsx';
import { Button } from '../components/Button.jsx';
import QRCode from 'react-qr-code';
import { login, initiateMfa, verifyMfa } from '../api/authService.js';
import { useAuthStore } from '../store/authStore.js';

const initialState = {
  email: '',
  password: ''
};

export const LoginPage = () => {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState(null);
  const [mfaError, setMfaError] = useState(null);
  const [mfaInfo, setMfaInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initiatingMethod, setInitiatingMethod] = useState(false);
  const [step, setStep] = useState('credentials');
  const [mfaContext, setMfaContext] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [methodDetails, setMethodDetails] = useState(null);
  const [code, setCode] = useState('');
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setMfaError(null);
    setMfaInfo(null);
    setLoading(true);
    try {
      const response = await login(form);
      if (response.mfaRequired) {
        setMfaContext(response);
        setStep('mfa');
        setSelectedMethod(null);
        setMethodDetails(null);
        setCode('');
        setMfaInfo('Escolha como deseja receber o segundo fator de autenticação.');
        return;
      }

      if (response.user && response.tokens) {
        setSession({
          user: response.user,
          tokens: response.tokens,
          requiresPasswordReset: response.passwordExpired
        });
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message ?? 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  const requestMfaForMethod = async (method) => {
    if (!mfaContext?.sessionId) {
      return;
    }

    setMfaError(null);
    setMfaInfo(null);
    setInitiatingMethod(true);
    try {
      const response = await initiateMfa({
        sessionId: mfaContext.sessionId,
        method
      });

      setMethodDetails(response);

      if (method === 'email') {
        setMfaInfo('Enviamos um código de verificação para o seu e-mail.');
      } else if (response.configured) {
        setMfaInfo('Informe o código exibido no seu aplicativo autenticador.');
      } else {
        setMfaInfo('Escaneie o QR Code ou utilize a chave para configurar seu autenticador. Depois informe o primeiro código gerado.');
      }
    } catch (err) {
      setMethodDetails(null);
      setMfaError(err.response?.data?.message ?? 'Não foi possível iniciar o método escolhido.');
    } finally {
      setInitiatingMethod(false);
    }
  };

  const handleSelectMethod = async (method) => {
    if (!method) {
      return;
    }

    setSelectedMethod(method);
    setMethodDetails(null);
    setCode('');
    await requestMfaForMethod(method);
  };

  const handleVerifyMfa = async (event) => {
    event.preventDefault();

    if (!mfaContext?.sessionId) {
      setMfaError('Sessão de autenticação expirada. Faça login novamente.');
      return;
    }

    if (!selectedMethod) {
      setMfaError('Escolha um método de verificação.');
      return;
    }

    if (code.trim().length !== 6) {
      setMfaError('Informe o código de 6 dígitos.');
      return;
    }

    setMfaError(null);
    setLoading(true);
    try {
      const payload = {
        sessionId: mfaContext.sessionId,
        method: selectedMethod,
        code: code.trim()
      };

      if (selectedMethod === 'otp' && methodDetails?.enrollmentId) {
        payload.otpEnrollmentId = methodDetails.enrollmentId;
      }

      const result = await verifyMfa(payload);

      setSession({
        user: result.user,
        tokens: result.tokens,
        requiresPasswordReset: result.passwordExpired || mfaContext.passwordExpired
      });

      setMfaContext(null);
      setSelectedMethod(null);
      setMethodDetails(null);
      setCode('');
      setMfaInfo(null);
      setStep('credentials');
      navigate('/dashboard');
    } catch (err) {
      setMfaError(err.response?.data?.message ?? 'Falha na validação do código informado.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!selectedMethod) {
      setMfaError('Selecione primeiro o método desejado.');
      return;
    }

    setCode('');
    await requestMfaForMethod(selectedMethod);
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setMfaContext(null);
    setSelectedMethod(null);
    setMethodDetails(null);
    setCode('');
    setMfaError(null);
    setMfaInfo(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Entrar no Plantelligence</h1>
        <p className="mt-2 text-sm text-slate-400">
          Acesse sua conta com segurança reforçada, MFA obrigatório e rastreabilidade completa das suas operações na estufa inteligente.
        </p>
      </div>
      {step === 'credentials' ? (
        <>
          {error && <p className="rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? 'Verificando credenciais...' : 'Continuar'}
            </Button>
          </form>
          <div className="flex flex-col gap-2 text-sm text-slate-400">
            <Link to="/password-reset" className="text-emerald-400 hover:text-emerald-300">
              Esqueci minha senha
            </Link>
            <span>
              Precisa de um acesso demonstrativo?{' '}
              <Link to="/register" className="text-emerald-400 hover:text-emerald-300">
                Criar usuário de teste
              </Link>
            </span>
          </div>
        </>
      ) : (
        <>
          {mfaError && <p className="rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{mfaError}</p>}
          {mfaInfo && <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{mfaInfo}</p>}
          <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-200">Segundo fator obrigatório</p>
            <p className="mt-1 text-emerald-100/90">
              Escolha por onde deseja receber o código temporário. Caso ainda não tenha configurado um aplicativo autenticador, você poderá ativá-lo agora mesmo.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <label className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm transition ${selectedMethod === 'email' ? 'border-emerald-400/80 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500/60 hover:text-emerald-100'}`}>
              <input
                type="radio"
                name="mfa-method"
                value="email"
                checked={selectedMethod === 'email'}
                onChange={() => handleSelectMethod('email')}
                disabled={initiatingMethod || loading}
                className="h-4 w-4"
              />
              <span className="flex flex-col">
                <span className="font-semibold">Código por e-mail</span>
                <span className="text-xs text-slate-300/80">Enviamos um código de 6 dígitos para o endereço cadastrado.</span>
              </span>
            </label>
            <label className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm transition ${selectedMethod === 'otp' ? 'border-emerald-400/80 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-500/60 hover:text-emerald-100'}`}>
              <input
                type="radio"
                name="mfa-method"
                value="otp"
                checked={selectedMethod === 'otp'}
                onChange={() => handleSelectMethod('otp')}
                disabled={initiatingMethod || loading}
                className="h-4 w-4"
              />
              <span className="flex flex-col">
                <span className="font-semibold">Aplicativo autenticador</span>
                <span className="text-xs text-slate-300/80">
                  Gere um código via Microsoft Authenticator, Google Authenticator ou similar. {mfaContext?.methods?.otp?.enrollmentRequired ? 'Vamos mostrar um QR Code para configurar.' : 'Se já estiver configurado, basta informar o código atual.'}
                </span>
              </span>
            </label>
          </div>
          {selectedMethod && methodDetails ? (
            <div className="flex flex-col gap-4 rounded-md border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-200">
              {selectedMethod === 'email' ? (
                <>
                  <p>
                    Código enviado para <strong>{form.email}</strong>.
                  </p>
                  {methodDetails.expiresAt && (
                    <p className="text-xs text-slate-400">
                      Expira às {new Date(methodDetails.expiresAt).toLocaleTimeString()}.
                    </p>
                  )}
                  {methodDetails.debugCode && (
                    <p className="text-xs text-amber-300">Modo de depuração: {methodDetails.debugCode}</p>
                  )}
                </>
              ) : methodDetails.configured ? (
                <>
                  <p>
                    Informe o código atual exibido no autenticador configurado para <strong>{methodDetails.accountName ?? form.email}</strong>.
                  </p>
                  {methodDetails.debugCode && (
                    <p className="text-xs text-amber-300">Modo de depuração (OTP): {methodDetails.debugCode}</p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Escaneie o QR Code abaixo ou copie a chave para adicionar ao seu aplicativo autenticador. Depois informe o primeiro código gerado.
                  </p>
                  <div className="flex flex-col items-center gap-3 rounded-md border border-slate-800 bg-slate-900 px-4 py-4">
                    {methodDetails.uri ? (
                      <QRCode
                        value={methodDetails.uri}
                        size={168}
                        bgColor="#0f172a"
                        fgColor="#34d399"
                      />
                    ) : null}
                    <p className="text-xs text-slate-400">
                      Conta: {methodDetails.accountName} • Emissor: {methodDetails.issuer}
                    </p>
                    <p className="break-all rounded-md bg-slate-950 px-3 py-2 font-mono text-base tracking-wider text-emerald-300">
                      {methodDetails.secret}
                    </p>
                    {methodDetails.debugCode && (
                      <p className="text-xs text-amber-300">Modo de depuração (OTP): {methodDetails.debugCode}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <form className="flex flex-col gap-4" onSubmit={handleVerifyMfa}>
            <InputField
              label="Código de verificação"
              name="code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              autoComplete="one-time-code"
              maxLength={6}
              required
              disabled={!selectedMethod || initiatingMethod}
            />
            <Button
              type="submit"
              disabled={
                loading ||
                initiatingMethod ||
                !selectedMethod ||
                !methodDetails ||
                code.length !== 6
              }
            >
              {loading ? 'Validando código...' : 'Acessar com segurança'}
            </Button>
          </form>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <button
              type="button"
              onClick={handleResendCode}
              className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-500"
              disabled={loading || initiatingMethod || !selectedMethod}
            >
              Enviar novamente
            </button>
            <button
              type="button"
              onClick={handleBackToCredentials}
              className="text-slate-400 hover:text-slate-200"
              disabled={loading || initiatingMethod}
            >
              Trocar conta
            </button>
          </div>
        </>
      )}
    </div>
  );
};
