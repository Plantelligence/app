import { Timestamp } from 'firebase-admin/firestore';
import { v4 as uuid } from 'uuid';
import { database } from './database.js';
import { flowerProfiles, findFlowerProfile } from '../config/flowerProfiles.js';
import { logSecurityEvent } from '../logs/logger.js';
import { sendGreenhouseAlertEmail } from './emailService.js';
import { getUserById } from '../auth/authService.js';

const GREENHOUSE_COLLECTION = 'greenhouses';
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_WATCHERS = 12;

const ensureWatcherArray = (watchers) => {
  if (!Array.isArray(watchers)) {
    return [];
  }

  return [...new Set(watchers.map((entry) => String(entry).trim()).filter(Boolean))];
};

const mapGreenhouseRecord = (record) => ({
  id: record.id,
  ownerId: record.ownerId ?? record.userId ?? null,
  name: record.name ?? 'Estufa Matriz',
  flowerProfileId: record.flowerProfileId ?? null,
  watchers: ensureWatcherArray(record.watchers),
  alertsEnabled: record.alertsEnabled === undefined ? true : Boolean(record.alertsEnabled),
  lastAlertAt: record.lastAlertAt ?? null,
  createdAt: record.createdAt ?? null,
  updatedAt: record.updatedAt ?? null
});

const getUserSnapshot = async (userId) => {
  if (!userId) {
    return null;
  }

  const user = await getUserById(userId);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName ?? null,
    role: user.role ?? 'User'
  };
};

const enrichWithProfileAndWatchers = async (record) => {
  const profile = record.flowerProfileId
    ? findFlowerProfile(record.flowerProfileId) ?? null
    : null;

  let watchersDetails = [];

  if (record.watchers.length > 0) {
    const detailPromises = record.watchers.map((watcherId) => getUserSnapshot(watcherId));
    const results = await Promise.all(detailPromises);
    watchersDetails = results.filter(Boolean);
  }

  return {
    ...record,
    profile,
    watchersDetails
  };
};

const getGreenhouseRecordById = async (greenhouseId) => {
  const doc = await database.getById(GREENHOUSE_COLLECTION, greenhouseId);

  if (!doc) {
    return null;
  }

  return mapGreenhouseRecord(doc);
};

const listGreenhouseRecordsByOwner = async (ownerId) =>
  database.all(GREENHOUSE_COLLECTION, (collectionRef) =>
    collectionRef.where('ownerId', '==', ownerId)
  );

const ensureDefaultGreenhouseForOwner = async (ownerId) => {
  const now = new Date();
  const nowIso = now.toISOString();
  const greenhouseId = uuid();

  await database.setDocument(GREENHOUSE_COLLECTION, greenhouseId, {
    id: greenhouseId,
    ownerId,
    userId: ownerId,
    name: 'Estufa Matriz',
    flowerProfileId: null,
    watchers: [],
    alertsEnabled: true,
    lastAlertAt: null,
    createdAt: nowIso,
    createdAtTs: Timestamp.fromDate(now),
    updatedAt: nowIso,
    updatedAtTs: Timestamp.fromDate(now)
  });

  await logSecurityEvent({
    userId: ownerId,
    action: 'greenhouse_created',
    metadata: { greenhouseId }
  });

  const record = await getGreenhouseRecordById(greenhouseId);
  return enrichWithProfileAndWatchers(record);
};

const resolveOwnerGreenhouses = async (ownerId) => {
  const records = await listGreenhouseRecordsByOwner(ownerId);

  if (records.length > 0) {
    const sanitized = records.map(mapGreenhouseRecord);
    sanitized.sort((a, b) => {
      const aCreated = a.createdAt ?? '';
      const bCreated = b.createdAt ?? '';
      return aCreated.localeCompare(bCreated);
    });
    return Promise.all(sanitized.map(enrichWithProfileAndWatchers));
  }

  const legacy = await database.getById(GREENHOUSE_COLLECTION, ownerId);

  if (legacy) {
    const record = mapGreenhouseRecord(legacy);
    if (!legacy.ownerId) {
      await database.updateDocument(GREENHOUSE_COLLECTION, legacy.id, {
        ownerId,
        alertsEnabled: record.alertsEnabled,
        updatedAt: legacy.updatedAt ?? new Date().toISOString()
      });
      record.ownerId = ownerId;
    }
    return [await enrichWithProfileAndWatchers(record)];
  }

  return [await ensureDefaultGreenhouseForOwner(ownerId)];
};

