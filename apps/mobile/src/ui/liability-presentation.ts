import { accountKind, cardAvailableLimitMinor, cardCycle, cardDebtMinor, type Account, type CreditCardProfile,
  type LedgerSnapshot, type PersonalDebtProfile } from '@finanzapp/domain';
import { relativeDate } from '../i18n/format.ts';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n/locale.ts';
import { translator, type Translate } from '../i18n/messages.ts';

export type CardSummary = {
  /** Same as card.id; lets the carousel key items. */
  id: string;
  card: CreditCardProfile;
  account: Account;
  debtMinor: number;
  availableMinor: number | null;
  /** Share of the limit already used, 0–1 (or above 1 when over the limit). Null without a limit. */
  usage: number | null;
  closingISO: string;
  dueISO: string;
};

/** Everything the Cards tab needs for one card, computed once from the snapshot. */
export function summarizeCard(card: CreditCardProfile, snapshot: LedgerSnapshot, todayISO: string): CardSummary | null {
  const account = snapshot.accounts.find(item => item.id === card.accountId);
  if (!account) return null;
  const debtMinor = cardDebtMinor(card, snapshot);
  const availableMinor = cardAvailableLimitMinor(card, snapshot);
  const cycle = cardCycle(card, todayISO);
  return { id: card.id, card, account, debtMinor, availableMinor,
    usage: card.creditLimitMinor ? debtMinor / card.creditLimitMinor : null,
    closingISO: cycle.closingISO, dueISO: cycle.dueISO };
}

export function activeCards(cards: CreditCardProfile[] | undefined, snapshot: LedgerSnapshot, todayISO: string): CardSummary[] {
  return (cards ?? []).filter(card => card.active)
    .map(card => summarizeCard(card, snapshot, todayISO))
    .filter((summary): summary is CardSummary => summary !== null);
}

export function usageTone(usage: number | null): 'neutral' | 'warning' | 'expense' {
  if (usage === null) return 'neutral';
  if (usage > 1) return 'expense';
  if (usage >= 0.85) return 'warning';
  return 'neutral';
}

export function dueLabel(dateISO: string, todayISO: string, locale: AppLocale = DEFAULT_LOCALE): string {
  return relativeDate(dateISO, todayISO, locale);
}

export function daysUntil(dateISO: string, todayISO: string): number {
  return Math.round((Date.parse(dateISO + 'T12:00:00Z') - Date.parse(todayISO + 'T12:00:00Z')) / 86400000);
}

/** Accounts a spending/income form may post to: cash accounts and cards, never a personal debt. */
export function postingAccounts(accounts: Account[], debts: PersonalDebtProfile[] = []): Account[] {
  const excluded = new Set(debts.map(debt => debt.accountId));
  return accounts.filter(account => !excluded.has(account.id));
}

/** Accounts that hold liquid money: no cards, debts or receivables. */
export function cashAccounts(accounts: Account[], cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): Account[] {
  return accounts.filter(account => accountKind(account.id, cards, debts) === 'cash');
}

export function accountKindLabel(account: Account, cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = [], t: Translate = translator('es')): string {
  const kind = accountKind(account.id, cards, debts);
  return t(kind === 'card' ? 'accountKinds.creditCard' : kind === 'debt' ? 'accountKinds.debt' : 'accountKinds.account');
}

/** One line of statement facts under the activity title, instead of two cards. */
export function statementCaption(statement: { startISO: string; purchaseCount: number; paymentCount: number }, relative: (iso: string) => string,
  t: Translate = translator('es')): string {
  return [t('cards.statement.openSince', { date: relative(statement.startISO) }), t('cards.statement.purchases', { count: statement.purchaseCount }),
    t('cards.statement.payments', { count: statement.paymentCount })].join(' · ');
}

/** The name an account shows where it appears as one side of a transfer. A personal debt is stored as a
 * hidden account named "Debo · Juan" / "Me deben · Juan" when it is created (and not renamed afterwards).
 * The stored name is shown as it is, except that its Spanish prefix is read in the interface language
 * ("I owe · Juan"); a name without that prefix (an older backup) and every other account show their own name. */
export function accountDisplayName(account: Account, debts: PersonalDebtProfile[] = [], t: Translate = translator('es')): string {
  const debt = debts.find(item => item.accountId === account.id);
  if (!debt) return account.name;
  const key = debt.direction === 'owed_by_me' ? 'debts.accountName.owedByMe' : 'debts.accountName.owedToMe';
  const prefix = translator('es')(key, { name: '' });
  return account.name.startsWith(prefix) ? t(key, { name: account.name.slice(prefix.length) }) : account.name;
}
