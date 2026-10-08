import { describe, it, expect } from 'vitest';
import { PROTOCOL_LIMITS, PROTOCOL_CURRENCIES, PROPOSAL_KINDS, validateAssistantResultV2, validateAssistantRequestV2, isSafeModelText, isSafeInputText, unsupportedFigures } from './assistant-protocol.js';
import { MAX_ENTRY_MINOR } from '../domain/money.ts';
import { REVIEW_KINDS, parseReviewDraft } from '../domain/review-drafts.ts';

const request = validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'parse', text: 'Gasté 15 mil', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] });
const proposal = (fields) => ({ type: 'proposal', message: 'Revisalo.', evidenceIds: [], navigation: null, clarification: null,
  proposals: [{ kind: 'expense', amountMinor: 1500000, currency: null, merchant: null, category: null, dateISO: null, paymentMethodRef: null, ...fields }] });

// Financial calculations belong to the deterministic domain, never to the model (owner decision, 2026-10-08;
// production-plan.md §5.2): an answer may restate the request's own figures and nothing computed. Enforced here, by the
// server on the provider's output and by the device on the server's reply, not only asked for in the instructions.
describe('an answer states only the figures the request holds', () => {
  const fact = (id, label, amountMinor, count, previous = false) => ({ id, label, amountMinor, count, startISO: previous ? '2026-09-01' : '2026-10-01', endISO: previous ? '2026-09-05' : '2026-10-05' });
  const facts = [fact('current.expenses', 'Gastos registrados', 18450000, 14), fact('previous.expenses', 'Gastos registrados', 15230000, 12, true),
    fact('current.category.0', 'Categoría de gasto: Plan 2030', 7820000, 5), fact('current.income', 'Ingresos registrados', 84250, 1)];
  const ask = (text = '¿Gasté más que el mes pasado?') => validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'explain', text, todayISO: '2026-10-05', currency: 'ARS', region: 'AR', facts });
  const answer = (message, evidenceIds = ['current.expenses', 'previous.expenses']) => ({ type: 'answer', message, evidenceIds, navigation: null, proposals: [], clarification: null });
  it('accepts a fact\'s amount or count restated in any writing, the periods\' days and years, and what the person or a label wrote', () => {
    for (const ok of ['Llevás $ 184.500 en 14 movimientos; el mes pasado a esta altura, $ 152.300: más.', 'Llevás 184.500 pesos.', 'Llevás $184,500.00.', 'Llevás 184500.', 'Llevás 184,5 mil.',
      'Del 1 al 5 de octubre de 2026 registraste 14 movimientos, 12 en septiembre.', 'Ingresos: $ 842,50 (uno).', 'Ingresos: US$ 842.50.',
      'En Plan 2030 llevás $ 78.200 en 5 compras.', 'No, no llegaste a 100 mil este mes: $ 184.500.', 'No, no llegaste a $ 100.000 este mes.', // the person's number, in another writing
      'Fuiste 5 veces al super: 5 compras.', 'Hoy, 05/10/2026, a las 14:30.']) {
      expect(unsupportedFigures(ok, ask('¿Gasté más de 100 mil este mes?')), ok).toEqual([]);
      expect(() => validateAssistantResultV2(answer(ok), ask('¿Gasté más de 100 mil este mes?')), ok).not.toThrow();
    }
    // A figure an uncited fact holds is still the request's own (verified data), even if the citation is missing.
    expect(unsupportedFigures('Cobraste $ 842,50.', ask())).toEqual([]);
  });
  it('refuses a difference, a percentage, a rounding, a total, a fabricated count, or an amount with its cents dropped', () => {
    for (const [bad, figures] of [['Gastaste $ 32.200 más que el mes pasado.', ['32.200']], ['Un 21% más.', ['21%']], ['Casi 185 mil, unos $ 184.000.', ['185 mil', '184.000']],
      ['Entre gastos e ingresos van $ 185.342,50.', ['185.342,50']], ['Fueron 40 movimientos.', ['40']], ['Cobraste $ 842.', ['842']], ['Medio millón: 0,5 millones.', ['0,5 millones']],
      ['Gastaste 1 millón.', ['1 millón']], ['Ingresaste 8 lucas.', ['8 lucas']],
      // Adversarial review of this change: a percentage in words; a thousands-shaped round figure that read as a small
      // integer or a count («22.000» as 22, «$ 14.000» as the count 14); a figure inside a longer number the person wrote
      // («50.000» in «150.000»); colloquial money marks; another script's digits; a format character glued to digits.
      ['Subió un 21 por ciento.', ['21 por ciento']], ['Spending fell 7 percent.', ['7 percent']], ['Unos 22.000 más.', ['22.000']], ['Gastaste $ 14.000 más.', ['14.000']],
      ['Gastaste 50.000 este mes.', ['50.000']], ['Llevás 31 mangos más.', ['31']], ['You spent u$s 12 more.', ['12']], ['Gastaste $ ٣٢٢٠٠ más.', ['٣']],
      ['Gastaste 2\u200d1\u200d8\u200d0\u200d0 más.', ['2', '1', '8', '0', '0']]]) {
      expect(unsupportedFigures(bad, ask('¿Gasté más de 150.000 este mes?')), bad).toEqual(figures);
      expect(() => validateAssistantResultV2(answer(bad), ask('¿Gasté más de 150.000 este mes?')), bad).toThrow();
    }
  });
  it('applies to every reply to a question, so a computed figure cannot hide in a clarification; a draft or a question on parse may repeat the person\'s own number', () => {
    const inQuestion = { type: 'clarification', message: 'Gastaste $ 32.200 más que el mes pasado; ¿querés el detalle por categoría?', evidenceIds: [], navigation: null, proposals: [], clarification: { field: 'category', candidateIds: [] } };
    const inRefusal = { type: 'out_of_scope', message: 'No puedo hacer eso. Gastaste $ 32.200 más.', evidenceIds: [], navigation: null, proposals: [], clarification: null };
    expect(() => validateAssistantResultV2(inQuestion, ask())).toThrow();
    expect(() => validateAssistantResultV2(inRefusal, ask())).toThrow();
    expect(() => validateAssistantResultV2({ ...inQuestion, message: '¿Querés el detalle de los $ 184.500 por categoría?' }, ask())).not.toThrow();
    const parse = validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'parse', text: 'Gasté 2000 en el kiosco', todayISO: '2026-10-05', currency: 'ARS', region: 'AR', facts: [] });
    expect(() => validateAssistantResultV2({ type: 'clarification', message: '¿Los 2000 fueron pesos o dólares?', evidenceIds: [], navigation: null, proposals: [], clarification: { field: 'currency', candidateIds: [] } }, parse)).not.toThrow();
    expect(() => validateAssistantResultV2({ type: 'proposal', message: 'Revisá este gasto de 2000.', evidenceIds: [], navigation: null, clarification: null,
      proposals: [{ kind: 'expense', amountMinor: 200000, currency: null, merchant: null, category: null, dateISO: null, paymentMethodRef: null }] }, parse)).not.toThrow();
  });
});

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
