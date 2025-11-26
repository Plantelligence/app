import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { logout } from '../api/authService.js';

export const TopNav = () => {
  const { user, tokens, clearSession } = useAuthStore((state) => ({
    user: state.user,
    tokens: state.tokens,
    clearSession: state.clearSession
  }));
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
      setMenuOpen(false);
      clearSession();
      navigate('/login');
    }
  };

  const brandDestination = '/';

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

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
              Painel
            </Link>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-emerald-400 hover:text-emerald-100"
                aria-expanded={menuOpen ? 'true' : 'false'}
                aria-haspopup="menu"
              >
                <span className="hidden md:inline">{user.email}</span>
                <span className="md:hidden">{user.email?.split('@')[0] ?? 'Conta'}</span>
                <span className="text-emerald-400">▾</span>
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-64 rounded-md border border-slate-700 bg-slate-950/95 p-2 text-sm text-slate-200 shadow-xl"
                >
                  <Link
                    to="/dashboard"
                    className="flex items-center justify-between rounded px-3 py-2 transition hover:bg-slate-900 hover:text-emerald-200"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    Painel de controle
                    <span className="text-xs text-slate-400">Estufas</span>
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center justify-between rounded px-3 py-2 transition hover:bg-slate-900 hover:text-emerald-200"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    Configurações
                    <span className="text-xs text-slate-400">Dados & LGPD</span>
                  </Link>
                  <Link
                    to="/settings#autenticador"
                    className="flex items-center justify-between rounded px-3 py-2 transition hover:bg-slate-900 hover:text-emerald-200"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    Aplicativo autenticador
                    <span className="text-xs text-slate-400">MFA</span>
                  </Link>
                  {user.role === 'Admin' ? (
                    <Link
                      to="/admin/usuarios"
                      className="flex items-center justify-between rounded px-3 py-2 transition hover:bg-slate-900 hover:text-emerald-200"
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                    >
                      Gestão de acesso
                      <span className="text-xs text-slate-400">Admin</span>
                    </Link>
                  ) : null}
                  {user.role === 'Admin' ? (
                    <Link
                      to="/settings/logs"
                      className="flex items-center justify-between rounded px-3 py-2 transition hover:bg-slate-900 hover:text-emerald-200"
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                    >
                      Logs de segurança
                      <span className="text-xs text-slate-400">Auditoria</span>
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-rose-200 transition hover:bg-rose-500/10"
                    role="menuitem"
                  >
                    Sair da conta
                    <span className="text-xs text-rose-200/70">Encerrar sessão</span>
                  </button>
                </div>
              ) : null}
            </div>
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
