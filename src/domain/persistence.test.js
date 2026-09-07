import { describe, expect, it } from 'vitest';
import { createLocalEnvelope, loadLocalState, parseLocalEnvelope, saveLocalState, stateChecksum } from './persistence.js';

class MemoryStorage {
  constructor(seed = {}) { this.values = { ...seed }; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null; }
  setItem(key, value) { this.values[key] = String(value); }
  removeItem(key) { delete this.values[key]; }
}

const keys = { primaryKey: 'state', backupKey: 'backup', tempKey: 'temp', legacyKey: 'legacy', quarantineKey: 'corrupt' };

describe('local persistence envelope', () => {
  it('round-trips a verified snapshot', () => {
    const envelope = createLocalEnvelope({ balances: { cash: 10 } }, { revision: 7, now: new Date('2026-09-05T12:00:00Z') });
    expect(envelope.checksum).toBe(stateChecksum(envelope.state));
    expect(parseLocalEnvelope(JSON.stringify(envelope))).toMatchObject({ state: { balances: { cash: 10 } }, revision: 7, legacy: false });
  });

  it('rejects a snapshot changed without updating its checksum', () => {
    const envelope = createLocalEnvelope({ balances: { cash: 10 } });
    envelope.state.balances.cash = 999;
    expect(() => parseLocalEnvelope(JSON.stringify(envelope))).toThrow('checksum-mismatch');
  });

  it('keeps the previous verified snapshot as an automatic recovery copy', () => {
    const storage = new MemoryStorage();
    saveLocalState(storage, { balances: { cash: 10 } }, { ...keys, revision: 1 });
    const first = storage.getItem('state');
    saveLocalState(storage, { balances: { cash: 20 } }, { ...keys, revision: 2 });
    expect(storage.getItem('backup')).toBe(first);
    expect(loadLocalState(storage, keys)).toMatchObject({ state: { balances: { cash: 20 } }, source: 'primary', revision: 2 });
  });

  it('recovers from backup and quarantines a corrupted primary snapshot', () => {
    const backup = JSON.stringify(createLocalEnvelope({ balances: { cash: 10 } }, { revision: 1 }));
    const storage = new MemoryStorage({ state: '{bad json', backup });
    const loaded = loadLocalState(storage, keys);
    expect(loaded).toMatchObject({ state: { balances: { cash: 10 } }, source: 'backup', recovered: true });
    // Quarantine occurs even when a valid backup is found, so the damaged bytes
    // remain available for support instead of being silently overwritten.
    expect(storage.getItem('corrupt')).toBe('{bad json');
  });

  it('recovers a verified write interrupted before the primary swap', () => {
    const temp = JSON.stringify(createLocalEnvelope({ balances: { cash: 25 } }, { revision: 3 }));
    const loaded = loadLocalState(new MemoryStorage({ temp }), keys);
    expect(loaded).toMatchObject({ state: { balances: { cash: 25 } }, source: 'temp', recovered: true, revision: 3 });
  });

  it('prefers a newer verified temp after a crash left the old primary intact', () => {
    const primary = JSON.stringify(createLocalEnvelope({ balances: { cash: 10 } }, { revision: 2 }));
    const temp = JSON.stringify(createLocalEnvelope({ balances: { cash: 25 } }, { revision: 3 }));
    expect(loadLocalState(new MemoryStorage({ state: primary, temp }), keys)).toMatchObject({
      state: { balances: { cash: 25 } }, source: 'temp', recovered: true, revision: 3,
    });
  });

  it('ignores a stale temp when the committed primary has the newer revision', () => {
    const primary = JSON.stringify(createLocalEnvelope({ balances: { cash: 30 } }, { revision: 4 }));
    const temp = JSON.stringify(createLocalEnvelope({ balances: { cash: 25 } }, { revision: 3 }));
    expect(loadLocalState(new MemoryStorage({ state: primary, temp }), keys)).toMatchObject({
      state: { balances: { cash: 30 } }, source: 'primary', recovered: false, revision: 4,
    });
  });

  it('reads v2 backups so existing installations migrate without data loss', () => {
    const legacy = JSON.stringify({ app: 'FinanzApp', schema: 'finanzapp.local.v2', version: 2, state: { balances: { cash: 5 } } });
    const loaded = loadLocalState(new MemoryStorage({ legacy }), keys);
    expect(loaded).toMatchObject({ state: { balances: { cash: 5 } }, source: 'legacy', recovered: true, legacy: true });
  });
});
