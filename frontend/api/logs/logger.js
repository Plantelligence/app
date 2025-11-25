import crypto from 'crypto';
import { database } from '../services/database.js';
import { v4 as uuidv4 } from 'uuid';

const getPrevHash = async () => {
  const logs = await database.all('security_logs', {
    orderBy: { field: 'created_at', direction: 'desc' },
    limit: 1
  });

  return logs[0]?.hash ?? 'GENESIS';

};


const parseMetadata = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return { raw: value };
  }
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

  await database.run('security_logs', {
    id: uuidv4(),
    data: {
      user_id: userId,
      action,
      metadata,
      ip_address: ipAddress,
      created_at: createdAt,
      prev_hash: prevHash,
      hash
    }
  });
};

export const getSecurityLogs = async (limit = 100) => {
  const logs = await database.all('security_logs', {
    orderBy: { field: 'created_at', direction: 'desc' },
    limit
  });

  return logs.map((log) => ({
    id: log.id,
    userId: log.user_id ?? null,
    action: log.action,
    metadata: parseMetadata(log.metadata),
    ipAddress: log.ip_address ?? null,
    createdAt: log.created_at,
    hash: log.hash,
    prevHash: log.prev_hash
  }));
};