const assertOwnership = (record, ownerId) => {
  if (!record) {
    const error = new Error('Estufa n�o encontrada.');
    error.statusCode = 404;
    throw error;
  }

  if (record.ownerId !== ownerId) {
    const error = new Error('Voc� n�o tem permiss�o para alterar esta estufa.');
    error.statusCode = 403;
    throw error;
  }
};

const normalizeMetric = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const evaluateSingleMetric = (value, { min, max }) => {
  const normalizedValue = normalizeMetric(value);
  if (normalizedValue === null) {
    return {
      ok: false,
      value: null,
      deviation: null,
      expected: { min, max }
    };
  }
  if (normalizedValue < min) {
    return {
      ok: false,
      value: normalizedValue,
      deviation: min - normalizedValue,
      expected: { min, max },
      direction: 'low'
    };
  }
  if (normalizedValue > max) {
    return {
      ok: false,
      value: normalizedValue,
      deviation: normalizedValue - max,
      expected: { min, max },
      direction: 'high'
    };
  }
  return {
    ok: true,
    value: normalizedValue,
    deviation: 0,
    expected: { min, max },
    direction: 'in-range'
  };
};

const buildAlertSummary = (profile, metricsEvaluation, metrics = {}) => {
  const alerts = [];
  const resolveDisplayValue = (evaluationEntry, rawValue) => {
    const evaluationValue = typeof evaluationEntry?.value === 'number' && Number.isFinite(evaluationEntry.value)
      ? evaluationEntry.value
      : null;
    const normalizedRaw = normalizeMetric(rawValue);
    const resolved = evaluationValue ?? normalizedRaw;

    if (resolved === null) {
      return 'n/d';
    }

    const fixed = resolved.toFixed(1);
    const numericFixed = Number.parseFloat(fixed);
    return Number.isInteger(numericFixed) ? String(numericFixed) : fixed;
  };

  if (!metricsEvaluation.temperature.ok) {
    const expectation = metricsEvaluation.temperature.expected;
    alerts.push(
      `Temperatura em ${resolveDisplayValue(metricsEvaluation.temperature, metrics.temperature)}°C (ideal ${expectation.min}°C - ${expectation.max}°C).`
    );
  }

  if (!metricsEvaluation.humidity.ok) {
    const expectation = metricsEvaluation.humidity.expected;
    alerts.push(
      `Umidade relativa em ${resolveDisplayValue(metricsEvaluation.humidity, metrics.humidity)}% (ideal ${expectation.min}% - ${expectation.max}%).`
    );
  }

  if (!metricsEvaluation.soilMoisture.ok) {
    const expectation = metricsEvaluation.soilMoisture.expected;
    alerts.push(
      `Umidade do substrato em ${resolveDisplayValue(metricsEvaluation.soilMoisture, metrics.soilMoisture)}% (ideal ${expectation.min}% - ${expectation.max}%).`
    );
  }

  return alerts;
};

export const listFlowerProfiles = () => flowerProfiles;

export const listGreenhouses = async (ownerId) => resolveOwnerGreenhouses(ownerId);

export const listGreenhousesForAdmin = async (ownerId) => resolveOwnerGreenhouses(ownerId);

