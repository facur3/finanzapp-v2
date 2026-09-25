/** The exchange-rate cache (Producto 24C1): reference rates downloaded from the provider,
 * each with its source, publication day and download time, plus which calendar months were
 * already asked for which currencies, so a month is never requested twice once it is final.
 *
 * It is its own SQLite file, apart from the ledger: rates are reference data anyone can
 * download again, not the person's records. The ledger's schema (10), its backups and its
 * migrations are untouched, and restoring a backup never brings or drops a rate. Nothing in
 * this file is ever reset or deleted on an error: a cache that cannot be opened or written
 * leaves the app with the rates it has in memory, and a newer cache (a later build) is read
 * and never written.
 *
 * A rate fetched on or before its own publication day may still change (the provider blends
 * the central banks that published by then), so a later download replaces it; one fetched
 * after its day is final and never rewritten, so a past month's report stays reproducible. */
import type { Currency, ExchangeRate } from '@finanzapp/domain';
import type { SqlExecutor } from './database.ts';

export const RATES_DATABASE_NAME = 'finanzapp-rates-v1.sqlite';
export const RATES_DATABASE_VERSION = 1;

export interface RatesDatabase extends SqlExecutor {
  withExclusiveTransactionAsync(task: (tx: SqlExecutor) => Promise<void>): Promise<void>;
}

/** A month the app asked the provider about, for one quote: through which day, and when. */
export interface RateCoverage { quote: Currency; monthISO: string; throughISO: string; fetchedAt: string }

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS exchange_rates (
    base TEXT NOT NULL CHECK(base = 'USD'),
    quote TEXT NOT NULL CHECK(length(quote) = 3 AND quote <> base),
    effectiveDate TEXT NOT NULL CHECK(effectiveDate GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    rate TEXT NOT NULL CHECK(length(rate) BETWEEN 1 AND 32),
    source TEXT NOT NULL CHECK(length(source) BETWEEN 1 AND 80),
    fetchedAt TEXT NOT NULL,
    PRIMARY KEY (base, quote, effectiveDate)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS rate_coverage (
    base TEXT NOT NULL CHECK(base = 'USD'),
    quote TEXT NOT NULL CHECK(length(quote) = 3),
    monthISO TEXT NOT NULL CHECK(monthISO GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    throughISO TEXT NOT NULL,
    fetchedAt TEXT NOT NULL,
    PRIMARY KEY (base, quote, monthISO)
  ) STRICT;
`;

/** Creates the tables on a new file; refuses (without touching anything) a file from a newer build. Returns whether writes are allowed. */
export async function initializeRatesDatabase(db: RatesDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version > RATES_DATABASE_VERSION) return false;
  if (version < RATES_DATABASE_VERSION) {
    await db.withExclusiveTransactionAsync(async tx => { await tx.execAsync(SCHEMA + `PRAGMA user_version = ${RATES_DATABASE_VERSION};`); });
  }
  return true;
}

export async function readRates(db: SqlExecutor): Promise<{ rates: ExchangeRate[]; coverage: RateCoverage[] }> {
  const rates = await db.getAllAsync<ExchangeRate>('SELECT base, quote, rate, effectiveDate, source, fetchedAt FROM exchange_rates ORDER BY quote, effectiveDate');
  const coverage = await db.getAllAsync<RateCoverage>('SELECT quote, monthISO, throughISO, fetchedAt FROM rate_coverage ORDER BY quote, monthISO');
  return { rates: rates.map(row => ({ ...row })), coverage: coverage.map(row => ({ ...row })) };
}

/** Stores one download in a single transaction: its rates and the months it covered. */
export async function saveRates(db: RatesDatabase, rates: readonly ExchangeRate[], coverage: readonly RateCoverage[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async tx => {
    for (const rate of rates) {
      await tx.runAsync(`INSERT INTO exchange_rates (base, quote, effectiveDate, rate, source, fetchedAt) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(base, quote, effectiveDate) DO UPDATE SET rate = excluded.rate, source = excluded.source, fetchedAt = excluded.fetchedAt
        WHERE substr(exchange_rates.fetchedAt, 1, 10) <= exchange_rates.effectiveDate`,
      rate.base, rate.quote, rate.effectiveDate, rate.rate, rate.source, rate.fetchedAt);
    }
    for (const item of coverage) {
      await tx.runAsync(`INSERT INTO rate_coverage (base, quote, monthISO, throughISO, fetchedAt) VALUES ('USD', ?, ?, ?, ?)
        ON CONFLICT(base, quote, monthISO) DO UPDATE SET throughISO = excluded.throughISO, fetchedAt = excluded.fetchedAt`,
      item.quote, item.monthISO, item.throughISO, item.fetchedAt);
    }
  });
}
