import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { database } from '../services/database.js';

const logDir = path.resolve(process.cwd(), 'backend', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFilePath = path.join(logDir, 'security.log');

const getPrevHash = async () => {
  const row = await database.get(
    'SELECT hash FROM security_logs ORDER BY created_at DESC LIMIT 1'
  );
  return row?.hash ?? 'GENESIS';
};

export const logSecurityEvent = async ({
  userId = null,
  action,
  metadata = {},
  ipAddress = null
}) => {
  const createdAt = new Date().toISOString();
  const prevHash = await getPrevHash();
  const payload = JSON.stringify({ userId, action, metadata, ipAddress, createdAt });
  const hash = crypto.createHash('sha256').update(prevHash + payload).digest('hex');

  await database.run(
    `INSERT INTO security_logs (id, user_id, action, metadata, ip_address, created_at, prev_hash, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      userId,
      action,
      JSON.stringify(metadata),
      ipAddress,
      createdAt,
      prevHash,
      hash
    ]
  );

  fs.appendFileSync(
    logFilePath,
    `${createdAt} | action=${action} | user=${userId ?? 'anonymous'} | hash=${hash}\n`
  );
};

export const getSecurityLogs = async (limit = 100) => {
  const rows = await database.all(
    `SELECT id, user_id as userId, action, metadata, ip_address as ipAddress, created_at as createdAt, hash, prev_hash as prevHash
     FROM security_logs
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }));
};
