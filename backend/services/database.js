import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { settings } from '../config/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localDbDir = path.resolve(__dirname, '..', 'data');
const localDbPath = path.join(localDbDir, 'local-db.json');

let localStore;
let localDirty = false;
let localInitialized = false;

const structuredCloneSafe = (value) => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const ensureLocalStoreLoaded = () => {
  if (localInitialized) {
    return;
  }

  fs.mkdirSync(localDbDir, { recursive: true });

  if (fs.existsSync(localDbPath)) {
    try {
      const raw = fs.readFileSync(localDbPath, 'utf8');
      localStore = raw.trim() ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('Failed to load local datastore. Starting with a clean state.', error);
      localStore = {};
    }
  } else {
    localStore = {};
  }

  localInitialized = true;
};

const persistLocalStore = () => {
  if (!localDirty) {
    return;
  }

  fs.mkdirSync(localDbDir, { recursive: true });
  fs.writeFileSync(localDbPath, JSON.stringify(localStore, null, 2), 'utf8');
  localDirty = false;
};

const getCollection = (collectionName) => {
  ensureLocalStoreLoaded();
  if (!localStore[collectionName]) {
    localStore[collectionName] = [];
  }
  return localStore[collectionName];
};

const getValueByPath = (source, field) => {
  if (!field) {
    return undefined;
  }

  return field.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
};

const coerceComparable = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'string') {
    const parsedDate = Date.parse(value);
    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }

    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }

    return value;
  }

  return value;
};

const compareValues = (left, operator, right) => {
  switch (operator) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (left === undefined || left === null || right === undefined || right === null) {
        return false;
      }

      const leftComparable = coerceComparable(left);
      const rightComparable = coerceComparable(right);

      if (typeof leftComparable === 'string' && typeof rightComparable === 'string') {
        if (operator === '<') {
          return leftComparable < rightComparable;
        }
        if (operator === '<=') {
          return leftComparable <= rightComparable;
        }
        if (operator === '>') {
          return leftComparable > rightComparable;
        }
        return leftComparable >= rightComparable;
      }

      if (typeof leftComparable !== typeof rightComparable) {
        return false;
      }

      if (operator === '<') {
        return leftComparable < rightComparable;
      }
      if (operator === '<=') {
        return leftComparable <= rightComparable;
      }
      if (operator === '>') {
        return leftComparable > rightComparable;
      }
      return leftComparable >= rightComparable;
    }
    case 'array-contains':
      return Array.isArray(left) && left.includes(right);
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'not-in':
      return Array.isArray(right) && !right.includes(left);
    default:
      return left === right;
  }
};

const applyFilters = (records, filters = []) => {
  if (!filters || filters.length === 0) {
    return [...records];
  }

  return records.filter((record) =>
    filters.every(({ field, operator = '==', value }) => {
      const recordValue = getValueByPath(record, field);
      return compareValues(recordValue, operator, value);
    })
  );
};

const sortRecords = (records, orderBy) => {
  const specs = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (!specs.length) {
    return [...records];
  }

  const copy = [...records];
  copy.sort((a, b) => {
    for (const spec of specs) {
      const direction = spec.direction === 'desc' ? -1 : 1;
      const left = getValueByPath(a, spec.field);
      const right = getValueByPath(b, spec.field);

      if (left === right) {
        continue;
      }

      const leftComparable = coerceComparable(left);
      const rightComparable = coerceComparable(right);

      if (leftComparable === rightComparable) {
        continue;
      }

      if (leftComparable > rightComparable) {
        return direction;
      }

      if (leftComparable < rightComparable) {
        return -direction;
      }
    }
    return 0;
  });

  return copy;
};

const limitRecords = (records, limit) => {
  if (!limit || limit < 1) {
    return records;
  }

  return records.slice(0, limit);
};

const createLocalAdapter = () => {
  const run = async (collectionName, { id, data, merge = false }) => {
    if (!data || typeof data !== 'object') {
      throw new Error('database.run requires a data object');
    }

    const collection = getCollection(collectionName);
    const targetId = id ?? data.id ?? uuidv4();
    const index = collection.findIndex((record) => record.id === targetId);

    let nextRecord;

    if (index >= 0) {
      const existing = collection[index];
      nextRecord = merge ? { ...existing, ...data, id: targetId } : { ...data, id: targetId };
      collection[index] = nextRecord;
    } else {
      nextRecord = { ...data, id: targetId };
      collection.push(nextRecord);
    }

    localDirty = true;
    persistLocalStore();

    return structuredCloneSafe(nextRecord);
  };

  const get = async (collectionName, options = {}) => {
    const collection = getCollection(collectionName);

    if (options.id) {
      const found = collection.find((record) => record.id === options.id);
      return found ? structuredCloneSafe(found) : null;
    }

    const filtered = limitRecords(
      sortRecords(applyFilters(collection, options.filters), options.orderBy),
      options.limit ?? 1
    );

    if (!filtered.length) {
      return null;
    }

    return structuredCloneSafe(filtered[0]);
  };

  const all = async (collectionName, options = {}) => {
    const collection = getCollection(collectionName);
    const filtered = applyFilters(collection, options.filters);
    const sorted = sortRecords(filtered, options.orderBy);
    const limited = limitRecords(sorted, options.limit);
    return structuredCloneSafe(limited);
  };

  const remove = async (collectionName, options = {}) => {
    const collection = getCollection(collectionName);

    if (options.id) {
      const index = collection.findIndex((record) => record.id === options.id);
      if (index >= 0) {
        collection.splice(index, 1);
        localDirty = true;
        persistLocalStore();
      }
      return;
    }

    if (!options.filters || options.filters.length === 0) {
      if (collection.length > 0) {
        localStore[collectionName] = [];
        localDirty = true;
        persistLocalStore();
      }
      return;
    }

    const idsToRemove = new Set(applyFilters(collection, options.filters).map((record) => record.id));

    if (idsToRemove.size === 0) {
      return;
    }

    localStore[collectionName] = collection.filter((record) => !idsToRemove.has(record.id));
    localDirty = true;
    persistLocalStore();
  };

  const count = async (collectionName, options = {}) => {
    const collection = getCollection(collectionName);
    const filtered = applyFilters(collection, options.filters);
    return filtered.length;
  };

  return { run, get, all, remove, count };
};

