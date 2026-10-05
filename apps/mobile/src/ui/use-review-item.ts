import { useEffect, useState } from 'react';
import { useLedger } from '../storage/LedgerProvider';
import type { ReviewItem, ReviewTray } from '../storage/review-database';

/** Producto 25A-04 (Codex review of #85): one pending review item by id, for a screen that opens it. The tray is the
 * usual source; when the item is not in it (the tray could not be read again after a capture committed), the store is
 * read directly, a pending item found there is shown as it is stored, and the tray is asked to reload. Nothing is
 * copied or kept apart from the store: the item read is the store's own, read again after every change (`reload`, and
 * every new tray). `resolving` is true until the answer is known, so a screen never says «not found» too early. */
export function useReviewItem(id: string | undefined): { item: ReviewItem | undefined; tray: ReviewTray | null; resolving: boolean; reload: () => void } {
  const { review, getReviewItem, refreshReview } = useLedger();
  const tray = review && review !== 'unavailable' ? review : null;
  const fromTray = id ? tray?.items.find(row => row.id === id) : undefined;
  const [stored, setStored] = useState<{ key: string; item: ReviewItem | null } | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = `${id}|${nonce}`;
  useEffect(() => {
    if (!id || !tray || fromTray) return;
    let live = true;
    getReviewItem(id).then(item => {
      if (!live) return;
      const pending = item?.status === 'pending' ? item : null;
      setStored({ key, item: pending });
      if (pending) void refreshReview();
    }, () => { if (live) setStored({ key, item: null }); });
    return () => { live = false; };
  }, [key, review, !!fromTray]);
  const looked = stored?.key === key ? stored.item : undefined;
  return { item: fromTray ?? looked ?? undefined, tray, resolving: review === null || (!fromTray && !!tray && looked === undefined), reload: () => setNonce(value => value + 1) };
}
