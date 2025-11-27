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
      const loginLogs = (result.logs ?? []).filter((log) => log.action === 'login_success');
      setLogs(loginLogs);
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
          <h1 className="text-2xl font-semibold text-slate-100">Registros de login</h1>
          <p className="mt-1 text-sm text-slate-400">
            Visualize data e hora dos acessos realizados pelos colaboradores na Plantelligence Platform.
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
          Nenhum login registrado ainda. Os acessos aparecerão aqui em ordem cronológica.
        </p>
      ) : (
        <div className="max-h-[480px] space-y-3 overflow-y-auto pr-2 text-sm text-slate-200">
          {logs.map((entry) => {
            const formattedTimestamp = entry.createdAt
              ? new Date(entry.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })
              : 'Data indisponível';

            return (
              <article key={entry.id} className="rounded border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Login confirmado</p>
                <p className="mt-2 text-sm font-semibold text-slate-100">Colaborador ID: {entry.userId ?? 'N/D'}</p>
                <p className="mt-1 text-sm text-slate-300">Data e hora: {formattedTimestamp}</p>
                {entry.metadata?.ipAddress && (
                  <p className="mt-1 text-xs text-slate-500">IP: {entry.metadata.ipAddress}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
