import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as domain from '@finanzapp/domain';
import { BACKUP_FILE_PREFIX, backupFileName, buildBackupFile, discardBackupLeftovers, isPickerCopy, restoreCatchUp, utf8Length } from '../src/ui/backup-file.ts';
import { SENSITIVE_FILES } from '../../../scripts/check-repo.mjs';

// Producto 25Q2: the backup file a person shares. Pure: no file system, no share sheet (more-routes covers the screen).
const createdAt = '2026-10-01T12:00:00.000Z';
const account: domain.Account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
// Synthetic movements shaped like real ones: 36-character ids, a short merchant and category, ISO timestamps.
const archiveOf = (count: number): domain.LedgerArchive => ({ accounts: [account], records: Array.from({ length: count }, (_, i) => domain.initialRecord({
  id: 'e' + String(i).padStart(35, '0'), accountId: 'a', kind: 'expense', amountMinor: 1000 + i, merchant: 'Supermercado', category: 'Comida',
  dateISO: '2026-09-' + String(1 + (i % 28)).padStart(2, '0'), createdAt })) });

test('25Q2: the file is named by the local day and time, ASCII, and the repository guard recognises it as a backup', () => {
  assert.equal(backupFileName(new Date(2026, 9, 15, 14, 32)), 'FinanzApp-backup-2026-10-15-1432.json');
  assert.equal(backupFileName(new Date(2027, 0, 5, 9, 5)), 'FinanzApp-backup-2027-01-05-0905.json', 'zero-padded');
  const name = backupFileName(new Date(2026, 9, 15, 14, 32));
  assert.match(name, /^[\x20-\x7e]+$/);
  assert.doesNotMatch(name, /piloto|\d{10,}/, 'no «piloto», no epoch');
  assert.ok(name.startsWith(BACKUP_FILE_PREFIX));
  // The guard of a public repository knows the new name and the old one (finanzapp-piloto-<ms>.json).
  for (const file of [name, 'docs/' + name, 'finanzapp-piloto-1728900000000.json']) assert.ok(SENSITIVE_FILES.some(re => re.test(file)), file);
});

test('25Q2: utf8Length counts what a UTF-8 file holds', () => {
  for (const text of ['', 'abc', 'Ñandú', '€ 1.234,56', '😀 ok', 'a\uD800b', JSON.stringify({ merchant: 'Café «Nº 1»' })]) {
    assert.equal(utf8Length(text), Buffer.byteLength(text, 'utf8'), JSON.stringify(text));
  }
});

test('25Q2: the export is compact JSON that this app restores, measured in bytes before anything is written', () => {
  const now = new Date(2026, 9, 15, 14, 32);
  const built = buildBackupFile(archiveOf(3), now);
  assert.equal(built.name, 'FinanzApp-backup-2026-10-15-1432.json');
  assert.equal(built.json.includes('\n'), false, 'one line: whitespace is no part of the format');
  assert.equal(built.bytes, Buffer.byteLength(built.json, 'utf8'));
  const parsed = domain.parsePilotBackup(built.json);
  assert.equal(parsed.archive.records.length, 3);
  assert.equal(parsed.exportedAt, now.toISOString());
  // Over the cap: its own sentence, before any file exists, never the import's «Elegí una copia JSON de hasta 5 MB».
  const tooLarge = (cause: unknown) => cause instanceof Error && cause.message === 'backup.export.tooLarge';
  assert.throws(() => buildBackupFile(archiveOf(3), now, 100), tooLarge);
  // The cap counts UTF-8 bytes, as the file is written and the importer measures it, not characters: accents cost two.
  const accented: domain.LedgerArchive = { ...archiveOf(3), records: archiveOf(3).records.map(record => ({ ...record, entry: { ...record.entry, merchant: 'Panadería Ñandú ñññ' } })) };
  const exact = buildBackupFile(accented, now);
  assert.ok(exact.bytes > exact.json.length, 'accented text is longer in bytes than in characters');
  assert.equal(buildBackupFile(accented, now, exact.bytes).bytes, exact.bytes, 'exactly at the cap is accepted');
  assert.throws(() => buildBackupFile(accented, now, exact.bytes - 1), tooLarge);
  assert.throws(() => buildBackupFile(accented, now, exact.json.length), tooLarge, 'a character count would have let it through');
});

test('25Q2: compact moves the 5 MB wall well past the pretty file (measured bytes per movement)', () => {
  const archive = archiveOf(1000);
  const compact = buildBackupFile(archive).bytes;
  const pretty = Buffer.byteLength(JSON.stringify(domain.createRecoveryBackup(archive), null, 2), 'utf8');
  const perCompact = compact / 1000, perPretty = pretty / 1000;
  const wall = (per: number) => Math.floor(domain.BACKUP_MAX_BYTES / per);
  const measured = `compact ${perCompact.toFixed(0)} B/movement (≈${wall(perCompact)} movements), pretty ${perPretty.toFixed(0)} B (≈${wall(perPretty)})`;
  assert.ok(compact * 1.25 <= pretty, measured);
  assert.ok(wall(perCompact) > 15000, measured);
});

