import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { database } from '../services/database.js';

const COLLECTION = 'security_logs';

const normalizeMetadata = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value ?? {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
};

export const logSecurityEvent = async ({
  userId = null,
  action,
  metadata = {},
  ipAddress = null
}) => {
  if (!action) {
    throw new Error('Action is required to log security events.');
  }

  const sanitizedMetadata = normalizeMetadata(metadata);

  await database.withTransaction(async ({ transaction, collection }) => {
    const logsCollection = collection(COLLECTION);
    const latestSnapshot = await transaction.get(
      logsCollection.orderBy('createdAtTs', 'desc').limit(1)
    );

    const prevHash = latestSnapshot.empty
      ? 'GENESIS'
      : latestSnapshot.docs[0].data().hash ?? 'GENESIS';

    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const payload = JSON.stringify({
      userId,
      action,
      metadata: sanitizedMetadata,
      ipAddress,
      createdAt: createdAtIso
    });
    const hash = crypto.createHash('sha256').update(prevHash + payload).digest('hex');
    const id = uuid();

    transaction.set(logsCollection.doc(id), {
      id,
      userId,
      action,
      metadata: sanitizedMetadata,
      ipAddress,
      createdAt: createdAtIso,
      createdAtTs: Timestamp.fromDate(createdAt),
      prevHash,
      hash
    });
  });
};

export const getSecurityLogs = async (limit = 100) => {
  const docs = await database.all(COLLECTION, (collectionRef) =>
    collectionRef.orderBy('createdAtTs', 'desc').limit(limit)
  );

  return docs.map((doc) => {
    const createdAtIso =
      doc.createdAt ?? (doc.createdAtTs ? doc.createdAtTs.toDate().toISOString() : null);

    return {
      id: doc.id,
      userId: doc.userId ?? null,
      action: doc.action,
      metadata: normalizeMetadata(doc.metadata),
      ipAddress: doc.ipAddress ?? null,
      createdAt: createdAtIso,
      hash: doc.hash,
      prevHash: doc.prevHash ?? null
    };
  });
};
