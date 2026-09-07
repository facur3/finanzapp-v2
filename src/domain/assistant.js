import { isoFromLabel, todayKey } from './dates.js';

// This parser stays deterministic and on-device. Its job is to separate money,
// payment method, category, merchant and detail into a safe draft. Every local
// id is validated again before the app can write anything.

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9$.,/\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value) {
  return fold(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phrasePattern(value) {
  const normalized = words(value);
  if (!normalized) return null;
  return new RegExp('(?:^|\\s)' + normalized.split(' ').map(escapeRegExp).join('\\s+') + '(?=$|\\s)');
}

function containsPhrase(text, phrase) {
  const pattern = phrasePattern(phrase);
  return !!(pattern && pattern.test(words(text)));
}

function parseLocalizedNumber(raw, decimalForSingleSeparator = false) {
  const compact = String(raw || '').replace(/\s/g, '');
  if (!compact) return null;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(compact)) {
    return Number(compact.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(compact)) {
    return Number(compact.replace(/,/g, ''));
  }
  if (/^\d+,\d{1,2}$/.test(compact)) return Number(compact.replace(',', '.'));
  if (decimalForSingleSeparator && /^\d+\.\d{1,2}$/.test(compact)) return Number(compact);
  return Number(compact.replace(/\./g, ''));
}

const SMALL_NUMBERS = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90,
};
const HUNDREDS = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800,
  novecientos: 900,
};

function spokenWordAmounts(value) {
  const tokens = words(value).split(' ').filter(Boolean);
  const results = [];
  for (let start = 0; start < tokens.length; start += 1) {
    let total = 0;
    let group = 0;
    let found = false;
    let magnitude = false;
    let end = start;
    for (let index = start; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (Object.prototype.hasOwnProperty.call(SMALL_NUMBERS, token)) {
        group += SMALL_NUMBERS[token];
        found = true;
      } else if (Object.prototype.hasOwnProperty.call(HUNDREDS, token)) {
        group += HUNDREDS[token];
        found = true;
      } else if (token === 'y' && found) {
        // Connector inside a number phrase.
      } else if (token === 'mil') {
        total += (group || 1) * 1000;
        group = 0;
        found = true;
        magnitude = true;
      } else if (/^millones?$/.test(token)) {
        total += (group || 1) * 1000000;
        group = 0;
        found = true;
        magnitude = true;
      } else if (/^lucas?$/.test(token)) {
        total += (group || 1) * 1000;
        group = 0;
        found = true;
        magnitude = true;
      } else if (/^palos?$/.test(token)) {
        total += (group || 1) * 1000000;
        group = 0;
        found = true;
        magnitude = true;
      } else if (token === 'medio' && magnitude && total >= 1000000) {
        total += 500000;
        found = true;
      } else {
        break;
      }
      end = index;
    }
    if (found && magnitude && total + group > 0) results.push({ value: total + group, start, end });
  }
  return results;
}

function unscaledWordCurrencyAmounts(value) {
  const tokens = words(value).split(' ').filter(Boolean);
  const results = [];
  tokens.forEach((token, currencyIndex) => {
    if (!/^(?:pesos?|dolares?)$/.test(token)) return;
    const numberTokens = [];
    for (let index = currencyIndex - 1; index >= 0; index -= 1) {
      const candidate = tokens[index];
      if (Object.prototype.hasOwnProperty.call(SMALL_NUMBERS, candidate) || Object.prototype.hasOwnProperty.call(HUNDREDS, candidate) || candidate === 'y') numberTokens.unshift(candidate);
      else break;
    }
    if (!numberTokens.length) return;
    const valueNumber = numberTokens.reduce((sum, item) => sum + (SMALL_NUMBERS[item] || HUNDREDS[item] || 0), 0);
    if (valueNumber > 0) results.push(valueNumber);
  });
  return results;
}

export function parseSpokenAmount(value) {
  const text = fold(value);
  const scaled = [];
  for (const match of text.matchAll(/(?:\$|ars|usd|us\$|u\$s)?\s*(\d+(?:[.,]\d+)?)\s*(millones?|millon|mil|k|lucas?|palos?)\b/g)) {
    const base = parseLocalizedNumber(match[1], true);
    const unit = match[2];
    const scale = /^(?:mill|palo)/.test(unit) ? 1000000 : 1000;
    if (Number.isFinite(base) && base > 0) scaled.push(base * scale);
  }
  spokenWordAmounts(text).forEach(result => scaled.push(result.value));
  unscaledWordCurrencyAmounts(text).forEach(result => scaled.push(result));
  if (scaled.length) return Math.round(Math.max(...scaled) * 100) / 100;

  const decimalDot = /\b(?:usd|us\$|u\$s|dolares?)\b/.test(text);
  const candidates = [...text.matchAll(/(?:\$|ars|usd|us\$|u\$s)?\s*(\d[\d.\s]*(?:,\d{1,2})?)/g)]
    .map(match => parseLocalizedNumber(match[1], decimalDot))
    .filter(number => Number.isFinite(number) && number > 0);
  return candidates.length ? Math.round(Math.max(...candidates) * 100) / 100 : null;
}

function entries(value) {
  if (Array.isArray(value)) return value;
  return Object.keys(value || {}).map(id => ({ id, ...(value[id] || {}) }));
}

