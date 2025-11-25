import admin from 'firebase-admin';
import { settings } from '../config/settings.js';

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
    try {
      app = admin.initializeApp();
    } catch (error) {
      throw new Error('Firebase Admin SDK failed to initialize. Provide FIREBASE_CREDENTIALS or configure default credentials.', { cause: error });
    }
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

export const database = {
  get firestore() {
    return getFirestore();
  },
  run,
  get,
  all,
  remove,
  count
};
