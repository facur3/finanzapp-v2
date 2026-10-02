import { accountKind, cardAvailableLimitMinor, cardCommittedFinancingMinor, cardCommittedMinor, cardCreditMinor, cardCycleDatesOf, cardCycleView, cardDebtMinor, installmentPlanFigures, pendingInstallmentPlans,
  type Account, type AccountAppearance, type CardCycleDates, type CardStatement, type CreditCardProfile, type InstallmentPlan, type LedgerSnapshot, type PersonalDebtProfile,
  type PurchaseOperation, type RecordedEntry, isLiveAccount } from '@finanzapp/domain';
import { formatDate, relativeDate } from '../i18n/format.ts';
import { DEFAULT_LOCALE, type AppLocale } from '../i18n/locale.ts';
import { translator, type Translate } from '../i18n/messages.ts';

/** How the available credit of a card reads (24T2): no limit set; a known figure; or unknown because a plan is pending
 * and how the issuer reserves credit for instalments is not assumed (decision 003, rule 7): «No calculado con cuotas»,
 * never zero and never an invented figure. */
export type CardAvailability = 'noLimit' | 'known' | 'unknownWithPlans';

export type CardSummary = {
  /** Same as card.id; lets lists key items. */
  id: string;
  card: CreditCardProfile;
  account: Account;
  /** «Saldo pendiente»: the whole recorded card liability (purchases and recognised instalments minus payments). Not a
   * statement amount: FinanzApp does not know what the bank billed. */
  debtMinor: number;
  /** Balance in the holder's favour (overpayment or a refund). */
  creditMinor: number;
  availableMinor: number | null;
  availability: CardAvailability;
  /** Share of the limit used, 0–1 (or above 1 when over the limit). Null without a limit or while the available credit is unknown. */
  usage: number | null;
  /** The open statement: its closing (today at the earliest: on its closing day it is still open), its own due date, and
   * the day it began. */
  closingISO: string;
  openDueISO: string;
  openStartISO: string;
  /** The next due date (today or later): the statement closed last when its due is still ahead, else the open one. */
  nextDueISO: string;
  /** The closing of the statement `nextDueISO` belongs to. */
  nextDueOfISO: string;
  /** The closed statement still due, if any (its due may be corrected in the card form). */
  toPay: CardStatement | null;
  previousClosingISO: string;
  /** Future committed principal of the card's live plans (cuotas futuras): beside the balance, never inside it. Null
   * when the sum leaves the exact range (plans with amounts near the ledger's bound): the screens say «Total fuera de
   * rango» instead of a rounded figure, and still open (each plan stays valid and readable on its own). */
  committedMinor: number | null;
  /** The future financing of those plans (interest, and fee or tax in older plans): named beside the principal («+ interés
   * $ …»), never added into it, so «Cuotas futuras» never disagrees with the instalments a plan lists. Null out of range. */
  committedFinancingMinor: number | null;
  /** How that financing is named: interest only, or a mix with fees or taxes. */
  financingKind: 'interest' | 'financing';
  /** Plans with a share not yet recognised. */
  pendingPlans: InstallmentPlan[];
  /** How many of them still have principal to come: the plans `committedMinor` adds up («en 2 planes»). */
  futurePlanCount: number;
};

/** Everything Tarjetas needs for one card, computed once from the snapshot, the plans and the card's exact cycle dates. */
export function summarizeCard(card: CreditCardProfile, snapshot: LedgerSnapshot, todayISO: string, plansInput: readonly InstallmentPlan[] | undefined,
  recordsInput: readonly RecordedEntry[] | undefined, operationsInput: readonly PurchaseOperation[] | undefined, cycleDates: readonly CardCycleDates[] = []): CardSummary | null {
  // 24T3 (A3): the operations are a required argument (an archive before 24T3 passes none: `archive?.purchaseOperations`), so
  // every caller says which devoluciones and adelantos it read; undefined reads as none.
  const plans = plansInput ?? [], records = recordsInput ?? [], operations = operationsInput ?? [];
  const account = snapshot.accounts.find(item => item.id === card.accountId);
  if (!account) return null;
  const debtMinor = cardDebtMinor(card, snapshot);
  const availableMinor = cardAvailableLimitMinor(card, snapshot, plans, records, operations);
  const availability: CardAvailability = card.creditLimitMinor === null ? 'noLimit' : availableMinor === null ? 'unknownWithPlans' : 'known';
  const view = cardCycleView(card, cardCycleDatesOf(card.id, cycleDates), todayISO);
  const pendingPlans = pendingInstallmentPlans(card, plans, records, operations);
  // Sums over every live plan of the card: exact, or null when they leave the safe range (never a throw while rendering).
  const exactly = (sum: () => number) => { try { return sum(); } catch { return null; } };
  return { id: card.id, card, account, debtMinor, creditMinor: cardCreditMinor(card, snapshot), availableMinor, availability,
    usage: availability === 'known' && card.creditLimitMinor ? debtMinor / card.creditLimitMinor : null,
    closingISO: view.open.closingISO, openDueISO: view.open.dueISO, openStartISO: view.openStartISO,
    nextDueISO: view.nextDue.dueISO, nextDueOfISO: view.nextDue.closingISO, toPay: view.toPay, previousClosingISO: view.previous.closingISO,
    committedMinor: exactly(() => cardCommittedMinor(card, plans, records, operations)),
    committedFinancingMinor: exactly(() => cardCommittedFinancingMinor(card, plans, records, operations)),
    financingKind: pendingPlans.some(plan => plan.feeMinor + plan.taxMinor > 0) ? 'financing' : 'interest', pendingPlans,
    futurePlanCount: pendingPlans.filter(plan => installmentPlanFigures(plan, records, operations).scheduledMinor > 0).length };
}

