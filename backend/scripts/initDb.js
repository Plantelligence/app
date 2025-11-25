import { database } from '../services/database.js';

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'User',
    full_name TEXT,
    phone TEXT,
    consent_given INTEGER NOT NULL DEFAULT 0,
    consent_timestamp TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT,
    last_password_change TEXT,
    password_expires_at TEXT,
    deletion_requested INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT,
    jti TEXT,
    type TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS idx_tokens_user_type ON tokens(user_id, type)',
  'CREATE INDEX IF NOT EXISTS idx_tokens_jti ON tokens(jti)',
  `CREATE TABLE IF NOT EXISTS security_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    metadata TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mfa_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS idx_mfa_user ON mfa_challenges(user_id)'
];

try {
  for (const statement of statements) {
    // eslint-disable-next-line no-await-in-loop
    await database.run(statement);
  }
  console.info('SQLite database initialized at', database.db.filename ?? 'backend/db.sqlite');
} catch (error) {
  console.error('Failed to initialize database', error);
  process.exitCode = 1;
} finally {
  await database.close();
}
