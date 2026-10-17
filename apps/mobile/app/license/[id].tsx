import { Stack, useLocalSearchParams } from 'expo-router';
import { AppText, EmptyState, Screen } from '../../src/ui/components';
import { licenseNotice } from '../../src/ui/licenses';
import { useI18n } from '../../src/i18n/provider';

/** One third-party notice in full (Producto 25N1), titled by its name. The text is the licence as published, in English
 * in every interface language, so VoiceOver reads it in English (`accessibilityLanguage`) and it can be selected and
 * copied. Only «Incluye: …», the packages it covers, is the app's own sentence. */
export default function LicenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const notice = licenseNotice(id);
  if (!notice) return <Screen><EmptyState title={t('licenses.notFoundTitle')} detail={t('licenses.notFoundDetail')} icon="document-text-outline" /></Screen>;
  return <Screen gap={14}>
    <Stack.Screen options={{ title: notice.name }} />
    {notice.packages.length > 0 && <AppText secondary variant="footnote">{t('licenses.covers', { packages: notice.packages.join(', ') })}</AppText>}
    {notice.paragraphs.map((paragraph, index) => <AppText key={index} variant="footnote" selectable accessibilityLanguage="en">{paragraph}</AppText>)}
  </Screen>;
}
