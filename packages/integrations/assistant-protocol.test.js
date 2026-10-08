import { describe, it, expect } from 'vitest';
import { PROTOCOL_LIMITS, PROTOCOL_CURRENCIES, PROPOSAL_KINDS, validateAssistantResultV2, validateAssistantRequestV2, isSafeModelText, isSafeInputText, unsupportedFigures, figureMinorUnits } from './assistant-protocol.js';
import { MAX_ENTRY_MINOR, parseLocalizedAmount } from '../domain/money.ts';
import { minorUnitExponent } from '../domain/currency.ts';
import { REVIEW_KINDS, parseReviewDraft } from '../domain/review-drafts.ts';

const request = validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'parse', text: 'Gasté 15 mil', todayISO: '2026-09-19', currency: 'ARS', region: 'AR', facts: [] });
const proposal = (fields) => ({ type: 'proposal', message: 'Revisalo.', evidenceIds: [], navigation: null, clarification: null,
  proposals: [{ kind: 'expense', amountMinor: 1500000, currency: null, merchant: null, category: null, dateISO: null, paymentMethodRef: null, ...fields }] });

// Financial calculations belong to the deterministic domain, never to the model (owner decision, 2026-10-08;
// production-plan.md §5.2): an answer may restate the request's own figures and nothing computed. Enforced here, by the
// server on the provider's output and by the device on the server's reply, not only asked for in the instructions.
describe('a reply to a question states only the figures of the facts it cites, exactly', () => {
  const fact = (id, label, amountMinor, count, previous = false) => ({ id, label, amountMinor, count, startISO: previous ? '2026-09-01' : '2026-10-01', endISO: previous ? '2026-09-05' : '2026-10-05' });
  const facts = [fact('current.expenses', 'Gastos registrados', 18450000, 14), fact('previous.expenses', 'Gastos registrados', 15230000, 12, true),
    fact('current.category.0', 'Categoría de gasto: Plan 2030', 7820000, 5), fact('current.income', 'Ingresos registrados', 84250, 1),
    fact('current.category.1', 'Categoría de gasto: Plan: 2030', 500, 5), fact('current.category.2', 'Categoría de gasto: Varios', 100, 1000)];
  const ask = (text = '¿Gasté más que el mes pasado?') => validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'explain', text, todayISO: '2026-10-05', currency: 'ARS', region: 'AR', facts });
  const BOTH = ['current.expenses', 'previous.expenses'];
  const answer = (message, evidenceIds = BOTH) => ({ type: 'answer', message, evidenceIds, navigation: null, proposals: [], clarification: null });
  it('accepts a cited fact\'s amount or count restated in any writing, the periods\' days and years, and a number in a cited label', () => {
    for (const [ok, cited] of [['Llevás $ 184.500 en 14 movimientos; el mes pasado a esta altura, $ 152.300: más.', BOTH], ['Llevás 184.500 pesos.', BOTH], ['Llevás $184.500,00.', BOTH],
      ['Llevás 184500.', BOTH], ['Llevás 184,5 mil.', BOTH], ['Del 1 al 5 de octubre de 2026 registraste 14 movimientos, 12 en septiembre.', BOTH],
      ['Ingresos: $ 842,50 (uno).', ['current.income']], ['Ingresos: ARS 842,5, o sea 842,50 pesos.', ['current.income']], ['En Plan 2030 llevás $ 78.200 en 5 compras.', ['current.category.0']],
      ['No llegaste a ese monto este mes: $ 184.500.', BOTH], ['Fuiste 5 veces al super: 5 compras.', BOTH], ['Hoy, 05/10/2026, a las 14:30.', BOTH],
      ['Del 2026-10-01 al 2026-10-05.', BOTH], ['En Plan: 2030 llevás $ 5 en 5 compras.', ['current.category.1']], ['Categoría de gasto: Plan: 2030, $ 5.', ['current.category.1']],
      ['Gastaste más ($ 184.500 contra $ 152.300).', BOTH], ['En Varios, 1.000 movimientos por $ 1.', ['current.category.2']], ['Del 1 al 5, 14 movimientos.', BOTH]]) {
      expect(unsupportedFigures(ok, ask('¿Gasté más de 100 mil este mes?'), cited), ok).toEqual([]);
      expect(() => validateAssistantResultV2(answer(ok, cited), ask('¿Gasté más de 100 mil este mes?')), ok).not.toThrow();
    }
  });
  // Owner invariant (2026-10-08): every amount keeps its exact minor units. The first reader compared floats within
  // 0.005, so «1,005» passed for a fact of 1,00; now every amount is exact integer minor units, never rounded.
  it('compares exact minor units: no tolerance, no rounding', () => {
    const cents = [fact('current.refunds', 'Devoluciones', 100, 1), fact('current.expenses', 'Gastos registrados', 199, 1), fact('current.income', 'Ingresos registrados', PROTOCOL_LIMITS.maxAmountMinor, 1)];
    const request = validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'explain', text: '¿Cuánto?', todayISO: '2026-10-05', currency: 'ARS', region: 'AR', facts: cents });
    const all = cents.map(item => item.id);
    for (const ok of ['Te devolvieron $ 1.', 'Te devolvieron $ 1,00.', 'Te devolvieron 1 peso: $ 1,0.', 'Te devolvieron 100 centavos.', 'Gastaste $ 1,99.', 'Gastaste 1,99 pesos.', 'Cobraste $ 9.999.999.999.999,99.'])
      expect(unsupportedFigures(ok, request, all), ok).toEqual([]);
    for (const [bad, figures] of [['Te devolvieron $ 1,005.', ['1,005']], ['Te devolvieron $ 1,004.', ['1,004']], ['Gastaste $ 2.', ['2']], ['Gastaste $ 2,00.', ['2,00']], ['Gastaste $ 1,9.', ['1,9']],
      ['Cobraste $ 9.999.999.999.999,98.', ['9.999.999.999.999,98']], ['Cobraste $ 10.000.000.000.000.', ['10.000.000.000.000']], ['Cobraste 1e13 pesos.', ['1e13']]]) {
      expect(unsupportedFigures(bad, request, all), bad).toEqual(figures);
    }
    expect(figureMinorUnits('184,5', 'mil')).toEqual([18450000n]);
    expect(figureMinorUnits('0,5', 'millones')).toEqual([50000000n]);
  });
  // Owner review (2026-10-08): a figure's visible value is what a reader of rioplatense Spanish understands. The earlier
  // reader read «1.000» both as a thousand and as 1,000 (three decimals) and accepted whichever matched a fact, so a
  // fact of 1,00 could be shown as «$1.000». The reply's numeric writing is now a contract: Argentine writing only.
  it('reads «1.000» as one thousand only, and refuses a US writing or a non-canonical one even when a reading would match', () => {
    const one = fact('current.refunds', 'Devoluciones', 100, 1), thousand = fact('current.expenses', 'Gastos registrados', 100000, 1), usd = fact('current.income', 'Ingresos registrados', 199, 1);
    const request = validateAssistantRequestV2({ version: 2, requestId: 'fixture-request-0001', action: 'explain', text: '¿Cuánto?', todayISO: '2026-10-05', currency: 'ARS', region: 'AR', facts: [one, thousand, usd] });
    expect(unsupportedFigures('Te devolvieron $ 1.000.', request, [one.id])).toEqual(['1.000']); // one thousand is not one peso
    expect(unsupportedFigures('Gastaste $ 1.000.', request, [thousand.id])).toEqual([]);
    expect(unsupportedFigures('Gastaste $ 1.000,00 (mil pesos: 1000).', request, [thousand.id])).toEqual([]);
    for (const bad of ['Gastaste $ 1,000.', 'Gastaste $ 1,000.00.', 'Gastaste $1000.00.']) expect(unsupportedFigures(bad, request, [thousand.id]), bad).toEqual([bad.match(/[\d.,]+\d/)[0]]);
    for (const bad of ['Cobraste $ 2,00.', 'Cobraste $ 1,9.', 'Cobraste $ 1.99.', 'Cobraste $ 1,990.']) expect(unsupportedFigures(bad, request, [usd.id]), bad).toEqual([bad.match(/[\d.,]+\d/)[0]]);
    expect(unsupportedFigures('Cobraste $ 1,99.', request, [usd.id])).toEqual([]);
    expect(figureMinorUnits('1.000')).toEqual([100000n]);
    for (const token of ['1,000', '842.50', '1,234.56', '1.23.456', '0500', '007', '1.0', '12.5', '184,500', '1.2345']) expect(figureMinorUnits(token), token).toEqual([]);
  });
  it('is the domain\'s Argentine reading of a canonical amount, and stricter where the domain forgives extra zero decimals (drift test)', () => {
    for (const currency of PROTOCOL_CURRENCIES) expect(minorUnitExponent(currency), currency).toBe(2);
    const argentine = { decimal: ',', group: '.' };
    const forgiven = [];
    for (const token of ['184.500', '184,500', '1.234,56', '1,234.56', '842,50', '842.50', '842,5', '0,500', '0.500', '1.005', '1,005', '12.5', '12,5', '184500', '1.000', '1,000', '1.234.567', '1,234,567', '1.23.456', '0.1.2', '007', '0,50', '1,0']) {
      const domain = parseLocalizedAmount(token, 'ARS', argentine);
      const contract = figureMinorUnits(token);
      if (contract.length) expect(domain.ok && BigInt(domain.minor), token).toBe(contract[0]); // never a value the domain would not read
      else if (domain.ok) forgiven.push(token);
    }
    // The input reader forgives decimals beyond the second when they are zeros, and leading zeros; the reply's contract
    // refuses both: a reader of «1,000» cannot tell one peso from a thousand at a glance, and «007» is no amount.
    expect(forgiven).toEqual(['184,500', '0,500', '1,000', '007']);
  });
  // Owner invariant (2026-10-08): a number from the person's question is never a ledger figure, and an uncited fact's
  // figure is not what the rows show. The first reader accepted both; a false assertion built on the question's own
  // threshold («Sí, gastaste 200») reached the person.
  it('refuses the person\'s own number as an assertion, and a figure of a fact the reply does not cite', () => {
    const request = ask('¿Gasté más de 200 este mes?');
    for (const [bad, figures, cited] of [['Sí, gastaste 200 este mes.', ['200'], BOTH], ['Sí, superaste los $ 200: llevás $ 184.500.', ['200'], BOTH], ['Sí, pasaste los 200 pesos.', ['200'], BOTH],
      ['Cobraste $ 842,50.', ['842,50'], BOTH], ['Llevás $ 184.500.', ['184.500'], ['current.income']], ['En Plan 2030 llevás $ 78.200.', ['2030', '78.200'], BOTH],
      // A cited label's number only inside the name, bare: never as money, signed, a percentage or alone (Codex review).
      ['Gastaste $2030 en esa categoría.', ['2030'], ['current.category.0']], ['Gastaste -2030.', ['2030'], ['current.category.0']], ['Subió 2030%.', ['2030%'], ['current.category.0']],
      ['Gastaste 2030 en esa categoría.', ['2030'], ['current.category.0']], ['Son 2.030 pesos en Plan 2030.', ['2.030'], ['current.category.0']],
      ['Plan 2030 tuvo 2030 compras.', ['2030'], ['current.category.0']], // only the occurrence inside the name is the label's
      // A monetary mark beside a small integer makes it money (Codex review): a subunit is read in minor units, another
      // currency is refused, and so is the other protocol currency in a request of this one (a conversion).
      ['Gastaste 1 peso.', ['1'], BOTH], ['Gastaste 20 centavos.', ['20'], BOTH], ['Eso equivale a 20 euros.', ['20'], BOTH], ['Son € 20.', ['20'], BOTH], ['Son 20 EUR.', ['20'], BOTH],
      ['Llevás US$ 184.500.', ['184.500'], BOTH], ['Llevás 184.500 dólares.', ['184.500'], BOTH], ['Cobraste 84.250 centavos.', ['84.250'], ['current.income']],
      // Codex review of 1c66b93: a sign before any monetary mark; marks on both sides; a name holding a colon stays whole.
      ['Llevás - AR$ 184.500.', ['184.500'], BOTH], ['Llevás − pesos 184.500.', ['184.500'], BOTH], ['Llevás ARS 184.500 dólares.', ['184.500'], BOTH], ['Llevás $ 184.500 euros.', ['184.500'], BOTH],
      ['2030 compras en esa categoría.', ['2030'], ['current.category.1']], ['Plan 2030 tuvo 5 compras: $ 5.', ['2030'], ['current.category.1']], // the name is «Plan: 2030», not «Plan 2030»
      // Codex review of 4f4f94b: accounting negatives, magnitudes beyond the protocol or stacked, a currency after «en»/«de».
      ['Gastaste ($ 184.500).', ['184.500'], BOTH], ['Gastaste 184.500-.', ['184.500'], BOTH], ['El total es 2 billones de pesos.', ['2 billones'], BOTH], ['Son 184,5 mil millones.', ['184,5 mil'], BOTH],
      ['Llevás ARS 184.500 en dólares.', ['184.500'], BOTH], ['Llevás $ 184.500 de euros.', ['184.500'], BOTH], ['Hubo 1.000 movimientos.', ['1.000'], BOTH], ['Del 1 al 5 - 14 movimientos.', ['14'], BOTH], // a spaced dash before a figure is a sign (fail closed)
      // Codex review of 2512f15: a suffix mark inside an accounting negative; any other currency symbol fails closed.
      ['Gastaste (184.500 pesos).', ['184.500'], BOTH], ['Gastaste ($ 184.500 pesos).', ['184.500'], BOTH], ['Llevás ₹184.500.', ['184.500'], BOTH], ['Llevás 184.500 ₩.', ['184.500'], BOTH],
      // Codex review of e93f931: an unlisted code in capitals; every consecutive mark on a side; a trailing dash of any kind.
      ['Llevás CAD 184.500.', ['184.500'], BOTH], ['Llevás 184.500 AUD.', ['184.500'], BOTH], ['Llevás USD ARS 184.500.', ['184.500'], BOTH], ['Llevás 184.500 ARS USD.', ['184.500'], BOTH],
      ['Llevás 184.500 pesos dólares.', ['184.500'], BOTH], ['Llevás 184.500－.', ['184.500'], BOTH], ['Llevás 184.500 pesos-.', ['184.500'], BOTH],
      // Codex review of f020dc7: a sign or a parenthesis across several consecutive marks.
      ['Llevás - ARS $ 184.500.', ['184.500'], BOTH], ['Gastaste (ARS $ 184.500 pesos).', ['184.500'], BOTH], ['Llevás 184.500 pesos ARS-.', ['184.500'], BOTH],
      // Codex review of 03b4cd3: a mark across a colon, a comma or a bracket.
      ['Llevás USD: 184.500.', ['184.500'], BOTH], ['Llevás 184.500 (USD).', ['184.500'], BOTH], ['Llevás $184.500 (dólares).', ['184.500'], BOTH],
      // Every Unicode dash or minus before an amount is a sign: the small and fullwidth hyphen-minus, the en dash.
      ['Llevás \ufe6378.200 pesos.', ['78.200'], ['current.category.0']], ['Llevás \uff0d78.200 pesos.', ['78.200'], ['current.category.0']], ['Llevás \u201378.200.', ['78.200'], ['current.category.0']]]) {
      expect(unsupportedFigures(bad, request, cited), bad).toEqual(figures);
      expect(() => validateAssistantResultV2(answer(bad, cited), request), bad).toThrow();
    }
    // A bare small integer still passes as a day or a small count: the one residual way a question's number can be echoed.
    expect(unsupportedFigures('Sí, pasaste los 20.', ask('¿Gasté más de 20?'), BOTH)).toEqual([]);
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
      ['Gastaste 2\u200d1\u200d8\u200d0\u200d0 más.', ['2', '1', '8', '0', '0']],
      // Codex review: a minus attached to a non-negative fact, a currency mark between, or an exponent as one token.
      ['Llevás -$ 184.500.', ['184.500']], ['Llevás $-184.500.', ['184.500']], ['Llevás −184.500 pesos.', ['184.500']], ['Gastaste 2e6.', ['2e6']], ['Gastaste 1.845e5 pesos.', ['1.845e5']],
      // A spaced sign is a sign too (fail closed): a dash before an amount is refused unless a digit precedes it (a date).
      ['Llevás - 184.500.', ['184.500']], ['Llevás - $ 184.500.', ['184.500']], ['Llevás $ - 184.500.', ['184.500']], ['Gastos registrados - 14 movimientos.', ['14']],
      // The person's number, in any writing, is not evidence (owner invariant: a threshold is not a ledger total).
      ['No, no llegaste a 100 mil este mes: $ 184.500.', ['100 mil']], ['No, no llegaste a $ 100.000 este mes.', ['100.000']]]) {
      expect(unsupportedFigures(bad, ask('¿Gasté más de 100 mil este mes?'), BOTH), bad).toEqual(figures);
      expect(() => validateAssistantResultV2(answer(bad), ask('¿Gasté más de 100 mil este mes?')), bad).toThrow();
    }
  });
  it('reads a run of marks in linear time: no input makes the reader backtrack (security review)', () => {
    const request = ask();
    for (const text of [`Llevás - ${'USD '.repeat(400)}184.500.`, `Llevás (${'ARS $ '.repeat(300)}184.500${' pesos'.repeat(300)}).`, `${'$ '.repeat(600)}1`, `1${' USD'.repeat(600)}-`]) {
      const started = performance.now();
      expect(unsupportedFigures(text, request, BOTH).length, text.slice(0, 40)).toBeGreaterThan(0);
      expect(performance.now() - started, text.slice(0, 40)).toBeLessThan(200);
    }
  });
  it('applies to every reply to a question, so a computed figure cannot hide in a clarification; a draft or a question on parse may repeat the person\'s own number', () => {
    const inQuestion = { type: 'clarification', message: 'Gastaste $ 32.200 más que el mes pasado; ¿querés el detalle por categoría?', evidenceIds: [], navigation: null, proposals: [], clarification: { field: 'category', candidateIds: [] } };
    const inRefusal = { type: 'out_of_scope', message: 'No puedo hacer eso. Gastaste $ 32.200 más.', evidenceIds: [], navigation: null, proposals: [], clarification: null };
    expect(() => validateAssistantResultV2(inQuestion, ask())).toThrow();
    expect(() => validateAssistantResultV2(inRefusal, ask())).toThrow();
    expect(() => validateAssistantResultV2({ ...inQuestion, message: '¿Querés el detalle de los $ 184.500 por categoría?', evidenceIds: ['current.expenses'] }, ask())).not.toThrow();
    expect(() => validateAssistantResultV2({ ...inQuestion, message: '¿Querés el detalle de los $ 184.500 por categoría?' }, ask())).toThrow(); // uncited
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
