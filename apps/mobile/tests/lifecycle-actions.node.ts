import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import { bindLocale } from '../src/i18n/bind.ts';

// Producto 25B2: the account and card deletion flows of `src/ui/commitment-actions.ts`, run as source with their hosts
// replaced: the confirmation names what stays and what stops, nothing is written before the destructive button,
// a failed write keeps the row and says so. Not a rendered iPhone screen.
const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const other: domain.Account = { id: 'other', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt };
const lonely: domain.Account = { id: 'lonely', name: 'Nueva', currency: 'ARS', openingMinor: 0, createdAt };
const cardAccount: domain.Account = { id: 'card-account', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: null, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const entries: domain.Entry[] = [
  { id: 'e1', accountId: 'cash', kind: 'expense', amountMinor: 1500, merchant: 'Kiosco', category: 'Comida', dateISO: '2026-09-05', createdAt },
  { id: 'e2', accountId: 'cash', kind: 'income', amountMinor: 900, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-09-06', createdAt },
  { id: 'e3', accountId: 'card-account', kind: 'expense', amountMinor: 12000, merchant: 'Súper', category: 'Comida', dateISO: '2026-09-10', createdAt },
];
const transfers: domain.Transfer[] = [{ id: 't1', fromAccountId: 'cash', toAccountId: 'other', amountMinor: 5000, note: '', dateISO: '2026-09-11', createdAt }];
const rules: domain.RecurringRule[] = [
  { id: 'r1', accountId: 'cash', kind: 'expense', amountMinor: 700, merchant: 'Gimnasio', category: 'Salud', frequency: 'monthly', anchorDateISO: '2026-09-15', nextDateISO: '2026-10-15', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt },
  { id: 'r2', accountId: 'cash', kind: 'expense', amountMinor: 100, merchant: 'Pausado', category: 'Salud', frequency: 'monthly', anchorDateISO: '2026-09-15', nextDateISO: '2026-10-15', active: false, deleted: false, createdAt, revision: 1, updatedAt: createdAt },
];

function harness({ fail = false, language = 'es-AR' as const, paid = false, deletedAccount = false } = {}) {
  const source = readFileSync(new URL('../src/ui/commitment-actions.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const alerts: { title: string; message: string; buttons: { text: string; style?: string; onPress?: () => void }[] }[] = [];
  const removed: string[] = [], removedCards: string[] = [], pushed: unknown[] = [];
  const savedCards: domain.CreditCardProfile[] = [];
  const state: unknown[] = [], refs: unknown[] = [];
  let cursor = 0, refCursor = 0;
  const accounts = deletedAccount ? [{ ...cash, revision: 1, updatedAt: createdAt, deletedAt: createdAt }, other, lonely, cardAccount] : [cash, other, lonely, cardAccount];
  const snapshot: domain.LedgerSnapshot = { accounts, entries, transfers: paid ? transfers.concat({ id: 't2', fromAccountId: 'other', toAccountId: 'card-account', amountMinor: 12000, note: '', dateISO: '2026-09-12', createdAt }) : transfers };
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (next: unknown) => { state[i] = next; }]; },
      useRef: (initial: unknown) => { const i = refCursor++; return (refs[i] ??= { current: initial }); } },
    'react-native': { Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'expo-router': { router: { push: (target: unknown) => pushed.push(target) } },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {}, selectionAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../storage/LedgerProvider': { useLedger: () => ({ snapshot, archive: { accounts: snapshot.accounts, records: [], recurring: rules, cards: [card] },
      removeAccount: async (id: string) => { if (fail) throw new Error('disk full'); removed.push(id); },
      saveCard: async (next: domain.CreditCardProfile) => { if (fail) throw new Error('disk full'); savedCards.push(next); },
      removeCard: async (id: string) => { if (fail) throw new Error('disk full'); removedCards.push(id); },
      saveDebt: async () => {}, saveRecurring: async () => {} }) },
    '../i18n/provider': { useI18n: () => bindLocale(language) },
  };
  const module = { exports: {} as Record<string, () => any> };
  runInNewContext(code, { module, exports: module.exports, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected lifecycle dependency: ' + name);
    return modules[name];
  } });
  const render = (hook: 'useAccountManagement' | 'useCardManagement' | 'useRecurringManagement') => { cursor = 0; refCursor = 0; return module.exports[hook](); };
  return { render, alerts, removed, removedCards, savedCards, pushed };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('deleting an account asks first and names what stays and what stops; Cancelar writes nothing; Eliminar writes the record once and runs `done`', async () => {
  const view = harness();
  let done = 0;
  view.render('useAccountManagement').remove(cash, () => done++);
  assert.equal(view.alerts.length, 1);
  assert.equal(view.alerts[0].title, '¿Eliminar Banco?');
  assert.equal(view.alerts[0].message, 'Deja de aparecer en tus cuentas, en Disponible y en los formularios. No borra nada: 2 movimientos y 1 transferencia siguen en Movimientos con su nombre y su moneda. Su 1 recurrente activo se detendrá; lo ya registrado no cambia.');
  assert.equal(JSON.stringify(view.alerts[0].buttons.map(button => [button.text, button.style])), JSON.stringify([['Cancelar', 'cancel'], ['Eliminar', 'destructive']]));
  assert.deepEqual(view.removed, [], 'nothing written before the destructive button');
  view.alerts[0].buttons[1].onPress!();
  await settle();
  assert.equal(JSON.stringify(view.removed), JSON.stringify(['cash']));
  assert.equal(done, 1);
  // A transfer counts as history too; an account with none says so and lists no rule.
  view.render('useAccountManagement').remove(other);
  assert.equal(view.alerts[1].message, 'Deja de aparecer en tus cuentas, en Disponible y en los formularios. No borra nada: 0 movimientos y 1 transferencia siguen en Movimientos con su nombre y su moneda.');
  view.render('useAccountManagement').remove(lonely);
  assert.equal(view.alerts[2].message, 'Deja de aparecer en tus cuentas y en los formularios. No tiene movimientos.');
  assert.equal(JSON.stringify(view.render('useAccountManagement').actions(cash).map((action: any) => [action.key, action.tone, action.label])), JSON.stringify([['delete', 'destructive', 'Eliminar']]));
  assert.equal(JSON.stringify(view.render('useAccountManagement').consequences(cash)), JSON.stringify({ movements: 2, transfers: 1, recurring: 1 }));
});

