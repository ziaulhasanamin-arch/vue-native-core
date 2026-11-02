import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { INITIAL_SCHEMA } from './schema';
import { createWebAdapter } from './database';

async function memoryDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(INITIAL_SCHEMA);
  return db;
}

describe('SQLite schema', () => {
  it('initializes all normalized tables and indexes', async () => {
    const db = await memoryDb();
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0].values.map(r => r[0]);
    for (const name of ['users', 'accounts', 'categories', 'transactions', 'debts', 'goals', 'contributions', 'budgets', 'investments', 'valuations', 'sync_queue', 'recurrence_history']) expect(tables).toContain(name);
    const indexes = db.exec("SELECT name FROM sqlite_master WHERE type='index'")[0].values.map(r => r[0]);
    expect(indexes).toContain('idx_transactions_date');
    db.close();
  });
  it('enforces transfer, category and debt-link constraints', async () => {
    const db = await memoryDb();
    const time = Date.now();
    db.run("INSERT INTO users(id,display_name,created_at,updated_at) VALUES('u','Test',?,?)", [time, time]);
    db.run("INSERT INTO accounts(id,user_id,name,type,currency,created_at,updated_at) VALUES('a','u','Cash','cash','BDT',?,?)", [time, time]);
    db.run("INSERT INTO categories(id,user_id,name,type,icon,color,created_at,updated_at) VALUES('c','u','Food','expense','utensils','#fff',?,?)", [time, time]);
    const base = "INSERT INTO transactions(id,user_id,type,amount,currency,account_id,transaction_date,created_at,updated_at";
    expect(() => db.run(base + ",destination_account_id,destination_amount) VALUES('t1','u','transfer',100,'BDT','a',?, ?, ?, 'a',100)", [time, time, time])).toThrow();
    expect(() => db.run(base + ",category_id) VALUES('t2','u','expense',100,'BDT','a',?, ?, ?, NULL)", [time, time, time])).toThrow();
    expect(() => db.run(base + ") VALUES('t3','u','debt_payment',100,'BDT','a',?, ?, ?)", [time, time, time])).toThrow();
    expect(() => db.run(base + ",category_id) VALUES('t4','u','expense',100,'BDT','a',?, ?, ?, 'c')", [time, time, time])).not.toThrow();
    db.close();
  });
  it('rolls back failed multi-statement transactions', async () => {
    const SQL = await initSqlJs();
    const adapter = createWebAdapter(SQL, null, false);
    await adapter.transact([{ statement: 'CREATE TABLE demo(id INTEGER PRIMARY KEY, value INTEGER NOT NULL)' }]);
    await expect(adapter.transact([{ statement: 'INSERT INTO demo(id,value) VALUES(1,10)' }, { statement: 'INSERT INTO demo(id,value) VALUES(2,NULL)' }])).rejects.toThrow();
    expect(await adapter.query('SELECT * FROM demo')).toEqual([]);
  });
});
