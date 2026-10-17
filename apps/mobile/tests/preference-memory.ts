import * as lastAccount from '../src/ui/last-account.ts';
import type { PreferenceStore } from '../src/i18n/preference.ts';

/** 25N1: the real last-account preference over an in-memory key-value store (`memory` is read and written in place), for
 * the harnesses that load the movement form. */
export function memoryOf(memory: Record<string, string>) {
  const store = (): PreferenceStore => ({ getItemSync: key => memory[key] ?? null, setItemSync: (key, value) => { memory[key] = value; },
    removeItemSync: key => delete memory[key] });
  return {
    readLastAccount: (kind: 'expense' | 'income', offered: Parameters<typeof lastAccount.readLastAccount>[1]) => lastAccount.readLastAccount(kind, offered, store),
    writeLastAccount: (kind: 'expense' | 'income', accountId: string) => lastAccount.writeLastAccount(kind, accountId, store),
  };
}
