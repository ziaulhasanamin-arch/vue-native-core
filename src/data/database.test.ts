import { describe, expect, it } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createNativeAdapter } from './database';

function fakeConnection(failRun = false) {
  const calls: string[] = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); return { changes: 0 }; },
    async commitTransaction() { calls.push('commit'); return { changes: 0 }; },
    async rollbackTransaction() { calls.push('rollback'); return { changes: 0 }; },
    async execute(statement: string, transaction: boolean, isSQL92: boolean) { calls.push(`execute:${transaction}:${isSQL92}:${statement}`); return { changes: 0 }; },
    async run(statement: string, values: unknown[], transaction: boolean) { calls.push(`run:${transaction}:${statement}:${JSON.stringify(values)}`); if (failRun) throw new Error('constraint failed'); return { changes: 1 }; },
    async executeSet() { calls.push('executeSet'); throw new Error('executeSet must not be used for mixed DDL/DML transactions'); },
    async query() { calls.push('query'); return { values: [{ ok: 1 }] }; },
  };
  return { adapter: createNativeAdapter(connection as unknown as SQLiteDBConnection), calls };
}

describe('native SQLite adapter', () => {
  it('uses raw execute for schema DDL and parameterised run inside one explicit transaction', async () => {
    const { adapter, calls } = fakeConnection();
    await adapter.transact([
      { statement: 'CREATE TABLE demo(id TEXT PRIMARY KEY)' },
      { statement: 'INSERT INTO demo(id) VALUES(?)', values: ['a'] },
    ]);
    expect(calls).toEqual([
      'begin',
      'execute:false:false:CREATE TABLE demo(id TEXT PRIMARY KEY)',
      'run:false:INSERT INTO demo(id) VALUES(?):["a"]',
      'commit',
    ]);
    expect(calls).not.toContain('executeSet');
  });

  it('rolls back a failed transaction and remains usable afterwards', async () => {
    const { adapter, calls } = fakeConnection(true);
    await expect(adapter.transact([{ statement: 'INSERT INTO demo(id) VALUES(?)', values: ['a'] }])).rejects.toThrow('constraint failed');
    expect(calls).toContain('rollback');
    expect(calls).not.toContain('commit');
    await expect(adapter.query('SELECT 1 ok')).resolves.toEqual([{ ok: 1 }]);
  });
});
