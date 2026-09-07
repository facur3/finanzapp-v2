import { describe, expect, it } from 'vitest';
import { cloudSnapshotHasData, decideCloudSync } from './cloudSync.js';

describe('offline-first cloud sync decisions', () => {
  it('uploads existing local data to an empty account', () => {
    expect(decideCloudSync({ localHas: true, remoteHas: false })).toBe('push');
  });

  it('downloads cloud data onto a genuinely empty device', () => {
    expect(decideCloudSync({ localHas: false, remoteHas: true })).toBe('pull');
  });

  it('uploads an intentional offline deletion instead of restoring stale cloud data', () => {
    expect(decideCloudSync({ localHas: false, remoteHas: true, pending: true, lastSeen: 10000, remoteModified: 10000 })).toBe('push');
  });

  it('flushes an offline local change when the cloud did not change', () => {
    expect(decideCloudSync({ localHas: true, remoteHas: true, pending: true, lastSeen: 10000, remoteModified: 10000 })).toBe('push');
  });

  it('refuses to overwrite when local and remote both changed offline', () => {
    expect(decideCloudSync({ localHas: true, remoteHas: true, pending: true, lastSeen: 10000, remoteModified: 15000 })).toBe('conflict');
    expect(decideCloudSync({ localHas: true, remoteHas: true, pending: true, lastSeen: 10000, remoteModified: 10001 })).toBe('conflict');
  });

  it('asks on first contact when both sides already contain different data', () => {
    expect(decideCloudSync({ localHas: true, remoteHas: true, pending: true, lastSeen: 0, remoteModified: 15000 })).toBe('conflict');
    expect(decideCloudSync({ localHas: true, remoteHas: true, pending: false, lastSeen: 0, localModified: 50000, remoteModified: 10000 })).toBe('conflict');
  });

  it('pulls a newer remote snapshot when this device has no pending edits', () => {
    expect(decideCloudSync({ localHas: true, remoteHas: true, lastSeen: 10000, remoteModified: 15000 })).toBe('pull');
    expect(decideCloudSync({ localHas: true, remoteHas: true, lastSeen: 10000, remoteModified: 10001 })).toBe('pull');
  });

  it('does nothing when both snapshots are byte-equivalent', () => {
    expect(decideCloudSync({ localHas: true, remoteHas: true, pending: true, same: true })).toBe('none');
  });

  it('recognizes meaningful snapshot data', () => {
    expect(cloudSnapshotHasData({ order: [], txns: [], cards: [], assets: {} })).toBe(false);
    expect(cloudSnapshotHasData({ order: ['bank'] })).toBe(true);
    expect(cloudSnapshotHasData({ assets: { portfolio: [{ ticker: 'SPY' }] } })).toBe(true);
    expect(cloudSnapshotHasData({ goals: [{ id: 'trip' }] })).toBe(true);
    expect(cloudSnapshotHasData({ budgets: { comida: 50000 } })).toBe(true);
  });
});
