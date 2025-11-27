import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { useAuthStore } from '../store/authStore.js';
import { getSecurityLogs } from '../api/userService.js';

export const SecurityLogsPage = () => {
  const { user } = useAuthStore((state) => ({ user: state.user }));
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = user?.role === 'Admin';

  const fetchLogs = async () => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getSecurityLogs();
      setLogs(result.logs ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Não foi possível carregar os logs de segurança.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900 p-8 text-sm text-slate-200 shadow-xl">
        <header>
          <h1 className="text-2xl font-semibold text-slate-100">Logs de segurança</h1>
          <p className="mt-2 text-sm text-slate-400">
            Apenas administradores (DPO e SOC) podem auditar a cadeia imutável de eventos.
          </p>
        </header>
        <p className="rounded border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Solicite ao time de governança para obter acesso. Todos os eventos continuam sendo registrados normalmente.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-900 p-8 text-sm text-slate-200 shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Logs de segurança</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cadeia imutável com hash encadeado para auditoria forense e governança LGPD.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchLogs} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar logs'}
        </Button>
      </header>

      {error && (
        <p className="rounded border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      )}

      {logs.length === 0 && !loading ? (
        <p className="rounded border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Nenhum evento recente encontrado. As entradas aparecerão conforme ações sensíveis forem executadas.
        </p>
      ) : (
        <div className="max-h-[480px] space-y-3 overflow-y-auto pr-2 text-xs text-slate-200">
          {logs.map((entry) => (
            <article key={entry.id} className="rounded border border-slate-800 bg-slate-900/70 p-4">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-emerald-300">{entry.action}</span>
                <span className="text-xs text-slate-400">{entry.createdAt}</span>
              </header>
              {entry.userId && (
                <p className="mt-2 text-xs text-slate-300">Usuário: {entry.userId}</p>
              )}
              <div className="mt-2 grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
                <span>Hash: {entry.hash}</span>
                <span>Hash anterior: {entry.prevHash}</span>
              </div>
              {entry.metadata && (
                <pre className="mt-3 whitespace-pre-wrap rounded border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
