import { getFirestoreDb } from '../config/settings.js';

const firestore = getFirestoreDb();

const mapDoc = (docSnap) => ({ id: docSnap.id, ...docSnap.data() });

const collection = (name) => firestore.collection(name);

const run = async (collectionName, operation) => {
  const collectionRef = collection(collectionName);
  return operation(collectionRef, firestore);
};

const get = async (collectionName, buildQuery) => {
  const baseQuery = collection(collectionName);
  const query = buildQuery ? buildQuery(baseQuery) : baseQuery.limit(1);
  const snapshot = await query.get();

  if (snapshot.empty) {
    return null;
  }

  return mapDoc(snapshot.docs[0]);
};

const all = async (collectionName, buildQuery) => {
  const baseQuery = collection(collectionName);
  const query = buildQuery ? buildQuery(baseQuery) : baseQuery;
  const snapshot = await query.get();

  return snapshot.docs.map(mapDoc);
};

const getById = async (collectionName, id) => {
  const snapshot = await collection(collectionName).doc(id).get();

  if (!snapshot.exists) {
    return null;
  }

  return mapDoc(snapshot);
};

const setDocument = async (collectionName, id, data, { merge = false } = {}) => {
  await collection(collectionName).doc(id).set(data, { merge });
  return { id };
};

const updateDocument = (collectionName, id, data) =>
  setDocument(collectionName, id, data, { merge: true });

const deleteDocument = async (collectionName, id) => {
  await collection(collectionName).doc(id).delete();
  return { changes: 1 };
};

const deleteWhere = async (collectionName, buildQuery) => {
  const targets = await all(collectionName, buildQuery);

  if (targets.length === 0) {
    return { changes: 0 };
  }

  const batch = firestore.batch();

  targets.forEach((doc) => {
    batch.delete(collection(collectionName).doc(doc.id));
  });

  await batch.commit();

  return { changes: targets.length };
};

const count = async (collectionName, buildQuery) => {
  const baseQuery = collection(collectionName);
  const query = buildQuery ? buildQuery(baseQuery) : baseQuery;
  const aggregate = await query.count().get();

  return aggregate.data().count;
};

const withTransaction = (handler) =>
  firestore.runTransaction((transaction) =>
    handler({
      transaction,
      collection: (name) => firestore.collection(name),
      doc: (name, id) => firestore.collection(name).doc(id)
    })
  );

export const database = {
  firestore,
  collection,
  doc: (name, id) => collection(name).doc(id),
  run,
  get,
  all,
  getById,
  setDocument,
  updateDocument,
  deleteDocument,
  deleteWhere,
  count,
  withTransaction
};
