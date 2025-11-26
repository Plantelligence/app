import { getFirestoreDb } from '../config/settings.js';

const main = async () => {
  try {
    const firestore = getFirestoreDb();
    await firestore.listCollections();
    const projectId = firestore.projectId ?? 'unknown-project';
    console.info(`Firestore connection established for project ${projectId}. No schema migration required.`);
  } catch (error) {
    console.error('Failed to verify Firestore connectivity', error);
    process.exitCode = 1;
  }
};

await main();
