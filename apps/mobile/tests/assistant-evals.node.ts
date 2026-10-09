import assert from 'node:assert/strict';
import { test } from 'node:test';
import { postingAccountsFor, reviewGaps, validateAccount, validateLiabilityProfiles, type Account, type CreditCardProfile, type Currency } from '@finanzapp/domain';
import { recoverAssistantResultV2, validateAssistantResultV2, validateDroppedFields, type AssistantRequest, type AssistantResultV2 } from '../../../packages/integrations/assistant-protocol.js';
import { CASES } from '../../../server/mobile/evals/corpus.js';
import { buildRequest, goldenOutput } from '../../../server/mobile/evals/harness.js';
import { completeDraft, contentFromResult } from '../src/assistant/conversation.ts';
import { reviewDraftFromAssistant } from '../src/assistant/review-proposal.ts';

// Producto 25A-05: the eval corpus run through the device. A perfect provider's output (the harness golden) is validated
// again with the app's own validator against the request the case sends, then resolved by the app's own deterministic code
// (contentFromResult over the domain's posting accounts, exactly as app/assistant.tsx builds them). The model only ever
// says words for the means of payment; which account they name is decided here, or asked.
type DeviceAccount = { id: string; name: string; currency: Currency; kind: 'cash' | 'card' };
type EvalCase = { id: string; group: string; request: { currency: Currency; text: string }; expect: { type: string }; device?: { accounts: DeviceAccount[]; destination: string } };

const createdAt = '2026-09-01T12:00:00.000Z';
const cases = CASES as EvalCase[];
const withDevice = cases.filter(item => item.device);

/** Complete, valid domain rows for a case's synthetic accounts: a card is its hidden account plus an active profile. */
function ledger(device: NonNullable<EvalCase['device']>) {
  const accounts: Account[] = device.accounts.map(item => ({ id: item.id, name: item.name, currency: item.currency, openingMinor: 0, createdAt }));
  const cards: CreditCardProfile[] = device.accounts.filter(item => item.kind === 'card').map(item => ({ id: 'profile-' + item.id, accountId: item.id,
    issuer: item.name, last4: '', creditLimitMinor: null, closingDay: 20, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt }));
  accounts.forEach(account => validateAccount(account));
  validateLiabilityProfiles(cards, [], accounts);
  return { accounts: postingAccountsFor('expense', accounts, cards), incomeAccounts: postingAccountsFor('income', accounts, cards) };
}

function onDevice(testCase: EvalCase, output: unknown = goldenOutput(testCase)) {
  const request = buildRequest(testCase) as AssistantRequest;
  const result = validateAssistantResultV2(output, request) as AssistantResultV2;
  const { accounts, incomeAccounts } = testCase.device ? ledger(testCase.device) : { accounts: [], incomeAccounts: [] };
  const resolved = contentFromResult(result, request.facts, accounts, [], request.currency, request.todayISO, incomeAccounts);
  return { request, result, accounts, incomeAccounts, resolved };
}

/** The account the device settled on: the draft's, or the one carried while a later field (category) is asked. Null when
 * the destination itself is asked. */
function destination({ resolved }: ReturnType<typeof onDevice>) {
  if (resolved.content?.kind === 'draft') return resolved.content.draft.accountId;
  if (resolved.content?.kind === 'clarification' && resolved.content.field !== 'paymentMethod') return resolved.pending?.draft.accountId ?? null;
  return null;
}

test('25A-05: every golden output of the corpus passes the device validator against its own request', () => {
  assert.ok(cases.length >= 80);
  for (const testCase of cases) {
    const { result, resolved } = onDevice(testCase);
    assert.equal(result.type, testCase.expect.type, testCase.id);
    // Whatever the type, the app's content comes only from the validated result and the device's own data.
    if (result.type === 'answer') assert.equal(resolved.content?.kind, 'answer', testCase.id);
  }
});

