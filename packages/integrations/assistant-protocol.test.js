import { describe, it, expect } from 'vitest';
import { ASSISTANT_PROTOCOL_VERSION, ASSISTANT_PROTOCOL_VERSIONS, DROPPABLE_FIELDS, PROTOCOL_LIMITS, PROTOCOL_CURRENCIES, PROPOSAL_KINDS, modelInput, validateAssistantResultV2,
  validateAssistantRequest, isSafeModelText, isSafeInputText, recoverAssistantResultV2, validateDroppedFields } from './assistant-protocol.js';
import { MAX_ENTRY_MINOR } from '../domain/money.ts';
import { REVIEW_KINDS, parseReviewDraft } from '../domain/review-drafts.ts';

const request = validateAssistantRequest({ version: 2, requestId: 'fixture-request-0001', action: 'parse', text: 'Gasté 15 mil', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] });
const proposal = (fields) => ({ type: 'proposal', message: 'Revisalo.', evidenceIds: [], navigation: null, clarification: null,
  proposals: [{ kind: 'expense', amountMinor: 1500000, currency: null, merchant: null, category: null, dateISO: null, paymentMethodRef: null, ...fields }] });

describe('protocol v2 stays inside what a review draft can hold', () => {
  it('shares the domain bounds (drift test)', () => {
    expect(PROTOCOL_LIMITS.maxAmountMinor).toBe(MAX_ENTRY_MINOR);
    expect([...PROPOSAL_KINDS]).toEqual([...REVIEW_KINDS]);
    const template = { version: 1, source: 'assistant', capturedAt: '2026-09-19T10:00:00.000Z', kind: 'expense', amountMinor: null, currency: null, merchant: null,
      category: null, dateISO: null, destinationId: null, purchase: null, basis: [] };
    // The longest merchant and category the protocol accepts are accepted by the review draft; one more is refused by both.
    expect(() => parseReviewDraft({ ...template, merchant: 'm'.repeat(PROTOCOL_LIMITS.merchantChars), category: 'c'.repeat(PROTOCOL_LIMITS.categoryChars) })).not.toThrow();
    expect(() => parseReviewDraft({ ...template, merchant: 'm'.repeat(PROTOCOL_LIMITS.merchantChars + 1) })).toThrow();
    expect(() => validateAssistantResultV2(proposal({ merchant: 'm'.repeat(PROTOCOL_LIMITS.merchantChars + 1) }), request)).toThrow();
    for (const currency of PROTOCOL_CURRENCIES) expect(() => parseReviewDraft({ ...template, currency })).not.toThrow();
  });
  it('keeps every unknown null and returns only protocol keys', () => {
    const result = validateAssistantResultV2(proposal({ merchant: '  Kiosco  ' }), request);
    expect(result.proposals[0]).toEqual({ kind: 'expense', amountMinor: 1500000, currency: null, merchant: 'Kiosco', category: null, dateISO: null, paymentMethodRef: null });
    expect(() => validateAssistantResultV2({ ...proposal({}), proposals: [{ ...proposal({}).proposals[0], currency: undefined }] }, request)).toThrow();
  });
  it('refuses actionable or hidden text and accepts ordinary words', () => {
    for (const bad of ['https://x.example', 'ftp://x', 'www.x.com', '[a](b)', '```x```', 'javascript:alert(1)', 'a\u202eb', 'a\u200bb', 'a\nb', ' ', '']) expect(isSafeModelText(bad, 100), bad).toBe(false);
    for (const ok of ['Netflix.com', 'Café Martínez', 'Mercado Pago', '7-Eleven', 'Kiosco 24 hs']) expect(isSafeModelText(ok, 100), ok).toBe(true);
    expect(isSafeModelText('Línea 1\nLínea 2', 100, true)).toBe(true);
  });
  it('refuses addresses to follow or call, invisible tag characters and lone surrogates, not ordinary prose (security review)', () => {
    for (const bad of ['galicia-seguridad.com/login', 'soporte@finanzapp-ayuda.net', 'mailto:x@evil.example', 'tel:+5491100000000', 'sms:+54911',
      'intent:#Intent;end', 'data:text/html,x', 'file:/etc/passwd', 'Comida\u{E0041}\u{E0042}', 'Caf\ud800']) expect(isSafeModelText(bad, 200, true), bad).toBe(false);
    for (const ok of ['Based on your data: you spent $1.', 'Movements on file: 1.', 'Gastaste $1.234/mes', 'Hotel: 5 noches', 'Netflix.com']) expect(isSafeModelText(ok, 200, true), ok).toBe(true);
    expect(isSafeInputText('Categoría de gasto: Comida\u{E0041}', 160)).toBe(false);
    expect(isSafeInputText('Categoría de gasto: Comida', 160)).toBe(true);
  });
  // 25A-06: protocol v3 is v2 plus `language`, the interface language the reply is written in; the server accepts both
  // (the server-first rollout of docs/i18n.md §11) and returns the wire shape it received. A language never rides on v2.
  it('accepts protocol v3 next to v2, in the wire shape received, hands the model the language only when sent, and refuses a language on v2', () => {
    const v2 = { version: 2, requestId: 'fixture-request-0001', action: 'parse', text: 'Gasté 15 mil', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] };
    const v3 = { ...v2, version: 3, language: 'en' };
    expect(ASSISTANT_PROTOCOL_VERSION).toBe(3);
    expect([...ASSISTANT_PROTOCOL_VERSIONS]).toEqual([2, 3]);
    expect(validateAssistantRequest(v3)).toEqual(v3);
    expect(validateAssistantRequest(v2)).toEqual(v2);
    expect(modelInput(validateAssistantRequest(v3))).toEqual({ action: 'parse', text: 'Gasté 15 mil', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', language: 'en', facts: [] });
    expect(modelInput(validateAssistantRequest(v2))).not.toHaveProperty('language');
    for (const bad of [{ ...v2, language: 'en' }, { ...v3, language: undefined }, { ...v3, language: null }, { ...v3, language: 'EN' }, { ...v3, language: 'spa' }, { ...v3, language: '' },
      { ...v3, locale: { language: 'en' } }, { ...v3, version: 4 }, { ...v3, version: 1 }, { ...v3, version: '3' }, null, 'v3']) {
      expect(() => validateAssistantRequest(bad), JSON.stringify(bad)).toThrow();
    }
    // The result shape is the same in both versions: a reply validates the same against either request.
    expect(validateAssistantResultV2(proposal({}), validateAssistantRequest(v3))).toEqual(validateAssistantResultV2(proposal({}), validateAssistantRequest(v2)));
  });

  // 25A-06, owner decision A (2026-10-09) after B7 runs #1 and #2: a model that copies the person's words verbatim past the
  // merchant or category bound lost the whole draft (502, billed, nothing saved). The server's one recovery keeps such a
  // draft with that name null and listed; the strict validator is unchanged and nothing else is recovered.
  it('recovers a proposal whose only fault is an over-long optional name the person wrote: that name null and listed, every other field exact', () => {
    // The corpus's two over-long names (131 and 70 characters), as the person wrote them in the request.
    const LONG_MERCHANT = 'Almacén de Ramos Generales y Despensa La Esquina del Barrio Sucursal Norte Número Dos Abierto Las Veinticuatro Horas Todos Los Días';
    const LONG_CATEGORY = 'Gastos varios del hogar y mantenimiento general de la casa y el jardín';
    expect([LONG_MERCHANT.length > PROTOCOL_LIMITS.merchantChars, LONG_CATEGORY.length > PROTOCOL_LIMITS.categoryChars]).toEqual([true, true]);
    const asked = validateAssistantRequest({ ...request, text: `Gasté 3 mil pesos en ${LONG_MERCHANT}, categoría: ${LONG_CATEGORY}` });
    const stated = { amountMinor: 300000, currency: 'ARS', dateISO: '2026-09-18', paymentMethodRef: 'la Visa' };
    expect([...DROPPABLE_FIELDS]).toEqual(['merchant', 'category']);
    expect(recoverAssistantResultV2(proposal({ ...stated, merchant: LONG_MERCHANT }), asked))
      .toEqual({ result: validateAssistantResultV2(proposal({ ...stated, merchant: null }), asked), dropped: ['merchant'] });
    expect(recoverAssistantResultV2(proposal({ ...stated, merchant: 'Kiosco', category: LONG_CATEGORY }), asked))
      .toEqual({ result: validateAssistantResultV2(proposal({ ...stated, merchant: 'Kiosco', category: null }), asked), dropped: ['category'] });
    expect(recoverAssistantResultV2(proposal({ ...stated, merchant: LONG_MERCHANT, category: LONG_CATEGORY }), asked))
      .toEqual({ result: validateAssistantResultV2(proposal({ ...stated, merchant: null, category: null }), asked), dropped: ['merchant', 'category'] });
    // Exactly at the bound is kept as returned (nothing dropped, whatever the text says); one more is dropped, never cut to the bound.
    const atBound = proposal({ merchant: 'm'.repeat(PROTOCOL_LIMITS.merchantChars), category: 'c'.repeat(PROTOCOL_LIMITS.categoryChars) });
    expect(recoverAssistantResultV2(atBound, request)).toEqual({ result: validateAssistantResultV2(atBound, request), dropped: [] });
    expect(recoverAssistantResultV2(proposal({ merchant: LONG_MERCHANT }), asked).result.proposals[0].merchant).toBeNull();
    // A name as long as the person's whole text, copied: recovered; one character more than any text: never.
    const whole = 'm'.repeat(PROTOCOL_LIMITS.textChars);
    const giant = validateAssistantRequest({ ...request, text: whole });
    expect(recoverAssistantResultV2(proposal({ merchant: whole }), giant).dropped).toEqual(['merchant']);
    expect(() => recoverAssistantResultV2(proposal({ merchant: whole + 'm' }), giant)).toThrow();
    // The strict validator itself still refuses the over-long name: the recovery is the server boundary's step, never the model's allowance.
    expect(() => validateAssistantResultV2(proposal({ merchant: LONG_MERCHANT }), asked)).toThrow();
    // A valid output of any type comes back unchanged.
    const scope = { type: 'out_of_scope', message: 'Solo finanzas.', evidenceIds: [], navigation: null, proposals: [], clarification: null };
    expect(recoverAssistantResultV2(scope, asked)).toEqual({ result: scope, dropped: [] });
    // Grounding (Codex review of PR #99): an over-long name the model invented is not the person's words, however long or
    // short, and stays refused: against a short text, shorter than the text, one character changed or appended, the case
    // changed, a copied name beside an invented one (each name must be the person's), a copy of another text.
    const invented = 'm'.repeat(PROTOCOL_LIMITS.merchantChars + 1);
    expect(invented.length < asked.text.length).toBe(true);
    for (const [what, output, asked_] of [
      ['invented, against a short text', proposal({ merchant: invented }), request],
      ['invented, shorter than the text', proposal({ merchant: invented }), asked],
      ['one word changed', proposal({ merchant: LONG_MERCHANT.replace('Norte', 'Sur') }), asked],
      ['one character appended', proposal({ merchant: LONG_MERCHANT + '.' }), asked],
      ['the case changed', proposal({ merchant: LONG_MERCHANT.toUpperCase() }), asked],
      ['a copied merchant beside an invented category', proposal({ merchant: LONG_MERCHANT, category: 'c'.repeat(PROTOCOL_LIMITS.categoryChars + 1) }), asked],
      ['an invented merchant beside a copied category', proposal({ merchant: invented, category: LONG_CATEGORY }), asked],
      ['a copy of another text', proposal({ merchant: whole }), asked],
    ]) expect(() => recoverAssistantResultV2(output, asked_), what).toThrow();
    // Nothing else is recovered, a copied name included: a zero-width space or an address the person's own text holds
    // (allowed in a request, refused in a name), an invisible tag character, another fault beside the copied name, a
    // reference or a message over its bound, two proposals, an extra key (the marker itself included), a blank over-long
    // name, no proposal, a shape that is no object.
    const zeroWidth = String.fromCharCode(0x200b);
    const unsafe = validateAssistantRequest({ ...request, text: `Gasté 3 mil pesos en ${LONG_MERCHANT}${zeroWidth}, categoría: ${LONG_CATEGORY} www.evil.example` });
    const copied = fields => proposal({ merchant: LONG_MERCHANT, ...fields });
    for (const [bad, asked_] of [
      [proposal({ merchant: LONG_MERCHANT + zeroWidth }), unsafe], [proposal({ category: LONG_CATEGORY + ' www.evil.example' }), unsafe], [proposal({ merchant: LONG_MERCHANT + '\u{E0041}' }), asked],
      [copied({ amountMinor: 0 }), asked], [copied({ currency: 'EUR' }), asked], [copied({ dateISO: '2026-09-20' }), asked], [copied({ category: 'Kiosco' + zeroWidth }), asked],
      [proposal({ paymentMethodRef: 'p'.repeat(PROTOCOL_LIMITS.referenceChars + 1) }), asked], [{ ...copied({}), message: 'x'.repeat(PROTOCOL_LIMITS.messageChars + 1) }, asked],
      [{ ...copied({}), extra: true }, asked], [{ ...copied({}), dropped: ['merchant'] }, asked], [{ ...copied({}), proposals: [copied({}).proposals[0], proposal({}).proposals[0]] }, asked],
      [{ ...copied({}), proposals: [{ ...copied({}).proposals[0], accountId: 'acct-1' }] }, asked], [{ ...copied({}), type: 'answer' }, asked],
      [proposal({ merchant: ' '.repeat(PROTOCOL_LIMITS.merchantChars + 1) }), asked], [{ ...proposal({}), proposals: [] }, asked], [null, asked], ['texto', asked], [{ type: 'proposal', proposals: 'x' }, asked]]) {
      expect(() => recoverAssistantResultV2(bad, asked_), JSON.stringify(bad)).toThrow();
    }
  });

  it('validates the dropped list a server reply carries beside the result: droppable names only, each null in the one proposal, absent is none', () => {
    const kept = validateAssistantResultV2(proposal({}), request);
    expect(validateDroppedFields(undefined, kept)).toEqual([]);
    expect(validateDroppedFields([], kept)).toEqual([]);
    expect(validateDroppedFields(['merchant'], kept)).toEqual(['merchant']);
    expect(validateDroppedFields(['category', 'merchant'], kept)).toEqual(['category', 'merchant']);
    for (const bad of [null, 'merchant', ['paymentMethodRef'], ['merchant', 'merchant'], [1], { merchant: true }, ['amountMinor']]) expect(() => validateDroppedFields(bad, kept), JSON.stringify(bad)).toThrow();
    // A name listed as dropped must be absent from the draft, and only a proposal can have dropped one.
    expect(() => validateDroppedFields(['merchant'], validateAssistantResultV2(proposal({ merchant: 'Kiosco' }), request))).toThrow();
    const scope = validateAssistantResultV2({ type: 'out_of_scope', message: 'No.', evidenceIds: [], navigation: null, proposals: [], clarification: null }, request);
    expect(() => validateDroppedFields(['merchant'], scope)).toThrow();
    expect(validateDroppedFields([], scope)).toEqual([]);
  });

  it('allows emoji joiners in the person\'s text but refuses direction overrides and controls', () => {
    const ask = text => validateAssistantRequest({ version: 2, requestId: 'fixture-request-0001', action: 'parse', text, todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] });
    expect(ask('Gasté 500 en 👨\u200d👩\u200d👧 regalos').text).toContain('\u200d');
    for (const bad of ['a\u202eb', 'a\u2066b', 'a\u0000b', 'a\u001bb']) expect(() => ask(bad)).toThrow();
  });
});
