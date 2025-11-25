import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputField } from '../components/InputField.jsx';
import { Button } from '../components/Button.jsx';
import { login, verifyMfa } from '../api/authService.js';
import { useAuthStore } from '../store/authStore.js';

const initialState = {
  email: '',
  password: ''
};

export const LoginPage = () => {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState(null);
  const [mfaError, setMfaError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('credentials');
  const [challenge, setChallenge] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
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
    setLoading(true);
    try {
      const response = await login(form);
      if (response.mfaRequired) {
        setChallenge({
          challengeId: response.challengeId,
          expiresAt: response.expiresAt,
          demoCode: response.demoCode,
          passwordExpired: response.passwordExpired
        });
        setStep('mfa');
        setMfaCode('');
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

  const handleVerifyMfa = async (event) => {
    event.preventDefault();
    if (!challenge) {
      return;
    }

    setMfaError(null);
    setLoading(true);
    try {
      const result = await verifyMfa({
        challengeId: challenge.challengeId,
        code: mfaCode
      });

      setSession({
        user: result.user,
        tokens: result.tokens,
        requiresPasswordReset: result.passwordExpired
      });

      setChallenge(null);
      setStep('credentials');
      setMfaCode('');
      navigate('/dashboard');
    } catch (err) {
      setMfaError(err.response?.data?.message ?? 'Código MFA inválido.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setMfaError(null);
    setLoading(true);
    try {
      const response = await login(form);
      if (response.mfaRequired) {
        setChallenge({
          challengeId: response.challengeId,
          expiresAt: response.expiresAt,
          demoCode: response.demoCode,
          passwordExpired: response.passwordExpired
        });
        setMfaCode('');
      } else {
        setError('Sessão atualizada. Faça login novamente.');
        setStep('credentials');
      }
    } catch (err) {
      setMfaError(err.response?.data?.message ?? 'Não foi possível gerar um novo código.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setChallenge(null);
    setMfaCode('');
    setMfaError(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Entrar no Plantelligence</h1>
        <p className="mt-2 text-sm text-slate-400">
          Acesse sua conta com segurança reforçada e controle total da sua estufa.
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
              Precisa testar?{' '}
              <Link to="/register" className="text-emerald-400 hover:text-emerald-300">
                Criar acesso demonstrativo
              </Link>
            </span>
          </div>
        </>
      ) : (
        <>
          {mfaError && <p className="rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{mfaError}</p>}
          <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-200">Segundo fator obrigatório</p>
            <p className="mt-1">
              Informe o código temporário gerado para esta sessão. Como esta é uma demonstração local, apresentamos o código gerado automaticamente abaixo.
            </p>
            {challenge?.demoCode && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-900/60 px-3 py-2 font-mono text-lg tracking-widest text-emerald-300">
                {challenge.demoCode}
              </p>
            )}
            {challenge?.expiresAt && (
              <p className="mt-2 text-xs text-emerald-200/80">
                Expira às {new Date(challenge.expiresAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <form className="flex flex-col gap-4" onSubmit={handleVerifyMfa}>
            <InputField
              label="Código MFA"
              name="mfa"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              required
            />
            <Button type="submit" disabled={loading || mfaCode.length !== 6}>
              {loading ? 'Validando código...' : 'Acessar painel'}
            </Button>
          </form>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <button
              type="button"
              onClick={handleResendCode}
              className="text-emerald-400 hover:text-emerald-300"
              disabled={loading}
            >
              Gerar novo código
            </button>
            <button
              type="button"
              onClick={handleBackToCredentials}
              className="text-slate-400 hover:text-slate-200"
              disabled={loading}
            >
              Trocar conta
            </button>
          </div>
        </>
      )}
    </div>
  );
};
