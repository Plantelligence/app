# Plantelligence — Visão Geral do Módulo de Segurança

Este documento resume a arquitetura e o fluxo do módulo de segurança utilizado na demonstração local.

## Arquitetura
- **Backend**: Node.js + Express com módulos separados para autenticação, criptografia, middlewares e logging.
- **Frontend**: React/Vite, Tailwind CSS, Zustand para gerenciamento de sessão JWT e landing page institucional.
- **Banco**: SQLite local (`backend/db.sqlite`) inicializado via `npm run db:setup`.

## Fluxos Principais
1. Landing page Plantelligence destacando automação por espécie de planta e CTA de login seguro.
2. Cadastro seguro com consentimento explícito e atribuição automática do primeiro usuário como administrador.
3. Login em duas etapas (hash de senha + código MFA temporário), rate limiting e auditoria de eventos.
4. Painel do usuário fornecendo edição de dados, mudança de senha, logs e simulação de criptografia ponta-a-ponta.
5. Gestão de credenciais incluindo revogação de sessão, tokens temporários e expiração de senha.

## Segurança e LGPD
- Logs imutáveis com hash encadeado (`security_logs`).
- RBAC aplicado em endpoints administrativos (`/api/admin`, `/api/users/logs`).
- Criptografia AES + RSA para demonstrar camada segura de comunicação com estufas.
- Autenticação multifator com códigos descartáveis armazenados em `mfa_challenges` (TTL 5 minutos).
- Documentação adicional disponível em `docs/REQUISITOS.md` e `docs/LGPD.md`.
