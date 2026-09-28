import { View } from 'react-native';
import { recurringHistory } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { AppText, EntryRow, SectionTitle, Surface } from './components';
import { historyNamesAccount } from './presentation';
import { space } from './theme';
import { useI18n } from '../i18n/provider';

/** How many recorded movements the detail lists before pointing to Movimientos. */
export const RECURRING_HISTORY_LIMIT = 12;

/** What a rule actually recorded (24UX2), newest first: real movements from the ledger, read by their
 * deterministic occurrence id, never the scheduled dates. Each row opens the movement itself; nothing here writes,
 * merges or infers a payment. Since 25B3 it lives on the rule's detail screen (`app/recurring/[id].tsx`), not in
 * its edit form. */
export function RecurringHistory({ ruleId, ruleAccountId }: { ruleId: string; ruleAccountId: string }) {
  const { snapshot } = useLedger();
  const { t } = useI18n();
  const accounts = snapshot?.accounts ?? [];
  const history = recurringHistory({ id: ruleId }, snapshot?.entries ?? []).filter(entry => accounts.some(item => item.id === entry.accountId));
  const shown = history.slice(0, RECURRING_HISTORY_LIMIT);
  const older = history.length - shown.length;
  // The detail above names the rule's current account; a row may leave its account out only when that says it truly.
  const showAccount = historyNamesAccount(shown, ruleAccountId);
  return <View>
    <SectionTitle caption={t('recurring.history.caption')}>{t('recurring.history.title')}</SectionTitle>
    {shown.length ? <Surface grouped>{shown.map((entry, index) => <EntryRow key={entry.id} entry={entry} showAccount={showAccount}
      account={accounts.find(item => item.id === entry.accountId)!} last={index === shown.length - 1} />)}</Surface>
      : <AppText secondary variant="subhead">{t('recurring.history.empty')}</AppText>}
    {!!older && <AppText secondary variant="footnote" style={{ marginTop: space.s }}>{t('recurring.history.older', { count: older })}</AppText>}
  </View>;
}
