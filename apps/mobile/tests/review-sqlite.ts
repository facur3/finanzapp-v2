import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Account } from '@finanzapp/domain';
import { createAccount, initializeDatabase, readArchive, type LedgerDatabase } from '../src/storage/database.ts';
import { loadReviewTray, openReviewStore, type ReviewDatabase, type ReviewStore, type ReviewTray } from '../src/storage/review-database.ts';
import { runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';

/** Producto 25A-04: a disposable ledger and review file on real SQLite for the Assistant's capture tests (the same
 * connection shape as tests/review-store.node.ts). Synthetic accounts only; `dispose` closes and deletes both files.
 * `reopen` opens a new store over the same files, as an app restart would. */
function connection(path: string): TransactionConnection {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = OFF');
  return {
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, ...params) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => { const row = db.prepare(sql).get(...params); return row ? { ...row } as T : null; },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params).map(row => ({ ...row })) as T[],
    closeAsync: async () => { db.close(); },
  };
}

export interface ReviewFiles {
  ledger: LedgerDatabase;
  review: ReviewDatabase;
  store: ReviewStore;
  reopen: () => Promise<ReviewStore>;
  tray: (at?: string) => Promise<ReviewTray>;
  entries: () => Promise<string[]>;
  dispose: () => Promise<void>;
}

export async function reviewFiles(accounts: Account[]): Promise<ReviewFiles> {
  const dir = mkdtempSync(join(tmpdir(), 'finanzapp-assistant-'));
  const ledgerPath = join(dir, 'ledger.sqlite'), reviewPath = join(dir, 'review.sqlite');
  const opened: TransactionConnection[] = [];
  const open = (path: string) => { const base = connection(path); opened.push(base); return base; };
  const ledger: LedgerDatabase = { ...open(ledgerPath), withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(ledgerPath), work),
    withMigrationTransactionAsync: work => runSchemaMigration(async () => connection(ledgerPath), work) };
  await initializeDatabase(ledger);
  for (const account of accounts) await createAccount(ledger, account);
  const reviewAt = (): ReviewDatabase => ({ ...open(reviewPath), withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(reviewPath), work) });
  const review = reviewAt();
  let store = await openReviewStore(review, ledger);
  return {
    ledger, review, get store() { return store; },
    reopen: async () => (store = await openReviewStore(reviewAt(), ledger)),
    tray: (at = new Date().toISOString()) => loadReviewTray(store, at),
    entries: async () => (await readArchive(ledger)).records.map(record => record.entry.id).sort(),
    dispose: async () => { for (const item of opened.splice(0)) await item.closeAsync(); rmSync(dir, { recursive: true, force: true }); },
  };
}
