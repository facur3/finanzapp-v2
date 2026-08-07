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

const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTH_INDEX = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
const CATEGORY_HINTS = [
  { aliases: ['comida', 'alimentacion', 'alimentos'], terms: ['hamburguesa', 'pizza', 'empanada', 'restaurante', 'restaurant', 'cafeteria', 'cafe', 'comida', 'almuerzo', 'cena', 'desayuno', 'delivery', 'rappi', 'pedidos ya', 'pedidosya', 'supermercado', 'verduleria', 'kiosco'] },
  { aliases: ['auto', 'transporte', 'movilidad'], terms: ['uber', 'cabify', 'taxi', 'sube', 'colectivo', 'subte', 'tren', 'nafta', 'combustible', 'ypf', 'shell', 'peaje', 'estacionamiento'] },
  { aliases: ['compras', 'shopping'], terms: ['amazon', 'mercado libre', 'mercadolibre', 'ropa', 'zapatilla', 'calzado', 'electrodomestico'] },
  { aliases: ['ocio', 'entretenimiento'], terms: ['cine', 'netflix', 'spotify', 'juego', 'gaming', 'teatro', 'recital', 'salida'] },
  { aliases: ['mascotas', 'mascota'], terms: ['veterinaria', 'veterinario', 'perro', 'gato', 'mascota'] },
  { aliases: ['tarjetas', 'tarjeta'], terms: ['visa', 'mastercard', 'amex', 'resumen de tarjeta'] },
  { aliases: ['inversiones', 'inversion'], terms: ['cedear', 'bono', 'cripto', 'fci', 'caucion', 'accion'] },
];

function hasTerm(text, term) {
  const escaped = fold(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const plural = fold(term).includes(' ') ? '' : '(?:s|es)?';
  return new RegExp('(^|\\s)' + escaped + plural + '(?=$|\\s|[.,;])').test(fold(text));
}

function categoryFromText(categories, text) {
  const direct = matchEntity(categories, text, ['name']);
  if (direct) return direct;
  const available = entries(categories).filter(category => category.type === 'gasto' && !category.archived);
  for (const hint of CATEGORY_HINTS) {
    if (!hint.terms.some(term => hasTerm(text, term))) continue;
    const category = available.find(item => hint.aliases.some(alias => {
      const value = fold(item.id + ' ' + (item.name || ''));
      return value === alias || value.split(' ').includes(alias) || value.includes(alias);
    }));
    if (category) return category;
  }
  return null;
}

function categoryFromHistory(categories, transactions, merchant) {
  if (!merchant) return null;
  const match = entries(transactions).find(transaction => fold(transaction.merchant) === fold(merchant) && transaction.cat);
  return match ? entries(categories).find(category => String(category.id) === String(match.cat) && !category.archived) || null : null;
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
  const ref = new Date(now || Date.now());
  ref.setHours(0, 0, 0, 0);
  const iso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return isoFromLabel(iso[1], now);
  const slash = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    let year = slash[3] ? Number(slash[3]) : ref.getFullYear();
    if (year < 100) year += 2000;
    return isoFromLabel(year + '-' + String(slash[2]).padStart(2, '0') + '-' + String(slash[1]).padStart(2, '0'), ref);
  }
  const named = value.match(/\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/);
  if (named) {
    const day = Number(named[1]), month = MONTH_INDEX[named[2]];
    let year = named[3] ? Number(named[3]) : ref.getFullYear();
    let date = new Date(year, month, day);
    if (!named[3]) {
      const distance = date - ref;
      if (distance > 183 * 86400000) date = new Date(year - 1, month, day);
      else if (distance < -183 * 86400000) date = new Date(year + 1, month, day);
    }
    if (date.getMonth() === month && date.getDate() === day) return todayKey(date);
  }
  if (value.includes('anteayer')) return isoFromLabel('Anteayer', now);
  if (value.includes('ayer')) return isoFromLabel('Ayer', now);
  const ago = value.match(/\bhace\s+(\d{1,3})\s+dias?\b/);
  if (ago) {
    const date = new Date(ref);
    date.setDate(date.getDate() - Number(ago[1]));
    return todayKey(date);
  }
  const weekday = value.match(/\b(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?:\s+(anterior|pasad[oa]|ultim[oa])|\s+de\s+la\s+semana\s+pasada)?\b/);
  if (weekday) {
    let days = (ref.getDay() - WEEKDAYS[weekday[1]] + 7) % 7;
    if (days === 0 && weekday[2]) days = 7;
    const date = new Date(ref);
    date.setDate(date.getDate() - days);
    return todayKey(date);
  }
  if (/\b(?:la\s+)?semana\s+pasada\b/.test(value)) {
    const date = new Date(ref);
    date.setDate(date.getDate() - 7);
    return todayKey(date);
  }
  return todayKey(ref);
}

