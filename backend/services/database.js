import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { settings } from '../config/settings.js';

sqlite3.verbose();

const dbFilePath = settings.dbPath;
const dbDir = path.dirname(dbFilePath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbFilePath);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(err) {
    if (err) {
      reject(err);
      return;
    }
    resolve({ id: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(rows);
  });
});

const close = () => new Promise((resolve, reject) => {
  db.close((err) => {
    if (err) {
      reject(err);
      return;
    }
    resolve();
  });
});

export const database = {
  db,
  run,
  get,
  all,
  close
};
