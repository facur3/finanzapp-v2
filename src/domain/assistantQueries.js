import { effectiveISO } from './reports.js';
import { fmtNum } from './money.js';
import { transactionCurrency } from './currency.js';
import { cardPendingTotal, cardStatementTotal } from './cards.js';
import { assetValueARS } from './investments.js';

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[¿?¡!.,;:()]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const escapeRegExp = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dayStart = value => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value, days) => {
  const date = dayStart(value);
  date.setDate(date.getDate() + days);
  return date;
};

const iso = date => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
const money = (value, currency = 'ARS') => (currency === 'USD' ? 'US$' : '$') + fmtNum(Number(value) || 0);
const plural = (count, singular, pluralValue) => count === 1 ? singular : pluralValue;

function rangeFor(text, now) {
  const today = dayStart(now);
  const rolling = text.match(/(?:ultimos?|pasados?)\s+(7|30)\s+dias?/);
  if (rolling) {
    const days = Number(rolling[1]);
    return { start: addDays(today, -(days - 1)), end: addDays(today, 1), label: 'los últimos ' + days + ' días' };
  }
  if (/\banteayer\b/.test(text)) return { start: addDays(today, -2), end: addDays(today, -1), label: 'anteayer' };
  if (/\bayer\b/.test(text)) return { start: addDays(today, -1), end: today, label: 'ayer' };
  if (/\bhoy\b/.test(text)) return { start: today, end: addDays(today, 1), label: 'hoy' };
  if (/semana (pasada|anterior)/.test(text)) {
    const start = addDays(today, -((today.getDay() + 6) % 7) - 7);
    return { start, end: addDays(start, 7), label: 'la semana pasada' };
  }
  if (/\besta semana\b|\bsemana actual\b/.test(text)) {
    const start = addDays(today, -((today.getDay() + 6) % 7));
    return { start, end: addDays(today, 1), label: 'esta semana' };
  }
  if (/mes (pasado|anterior)/.test(text)) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { start, end: new Date(today.getFullYear(), today.getMonth(), 1), label: 'el mes pasado' };
  }
  if (/\beste mes\b|\bmes actual\b/.test(text)) {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: addDays(today, 1), label: 'este mes' };
  }
  if (/ano (pasado|anterior)/.test(text)) {
    return { start: new Date(today.getFullYear() - 1, 0, 1), end: new Date(today.getFullYear(), 0, 1), label: 'el año pasado' };
  }
  if (/\beste ano\b|\bano actual\b/.test(text)) {
    return { start: new Date(today.getFullYear(), 0, 1), end: addDays(today, 1), label: 'este año' };
  }
  return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: addDays(today, 1), label: 'este mes' };
}

function rowsInRange(rows, range) {
  const start = iso(range.start), end = iso(range.end);
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const date = effectiveISO(row);
    return date >= start && date < end;
  });
}

function nativeTotals(rows, accounts) {
  const totals = { ARS: 0, USD: 0 };
  rows.forEach(row => {
    const currency = transactionCurrency(row, accounts);
    totals[currency] += Math.abs(Number(row.val != null ? row.val : row.amount) || 0);
  });
  return totals;
}

function canonicalARS(rows, context) {
  const totals = nativeTotals(rows, context.accounts);
  const rate = Number(context.usdRate) || 0;
  return {
    total: totals.ARS + (rate > 0 ? totals.USD * rate : 0),
    ars: totals.ARS,
    usd: totals.USD,
    complete: totals.USD === 0 || rate > 0,
  };
}

function totalText(total) {
  if (total.complete) return money(total.total);
  const parts = [];
  if (total.ars) parts.push(money(total.ars));
  if (total.usd) parts.push(money(total.usd, 'USD'));
  return parts.join(' + ') || money(0);
}

function valueARS(row, context) {
  const value = Math.abs(Number(row.val != null ? row.val : row.amount) || 0);
  const currency = transactionCurrency(row, context.accounts);
  if (currency === 'USD' && Number(context.usdRate) > 0) return value * Number(context.usdRate);
  return value;
}