test('25A-05: out-of-scope cases produce the model\'s words only: no proposal, no content, nothing parked', () => {
  const refusals = cases.filter(item => item.expect.type === 'out_of_scope');
  assert.ok(refusals.length >= 15);
  for (const testCase of refusals) {
    const { result, resolved } = onDevice(testCase);
    assert.deepEqual([result.proposals, result.evidenceIds, result.navigation, result.clarification], [[], [], null, null], testCase.id);
    assert.deepEqual([resolved.content, resolved.pending, resolved.textKey], [null, null, undefined], testCase.id);
    assert.equal(resolved.text, result.message, testCase.id);
  }
});

function deviceFailures(subset: EvalCase[]) {
  const failures: string[] = [];
  for (const testCase of subset) {
    const run = onDevice(testCase);
    const { result, accounts, incomeAccounts, resolved } = run;
    assert.equal(result.type, 'proposal', testCase.id);
    const proposal = result.proposals[0];
    // The model's draft has no destination field at all: only the person's words.
    assert.deepEqual(Object.keys(proposal).sort(), ['amountMinor', 'category', 'currency', 'dateISO', 'kind', 'merchant', 'paymentMethodRef'], testCase.id);
    // The destinations compatible with the currency the device resolved: the model's when stated, the device's inference
    // otherwise (decision D, 25A-06; every device block is single-currency, so it equals the request's currency).
    const resolvedCurrency = resolved.content?.kind === 'draft' ? resolved.content.draft.currency : resolved.pending?.draft.currency ?? proposal.currency ?? testCase.request.currency;
    assert.equal(resolvedCurrency, proposal.currency ?? testCase.request.currency, testCase.id + ': the device never resolves a currency the accounts do not hold');
    const compatible = (proposal.kind === 'income' ? incomeAccounts : accounts).filter(account => account.currency === resolvedCurrency);
    const expected = testCase.device!.destination;
    const actual = destination(run);
    if (expected === 'ask') {
      const ok = actual === null && resolved.content?.kind === 'clarification' && resolved.content.field === 'paymentMethod'
        && resolved.textKey === (proposal.kind === 'expense' ? 'assistant.clarify.paidWith' : 'assistant.clarify.receivedIn')
        && JSON.stringify(resolved.content.options) === JSON.stringify(compatible.map(account => ({ id: account.id, label: account.name })))
        && resolved.pending?.field === 'paymentMethod' && resolved.pending.draft.accountId === null;
      if (!ok) failures.push(`${testCase.id}: expected ask, got ${actual ?? JSON.stringify(resolved.content)}`);
    } else {
      if (actual !== expected) failures.push(`${testCase.id}: expected ${expected}, got ${actual ?? 'ask'} (ref ${JSON.stringify(proposal.paymentMethodRef)})`);
      assert.ok(compatible.some(account => account.id === expected), testCase.id + ': the expected account is compatible');
    }
    // A named means of payment that names nothing is asked, never replaced by the only eligible account; a name that
    // resolves is a stated destination, never an implied one.
    if (proposal.paymentMethodRef !== null && actual !== null) {
      const stated = resolved.content?.kind === 'draft' ? resolved.content.draft.destinationStated : resolved.pending?.draft.destinationStated;
      assert.equal(stated, true, testCase.id + ': a resolved name is a stated destination');
    }
  }
  return failures;
}

test('25A-05: every device case resolves the destination the corpus expects, or asks among the compatible accounts', () => {
  assert.ok(withDevice.length >= 15);
  assert.deepEqual(deviceFailures(withDevice), [], 'device outcomes that differ from the corpus');
});

test('25A-05: a reference with a preposition, article or possessive («con la Visa», "my Visa») names the account it names', () => {
  const visa = withDevice.filter(item => ['capture.visa-one.es', 'capture.visa.en', 'capture.mastercard.es', 'capture.card-once.es'].includes(item.id));
  assert.equal(visa.length, 4);
  assert.deepEqual(deviceFailures(visa), []);
});

