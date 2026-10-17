import { View } from 'react-native';
import { router } from 'expo-router';
import { AppText, NavigationRow, Screen, Surface } from '../src/ui/components';
import { LICENSE_NOTICES, type LicenseNotice } from '../src/ui/licenses';
import { useI18n } from '../src/i18n/provider';

/** Ajustes › Licencias (Producto 25N1): the third-party software and data the app ships, each row opening its notice in
 * full (`license/[id]`), the way iOS lists its own legal notices. Names and licences are proper nouns, shown as
 * published; the reference exchange rates are not compiled in, so their source and terms are one line under the data. */
export default function LicensesScreen() {
  const { t } = useI18n();
  const group = (kind: LicenseNotice['group']) => {
    const notices = LICENSE_NOTICES.filter(notice => notice.group === kind);
    return <Surface grouped>
      {notices.map((notice, index) => <NavigationRow key={notice.id} title={notice.name} subtitle={notice.licence} last={index === notices.length - 1}
        onPress={() => router.push({ pathname: '/license/[id]', params: { id: notice.id } })} />)}
    </Surface>;
  };
  return <Screen gap={28}>
    <AppText secondary variant="subhead">{t('licenses.intro')}</AppText>
    <View style={{ gap: 8 }}>
      <GroupLabel>{t('licenses.software')}</GroupLabel>
      {group('software')}
    </View>
    <View style={{ gap: 8 }}>
      <GroupLabel>{t('licenses.data')}</GroupLabel>
      {group('data')}
      <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>{t('licenses.rates')}</AppText>
    </View>
  </Screen>;
}

/** A group's small caps label, as Ajustes draws it: a heading for VoiceOver, quiet to the eye. */
function GroupLabel({ children }: { children: string }) {
  return <AppText accessibilityRole="header" secondary variant="eyebrow" style={{ paddingHorizontal: 4 }}>{children}</AppText>;
}
