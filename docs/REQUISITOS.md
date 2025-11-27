# Requisitos Funcionais Atendidos 

## Segurança e Autenticação
- Cadastro com hash de senha (bcrypt) e consentimento LGPD obrigatório.
- Login protegido por rate limiting, tokens JWT (access + refresh) e revogação explícita.
- Autenticação multifator baseada em código descartável (6 dígitos, TTL 5 minutos) persistido em `mfa_challenges`.
- Recuperação e redefinição de senha via token temporário (mock) com expiração configurável.
- Expiração periódica de senha e alerta em UI para alteração obrigatória.

## Gestão de Credenciais e Sessões
- Armazenamento local em SQLite (`backend/db.sqlite`) com tabelas de usuários, tokens e logs.
- Tabelas auxiliares para MFA e limpeza automática de desafios expirados.
- Endpoint de revogação de sessão com registro de JTI (Access/Refresh).
- RBAC aplicado em rotas sensíveis (`/api/admin/*` e `/api/users/logs`).
- Logs imutáveis com cadeia de hash para auditoria.

## Criptografia de Comunicação
- Simulação de mensagem protegida com AES-256-GCM e chave simétrica encapsulada com RSA-OAEP.
- Endpoint público de chave RSA e verificação da mensagem criptografada.

## LGPD e Experiência do Usuário
- Frontend React/Vite com Tailwind evidenciando minimização de dados e consentimento.
- Landing page "Plantelligence" com CTA de login e destaque dos pilares de automação.
- Painel do usuário permite edição controlada, mudança de senha e solicitação de exclusão.
- Logs críticos acessíveis apenas por administradores.
- Documentação (`docs/LGPD.md`) descreve controles e ajustes necessários em produção.