function stripSpokenDates(value) {
  return String(value || '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/giu, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/giu, ' ')
    .replace(/\b(?:el\s+)?\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+\d{4})?\b/giu, ' ')
    .replace(/\b(?:hoy|anteayer|ayer|hace\s+\d{1,3}\s+d[ií]as?|(?:la\s+)?semana\s+pasada)\b/giu, ' ')
    .replace(/\b(?:el\s+)?(?:domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(?:(?:\s+(?:anterior|pasad[oa]|[uú]ltim[oa]))|(?:\s+de\s+la\s+semana\s+pasada))?\b/giu, ' ');
}

function titleValue(value) {
  const clean = String(value || '').replace(/^[\s,;.-]+|[\s,;.-]+$/g, '').replace(/\s+/g, ' ').slice(0, 80);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
}

function placeFromText(text, excluded = []) {
  const value = stripSpokenDates(text);
  const match = value.match(/[,;]\s*(?:en|de)\s+([^,;]+?)\s*$/iu) || value.match(/\s+en\s+([^,;]+?)\s*$/iu);
  if (!match) return '';
  const place = titleValue(match[1]);
  const normalized = fold(place);
  if (!place || excluded.filter(Boolean).some(item => {
    const candidate = fold(item);
    return candidate && (candidate === normalized || normalized.includes(candidate));
  })) return '';
  return place;
}

function noteFromText(text, amount, place, excluded = []) {
  let clean = stripSpokenDates(text);
  if (place) {
    const escapedPlace = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp('[,;]?\\s+(?:en|de)\\s+' + escapedPlace + '\\s*$', 'iu'), ' ');
  }
  clean = clean
    .replace(/\bpor\s+(?:\$|ARS|USD|US\$)?\s*\d[\d.\s]*(?:,\d{1,2})?\b/giu, ' ')
    .replace(/(?:\$|ARS|USD|US\$)\s*\d[\d.\s]*(?:,\d{1,2})?/giu, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:millones?|mill[oó]n|mil)\b/giu, ' ')
    .replace(/(^|[^\p{L}\p{N}])(?:gast[eé]|pagu[eé]|compr[eé]|abon[eé]|cobr[eé]|recib[ií]|deposit[eé]|ingres[oó]|me pagaron|un gasto|un ingreso|con|desde)(?=$|[^\p{L}\p{N}])/giu, ' ');
  if (amount) {
    const amountText = String(amount).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp('(^|[^\\d])' + amountText + '(?=$|[^\\d])', 'g'), ' ');
  }
  for (const phrase of excluded.filter(Boolean)) {
    const escaped = String(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + escaped + '(?=$|[^\\p{L}\\p{N}])', 'giu'), ' ');
  }
  clean = clean
    .replace(/(^|[^\p{L}\p{N}])(?:en|de|a|por)(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/\s+/g, ' ');
  return titleValue(clean).slice(0, 120);
}

