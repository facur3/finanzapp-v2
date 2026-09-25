import { openDatabaseAsync } from 'expo-sqlite';
import { DATABASE_NAME, type LedgerDatabase } from './database';
import { runExclusiveTransaction, runSchemaMigration } from './transaction';
import { RATES_DATABASE_NAME, type RatesDatabase } from './rates-database';

export async function openLedgerDatabase(): Promise<LedgerDatabase> {
  const connection = await openDatabaseAsync(DATABASE_NAME);
  const open = () => openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
  return {
    execAsync: sql => connection.execAsync(sql),
    runAsync: (sql, ...params) => connection.runAsync(sql, ...params),
    getFirstAsync: (sql, ...params) => connection.getFirstAsync(sql, ...params),
    getAllAsync: (sql, ...params) => connection.getAllAsync(sql, ...params),
    withExclusiveTransactionAsync: work => runExclusiveTransaction(open, work),
    withMigrationTransactionAsync: work => runSchemaMigration(open, work),
  };
}

/** The exchange-rate cache (24C1): its own file, apart from the ledger (rates-database.ts). */
export async function openRatesDatabase(): Promise<RatesDatabase> {
  const connection = await openDatabaseAsync(RATES_DATABASE_NAME);
  const open = () => openDatabaseAsync(RATES_DATABASE_NAME, { useNewConnection: true });
  return {
    execAsync: sql => connection.execAsync(sql),
    runAsync: (sql, ...params) => connection.runAsync(sql, ...params),
    getFirstAsync: (sql, ...params) => connection.getFirstAsync(sql, ...params),
    getAllAsync: (sql, ...params) => connection.getAllAsync(sql, ...params),
    withExclusiveTransactionAsync: work => runExclusiveTransaction(open, work),
  };
}
