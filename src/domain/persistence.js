export const LOCAL_STATE_SCHEMA = 'finanzapp.local.v3';
export const LEGACY_STATE_SCHEMA = 'finanzapp.local.v2';

function stateJson(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('invalid-state');
  return JSON.stringify(state);
}

// Small deterministic integrity check. This is not encryption; it detects
// truncated/corrupted localStorage writes before they replace the last good copy.
export function checksumText(value) {
  let hash = 0x811c9dc5;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function stateChecksum(state) {
  return checksumText(stateJson(state));
}

export function createLocalEnvelope(state, options = {}) {
  const json = stateJson(state);
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const revision = Math.max(1, Math.floor(Number(options.revision) || 1));
  return {
    app: 'FinanzApp',
    schema: LOCAL_STATE_SCHEMA,
    version: 3,
    savedAt: now.toISOString(),
    revision,
    checksum: checksumText(json),
    state,
  };
}

export function parseLocalEnvelope(raw) {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!envelope || envelope.app !== 'FinanzApp' || !envelope.state || typeof envelope.state !== 'object' || Array.isArray(envelope.state)) {
    throw new Error('invalid-envelope');
  }
  const schema = envelope.schema || LEGACY_STATE_SCHEMA;
  if (schema !== LOCAL_STATE_SCHEMA && schema !== LEGACY_STATE_SCHEMA) throw new Error('unsupported-schema');
  if (schema === LOCAL_STATE_SCHEMA) {
    if (!envelope.checksum || envelope.checksum !== stateChecksum(envelope.state)) throw new Error('checksum-mismatch');
  }
  return {
    envelope,
    state: envelope.state,
    revision: Math.max(0, Math.floor(Number(envelope.revision) || 0)),
    legacy: schema !== LOCAL_STATE_SCHEMA,
  };
}

function safeGet(storage, key) {
  try { return storage.getItem(key); } catch (error) { return null; }
}

function quarantine(storage, key, raw) {
  if (!key || !raw) return;
  try {
    const prior = storage.getItem(key);
    if (!prior) storage.setItem(key, raw);
  } catch (error) {
    // Recovery must still continue when storage is read-only or full.
  }
}

export function loadLocalState(storage, options = {}) {
  if (!storage || typeof storage.getItem !== 'function') return { state: null, source: null, recovered: false, errors: [] };
  const primaryKey = options.primaryKey;
  const candidates = [
    { key: primaryKey, source: 'primary' },
    // A verified temporary envelope means the app stopped between the first
    // and final phase of an atomic write. Use it only when primary is missing
    // or invalid; a valid primary always remains the committed source.
    { key: options.tempKey, source: 'temp' },
    { key: options.backupKey, source: 'backup' },
    { key: options.legacyKey, source: 'legacy' },
  ].filter(candidate => candidate.key);
  const errors = [];
  let corruptPrimary = null;
  const valid = [];
  for (const candidate of candidates) {
    const raw = safeGet(storage, candidate.key);
    if (!raw) continue;
    try {
      const parsed = parseLocalEnvelope(raw);
      const state = options.validateState ? options.validateState(parsed.state) : parsed.state;
      valid.push({ ...parsed, state, source: candidate.source, raw });
    } catch (error) {
      errors.push({ source: candidate.source, error: error && error.message ? error.message : 'invalid' });
      if (candidate.source === 'primary') corruptPrimary = raw;
    }
  }
  if (corruptPrimary) quarantine(storage, options.quarantineKey, corruptPrimary);
  const primary = valid.find(candidate => candidate.source === 'primary');
  const temp = valid.find(candidate => candidate.source === 'temp');
  // A verified temp with a higher revision is a commit interrupted between the
  // temp verification and the primary swap. Recover it even when the older
  // primary is still valid. Equal/older temp revisions are stale and ignored.
  const selected = temp && (!primary || temp.revision > primary.revision)
    ? temp
    : primary || valid.find(candidate => candidate.source === 'backup') || valid.find(candidate => candidate.source === 'legacy');
  if (selected) return {
    state: selected.state,
    source: selected.source,
    recovered: selected.source !== 'primary',
    legacy: selected.legacy,
    revision: selected.revision,
    raw: selected.raw,
    errors,
  };
  return { state: null, source: null, recovered: false, errors };
}

export function saveLocalState(storage, state, options = {}) {
  if (!storage || typeof storage.setItem !== 'function') throw new Error('storage-unavailable');
  const primaryKey = options.primaryKey;
  const backupKey = options.backupKey;
  const tempKey = options.tempKey;
  if (!primaryKey || !backupKey || !tempKey) throw new Error('missing-storage-key');

  const previousRaw = safeGet(storage, primaryKey);
  let previousValid = false;
  if (previousRaw) {
    try { parseLocalEnvelope(previousRaw); previousValid = true; } catch (error) { previousValid = false; }
  }
  const envelope = createLocalEnvelope(state, { revision: options.revision, now: options.now });
  const raw = JSON.stringify(envelope);

  storage.setItem(tempKey, raw);
  parseLocalEnvelope(storage.getItem(tempKey));
  if (previousValid) storage.setItem(backupKey, previousRaw);
  storage.setItem(primaryKey, raw);
  parseLocalEnvelope(storage.getItem(primaryKey));
  storage.removeItem(tempKey);
  return { raw, envelope };
}