export const createGreenhouse = async ({ ownerId, name, flowerProfileId }) => {
  const trimmedName = name?.trim();

  if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 80) {
    const error = new Error('Nome da estufa deve ter entre 3 e 80 caracteres.');
    error.statusCode = 400;
    throw error;
  }

  const profile = flowerProfileId ? findFlowerProfile(flowerProfileId) : null;

  if (flowerProfileId && !profile) {
    const error = new Error('Tipo de cultivo de flores inv�lido.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const greenhouseId = uuid();

  await database.setDocument(GREENHOUSE_COLLECTION, greenhouseId, {
    id: greenhouseId,
    ownerId,
    userId: ownerId,
    name: trimmedName,
    flowerProfileId: profile?.id ?? null,
    watchers: [],
    alertsEnabled: true,
    lastAlertAt: null,
    createdAt: nowIso,
    createdAtTs: Timestamp.fromDate(now),
    updatedAt: nowIso,
    updatedAtTs: Timestamp.fromDate(now)
  });

  await logSecurityEvent({
    userId: ownerId,
    action: 'greenhouse_created',
    metadata: {
      greenhouseId,
      flowerProfileId: profile?.id ?? null
    }
  });

  const record = await getGreenhouseRecordById(greenhouseId);
  return enrichWithProfileAndWatchers(record);
};

export const getGreenhouseForOwner = async ({ greenhouseId, ownerId }) => {
  const record = await getGreenhouseRecordById(greenhouseId);
  assertOwnership(record, ownerId);
  return enrichWithProfileAndWatchers(record);
};

export const getGreenhouseForAdmin = async (greenhouseId) => {
  const record = await getGreenhouseRecordById(greenhouseId);

  if (!record) {
    const error = new Error('Estufa n�o encontrada.');
    error.statusCode = 404;
    throw error;
  }

  return enrichWithProfileAndWatchers(record);
};

export const updateGreenhouseBasics = async ({ greenhouseId, ownerId, name, flowerProfileId }) => {
  const record = await getGreenhouseRecordById(greenhouseId);
  assertOwnership(record, ownerId);

  const trimmedName = name?.trim();

  if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 80) {
    const error = new Error('Nome da estufa deve ter entre 3 e 80 caracteres.');
    error.statusCode = 400;
    throw error;
  }

  const profile = findFlowerProfile(flowerProfileId);

  if (!profile) {
    const error = new Error('Tipo de cultivo de flores inv�lido.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  await database.updateDocument(GREENHOUSE_COLLECTION, greenhouseId, {
    name: trimmedName,
    flowerProfileId: profile.id,
    updatedAt: nowIso,
    updatedAtTs: Timestamp.fromDate(now)
  });

  await logSecurityEvent({
    userId: ownerId,
    action: 'greenhouse_config_updated',
    metadata: {
      greenhouseId,
      flowerProfileId: profile.id,
      name: trimmedName
    }
  });

  return getGreenhouseForOwner({ greenhouseId, ownerId });
};

export const updateAlertSettings = async ({ greenhouseId, ownerId, alertsEnabled }) => {
  const record = await getGreenhouseRecordById(greenhouseId);
  assertOwnership(record, ownerId);

  const now = new Date();
  const nowIso = now.toISOString();

  await database.updateDocument(GREENHOUSE_COLLECTION, greenhouseId, {
    alertsEnabled: Boolean(alertsEnabled),
    updatedAt: nowIso,
    updatedAtTs: Timestamp.fromDate(now)
  });

  await logSecurityEvent({
    userId: ownerId,
    action: 'greenhouse_alerts_setting_updated',
    metadata: {
      greenhouseId,
      alertsEnabled: Boolean(alertsEnabled)
    }
  });

  return getGreenhouseForOwner({ greenhouseId, ownerId });
};

export const deleteGreenhouse = async ({ greenhouseId, ownerId }) => {
  const record = await getGreenhouseRecordById(greenhouseId);
  assertOwnership(record, ownerId);

  await database.deleteDocument(GREENHOUSE_COLLECTION, greenhouseId);

  await logSecurityEvent({
    userId: ownerId,
    action: 'greenhouse_deleted',
    metadata: {
      greenhouseId
    }
  });

  const remaining = await resolveOwnerGreenhouses(ownerId);

  return {
    deletedId: greenhouseId,
    greenhouses: remaining
  };
};

