# Plantelligence (Local Demo)

Módulo de segurança full stack para o ecossistema **Plantelligence**, automatizando estufas por tipo de planta. A demonstração apresenta uma experiência completa com landing page, autenticação forte (MFA), criptografia ponta a ponta e controles LGPD — tudo operando localmente.

## Stack
- **Backend:** Node.js, Express, SQLite3, bcrypt, JWT, Helmet, Rate Limiter.
- **Frontend:** React (Vite), Tailwind CSS, Zustand, Axios.
- **Criptografia:** AES-256-GCM e RSA-2048 (OAEP-SHA256).

## Pré-requisitos
- Node.js 18.18 ou superior.
- npm 9+.

## Como executar
1. **Instalar dependências**
   ```powershell
   npm install
   ```
2. **Inicializar o banco de dados local**
   ```powershell
   npm run db:setup
   ```
   - Cria `backend/db.sqlite` com as tabelas necessárias (usuários, tokens, logs, desafios MFA).
3. **Iniciar backend e frontend em modo desenvolvimento**
   ```powershell
   npm run dev
   ```
   - Backend: http://localhost:4000
   - Frontend: http://localhost:5173 (proxy configurado para `/api`).

## Variáveis de Ambiente
Crie um arquivo `backend/.env` (baseado em `.env.example`) para ajustar segredos e políticas:
```
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
JWT_SECRET=alterar-para-producao
JWT_REFRESH_SECRET=alterar-refresh
PASSWORD_RESET_SECRET=alterar-reset
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=604800
PASSWORD_RESET_TTL_SECONDS=900
PASSWORD_EXPIRY_DAYS=90
```

## Funcionalidades Principais
- Home page "Tecnologia Plantelligence" destacando automação por espécie de planta e CTA de login no topo.
- Cadastro com consentimento LGPD obrigatório e atribuição automática do primeiro usuário como **Admin**.
- Login em duas etapas: hashing de senha (bcrypt) + código MFA de 6 dígitos com expiração de 5 minutos.
- Limitação de tentativas, revogação de tokens JWT (registro de JTI) e fluxos de recuperação de senha com tokens temporários (mock).
- Painel do usuário exibindo dados pessoais, consentimento, solicitação de exclusão, alteração de senha, status e JTI dos tokens.
- Logs de segurança encadeados com hash, acessíveis apenas por administradores.
- Simulação de criptografia: mensagens AES-256-GCM com chave simétrica protegida por RSA-2048.

## Estrutura do Monorepo
```
backend/   # API Express, módulos de auth/crypto/middleware/logs, SQLite local
frontend/  # Aplicação React/Vite com Tailwind e gerenciamento de sessão JWT
docs/      # Requisitos, LGPD e visão geral
```

## Observação para Deploy na Vercel
- O backend é exposto como função serverless em `/api/backend`. Garanta que o frontend utilize caminhos relativos iniciados em `/api/backend/` (ex.: `/api/backend/auth/login`) para que as chamadas funcionem corretamente tanto localmente quanto no ambiente Vercel.

## Testes Manuais Recomendados
- Explorar a landing page e acionar o login pelo botão "Entrar" no topo.
- Cadastrar um novo usuário e realizar login (nota: o primeiro usuário vira Admin automaticamente).
- Verificar o fluxo MFA digitando o código temporário exibido na interface (expira em 5 minutos).
- Forçar tentativas de login inválidas para observar o rate limit.
- Realizar fluxo completo de recuperação de senha (token mock devolvido pela API).
- Atualizar dados pessoais e verificar confirmação na UI e no banco.
- Para usuários Admin, acessar e validar os logs imutáveis e o endpoint `/api/admin/secure-data`.
- Executar a simulação de criptografia e inspecionar `encryptedKey`, `encryptedMessage` e verificação.

Documentação detalhada disponível em `docs/REQUISITOS.md` e `docs/LGPD.md`.