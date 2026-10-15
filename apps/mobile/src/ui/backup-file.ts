import { BACKUP_MAX_BYTES, createRecoveryBackup, parsePilotBackup, todayKey, type LedgerArchive } from '@finanzapp/domain';

/** Producto 25Q2: the backup file a person shares. Pure, so the name, the size check and the round trip are tested
 * without React Native. */

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
