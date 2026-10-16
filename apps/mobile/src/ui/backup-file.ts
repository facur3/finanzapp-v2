import { BACKUP_MAX_BYTES, assertOpenAccount, createRecoveryBackup, materializeRecurringRule, parsePilotBackup, planCatchUpInserts, todayKey, type ImportPreview,
  type LedgerArchive } from '@finanzapp/domain';

/** Producto 25Q2: the backup file a person shares, and (25Q4) what the import's review counts. Pure, so the name, the size
 * check, the round trip and the count are tested without React Native. */

/** The one place the working name reaches a file name (the naming workflow renames it, brand-brief.md §3). The format's
 * own identifiers inside the file (`app`, `schema`, `moneyUnit`) never follow the name: the importer reads content. */
export const BACKUP_FILE_PREFIX = 'FinanzApp-backup';

/** «FinanzApp-backup-2026-10-15-1432.json»: the device's local day and time, ASCII, sorted by name as by date. */
export function backupFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${BACKUP_FILE_PREFIX}-${todayKey(now)}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** The UTF-8 size of a string, counted from its UTF-16 units (Hermes' TextEncoder is not relied on). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { bytes += 4; i++; }
    else bytes += 3; // The rest of the plane, and a lone surrogate (written as U+FFFD, three bytes).
  }
  return bytes;
}

/** The export, judged before anything is written: compact JSON (whitespace is no part of the format, every build reads
 * it), its UTF-8 size against the import cap (so a copy too large says so with its own sentence, never the import's), then
 * the check that this app can restore it. `maxBytes` is a test seam; the screen never passes it. */
export function buildBackupFile(archive: LedgerArchive, now = new Date(), maxBytes = BACKUP_MAX_BYTES): { name: string; json: string; bytes: number } {
  const json = JSON.stringify(createRecoveryBackup(archive, now));
  const bytes = utf8Length(json);
  if (bytes > maxBytes) throw new Error('backup.export.tooLarge');
  parsePilotBackup(json);
  return { name: backupFileName(now), json, bytes };
}

/** 25Q4: the movements a restore's catch-ups also record (what fell due since the copy was made), counted for the review
 * by storage's own rules: database.ts `catchUpStep` and `catchUpRecurring` (nothing on a deleted account, card or debt; an
 * id already in the ledger is never recorded again; at most 64 steps a pass) and `catchUpInstallments`. Only the copy's
 * new rules and plans: the device's own were caught up by the foreground pass. */
export function restoreCatchUp(current: LedgerArchive, preview: ImportPreview, todayISO: string, nowISO = new Date().toISOString()): number {
  const accounts = [...current.accounts, ...preview.accounts];
  const cards = [...current.cards ?? [], ...preview.cards];
  const debts = [...current.debts ?? [], ...preview.debts];
  const records = [...current.records, ...preview.records];
  const known = new Set(records.map(record => record.entry.id));
  let count = 0;
  for (let rule of preview.recurring) {
    try {
      assertOpenAccount(rule.accountId, accounts, cards, debts);
      for (let step = 0; step < 64; step++) {
        const batch = materializeRecurringRule(rule, accounts, todayISO, nowISO);
        count += batch.entries.filter(entry => !known.has(entry.id)).length;
        if (batch.complete) break;
        rule = batch.rule;
      }
    } catch { /* Storage leaves such a rule for review. */ }
  }
  const plans = { records, cards, installmentPlans: [...current.installmentPlans ?? [], ...preview.installmentPlans],
    purchaseOperations: [...current.purchaseOperations ?? [], ...preview.purchaseOperations] };
  for (const plan of preview.installmentPlans) {
    try { count += planCatchUpInserts(plans, plan.id, todayISO).length; } catch { /* The pass reports it in the banner. */ }
  }
  return count;
}
