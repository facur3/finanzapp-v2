import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { todayKey, type Account, type AccountKind, type Currency, type Entry, type EntryKind } from '@finanzapp/domain';
import { AccountBadge, AppText, CategoryBadge, DetailRow, Field, GlyphTile, PressFeedback, SelectionRow, Surface, surfaceShadow, type IconName, type Tone } from './components';
import { SEARCHABLE_FROM, currencyChoices, currencyOption, offeredCurrencies, searchChoices, type CurrencyChoice } from './currencies';
import { useI18n } from '../i18n/provider';
import { useAccountLookOf, useCategoryDefinitions, useCategoryLook } from './category-hues';
import { selectionHaptic, sheetTiming } from './motion';
import { radius, space, usePalette, useReduceMotion } from './theme';
import { categoryChoices, categoryKey, customCategory } from './categories';

/** Full-width selector used for the two choices a user must never overlook in
 * a form: which category and which account or card. A 44 pt tile, the label,
 * the current value and a live detail line (balance, budget) sit on one card.
 * The value and the detail may each take two lines: a long account name or
 * a budget sentence with its amount is shown whole, never cut to fit. A
 * detail that carries an amount comes with `spokenDetail`, the same sentence
 * built with the spoken formatters, which VoiceOver reads instead. */
export function SelectorCard({ label, value, placeholder, detail, spokenDetail, icon, tone = 'neutral', color, disabled = false, onPress, detailTone }: {
  label: string; value?: string; placeholder: string; detail?: string; spokenDetail?: string; icon: IconName; tone?: Tone; color?: string; disabled?: boolean; onPress: () => void;
  detailTone?: 'neutral' | 'warning' | 'expense';
}) {
  const p = usePalette();
  const detailColor = detailTone === 'expense' ? p.expense : detailTone === 'warning' ? p.warning : p.secondary;
  const spoken = spokenDetail ?? detail;
  return <PressFeedback accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? placeholder}${spoken ? ', ' + spoken : ''}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.group, backgroundColor: p.surface, minHeight: 72, opacity: disabled ? 0.6 : 1 }, surfaceShadow(p)]}>
    <GlyphTile icon={icon} tone={tone} color={color} size={44} />
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{label}</AppText>
      <AppText numberOfLines={2} style={{ fontWeight: '600', color: value ? p.text : p.primary }}>{value ?? placeholder}</AppText>
      {!!detail && <AppText numberOfLines={2} variant="footnote" style={{ color: detailColor }}>{detail}</AppText>}
    </View>
    <Ionicons name="chevron-forward" size={18} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

// Native presentation only. No navigation redirects, captured backgrounds or
// custom screen-level enter/exit animation layered over UIKit.
function SelectionSheet({ visible, title, onClose, onDone, children }: {
  visible: boolean; title: string; onClose: () => void; onDone?: () => void; children: ReactNode;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t } = useI18n();
  return <Modal visible={visible} animationType={reduced ? 'fade' : 'slide'} presentationStyle="pageSheet"
    allowSwipeDismissal onRequestClose={onClose}>
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
        <PressFeedback feedback="opacity" accessibilityRole="button" onPress={onClose}><AppText style={{ color: p.primary, fontSize: 16 }}>{t('common.cancel')}</AppText></PressFeedback>
        <AppText accessibilityRole="header" numberOfLines={2} style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}>{title}</AppText>
        {onDone && <PressFeedback feedback="opacity" accessibilityRole="button" onPress={onDone}><AppText style={{ color: p.primary, fontSize: 16, fontWeight: '600' }}>{t('common.done')}</AppText></PressFeedback>}
      </View>
      {children}
    </SafeAreaView>
  </Modal>;
}

