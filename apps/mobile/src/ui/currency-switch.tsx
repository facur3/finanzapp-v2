import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { AppText, Choices, PressFeedback } from './components';
import { CurrencySheet, DisplaySheet } from './form-controls';
import { SEARCHABLE_FROM, currencyChoices, currencyOptionLabel, currencySwitchMode, displayTargets, type CurrencyChoice } from './currencies';
import type { CurrencyGate } from '@finanzapp/domain';
import type { DisplayMode } from './display-currency';
import { useI18n } from '../i18n/provider';
import { radius, usePalette } from './theme';

/** The currency a screen shows (Inicio, Reportes, Presupuestos) or a new record takes (a card,
 * a debt, a budget), chosen among the currencies that screen can actually use: the ones the
 * ledger holds, or the ones the gate offers. With one or two currencies it is the segmented
 * control of before, byte for byte ("Pesos · ARS" / "Dólares · USD", or the bare codes on
 * Inicio). With three or more, segments would shrink below a readable width, so it becomes one
 * compact row naming the chosen currency that opens the same sheet the new-account form uses
 * (a checkmark on the current one, search when the list is long). Choosing a currency only
 * changes which currency is shown; nothing is converted (docs/currency.md §10). */
export function CurrencySwitch({ value, currencies, onChange, disabled = false, labels = 'name', compact = false }: {
  value: Currency; currencies: readonly Currency[]; onChange: (currency: Currency) => void; disabled?: boolean;
  /** `name` writes "Pesos · ARS"; `code` writes the bare code, for a control that sits beside another (Inicio). */
  labels?: 'name' | 'code';
  /** Inicio's header (24UX3): the compact segments, or a 32 pt chip in ink with a hairline edge instead of cobalt. */
  compact?: boolean;
}) {
  const p = usePalette();
  const { t, locale, currencyName } = useI18n();
  const [visible, setVisible] = useState(false);
  const label = (currency: Currency) => labels === 'code' ? currency : currencyOptionLabel(currency, t, locale);
  const options = useMemo<CurrencyChoice[]>(() => currencyChoices(currencies, locale), [currencies, locale]);
  if (currencySwitchMode(currencies.length) === 'segments') {
    return <Choices value={value} onChange={onChange} disabled={disabled} compact={compact} options={currencies.map(currency => ({ value: currency, label: label(currency) }))} />;
  }
  return <>
    <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={t('currency.switchLabel', { name: currencyName(value) })}
      accessibilityHint={t('currency.switchHint')} accessibilityState={{ disabled }} disabled={disabled} onPress={() => setVisible(true)}
      hitSlop={compact ? 6 : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: compact ? 32 : 36, paddingVertical: compact ? 4 : 6, paddingHorizontal: 12,
        borderRadius: compact ? 16 : radius.button, backgroundColor: compact && p.isDark ? p.surface : p.inset, alignSelf: 'flex-start', maxWidth: '100%',
        ...(compact ? { borderWidth: StyleSheet.hairlineWidth, borderColor: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,12,0.10)' } : {}) }}>
      <AppText accessible={false} numberOfLines={1} variant={compact ? 'footnote' : 'subhead'} style={{ fontWeight: '600', color: compact ? p.text : p.primary, flexShrink: 1 }}>{label(value)}</AppText>
      <Ionicons name="chevron-down" size={compact ? 12 : 14} color={compact ? p.secondary : p.primary} accessible={false} />
    </PressFeedback>
    <CurrencySheet visible={visible} title={t('currency.switchTitle')} options={options} value={value} searchable={options.length >= SEARCHABLE_FROM}
      onClose={() => setVisible(false)} onChange={currency => { onChange(currency); setVisible(false); }} />
  </>;
}

/** Inicio's and Reportes' currency chip since 24C1: the same compact chip, now always present while an account
 * exists, naming the currency the screen shows ("EUR"), or "Solo EUR" when one currency is shown on its own. It
 * opens the display sheet (consolidated total, one currency only, the display currency); nothing about the display
 * lives on the screen itself. Choosing never converts or rewrites an account. */
export function DisplayCurrencyButton({ mode, currency, held, gate, onMode, onCurrency, compact = true }: {
  mode: DisplayMode; currency: Currency; held: readonly Currency[]; gate: CurrencyGate;
  onMode: (mode: DisplayMode) => void; onCurrency: (currency: Currency) => void; compact?: boolean;
}) {
  const p = usePalette();
  const { t, locale, currencyName } = useI18n();
  const [visible, setVisible] = useState(false);
  const consolidatedOptions = useMemo(() => visible ? currencyChoices(displayTargets(held, gate, locale), locale) : [], [visible, held, gate, locale]);
  const singleOptions = useMemo(() => visible ? currencyChoices(held, locale) : [], [visible, held, locale]);
  const label = mode === 'consolidated' ? currency : t('display.only', { code: currency });
  return <>
    <PressFeedback feedback="highlight" accessibilityRole="button" onPress={() => setVisible(true)} hitSlop={compact ? 6 : undefined}
      accessibilityLabel={t(mode === 'consolidated' ? 'display.chipConsolidated' : 'display.chipSingle', { name: currencyName(currency) })}
      accessibilityHint={t('display.chipHint')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: compact ? 32 : 36, paddingVertical: compact ? 4 : 6, paddingHorizontal: 12,
        borderRadius: compact ? 16 : radius.button, backgroundColor: compact && p.isDark ? p.surface : p.inset, alignSelf: 'flex-start', maxWidth: '100%',
        ...(compact ? { borderWidth: StyleSheet.hairlineWidth, borderColor: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,12,0.10)' } : {}) }}>
      <AppText accessible={false} numberOfLines={1} variant={compact ? 'footnote' : 'subhead'} style={{ fontWeight: '600', color: compact ? p.text : p.primary, flexShrink: 1 }}>{label}</AppText>
      <Ionicons name="chevron-down" size={compact ? 12 : 14} color={compact ? p.secondary : p.primary} accessible={false} />
    </PressFeedback>
    <DisplaySheet visible={visible} mode={mode} currency={currency} consolidatedOptions={consolidatedOptions} singleOptions={singleOptions}
      onClose={() => setVisible(false)} onMode={onMode} onCurrency={onCurrency} />
  </>;
}

export { SEARCHABLE_FROM };
