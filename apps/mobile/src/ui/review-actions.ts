import { useRef, useState, type MutableRefObject } from 'react';
import { Alert } from 'react-native';
import { useLedger } from '../storage/LedgerProvider';
import type { ReviewItem } from '../storage/review-database';
import { useI18n } from '../i18n/provider';
import type { MessageKey } from '../i18n/messages';
import { errorHaptic, successHaptic } from './motion';

/** The shape of a store call `run` takes (an async step). */
const idle = async () => {};

/** Producto 25A-04: Confirmar and Descartar of one pending review item, shared by every surface that offers them (the
 * «Para revisar» detail and the review sheet the Assistant presents), so there is one way to act on an item whatever
 * presents it. Both call the provider's one dispatcher for that transition (`confirmReview`: the store's frozen write,
 * reconciliation and receipt, 25A-02; `dismissReview`: pending → dismissed, never the ledger), at the revision on screen,
 * so an item that changed since is refused, never overwritten.
 *
 * - One store call at a time (`working`); a second tap while one is in flight does nothing.
 * - Done: the success haptic (Confirmar), then `leave()`; the surface's actions stay held while it goes (`leaving`), so a
 *   proposal that left the tray is never drawn as «not pending» on its way out.
 * - Refused: the message is shown with the Error haptic (25Q4), the item is read again (`reload`) and everything is
 *   offered again.
 * - Descartar asks first, with the system's destructive button. Closing a surface (a swipe, its close button, back) never
 *   comes here: it leaves the item pending. */
export function useReviewActions(item: ReviewItem, options: { leaving: MutableRefObject<boolean>; reload: () => void; leave: () => void }) {
  const { confirmReview, dismissReview } = useLedger();
  const { t, failureMessage } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const { leaving, reload, leave } = options;

  async function run(work: typeof idle, failed: MessageKey) {
    if (working.current) return;
    working.current = true;
    leaving.current = true;
    setBusy(true);
    setError(null);
    try { await work(); } catch (cause) {
      leaving.current = false;
      reload(); // A refused change re-reads the item, so the next tap acts on what is stored now.
      setError(failureMessage(cause, failed));
      errorHaptic();
    } finally {
      // Done: the surface is leaving and its actions stay held. Refused: everything is offered again.
      if (!leaving.current) { working.current = false; setBusy(false); }
    }
  }
  const confirm = () => run(async () => {
    await confirmReview(item.id, item.revision);
    successHaptic();
    leave();
  }, 'review.detail.confirmFailed');
  const dismiss = () => {
    if (working.current) return;
    Alert.alert(t('review.detail.dismissQuestion'), t('review.detail.dismissDetail'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('review.detail.dismiss'), style: 'destructive', onPress: () => void run(async () => {
        await dismissReview(item.id, item.revision);
        leave();
      }, 'review.detail.dismissFailed') },
    ], { cancelable: true });
  };
  return { busy, error, confirm, dismiss };
}
