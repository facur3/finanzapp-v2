import { isoFromLabel, todayKey } from './dates.js';

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9$.,/\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSpokenAmount(value) {
  const text = fold(value);
  const million = text.match(/(?:\$|ars|usd|us\$)?\s*(\d+(?:[.,]\d+)?)\s*(?:millones?|millon)\b/);
  if (million) return Math.round(Number(million[1].replace(',', '.')) * 1000000 * 100) / 100;
  const thousand = text.match(/(?:\$|ars|usd|us\$)?\s*(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (thousand) return Math.round(Number(thousand[1].replace(',', '.')) * 1000 * 100) / 100;

  const candidates = [...text.matchAll(/(?:\$|ars|usd|us\$)?\s*(\d[\d.\s]*(?:,\d{1,2})?)/g)]
    .map(match => match[1].trim())
    .filter(Boolean)
    .map(raw => {
      const compact = raw.replace(/\s/g, '');
      if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(compact)) {
        return Number(compact.replace(/\./g, '').replace(',', '.'));
      }
      if (/^\d+,\d{1,2}$/.test(compact)) return Number(compact.replace(',', '.'));
      return Number(compact.replace(/\./g, ''));
    })
    .filter(number => Number.isFinite(number) && number > 0);
  return candidates.length ? Math.max(...candidates) : null;
}

function entries(value) {
  if (Array.isArray(value)) return value;
  return Object.keys(value || {}).map(id => ({ id, ...(value[id] || {}) }));
}

function matchEntity(list, text, fields = ['name']) {
  const haystack = fold(text);
  const scored = entries(list).map((item, index) => {
    const variants = fields.map(field => fold(item[field])).filter(Boolean);
    const score = variants.reduce((best, name) => {
      if (haystack.includes(name)) return Math.max(best, 100 + name.length);
      const tokens = name.split(' ').filter(token => token.length > 2);
      const hits = tokens.filter(token => haystack.includes(token)).length;
      return Math.max(best, hits ? hits * 10 + name.length / 100 : 0);
    }, 0);
    return { item, score, index };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0] ? scored[0].item : null;
}

export function resolveAssistantReferences(value, context = {}) {
  const draft = { ...(value || {}) };
  const account = !draft.accountId && draft.accountRef ? matchEntity(context.accounts, draft.accountRef, ['name', 'type']) : null;
  const category = !draft.categoryId && draft.categoryRef ? matchEntity(context.categories, draft.categoryRef, ['name']) : null;
  const card = !draft.cardId && draft.cardRef ? matchEntity(context.cards, draft.cardRef, ['brand', 'bank', 'last4']) : null;
  const recurring = !draft.recurringId && draft.recurringRef ? matchEntity(context.recurring, draft.recurringRef, ['concept', 'name']) : null;
  if (account) draft.accountId = account.id;
  if (category) draft.categoryId = category.id;
  if (card) draft.cardId = card.id;
  if (recurring) draft.recurringId = recurring.id;
  return draft;
}

function spokenDate(text, now) {
  const value = fold(text);
  const iso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return isoFromLabel(iso[1], now);
  const slash = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const ref = new Date(now || Date.now());
    let year = slash[3] ? Number(slash[3]) : ref.getFullYear();
    if (year < 100) year += 2000;
    return isoFromLabel(year + '-' + String(slash[2]).padStart(2, '0') + '-' + String(slash[1]).padStart(2, '0'), ref);
  }
  if (value.includes('anteayer')) return isoFromLabel('Anteayer', now);
  if (value.includes('ayer')) return isoFromLabel('Ayer', now);
  return todayKey(new Date(now || Date.now()));
}

function merchantFromText(text, type, excluded = []) {
  let clean = String(text || '')
    .replace(/(?:\$|ARS|USD|US\$)?\s*\d[\d.\s]*(?:,\d{1,2})?\s*(?:millones?|mill[oó]n|mil)?/gi, ' ')
    .replace(/(^|[^\p{L}\p{N}])(hoy|ayer|anteayer|el \d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/(^|[^\p{L}\p{N}])(gast[eé]|pagu[eé]|compr[eé]|abon[eé]|cobr[eé]|recib[ií]|deposit[eé]|ingres[oó]|me pagaron|un gasto|un ingreso|de|desde|con|en|a|por)(?=$|[^\p{L}\p{N}])/giu, ' ');
  for (const phrase of excluded.filter(Boolean)) {
    const variants = [String(phrase), ...String(phrase).split(/\s+/).filter(token => token.length > 2)];
    for (const variant of variants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clean = clean.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + escaped + '(?=$|[^\\p{L}\\p{N}])', 'giu'), ' ');
    }
  }
  clean = clean
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return type === 'ingreso' ? 'Ingreso' : 'Gasto';
  clean = clean.slice(0, 80);
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function baseDraft(intent, now) {
  return {
    intent,
    transactionType: 'none',
    amount: null,
    currency: 'ARS',
    merchant: '',
    categoryId: '',
    accountId: '',
    cardId: '',
    recurringId: '',
    dateISO: todayKey(new Date(now || Date.now())),
    tags: ['asistente'],
    explanation: '',
    confidence: 0,
    source: 'local',
  };
}

export function parseAssistantCommand(text, context = {}, now = new Date()) {
  const normalized = fold(text);
  if (!normalized) return { ...baseDraft('none', now), explanation: 'Escribí o decí qué movimiento querés registrar.' };
  const accounts = entries(context.accounts).filter(account => !context.archived || !context.archived[account.id]);
  const categories = entries(context.categories).filter(category => !category.archived);
  const recurring = entries(context.recurring);
  const cards = entries(context.cards);
  const account = matchEntity(accounts, normalized, ['name', 'type']);
  const category = matchEntity(categories, normalized, ['name']);
  const card = matchEntity(cards, normalized, ['brand', 'bank', 'last4']);
  const amount = parseSpokenAmount(normalized);
  const dateISO = spokenDate(normalized, now);
  const wantsFullCard = /\b(total|complet[ao]|todo|resumen)\b/.test(normalized);
  const cardWords = /\b(tarjeta|visa|mastercard|master|amex|resumen)\b/.test(normalized);
  const paymentWords = /\b(pague|pagar|abone|abonar|pago)\b/.test(normalized);

  if (cardWords && paymentWords) {
    const draft = baseDraft('card_payment', now);
    draft.amount = wantsFullCard ? null : amount;
    draft.accountId = account ? account.id : '';
    draft.cardId = card ? card.id : '';
    draft.dateISO = dateISO;
    draft.explanation = 'Preparé el pago de tarjeta para que lo revises antes de registrarlo.';
    draft.confidence = (card || cards.length === 1) && (account || accounts.length === 1) && (wantsFullCard || amount) ? 0.94 : 0.63;
    return draft;
  }

  const incomeWords = /\b(cobre|recibi|depositaron|ingreso|me pagaron|acreditaron|sueldo|salario|honorarios)\b/.test(normalized);
  const expenseWords = /\b(gaste|pague|compre|abone|salio|gasto)\b/.test(normalized);
  const matchedRecurring = matchEntity(recurring, normalized, ['concept', 'name']);
  const salaryRecurring = incomeWords && /\b(sueldo|salario|cobre)\b/.test(normalized)
    ? recurring.find(item => item.type === 'ingreso' && /sueldo|salario|honorario/.test(fold(item.concept || item.name)))
    : null;
  const recurringItem = matchedRecurring || salaryRecurring;
  if (recurringItem && (incomeWords || expenseWords) && !amount) {
    const draft = baseDraft('recurring', now);
    draft.recurringId = recurringItem.id;
    draft.transactionType = recurringItem.type || (incomeWords ? 'ingreso' : 'gasto');
    draft.amount = Number(recurringItem.amount) || null;
    draft.accountId = account ? account.id : (recurringItem.targetKind === 'account' ? recurringItem.targetId : '');
    draft.cardId = recurringItem.targetKind === 'card' ? recurringItem.targetId : '';
    draft.categoryId = recurringItem.cat || '';
    draft.merchant = recurringItem.concept || recurringItem.name || 'Recurrente';
    draft.dateISO = dateISO;
    draft.tags = ['asistente', 'recurrente'];
    draft.explanation = 'Encontré este movimiento en tus recurrentes y usé los datos que ya habías guardado.';
    draft.confidence = draft.amount ? 0.97 : 0.68;
    return draft;
  }

  if (incomeWords || expenseWords) {
    const type = incomeWords && !expenseWords ? 'ingreso' : 'gasto';
    const draft = baseDraft('transaction', now);
    draft.transactionType = type;
    draft.amount = amount;
    draft.accountId = account ? account.id : (accounts.length === 1 ? accounts[0].id : '');
    draft.categoryId = category ? category.id : (type === 'ingreso' ? 'ingreso' : '');
    draft.merchant = merchantFromText(text, type, [category && category.name, account && account.name, card && card.brand, 'tarjeta']);
    draft.dateISO = dateISO;
    draft.explanation = 'Entendí un ' + (type === 'ingreso' ? 'ingreso' : 'gasto') + '. Revisá los datos antes de guardarlo.';
    draft.confidence = amount ? (draft.accountId ? 0.88 : 0.72) : 0.45;
    return draft;
  }

  return { ...baseDraft('none', now), explanation: 'No pude convertir eso en un movimiento todavía. Probá incluir qué pasó, el monto y la cuenta.', confidence: 0.1 };
}

export function normalizeAssistantDraft(value, context = {}, now = new Date()) {
  const allowedIntents = ['transaction', 'recurring', 'card_payment', 'none'];
  const draft = { ...baseDraft('none', now), ...(value || {}) };
  if (!allowedIntents.includes(draft.intent)) draft.intent = 'none';
  if (!['gasto', 'ingreso', 'none'].includes(draft.transactionType)) draft.transactionType = 'none';
  const amount = Number(draft.amount);
  draft.amount = Number.isFinite(amount) && amount > 0 && amount < 1e15 ? Math.round(amount * 100) / 100 : null;
  const accountIds = new Set(entries(context.accounts).map(item => String(item.id)));
  const categoryIds = new Set(entries(context.categories).map(item => String(item.id)));
  const cardIds = new Set(entries(context.cards).map(item => String(item.id)));
  const recurringIds = new Set(entries(context.recurring).map(item => String(item.id)));
  draft.accountId = accountIds.has(String(draft.accountId)) ? String(draft.accountId) : '';
  draft.categoryId = categoryIds.has(String(draft.categoryId)) ? String(draft.categoryId) : '';
  draft.cardId = cardIds.has(String(draft.cardId)) ? String(draft.cardId) : '';
  draft.recurringId = recurringIds.has(String(draft.recurringId)) ? String(draft.recurringId) : '';
  ['accountRef', 'categoryRef', 'cardRef', 'recurringRef'].forEach(key => { draft[key] = String(draft[key] || '').trim().slice(0, 80); });
  draft.currency = draft.currency === 'USD' ? 'USD' : 'ARS';
  draft.dateISO = isoFromLabel(draft.dateISO, now);
  draft.merchant = String(draft.merchant || '').trim().slice(0, 80);
  draft.tags = [...new Set((Array.isArray(draft.tags) ? draft.tags : []).map(tag => fold(tag).replace(/\s/g, '-')).filter(Boolean))].slice(0, 8);
  if (!draft.tags.includes('asistente')) draft.tags.unshift('asistente');
  draft.explanation = String(draft.explanation || '').trim().slice(0, 240);
  draft.confidence = Math.max(0, Math.min(1, Number(draft.confidence) || 0));
  draft.source = draft.source === 'openai' ? 'openai' : 'local';
  return draft;
}
