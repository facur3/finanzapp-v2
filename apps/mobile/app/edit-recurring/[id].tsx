import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, Screen } from '../../src/ui/components';
import { RecurringForm } from '../../src/ui/recurring-form';
import { useI18n } from '../../src/i18n/provider';

export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const rule = archive?.recurring?.find(item => item.id === id);
  // A deleted rule (24UX4) opens as not found; one deleted from this very screen keeps its form while the screen closes.
  const [openedLive] = useState(() => !!rule && !rule.deleted);
  if (!rule || (rule.deleted && !openedLive)) return <Screen><EmptyState title={t('recurring.edit.notFoundTitle')}
    detail={t('recurring.edit.notFoundDetail')} icon="repeat-outline" /></Screen>;
  return <RecurringForm original={rule} />;
}
