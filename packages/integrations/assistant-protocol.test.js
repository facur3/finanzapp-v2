import { describe, it, expect } from 'vitest';
import { PROTOCOL_LIMITS, PROTOCOL_CURRENCIES, PROPOSAL_KINDS, validateAssistantResultV2, validateAssistantRequestV2, isSafeModelText, isSafeInputText } from './assistant-protocol.js';
import { MAX_ENTRY_MINOR } from '../domain/money.ts';
import { REVIEW_KINDS, parseReviewDraft } from '../domain/review-drafts.ts';

const request = validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'parse', text: 'Gasté 15 mil', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] });
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
  it('allows emoji joiners in the person\'s text but refuses direction overrides and controls', () => {
    const ask = text => validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'parse', text, todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] });
    expect(ask('Gasté 500 en 👨\u200d👩\u200d👧 regalos').text).toContain('\u200d');
    for (const bad of ['a\u202eb', 'a\u2066b', 'a\u0000b', 'a\u001bb']) expect(() => ask(bad)).toThrow();
  });
});
