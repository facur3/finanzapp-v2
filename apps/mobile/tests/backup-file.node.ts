import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as domain from '@finanzapp/domain';
import { BACKUP_FILE_PREFIX, backupFileName, buildBackupFile, utf8Length } from '../src/ui/backup-file.ts';
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
  assert.throws(() => buildBackupFile(archiveOf(3), now, 100), (cause: unknown) => cause instanceof Error && cause.message === 'backup.export.tooLarge');
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
