import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputField } from '../components/InputField.jsx';
import { Button } from '../components/Button.jsx';
import { register } from '../api/authService.js';
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
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
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
      await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        consent: form.consent
      });
      setSuccess('Cadastro realizado com sucesso. Faça login para continuar.');
      setTimeout(() => navigate('/login'), 1200);
      setForm(initialState);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Não foi possível cadastrar.');
    } finally {
      setLoading(false);
    }
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
              Confirmo que autorizo o tratamento dos meus dados pessoais exclusivamente para o uso do Plantelligence Platform. Posso revogar este consentimento ou solicitar exclusão a qualquer momento.
            </span>
          </label>
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Enviando...' : 'Criar conta segura'}
          </Button>
        </div>
      </form>
      <p className="text-sm text-slate-400">
        Já possui conta?{' '}
        <Link to="/login" className="text-emerald-400 hover:text-emerald-300">
          Voltar para login
        </Link>
      </p>
    </div>
  );
};
