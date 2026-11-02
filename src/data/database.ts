import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import initSqlJs from 'sql.js';
import type { Database as WebDatabase, SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { INITIAL_SCHEMA, SCHEMA_VERSION } from './schema';

export type Statement = { statement: string; values?: (string | number | null)[] };
export interface DatabaseAdapter { query<T = Record<string, unknown>>(sql: string, values?: (string | number | null)[]): Promise<T[]>; transact(statements: Statement[]): Promise<void>; }
let adapterPromise: Promise<DatabaseAdapter> | undefined;
const DB_NAME = 'takagelokoi';
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('takagelokoi-storage', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('databases');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function readBytes(): Promise<Uint8Array | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('databases', 'readonly');
    const req = tx.objectStore('databases').get(DB_NAME);
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
async function writeBytes(bytes: Uint8Array): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('databases', 'readwrite');
    tx.objectStore('databases').put(bytes, DB_NAME);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export function createWebAdapter(SQL: SqlJsStatic, bytes?: Uint8Array | null, persist = true): DatabaseAdapter & { export(): Uint8Array } {
  const db: WebDatabase = bytes ? new SQL.Database(bytes) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  let chain: Promise<unknown> = Promise.resolve();
  return {
    async query<T>(sql: string, values: (string | number | null)[] = []) {
      await chain.catch(() => undefined);
      const stmt = db.prepare(sql);
      try { stmt.bind(values); const rows: T[] = []; while (stmt.step()) rows.push(stmt.getAsObject() as T); return rows; }
      finally { stmt.free(); }
    },
    transact(statements: Statement[]) {
      const job = chain.catch(() => undefined).then(async () => {
        db.run('BEGIN IMMEDIATE');
        try {
          for (const s of statements) db.run(s.statement, s.values);
          db.run('COMMIT');
        } catch (error) { db.run('ROLLBACK'); throw error; }
        if (persist) await writeBytes(db.export());
      });
      chain = job;
      return job;
    },
    export: () => db.export(),
  };
}
/**
 * Android's Capacitor SQLite bridge distinguishes raw SQL (DDL/PRAGMA) from
 * parameterised statements. `executeSet` is an optimised DML path and requires
 * a `values` array on every row; feeding schema DDL through it breaks first launch.
 * Use one explicit native transaction, with the correct bridge method per statement.
 */
export function createNativeAdapter(native: SQLiteDBConnection): DatabaseAdapter {
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(job: () => Promise<T>): Promise<T> => {
    const result = chain.catch(() => undefined).then(job);
    chain = result.then(() => undefined, () => undefined);
    return result;
  };
  return {
    query: <T>(sql: string, values: (string | number | null)[] = []) => serial(async () => ((await native.query(sql, values)).values ?? []) as T[]),
    transact: statements => serial(async () => {
      if (!statements.length) return;
      await native.beginTransaction();
      try {
        for (const item of statements) {
          if (item.values && item.values.length) await native.run(item.statement, item.values, false, 'no', false);
          else await native.execute(item.statement, false, false);
        }
        await native.commitTransaction();
      } catch (error) {
        await native.rollbackTransaction().catch(() => undefined);
        throw error;
      }
    }),
  };
}
async function initialize(): Promise<DatabaseAdapter> {
  let adapter: DatabaseAdapter;
  if (Capacitor.isNativePlatform()) {
    const connection = new SQLiteConnection(CapacitorSQLite);
    await connection.checkConnectionsConsistency();
    const exists = (await connection.isConnection(DB_NAME, false)).result;
    const native = exists ? await connection.retrieveConnection(DB_NAME, false) : await connection.createConnection(DB_NAME, false, 'no-encryption', SCHEMA_VERSION, false);
    await native.open();
    await native.execute('PRAGMA foreign_keys = ON;', false, false);
    adapter = createNativeAdapter(native);
  } else {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    adapter = createWebAdapter(SQL, await readBytes());
  }
  const meta = await adapter.query<{ version: number }>("SELECT name FROM sqlite_master WHERE type='table' AND name='_meta'");
  const version = meta.length ? (await adapter.query<{ version: number }>('SELECT version FROM _meta'))[0].version : 0;
  if (version < 1) {
    const statements: Statement[] = INITIAL_SCHEMA.split(';').map(s => s.trim()).filter(Boolean).map(statement => ({ statement }));
    statements.push({ statement: 'CREATE TABLE IF NOT EXISTS security(key TEXT PRIMARY KEY,value TEXT NOT NULL)' });
    statements.push({ statement: 'CREATE TABLE IF NOT EXISTS _meta(version INTEGER NOT NULL)' });
    statements.push({ statement: 'INSERT INTO _meta(version) VALUES (?)', values: [SCHEMA_VERSION] });
    await adapter.transact(statements);
  }
  await adapter.transact([{ statement: 'CREATE TABLE IF NOT EXISTS security(key TEXT PRIMARY KEY,value TEXT NOT NULL)' }]);
  // Future migrations must be additive, ordered, and tested against every previous version.
  return adapter;
}
export function getDatabase() { return adapterPromise ??= initialize().catch(error => { adapterPromise = undefined; throw error; }); }
export function upsert(table: string, row: Record<string, unknown>): Statement {
  if (!/^[a-z_]+$/.test(table) || Object.keys(row).some(k => !/^[a-z_0-9]+$/.test(k))) throw new Error('Invalid database identifier.');
  const keys = Object.keys(row);
  const updates = keys.filter(k => k !== 'id').map(k => `${k}=excluded.${k}`).join(',');
  return { statement: `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${updates}`, values: keys.map(k => row[k] as string | number | null) };
}
