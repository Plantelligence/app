import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { PasswordResetPage } from './pages/PasswordResetPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { UserSettingsPage } from './pages/UserSettingsPage.jsx';
import { SecurityLogsPage } from './pages/SecurityLogsPage.jsx';
import { AdminUsersPage } from './pages/AdminUsersPage.jsx';
import { TechnologyPage } from './pages/TechnologyPage.jsx';
import { TopNav } from './components/TopNav.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AdminRoute } from './components/AdminRoute.jsx';
import { useAuthStore } from './store/authStore.js';

const COOKIE_STORAGE_KEY = 'plantelligence-cookie-consent';

const footerLinks = [
  {
    href: '/termos.html',
    label: 'Termos de Uso',
    icon: 'fa-solid fa-file-contract'
  },
  {
    href: '/privacidade.html',
    label: 'Política de Privacidade',
    icon: 'fa-solid fa-user-shield'
  }
];

const Footer = () => {
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [consentChoice, setConsentChoice] = useState(null);
  const autoOpenTimerRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  const clearAutoOpenTimer = () => {
    if (autoOpenTimerRef.current) {
      window.clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = null;
    }
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(COOKIE_STORAGE_KEY);
    let resolvedChoice = null;

    if (stored === 'accepted') {
      resolvedChoice = 'all';
      window.localStorage.setItem(COOKIE_STORAGE_KEY, 'all');
    } else if (stored === 'all' || stored === 'essential') {
      resolvedChoice = stored;
    }

    if (resolvedChoice) {
      setConsentChoice(resolvedChoice);
    } else {
      autoOpenTimerRef.current = window.setTimeout(() => {
        autoOpenTimerRef.current = null;
        setIsBannerVisible(true);
      }, 1600);
    }

    return () => {
      clearAutoOpenTimer();
    };
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const hideBanner = () => {
    clearAutoOpenTimer();
    setIsBannerVisible(false);
  };

  const registerChoice = (choice) => {
    window.localStorage.setItem(COOKIE_STORAGE_KEY, choice);
    setConsentChoice(choice);
    hideBanner();
  };

  const handleEssentialOnly = () => registerChoice('essential');

  const handleAcceptAll = () => registerChoice('all');

  const handleCookieLink = (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    clearAutoOpenTimer();
    setIsBannerVisible(true);
  };

  const isEssentialChoice = consentChoice === 'essential';
  const isAllChoice = consentChoice === 'all';

  const banner = isClient && isBannerVisible
    ? createPortal(
        (
          <div className="pointer-events-auto fixed inset-x-0 bottom-3 z-[1000] flex justify-center px-4">
            <div
              role="dialog"
              aria-modal="false"
              aria-live="polite"
              aria-labelledby="cookie-policy-title"
              className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl backdrop-blur"
            >
              <div className="flex flex-col gap-4 text-center">
                <div className="space-y-2">
                  <h3 id="cookie-policy-title" className="text-lg font-semibold text-slate-50">
                    Usamos cookies para melhorar sua experiência
                  </h3>
                  <p className="text-sm text-slate-300">
                    Utilizamos cookies essenciais para manter o site funcionando e opcionalmente cookies analíticos para entender como a landing page performa. Você pode ajustar essa decisão depois nas configurações do navegador.
                  </p>
                  {consentChoice ? (
                    <p className="text-xs text-slate-400">
                      Preferência atual: {consentChoice === 'all' ? 'aceitar todos os cookies' : 'permitir apenas cookies essenciais'}.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
                    href="/cookies.html"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                    Ler documento completo
                  </a>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${isEssentialChoice ? 'border-cyan-300 text-cyan-200' : 'border-slate-700 text-slate-200 hover:border-cyan-300 hover:text-cyan-200'}`}
                    aria-pressed={isEssentialChoice}
                    onClick={handleEssentialOnly}
                  >
                    <i className="fa-solid fa-cookie" aria-hidden="true" />
                    Apenas essenciais
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${isAllChoice ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'}`}
                    aria-pressed={isAllChoice}
                    onClick={handleAcceptAll}
                  >
                    <i className="fa-solid fa-check" aria-hidden="true" />
                    Aceitar todos
                  </button>
                </div>
              </div>
            </div>
          </div>
        ),
        document.body
      )
    : null;

  return (
    <footer id="rodape" className="border-t border-slate-800/70 bg-slate-950/90 text-slate-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 md:grid md:grid-cols-[minmax(0,1fr)_0.7fr] md:items-start">
        <div className="max-w-md space-y-3 md:justify-self-center md:text-center">
          <span className="text-xs uppercase tracking-[0.24em] text-slate-300/70">Segurança e Conformidade</span>
          <h2 className="text-2xl font-semibold text-slate-50">Plantelligence</h2>
          <p className="text-sm text-slate-300">
            Automação inteligente para estufas com segurança e conformidade LGPD.
          </p>
        </div>
        <nav aria-label="Políticas de segurança" className="w-full md:justify-self-center md:text-center">
          <ul className="flex flex-col items-center gap-4">
            {footerLinks.map((item) => (
              <li key={item.href} className="w-full max-w-xs">
                <a
                  className="group flex w-full items-center justify-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-slate-50 hover:backdrop-brightness-125"
                  href={item.href}
                >
                  <i className={`${item.icon} text-emerald-400 transition-colors group-hover:text-cyan-300`} aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
            <li className="w-full max-w-xs">
              <a
                className="group flex w-full items-center justify-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-slate-50 hover:backdrop-brightness-125"
                href="/cookies.html"
                onClick={handleCookieLink}
              >
                <i className="fa-solid fa-cookie-bite text-emerald-400 transition-colors group-hover:text-cyan-300" aria-hidden="true" />
                <span>Política de Cookies</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-slate-800/70 px-4 py-6 text-center text-xs text-slate-400">© 2025 Plantelligence. Todos os direitos reservados.</p>
      {banner}
    </footer>
  );
};

const Shell = () => (
  <div className="flex min-h-screen flex-col bg-slate-950/70 text-slate-100 backdrop-blur">
    <TopNav />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
  </div>
);

const AuthShell = () => (
  <div className="flex min-h-screen flex-col bg-slate-950/70 text-slate-100 backdrop-blur">
    <TopNav />
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Outlet />
    </main>
    <Footer />
  </div>
);

const App = () => {
  useAuthStore((state) => state.user);

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<TechnologyPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="settings" element={<UserSettingsPage />} />
          <Route path="settings/logs" element={<SecurityLogsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="admin/usuarios" element={<AdminUsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route element={<AuthShell />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="password-reset" element={<PasswordResetPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