test('a failed deletion keeps the account as it was and says so; in English the confirmation reads in English', async () => {
  const failing = harness({ fail: true });
  failing.render('useAccountManagement').remove(cash);
  failing.alerts[0].buttons[1].onPress!();
  await settle();
  assert.equal(failing.render('useAccountManagement').error, 'disk full');
  assert.deepEqual(failing.removed, []);
  const english = harness({ language: 'en-US' as never });
  english.render('useAccountManagement').remove(cash);
  assert.equal(english.alerts[0].title, 'Delete Banco?');
  assert.match(english.alerts[0].message, /^It leaves your accounts, Available and the forms\. Nothing is erased: 2 transactions and 1 transfer stay/);
});

test('25B2 review: a card with a recorded debt is not deleted: the dialog names the debt and offers Pagar (the payment form) or Archivar; nothing is written on its own', async () => {
  const view = harness();
  let done = 0;
  view.render('useCardManagement').remove(card, () => done++);
  assert.equal(view.alerts[0].title, 'Todavía no se puede eliminar');
  // e3 is 12.000 cents: $ 120,00 in Argentina (a bare $ is the peso there; the space is the formatter's no-break space).
  assert.equal(view.alerts[0].message.replace(/\u00a0/g, ' '), 'Esta tarjeta tiene un saldo pendiente de $ 120,00. Pagalo primero, o archivala: deja de aparecer y conserva el saldo para pagarlo cuando quieras.');
  assert.equal(JSON.stringify(view.alerts[0].buttons.map(button => [button.text, button.style ?? null])), JSON.stringify([['Cancelar', 'cancel'], ['Pagar', null], ['Archivar', null]]));
  assert.equal(view.removedCards.length + view.savedCards.length, 0, 'nothing written by the dialog itself');
  view.alerts[0].buttons[1].onPress!();
  assert.equal(JSON.stringify(view.pushed), JSON.stringify([{ pathname: '/new-transfer', params: { toAccountId: 'card-account', maxAmountMinor: '12000' } }]), 'Pagar opens the reviewed payment, capped at the debt, as the card detail does');
  view.alerts[0].buttons[2].onPress!();
  await settle();
  assert.equal(JSON.stringify([view.savedCards.length, view.savedCards[0].active, view.savedCards[0].deleted, view.savedCards[0].revision, view.removedCards.length, done]), JSON.stringify([1, false, false, 1, 0, 1]), 'Archivar archives: never a deletion');
  // An archived card with debt: the same dialog, without Archivar.
  const archived = harness();
  archived.render('useCardManagement').remove({ ...card, active: false });
  assert.equal(JSON.stringify(archived.alerts[0].buttons.map(button => button.text)), JSON.stringify(['Cancelar', 'Pagar']));
  const english = harness({ language: 'en-US' as never });
  english.render('useCardManagement').remove(card);
  assert.equal(english.alerts[0].title, 'Cannot be deleted yet');
  assert.equal(JSON.stringify(english.alerts[0].buttons.map(button => button.text)), JSON.stringify(['Cancel', 'Pay', 'Archive']));
});

test('a card without debt asks first and says purchases and payments stay; Eliminar writes the deletion record through `removeCard`; a failed write keeps the card and says so', async () => {
  const view = harness({ paid: true });
  let done = 0;
  view.render('useCardManagement').remove(card, () => done++);
  assert.equal(view.alerts[0].title, '¿Eliminar esta tarjeta?');
  assert.equal(view.alerts[0].message, 'Deja de aparecer en Tarjetas y de aceptar compras y pagos. Las compras y los pagos anteriores siguen en tus registros y reportes; ningún saldo cambia.');
  assert.equal(JSON.stringify(view.alerts[0].buttons.map(button => [button.text, button.style])), JSON.stringify([['Cancelar', 'cancel'], ['Eliminar', 'destructive']]));
  assert.equal(view.removedCards.length, 0);
  view.alerts[0].buttons[1].onPress!();
  await settle();
  assert.equal(JSON.stringify([view.removedCards, view.savedCards.length, done]), JSON.stringify([['card'], 0, 1]), 'the storage path, never a plain save with `deleted`');
  const failing = harness({ paid: true, fail: true });
  failing.render('useCardManagement').remove(card);
  failing.alerts[0].buttons[1].onPress!();
  await settle();
  assert.equal(failing.render('useCardManagement').error, 'disk full');
  assert.equal(failing.removedCards.length, 0);
});

test('a rule on a deleted account offers only Eliminar: it cannot be resumed onto a closed row', () => {
  const live = harness();
  assert.equal(JSON.stringify(live.render('useRecurringManagement').actions(rules[1]).map((action: any) => action.key)), JSON.stringify(['resume', 'delete']));
  const closed = harness({ deletedAccount: true });
  assert.equal(JSON.stringify(closed.render('useRecurringManagement').actions(rules[1]).map((action: any) => action.key)), JSON.stringify(['delete']));
  assert.equal(JSON.stringify(closed.render('useRecurringManagement').actions(rules[0]).map((action: any) => action.key)), JSON.stringify(['delete']), 'even one an older copy left active');
});
