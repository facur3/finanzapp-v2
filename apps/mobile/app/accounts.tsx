import { SectionList, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { hiddenLiabilityAccountIds, liquidTotalsByCurrency, type Account, type Currency } from '@finanzapp/domain';
import { useI18n } from '../src/i18n/provider';
import { useLedger } from '../src/storage/LedgerProvider';
import { AccountRow, ActionButton, AppText, EmptyState, IconButton, Money } from '../src/ui/components';
import { availableCurrencies } from '../src/ui/presentation';
import { space, usePalette } from '../src/ui/theme';

/** Liquid accounts only, grouped by currency with each currency's recorded total.
 * Cards and debts live in Tarjetas; ARS and USD are never added together. */
export default function AccountsScreen() {
  const { snapshot, archive } = useLedger();
  const p = usePalette();
  const { t, currencyName } = useI18n();
  if (!snapshot) return null;
  const hidden = hiddenLiabilityAccountIds(archive?.cards, archive?.debts);
  const visible = snapshot.accounts.filter(account => !hidden.has(account.id));
  let totals: Partial<Record<Currency, number>> = {};
  try { totals = liquidTotalsByCurrency(snapshot, archive?.cards, archive?.debts); } catch { totals = {}; }
  const sections = availableCurrencies(visible).map(currency => ({ currency, data: visible.filter(account => account.currency === currency) }));
  return <>
    <Stack.Screen options={{ headerRight: () => <IconButton name="add" label={t('common.addAccount')} onPress={() => router.push('/new-account')} /> }} />
    <SectionList<Account, typeof sections[number]> sections={sections} keyExtractor={account => account.id}
      style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: space.xl, paddingBottom: 48, flexGrow: 1 }}
      contentInsetAdjustmentBehavior="automatic" stickySectionHeadersEnabled={false} removeClippedSubviews={false}
      ListEmptyComponent={<EmptyState title={t('accounts.list.emptyTitle')} detail={t('accounts.list.emptyDetail')}
        action={<ActionButton label={t('common.addAccount')} onPress={() => router.push('/new-account')} />} />}
      renderSectionHeader={({ section }) => <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingTop: 20, paddingBottom: 8, paddingHorizontal: 4 }}>
        <AppText secondary accessibilityRole="header" variant="footnote" style={{ fontWeight: '600' }}>
          {currencyName(section.currency)}
        </AppText>
        {totals[section.currency] !== undefined && <Money minor={totals[section.currency]!} currency={section.currency} size={15} weight="600"
          color={totals[section.currency]! < 0 ? p.expense : p.secondary} />}
      </View>}
      renderItem={({ item, index, section }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
        borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
        borderBottomLeftRadius: index === section.data.length - 1 ? 16 : 0, borderBottomRightRadius: index === section.data.length - 1 ? 16 : 0 }}>
        <AccountRow account={item} entries={snapshot.entries} transfers={snapshot.transfers} last={index === section.data.length - 1} />
      </View>}
      />
  </>;
}
