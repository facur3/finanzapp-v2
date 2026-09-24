import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { cardCreditMinor, cardStatementActivity, liabilityActivity } from '@finanzapp/domain';
import { useI18n } from '../../src/i18n/provider';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, Money, Screen, SectionTitle, Stat, Surface, StatRow } from '../../src/ui/components';
import { CardFace } from '../../src/ui/card-visual';
import { EntryList } from '../../src/ui/entry-list';
import { statementCaption, summarizeCard, usageTone } from '../../src/ui/liability-presentation';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const { t, relativeDate, moneyText } = useI18n();
  const { width } = useWindowDimensions();
  const card = archive?.cards?.find(item => item.id === id);
  const summary = useMemo(() => card && snapshot ? summarizeCard(card, snapshot, day) : null, [card, snapshot, day]);
  const statement = useMemo(() => card && snapshot ? cardStatementActivity(card, snapshot, day) : null, [card, snapshot, day]);
  const activity = useMemo(() => summary && snapshot ? liabilityActivity(summary.account.id, snapshot) : { entries: [], transfers: [] }, [summary, snapshot]);

  if (!snapshot || !archive || !card || !summary || !statement) return <Screen>
    <EmptyState title={t('cards.panel.notFoundTitle')} detail={t('cards.panel.notFoundDetail')} icon="card-outline" />
  </Screen>;
  const { account, debtMinor, availableMinor, usage, closingISO, dueISO } = summary;
  const credit = cardCreditMinor(card, snapshot);
  const relative = (iso: string) => relativeDate(iso, day);
  const money = (minor: number) => moneyText(minor, account.currency);
  const tone = usageTone(usage);

  return <>
    <Stack.Screen options={{ title: account.name,
      headerRight: () => <IconButton name="create-outline" label={t('cards.panel.editCard')}
        onPress={() => router.push({ pathname: '/edit-card/[id]', params: { id: card.id } })} /> }} />
    <EntryList entries={activity.entries} transfers={activity.transfers} accountId={account.id} accounts={snapshot.accounts} context="card"
      header={<View style={{ gap: space.xl, paddingBottom: 4 }}>
        <CardFace id={card.id} name={account.name} issuer={card.issuer} last4={card.last4} currency={account.currency} width={Math.min(width - space.xl * 2, 420)} />
        {/* Identity (the card) → state (the debt) → three facts → primary → secondary → activity. Issuer and currency already live on the card face. */}
        <View style={{ gap: 6 }}>
          <AppText secondary variant="subhead" style={{ fontWeight: '500' }}>{t(card.active ? 'cards.panel.recordedDebt' : 'cards.panel.archivedDebt')}</AppText>
          <Money minor={debtMinor} currency={account.currency} large />
          {credit > 0 && <AppText variant="subhead" style={{ color: p.income, fontWeight: '600' }}>{t('cards.panel.credit', { amount: money(credit) })}</AppText>}
        </View>

        <Surface style={{ gap: 14 }}>
          <StatRow>
            <Stat label={t('cards.panel.available')}>
              {availableMinor !== null ? <Money minor={availableMinor} currency={account.currency} size={17} color={tone === 'neutral' ? undefined : tone === 'warning' ? p.warning : p.expense} />
                : <AppText secondary variant="subhead">{t('cards.panel.noLimit')}</AppText>}
              {card.creditLimitMinor !== null && <AppText tertiary variant="caption">{t('cards.panel.ofLimit', { amount: money(card.creditLimitMinor) })}</AppText>}
            </Stat>
            <Stat label={t('cards.panel.closing')}><AppText style={{ fontWeight: '600' }}>{relative(closingISO)}</AppText></Stat>
            <Stat label={t('cards.panel.due')}>
              <AppText style={{ fontWeight: '600', color: tone !== 'neutral' && debtMinor > 0 ? p.warning : p.text }}>{relative(dueISO)}</AppText>
            </Stat>
          </StatRow>
        </Surface>

        <View style={{ gap: 10 }}>
          <ActionButton label={t('cards.panel.recordPurchase')} icon="cart-outline" disabled={!card.active}
            onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />
          <ActionButton label={t('cards.panel.pay')} icon="arrow-forward-outline" secondary tone="transfer" disabled={debtMinor === 0}
            onPress={() => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, maxAmountMinor: String(debtMinor) } })} />
        </View>

        <SectionTitle caption={statementCaption(statement, relative, t) + (statement.refundsMinor > 0 ? t('cards.panel.refunds', { amount: money(statement.refundsMinor) }) : '')}>{t('cards.panel.movements')}</SectionTitle>
      </View>}
      empty={<AppText secondary variant="subhead">{t('cards.panel.noActivity')}</AppText>} />
  </>;
}