// 25A-06, owner decision A (2026-10-09): the corpus's two over-long names, copied verbatim as B7 runs #1 and #2 did, no
// longer lose the draft. The strict validator still refuses the output as returned (what the evaluation scores); the
// server boundary drops the name, the device validates the list, resolves the rest as any draft and the review asks for it.
test('25A-06 (decision A): an over-long merchant or category copied verbatim reaches the device with that name missing and every other field exact', () => {
  const oversized = { 'adversarial.oversized-merchant.es': 'merchant', 'adversarial.oversized-category.es': 'category' } as const;
  const account: Account = { id: 'acc-efectivo', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt };
  const archive = { accounts: [account], records: [], cards: [], debts: [], categories: [] };
  for (const [id, field] of Object.entries(oversized)) {
    const testCase = cases.find(item => item.id === id)!;
    const golden = goldenOutput(testCase);
    const written = testCase.request.text.replace(/^.*?(?:categoría: | en )/, '');
    assert.ok(written.length > (field === 'merchant' ? 120 : 60), id + ': the name is over its bound');
    const verbatim = { ...golden, proposals: [{ ...golden.proposals[0], [field]: written }] };
    const request = buildRequest(testCase) as AssistantRequest;
    assert.throws(() => validateAssistantResultV2(verbatim, request), id + ': refused as returned, as the evaluation scores it');
    const { result, dropped } = recoverAssistantResultV2(verbatim, request);
    assert.deepEqual(dropped, [field]);
    assert.deepEqual(result, validateAssistantResultV2(golden, request), id + ': what the device receives is the committed golden draft, the name null');
    assert.deepEqual(validateDroppedFields(dropped, result), [field], id + ': the device accepts the list against the result');
    // On the device: the one peso account is implied, the missing category is asked (as for any draft without one), the
    // chosen category completes the draft, and the review draft keeps the exact amount with the merchant a gap.
    const resolved = contentFromResult(result, request.facts, [account], [], 'ARS', request.todayISO, [account]);
    assert.equal(resolved.content?.kind === 'clarification' && resolved.content.field, 'category', id);
    const next = completeDraft(resolved.pending!, 'Varios', [account], [], request.todayISO, [account]);
    assert.equal(next.content.kind, 'draft', id);
    const draft = reviewDraftFromAssistant(next.content.kind === 'draft' ? next.content.draft : null!, archive, '2026-10-05T12:00:00.000Z', request.todayISO);
    assert.deepEqual([draft.kind, draft.amountMinor, draft.currency, draft.destinationId, draft.merchant, draft.category, draft.dateISO],
      ['expense', golden.proposals[0].amountMinor, 'ARS', account.id, null, 'Varios', request.todayISO], id);
    assert.ok(reviewGaps(draft, archive, request.todayISO).includes('merchant'), id + ': the review asks for the merchant, never fills it');
  }
});

test('25A-05: a destination never comes from the model: an account id in the draft is refused, an id as words names nothing', () => {
  for (const testCase of withDevice) {
    const golden = goldenOutput(testCase);
    const target = testCase.device!.destination === 'ask' ? testCase.device!.accounts[0].id : testCase.device!.destination;
    for (const key of ['accountId', 'cardId', 'destination']) {
      assert.throws(() => onDevice(testCase, { ...golden, proposals: [{ ...golden.proposals[0], [key]: target }] }), testCase.id + ' ' + key);
    }
    assert.throws(() => onDevice(testCase, { ...golden, accountId: target }), testCase.id);
    // The model echoing the device's own id is words like any other: it matches no account name, so it is asked.
    const echoed = onDevice(testCase, { ...golden, proposals: [{ ...golden.proposals[0], paymentMethodRef: target }] });
    assert.equal(destination(echoed), null, testCase.id);
    assert.equal(echoed.resolved.content?.kind === 'clarification' && echoed.resolved.content.field, 'paymentMethod', testCase.id);
  }
});
