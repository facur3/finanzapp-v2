import { openDatabaseAsync } from 'expo-sqlite';
import { DATABASE_NAME, type LedgerDatabase } from './database';
import { runExclusiveTransaction } from './transaction';

export async function openLedgerDatabase(): Promise<LedgerDatabase> {
  const connection = await openDatabaseAsync(DATABASE_NAME);
  return {
    execAsync: sql => connection.execAsync(sql),
    runAsync: (sql, ...params) => connection.runAsync(sql, ...params),
    getFirstAsync: (sql, ...params) => connection.getFirstAsync(sql, ...params),
    getAllAsync: (sql, ...params) => connection.getAllAsync(sql, ...params),
    withExclusiveTransactionAsync: work => runExclusiveTransaction(
      () => openDatabaseAsync(DATABASE_NAME, { useNewConnection: true }), work,
    ),
  };
}