/** The cards Tarjetas shows in its deck, in their stored order (active first, then by creation). */
export function activeCards(cards: CreditCardProfile[] | undefined, snapshot: LedgerSnapshot, todayISO: string, plans: readonly InstallmentPlan[] | undefined,
  records: readonly RecordedEntry[] | undefined, operations: readonly PurchaseOperation[] | undefined, cycleDates: readonly CardCycleDates[] = []): CardSummary[] {
  return (cards ?? []).filter(card => card.active)
    .map(card => summarizeCard(card, snapshot, todayISO, plans, records, operations, cycleDates))
    .filter((summary): summary is CardSummary => summary !== null);
}

/** 24T2: archived cards (not deleted) stay reachable from Tarjetas, under Archivadas: their plans keep being recognised
 * and they still take payments. */
export function archivedCards(cards: CreditCardProfile[] | undefined, snapshot: LedgerSnapshot, todayISO: string, plans: readonly InstallmentPlan[] | undefined,
  records: readonly RecordedEntry[] | undefined, operations: readonly PurchaseOperation[] | undefined, cycleDates: readonly CardCycleDates[] = []): CardSummary[] {
  return (cards ?? []).filter(card => !card.active && !card.deleted)
    .map(card => summarizeCard(card, snapshot, todayISO, plans, records, operations, cycleDates))
    .filter((summary): summary is CardSummary => summary !== null);
}

/** 24T2: the colour a card's face takes: the one chosen for its hidden account in Editar cuenta, or null when none was
 * chosen (the face keeps its hash tone). `accountLook` cannot tell «never chose» from «chose cobalt», so the row itself
 * is read. */
export function cardFaceColor(card: Pick<CreditCardProfile, 'accountId'>, appearances: readonly AccountAppearance[] = []): string | null {
  return appearances.find(item => item.accountId === card.accountId)?.color ?? null;
}

/** 24T2: a face prints its currency code only when the person holds cards in more than one currency: the live cards
 * (active or archived; a deleted card shown in its own detail, `keepId`, counts too). */
export function cardCurrenciesDiffer(cards: readonly CreditCardProfile[] = [], accounts: readonly Account[] = [], keepId?: string): boolean {
  const currencies = new Set<string>();
  for (const card of cards) {
    if (card.deleted && card.id !== keepId) continue;
    const account = accounts.find(item => item.id === card.accountId);
    if (account) currencies.add(account.currency);
  }
  return currencies.size > 1;
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

/** 24UX6E: where a personal debt stands, one rule for its row and its detail. Closed first (a closed debt is never
 * shown as due or overdue, whatever its date says); then settled (nothing outstanding); then no date; then overdue;
 * then «soon»: three days away or less, the window CardFacts uses for a card's «Vence», and only for a debt I owe (what
 * someone owes me is not something I must act on in time); otherwise simply due. Colour follows the state: overdue in
 * the alert tone (both directions), soon in amber, every other state calm. */
export type DebtDueState = 'closed' | 'settled' | 'none' | 'overdue' | 'soon' | 'due';
export function debtDueState(debt: Pick<PersonalDebtProfile, 'active' | 'direction' | 'dueDateISO'>, outstandingMinor: number, todayISO: string): DebtDueState {
  if (!debt.active) return 'closed';
  if (outstandingMinor === 0) return 'settled';
  if (!debt.dueDateISO) return 'none';
  const days = daysUntil(debt.dueDateISO, todayISO);
  if (days < 0) return 'overdue';
  return days <= 3 && debt.direction === 'owed_by_me' ? 'soon' : 'due';
}

/** 24UX6E: a due day as VoiceOver reads it, the CardFacts pattern: a relative word stays as it is («hoy», «Ayer»); a
 * plain day is written out («1 de octubre de 2026», "October 1, 2026"), never the abbreviated «1 oct». `inline` as in
 * `relativeDate` (the day inside a sentence). */
export function spokenDueDay(dateISO: string, todayISO: string, locale: AppLocale = DEFAULT_LOCALE, inline = false): string {
  const shown = relativeDate(dateISO, todayISO, locale, inline);
  return shown === formatDate(dateISO, 'day', locale) || shown === formatDate(dateISO, 'dayYear', locale) ? formatDate(dateISO, 'long', locale) : shown;
}

/** Accounts a spending/income form may post to: cash accounts and cards, never a personal debt. */
export function postingAccounts(accounts: Account[], debts: PersonalDebtProfile[] = [], keepId?: string): Account[] {
  const excluded = new Set(debts.map(debt => debt.accountId));
  // 25B2: a deleted account is history, never a choice for a new movement or rule; the one a stored movement or rule
  // already sits on (`keepId`) stays listed while it is edited, so the correction happens in place.
  return accounts.filter(account => !excluded.has(account.id) && (isLiveAccount(account) || account.id === keepId));
}

/** Accounts that hold liquid money: no cards, debts or receivables. */
export function cashAccounts(accounts: Account[], cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): Account[] {
  return accounts.filter(account => accountKind(account.id, cards, debts) === 'cash');
}

export function accountKindLabel(account: Account, cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = [], t: Translate = translator('es')): string {
  const kind = accountKind(account.id, cards, debts);
  return t(kind === 'card' ? 'accountKinds.creditCard' : kind === 'debt' ? 'accountKinds.debt' : 'accountKinds.account');
}

/** The open cycle's activity in one caption line under Recientes and Movimientos («Este ciclo»: what the ledger holds
 * since the previous closing, never a statement amount). `relative` names the start day inside the sentence, so it takes
 * the inline form (`relativeDate(…, true)`): "Este ciclo, desde ayer", "This cycle, since yesterday". */
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