// Avoid resolving vague nouns to an arbitrary entity. Brand names and
// "efectivo" are intentionally allowed because users commonly name the exact
// card/account that way ("con la Visa", "desde Efectivo").
const GENERIC_ENTITY_WORDS = new Set(['banco', 'cuenta', 'tarjeta']);

function matchEntity(list, text, fields = ['name']) {
  const haystack = words(text);
  const scored = entries(list).map((item, index) => {
    const variants = fields.map(field => words(item[field])).filter(Boolean);
    const score = variants.reduce((best, name) => {
      if (containsPhrase(haystack, name)) {
        const meaningful = name.split(' ').filter(token => token.length > 2 && !GENERIC_ENTITY_WORDS.has(token));
        if (!meaningful.length && name.split(' ').length === 1 && GENERIC_ENTITY_WORDS.has(name)) return best;
        return Math.max(best, 1000 + name.length);
      }
      const nameTokens = name.split(' ').filter(token => token.length > 2 && !GENERIC_ENTITY_WORDS.has(token));
      const hits = nameTokens.filter(token => containsPhrase(haystack, token)).length;
      return Math.max(best, hits ? hits * 100 + name.length / 100 : 0);
    }, 0);
    return { item, score, index };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0] ? scored[0].item : null;
}

const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTH_INDEX = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
const KNOWN_MERCHANTS = [
  ['mercado libre', 'Mercado Libre'], ['mercadolibre', 'Mercado Libre'], ['pedidos ya', 'PedidosYa'],
  ['pedidosya', 'PedidosYa'], ['rappi', 'Rappi'], ['uber', 'Uber'], ['cabify', 'Cabify'],
  ['didi', 'DiDi'], ['amazon', 'Amazon'], ['netflix', 'Netflix'], ['spotify', 'Spotify'],
  ['starbucks', 'Starbucks'], ['dunkin', 'Dunkin'], ['ypf', 'YPF'], ['shell', 'Shell'],
  ['axion', 'Axion'], ['coto', 'Coto'], ['carrefour', 'Carrefour'], ['dia', 'Día'],
];
const KNOWN_MERCHANT_TERMS = new Set(KNOWN_MERCHANTS.map(item => item[0]));
// Keep income detection deliberately broad: people describe money arriving in
// many ways (salary, gift, loan, reimbursement, transfer from somebody else).
// A transfer between the user's own accounts is still handled earlier by the
// explicit transfer route parser.
const INCOME_ACTIONS = /\b(?:cobre|cobramos|recibi|recibimos|deposite|depositamos|ingrese|ingresaron|me\s+(?:pago|deposito|transfirio|acredito|ingreso|dio|regalo|presto|devolvio|reembolso|reintegro|abono|giro|envio|mando|liquido|llego|entro|cayo|pagaron|depositaron|transfirieron|acreditaron|ingresaron|dieron|regalaron|prestaron|devolvieron|reembolsaron|reintegraron|abonaron|giraron|enviaron|mandaron|liquidaron|llegaron|entraron|cayeron)|pagaron|depositaron|transfirieron|acreditaron|ingresaron|dieron|regalaron|prestaron|devolvieron|reembolsaron|reintegraron|abonaron|giraron|enviaron|mandaron|liquidaron|entro|entraron|ingreso|sueldo|salario|honorarios|gane|ganamos|vendi|vendimos|venta|regalo|prestamo|reembolso|reintegro)\b/;
const CATEGORY_HINTS = [
  { aliases: ['comida', 'alimentacion', 'alimentos'], terms: ['hamburguesa', 'pizza', 'empanada', 'restaurante', 'restaurant', 'cafeteria', 'cafe', 'comida', 'almuerzo', 'cena', 'desayuno', 'delivery', 'rappi', 'pedidos ya', 'pedidosya', 'supermercado', 'verduleria', 'kiosco', 'coto', 'carrefour'] },
  { aliases: ['auto', 'transporte', 'movilidad'], terms: ['uber', 'cabify', 'didi', 'taxi', 'sube', 'colectivo', 'subte', 'tren', 'nafta', 'combustible', 'ypf', 'shell', 'axion', 'peaje', 'estacionamiento'] },
  { aliases: ['compras', 'shopping'], terms: ['amazon', 'mercado libre', 'mercadolibre', 'ropa', 'remera', 'pantalon', 'campera', 'zapatilla', 'calzado', 'electrodomestico'] },
  { aliases: ['ocio', 'entretenimiento'], terms: ['cine', 'netflix', 'spotify', 'juego', 'gaming', 'teatro', 'recital', 'salida'] },
  { aliases: ['mascotas', 'mascota'], terms: ['veterinaria', 'veterinario', 'perro', 'gato', 'mascota'] },
  { aliases: ['tarjetas', 'tarjeta'], terms: ['resumen de tarjeta'] },
  { aliases: ['inversiones', 'inversion'], terms: ['cedear', 'bono', 'cripto', 'fci', 'caucion', 'accion'] },
];

function hasTerm(text, term) {
  return containsPhrase(text, term) || (!words(term).includes(' ') && containsPhrase(text, term + 's'));
}

function categoryFromText(categories, text, type = 'gasto') {
  const available = entries(categories).filter(category => category.type === type && !category.archived);
  const direct = matchEntity(available, text, ['name']);
  if (direct) return direct;
  if (type !== 'gasto') return null;
  for (const hint of CATEGORY_HINTS) {
    if (!hint.terms.some(term => hasTerm(text, term))) continue;
    const category = available.find(item => hint.aliases.some(alias => {
      const value = words(item.id + ' ' + (item.name || ''));
      return value === alias || value.split(' ').includes(alias) || containsPhrase(value, alias);
    }));
    if (category) return category;
  }
  return null;
}

function categoryFromHistory(categories, transactions, merchant, type = 'gasto') {
  if (!merchant) return null;
  const counts = new Map();
  entries(transactions).forEach((transaction, index) => {
    if (words(transaction.merchant) !== words(merchant) || !transaction.cat) return;
    const key = String(transaction.cat);
    counts.set(key, (counts.get(key) || 0) + 10 + Math.max(0, 5 - index / 20));
  });
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? entries(categories).find(category => String(category.id) === best[0] && category.type === type && !category.archived) || null : null;
}

function merchantFromHistory(transactions, text) {
  const haystack = words(text);
  const matches = entries(transactions).map((transaction, index) => {
    const merchant = String(transaction.merchant || '').trim();
    const normalized = words(merchant);
    if (!merchant || /^(gasto|ingreso|movimiento|compra)$/.test(normalized) || !containsPhrase(haystack, normalized)) return null;
    return { merchant, score: normalized.length * 100 - index };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  return matches[0] ? matches[0].merchant : '';
}

export function resolveAssistantReferences(value, context = {}) {
  const draft = { ...(value || {}) };
  const account = !draft.accountId && draft.accountRef ? matchEntity(context.accounts, draft.accountRef, ['name']) : null;
  const fromAccount = !draft.fromAccountId && draft.fromAccountRef ? matchEntity(context.accounts, draft.fromAccountRef, ['name']) : null;
  const toAccount = !draft.toAccountId && draft.toAccountRef ? matchEntity(context.accounts, draft.toAccountRef, ['name']) : null;
  const category = !draft.categoryId && draft.categoryRef ? matchEntity(context.categories, draft.categoryRef, ['name']) : null;
  const card = !draft.cardId && draft.cardRef ? matchEntity(context.cards, draft.cardRef, ['brand', 'bank', 'last4']) : null;
  const recurring = !draft.recurringId && draft.recurringRef ? matchEntity(context.recurring, draft.recurringRef, ['concept', 'name']) : null;
  if (account) draft.accountId = account.id;
  if (fromAccount) draft.fromAccountId = fromAccount.id;
  if (toAccount) draft.toAccountId = toAccount.id;
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
    const day = Number(named[1]);
    const month = MONTH_INDEX[named[2]];
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
  if (/\bhace\s+una\s+semana\b/.test(value)) {
    const date = new Date(ref);
    date.setDate(date.getDate() - 7);
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
    .replace(/\b(?:hoy|anteayer|ayer|hace\s+\d{1,3}\s+d[ií]as?|hace\s+una\s+semana|(?:la\s+)?semana\s+pasada)\b/giu, ' ')
    .replace(/\b(?:el\s+)?(?:domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(?:(?:\s+(?:anterior|pasad[oa]|[uú]ltim[oa]))|(?:\s+de\s+la\s+semana\s+pasada))?\b/giu, ' ');
}

function titleValue(value) {
  const clean = String(value || '').replace(/^[\s,;.-]+|[\s,;.-]+$/g, '').replace(/\s+/g, ' ').slice(0, 80);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
}

function cleanMerchantCandidate(value) {
  let clean = titleValue(value);
  clean = titleValue(clean.replace(/^(?:(?:en|de|a|por|para|con|desde|hacia|el|la|los|las|un|una|que|porque|y)\s+)+/i, ''));
  clean = titleValue(clean.replace(/^(?:regalo|pr[eé]stamo|reintegro|reembolso|transferencia|sueldo|salario|honorarios?|venta|devoluci[oó]n)(?:\s+de)?\s+/i, ''));
  clean = titleValue(clean.replace(/\b(?:en|de|a|por|para|con|desde|hacia|que|porque|y)\s*$/i, ''));
  return clean;
}

function currencyFromText(text) {
  const normalized = ' ' + fold(text) + ' ';
  const usd = /(?:\busd\b|\bus\$|\bu\$s\b|\bdolares?\b)/.test(normalized);
  const ars = /(?:\bars\b|\bpesos?\b)/.test(normalized);
  if (usd && ars) return { currency: 'ARS', explicit: true, ambiguous: true };
  if (usd) return { currency: 'USD', explicit: true, ambiguous: false };
  if (ars) return { currency: 'ARS', explicit: true, ambiguous: false };
  return { currency: 'ARS', explicit: /\$/.test(normalized), ambiguous: false };
}

function removePhrase(value, phrase, includeTokens = false) {
  let result = String(value || '');
  const variants = [String(phrase || '')];
  if (includeTokens) variants.push(...String(phrase || '').split(/\s+/).filter(token => words(token).length > 3 && !GENERIC_ENTITY_WORDS.has(words(token))));
  variants.filter(Boolean).sort((a, b) => b.length - a.length).forEach(variant => {
    const normalized = words(variant);
    if (!normalized) return;
    const pattern = normalized.split(' ').map(escapeRegExp).join('[\\s._-]+');
    result = result.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + pattern + '(?=$|[^\\p{L}\\p{N}])', 'giu'), '$1 ');
  });
  return result;
}

function removeAmount(value, amount) {
  let result = String(value || '');
  const numberWord = '(?:cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veinti[uú]n|veintiuno|veintid[oó]s|veintitr[eé]s|veinticuatro|veinticinco|veintis[eé]is|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos)';
  const unscaledWordPattern = new RegExp('\\b'+numberWord+'(?:\\s+(?:y\\s+)?'+numberWord+'){0,5}\\s+(?:pesos?|d[oó]lares?)\\b','giu');
  result = result.replace(unscaledWordPattern, match => parseSpokenAmount(match) === amount ? ' ' : match);
  const magnitudePattern = /(?:\$|ARS|USD|US\$|U\$S)?\s*\d+(?:[.,]\d+)?\s*(?:millones?|mill[oó]n|mil|k|lucas?|palos?)(?:\s+(?:de\s+)?(?:pesos?|d[oó]lares?))?/giu;
  result = result.replace(magnitudePattern, match => parseSpokenAmount(match) === amount ? ' ' : match);
  const wordMagnitudePattern = /\b(?:(?:cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veinti[uú]n|veintiuno|veintid[oó]s|veintitr[eé]s|veinticuatro|veinticinco|veintis[eé]is|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|y)\s+)*(?:mil|mill[oó]n(?:es)?|lucas?|palos?)(?:\s+y\s+medio)?(?:\s+(?:de\s+)?(?:pesos?|d[oó]lares?))?\b/giu;
  result = result.replace(wordMagnitudePattern, match => parseSpokenAmount(match) === amount ? ' ' : match);
  result = result.replace(/(?:\$|ARS|USD|US\$|U\$S)\s*\d[\d.\s]*(?:,\d{1,2})?(?:\s+(?:pesos?|d[oó]lares?))?/giu, match => parseSpokenAmount(match) === amount ? ' ' : match);
  result = result.replace(/\bpor\s+\d[\d.\s]*(?:,\d{1,2})?(?:\s+(?:pesos?|d[oó]lares?))?/giu, match => parseSpokenAmount(match) === amount ? ' ' : match);
  result = result.replace(/\b\d[\d.\s]*(?:,\d{1,2})?\s*(?:pesos?|d[oó]lares?)\b/giu, match => parseSpokenAmount(match) === amount ? ' ' : match);
  if (amount) result = result.replace(/\b\d[\d.\s]*(?:,\d{1,2})?\b/giu, match => parseSpokenAmount(match) === amount ? ' ' : match);
  return result;
}

function categoryLike(value, category, categories) {
  const normalized = words(value).replace(/^(?:el|la|los|las|un|una)\s+/, '');
  if (!normalized || /^(?:peso|pesos|ars|dolar|dolares|usd|efectivo|tarjeta|con|desde|hacia|en|de|a|por|para|que|porque|y|gaste|pague|compre|cobre|recibi|reintegro|reembolso|regalo|prestamo|devolucion|sueldo|salario|honorarios|venta)$/.test(normalized)) return true;
  if (KNOWN_MERCHANT_TERMS.has(normalized)) return false;
  if (category && (normalized === words(category.name) || normalized === words(category.id))) return true;
  if (entries(categories).some(item => normalized === words(item.name) || normalized === words(item.id))) return true;
  return CATEGORY_HINTS.some(hint => [...hint.aliases, ...hint.terms].some(term => normalized === words(term)));
}

function explicitMerchantFromText(text, excluded, category, categories) {
  let value = stripSpokenDates(text);
  excluded.filter(Boolean).forEach(phrase => { value = removePhrase(value, phrase, true); });
  value = removeAmount(value, parseSpokenAmount(stripSpokenDates(text).replace(/\bd[ií]a\s+\d{1,2}\b/giu, ' ')));
  value = value.replace(/\b(?:pesos?|ars|d[oó]lares?|usd|us\$|u\$s)\b/giu, ' ');
  const matches = [...value.matchAll(/(?:^|[,;]|\s)\b(?:en|de|a)\s+([^,;]+?)(?=$|\s+con\s+|\s+desde\s+)/giu)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    let candidate = cleanMerchantCandidate(matches[index][1]);
    const hint = CATEGORY_HINTS.find(item => category && item.aliases.some(alias => words(category.id+' '+category.name).split(' ').includes(words(alias))));
    if (hint) hint.terms.filter(term => !KNOWN_MERCHANT_TERMS.has(words(term))).sort((a, b) => b.length - a.length).forEach(term => { candidate = titleValue(removePhrase(candidate, term)); });
    candidate = cleanMerchantCandidate(candidate);
    if (candidate && !categoryLike(candidate, category, categories)) return candidate;
  }
  return '';
}

function knownMerchantFromText(text) {
  const match = KNOWN_MERCHANTS.filter(([term]) => containsPhrase(text, term)).sort((a, b) => b[0].length - a[0].length)[0];
  return match ? match[1] : '';
}

function noteFromText(text, amount, merchant, excluded = []) {
  let clean = stripSpokenDates(text);
  clean = removeAmount(clean, amount);
  if (merchant) clean = removePhrase(clean, merchant, true);
  excluded.filter(Boolean).forEach(phrase => { clean = removePhrase(clean, phrase, true); });
  clean = clean
    .replace(/\b(?:pesos?|ars|d[oó]lares?|usd|us\$|u\$s)\b/giu, ' ')
    .replace(/(^|[^\p{L}\p{N}])(?:gast[eé]|gastamos|pagu[eé]|pagamos|compr[eé]|compramos|abon[eé]|cobr[eé]|recib[ií]|deposit[eé]|ingres[eéó]|gan[eé]|vend[ií]|anot[aá]|registr[aá]|carg[aá]|me\s+(?:pag[oó]|deposit[oó]|transfiri[oó]|acredit[oó]|ingres[oó]|dio|regal[oó]|prest[oó]|devolvi[oó]|reembols[oó]|reintegr[oó]|abon[oó]|gir[oó]|envi[oó]|mand[oó]|liquid[oó]|lleg[oó]|entr[oó]|cay[oó]|pagaron|depositaron|transfirieron|acreditaron|ingresaron|dieron|regalaron|prestaron|devolvieron|reembolsaron|reintegraron|abonaron|giraron|enviaron|mandaron|liquidaron|llegaron|entraron|cayeron|cobraron|descontaron|debitaron|sacaron)|un\s+gasto|un\s+ingreso|con|desde|hacia)(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/(^|[^\p{L}\p{N}])(?:en|de|a|por|para|el|la|los|las|un|una)(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/^\s*(?:(?:que|porque|y)\s+)+/giu, ' ')
    .replace(/\s+/g, ' ');
  return titleValue(clean).slice(0, 120);
}

function fallbackMerchant(text, type, amount, excluded, category, categories) {
  let clean = stripSpokenDates(text);
  clean = removeAmount(clean, amount);
  excluded.filter(Boolean).forEach(phrase => { clean = removePhrase(clean, phrase, true); });
  clean = clean
    .replace(/\b(?:pesos?|ars|d[oó]lares?|usd|us\$|u\$s)\b/giu, ' ')
    .replace(/(^|[^\p{L}\p{N}])(?:gast[eé]|gastamos|pagu[eé]|pagamos|compr[eé]|compramos|abon[eé]|cobr[eé]|recib[ií]|deposit[eé]|ingres[eéó]|gan[eé]|vend[ií]|anot[aá]|registr[aá]|carg[aá]|me|pag[oó]|deposit[oó]|transfiri[oó]|acredit[oó]|dio|regal[oó]|prest[oó]|devolvi[oó]|reembols[oó]|reintegr[oó]|gir[oó]|envi[oó]|mand[oó]|liquid[oó]|lleg[oó]|entr[oó]|cay[oó]|pagaron|depositaron|transfirieron|acreditaron|ingresaron|dieron|regalaron|prestaron|devolvieron|reembolsaron|reintegraron|abonaron|giraron|enviaron|mandaron|liquidaron|llegaron|entraron|cayeron|cobraron|descontaron|debitaron|sacaron|un|una|gasto|ingreso|con|desde|hacia|en|de|a|por|para|el|la|los|las)(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/^\s*(?:(?:que|porque|y)\s+)+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hint = CATEGORY_HINTS.find(item => category && item.aliases.some(alias => words(category.id+' '+category.name).split(' ').includes(words(alias))));
  if (hint) hint.terms.filter(term => !KNOWN_MERCHANT_TERMS.has(words(term))).sort((a, b) => b.length - a.length).forEach(term => { clean = titleValue(removePhrase(clean, term)); });
  clean = cleanMerchantCandidate(clean);
  if (!clean || categoryLike(clean, category, categories) || clean.split(' ').length > 4) return type === 'ingreso' ? 'Ingreso' : 'Gasto';
  return titleValue(clean);
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
  let value = removeAmount(text, parseSpokenAmount(String(text || '').replace(/\bd[ií]a\s+\d{1,2}\b/giu, ' ')))
    .replace(/\b(?:cre[aá]|crear|creame|agreg[aá]|guardar|configur[aá]|program[aá]|un|una|gasto|ingreso|recurrente|todos\s+los\s+meses|mensual|por|de|el\s+d[ií]a|d[ií]a|desde|con|en|pesos?|ars|d[oó]lares?|usd)\b/giu, ' ')
    .replace(/\b\d{1,2}\b/g, ' ');
  excluded.filter(Boolean).forEach(phrase => { value = removePhrase(value, phrase, true); });
  value = value.replace(/\s+/g, ' ').trim().slice(0, 80);
  return titleValue(value);
}

function baseDraft(intent, now) {
  return {
    intent, transactionType: 'none', amount: null, currency: 'ARS',
    currencyExplicit: false, currencyAmbiguous: false, merchant: '', note: '',
    categoryId: '', accountId: '', fromAccountId: '', toAccountId: '', cardId: '',
    cardExplicit: false, recurringId: '', scheduleDay: null,
    dateISO: todayKey(new Date(now || Date.now())), tags: ['asistente'],
    explanation: '', confidence: 0, source: 'local',
  };
}

function accountRoute(text, accounts) {
  const normalized = fold(text);
  const route = normalized.match(/\b(?:de|desde)\s+(.+?)\s+(?:a|hacia)\s+(.+?)(?:\s+(?:hoy|ayer|anteayer))?$/);
  if (!route) return { from: null, to: null };
  return { from: matchEntity(accounts, route[1], ['name']), to: matchEntity(accounts, route[2], ['name']) };
}

function accountForCurrency(accounts, currency) {
  const matching = entries(accounts).filter(account => (account.currency === 'USD' ? 'USD' : 'ARS') === currency);
  return matching.length === 1 ? matching[0] : null;
}

export function parseAssistantCommand(text, context = {}, now = new Date()) {
  const normalized = fold(text);
  if (!normalized) return { ...baseDraft('none', now), explanation: 'Escribí o decí qué movimiento querés registrar.' };
  if (/^\s*¿/.test(String(text||''))||/^(?:en que|que|por que|cuando|quien)\b/.test(normalized)) {
    return { ...baseDraft('none', now), explanation: 'Eso parece una consulta, no un movimiento para guardar.', confidence: 0.98 };
  }
  if (/\b(?:no|nunca)\s+(?:me\s+)?(?:gaste|pague|compre|cobre|recibi|transferi|ingrese|pago|deposito|transfirio|acredito|ingreso|dio|regalo|presto|devolvio|reembolso|reintegro|abono|giro|envio|mando|liquido|llego|entro|cayo|pagaron|depositaron|transfirieron|acreditaron|ingresaron|dieron|regalaron|prestaron|devolvieron|reembolsaron|reintegraron|abonaron|giraron|enviaron|mandaron|liquidaron|llegaron|entraron|cayeron)\b/.test(normalized)) {
    return { ...baseDraft('none', now), explanation: 'La frase niega el movimiento, así que no preparé ningún registro.', confidence: 0.99 };
  }
  if (/^(?:cuanto|cuantos|como|donde|mostrame|decime|cual)\b/.test(normalized)) {
    return { ...baseDraft('none', now), explanation: 'Eso parece una consulta, no un movimiento para guardar.', confidence: 0.95 };
  }

  const accounts = entries(context.accounts).filter(account => !context.archived || !context.archived[account.id]);
  const categories = entries(context.categories).filter(category => !category.archived);
  const recurring = entries(context.recurring);
  const cards = entries(context.cards);
  const explicitAccount = matchEntity(accounts, normalized, ['name']);
  const card = matchEntity(cards, normalized, ['brand', 'bank', 'last4']);
  const currencyInfo = currencyFromText(text);
  let amountText = stripSpokenDates(text).replace(/\b(?:el\s+)?d[ií]a\s+\d{1,2}\b/giu, ' ');
  cards.forEach(item => { if(item.last4) amountText=removePhrase(amountText,String(item.last4)); });
  const amount = parseSpokenAmount(amountText);
  const dateISO = spokenDate(normalized, now);
  const cardWords = /\b(?:tarjeta|visa|mastercard|master|amex)\b/.test(normalized);
  const paymentWords = /\b(?:pague|pagar|abone|abonar|pago)\b/.test(normalized);
  const cardPayment = paymentWords && (
    /\b(?:resumen|saldo|deuda)\b/.test(normalized)
    || /\b(?:pague|pagar|abone|abonar|pago)\s+(?:el|la|mi|una)?\s*tarjeta\b/.test(normalized)
    || /\bpago\s+de\s+(?:la\s+)?(?:tarjeta|visa|mastercard|master|amex)\b/.test(normalized)
  );
  const wantsFullCard = /\b(?:total|complet[ao]|todo|resumen|saldo|deuda)\b/.test(normalized);
  const createWords = /\b(?:crea|crear|creame|agrega|guardar|configura|programa|define|fija|pone)\b/.test(normalized);

  if (createWords && /\bcategoria\b/.test(normalized)) {
    const draft = baseDraft('create_category', now);
    draft.merchant = namedValue(text, 'category');
    draft.transactionType = /\bingresos?\b/.test(normalized) ? 'ingreso' : 'gasto';
    draft.explanation = 'Preparé una categoría nueva. Revisá el nombre antes de crearla.';
    draft.confidence = draft.merchant ? 0.96 : 0.48;
    return draft;
  }

  if (createWords && /\b(?:etiqueta|tag)\b/.test(normalized)) {
    const draft = baseDraft('create_tag', now);
    const tag = namedValue(text, 'tag');
    draft.tags = tag ? ['asistente', tag] : ['asistente'];
    draft.merchant = tag;
    draft.explanation = 'Preparé una etiqueta nueva para usar en tus movimientos.';
    draft.confidence = tag ? 0.96 : 0.48;
    return draft;
  }

  if (createWords && /\b(?:presupuesto|budget|limite mensual)\b/.test(normalized)) {
    const category = categoryFromText(categories, normalized, 'gasto');
    const draft = baseDraft('create_budget', now);
    Object.assign(draft, {
      amount, categoryId: category ? category.id : '', categoryRef: category ? category.name : '',
      merchant: category ? category.name : 'Presupuesto', currency: currencyInfo.currency,
      currencyExplicit: currencyInfo.explicit, currencyAmbiguous: currencyInfo.ambiguous,
      explanation: 'Preparé un límite mensual para esa categoría.', confidence: amount && category ? 0.96 : 0.58,
    });
    return draft;
  }

  if (createWords && /\brecurrente\b/.test(normalized)) {
    const draft = baseDraft('create_recurring', now);
    const isIncome = /\b(?:ingreso|sueldo|salario|honorarios)\b/.test(normalized);
    const category = categoryFromText(categories, normalized, isIncome ? 'ingreso' : 'gasto');
    const dayMatch = normalized.match(/\bdia\s*(\d{1,2})\b/);
    const selectedAccount = explicitAccount || accountForCurrency(accounts, currencyInfo.currency);
    Object.assign(draft, {
      transactionType: isIncome ? 'ingreso' : 'gasto', amount,
      accountId: selectedAccount ? selectedAccount.id : '',
      cardId: !isIncome && cardWords && card ? card.id : '',
      categoryId: category ? category.id : (isIncome && categories.some(item => item.id === 'ingreso') ? 'ingreso' : ''),
      scheduleDay: dayMatch ? Math.min(31, Math.max(1, Number(dayMatch[1]))) : 1,
      merchant: recurringName(text, [category && category.name, selectedAccount && selectedAccount.name, card && card.brand]),
      currency: currencyInfo.explicit ? currencyInfo.currency : (selectedAccount && selectedAccount.currency === 'USD' ? 'USD' : 'ARS'),
      currencyExplicit: currencyInfo.explicit, currencyAmbiguous: currencyInfo.ambiguous,
      tags: ['asistente', 'recurrente'], explanation: 'Preparé una regla mensual. No se crea hasta que confirmes.',
    });
    if (draft.cardId) draft.accountId = '';
    draft.cardExplicit = !!draft.cardId;
    draft.confidence = amount && draft.merchant && (draft.accountId || draft.cardId) ? 0.9 : 0.56;
    return draft;
  }

  if (cardPayment) {
    const draft = baseDraft('card_payment', now);
    Object.assign(draft, {
      amount: wantsFullCard ? null : amount, accountId: explicitAccount ? explicitAccount.id : '',
      cardId: card ? card.id : '', cardExplicit: cardWords, dateISO,
      explanation: 'Preparé el pago de tarjeta para que lo revises antes de registrarlo.',
      confidence: (card || cards.length === 1) && (explicitAccount || accounts.length === 1) && (wantsFullCard || amount) ? 0.94 : 0.63,
    });
    return draft;
  }

  const incomeWords = INCOME_ACTIONS.test(normalized);
  const transferWords = /\b(?:transferi|transferencia|pase|movi|mande|envie)\b/.test(normalized);
  if (transferWords && !incomeWords) {
    const route = accountRoute(normalized, accounts);
    const draft = baseDraft('transfer', now);
    Object.assign(draft, {
      transactionType: 'transfer', amount,
      fromAccountId: route.from ? route.from.id : '', toAccountId: route.to ? route.to.id : '',
      accountId: route.from ? route.from.id : '',
      currency: route.from && route.from.currency === 'USD' ? 'USD' : currencyInfo.currency,
      currencyExplicit: currencyInfo.explicit, currencyAmbiguous: currencyInfo.ambiguous,
      dateISO, merchant: 'Transferencia',
      explanation: 'Entendí una transferencia entre tus cuentas. No cambia tu patrimonio.',
      confidence: amount && route.from && route.to ? 0.95 : 0.58,
    });
    return draft;
  }

  const expenseWords = /\b(?:gaste|gastamos|pague|pagamos|compre|compramos|abone|salio|gasto|anota|registra|carga|me cobraron|me descontaron|me debitaron|me sacaron)\b/.test(normalized);
  const matchedRecurringCandidate = matchEntity(recurring, normalized, ['concept', 'name']);
  // A saved recurrent must be named explicitly. A partial token such as a
  // company name is useful as an income source, but is not enough to silently
  // turn a one-off gift/loan/reimbursement into the saved salary rule.
  const matchedRecurring = matchedRecurringCandidate && [matchedRecurringCandidate.concept, matchedRecurringCandidate.name]
    .filter(Boolean).some(label => containsPhrase(normalized, label)) ? matchedRecurringCandidate : null;
  const salaryRecurring = incomeWords && /\b(?:sueldo|salario|cobre)\b/.test(normalized)
    ? recurring.find(item => item.type === 'ingreso' && /sueldo|salario|honorario/.test(fold(item.concept || item.name)))
    : null;
  const recurringItem = matchedRecurring || salaryRecurring;
  if (recurringItem && (incomeWords || expenseWords)) {
    const draft = baseDraft('recurring', now);
    Object.assign(draft, {
      recurringId: recurringItem.id, transactionType: recurringItem.type || (incomeWords ? 'ingreso' : 'gasto'),
      amount: amount || Number(recurringItem.amount) || null,
      accountId: explicitAccount ? explicitAccount.id : (recurringItem.targetKind === 'account' ? recurringItem.targetId : ''),
      cardId: recurringItem.targetKind === 'card' ? recurringItem.targetId : '',
      categoryId: recurringItem.cat || '', merchant: recurringItem.concept || recurringItem.name || 'Recurrente',
      currency: currencyInfo.explicit ? currencyInfo.currency : ((accounts.find(item => item.id === (explicitAccount ? explicitAccount.id : recurringItem.targetId)) || {}).currency || 'ARS'),
      currencyExplicit: currencyInfo.explicit, currencyAmbiguous: currencyInfo.ambiguous,
      dateISO, tags: ['asistente', 'recurrente'],
      explanation: 'Encontré este movimiento en tus recurrentes y usé los datos que ya habías guardado.',
    });
    draft.cardExplicit = !!draft.cardId;
    draft.confidence = draft.amount ? 0.97 : 0.68;
    return draft;
  }

  if (incomeWords || expenseWords) {
    // Incoming-money language wins when a phrase also mentions the original
    // expense (for example, "me devolvieron lo que gasté").
    const type = incomeWords ? 'ingreso' : 'gasto';
    let category = categoryFromText(categories, normalized, type);
    const cardExplicit = type === 'gasto' && cardWords && !!(card || cards.length === 1);
    const selectedCard = cardExplicit ? (card || cards[0]) : null;
    const selectedAccount = cardExplicit ? null : (explicitAccount || accountForCurrency(accounts, currencyInfo.currency));
    const excluded = [category && category.name, selectedAccount && selectedAccount.name, selectedCard && selectedCard.brand, selectedCard && selectedCard.bank, 'tarjeta'];
    const learnedMerchant = merchantFromHistory(context.transactions || context.txns, text);
    const explicitMerchant = explicitMerchantFromText(text, excluded, category, categories);
    const knownMerchant = knownMerchantFromText(text);
    const merchant = learnedMerchant || explicitMerchant || knownMerchant || fallbackMerchant(text, type, amount, excluded, category, categories);
    if (!category && merchant) category = categoryFromHistory(categories, context.transactions || context.txns, merchant, type);

    const draft = baseDraft('transaction', now);
    Object.assign(draft, {
      transactionType: type, amount, accountId: selectedAccount ? selectedAccount.id : '',
      cardId: selectedCard ? selectedCard.id : '', cardExplicit,
      categoryId: category ? category.id : (type === 'ingreso' && categories.some(item => item.id === 'ingreso') ? 'ingreso' : ''),
      merchant, note: noteFromText(text, amount, /^(?:gasto|ingreso)$/.test(words(merchant)) ? '' : merchant, excluded),
      currency: currencyInfo.explicit ? currencyInfo.currency : (selectedAccount && selectedAccount.currency === 'USD' ? 'USD' : 'ARS'),
      currencyExplicit: currencyInfo.explicit, currencyAmbiguous: currencyInfo.ambiguous, dateISO,
      explanation: 'Entendí un ' + (type === 'ingreso' ? 'ingreso' : 'gasto') + '. Separé monto, moneda, categoría, ' + (type === 'ingreso' ? 'origen' : 'comercio') + ' y detalle para que los revises.',
      confidence: amount ? ((selectedAccount || selectedCard) ? 0.91 : 0.76) : 0.45,
    });
    if (words(draft.note) === words(draft.merchant)) draft.note = '';
    return draft;
  }

  return { ...baseDraft('none', now), explanation: 'No pude convertir eso en un movimiento todavía. Probá incluir qué pasó, el monto y la cuenta.', confidence: 0.1 };
}

export function normalizeAssistantDraft(value, context = {}, now = new Date()) {
  const allowedIntents = ['transaction', 'transfer', 'recurring', 'card_payment', 'create_recurring', 'create_budget', 'create_category', 'create_tag', 'none'];
  const draft = { ...baseDraft('none', now), ...(value || {}) };
  if (!allowedIntents.includes(draft.intent)) draft.intent = 'none';
  if (!['gasto', 'ingreso', 'transfer', 'none'].includes(draft.transactionType)) draft.transactionType = 'none';
  const amount = Number(draft.amount);
  draft.amount = Number.isFinite(amount) && amount > 0 && amount < 1e15 ? Math.round(amount * 100) / 100 : null;
  const accountIds = new Set(entries(context.accounts).map(item => String(item.id)));
  const categoryIds = new Set(entries(context.categories).map(item => String(item.id)));
  const cardIds = new Set(entries(context.cards).map(item => String(item.id)));
  const recurringIds = new Set(entries(context.recurring).map(item => String(item.id)));
  draft.accountId = accountIds.has(String(draft.accountId)) ? String(draft.accountId) : '';
  draft.fromAccountId = accountIds.has(String(draft.fromAccountId)) ? String(draft.fromAccountId) : '';
  draft.toAccountId = accountIds.has(String(draft.toAccountId)) ? String(draft.toAccountId) : '';
  draft.categoryId = categoryIds.has(String(draft.categoryId)) ? String(draft.categoryId) : '';
  draft.cardId = cardIds.has(String(draft.cardId)) ? String(draft.cardId) : '';
  draft.recurringId = recurringIds.has(String(draft.recurringId)) ? String(draft.recurringId) : '';
  const scheduleDay = Number(draft.scheduleDay);
  draft.scheduleDay = Number.isFinite(scheduleDay) ? Math.min(31, Math.max(1, Math.round(scheduleDay))) : null;
  ['accountRef', 'fromAccountRef', 'toAccountRef', 'categoryRef', 'cardRef', 'recurringRef'].forEach(key => { draft[key] = String(draft[key] || '').trim().slice(0, 80); });
  draft.currency = draft.currency === 'USD' ? 'USD' : 'ARS';
  draft.currencyExplicit = !!draft.currencyExplicit;
  draft.currencyAmbiguous = !!draft.currencyAmbiguous;
  draft.cardExplicit = !!draft.cardExplicit;
  draft.dateISO = isoFromLabel(draft.dateISO, now);
  draft.merchant = String(draft.merchant || '').trim().slice(0, 80);
  draft.note = String(draft.note || '').trim().slice(0, 120);
  draft.tags = [...new Set((Array.isArray(draft.tags) ? draft.tags : []).map(tag => fold(tag).replace(/\s/g, '-')).filter(Boolean))].slice(0, 8);
  if (!draft.tags.includes('asistente')) draft.tags.unshift('asistente');
  draft.explanation = String(draft.explanation || '').trim().slice(0, 240);
  draft.confidence = Math.max(0, Math.min(1, Number(draft.confidence) || 0));
  draft.source = 'local';
  return draft;
}