export function AccountField({ accounts, value, onChange, disabled = false, label, kindOf, typeOf, prominent = false, detail, spokenDetail, detailTone, describe, spokenDescribe }: {
  accounts: Account[]; value: string; onChange: (id: string) => void; disabled?: boolean; label?: string;
  /** Names the kind of each option (Cuenta, Tarjeta, Deuda) so a card is never mistaken for cash. */
  kindOf?: (accountId: string) => string;
  /** What each option is, for its glyph: a cash account shows its own look, a card or a debt its kind. Decided by the ledger, never by the translated name. */
  typeOf?: (accountId: string) => AccountKind;
  /** Render as a full-width selector card with a live detail line instead of a compact row. `spokenDetail` is that line for VoiceOver (see SelectorCard). */
  prominent?: boolean; detail?: string; spokenDetail?: string; detailTone?: 'neutral' | 'warning' | 'expense';
  /** Optional per-option second line in the sheet (for example the recorded balance). */
  describe?: (account: Account) => string;
  /** That line for VoiceOver, built with the spoken formatters; the option's label reads it after the kind and currency.
   * Without it the label stays name, kind and currency: a line in the region's separators is shown, never spoken. */
  spokenDescribe?: (account: Account) => string;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const lookOf = useAccountLookOf();
  const [visible, setVisible] = useState(false);
  const selected = accounts.find(account => account.id === value);
  const title = label ?? t('selection.account');
  const kind = (id: string) => kindOf?.(id) ?? t('selection.account');
  const type = (id: string): AccountKind => typeOf?.(id) ?? 'cash';
  const isCash = (id: string) => type(id) === 'cash';
  // A cash account shows its own look; a card or a debt keeps its kind glyph in the brand primary.
  const icon = (id: string) => isCash(id) ? lookOf(id).glyph : type(id) === 'card' ? 'card-outline' : 'people-outline';
  const color = (id: string) => isCash(id) ? lookOf(id).hex : p.primary;
  const open = () => { Keyboard.dismiss(); setVisible(true); };
  return <>
    {prominent ? <SelectorCard label={title} value={selected ? selected.name : undefined} placeholder={t('selection.chooseAccount')}
      detail={detail ?? (selected ? kind(selected.id) + ' · ' + selected.currency : undefined)} spokenDetail={spokenDetail} detailTone={detailTone}
      icon={selected ? icon(selected.id) : 'wallet-outline'} color={selected ? color(selected.id) : undefined} disabled={disabled} onPress={open} />
      : <SelectionRow label={title} value={selected ? selected.name : t('selection.chooseAccount')} placeholder={!selected}
        detail={selected ? kind(selected.id) + ' · ' + selected.currency : undefined} icon={selected ? icon(selected.id) : 'wallet-outline'}
        leading={selected && isCash(selected.id) ? <AccountBadge accountId={selected.id} size={30} /> : undefined}
        disabled={disabled} onPress={open} last />}
    <SelectionSheet visible={visible} title={label === undefined ? t('selection.chooseAccount') : label} onClose={() => setVisible(false)}>
      <FlatList data={accounts} keyExtractor={account => account.id} contentContainerStyle={{ padding: 20, paddingTop: 0 }}
        renderItem={({ item }) => <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityState={{ selected: value === item.id }}
          accessibilityLabel={item.name + ', ' + kind(item.id) + ', ' + item.currency + (spokenDescribe ? ', ' + spokenDescribe(item) : '')}
          onPress={() => { if (item.id !== value) selectionHaptic(); onChange(item.id); setVisible(false); }}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, backgroundColor: p.surface, borderRadius: 16, marginBottom: 8, overflow: 'hidden' }}>
          {isCash(item.id) ? <AccountBadge accountId={item.id} /> : <GlyphTile icon={icon(item.id)} />}
          <View style={{ flex: 1, gap: 3 }}><AppText style={{ fontWeight: '600' }}>{item.name}</AppText>
            <AppText secondary style={{ fontSize: 14 }}>{kind(item.id)} · {item.currency}{describe ? ' · ' + describe(item) : ''}</AppText></View>
          {item.id === value && <Ionicons name="checkmark-circle" color={p.primary} size={24} accessible={false} />}
        </PressFeedback>} />
    </SelectionSheet>
  </>;
}

/** The account's currency as one native row: the label "Moneda", the
 * currency's full name as the primary line, its code and symbol as the
 * detail line, a glyph and a chevron, stacked so "Dólares estadounidenses"
 * and "USD" each keep a whole line at any width or text size. The sheet is
 * the currency screen of docs/currency.md §7.5 stage 8 (24B5): it lists the
 * currencies the ledger can hold (`currencies`: the build's gate, ARS and USD
 * in a release) with the catalogue's names, codes and symbols, a checkmark on
 * the current one and, from six currencies on, a search field over code,
 * name, symbol, numeric code and territory. Only for a new account; an
 * existing account never changes currency (`onChange` absent: the same row,
 * read-only, without a chevron, showing any stored code by its own name). */
