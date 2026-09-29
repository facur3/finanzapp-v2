import { View } from 'react-native';
import type { Currency, StatementPlacement } from '@finanzapp/domain';
import { useI18n } from '../i18n/provider';
import { AmountField, AppText, Choices, Field, Surface } from './components';
import { QUICK_COUNTS, type CountChoice, type PurchaseDraft, type PurchaseMode, type PurchaseState } from './purchase-plan';
import { SwitchRow } from './switch-row';
import { space, usePalette } from './theme';

/** Producto 24T2: the «Pago» section of a new purchase on an active credit card, under the date. «Una vez» is the
 * purchase as before; «En cuotas» shows, in reading order, the count (3, 6, 12, 18 or «Otra»), what each instalment
 * charges (from the exact schedule the plan will be saved with), the statement the first instalment goes to (the one the
 * purchase belongs to, or the next, named by their closing dates, with the closing and due of the chosen one), and
 * «Con interés» (off: no financing field at all; on: «Total financiado» and the interest it implies, read only).
 *
 * Every choice lives in the form (`draft`, changed through `onChange`), so hiding the section (another account,
 * Ingreso) and coming back finds it as it was; this component only draws it. Every amount and date VoiceOver reads is
 * written with the spoken formatters; the controls are the app's segmented control (44 pt targets), text field, amount
 * field and switch row. */
export function InstallmentPurchase({ draft, onChange, state, currency, todayISO, disabled }: {
  draft: PurchaseDraft; onChange: (patch: Partial<PurchaseDraft>) => void; state: PurchaseState; currency: Currency; todayISO: string; disabled: boolean;
}) {
  const p = usePalette();
  const { t, moneyText, spokenMoney, formatDate, errorText } = useI18n();
  // A statement of another year (a purchase recorded long after) carries its year; this year's reads as a short day.
  const shortDate = (dateISO: string) => formatDate(dateISO, dateISO.slice(0, 4) === todayISO.slice(0, 4) ? 'day' : 'dayYear');
  const { preview, count, first, options } = state;
  // Why the count cannot be saved yet: outside 2 to 120, or more instalments than the price has minor units.
  const countNote = state.countError ?? state.scheduleError;
  const each = preview && count !== null ? {
    text: t(preview.even ? 'entryForm.plan.perInstallment' : 'entryForm.plan.perInstallmentApprox', { count, amount: moneyText(preview.maxMinor, currency) }),
    spoken: t(preview.even ? 'entryForm.plan.perInstallment' : 'entryForm.plan.perInstallmentApproxSpoken', { count, amount: spokenMoney(preview.maxMinor, currency) }),
  } : null;
  const counts: { value: CountChoice; label: string }[] = QUICK_COUNTS.map(value => ({ value: `${value}` as CountChoice, label: `${value}` }))
    .concat([{ value: 'other', label: t('entryForm.plan.countOther') }]);
  return <View style={{ gap: space.l }}>
    <View style={{ gap: space.s }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t('entryForm.plan.payment')}</AppText>
      <Choices<PurchaseMode> value={draft.mode} onChange={mode => onChange({ mode })} disabled={disabled}
        options={[{ value: 'once', label: t('entryForm.plan.once') }, { value: 'installments', label: t('entryForm.plan.installments') }]} />
    </View>
    {draft.mode === 'installments' && <>
      <View style={{ gap: space.s }}>
        <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t('entryForm.plan.count')}</AppText>
        <Choices<CountChoice> compact value={draft.count} onChange={next => onChange({ count: next })} disabled={disabled} options={counts} />
        {draft.count === 'other' && <Field label={t('entryForm.plan.countField')} value={draft.typedCount} placeholder={t('entryForm.plan.countPlaceholder')}
          onChangeText={value => onChange({ typedCount: value.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" maxLength={3} editable={!disabled} />}
        {countNote && <AppText variant="footnote" style={{ color: p.warning }}>{t(countNote)}</AppText>}
      </View>
      {each && <AppText variant="headline" accessibilityLabel={each.spoken}>{each.text}</AppText>}
      {options && <View style={{ gap: space.s }}>
        <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t('entryForm.plan.first')}</AppText>
        {/* Each segment is named by its closing on screen; VoiceOver hears the whole statement, both dates written out. */}
        <Choices<StatementPlacement> compact value={draft.placement} onChange={placement => onChange({ placement })} disabled={disabled}
          options={(['current', 'next'] as const).map(value => ({ value, label: shortDate(options[value].closingISO),
            spokenLabel: t('entryForm.plan.statement', { closing: formatDate(options[value].closingISO, 'long'), due: formatDate(options[value].dueISO, 'long') }) }))} />
        {first && <AppText secondary variant="footnote"
          accessibilityLabel={t('entryForm.plan.statement', { closing: formatDate(first.closingISO, 'long'), due: formatDate(first.dueISO, 'long') })}>
          {t('entryForm.plan.statement', { closing: shortDate(first.closingISO), due: shortDate(first.dueISO) })}
        </AppText>}
        {state.closedCount > 0 && <AppText secondary variant="footnote">{t('entryForm.plan.closed', { count: state.closedCount })}</AppText>}
      </View>}
      <Surface grouped>
        <SwitchRow label={t('entryForm.plan.withInterest')} value={draft.financed} onValueChange={financed => onChange({ financed })} disabled={disabled} last />
      </Surface>
      {draft.financed && <View>
        <AmountField label={t('entryForm.plan.totalFinanced')} currency={currency} value={draft.totalFinanced}
          onChangeText={value => onChange({ totalFinanced: value })} editable={!disabled} />
        {state.totalError ? <AppText variant="footnote" style={{ color: p.warning }}>{errorText(state.totalError)}</AppText>
          : state.interestMinor !== null && state.totalMinor !== null ? <AppText secondary variant="footnote"
            accessibilityLabel={t('entryForm.plan.interestTotal', { amount: spokenMoney(state.interestMinor, currency) })}>
            {t('entryForm.plan.interestTotal', { amount: moneyText(state.interestMinor, currency) })}
          </AppText> : null}
      </View>}
    </>}
  </View>;
}
