import { openDatabaseAsync } from 'expo-sqlite';
import { DATABASE_NAME, type LedgerDatabase } from './database';
import { runExclusiveTransaction, runSchemaMigration } from './transaction';

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