export function CurrencyField({ value, onChange, disabled = false, currencies }: {
  value: Currency; onChange?: (currency: Currency) => void; disabled?: boolean;
  /** The codes the person may choose: the build's creation gate. Never wider than what storage can hold. */
  currencies?: readonly Currency[];
}) {
  const { t, locale } = useI18n();
  const [visible, setVisible] = useState(false);
  const selected = currencyOption(value, locale);
  const options = useMemo(() => currencyChoices(currencies ?? offeredCurrencies(), locale), [currencies, locale]);
  const open = () => { Keyboard.dismiss(); setVisible(true); };
  return <>
    <Surface grouped>
      <SelectionRow label={t('selection.currency')} value={selected.name} detail={selected.code + ' · ' + selected.symbol}
        icon="cash-outline" last disabled={disabled} onPress={onChange ? open : undefined} />
    </Surface>
    {onChange && <CurrencySheet visible={visible} title={t('selection.chooseCurrency')} options={options} value={value} searchable={options.length >= SEARCHABLE_FROM}
      note={t('selection.currencyNote')} onClose={() => setVisible(false)} onChange={currency => { onChange(currency); setVisible(false); }} />}
  </>;
}

/** The sheet that lists currencies for a choice: one row per option (the full name, then the
 * code and symbol), a checkmark on the current one, a selection tick when the choice changes.
 * The new-account form lists the currencies the ledger can hold, with a note under them; the
 * currency switch of Inicio, Reportes and Presupuestos lists the currencies held (24B3). With
 * `searchable` a field at the top filters by code or name, accent- and case-insensitive, so a
 * long list never has to be scrolled through; the options are never reordered by it. */
export function CurrencySheet({ visible, title, options, value, note, searchable = false, onClose, onChange }: {
  visible: boolean; title: string; options: readonly CurrencyChoice[]; value: Currency; note?: string; searchable?: boolean;
  onClose: () => void; onChange: (currency: Currency) => void;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const shown = searchable ? searchChoices(query, options) : options;
  return <SelectionSheet visible={visible} title={title} onClose={() => { setQuery(''); onClose(); }}>
    <FlatList data={shown} keyExtractor={option => option.code} contentContainerStyle={{ padding: 20, paddingTop: 0 }} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={searchable ? <View style={{ paddingBottom: 16 }}>
        <Field label={t('currency.search')} value={query} onChangeText={setQuery} autoCapitalize="characters" autoCorrect={false} clearButtonMode="while-editing" maxLength={40} />
      </View> : null}
      ListEmptyComponent={searchable ? <AppText secondary variant="subhead" style={{ paddingHorizontal: 4 }}>{t('currency.noMatches')}</AppText> : null}
      ListFooterComponent={note ? <AppText secondary variant="footnote" style={{ paddingHorizontal: 4, paddingTop: 4 }}>{note}</AppText> : null}
      renderItem={({ item }) => <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityState={{ selected: value === item.code }}
        accessibilityLabel={item.name + ', ' + item.code}
        onPress={() => { if (item.code !== value) selectionHaptic(); setQuery(''); onChange(item.code); }}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, backgroundColor: p.surface, borderRadius: 16, marginBottom: 8, overflow: 'hidden' }}>
        <GlyphTile icon="cash-outline" />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}><AppText style={{ fontWeight: '600' }}>{item.name}</AppText>
          <AppText secondary variant="subhead">{item.code} · {item.symbol}</AppText></View>
        {item.code === value && <Ionicons name="checkmark-circle" color={p.primary} size={24} accessible={false} />}
      </PressFeedback>} />
  </SelectionSheet>;
}

/** A compact sheet anchored to the bottom of the screen, sized to its content, for a
 * control that needs no list: the date wheel. A page sheet (`SelectionSheet`) is the
 * right shape for a list that scrolls, but on an iPhone it gives a 216 pt wheel a
 * near-empty screen; this card is the height of its header and its wheel, over a
 * scrim that keeps the form visible, with the home-indicator inset below (24B6).
 * Presentation is a transparent native modal (VoiceOver stays inside the card); the
 * motion is the sheet's own: the scrim fades while the card rises from the bottom
 * edge on the iOS sheet curve (300 ms), both interruptible; Reduce Motion fades the
 * card in place over the same time. The order matters (24UX1): the modal mounts
 * first, with the card resting below the window and the scrim clear; the rise starts
 * only once iOS has presented the modal (`onShow`) and laid the card out (`onLayout`),
 * in either order. 24B6 started the timing in the same effect that mounted the modal,
 * so by the first painted frame, one to four frames later, the ease-out curve had
 * already covered most of the travel and the card seemed to appear in place. The card
 * stays mounted while it leaves (200 ms), so nothing snaps away, and unmounts once the
 * exit ends; an exit interrupted by a reopening never unmounts. Cancel, the scrim and
 * the system back gesture leave without saving; only Listo commits. Nothing here
 * captures a screen or replays a navigation. */
