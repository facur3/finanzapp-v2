import { SectionList, View, useWindowDimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import { hiddenLiabilityAccountIds, isLiveAccount, liquidTotalsByCurrency, type Account, type Currency } from '@finanzapp/domain';
import { useI18n } from '../src/i18n/provider';
import { useLedger } from '../src/storage/LedgerProvider';
import { useAccountManagement } from '../src/ui/commitment-actions';
import { AccountRow, ActionButton, AppText, EmptyState, ErrorMessage, IconButton, Money } from '../src/ui/components';
import { SwipeRow, swipeAccessibility } from '../src/ui/swipe-actions';
import { labelAmountStacks } from '../src/ui/geometry';
import { availableCurrencies } from '../src/ui/presentation';
import { space, usePalette } from '../src/ui/theme';

/** What a section header spends around its text: the list's padding (20 + 20) and the header's own (4 + 4). */
const SECTION_CHROME = 48;

/** Liquid accounts only, grouped by currency with each currency's recorded total.
 * Cards and debts live in Tarjetas; ARS and USD are never added together. Since 25B2 a row's trailing swipe reveals
 * Eliminar (a short swipe shows it, a full one only opens the same confirmation; nothing is deleted by reaching a
 * threshold), the same action VoiceOver lists on the row; a deleted account leaves this list and keeps its history.
 *
 * 24UX6E: a section header is the currency's name as a heading (ink, subhead weight, like a Movimientos day) and its
 * recorded total, secondary (the expense tone and its minus only when negative). VoiceOver reads it as one header with
 * what the figure is («Pesos argentinos, saldo registrado 1423,00 pesos»), and the total goes under the name at large text
 * or when both would not fit on one line, so the money is never shrunk or cut. */
export default function AccountsScreen() {
  const { snapshot, archive } = useLedger();
  const p = usePalette();
  const { t, currencyName, moneyText, spokenMoney, speechLanguage } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const manage = useAccountManagement();
  if (!snapshot) return null;
  const hidden = hiddenLiabilityAccountIds(archive?.cards, archive?.debts);
  const visible = snapshot.accounts.filter(account => !hidden.has(account.id) && isLiveAccount(account));
  let totals: Partial<Record<Currency, number>> = {};
  try { totals = liquidTotalsByCurrency(snapshot, archive?.cards, archive?.debts); } catch { totals = {}; }
  const sections = availableCurrencies(visible).map(currency => ({ currency, data: visible.filter(account => account.currency === currency) }));
  return <>
    <Stack.Screen options={{ headerRight: () => <IconButton name="add" label={t('common.addAccount')} onPress={() => router.push('/new-account')} /> }} />
    <SectionList<Account, typeof sections[number]> sections={sections} keyExtractor={account => account.id}
      style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: space.xl, paddingBottom: 48, flexGrow: 1 }}
      contentInsetAdjustmentBehavior="automatic" stickySectionHeadersEnabled={false} removeClippedSubviews={false}
      ListHeaderComponent={manage.error ? <View style={{ paddingBottom: space.m }}><ErrorMessage message={manage.error} /></View> : null}
      ListEmptyComponent={<EmptyState title={t('accounts.list.emptyTitle')} detail={t('accounts.list.emptyDetail')}
        action={<ActionButton label={t('common.addAccount')} onPress={() => router.push('/new-account')} />} />}
      renderSectionHeader={({ section }) => {
        const name = currencyName(section.currency);
        const total = totals[section.currency];
        // The visible amount only measures the line; VoiceOver hears the spoken twin.
        const stacked = total !== undefined && labelAmountStacks(width, fontScale, name, moneyText(total, section.currency), SECTION_CHROME);
        return <View accessible accessibilityRole="header" accessibilityLanguage={speechLanguage}
          accessibilityLabel={total === undefined ? name : t('accounts.list.sectionLabel', { currency: name, amount: spokenMoney(total, section.currency) })}
          style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'baseline', justifyContent: 'space-between', gap: stacked ? 2 : 12,
            paddingTop: 20, paddingBottom: 8, paddingHorizontal: 4 }}>
          <AppText variant="subhead" style={{ fontWeight: '600', flexShrink: 1 }}>{name}</AppText>
          {total !== undefined && <Money minor={total} currency={section.currency} size={15} weight="600" color={total < 0 ? p.expense : p.secondary} />}
        </View>;
      }}
      renderItem={({ item, index, section }) => <View style={{ backgroundColor: p.surface, overflow: 'hidden',
        borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
        borderBottomLeftRadius: index === section.data.length - 1 ? 16 : 0, borderBottomRightRadius: index === section.data.length - 1 ? 16 : 0 }}>
        <SwipeRow actions={manage.actions(item)}>
          <AccountRow account={item} entries={snapshot.entries} transfers={snapshot.transfers} last={index === section.data.length - 1} accessibility={swipeAccessibility(manage.actions(item))} />
        </SwipeRow>
      </View>}
      />
  </>;
}
