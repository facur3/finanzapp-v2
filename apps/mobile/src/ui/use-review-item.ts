import { useEffect, useState } from 'react';
import { useLedger } from '../storage/LedgerProvider';
import type { ReviewItem, ReviewTray } from '../storage/review-database';

/** Producto 25A-04 (Codex review of #85): one pending review item by id, for a screen that opens it. The tray is the
 * usual source; when the item is not in it (the tray could not be read again after a capture committed), the store is
 * read directly, a pending item found there is shown as it is stored, and the tray is asked to reload. Nothing is
 * copied or kept apart from the store: the item read is the store's own, read again after every review operation
 * (`reviewVersion`, which also counts an edit or a confirmation whose tray reload failed), every new tray and `reload`.
 *
 * - While a new read is in flight the last one stays drawn (a refusal's message is never lost to a blank redraw), but
 *   `refreshing` is true: a screen offers no action on it until the store has answered, so nothing is sent at an
 *   outdated revision.
 * - A tray row always wins, and the store's read is dropped when the tray has the item, so an older read never replaces
 *   a newer row later.
 * - `resolving` is true until the first answer is known, so a screen never says «not found» too early. */
export function useReviewItem(id: string | undefined): { item: ReviewItem | undefined; tray: ReviewTray | null; resolving: boolean; refreshing: boolean; reload: () => void } {
  const { review, reviewVersion, getReviewItem, refreshReview } = useLedger();
  const tray = review && review !== 'unavailable' ? review : null;
  const fromTray = id ? tray?.items.find(row => row.id === id) : undefined;
  const [stored, setStored] = useState<{ id: string; item: ReviewItem | null; stale: boolean } | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (fromTray) { setStored(current => current === null ? current : null); return; }
    if (!id || !tray) return;
    let live = true;
    setStored(current => current && current.id === id && !current.stale ? { ...current, stale: true } : current);
    getReviewItem(id).then(item => {
      if (!live) return;
      const pending = item?.status === 'pending' ? item : null;
      setStored({ id, item: pending, stale: false });
      if (pending) void refreshReview();
    }, () => { if (live) setStored({ id, item: null, stale: false }); });
    return () => { live = false; };
  }, [id, nonce, review, reviewVersion, !!fromTray]);
  const read = stored && stored.id === id ? stored : null;
  const looked = read ? read.item : undefined;
  return {
    item: fromTray ?? looked ?? undefined, tray,
    resolving: review === null || (!fromTray && !!tray && looked === undefined),
    refreshing: !fromTray && !!read?.stale,
    reload: () => setNonce(value => value + 1),
  };
}