function BottomSheet({ visible, title, onClose, onDone, children }: {
  visible: boolean; title: string; onClose: () => void; onDone: () => void; children: ReactNode;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [shown, setShown] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  // The card's measured height, so the rise starts exactly below the edge whatever the text size; until it is
  // measured, a window height: below the edge for any card, so nothing of it shows before the rise.
  const height = useSharedValue(windowHeight);
  // What the rise waits for. `wanted` follows `visible`; the other two are set by iOS's events for the mounted
  // modal and cleared whenever it is (re)mounted or unmounted, so an event of a dismissed modal raises nothing.
  const ready = useRef({ wanted: visible, presented: false, measured: false });
  const rise = () => {
    const state = ready.current;
    if (state.wanted && state.presented && state.measured) progress.value = withTiming(1, sheetTiming('sheet', reduced));
  };
  const unmount = () => { ready.current.presented = false; ready.current.measured = false; setShown(false); };
  useEffect(() => {
    ready.current.wanted = visible;
    if (visible) {
      // Already mounted (reopened while leaving): rise from wherever the card is, which interrupts the exit and so
      // keeps the modal. Not mounted: mount it and let its presentation and layout start the rise.
      if (shown) rise();
      else { ready.current.presented = false; ready.current.measured = false; setShown(true); }
    } else if (shown) {
      progress.value = withTiming(0, sheetTiming('sheetExit', reduced), finished => { if (finished) runOnJS(unmount)(); });
    }
    // `shown` is read, not depended on: the exit runs once, when `visible` drops, not again when it unmounts the modal.
  }, [visible, reduced, progress]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: reduced ? progress.value : 1,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * height.value }],
  }));
  return <Modal visible={shown} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}
    onShow={() => { ready.current.presented = true; rise(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }, scrimStyle]}>
        {/* The scrim cancels; VoiceOver never lands on it (the card below is modal). */}
        <Pressable accessible={false} importantForAccessibility="no" style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View accessibilityViewIsModal onLayout={event => { height.value = event.nativeEvent.layout.height; ready.current.measured = true; rise(); }}
        style={[{ backgroundColor: p.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, overflow: 'hidden',
          paddingBottom: Math.max(insets.bottom, space.m) }, cardStyle]}>
        <View accessible={false} style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: p.line }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.l, paddingVertical: space.m, minHeight: 52 }}>
          <PressFeedback feedback="opacity" accessibilityRole="button" onPress={onClose} hitSlop={8}><AppText style={{ color: p.primary, fontSize: 16 }}>{t('common.cancel')}</AppText></PressFeedback>
          <AppText accessibilityRole="header" numberOfLines={2} style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}>{title}</AppText>
          <PressFeedback feedback="opacity" accessibilityRole="button" onPress={onDone} hitSlop={8}><AppText style={{ color: p.primary, fontSize: 16, fontWeight: '600' }}>{t('common.done')}</AppText></PressFeedback>
        </View>
        {/* The wheel sits centred in the card: as wide as the card's content, its columns centred by UIKit. */}
        <View style={{ alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: space.l, paddingBottom: space.s }}>{children}</View>
      </Animated.View>
    </View>
  </Modal>;
}

export function DateField({ value, onChange, disabled = false, allowFuture = false, label }: {
  value: Date; onChange: (date: Date) => void; disabled?: boolean; allowFuture?: boolean; label?: string;
}) {
  const p = usePalette();
  const { t, formatDate, pickerLocale } = useI18n();
  const title = label ?? t('selection.date');
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value);
  const open = () => { Keyboard.dismiss(); setDraft(new Date(value)); setVisible(true); };
  const day = todayKey(value);
  // The wheel is a worded date: it follows the interface language with its home region (es_AR, en_US), like the row
  // above it; the region never reorders it. Keep the spinner: inline and compact draw system text that ignores the locale.
  // onValueChange/onDismiss, not the deprecated onChange: iOS spins the draft, which Listo saves; Android's dialog
  // saves on a chosen value and closes either way.
  const picker = <DateTimePicker value={draft} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} locale={pickerLocale}
    themeVariant={p.isDark ? 'dark' : 'light'} minimumDate={new Date(1900, 0, 1)}
    maximumDate={allowFuture ? new Date(2100, 11, 31) : new Date()}
    style={{ width: '100%' }} onValueChange={(_event, next) => {
      if (Platform.OS === 'ios') setDraft(next);
      else { setVisible(false); onChange(next); }
    }} onDismiss={() => setVisible(false)} />;
  return <>
    {/* VoiceOver hears the date written out ("22 de septiembre de 2026"), not the abbreviated month on screen. */}
    <DetailRow label={title} icon="calendar-outline" last disabled={disabled} onPress={open} layout="inline"
      value={formatDate(day, 'dayYear')} spokenValue={formatDate(day, 'long')} />
    {/* iOS: the compact bottom sheet (24B6); the list sheets of the other fields keep their page-sheet geometry. */}
    {Platform.OS === 'ios' ? <BottomSheet visible={visible} title={label === undefined ? t('selection.chooseDate') : label} onClose={() => setVisible(false)}
      onDone={() => { onChange(draft); setVisible(false); }}>
      {picker}
    </BottomSheet> : visible && picker}
  </>;
}