export const updateGreenhouseTeam = async ({ actorUserId, greenhouseId, watcherIds }) => {
  const actor = await getUserById(actorUserId);

  if (!actor || actor.role !== 'Admin') {
    const error = new Error('Apenas administradores podem ajustar a equipe de alertas.');
    error.statusCode = 403;
    throw error;
  }

  const record = await getGreenhouseRecordById(greenhouseId);

  if (!record) {
    const error = new Error('Estufa n�o encontrada.');
    error.statusCode = 404;
    throw error;
  }

  const uniqueWatcherIds = ensureWatcherArray(watcherIds);

  if (uniqueWatcherIds.length > MAX_WATCHERS) {
    const error = new Error('Limite m�ximo de 12 integrantes por equipe.');
    error.statusCode = 400;
    throw error;
  }

  const snapshots = await Promise.all(uniqueWatcherIds.map((watcherId) => getUserSnapshot(watcherId)));

  const missing = snapshots
    .map((snapshot, index) => (snapshot ? null : uniqueWatcherIds[index]))
    .filter(Boolean);

  if (missing.length > 0) {
    const error = new Error('Integrantes inv�lidos informados para a equipe.');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  await database.updateDocument(GREENHOUSE_COLLECTION, greenhouseId, {
    watchers: uniqueWatcherIds,
    updatedAt: nowIso,
    updatedAtTs: Timestamp.fromDate(now)
  });

  await logSecurityEvent({
    userId: record.ownerId,
    action: 'greenhouse_team_updated',
    metadata: {
      greenhouseId,
      actorId: actorUserId,
      watchers: uniqueWatcherIds
    }
  });

  return getGreenhouseForAdmin(greenhouseId);
};

export const evaluateAndHandleGreenhouseMetrics = async ({
  greenhouseId,
  ownerId,
  metrics,
  notify,
  forceNotify
}) => {
  const record = await getGreenhouseRecordById(greenhouseId);
  assertOwnership(record, ownerId);

  if (!record.flowerProfileId) {
    const error = new Error('Defina o tipo de cultivo para habilitar a monitora��o.');
    error.statusCode = 400;
    throw error;
  }

  const profile = findFlowerProfile(record.flowerProfileId);

  if (!profile) {
    const error = new Error('Perfil de cultivo n�o est� dispon�vel.');
    error.statusCode = 404;
    throw error;
  }

  const metricsEvaluation = {
    temperature: evaluateSingleMetric(metrics?.temperature, profile.temperature),
    humidity: evaluateSingleMetric(metrics?.humidity, profile.humidity),
    soilMoisture: evaluateSingleMetric(metrics?.soilMoisture, profile.soilMoisture)
  };

  const alerts = buildAlertSummary(profile, metricsEvaluation, metrics);
  const status = alerts.length === 0 ? 'ok' : 'alert';

  let notified = false;
  let throttled = false;

  const shouldForceNotify = Boolean(forceNotify);

  if (notify && status === 'alert' && record.alertsEnabled) {
    const owner = await getUserSnapshot(ownerId);

    if (owner?.email) {
      const watchersDetails = await Promise.all(
        record.watchers.map((watcherId) => getUserSnapshot(watcherId))
      );
      const recipients = [owner, ...watchersDetails.filter(Boolean)];
      const uniqueEmails = Array.from(
        new Set(recipients.map((recipient) => recipient.email).filter(Boolean))
      );

      if (uniqueEmails.length > 0) {
        const lastAlertDate = record.lastAlertAt ? new Date(record.lastAlertAt) : null;
        const now = new Date();

        if (!shouldForceNotify && lastAlertDate && now.getTime() - lastAlertDate.getTime() < ALERT_COOLDOWN_MS) {
          throttled = true;
        } else {
          await sendGreenhouseAlertEmail({
            greenhouseName: record.name,
            profile,
            metrics,
            metricsEvaluation,
            recipients: uniqueEmails,
            alerts
          });

          notified = true;

          await database.updateDocument(GREENHOUSE_COLLECTION, greenhouseId, {
            lastAlertAt: now.toISOString(),
            lastAlertAtTs: Timestamp.fromDate(now),
            updatedAt: now.toISOString(),
            updatedAtTs: Timestamp.fromDate(now)
          });

          await logSecurityEvent({
            userId: ownerId,
            action: 'greenhouse_alert_email_sent',
            metadata: {
              greenhouseId,
              profileId: profile.id,
              alerts,
              forced: shouldForceNotify
            }
          });
        }
      }
    }
  }

  if (notify && status === 'alert' && !record.alertsEnabled) {
    await logSecurityEvent({
      userId: ownerId,
      action: 'greenhouse_alert_skipped_alerts_disabled',
      metadata: {
        greenhouseId,
        profileId: profile.id,
        alerts,
        forced: shouldForceNotify
      }
    });
  }

  if (notify && throttled) {
    await logSecurityEvent({
      userId: ownerId,
      action: 'greenhouse_alert_throttled',
      metadata: {
        greenhouseId,
        cooldownMinutes: ALERT_COOLDOWN_MS / 60000
      }
    });
  }

  const refreshed = await getGreenhouseForOwner({ greenhouseId, ownerId });

  return {
    greenhouse: refreshed,
    profile: refreshed.profile,
    metricsEvaluation,
    alerts,
    status,
    notified,
    throttled,
    alertsEnabled: refreshed.alertsEnabled
  };
};