test('25Q4: the restore\'s catch-up count follows storage\'s rules: each due date once, past a batch, and nothing for a paused, not yet due or deleted account\'s rule', () => {
  const rent: domain.RecurringRule = { id: 'rent', accountId: 'a', kind: 'expense', amountMinor: 50000, merchant: 'Alquiler', category: 'Hogar', frequency: 'monthly',
    anchorDateISO: '2026-07-01', nextDateISO: '2026-07-01', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
  const empty: domain.LedgerArchive = { accounts: [], records: [] };
  const count = (copy: Partial<domain.LedgerArchive>) => restoreCatchUp(empty, domain.previewBackupImport(empty, { accounts: [account], records: [], ...copy }), '2026-09-20');
  assert.equal(count({ recurring: [rent] }), 3, '1 jul, 1 ago and 1 sep');
  assert.equal(count({ recurring: [{ ...rent, active: false }] }), 0, 'paused');
  assert.equal(count({ recurring: [{ ...rent, nextDateISO: '2026-10-01' }] }), 0, 'not due yet');
  const deleted = { ...account, revision: 1, updatedAt: '2026-10-02T12:00:00.000Z', deletedAt: '2026-10-02T12:00:00.000Z' };
  assert.equal(count({ accounts: [deleted], recurring: [rent] }), 0, 'nothing lands on a deleted account');
  // A date the copy already holds (recorded, edited or undone) is never recorded again.
  const held = domain.initialRecord({ id: domain.recurringEntryId('rent', '2026-07-01'), accountId: 'a', kind: 'expense', amountMinor: 50000, merchant: 'Alquiler',
    category: 'Hogar', dateISO: '2026-07-01', createdAt });
  assert.equal(count({ records: [held], recurring: [rent] }), 2);
  // Eight years of a weekly rule is more than one batch (366 dates): every date, once.
  const weekly = { ...rent, frequency: 'weekly' as const, anchorDateISO: '2018-09-21', nextDateISO: '2018-09-21' };
  assert.equal(count({ recurring: [weekly] }), domain.recurringOccurrencesThrough(weekly, '2026-09-20', 1000).length);
  assert.ok(count({ recurring: [weekly] }) > domain.RECURRING_BATCH_SIZE);
});

test('25Q4: an export an ended process left in the cache is deleted at the next launch; nothing else there is touched', () => {
  const deleted: string[] = [];
  const file = (name: string, refuses = false) => ({ name, delete: () => { if (refuses) throw new Error('EPERM'); deleted.push(name); } });
  discardBackupLeftovers(['FinanzApp-backup-2026-10-15-1432.json', 'finanzapp-piloto-1728900000000.json', 'FinanzApp-backup-2026-10-15-1432.json.download', 'fonts.json',
    'ledger.sqlite', 'ExponentExperienceData'].map(name => file(name)));
  assert.deepEqual(deleted, ['FinanzApp-backup-2026-10-15-1432.json', 'finanzapp-piloto-1728900000000.json']);
  // Only names the public repository's guard also knows as a backup.
  for (const name of deleted) assert.ok(SENSITIVE_FILES.some(re => re.test(name)), name);
  // A file that refuses never stops the next one.
  deleted.length = 0;
  discardBackupLeftovers([file('FinanzApp-backup-2026-10-14-0900.json', true), file('FinanzApp-backup-2026-10-15-1432.json')]);
  assert.deepEqual(deleted, ['FinanzApp-backup-2026-10-15-1432.json']);
});

test('25Q4: only iOS\'s own copy of a picked file is the app\'s to delete', () => {
  const container = 'file:///var/mobile/Containers/Data/Application/APP/';
  for (const uri of ['file:///private/var/mobile/Containers/Data/Application/APP/tmp/com.facur3.finanzapp.dev-Inbox/copia.json',
    'file:///var/mobile/Containers/Data/Application/APP/tmp/com.facur3.finanzapp.dev-Inbox/copia.json']) {
    assert.equal(isPickerCopy(uri, container), true, uri);
    assert.equal(isPickerCopy(uri, 'file:///private/var/mobile/Containers/Data/Application/APP'), true, 'the container spelled through /private, without its slash');
  }
  for (const uri of ['file:///var/mobile/Containers/Data/Application/APP/Documents/copia.json', 'file:///var/mobile/Containers/Data/Application/APP/Library/Caches/x.json',
    'file:///var/mobile/Containers/Data/Application/OTHER/tmp/x-Inbox/copia.json', 'file:///var/mobile/Containers/Data/Application/APP-2/tmp/x-Inbox/copia.json',
    'file:///private/var/mobile/Library/Mobile%20Documents/com~apple~CloudDocs/copia.json', 'content://com.android.providers.downloads.documents/document/42', undefined]) {
    assert.equal(isPickerCopy(uri, container), false, String(uri));
    assert.equal(isPickerCopy(uri, container.slice(0, -1)), false, String(uri));
  }
});