/** The chosen category looks like itself here too: its glyph on its hue, as in
 * every row and detail. Income categories keep the income tone. */
export function CategoryField({ entries, kind, value, onChange, disabled = false, prominent = false, detail, spokenDetail, detailTone }: {
  entries: Entry[]; kind: EntryKind; value: string; onChange: (category: string) => void; disabled?: boolean;
  /** `spokenDetail` is the detail line (a budget sentence with its amount) for VoiceOver (see SelectorCard). */
  prominent?: boolean; detail?: string; spokenDetail?: string; detailTone?: 'neutral' | 'warning' | 'expense';
}) {
  const p = usePalette();
  const { t, language } = useI18n();
  const definitions = useCategoryDefinitions();
  const look = useCategoryLook(value, kind);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  // Choices are identities: the display name (a built-in one in the interface language) is shown, the stored spelling is what the movement records.
  const choices = useMemo(() => categoryChoices(entries, kind, query, value, definitions, language), [entries, kind, query, value, definitions, language]);
  const custom = customCategory(query, choices, kind, definitions);
  const choose = (category: string) => { Keyboard.dismiss(); if (categoryKey(category) !== categoryKey(value)) selectionHaptic(); onChange(category); setVisible(false); };
  const open = () => { Keyboard.dismiss(); setQuery(''); setVisible(true); };
  return <>
    {prominent ? <SelectorCard label={t('selection.category')} value={value ? look.label : undefined} placeholder={t('selection.chooseCategory')} detail={detail} spokenDetail={spokenDetail} detailTone={detailTone}
      icon={value ? look.glyph : 'pricetag-outline'} tone={kind === 'income' && value ? 'income' : 'neutral'}
      color={value && kind === 'expense' ? look.hex : undefined} disabled={disabled} onPress={open} />
      : <SelectionRow label={t('selection.category')} value={value ? look.label : t('selection.chooseCategory')} placeholder={!value}
        leading={value ? <CategoryBadge category={value} kind={kind} size={30} /> : undefined} icon="pricetag-outline" disabled={disabled} onPress={open} last />}
    <SelectionSheet visible={visible} title={t('selection.categories')} onClose={() => setVisible(false)}>
      <FlatList data={choices} keyExtractor={item => item.key} keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }}
        ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 16 }}>
          <Field label={t('selection.searchOrCreateCategory')} value={query} onChangeText={setQuery}
            placeholder={t('selection.categoryNamePlaceholder')} maxLength={60} autoCapitalize="sentences"
            clearButtonMode="while-editing" autoCorrect={false} />
          {custom && <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={t('selection.useCategory', { name: custom })}
            onPress={() => choose(custom)} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: p.primarySoft, overflow: 'hidden' }}>
            <Ionicons name="add-circle-outline" color={p.primary} size={24} accessible={false} />
            <AppText style={{ color: p.primary, fontWeight: '600', flex: 1 }}>{t('selection.useNewCategory', { name: custom })}</AppText>
          </PressFeedback>}
        </View>}
        renderItem={({ item }) => <PressFeedback feedback="highlight" accessibilityRole="button"
          accessibilityLabel={item.label + (item.archived ? ', ' + t('selection.archived') : '')}
          accessibilityState={{ selected: categoryKey(value) === item.key }} onPress={() => choose(item.storedLabel)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, marginBottom: 6, backgroundColor: p.surface, borderRadius: 18, overflow: 'hidden' }}>
          <CategoryBadge category={item.storedLabel} kind={kind} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText numberOfLines={2} style={{ fontWeight: '500' }}>{item.label}</AppText>
            {item.archived && <AppText secondary variant="caption">{t('selection.archivedStillValid')}</AppText>}
          </View>
          {categoryKey(value) === item.key && <Ionicons name="checkmark-circle" color={p.primary} size={23} accessible={false} />}
        </PressFeedback>} />
    </SelectionSheet>
  </>;
}
