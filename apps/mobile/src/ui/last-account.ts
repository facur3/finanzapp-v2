/** Producto 25N1: the account a new Gasto or Ingreso opens on is the one the person last saved one of that kind with, so
 * a person who spends on a card created after their cash account does not change «Pagado con» on every entry. One key per
 * kind (an income's account is rarely an expense's). A device preference like the language, the region and the display
 * currency: it lives in the key-value store, outside the ledger and outside backups, and never changes a movement. It is
 * only a preselection: the form still shows it and the person may choose another. A remembered account the form does not
 * offer now (deleted, an archived card, not a place for that kind, another currency than a prefilled amount's) is ignored
 * and today's rule applies (the requested account, else the first in the screen's currency, else the first). Pure. */
import type { Account, EntryKind } from '@finanzapp/domain';
import { defaultPreferenceStore, type PreferenceStore } from '../i18n/preference.ts';

export const LAST_ACCOUNT_KEYS: Readonly<Record<EntryKind, string>> = { expense: 'finanzapp.lastAccount.expense', income: 'finanzapp.lastAccount.income' };

/** The remembered account of `kind` when `offered` holds it; otherwise undefined. An unreadable store remembers nothing. */
export function readLastAccount(kind: EntryKind, offered: readonly Account[], store: () => PreferenceStore = defaultPreferenceStore): string | undefined {
  try {
    const id = store().getItemSync(LAST_ACCOUNT_KEYS[kind]);
    return offered.some(account => account.id === id) ? id ?? undefined : undefined;
  } catch { return undefined; }
}

/** Best effort, after the movement is saved: a refused write only means the next form opens by today's rule. */
export function writeLastAccount(kind: EntryKind, accountId: string, store: () => PreferenceStore = defaultPreferenceStore): void {
  try { store().setItemSync(LAST_ACCOUNT_KEYS[kind], accountId); } catch { /* the next form falls back to today's rule */ }
}
