import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DshDatabaseService } from '@/services/database/dshDatabaseService';
import { createSerialRunner } from '@/utils/concurrency';

vi.mock('sql.js', async () => {
  const { createRequire } = await import('node:module');
  return { default: () => createRequire(import.meta.url)('sql.js')() };
});

describe('DSH browser database', () => {
  beforeEach(() => {
    const files = new Map<string, Uint8Array<ArrayBuffer>>();
    const locks = new Map<string, ReturnType<typeof createSerialRunner>>();
    vi.stubGlobal('navigator', {
      locks: {
        request: (name: string, task: () => Promise<unknown>) => {
          if (!locks.has(name)) locks.set(name, createSerialRunner());
          return locks.get(name)!(task);
        },
      },
      storage: {
        getDirectory: async () => ({
          getFileHandle: async (name: string, options?: { create: boolean }) => {
            if (!options?.create && !files.has(name)) throw new DOMException('', 'NotFoundError');
            return {
              getFile: async () => ({ arrayBuffer: async () => files.get(name)!.slice().buffer }),
              createWritable: async () => {
                let pending = new Uint8Array();
                return {
                  write: async (bytes: Uint8Array) => {
                    pending = new Uint8Array(bytes);
                  },
                  close: async () => {
                    files.set(name, pending);
                  },
                  abort: async () => {},
                };
              },
            };
          },
        }),
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('persists committed rows across handles without losing concurrent writes', async () => {
    const first = new DshDatabaseService('stats.db');
    const second = new DshDatabaseService('stats.db');
    await first.execute('CREATE TABLE events (id INTEGER PRIMARY KEY, title TEXT)');
    await first.execute('BEGIN IMMEDIATE');
    await first.execute('INSERT INTO events VALUES (?, ?)', [1, '第一本书']);
    const secondWrite = second.execute('INSERT INTO events VALUES (?, ?)', [2, '第二本书']);
    await first.execute('COMMIT');
    await secondWrite;
    expect(
      await new DshDatabaseService('stats.db').select('SELECT * FROM events ORDER BY id'),
    ).toEqual([
      { id: 1, title: '第一本书' },
      { id: 2, title: '第二本书' },
    ]);
  });

  it('keeps a failed batch or rolled-back transaction out of the saved file', async () => {
    const db = new DshDatabaseService('search.db');
    await db.execute('CREATE TABLE sections (id INTEGER PRIMARY KEY)');
    await expect(
      db.batch(['INSERT INTO sections VALUES (1)', 'INSERT INTO sections VALUES (1)']),
    ).rejects.toThrow();
    await db.execute('BEGIN');
    await db.execute('INSERT INTO sections VALUES (2)');
    await db.execute('ROLLBACK');
    expect(await db.select('SELECT * FROM sections')).toEqual([]);
  });
});
