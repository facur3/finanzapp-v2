export function cloudSnapshotHasData(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  return (Array.isArray(snapshot.order) && snapshot.order.length > 0)
    || Object.keys(snapshot.accounts || {}).length > 0
    || (Array.isArray(snapshot.txns) && snapshot.txns.length > 0)
    || (Array.isArray(snapshot.cards) && snapshot.cards.length > 0)
    || (Array.isArray(snapshot.loans) && snapshot.loans.length > 0)
    || (Array.isArray(snapshot.recurring) && snapshot.recurring.length > 0)
    || (Array.isArray(snapshot.goals) && snapshot.goals.length > 0)
    || (Array.isArray(snapshot.tagSugg) && snapshot.tagSugg.length > 0)
    || Object.values(snapshot.budgets || {}).some(value => Number(value) > 0)
    || Object.values(snapshot.assets || {}).some(rows => Array.isArray(rows) && rows.length > 0);
}

// The cloud stores one lossless snapshot per user. This decision table keeps the
// local app usable offline while refusing to silently overwrite two independently
// edited snapshots. On first contact, two non-empty different snapshots always
// require an explicit choice: a device clock is not trustworthy enough to decide
// which financial history should win. Later syncs use the server time observed
// by this device. Timestamps come from the database server, so even a change a
// few milliseconds later is meaningful and must not be hidden by a tolerance.
export function decideCloudSync({
  localHas = false,
  remoteHas = false,
  pending = false,
  same = false,
  localModified = 0,
  remoteModified = 0,
  lastSeen = 0,
} = {}) {
  if (same) return 'none';
  if (!remoteHas) return localHas ? 'push' : 'none';
  if (!localHas && !pending) return 'pull';
  if (!lastSeen && localHas) return 'conflict';
  // `pending` can represent an intentional "erase everything" made offline.
  // Handle it before the empty-local shortcut or the old cloud copy would be
  // downloaded again and silently undo the deletion.
  if (pending) {
    if (!lastSeen) return 'conflict';
    if (lastSeen > 0 && remoteModified > lastSeen) return 'conflict';
    return 'push';
  }
  if (!localHas) return 'pull';
  if (lastSeen > 0) return remoteModified > lastSeen ? 'pull' : 'none';
  return 'conflict';
}
