import { router, Stack } from 'expo-router';
import { ActionButton, EmptyState, Screen } from '../src/ui/components';
import { useI18n } from '../src/i18n/provider';

/** Producto 25Q3: an unknown link opens this, in the app's language and palette, instead of Expo's English developer
 * screen. The framework's fallback, not a destination (decision 005). A cold start from such a link has no back stack,
 * so the action replaces it with Inicio. */
export default function NotFound() {
  const { t } = useI18n();
  return <Screen>
    <Stack.Screen options={{ title: t('nav.titles.notFound') }} />
    <EmptyState icon="compass-outline" title={t('nav.notFound.title')} detail={t('nav.notFound.detail')}
      action={<ActionButton label={t('nav.notFound.action')} onPress={() => router.replace('/')} />} />
  </Screen>;
}
