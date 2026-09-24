import { accountKind, cardAvailableLimitMinor, cardCycle, cardDebtMinor, labelFromISO, type Account, type CreditCardProfile,
  type Currency, type LedgerSnapshot, type PersonalDebtProfile } from '@finanzapp/domain';
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

export function dueLabel(dateISO: string, todayISO: string): string {
  const relative = labelFromISO(dateISO, new Date(todayISO + 'T12:00:00'));
  return relative;
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

export function currencyName(currency: Currency): string {
  return currency === 'USD' ? 'Dólares estadounidenses' : 'Pesos argentinos';
}

/** One line of statement facts under the activity title, instead of two cards. */
export function statementCaption(statement: { startISO: string; purchaseCount: number; paymentCount: number }, relative: (iso: string) => string): string {
  return [`Resumen abierto desde ${relative(statement.startISO)}`, statement.purchaseCount === 1 ? '1 compra' : statement.purchaseCount + ' compras',
    statement.paymentCount === 1 ? '1 pago' : statement.paymentCount + ' pagos'].join(' · ');
}
