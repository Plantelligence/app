import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button.jsx';
import {
  getUsers,
  updateUserRole,
  getUserGreenhouseConfig,
  updateGreenhouseTeam
} from '../api/adminService.js';
import { useAuthStore } from '../store/authStore.js';

const roleLabels = {
  Admin: 'Administrador',
  User: 'Operador'
};

export const AdminUsersPage = () => {
  const authUser = useAuthStore((state) => state.user);
  const updateUserStore = useAuthStore((state) => state.updateUser);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState(null);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [teamSelection, setTeamSelection] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState(null);
  const [teamError, setTeamError] = useState(null);

  const [roleFeedback, setRoleFeedback] = useState(null);
  const [roleError, setRoleError] = useState(null);
  const [roleLoadingId, setRoleLoadingId] = useState(null);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      setLoadingUsers(true);
      setUsersError(null);
      try {
        const result = await getUsers();
        if (!active) {
          return;
        }
        const fetchedUsers = result?.users ?? [];
        setUsers(fetchedUsers);
        if (fetchedUsers.length > 0) {
          setSelectedUserId((prev) => prev ?? fetchedUsers[0].id);
        }
      } catch (error) {
        if (active) {
          setUsersError(error.response?.data?.message ?? 'Não foi possível listar usuários.');
        }
      } finally {
        if (active) {
          setLoadingUsers(false);
        }
      }
    };

    loadUsers();

    return () => {
      active = false;
    };
  }, []);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedConfig(null);
      setTeamSelection([]);
      return;
    }

    let active = true;
    const loadConfig = async () => {
      setTeamLoading(true);
      setTeamError(null);
      setTeamFeedback(null);
      try {
        const result = await getUserGreenhouseConfig(selectedUserId);
        if (!active) {
          return;
        }
        const config = result?.config ?? null;
        setSelectedConfig(config);
        const watcherIds = (config?.watchers ?? []).filter((watcherId) => watcherId !== selectedUserId);
        setTeamSelection(watcherIds);
      } catch (error) {
        if (active) {
          setTeamError(error.response?.data?.message ?? 'Falha ao carregar equipe da estufa.');
        }
      } finally {
        if (active) {
          setTeamLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      active = false;
    };
  }, [selectedUserId]);

  const toggleWatcher = (watcherId) => {
    setTeamFeedback(null);
    setTeamError(null);
    setTeamSelection((prev) => {
      if (prev.includes(watcherId)) {
        return prev.filter((id) => id !== watcherId);
      }
      return [...prev, watcherId];
    });
  };

  const handleRoleChange = async (userId, nextRole) => {
    setRoleFeedback(null);
    setRoleError(null);
    setRoleLoadingId(userId);
    try {
      const result = await updateUserRole({ userId, role: nextRole });
      const updatedUser = result?.user ?? null;
      if (updatedUser) {
        setUsers((prev) => prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
        if (authUser?.id === updatedUser.id) {
          updateUserStore(updatedUser);
        }
        setRoleFeedback(
          nextRole === 'Admin'
            ? `${updatedUser.email} agora é administrador.`
            : `${updatedUser.email} agora é operador.`
        );
      }
    } catch (error) {
      setRoleError(error.response?.data?.message ?? 'Não foi possível atualizar a função.');
    } finally {
      setRoleLoadingId(null);
    }
  };

  const handleTeamSave = async () => {
    if (!selectedUserId) {
      return;
    }
    setTeamFeedback(null);
    setTeamError(null);
    setTeamLoading(true);
    try {
      const result = await updateGreenhouseTeam({
        userId: selectedUserId,
        watcherIds: teamSelection
      });
      const updatedConfig = result?.config ?? null;
      setSelectedConfig(updatedConfig);
      const watcherIds = (updatedConfig?.watchers ?? []).filter((id) => id !== selectedUserId);
      setTeamSelection(watcherIds);
      setTeamFeedback('Equipe de alertas atualizada com sucesso.');
    } catch (error) {
      setTeamError(error.response?.data?.message ?? 'Falha ao atualizar equipe de alertas.');
    } finally {
      setTeamLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-100">Gestão de usuários</h1>
        <p className="mt-2 text-sm text-slate-400">
          Promova operadores para administradores e defina a equipe que recebe alertas críticos das estufas.
        </p>
        {roleFeedback && (
          <p className="mt-3 rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {roleFeedback}
          </p>
        )}
        {roleError && (
          <p className="mt-3 rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {roleError}
          </p>
        )}
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Usuários cadastrados</h2>
            {loadingUsers ? (
              <span className="text-xs text-slate-500">Carregando...</span>
            ) : (
              <span className="text-xs text-slate-500">{users.length} contas</span>
            )}
          </header>
          {usersError ? (
            <p className="rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {usersError}
            </p>
          ) : (
            <ul className="space-y-2">
              {users.map((listedUser) => {
                const isSelected = listedUser.id === selectedUserId;
                const isAdmin = listedUser.role === 'Admin';
                const nextRole = isAdmin ? 'User' : 'Admin';
                const roleButtonLabel = isAdmin ? 'Revogar admin' : 'Tornar admin';
                return (
                  <li
                    key={listedUser.id}
                    className={`rounded border px-4 py-3 text-sm transition ${
                      isSelected
                        ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                        : 'border-slate-800 bg-slate-950 text-slate-200 hover:border-emerald-400/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(listedUser.id)}
                        className="text-left"
                      >
                        <p className="font-semibold">{listedUser.fullName ?? listedUser.email}</p>
                        <p className="text-xs text-slate-400">{listedUser.email}</p>
                        <p className="text-xs text-slate-400">{roleLabels[listedUser.role] ?? listedUser.role}</p>
                      </button>
                      <Button
                        variant="secondary"
                        onClick={() => handleRoleChange(listedUser.id, nextRole)}
                        disabled={roleLoadingId === listedUser.id}
                      >
                        {roleLoadingId === listedUser.id ? 'Atualizando...' : roleButtonLabel}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Equipe de alertas</h2>
            <p className="text-xs text-slate-400">
              Escolha quem recebe alertas por e-mail quando a estufa do operador sair dos parâmetros ideais.
            </p>
          </header>
          {!selectedUser ? (
            <p className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400">
              Selecione um usuário para gerenciar a equipe de alertas.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                <p className="font-semibold text-slate-100">{selectedUser.fullName ?? selectedUser.email}</p>
                <p className="mt-1 text-slate-400">
                  {selectedConfig?.name
                    ? `Estufa cadastrada: ${selectedConfig.name}`
                    : 'Estufa ainda não configurada pelo operador.'}
                </p>
              </div>
              {teamError && (
                <p className="rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {teamError}
                </p>
              )}
              {teamFeedback && (
                <p className="rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  {teamFeedback}
                </p>
              )}
              <div className="max-h-60 space-y-2 overflow-y-auto pr-2">
                {users
                  .filter((candidate) => candidate.id !== selectedUser.id)
                  .map((candidate) => {
                    const checked = teamSelection.includes(candidate.id);
                    return (
                      <label
                        key={candidate.id}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded border px-3 py-2 text-sm transition ${
                          checked
                            ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                            : 'border-slate-800 bg-slate-950 text-slate-200 hover:border-emerald-400/40'
                        }`}
                      >
                        <span>
                          <span className="block font-semibold">{candidate.fullName ?? candidate.email}</span>
                          <span className="block text-xs text-slate-400">{candidate.email}</span>
                        </span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring focus:ring-emerald-500/40"
                          checked={checked}
                          onChange={() => toggleWatcher(candidate.id)}
                        />
                      </label>
                    );
                  })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleTeamSave} disabled={teamLoading}>
                  {teamLoading ? 'Salvando...' : 'Aplicar equipe'}
                </Button>
                <span className="text-xs text-slate-400">
                  Alertas sempre incluem o titular da conta selecionada.
                </span>
              </div>
              {selectedConfig?.watchersDetails?.length > 0 ? (
                <div className="rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                  <p className="font-semibold text-slate-100">Equipe atual</p>
                  <ul className="mt-2 space-y-1">
                    {selectedConfig.watchersDetails.map((detail) => (
                      <li key={detail.id} className="flex items-center justify-between">
                        <span>{detail.fullName ?? detail.email}</span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          {roleLabels[detail.role] ?? detail.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                  Nenhum integrante adicional recebe alertas ainda.
                </p>
              )}
            </div>
          )}
        </article>
      </section>
    </div>
  );
};
