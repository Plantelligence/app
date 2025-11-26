// This file has been cleared and will be recreated cleanly.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button.jsx';
import { simulateSecureMessage, getPublicKey } from '../api/cryptoService.js';
import { useAuthStore } from '../store/authStore.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      {requiresPasswordReset && (
        <div className="rounded border border-amber-500/60 bg-amber-500/10 p-4 text-sm text-amber-200">
          Sua senha atingiu o prazo de expiração. Atualize-a nas configurações.&nbsp;
          <Link to="/settings" className="font-semibold text-amber-100 underline">
            Alterar agora
          </Link>
        </div>
      )}
      {!user?.mfa?.otp?.configuredAt && (
        <div className="rounded border border-amber-500/60 bg-amber-500/10 p-4 text-sm text-amber-200">
          Conclua a configuração do aplicativo autenticador para manter o acesso offline ao segundo fator.&nbsp;
          <Link to="/settings#autenticador" className="font-semibold text-amber-100 underline">
            Configurar agora
          </Link>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <article className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-6 shadow-lg">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Controlador automático</span>
              <h2 className="text-xl font-semibold text-emerald-100">{greenhouseState.greenhouseName}</h2>
            </div>
            <span className="text-xs text-emerald-100/70">
              Última atualização {formatTimestamp(greenhouseState.lastUpdate)}
            </span>
          </header>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Temperatura</p>
              <p className="text-2xl font-semibold">{greenhouseState.temperature.toFixed(1)}°C</p>
              <p className="text-xs text-emerald-200/70">{greenhouseState.ventilation}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Umidade relativa</p>
              <p className="text-2xl font-semibold">{Math.round(greenhouseState.humidity)}%</p>
              <p className="text-xs text-emerald-200/70">Nebulização automática supervisionada</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Substrato</p>
              <p className="text-2xl font-semibold">{Math.round(greenhouseState.soilMoisture)}%</p>
              <p className="text-xs text-emerald-200/70">{greenhouseState.irrigation}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">CO₂ ambiente</p>
              <p className="text-2xl font-semibold">{Math.round(greenhouseState.co2)} ppm</p>
              <p className="text-xs text-emerald-200/70">Fluxo {greenhouseState.co2 > 500 ? 'alto' : 'modulado'}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100 sm:col-span-2 xl:col-span-3">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Iluminação</p>
              <p className="text-sm font-semibold text-emerald-100">{greenhouseState.lighting}</p>
              <p className="mt-1 text-xs text-emerald-200/70">
                O algoritmo ajusta fotoperíodo e ventilação de forma coordenada, enviando sinais MQTT para os controladores locais.
              </p>
            </div>
          </div>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Eventos da estufa</h3>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Simulação</span>
          </header>
          <p className="text-xs text-slate-400">
            Enquanto os sensores IoT reais não chegam, acompanhamos uma estufa modelo para validar alertas e automações do controlador.
          </p>
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 text-sm text-slate-200">
            {eventLog.map((entry) => (
              <li key={entry.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-400">{formatTimestamp(entry.timestamp)}</p>
                <p className="mt-1 text-slate-100">{entry.message}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-3">
            <h2 className="text-lg font-semibold text-slate-100">Ações rápidas</h2>
            <p className="text-xs text-slate-400">Gerencie sua conta, consentimentos LGPD e fatores de autenticação.</p>
          </header>
          <div className="flex flex-col gap-3">
            <Link
              to="/settings"
              className="inline-flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 transition hover:border-emerald-400 hover:text-emerald-100"
            >
              <span>Dados pessoais e consentimentos</span>
              <span className="text-xs text-slate-400">Atualizar perfil</span>
            </Link>
            <Link
              to="/settings#senha"
              className="inline-flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 transition hover:border-emerald-400 hover:text-emerald-100"
            >
              <span>Senha e autenticação</span>
              <span className="text-xs text-slate-400">Alterar credenciais</span>
            </Link>
            <Link
              to="/settings#autenticador"
              className="inline-flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 transition hover:border-emerald-400 hover:text-emerald-100"
            >
              <span>Aplicativo autenticador</span>
              <span className="text-xs text-slate-400">Gerenciar MFA</span>
            </Link>
            {user?.role === 'Admin' ? (
              <Link
                to="/settings/logs"
                className="inline-flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 transition hover:border-emerald-400 hover:text-emerald-100"
              >
                <span>Logs imutáveis</span>
                <span className="text-xs text-slate-400">Auditar eventos</span>
              </Link>
            ) : (
              <span className="inline-flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-500">
                <span>Logs imutáveis</span>
                <span className="text-xs">Disponível para administradores</span>
              </span>
            )}
          </div>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Criptografia ponta a ponta</h2>
            <p className="text-xs text-slate-400">Demonstração de mensagem criptografada (AES-256) com chave protegida via RSA.</p>
          </header>
          <div className="flex flex-col gap-4">
            <textarea
              className="min-h-[120px] rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              value={cryptoMessage}
              onChange={(event) => setCryptoMessage(event.target.value)}
            />
            <Button variant="secondary" onClick={handleCryptoSimulation}>
              Simular comunicação segura
            </Button>
            {cryptoError && <p className="text-sm text-rose-300">{cryptoError}</p>}
            {publicKey && (
              <details className="rounded border border-slate-800 bg-slate-900/60 p-3">
                <summary className="cursor-pointer text-xs text-emerald-300">
                  Chave pública RSA (PEM)
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-slate-400">
                  {publicKey}
                </pre>
              </details>
            )}
            {cryptoResult && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                <p>Mensagem criptografada: {cryptoResult.encryptedMessage}</p>
                <p className="mt-2">Chave protegida: {cryptoResult.encryptedKey}</p>
                <p className="mt-2">IV: {cryptoResult.iv}</p>
                <p className="mt-2">Tag de autenticação: {cryptoResult.authTag}</p>
                <p className="mt-2 text-emerald-300">Verificação do backend: {cryptoResult.verification}</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
      )}
      {feedback && (
        <div className="rounded border border-emerald-500/60 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {feedback}
        </div>
      )}
      {!user?.mfa?.otp?.configuredAt && (
        <div className="rounded border border-amber-500/60 bg-amber-500/10 p-4 text-sm text-amber-200">
          Conclua a configuração do aplicativo autenticador para ter acesso offline ao segundo fator.&nbsp;
          <Link to="/settings" className="font-semibold text-amber-100 underline">
            Configurar agora
          </Link>
        </div>
      )}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <article className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-6 shadow-lg">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Controlador automático</span>
              <h2 className="text-xl font-semibold text-emerald-100">{greenhouseState.greenhouseName}</h2>
            </div>
            <span className="text-xs text-emerald-100/70">
              Última atualização {formatTimestamp(greenhouseState.lastUpdate)}
            </span>
          </header>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Temperatura</p>
              <p className="text-2xl font-semibold">{greenhouseState.temperature.toFixed(1)}°C</p>
              <p className="text-xs text-emerald-200/70">{greenhouseState.ventilation}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Umidade relativa</p>
              <p className="text-2xl font-semibold">{Math.round(greenhouseState.humidity)}%</p>
              <p className="text-xs text-emerald-200/70">Nebulização automática supervisionada</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Substrato</p>
              <p className="text-2xl font-semibold">{Math.round(greenhouseState.soilMoisture)}%</p>
              <p className="text-xs text-emerald-200/70">{greenhouseState.irrigation}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">CO₂ ambiente</p>
              <p className="text-2xl font-semibold">{Math.round(greenhouseState.co2)} ppm</p>
              <p className="text-xs text-emerald-200/70">Fluxo {greenhouseState.co2 > 500 ? 'alto' : 'modulado'}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-slate-950/70 p-4 text-emerald-100 sm:col-span-2 xl:col-span-3">
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">Iluminação</p>
              <p className="text-sm font-semibold text-emerald-100">{greenhouseState.lighting}</p>
              <p className="mt-1 text-xs text-emerald-200/70">
                O algoritmo ajusta fotoperíodo e ventilação de forma coordenada, enviando sinais MQTT para os controladores locais.
              </p>
            </div>
          </div>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Eventos da estufa</h3>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Simulação</span>
          </header>
          <p className="text-xs text-slate-400">
            Até que os sensores IoT estejam ativos, utilizamos eventos gerados pelo motor de simulação para validar alertas e automações.
          </p>
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 text-sm text-slate-200">
            {eventLog.map((entry) => (
              <li key={entry.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-400">{formatTimestamp(entry.timestamp)}</p>
                <p className="mt-1 text-slate-100">{entry.message}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Meus dados</h2>
              <p className="text-xs text-slate-400">Minimização de dados e consentimento explícito.</p>
            </div>
            <Button variant="secondary" onClick={() => setConfirmUpdate(true)} disabled={loadingProfile}>
              Salvar alterações
            </Button>
          </header>
          <div className="flex flex-col gap-4">
            <InputField
              label="Nome completo"
              name="fullName"
              value={profile?.fullName ?? ''}
              onChange={handleProfileChange}
            />
            <InputField
              label="Telefone"
              name="phone"
              value={profile?.phone ?? ''}
              onChange={handleProfileChange}
            />
            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                name="consentGiven"
                checked={profile?.consentGiven ?? false}
                onChange={handleProfileChange}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring focus:ring-emerald-500/40"
              />
              <span>Sigo consentindo com o uso dos meus dados apenas para controle das estufas.</span>
            </label>
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
              <p>Última atualização: {profile?.updatedAt ?? '-'} </p>
              <p>Senha expira em: {profile?.passwordExpiresAt ?? '-'} </p>
              <p>Solicitação de exclusão: {profile?.deletionRequested ? 'Sim' : 'Não'}</p>
              <p>Função / RBAC: {profile?.role}</p>
            </div>
          </div>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Alterar senha</h2>
            <p className="text-xs text-slate-400">Requer autenticação atual e gera logs de auditoria.</p>
          </header>
          <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
            <InputField
              label="Senha atual"
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
              required
            />
            <InputField
              label="Nova senha"
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
              required
            />
            <Button type="submit">Atualizar senha</Button>
          </form>
          {passwordFeedback && (
            <p className="mt-4 rounded border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200">
              {passwordFeedback}
            </p>
          )}
        </article>
      </section>
      <section className="rounded-lg border border-rose-600/60 bg-rose-600/10 p-6 shadow-lg">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-rose-200">Direito ao esquecimento</h2>
          <p className="text-sm text-rose-100/80">
            Solicitação envia registro para o backend e marca a conta para anonimização em fluxos operacionais.
          </p>
          <Button variant="danger" onClick={() => setConfirmDeletion(true)} disabled={profile?.deletionRequested}>
            {profile?.deletionRequested ? 'Solicitação pendente' : 'Solicitar exclusão de dados'}
          </Button>
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Criptografia ponta a ponta</h2>
            <p className="text-xs text-slate-400">
              Demonstração de mensagem criptografada (AES-256) e chave protegida via RSA.
            </p>
          </header>
          <div className="flex flex-col gap-4">
            <textarea
              className="min-h-[120px] rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              value={cryptoMessage}
              onChange={(event) => setCryptoMessage(event.target.value)}
            />
            <Button variant="secondary" onClick={handleCryptoSimulation}>
              Simular comunicação segura
            </Button>
            {cryptoError && (
              <p className="text-sm text-rose-300">{cryptoError}</p>
            )}
            {publicKey && (
              <details className="rounded border border-slate-800 bg-slate-900/60 p-3">
                <summary className="cursor-pointer text-xs text-emerald-300">
                  Chave pública RSA (PEM)
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-slate-400">
                  {publicKey}
                </pre>
              </details>
            )}
            {cryptoResult && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                <p>Mensagem criptografada: {cryptoResult.encryptedMessage}</p>
                <p className="mt-2">Chave protegida: {cryptoResult.encryptedKey}</p>
                <p className="mt-2">IV: {cryptoResult.iv}</p>
                <p className="mt-2">Tag de autenticação: {cryptoResult.authTag}</p>
                <p className="mt-2 text-emerald-300">
                  Verificação do backend: {cryptoResult.verification}
                </p>
              </div>
            )}
          </div>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Logs imutáveis</h2>
              <p className="text-xs text-slate-400">Acesso restrito a administradores. Cadeia com hash de integridade.</p>
            </div>
            {user?.role === 'Admin' && (
              <Button variant="secondary" onClick={loadLogs} disabled={logsLoaded && logs.length === 0}>
                {logsLoaded ? 'Recarregar' : 'Carregar logs'}
              </Button>
            )}
          </header>
          {user?.role !== 'Admin' ? (
            <p className="text-sm text-slate-400">
              Logs completos disponíveis apenas para administradores. Entre em contato com o DPO para auditorias.
            </p>
          ) : logs.length > 0 ? (
            <div className="max-h-64 space-y-3 overflow-y-auto text-xs text-slate-300">
              {logs.map((entry) => (
                <div key={entry.id} className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <p>
                    <span className="font-semibold text-slate-100">{entry.action}</span> • {entry.createdAt}
                  </p>
                  {entry.userId && <p>Usuário: {entry.userId}</p>}
                  <p>Hash: {entry.hash}</p>
                  <p>Hash anterior: {entry.prevHash}</p>
                  {entry.metadata && (
                    <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-400">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          ) : logsLoaded ? (
            <p className="text-sm text-slate-400">Nenhum log recente.</p>
          ) : (
            <p className="text-sm text-slate-400">Clique em carregar para visualizar os eventos críticos.</p>
          )}
        </article>
      </section>
      <ConfirmDialog
        open={confirmUpdate}
        title="Confirmar atualização"
        description="Confirme que deseja atualizar seus dados pessoais de forma segura."
        onCancel={() => setConfirmUpdate(false)}
        onConfirm={submitProfileUpdate}
      />
      <ConfirmDialog
        open={confirmDeletion}
        title="Excluir meus dados"
        description="Esta ação registra seu pedido de exclusão conforme a LGPD e impedirá acessos futuros."
        confirmLabel="Solicitar exclusão"
        onCancel={() => setConfirmDeletion(false)}
        onConfirm={confirmDeletionRequest}
      />
    </div>
  );
};
