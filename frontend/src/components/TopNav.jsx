import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './Button.jsx';
import { useAuthStore } from '../store/authStore.js';
import { logout } from '../api/authService.js';

export const TopNav = () => {
  const { user, tokens, clearSession } = useAuthStore((state) => ({
    user: state.user,
    tokens: state.tokens,
    clearSession: state.clearSession
  }));
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout({
        refreshToken: tokens?.refreshToken,
        accessJti: tokens?.accessJti,
        userId: user?.id
      });
    } catch (error) {
      console.warn('Erro ao encerrar sessão', error);
    } finally {
      clearSession();
      navigate('/login');
    }
  };

  const brandDestination = '/';

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
      <Link to={brandDestination} className="flex items-center gap-2 text-lg font-semibold text-emerald-400">
        <span>Plantelligence</span>
      </Link>
      <nav className="flex items-center gap-6 text-sm text-slate-300">
        {user ? (
          <>
            <Link
              to="/dashboard"
              className="hidden rounded-md border border-emerald-500/60 px-4 py-2 font-medium text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200 lg:inline"
            >
              Ir para o painel
            </Link>
            <span className="hidden text-xs uppercase tracking-wider text-slate-500 lg:inline">
              {user.email} · {user.role}
            </span>
            <Button variant="secondary" onClick={handleLogout}>
              Sair
            </Button>
          </>
        ) : (
          <>
            <Link
              to="/register"
              className="hidden rounded-md border border-emerald-500/60 px-4 py-2 font-medium text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200 lg:inline"
            >
              Criar acesso demo
            </Link>
            <Link
              to="/login"
              className="rounded-md bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-400"
            >
              Entrar
            </Link>
          </>
        )}
      </nav>
    </header>
  );
};
