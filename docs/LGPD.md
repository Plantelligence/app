# Conformidade LGPD — Plantelligence Demo 

## Bases Legais e Consentimento
- Coleta limitada a nome, e-mail e telefone para autenticação e contato operacional.
- Consentimento explícito obrigatório no cadastro, armazenado com timestamp.
- Possibilidade de revogação do consentimento pelo painel do usuário.

## Direitos do Titular
- **Acesso**: Visualização completa dos dados pessoais na aba "Meus dados".
- **Correção**: Atualização direta de nome/telefone mediante confirmação explícita.
- **Exclusão (Direito ao Esquecimento)**: Endpoint `POST /api/users/deletion-request` registra a solicitação e gera log.
- **Portabilidade**: Dados podem ser exportados consultando a API `/api/users/me` (formato JSON).

## Segurança da Informação
- Hash de senha com `bcrypt` (salt único por usuário) e expiração periódica de senha.
- Tokens JWT com `jti` armazenado para revogação e auditoria.
- Autenticação multifator com código temporário (TTL 5 minutos) e monitoramento de tentativas.
- Logs imutáveis com cadeia de hash, protegendo integridade dos eventos.
- Criptografia de comunicação simulada: AES-256-GCM + RSA-2048 (OAEP-SHA256).
- Rate limiting anti-força bruta e cabeçalhos de segurança via `helmet`.

## Armazenamento e Retenção
- Banco local SQLite (`backend/db.sqlite`) controlado pelo script `npm run db:setup`.
- Tabela `mfa_challenges` para guardar desafios descartáveis com expiração garantida.
- Tokens e logs expirados são limpos automaticamente (`cleanupExpiredTokens`).
- Solicitações de exclusão marcam a conta para anonimização manual (demonstração).

## Próximos Passos para Produção
- Integrar fluxo de aprovação de exclusão com anonimização física dos registros.
- Implementar notificação real via e-mail/SMS para resets e consentimento.
- Adicionar políticas de backup cifradas e testes automatizados de segurança.
- Realizar avaliação DPIA e atualização contínua da matriz de riscos.
