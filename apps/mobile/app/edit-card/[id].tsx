import { useLocalSearchParams } from 'expo-router';
import { useI18n } from '../../src/i18n/provider';
import { useLedger } from '../../src/storage/LedgerProvider';
import { CardForm } from '../../src/ui/card-form';
import { EmptyState, Screen } from '../../src/ui/components';

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const card = archive?.cards?.find(item => item.id === id);
  if (!card) return <Screen><EmptyState title={t('cards.panel.notFoundTitle')}
    detail={t('cards.panel.notFoundDetail')} icon="card-outline" /></Screen>;
  return <CardForm key={id} original={card} />;
}