function merchantFromText(text, type, excluded = []) {
  let clean = stripSpokenDates(text)
    .replace(/(?:\$|ARS|USD|US\$)?\s*\d[\d.\s]*(?:,\d{1,2})?\s*(?:millones?|mill[oó]n|mil)?/gi, ' ')
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

function namedValue(text, kind) {
  const patterns = kind === 'category'
    ? [/categor[ií]a\s+(?:llamada\s+)?([^,.]+)$/i]
    : [/etiqueta\s+(?:llamada\s+)?([^,.]+)$/i, /(?:^|\s)tag\s+(?:llamado\s+)?([^,.]+)$/i];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match && match[1]) return match[1].trim().slice(0, 40);
  }
  return '';
}

function recurringName(text, excluded = []) {
  let value = String(text || '')
    .replace(/(?:\$|ARS|USD|US\$)?\s*\d[\d.\s]*(?:,\d{1,2})?\s*(?:millones?|mill[oó]n|mil)?/gi, ' ')
    .replace(/\b(?:cre[aá]|crear|creame|agreg[aá]|guardar|configur[aá]|program[aá]|un|una|gasto|ingreso|recurrente|todos los meses|mensual|por|de|el d[ií]a|d[ií]a|desde|con|en)\b/gi, ' ');
  for (const phrase of excluded.filter(Boolean)) {
    const variants = [String(phrase), ...String(phrase).split(/\s+/).filter(token => token.length > 2)];
    for (const variant of variants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      value = value.replace(new RegExp(escaped, 'gi'), ' ');
    }
  }
  value = value.replace(/\s+/g, ' ').trim().slice(0, 80);
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function baseDraft(intent, now) {
  return {
    intent,
    transactionType: 'none',
    amount: null,
    currency: 'ARS',
    merchant: '',
    note: '',
    categoryId: '',
    accountId: '',
    cardId: '',
    recurringId: '',
    scheduleDay: null,
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
  let category = categoryFromText(categories, normalized);
  const card = matchEntity(cards, normalized, ['brand', 'bank', 'last4']);
  const amount = parseSpokenAmount(normalized);
  const dateISO = spokenDate(normalized, now);
  const wantsFullCard = /\b(total|complet[ao]|todo|resumen)\b/.test(normalized);
  const cardWords = /\b(tarjeta|visa|mastercard|master|amex|resumen)\b/.test(normalized);
  const paymentWords = /\b(pague|pagar|abone|abonar|pago)\b/.test(normalized);
  const createWords = /\b(crea|crear|creame|agrega|guardar|configura|programa|define|fija|pone)\b/.test(normalized);

  if (createWords && /\b(categoria)\b/.test(normalized)) {
    const draft = baseDraft('create_category', now);
    draft.merchant = namedValue(text, 'category');
    draft.transactionType = /\b(ingreso|ingresos)\b/.test(normalized) ? 'ingreso' : 'gasto';
    draft.explanation = 'Preparé una categoría nueva. Revisá el nombre antes de crearla.';
    draft.confidence = draft.merchant ? 0.96 : 0.48;
    return draft;
  }

  if (createWords && /\b(etiqueta|tag)\b/.test(normalized)) {
    const draft = baseDraft('create_tag', now);
    const tag = namedValue(text, /\betiqueta\b/.test(normalized) ? 'tag' : 'tag');
    draft.tags = tag ? ['asistente', tag] : ['asistente'];
    draft.merchant = tag;
    draft.explanation = 'Preparé una etiqueta nueva para usar en tus movimientos.';
    draft.confidence = tag ? 0.96 : 0.48;
    return draft;
  }

  if (createWords && /\b(presupuesto|budget|limite mensual)\b/.test(normalized)) {
    const draft = baseDraft('create_budget', now);
    draft.amount = amount;
    draft.categoryId = category ? category.id : '';
    draft.categoryRef = category ? category.name : '';
    draft.merchant = category ? category.name : 'Presupuesto';
    draft.explanation = 'Preparé un límite mensual para esa categoría.';
    draft.confidence = amount && category ? 0.96 : 0.58;
    return draft;
  }

  if (createWords && /\brecurrente\b/.test(normalized)) {
    const draft = baseDraft('create_recurring', now);
    const isIncome = /\b(ingreso|sueldo|salario|honorarios)\b/.test(normalized);
    const dayMatch = normalized.match(/\bdia\s*(\d{1,2})\b/);
    draft.transactionType = isIncome ? 'ingreso' : 'gasto';
    draft.amount = amount;
    draft.accountId = account ? account.id : (accounts.length === 1 ? accounts[0].id : '');
    draft.cardId = card ? card.id : '';
    draft.categoryId = category ? category.id : (isIncome ? 'ingreso' : '');
    draft.scheduleDay = dayMatch ? Math.min(31, Math.max(1, Number(dayMatch[1]))) : 1;
    draft.merchant = recurringName(text, [category && category.name, account && account.name, card && card.brand]);
    draft.tags = ['asistente', 'recurrente'];
    draft.explanation = 'Preparé una regla mensual. No se crea hasta que confirmes.';
    draft.confidence = amount && draft.merchant && (draft.accountId || draft.cardId) ? 0.9 : 0.56;
    return draft;
  }

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
    let excluded = [category && category.name, account && account.name, card && card.brand, 'tarjeta'];
    const place = placeFromText(text, excluded);
    if (!category && place) category = categoryFromHistory(categories, context.transactions || context.txns, place);
    excluded = [category && category.name, account && account.name, card && card.brand, 'tarjeta'];
    draft.transactionType = type;
    draft.amount = amount;
    draft.accountId = account ? account.id : (accounts.length === 1 ? accounts[0].id : '');
    draft.categoryId = category ? category.id : (type === 'ingreso' ? 'ingreso' : '');
    draft.merchant = place || merchantFromText(text, type, excluded);
    draft.note = noteFromText(text, amount, place, excluded);
    if (fold(draft.note) === fold(draft.merchant)) draft.note = '';
    draft.dateISO = dateISO;
    draft.explanation = 'Entendí un ' + (type === 'ingreso' ? 'ingreso' : 'gasto') + '. Revisá los datos antes de guardarlo.';
    draft.confidence = amount ? (draft.accountId ? 0.88 : 0.72) : 0.45;
    return draft;
  }

  return { ...baseDraft('none', now), explanation: 'No pude convertir eso en un movimiento todavía. Probá incluir qué pasó, el monto y la cuenta.', confidence: 0.1 };
}

export function normalizeAssistantDraft(value, context = {}, now = new Date()) {
  const allowedIntents = ['transaction', 'recurring', 'card_payment', 'create_recurring', 'create_budget', 'create_category', 'create_tag', 'none'];
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
  const scheduleDay = Number(draft.scheduleDay);
  draft.scheduleDay = Number.isFinite(scheduleDay) ? Math.min(31, Math.max(1, Math.round(scheduleDay))) : null;
  ['accountRef', 'categoryRef', 'cardRef', 'recurringRef'].forEach(key => { draft[key] = String(draft[key] || '').trim().slice(0, 80); });
  draft.currency = draft.currency === 'USD' ? 'USD' : 'ARS';
  draft.dateISO = isoFromLabel(draft.dateISO, now);
  draft.merchant = String(draft.merchant || '').trim().slice(0, 80);
  draft.note = String(draft.note || '').trim().slice(0, 120);
  draft.tags = [...new Set((Array.isArray(draft.tags) ? draft.tags : []).map(tag => fold(tag).replace(/\s/g, '-')).filter(Boolean))].slice(0, 8);
  if (!draft.tags.includes('asistente')) draft.tags.unshift('asistente');
  draft.explanation = String(draft.explanation || '').trim().slice(0, 240);
  draft.confidence = Math.max(0, Math.min(1, Number(draft.confidence) || 0));
  draft.source = draft.source === 'openai' ? 'openai' : 'local';
  return draft;
}
