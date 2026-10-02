import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Account } from './ledger';
import type { CreditCardProfile, PersonalDebtProfile } from './liabilities';
import { newCategoryDefinition, type CategoryDefinition } from './categories';
import { MAX_ENTRY_MINOR } from './money';
import { cardCycleView, planCardCycle } from './card-cycles';
import { newInstallmentPlan, validateInstallmentPlan } from './installments';
import { initialRecord } from './recovery';
import { REVIEW_DESTINATION_MESSAGE, REVIEW_DRAFT_INVALID_MESSAGE, REVIEW_GAPS, REVIEW_INCOMPLETE_MESSAGE, REVIEW_STALE_MESSAGE, REVIEW_WRITE_ID,
  REVIEW_WRITE_ID_MESSAGE, isStaleReviewDraft, parseReviewDraft, reviewBasis, reviewDestinations, reviewGaps, withDestination, writeForReviewDraft,
  type ReviewArchive, type ReviewDraft } from './review-drafts';

const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-09-28T10:00:00.000Z';
const today = '2026-09-28';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const dollars: Account = { id: 'dollars', name: 'Ahorro', currency: 'USD', openingMinor: 0, createdAt };
const yen: Account = { id: 'yen', name: 'Viaje', currency: 'JPY', openingMinor: 0, createdAt };
const closed: Account = { id: 'closed', name: 'Vieja', currency: 'ARS', openingMinor: 0, createdAt, revision: 1, updatedAt: now, deletedAt: now };
const cardAccount: Account = { id: 'visa-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const shelvedAccount: Account = { id: 'amex-acc', name: 'Amex', currency: 'ARS', openingMinor: 0, createdAt };
const goneAccount: Account = { id: 'master-acc', name: 'Master', currency: 'ARS', openingMinor: 0, createdAt };
const debtAccount: Account = { id: 'debt-acc', name: 'Debo · Juan', currency: 'ARS', openingMinor: -30000, createdAt };
const card: CreditCardProfile = { id: 'visa', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 500000,
  closingDay: 20, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const shelved: CreditCardProfile = { ...card, id: 'amex', accountId: shelvedAccount.id, active: false, revision: 1, updatedAt: now };
const gone: CreditCardProfile = { ...card, id: 'master', accountId: goneAccount.id, active: false, deleted: true, revision: 1, updatedAt: now };
const debt: PersonalDebtProfile = { id: 'debt', accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Juan',
  dueDateISO: null, note: '', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const kiosco: CategoryDefinition = { ...newCategoryDefinition('expense', 'Kiosco', 'cafe', 'ochre', createdAt), revision: 2, updatedAt: now };
const retired: CategoryDefinition = { ...newCategoryDefinition('expense', 'Cigarrillos', 'other', 'slate', createdAt), archived: true, revision: 1, updatedAt: now };
const archive: ReviewArchive = {
  accounts: [bank, dollars, yen, closed, cardAccount, shelvedAccount, goneAccount, debtAccount],
  records: [initialRecord({ id: 'old', accountId: bank.id, kind: 'expense', amountMinor: 500, merchant: 'Feria', category: 'Verdulería', dateISO: '2026-09-02', createdAt })],
  cards: [card, shelved, gone], debts: [debt], categories: [kiosco, retired], installmentPlans: [], cardCycleDates: [],
};

/** A complete cash expense, reviewed against the current archive. */
const cash: ReviewDraft = { version: 1, source: 'assistant', capturedAt: now, kind: 'expense', amountMinor: 1500000, currency: 'ARS',
  merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-27', destinationId: bank.id, purchase: null, basis: [{ kind: 'account', id: bank.id, revision: 0 }] };
const blank: ReviewDraft = { version: 1, source: 'wallet', capturedAt: now, kind: null, amountMinor: null, currency: null, merchant: null,
  category: null, dateISO: null, destinationId: null, purchase: null, basis: [] };
const onCard = (purchase: ReviewDraft['purchase']): ReviewDraft => ({ ...cash, destinationId: cardAccount.id, purchase,
  basis: [{ kind: 'account', id: cardAccount.id, revision: 0 }, { kind: 'card', id: card.id, revision: 0 }] });
const write = (draft: ReviewDraft, writeId = 'w-1', base: ReviewArchive = archive) => writeForReviewDraft(draft, base, { writeId, createdAt: now, todayISO: today });
const refused = (value: unknown) => expect(() => parseReviewDraft(value)).toThrow(REVIEW_DRAFT_INVALID_MESSAGE);
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};

describe('parseReviewDraft: strict, untrusted input', () => {
  it('returns a fresh, equal copy of a valid draft, complete or blank', () => {
    const parsed = parseReviewDraft(cash);
    expect(parsed).toEqual(cash);
    expect(parsed).not.toBe(cash);
    expect(parsed.basis).not.toBe(cash.basis);
    expect(parseReviewDraft(blank)).toEqual(blank);
    expect(parseReviewDraft(JSON.parse(JSON.stringify(onCard({ mode: 'installments', count: null, placement: 'next' }))))).toEqual(onCard({ mode: 'installments', count: null, placement: 'next' }));
  });
  it('refuses a missing, unknown or hidden key and anything that is not a plain object', () => {
    const { merchant, ...missing } = cash;
    expect(merchant).toBe('Coto');
    refused(missing);
    refused({ ...cash, accountName: 'Banco' });
    refused({ ...cash, [Symbol('x')]: 1 });
    refused(JSON.parse(JSON.stringify(cash).replace('{', '{"__proto__":{"admin":true},')));
    refused(Object.assign(Object.create({ inherited: true }), cash));
    refused([cash]);
    for (const value of [null, undefined, 'draft', 42, true]) refused(value);
  });
  it('refuses an unknown version, source or kind', () => {
    refused({ ...cash, version: 2 });
    refused({ ...cash, version: '1' });
    refused({ ...cash, source: 'bank' });
    refused({ ...cash, kind: 'transfer' });
    refused({ ...cash, kind: 'refund' });
    refused({ ...cash, kind: 'Expense' });
  });
  it('takes only a positive safe integer of minor units within the entry range, never a float, a string or zero', () => {
    for (const amountMinor of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1500', 2 ** 53, MAX_ENTRY_MINOR + 1]) refused({ ...cash, amountMinor });
    expect(parseReviewDraft({ ...cash, amountMinor: MAX_ENTRY_MINOR }).amountMinor).toBe(MAX_ENTRY_MINOR);
  });
  it('takes any storable ISO currency (not only ARS and USD), never a fund, a metal, a test code or a lowercase code', () => {
    for (const currency of ['EUR', 'JPY', 'KWD', 'BRL']) expect(parseReviewDraft({ ...cash, currency }).currency).toBe(currency);
    for (const currency of ['XAU', 'XTS', 'XXX', 'ars', 'PESOS', '', 1]) refused({ ...cash, currency });
  });
  it('refuses a malformed movement date or capture timestamp', () => {
    for (const dateISO of ['2026-02-30', '2026-9-27', '27/09/2026', '1899-12-31', 20260927]) refused({ ...cash, dateISO });
    for (const capturedAt of ['2026-02-30T10:00:00Z', '2026-09-27 10:00:00', '2026-09-27T10:00:00+03:00', '2026-09-27T24:00:00Z', 'ayer', null]) refused({ ...cash, capturedAt });
  });
  it('refuses a padded, empty, oversized or hidden-character name; never trims one', () => {
    for (const merchant of ['', ' Coto', 'Coto ', 'Co\u202eto', 'Co\u200bto', 'Co\nto', 'x'.repeat(121), 42]) refused({ ...cash, merchant });
    for (const category of ['', ' Comida', 'x'.repeat(61), 'Com\u2066ida']) refused({ ...cash, category });
    expect(parseReviewDraft({ ...cash, merchant: 'x'.repeat(120), category: 'x'.repeat(60) }).merchant).toHaveLength(120);
    // Review (25A-01): joiners, directional marks and emoji sequences are ordinary text in a person's names.
    for (const text of ['Caf\u00e9 \u{1F468}\u200D\u{1F469}\u200D\u{1F467}', '\u05e9\u05d5\u05e7 \u200f2', '\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645', 'Kiosco \u2764\ufe0f']) {
      expect(parseReviewDraft({ ...cash, merchant: text, category: text }).merchant, text).toBe(text);
    }
  });
  it('takes a destination only as an account id', () => {
    for (const destinationId of ['', 'Banco Galicia', 'bank;drop', 'x'.repeat(101), 7]) refused({ ...cash, destinationId });
  });
  it('refuses a malformed purchase, and any purchase on an income', () => {
    for (const purchase of [{}, { mode: 'cuotas' }, { mode: 'once', count: 1 }, { mode: 'installments', count: 0, placement: 'current' }, { mode: 'installments', count: 1, placement: 'current' },
      { mode: 'installments', count: 121, placement: 'current' }, { mode: 'installments', count: 2.5, placement: 'current' },
      { mode: 'installments', count: 3 }, { mode: 'installments', count: 3, placement: 'later' }, { mode: 'installments', count: '3', placement: 'next' }, 'once']) {
      refused({ ...cash, purchase });
    }
    refused({ ...cash, kind: 'income', purchase: { mode: 'once' } });
    expect(parseReviewDraft({ ...cash, kind: null, purchase: { mode: 'once' } }).purchase).toEqual({ mode: 'once' });
  });
  it('refuses a malformed, repeated, oversized or sparse basis', () => {
    for (const basis of [null, {}, [{ kind: 'entry', id: 'old', revision: 0 }], [{ kind: 'account', id: 'bank', revision: -1 }],
      [{ kind: 'account', id: 'bank', revision: 0, extra: 1 }], [{ kind: 'account', id: 'bank' }],
      [{ kind: 'category', entryKind: 'expense', key: 'Kiosco', revision: 0 }], [{ kind: 'category', entryKind: 'gift', key: 'kiosco', revision: 0 }],
      [{ kind: 'account', id: 'bank', revision: 0 }, { kind: 'account', id: 'bank', revision: 1 }],
      Array.from({ length: 17 }, (_, index) => ({ kind: 'account', id: 'a' + index, revision: 0 })),
      [{ kind: 'account', id: 'bank', revision: 0 }, , { kind: 'card', id: 'visa', revision: 0 }]]) {
      refused({ ...cash, basis });
    }
    expect(parseReviewDraft({ ...cash, basis: [{ kind: 'category', entryKind: 'expense', key: 'kiosco', revision: 2 }] }).basis).toHaveLength(1);
  });
  it('the parsed draft carries nothing a producer did not supply: no default currency, count, date or destination', () => {
    const parsed = parseReviewDraft({ ...blank, kind: 'expense', amountMinor: 3000, purchase: { mode: 'installments', count: null, placement: 'current' } });
    expect([parsed.currency, parsed.dateISO, parsed.destinationId, parsed.merchant, parsed.category]).toEqual([null, null, null, null, null]);
    expect(parsed.purchase).toEqual({ mode: 'installments', count: null, placement: 'current' });
  });
});

describe('reviewDestinations', () => {
  it('an expense may go to a live cash account or an active card; never a debt, a deleted account, an archived or a deleted card', () => {
    expect(reviewDestinations('expense', archive).map(account => account.id)).toEqual([bank.id, dollars.id, yen.id, cardAccount.id]);
  });
  it('an income only to a live cash account: never a card', () => {
    expect(reviewDestinations('income', archive).map(account => account.id)).toEqual([bank.id, dollars.id, yen.id]);
  });
});

describe('reviewGaps', () => {
  it('a complete, valid draft has none', () => {
    expect(reviewGaps(cash, archive, today)).toEqual([]);
    expect(reviewGaps({ ...cash, dateISO: today }, archive, today)).toEqual([]);
  });
  it('a blank draft names every missing field, in order', () => {
    expect(reviewGaps(blank, archive, today)).toEqual(['kind', 'amount', 'currency', 'destination', 'merchant', 'category', 'date']);
    expect(REVIEW_GAPS.slice(0, 4)).toEqual(['kind', 'amount', 'currency', 'destination']);
  });
  it('a missing currency stays a gap even once the destination is known: never the account\'s or the person\'s default', () => {
    expect(reviewGaps({ ...cash, currency: null }, archive, today)).toEqual(['currency']);
  });
  it('a currency other than the destination\'s is a gap: nothing is converted', () => {
    expect(reviewGaps({ ...cash, currency: 'USD' }, archive, today)).toEqual(['currency']);
    expect(reviewGaps({ ...cash, currency: 'USD', destinationId: dollars.id }, archive, today)).toEqual([]);
    expect(reviewGaps({ ...cash, currency: 'JPY', amountMinor: 1500, destinationId: yen.id }, archive, today)).toEqual([]);
  });
  it('a destination that is not offered for the kind is a gap', () => {
    for (const destinationId of [debtAccount.id, closed.id, shelvedAccount.id, goneAccount.id, 'missing']) {
      expect(reviewGaps({ ...cash, destinationId }, archive, today), destinationId).toEqual(['destination']);
    }
    expect(reviewGaps({ ...cash, kind: 'income', category: 'Sueldo', destinationId: cardAccount.id }, archive, today)).toEqual(['destination']);
  });
  it('a card needs a purchase mode; nothing else may carry one', () => {
    expect(reviewGaps(onCard(null), archive, today)).toEqual(['purchase']);
    expect(reviewGaps(onCard({ mode: 'once' }), archive, today)).toEqual([]);
    expect(reviewGaps({ ...cash, purchase: { mode: 'once' } }, archive, today)).toEqual(['purchase']);
  });
  it('cuotas need the person\'s count, and at least one minor unit per instalment', () => {
    expect(reviewGaps(onCard({ mode: 'installments', count: null, placement: 'current' }), archive, today)).toEqual(['installmentCount']);
    expect(reviewGaps({ ...onCard({ mode: 'installments', count: 6, placement: 'current' }), amountMinor: 5 }, archive, today)).toEqual(['installmentCount']);
    expect(reviewGaps(onCard({ mode: 'installments', count: 6, placement: 'next' }), archive, today)).toEqual([]);
  });
  it('a category must be one the person has: built-in, defined or used; never archived or invented', () => {
    for (const category of ['Supermercado', 'supermercado', 'Kiosco', 'verduleria']) expect(reviewGaps({ ...cash, category }, archive, today), category).toEqual([]);
    for (const category of ['Cigarrillos', 'Criptomonedas']) expect(reviewGaps({ ...cash, category }, archive, today), category).toEqual(['category']);
    expect(reviewGaps({ ...cash, kind: 'income', category: 'Verdulería' }, archive, today), 'used as an expense, not an income').toEqual(['category']);
  });
  it('a date after today is a gap; an invalid today is refused', () => {
    expect(reviewGaps({ ...cash, dateISO: '2026-09-29' }, archive, today)).toEqual(['date']);
    expect(() => reviewGaps(cash, archive, '2026-02-30')).toThrow('Fecha de procesamiento inválida.');
  });
});

describe('basis and staleness', () => {
  const visaBasis = [{ kind: 'account', id: cardAccount.id, revision: 0 }, { kind: 'card', id: card.id, revision: 0 }] as const;
  it('the basis is the destination account, its card and the category definition, when each exists', () => {
    expect(reviewBasis({ ...onCard({ mode: 'once' }), category: 'kiosco' }, archive)).toEqual([...visaBasis, { kind: 'category', entryKind: 'expense', key: 'kiosco', revision: 2 }]);
    expect(reviewBasis(cash, archive)).toEqual([{ kind: 'account', id: bank.id, revision: 0 }]);
    expect(reviewBasis(blank, archive)).toEqual([]);
  });
  it('a draft is current when its basis matches, and stale when it was never reviewed against its destination', () => {
    expect(isStaleReviewDraft(cash, archive)).toBe(false);
    expect(isStaleReviewDraft(blank, archive)).toBe(false);
    expect(isStaleReviewDraft({ ...cash, basis: [] }, archive)).toBe(true);
    expect(isStaleReviewDraft({ ...onCard({ mode: 'once' }), basis: [visaBasis[0]] }, archive)).toBe(true);
    expect(isStaleReviewDraft({ ...cash, category: 'Kiosco' }, archive)).toBe(true);
  });
  it('an account, card or category that changed, was deleted or is gone makes it stale', () => {
    const drafted = { ...onCard({ mode: 'once' }), category: 'Kiosco', basis: reviewBasis({ ...onCard({ mode: 'once' }), category: 'Kiosco' }, archive) };
    expect(isStaleReviewDraft(drafted, archive)).toBe(false);
    const archived = { ...card, active: false, revision: 1, updatedAt: now };
    expect(isStaleReviewDraft(drafted, { ...archive, cards: [archived, shelved, gone] })).toBe(true);
    expect(isStaleReviewDraft(drafted, { ...archive, categories: [{ ...kiosco, revision: 3 }, retired] })).toBe(true);
    expect(isStaleReviewDraft(drafted, { ...archive, categories: [retired] })).toBe(true);
    expect(isStaleReviewDraft(drafted, { ...archive, accounts: archive.accounts.map(row => row.id === cardAccount.id ? { ...row, revision: 1, updatedAt: now } : row) })).toBe(true);
    const renamed = { ...cash, basis: [{ kind: 'account' as const, id: bank.id, revision: 0 }] };
    expect(isStaleReviewDraft(renamed, { ...archive, accounts: [{ ...bank, name: 'Galicia', revision: 1, updatedAt: now }, ...archive.accounts.slice(1)] })).toBe(true);
    expect(isStaleReviewDraft({ ...cash, basis: [...cash.basis, { kind: 'account', id: 'vanished', revision: 0 }] }, archive)).toBe(true);
    expect(isStaleReviewDraft({ ...cash, basis: [...cash.basis, { kind: 'account', id: closed.id, revision: 1 }] }, archive), 'a deleted account').toBe(true);
  });
});

describe('review fixes (25A-01)', () => {
  it('a defined category whose folded key outgrows 60 characters (Hangul decomposes) is based, parsed and written', () => {
    const label = '\uac00'.repeat(60);
    const hangul = newCategoryDefinition('expense', label, 'other', 'slate', createdAt);
    expect(hangul.key.length).toBeGreaterThan(60);
    const base = { ...archive, categories: [kiosco, retired, hangul] };
    const draft = { ...cash, category: label, basis: reviewBasis({ ...cash, category: label }, base) };
    expect(parseReviewDraft(draft)).toEqual(draft);
    expect(isStaleReviewDraft(draft, base)).toBe(false);
    const result = writeForReviewDraft(draft, base, { writeId: 'w-1', createdAt: now, todayISO: today });
    expect(result.type === 'entry' && result.entry.category).toBe(label);
  });
  it('a single payment is never a one-instalment plan: cuotas are 2 to 120, as in the purchase form', () => {
    expect(() => parseReviewDraft(onCard({ mode: 'installments', count: 1, placement: 'current' }))).toThrow(REVIEW_DRAFT_INVALID_MESSAGE);
    expect(write(onCard({ mode: 'installments', count: 2, placement: 'current' })).type).toBe('plan');
    expect(write(onCard({ mode: 'installments', count: 120, placement: 'current' })).type).toBe('plan');
  });
});

describe('withDestination', () => {
  it('sets an offered destination and re-bases on it; a card starts as «Una vez», never in cuotas', () => {
    const chosen = withDestination({ ...blank, kind: 'expense' }, cardAccount.id, archive);
    expect(chosen.destinationId).toBe(cardAccount.id);
    expect(chosen.purchase).toEqual({ mode: 'once' });
    expect(chosen.basis).toEqual([{ kind: 'account', id: cardAccount.id, revision: 0 }, { kind: 'card', id: card.id, revision: 0 }]);
    expect(chosen.currency).toBeNull();
  });
  it('keeps a purchase mode already chosen on a card, drops it on a cash account, and keeps the category basis', () => {
    const cuotas = { ...onCard({ mode: 'installments', count: 3, placement: 'next' }), category: 'Kiosco' };
    const based = { ...cuotas, basis: reviewBasis(cuotas, archive) };
    expect(withDestination(based, cardAccount.id, archive).purchase).toEqual({ mode: 'installments', count: 3, placement: 'next' });
    const moved = withDestination(based, bank.id, archive);
    expect(moved.purchase).toBeNull();
    expect(moved.basis).toEqual([{ kind: 'account', id: bank.id, revision: 0 }, { kind: 'category', entryKind: 'expense', key: 'kiosco', revision: 2 }]);
    expect(isStaleReviewDraft(moved, archive)).toBe(false);
  });
  it('refuses a destination that is not offered for the kind', () => {
    for (const id of [debtAccount.id, closed.id, shelvedAccount.id, goneAccount.id, 'missing']) {
      expect(() => withDestination(cash, id, archive), id).toThrow(REVIEW_DESTINATION_MESSAGE);
    }
    expect(() => withDestination({ ...cash, kind: 'income', category: 'Sueldo' }, cardAccount.id, archive)).toThrow(REVIEW_DESTINATION_MESSAGE);
  });
  it('leaves the currency alone, so a mismatch stays a gap', () => {
    expect(reviewGaps(withDestination(cash, dollars.id, archive), archive, today)).toEqual(['currency']);
  });
});

describe('writeForReviewDraft: exactly one write', () => {
  it('a cash expense is one movement with the fixed id, the category written as its stored label', () => {
    expect(write({ ...cash, category: 'supermercado' })).toEqual({ type: 'entry', entry: { id: 'w-1', accountId: bank.id, kind: 'expense', amountMinor: 1500000,
      merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-27', createdAt: now } });
  });
  it('an income is one movement on a cash account', () => {
    const income = { ...cash, kind: 'income' as const, merchant: 'Empresa', category: 'Sueldo', amountMinor: 90000000 };
    expect(write(income)).toEqual({ type: 'entry', entry: { id: 'w-1', accountId: bank.id, kind: 'income', amountMinor: 90000000,
      merchant: 'Empresa', category: 'Sueldo', dateISO: '2026-09-27', createdAt: now } });
  });
  it('works in a currency with another scale (JPY, exponent 0)', () => {
    const result = write({ ...cash, currency: 'JPY', amountMinor: 1500, destinationId: yen.id, basis: [{ kind: 'account', id: yen.id, revision: 0 }] });
    expect(result.type === 'entry' && result.entry.amountMinor).toBe(1500);
  });
  it('a card in «Una vez» is one expense on the card\'s account', () => {
    const result = write(onCard({ mode: 'once' }));
    expect(result).toEqual({ type: 'entry', entry: { id: 'w-1', accountId: cardAccount.id, kind: 'expense', amountMinor: 1500000, merchant: 'Coto',
      category: 'Supermercado', dateISO: '2026-09-27', createdAt: now } });
  });
  it('cuotas are one plan built by newInstallmentPlan: the price as principal, the person\'s count, no financing, no movement', () => {
    const result = write(onCard({ mode: 'installments', count: 6, placement: 'current' }));
    expect(result.type).toBe('plan');
    if (result.type !== 'plan') return;
    expect(result.plan).toEqual(newInstallmentPlan({ id: 'w-1', card, cardAccount, merchant: 'Coto', category: 'Supermercado', purchaseDateISO: '2026-09-27',
      principalMinor: 1500000, count: 6, placement: 'current', createdAt: now }));
    expect(result.plan.principalMinor).toBe(1500000);
    expect(result.plan.schedule.reduce((sum, row) => sum + row.principalMinor, 0)).toBe(1500000);
    expect([result.plan.interestMinor, result.plan.feeMinor, result.plan.taxMinor]).toEqual([0, 0, 0]);
    expect(result.plan.currency).toBe(cardAccount.currency);
    expect(Object.keys(result)).toEqual(['type', 'plan']);
    expect(() => validateInstallmentPlan(result.plan, [card], archive.accounts)).not.toThrow();
  });
  it('cuotas follow the card\'s exact statement dates, as the purchase form does', () => {
    const cycle = { closingDay: 28, dueDay: 5 };
    const change = planCardCycle({ cardId: card.id, days: cycle, rows: [], todayISO: '2026-10-01', nowISO: now,
      intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' }, days: { closingDay: 15, dueDay: 25 } } });
    expect(cardCycleView(change.days, change.rows, '2026-10-01').open.closingISO).toBe('2026-10-26');
    const moved = { ...card, ...change.days };
    const base = { ...archive, cards: [moved, shelved, gone], cardCycleDates: change.rows };
    const draft = { ...onCard({ mode: 'installments', count: 3, placement: 'current' }), dateISO: '2026-10-10' };
    const result = writeForReviewDraft(draft, base, { writeId: 'w-1', createdAt: now, todayISO: '2026-10-10' });
    expect(result.type === 'plan' && result.plan.schedule[0].billingDateISO).toBe('2026-10-26');
  });
  it('the same draft, archive and options give a deep-equal write; only the fixed id differs between two ids', () => {
    for (const draft of [cash, onCard({ mode: 'once' }), onCard({ mode: 'installments', count: 12, placement: 'next' })]) {
      expect(write(draft)).toEqual(write(draft));
      const [a, b] = [write(draft, 'w-1'), write(draft, 'w-2')];
      const strip = (value: typeof a) => value.type === 'entry' ? { ...value.entry, id: '' } : { ...value.plan, id: '' };
      expect(strip(a)).toEqual(strip(b));
    }
  });
  it('mutates neither the draft nor the archive', () => {
    const frozenDraft = deepFreeze(structuredClone(onCard({ mode: 'installments', count: 3, placement: 'current' })));
    const frozenArchive = deepFreeze(structuredClone(archive));
    expect(() => writeForReviewDraft(frozenDraft, frozenArchive, { writeId: 'w-1', createdAt: now, todayISO: today })).not.toThrow();
    expect(() => withDestination(frozenDraft, bank.id, frozenArchive)).not.toThrow();
  });
  it('refuses a draft with any gap, and never fills one', () => {
    for (const draft of [blank, { ...cash, currency: null }, { ...cash, currency: 'USD' }, onCard(null), onCard({ mode: 'installments', count: null, placement: 'current' }),
      { ...cash, dateISO: '2026-09-29' }, { ...cash, category: 'Criptomonedas' }, { ...cash, destinationId: debtAccount.id }]) {
      expect(() => write(draft as ReviewDraft)).toThrow(REVIEW_INCOMPLETE_MESSAGE);
    }
  });
  it('refuses a stale draft', () => {
    expect(() => write({ ...cash, basis: [] })).toThrow(REVIEW_STALE_MESSAGE);
    expect(() => write(onCard({ mode: 'once' }), 'w-1', { ...archive, cards: [{ ...card, issuer: 'Galicia', revision: 1, updatedAt: now }, shelved, gone] })).toThrow(REVIEW_STALE_MESSAGE);
  });
  it('refuses an id that is not a fixed write id, a derived id, or a malformed creation time', () => {
    for (const writeId of ['', 'w_1', 'inst_tv_001', 'rec_rule_20260901', 'w 1', 'x'.repeat(71), 'w-1\n']) {
      expect(() => write(cash, writeId), JSON.stringify(writeId)).toThrow(REVIEW_WRITE_ID_MESSAGE);
    }
    expect(REVIEW_WRITE_ID.test('0f8c6a52-2b8a-4b3e-9a51-1d2c3e4f5a6b')).toBe(true);
    expect(() => writeForReviewDraft(cash, archive, { writeId: 'w-1', createdAt: '2026-02-30T10:00:00Z', todayISO: today })).toThrow('Fecha de creación inválida.');
  });
  it('re-reads the draft it is given: a hand-built object with an extra key or a purchase on an income never writes', () => {
    expect(() => write({ ...cash, accountName: 'Banco' } as ReviewDraft)).toThrow(REVIEW_DRAFT_INVALID_MESSAGE);
    expect(() => write({ ...cash, kind: 'income', category: 'Sueldo', purchase: { mode: 'once' } })).toThrow(REVIEW_DRAFT_INVALID_MESSAGE);
  });
});

describe('no default instalment count', () => {
  it('the module never names a count of its own (the purchase form\'s 12 stays in the form)', () => {
    const source = readFileSync(fileURLToPath(new URL('./review-drafts.ts', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(source).not.toMatch(/DEFAULT_COUNT|\bcount:\s*\d/);
    expect(source).not.toMatch(/\b12\b/);
  });
});