function aggregate(rows, keyFor, context) {
  const map = new Map();
  rows.forEach(row => {
    const key = keyFor(row) || 'Sin categoría';
    map.set(key, (map.get(key) || 0) + valueARS(row, context));
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function categoryMatch(text, categories) {
  const entries = Object.entries(categories || {}).filter(([, category]) => category && category.type === 'gasto');
  return entries.find(([, category]) => {
    const name = normalize(category.name);
    return name.length > 2 && new RegExp('(^| )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)').test(text);
  });
}

function merchantMatch(text, transactions) {
  const names = [...new Set((Array.isArray(transactions) ? transactions : []).filter(row => row&&row.type==='gasto').map(row => String(row.merchant || '').trim()).filter(name => name.length > 2&&!/^(gasto|movimiento|compra)$/i.test(name)))];
  return names.sort((a,b)=>b.length-a.length).find(name => {
    const ref=normalize(name);return ref.length>2&&new RegExp('(^| )'+ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'( |$)').test(text);
  })||'';
}

function baseResult(kind, title, text, extras = {}) {
  return { matched: true, kind, title, text, lines: [], ...extras };
}

function spendingAnswer(text, context, now) {
  const range = rangeFor(text, now);
  const category = categoryMatch(text, context.categories);
  const merchant = merchantMatch(text, context.transactions);
  let rows = rowsInRange(context.transactions, range).filter(row => row.type === 'gasto');
  if (category) rows = rows.filter(row => row.cat === category[0]);
  if (merchant) rows = rows.filter(row => normalize(row.merchant)===normalize(merchant));
  const total = canonicalARS(rows, context);
  const filterName=merchant||category&&String(category[1].name)||'';
  if (!rows.length) return baseResult('spending', 'Sin gastos registrados', 'No tenés gastos registrados'+(filterName?' en '+filterName:'')+' '+range.label+'.', { rangeLabel: range.label });
  const categories = aggregate(rows, row => (context.categories?.[row.cat]?.name || 'Otros'), context);
  const merchants = aggregate(rows, row => String(row.merchant || 'Sin comercio'), context);
  const topCategory = categories[0], topMerchant = merchants[0];
  let answer = (range.label === 'hoy' ? 'Hoy' : range.label[0].toUpperCase() + range.label.slice(1)) + ' gastaste ' + totalText(total) + ' en ' + rows.length + ' ' + plural(rows.length, 'movimiento', 'movimientos') + '.';
  if (total.complete && !category && topCategory) answer += ' La categoría principal fue ' + topCategory.label + ' (' + money(topCategory.value) + ').';
  if (total.complete && topMerchant && !/^gasto$|^sin comercio$/i.test(topMerchant.label)) answer += ' El mayor comercio fue ' + topMerchant.label + ' (' + money(topMerchant.value) + ').';
  if (!total.complete) answer += ' Como falta una cotización del dólar, mantuve los importes en sus monedas originales.';
  return baseResult('spending', filterName ? ('Gastos en ' + filterName) : 'Tus gastos', answer, {
    amount: total.complete ? total.total : null,
    lines: total.complete ? (category||merchant ? merchants : categories).slice(0, 4).map(item => ({ label: item.label, value: money(item.value) })) : [],
    rangeLabel: range.label,
  });
}

function incomeAnswer(text, context, now) {
  const range = rangeFor(text, now);
  const rows = rowsInRange(context.transactions, range).filter(row => row.type === 'ingreso');
  const total = canonicalARS(rows, context);
  if (!rows.length) return baseResult('income', 'Sin ingresos registrados', 'No tenés ingresos registrados ' + range.label + '.', { rangeLabel: range.label });
  const sources = aggregate(rows, row => String(row.merchant || 'Ingreso'), context);
  let answer = (range.label === 'hoy' ? 'Hoy' : range.label[0].toUpperCase() + range.label.slice(1)) + ' ingresaron ' + totalText(total) + ' en ' + rows.length + ' ' + plural(rows.length, 'movimiento', 'movimientos') + '.';
  if (total.complete && sources[0]) answer += ' El origen principal fue ' + sources[0].label + ' (' + money(sources[0].value) + ').';
  if (!total.complete) answer += ' Como falta una cotización del dólar, mantuve los importes en sus monedas originales.';
  return baseResult('income', 'Tus ingresos', answer, { amount: total.complete ? total.total : null, lines: total.complete ? sources.slice(0, 4).map(item => ({ label: item.label, value: money(item.value) })) : [], rangeLabel: range.label });
}

function comparisonAnswer(context, now) {
  const today = dayStart(now);
  const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentEnd = addDays(today, 1);
  const previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const daysInPrevious = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const previousEnd = new Date(previousStart.getFullYear(), previousStart.getMonth(), Math.min(today.getDate(), daysInPrevious) + 1);
  const currentRows = rowsInRange(context.transactions, { start: currentStart, end: currentEnd }).filter(row => row.type === 'gasto');
  const previousRows = rowsInRange(context.transactions, { start: previousStart, end: previousEnd }).filter(row => row.type === 'gasto');
  const current = canonicalARS(currentRows, context), previous = canonicalARS(previousRows, context);
  if (!currentRows.length && !previousRows.length) return baseResult('comparison', 'Todavía no hay comparación', 'No hay gastos registrados en este mes ni en el mismo tramo del mes anterior.');
  if (!current.complete || !previous.complete) return baseResult('comparison', 'Falta la cotización', 'Hay gastos en dólares y todavía no tengo una cotización para compararlos correctamente con los gastos en pesos.');
  const delta = current.total - previous.total;
  const percent = previous.total > 0 ? Math.abs(delta) / previous.total * 100 : null;
  const currentByCategory = new Map(aggregate(currentRows, row => (context.categories?.[row.cat]?.name || 'Otros'), context).map(item => [item.label, item.value]));
  const previousByCategory = new Map(aggregate(previousRows, row => (context.categories?.[row.cat]?.name || 'Otros'), context).map(item => [item.label, item.value]));
  const labels = new Set([...currentByCategory.keys(), ...previousByCategory.keys()]);
  const changes = [...labels].map(label => ({ label, value: (currentByCategory.get(label) || 0) - (previousByCategory.get(label) || 0) })).sort((a, b) => b.value - a.value);
  const increases = changes.filter(item => item.value > 0.005);
  const comparable = 'hasta el día ' + today.getDate();
  if (delta <= 0) {
    let answer = 'En realidad, este mes gastaste ' + money(Math.abs(delta)) + ' menos ' + comparable + ': ' + money(current.total) + ' contra ' + money(previous.total) + '.';
    const reduction = [...changes].sort((a, b) => a.value - b.value).find(item => item.value < -0.005);
    if (reduction) answer += ' La mayor baja fue en ' + reduction.label + ' (' + money(Math.abs(reduction.value)) + ' menos).';
    return baseResult('comparison', 'Gastaste menos', answer, { amount: delta, lines: changes.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 4).map(item => ({ label: item.label, value: (item.value >= 0 ? '+' : '−') + money(Math.abs(item.value)) })) });
  }
  let answer = 'Este mes gastaste ' + money(delta) + ' más ' + comparable + ': ' + money(current.total) + ' contra ' + money(previous.total) + '.';
  if (percent != null) answer += ' Es un ' + percent.toFixed(0).replace('.', ',') + '% más.';
  if (increases.length) answer += ' Lo explican principalmente ' + increases.slice(0, 2).map(item => item.label + ' (+' + money(item.value) + ')').join(' y ') + '.';
  else answer += ' El aumento está repartido entre varios gastos pequeños.';
  return baseResult('comparison', 'Por qué gastaste más', answer, { amount: delta, lines: increases.slice(0, 4).map(item => ({ label: item.label, value: '+' + money(item.value) })) });
}

function accountAnswer(text, context) {
  const entry = Object.entries(context.accounts || {}).filter(([id]) => !(context.archived || {})[id]).find(([, account]) => {
    const name = normalize(account.name);
    return name.length > 2 && text.includes(name);
  });
  if (!entry) return null;
  const [id, account] = entry;
  const currency = account.kind==='invest'?'ARS':account.currency === 'USD' ? 'USD' : 'ARS';
  const balance = Number(context.balances?.[id]) || 0;
  return baseResult('account', account.name, 'En ' + account.name + ' tenés ' + money(balance, currency) + '.', { amount: balance });
}

function cardAnswer(text, context) {
  const cards = Array.isArray(context.cards) ? context.cards : [];
  const matches = cards.filter(item => {
    const refs = [item.brand, item.bank, item.last4].map(normalize).filter(Boolean);
    return refs.some(ref => ref.length >= 3 && text.includes(ref));
  });
  const wantsCards = /tarjeta|resumen|vencimiento|deuda/.test(text);
  if (!matches.length && !wantsCards) return null;
  const selected = matches.length === 1 ? matches[0] : (!matches.length && cards.length === 1 ? cards[0] : null);
  if (selected) {
    const debt = Math.max(0, Number(selected.saldo) || 0), statement = cardStatementTotal(selected), pending = cardPendingTotal(selected);
    const due=selected.vence&&selected.vence!=='—'?(' Vence '+selected.vence+'.'):'';
    const pendingCopy=pending>0?(' Además hay '+money(pending)+' en consumos todavía pendientes de contabilizar.') : '';
    return baseResult('cards', 'Tu ' + String(selected.brand || 'tarjeta'), 'La deuda total es ' + money(debt) + ' y el resumen pendiente es ' + money(statement) + '.'+pendingCopy+due, {
      amount: debt,
      lines: [{ label: 'Resumen pendiente', value: money(statement) }, ...(pending>0?[{label:'Consumos pendientes',value:money(pending)}]:[]), { label: 'Deuda total', value: money(debt) }],
    });
  }
  const selectedCards=matches.length>1?matches:cards;
  const debt = selectedCards.reduce((sum, item) => sum + Math.max(0, Number(item.saldo) || 0), 0);
  const statement = selectedCards.reduce((sum, item) => sum + cardStatementTotal(item), 0);
  const pending = selectedCards.reduce((sum, item) => sum + cardPendingTotal(item), 0);
  const commonBank=matches.length>1&&matches[0]?.bank&&matches.every(item=>normalize(item.bank)===normalize(matches[0].bank))&&text.includes(normalize(matches[0].bank))?matches[0].bank:'';
  const groupName=commonBank?('Tus tarjetas de '+commonBank):'Tus tarjetas';
  return baseResult('cards', groupName, selectedCards.length ? ('Entre '+(matches.length>1?'esas':'tus')+' tarjetas debés ' + money(debt) + '. Los resúmenes pendientes suman ' + money(statement) + (pending>0?(' y los consumos aún pendientes '+money(pending)): '') + '.') : 'Todavía no agregaste ninguna tarjeta.', {
    amount: debt,
    lines: selectedCards.slice(0, 4).map(item => ({ label: String(item.brand || 'Tarjeta') + (item.last4 ? ' · ' + item.last4 : ''), value: money(Number(item.saldo) || 0) })),
  });
}

function assetsInContext(context) {
  return Object.entries(context.assets || {}).flatMap(([accountId, rows]) => (
    Array.isArray(rows) ? rows.map(asset => ({ accountId, asset })) : []
  ));
}

function assetAnswer(text, context) {
  const candidates = assetsInContext(context).map(item => {
    const ticker = normalize(item.asset?.ticker);
    const name = normalize(item.asset?.name);
    const tickerMatch = ticker.length >= 2 && new RegExp('(^| )' + escapeRegExp(ticker) + '( |$)').test(text);
    const meaningfulNameWords = name.split(' ').filter(word => word.length > 2 && !['fci', 'fondo', 'comun', 'inversion', 'activo'].includes(word));
    const nameMatch = name.length > 2 && (text.includes(name) || (meaningfulNameWords.length > 0 && meaningfulNameWords.every(word => new RegExp('(^| )' + escapeRegExp(word) + '( |$)').test(text))));
    return { ...item, score: tickerMatch ? 2000 + ticker.length : nameMatch ? 1000 + name.length : 0 };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const { accountId, asset } = candidates[0];
  const qty = Number(asset.qty != null ? asset.qty : asset.units) || 0;
  const value = assetValueARS(asset, context.usdRate);
  const qtyText = qty.toLocaleString('es-AR', { maximumFractionDigits: 8 });
  const account = context.accounts?.[accountId];
  const where = account?.name ? ' en ' + account.name : '';
  const label = String(asset.ticker || asset.name || 'Activo');
  const copy = value > 0
    ? 'Tenés ' + qtyText + ' ' + label + where + ', valuados en ' + money(value) + '.'
    : 'Tenés ' + qtyText + ' ' + label + where + ', pero falta una cotización válida para calcular su valor en pesos.';
  return baseResult('asset', label, copy, {
    amount: value > 0 ? value : null,
    lines: [{ label: 'Cantidad', value: qtyText }, ...(value > 0 ? [{ label: 'Valor actual', value: money(value) }] : [])],
  });
}

function budgetAnswer(context, now) {
  const budgets = Object.entries(context.budgets || {})
    .map(([categoryId, rawLimit]) => ({ categoryId, limit: Number(rawLimit) || 0 }))
    .filter(item => item.limit > 0);
  if (!budgets.length) return baseResult('budgets', 'Sin presupuestos', 'Todavía no configuraste presupuestos mensuales.');
  const month = rangeFor('este mes', now);
  const expenses = rowsInRange(context.transactions, month).filter(row => row.type === 'gasto');
  const converted = canonicalARS(expenses, context);
  if (!converted.complete) return baseResult('budgets', 'Falta la cotización', 'Hay gastos en dólares y necesito una cotización para compararlos correctamente con tus presupuestos en pesos.');
  const spentByCategory = new Map(aggregate(expenses, row => row.cat || 'otros', context).map(item => [item.label, item.value]));
  const rows = budgets.map(item => {
    const spent = spentByCategory.get(item.categoryId) || 0;
    const category = context.categories?.[item.categoryId];
    return { ...item, spent, name: category?.name || item.categoryId, remaining: item.limit - spent };
  }).sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit));
  const totalLimit = rows.reduce((sum, item) => sum + item.limit, 0);
  const totalSpent = rows.reduce((sum, item) => sum + item.spent, 0);
  const exceeded = rows.filter(item => item.remaining < -0.005);
  let copy = 'Este mes usaste ' + money(totalSpent) + ' de ' + money(totalLimit) + ' en las categorías con presupuesto.';
  if (exceeded.length) copy += ' Te pasaste en ' + exceeded.map(item => item.name + ' por ' + money(Math.abs(item.remaining))).join(' y ') + '.';
  else copy += ' Te quedan ' + money(Math.max(0, totalLimit - totalSpent)) + ' dentro de esos límites.';
  return baseResult('budgets', exceeded.length ? 'Presupuestos excedidos' : 'Tus presupuestos', copy, {
    amount: totalLimit - totalSpent,
    lines: rows.slice(0, 4).map(item => ({ label: item.name, value: money(item.spent) + ' / ' + money(item.limit) })),
  });
}

function summaryAnswer(text, context) {
  const summary = context.summary || {};
  if (/patrimonio|cuanto tengo en total|capital total/.test(text)) {
    const value = Number(summary.pat) || 0;
    const fci = Math.max(0, Number(summary.fci) || 0);
    const liquid = Number.isFinite(Number(summary.liquid)) ? Number(summary.liquid) : Math.max(0, (Number(summary.disp) || 0) - fci);
    const fciCopy = fci > 0 ? ' Dentro de las inversiones, ' + money(fci) + ' corresponden a FCI rescatables y también forman parte de tu disponible; no se cuentan dos veces.' : '';
    return baseResult('net-worth', 'Tu patrimonio', 'Tu patrimonio neto registrado es ' + money(value) + ': ' + money(liquid) + ' en cuentas y efectivo, ' + money(summary.inv) + ' en inversiones y ' + money(summary.debt) + ' de deudas.' + fciCopy, { amount: value, lines: [{ label: 'Cuentas y efectivo', value: money(liquid) }, { label: 'Inversiones', value: money(summary.inv) }, { label: 'Deudas', value: '−' + money(summary.debt) }] });
  }
  if (/inversion|invertido|portfolio|portafolio/.test(text)) {
    const value = Number(summary.inv) || 0;
    const assets = assetsInContext(context);
    const holdings = assets.map(item => ({ label: String(item.asset?.ticker || item.asset?.name || 'Activo'), value: assetValueARS(item.asset, context.usdRate) })).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    return baseResult('investments', 'Tus inversiones', 'El valor registrado de tus inversiones es ' + money(value) + (assets.length ? ' en ' + assets.length + ' ' + plural(assets.length, 'tenencia', 'tenencias') + '.' : '.'), { amount: value, lines: holdings.slice(0, 4).map(item => ({ label: item.label, value: money(item.value) })) });
  }
  if (/disponible|liquidez|plata tengo|saldo total/.test(text)) {
    const value = Number(summary.disp) || 0;
    const fci = Math.max(0, Number(summary.fci) || 0);
    const liquid = Number.isFinite(Number(summary.liquid)) ? Number(summary.liquid) : Math.max(0, value - fci);
    const copy = fci > 0 ? ('Tenés ' + money(value) + ' disponible: ' + money(liquid) + ' en cuentas y efectivo, más ' + money(fci) + ' en FCI rescatables.') : ('Tenés ' + money(value) + ' disponible en cuentas y efectivo.');
    return baseResult('available', 'Dinero disponible', copy, { amount: value, lines: fci > 0 ? [{ label: 'Cuentas y efectivo', value: money(liquid) }, { label: 'FCI rescatables', value: money(fci) }] : [] });
  }
  if (/cuanto debo|cuanta deuda|deudas? totales?|pasivos?/.test(text)) {
    const value = Number(summary.debt) || 0;
    return baseResult('debt', 'Tus deudas', 'Tus deudas registradas suman ' + money(value) + ', incluyendo tarjetas y cuentas de deuda.', { amount: value });
  }
  return null;
}

export function looksLikeFinancialQuestion(value) {
  const text = normalize(value);
  if (!text) return false;
  return /^(cuanto|cuanta|que|en que|de donde|por que|como|donde|quien|cual|mostrame|muestrame|decime|dime|comparame|analiza|resumen)\b/.test(text)
    || /\b(mi patrimonio|mis gastos|mis ingresos|mis tarjetas|mi resumen|mis presupuestos|cuanto tengo|gaste mas|gaste menos|se me fue la plata)\b/.test(text);
}

export function answerFinancialQuestion(value, context = {}, now = new Date()) {
  const text = normalize(value);
  if (!looksLikeFinancialQuestion(text)) return { matched: false };
  const comparison = /por que.*gast|gast.*mas|compar.*(mes|gasto)|diferencia.*(mes|gasto)/.test(text);
  if (comparison) return comparisonAnswer(context, now);
  const card = cardAnswer(text, context);
  if (card && /tarjeta|resumen|vencimiento|deuda|debo|debemos/.test(text)) return card;
  const asset = assetAnswer(text, context);
  if (asset && /cuanto|tenes|tengo|hay|vale|valor|tenencia|cantidad|saldo/.test(text)) return asset;
  const account = accountAnswer(text, context);
  if (account && /cuanto|saldo|tengo|hay|disponible/.test(text)) return account;
  if (/presupuesto|limite mensual|me pase/.test(text)) return budgetAnswer(context, now);
  const summary = summaryAnswer(text, context);
  if (summary) return summary;
  if (/ingres|cobre|cobrado|entr[oó]|recibi|gane|ganado|me (?:pago|pagaron|dio|dieron|regalo|regalaron|presto|prestaron|devolvio|devolvieron)|reembols|reintegr|deposit|acredit/.test(text)) return incomeAnswer(text, context, now);
  if (/gast|compra|pague|egreso|en que|se me fue|salio|cobraron|debitaron/.test(text)) return spendingAnswer(text, context, now);
  if (/balance|resultado|ahorr|como viene.*mes/.test(text)) {
    const range = rangeFor(text, now);
    const rows = rowsInRange(context.transactions, range);
    const income = canonicalARS(rows.filter(row => row.type === 'ingreso'), context);
    const expense = canonicalARS(rows.filter(row => row.type === 'gasto'), context);
    if (!income.complete || !expense.complete) return baseResult('balance', 'Falta la cotización', 'Hay movimientos en dólares y necesito una cotización para calcular el balance en pesos.');
    const result = income.total - expense.total;
    return baseResult('balance', 'Balance de ' + range.label, 'En ' + range.label + ' ingresaron ' + money(income.total) + ' y gastaste ' + money(expense.total) + '. El balance es ' + (result >= 0 ? '+' : '−') + money(Math.abs(result)) + '.', { amount: result, lines: [{ label: 'Ingresos', value: money(income.total) }, { label: 'Gastos', value: '−' + money(expense.total) }] });
  }
  return baseResult('help', 'Puedo analizar tus datos', 'Probá preguntarme “¿En qué gasté ayer?”, “¿Por qué gasté más este mes?”, “¿Cuánto tengo disponible?” o “¿Cuál es mi patrimonio?”.');
}
