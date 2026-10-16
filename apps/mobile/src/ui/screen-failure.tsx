import { SafeAreaView } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';
import { useI18n } from '../i18n/provider';
import { ActionButton, EmptyState, Screen } from './components';
import { usePalette } from './theme';

/** Producto 25Q3: what a screen shows when it fails to draw, instead of the app ending. The root stack hands it to every
 * route (`unstable_screenErrorBoundary`), so the header, the back gesture and the dock stay; «Volver a intentar» draws
 * only that screen again. It never shows the error (no raw text, no names or amounts from it) and never touches storage
 * (AGENTS rule 9). Drawing errors only: a handler, an effect or a promise is not caught here. */
export function ScreenFailure({ retry }: ErrorBoundaryProps) {
  const p = usePalette();
  const { t } = useI18n();
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.background }}>
    <Screen>
      <EmptyState icon="alert-circle-outline" title={t('nav.screenFailure.title')} detail={t('nav.screenFailure.detail')}
        action={<ActionButton label={t('boot.retry')} onPress={() => { void retry(); }} />} />
    </Screen>
  </SafeAreaView>;
}
