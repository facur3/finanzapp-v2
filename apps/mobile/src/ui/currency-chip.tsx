import { useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { AppText, PressFeedback } from './components';
import { SEARCHABLE_FROM, currencyChoices, offeredCurrencies } from './currencies';
import { CurrencySheet } from './form-controls';
import { InlineFlag } from './marks';
import { radius, usePalette } from './theme';
import { currencyFlag } from '../i18n/flags';
import { useI18n } from '../i18n/provider';

/** 25O1: a currency as a compact control beside the amount it sets (the first opening's opening balance): its issuer's
 * flag, the code and a chevron on an inset capsule, opening the same searchable sheet as every form's currency row. The
 * flag marks the currency, beside its code; it never says where an account is (flags.ts). VoiceOver hears «Moneda: Pesos
 * argentinos», a button; the flag is hidden. 36 pt drawn, 44 pt to the finger. Its row places it (25O1 review: centred beside
 * the amount, or at the start of a column at large text). */
export function CurrencyChip({ value, onChange, currencies, disabled = false }: {
  value: Currency; onChange: (currency: Currency) => void;
  /** The codes the person may choose: the build's creation gate. */
  currencies: readonly Currency[]; disabled?: boolean;
}) {
  const p = usePalette();
  const { t, locale, currencyName } = useI18n();
  const [visible, setVisible] = useState(false);
  const options = useMemo(() => currencyChoices(offeredCurrencies(currencies, locale), locale), [currencies, locale]);
  return <>
    <PressFeedback accessibilityRole="button" accessibilityLabel={t('selection.currency') + ': ' + currencyName(value)}
      accessibilityState={{ disabled }} disabled={disabled} hitSlop={{ top: 4, bottom: 4 }} onPress={() => { Keyboard.dismiss(); setVisible(true); }}
      style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: radius.chip + 4,
        backgroundColor: p.inset, opacity: disabled ? 0.5 : 1 }}>
      <InlineFlag flag={currencyFlag(value)} size={17} />
      <AppText variant="subhead" style={{ fontWeight: '600' }}>{value}</AppText>
      <Ionicons name="chevron-down" size={14} color={p.secondary} accessible={false} />
    </PressFeedback>
    <CurrencySheet visible={visible} title={t('selection.chooseCurrency')} options={options} value={value} searchable={options.length >= SEARCHABLE_FROM}
      onClose={() => setVisible(false)} onChange={currency => { onChange(currency); setVisible(false); }} />
  </>;
}
