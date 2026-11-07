import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import type { DatabaseExecResult, DatabaseRow, DatabaseService } from '@/types/database';
import { createSerialRunner } from '@/utils/concurrency';

let sqlite: ReturnType<typeof initSqlJs> | undefined;

const openEngine = () =>
  (sqlite ??= initSqlJs({
    locateFile: () => `${process.env['NEXT_PUBLIC_DSH_READER_PATH']}/vendor/sql-wasm-browser.wasm`,
  }).catch((error) => {
    sqlite = undefined;
    throw error;
  }));

/** DSH embeds the reader in a document without shared-memory isolation. */
export class DshDatabaseService implements DatabaseService {
  private readonly run = createSerialRunner();
  private transaction?: { db: Database; release: () => void };

  constructor(private readonly name: string) {}

  private get lockName() {
    return `readest:dsh:database:${this.name}`;
  }

  private async load() {
    const SQL = await openEngine();
    const root = await navigator.storage.getDirectory();
    try {
      const file = await (await root.getFileHandle(this.name)).getFile();
      return new SQL.Database(new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
      return new SQL.Database();
    }
  }

  private async save(db: Database) {
    const root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle(this.name, { create: true });
    const writer = await file.createWritable();
    try {
      await writer.write(new Uint8Array(db.export()));
      await writer.close();
    } catch (error) {
      await writer.abort().catch(() => {});
      throw error;
    }
  }

  private async withDatabase<T>(write: boolean, action: (db: Database) => T): Promise<T> {
    if (this.transaction) return action(this.transaction.db);
    return navigator.locks.request(this.lockName, async () => {
      const db = await this.load();
      try {
        const result = action(db);
        if (write) await this.save(db);
        return result;
      } finally {
        db.close();
      }
    });
  }

  private async begin(sql: string) {
    if (this.transaction) throw new Error('A database transaction is already open');
    // Hold the lock across explicit BEGIN/COMMIT calls from the database consumers.
    await new Promise<void>((ready, reject) => {
      void navigator.locks
        .request(this.lockName, async () => {
          const db = await this.load();
          try {
            db.run(sql);
            await new Promise<void>((release) => {
              this.transaction = { db, release };
              ready();
            });
          } finally {
            db.close();
          }
        })
        .catch(reject);
    });
  }

  private end() {
    const transaction = this.transaction;
    this.transaction = undefined;
    transaction?.release();
  }

  execute(sql: string, params: unknown[] = []): Promise<DatabaseExecResult> {
    return this.run(async () => {
      const statement = sql.trim();
      if (/^BEGIN\b/i.test(statement)) {
        await this.begin(statement);
        return { rowsAffected: 0, lastInsertId: 0 };
      }
      if (this.transaction && /^(?:COMMIT|END|ROLLBACK)\b/i.test(statement)) {
        try {
          this.transaction.db.run(statement);
          if (!/^ROLLBACK\b/i.test(statement)) await this.save(this.transaction.db);
        } finally {
          this.end();
        }
        return { rowsAffected: 0, lastInsertId: 0 };
      }
      return this.withDatabase(true, (db) => {
        db.run(sql, params.length ? (params as SqlValue[]) : undefined);
        const rowsAffected = db.getRowsModified();
        const lastInsertId = Number(db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0);
        return { rowsAffected, lastInsertId };
      });
    });
  }

  select<T extends DatabaseRow = DatabaseRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.run(() =>
      this.withDatabase(false, (db) => {
        const stmt = db.prepare(sql, params as SqlValue[]);
        try {
          const rows: T[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject() as T);
          return rows;
        } finally {
          stmt.free();
        }
      }),
    );
  }

  batch(statements: string[]): Promise<void> {
    return this.run(() =>
      this.withDatabase(true, (db) => {
        db.run('SAVEPOINT readest_batch');
        try {
          for (const sql of statements) db.run(sql);
          db.run('RELEASE readest_batch');
        } catch (error) {
          db.run('ROLLBACK TO readest_batch; RELEASE readest_batch');
          throw error;
        }
      }),
    );
  }

  close(): Promise<void> {
    return this.run(async () => this.end());
  }
}
