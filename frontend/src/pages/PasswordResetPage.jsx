import React, { useState } from 'react';
import { InputField } from '../components/InputField.jsx';
import { Button } from '../components/Button.jsx';
import {
  requestPasswordReset,
  confirmPasswordReset
} from '../api/authService.js';

export const PasswordResetPage = () => {
  const [email, setEmail] = useState('');
  const [requestFeedback, setRequestFeedback] = useState(null);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetFeedback, setResetFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRequest = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await requestPasswordReset({ email });
      setRequestFeedback({
        message:
          result.message ?? 'Se o e-mail existir, enviaremos instruções de recuperação.',
        token: result.mock?.token,
        resetLink: result.mock?.resetLink
      });
    } catch (error) {
      setRequestFeedback({ message: error.response?.data?.message ?? 'Falha na solicitação.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await confirmPasswordReset({ token, newPassword });
      setResetFeedback({ message: result.message });
    } catch (error) {
      setResetFeedback({ message: error.response?.data?.message ?? 'Token inválido ou expirado.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-xl md:grid-cols-2">
      <section className="flex flex-col gap-4">
        <header>
          <h1 className="text-xl font-semibold text-slate-100">Recuperar acesso</h1>
          <p className="mt-2 text-sm text-slate-400">
            Geramos um token temporário (mock) para demonstrar o fluxo de recuperação sem envio de e-mails reais.
          </p>
        </header>
        <form className="flex flex-col gap-4" onSubmit={handleRequest}>
          <InputField
            label="E-mail cadastrado"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Processando...' : 'Solicitar token temporário'}
          </Button>
        </form>
        {requestFeedback && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <p>{requestFeedback.message}</p>
            {requestFeedback.token && (
              <>
                <p className="mt-2 font-mono text-xs">Token: {requestFeedback.token}</p>
                <p className="mt-1 break-all text-xs text-emerald-300">
                  Link (mock): {requestFeedback.resetLink}
                </p>
              </>
            )}
          </div>
        )}
      </section>
      <section className="flex flex-col gap-4">
        <header>
          <h2 className="text-xl font-semibold text-slate-100">Redefinir senha</h2>
          <p className="mt-2 text-sm text-slate-400">
            Utilize o token exibido para simular a redefinição.
          </p>
        </header>
        <form className="flex flex-col gap-4" onSubmit={handleReset}>
          <InputField
            label="Token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
          <InputField
            label="Nova senha"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Processando...' : 'Redefinir senha'}
          </Button>
        </form>
        {resetFeedback && (
          <div className="rounded-md border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-300">
            {resetFeedback.message}
          </div>
        )}
      </section>
    </div>
  );
};