const createFirestoreAdapter = () => {
  let firestoreInstance;

  const getFirestore = () => {
    if (firestoreInstance) {
      return firestoreInstance;
    }

    let app;

    if (admin.apps.length > 0) {
      app = admin.app();
    } else if (settings.firebaseCredentials) {
      app = admin.initializeApp({
        credential: admin.credential.cert(settings.firebaseCredentials)
      });
    } else {
      app = admin.initializeApp();
    }

    firestoreInstance = app.firestore();
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
    return firestoreInstance;
  };

  const buildQuery = (collectionName, {
    filters = [],
    orderBy,
    limit
  } = {}) => {
    const firestore = getFirestore();
    let query = firestore.collection(collectionName);

    for (const filter of filters) {
      const operator = filter.operator ?? '==';
      query = query.where(filter.field, operator, filter.value);
    }

    const orderBys = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    for (const order of orderBys) {
      query = query.orderBy(order.field, order.direction ?? 'asc');
    }

    if (limit) {
      query = query.limit(limit);
    }

    return query;
  };

  const run = async (collectionName, { id, data, merge = false }) => {
    if (!data || typeof data !== 'object') {
      throw new Error('database.run requires a data object');
    }

    const firestore = getFirestore();
    const collectionRef = firestore.collection(collectionName);
    const documentRef = id ? collectionRef.doc(id) : collectionRef.doc();

    await documentRef.set(data, { merge });
    const snapshot = await documentRef.get();
    return { id: documentRef.id, ...snapshot.data() };
  };

  const get = async (collectionName, options = {}) => {
    const { id } = options;
    const firestore = getFirestore();

    if (id) {
      const doc = await firestore.collection(collectionName).doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    }

    const query = buildQuery(collectionName, {
      ...options,
      limit: options.limit ?? 1
    });

    const snapshot = await query.get();
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  };

  const all = async (collectionName, options = {}) => {
    const query = buildQuery(collectionName, options);
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  };

  const remove = async (collectionName, options = {}) => {
    const firestore = getFirestore();

    if (options.id) {
      await firestore.collection(collectionName).doc(options.id).delete();
      return;
    }

    const snapshot = await buildQuery(collectionName, options).get();
    if (snapshot.empty) {
      return;
    }

    let batch = firestore.batch();
    let counter = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      counter += 1;

      if (counter === 500) {
        await batch.commit();
        batch = firestore.batch();
        counter = 0;
      }
    }

    if (counter > 0) {
      await batch.commit();
    }
  };

  const count = async (collectionName, options = {}) => {
    const query = buildQuery(collectionName, options);
    const aggregate = query.count();
    const snapshot = await aggregate.get();
    return snapshot.data().count;
  };

  // Ensure Firestore initialization happens eagerly so that failures are caught early.
  getFirestore();

  return { run, get, all, remove, count };
};

let implementation;
let databaseMode = 'local';
let initializationError;
let hasLoggedMode = false;

const resolveImplementation = () => {
  if (implementation) {
    return implementation;
  }

  const preference = (process.env.DATA_BACKEND ?? 'auto').toLowerCase();
  const hasFirebaseConfig =
    Boolean(settings.firebaseCredentials) ||
    Boolean(process.env.FIREBASE_CREDENTIALS) ||
    Boolean(process.env.FIREBASE_CREDENTIALS_BASE64) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  const shouldTryFirestore =
    preference === 'firestore' ||
    (preference === 'auto' && (process.env.VERCEL === '1' || hasFirebaseConfig));

  if (shouldTryFirestore) {
    try {
      implementation = createFirestoreAdapter();
      databaseMode = 'firestore';
    } catch (error) {
      initializationError = error;
      console.warn('Failed to initialize Firestore adapter. Falling back to local datastore.', error);
      implementation = null;
    }
  }

  if (!implementation) {
    implementation = createLocalAdapter();
    databaseMode = 'local';
  }

  if (!hasLoggedMode) {
    if (databaseMode === 'local' && initializationError) {
      console.info('Local datastore engaged due to Firestore initialization issues.');
    }
    console.info(`Using ${databaseMode} database adapter.`);
    hasLoggedMode = true;
  }

  return implementation;
};

export const database = new Proxy(
  {},
  {
    get(_target, prop) {
      const impl = resolveImplementation();
      const value = impl[prop];
      return typeof value === 'function' ? value.bind(impl) : value;
    }
  }
);

export const getDatabaseMode = () => databaseMode;
