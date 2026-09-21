import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, Modal, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Account, Entry, EntryKind } from '@finanzapp/domain';
import { AppText, CategoryBadge, DetailRow, Field, GlyphTile, PressFeedback, surfaceShadow, type IconName, type Tone } from './components';
import { selectionHaptic } from './motion';
import { radius, usePalette, useReduceMotion } from './theme';
import { categoryChoices, categoryIcon, categoryKey, customCategory } from './categories';

/** Full-width selector used for the two choices a user must never overlook in
 * a form: which category and which account or card. A 44 pt tile, the label,
 * the current value and a live detail line (balance, budget) sit on one card. */
export function SelectorCard({ label, value, placeholder, detail, icon, tone = 'neutral', disabled = false, onPress, detailTone }: {
  label: string; value?: string; placeholder: string; detail?: string; icon: IconName; tone?: Tone; disabled?: boolean; onPress: () => void;
  detailTone?: 'neutral' | 'warning' | 'expense';
}) {
  const p = usePalette();
  const detailColor = detailTone === 'expense' ? p.expense : detailTone === 'warning' ? p.warning : p.secondary;
  return <PressFeedback accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? placeholder}${detail ? ', ' + detail : ''}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.group, backgroundColor: p.surface, minHeight: 72, opacity: disabled ? 0.6 : 1 }, surfaceShadow(p)]}>
    <GlyphTile icon={icon} tone={tone} size={44} />
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{label}</AppText>
      <AppText numberOfLines={1} style={{ fontWeight: '600', color: value ? p.text : p.tint }}>{value ?? placeholder}</AppText>
      {!!detail && <AppText numberOfLines={1} variant="footnote" style={{ color: detailColor }}>{detail}</AppText>}
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
  return <Modal visible={visible} animationType={reduced ? 'none' : 'slide'} presentationStyle="pageSheet"
    allowSwipeDismissal onRequestClose={onClose}>
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
        <PressFeedback accessibilityRole="button" onPress={onClose}><AppText style={{ color: p.tint, fontSize: 16 }}>Cancelar</AppText></PressFeedback>
        <AppText accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}>{title}</AppText>
        {onDone && <PressFeedback accessibilityRole="button" onPress={onDone}><AppText style={{ color: p.tint, fontSize: 16, fontWeight: '600' }}>Listo</AppText></PressFeedback>}
      </View>
      {children}
    </SafeAreaView>
  </Modal>;
}

export function AccountField({ accounts, value, onChange, disabled = false, label = 'Cuenta', kindOf, prominent = false, detail, detailTone, describe }: {
  accounts: Account[]; value: string; onChange: (id: string) => void; disabled?: boolean; label?: string;
  /** Names the kind of each option (Cuenta, Tarjeta, Deuda) so a card is never mistaken for cash. */
  kindOf?: (accountId: string) => string;
  /** Render as a full-width selector card with a live detail line instead of a compact row. */
  prominent?: boolean; detail?: string; detailTone?: 'neutral' | 'warning' | 'expense';
  /** Optional per-option second line in the sheet (for example the recorded balance). */
  describe?: (account: Account) => string;
}) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  const selected = accounts.find(account => account.id === value);
  const kind = (id: string) => kindOf?.(id) ?? 'Cuenta';
  const icon = (id: string) => kind(id).startsWith('Tarjeta') ? 'card-outline' : kind(id) === 'Deuda' ? 'people-outline' : 'wallet-outline';
  const open = () => { Keyboard.dismiss(); setVisible(true); };
  return <>
    {prominent ? <SelectorCard label={label} value={selected ? selected.name : undefined} placeholder="Elegir cuenta"
      detail={detail ?? (selected ? kind(selected.id) + ' · ' + selected.currency : undefined)} detailTone={detailTone}
      icon={selected ? icon(selected.id) : 'wallet-outline'} disabled={disabled} onPress={open} />
      : <DetailRow label={label} value={selected ? selected.name + ' · ' + selected.currency : 'Elegir cuenta'} icon={selected ? icon(selected.id) : 'wallet-outline'}
        disabled={disabled} onPress={open} />}
    <SelectionSheet visible={visible} title={label === 'Cuenta' ? 'Elegir cuenta' : label} onClose={() => setVisible(false)}>
      <FlatList data={accounts} keyExtractor={account => account.id} contentContainerStyle={{ padding: 20, paddingTop: 0 }}
        renderItem={({ item }) => <PressFeedback accessibilityRole="button" accessibilityState={{ selected: value === item.id }}
          accessibilityLabel={item.name + ', ' + kind(item.id) + ', ' + item.currency} onPress={() => { if (item.id !== value) selectionHaptic(); onChange(item.id); setVisible(false); }}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, backgroundColor: p.surface, borderRadius: 16, marginBottom: 8 }}>
          <GlyphTile icon={icon(item.id)} />
          <View style={{ flex: 1, gap: 3 }}><AppText style={{ fontWeight: '600' }}>{item.name}</AppText>
            <AppText secondary style={{ fontSize: 14 }}>{kind(item.id)} · {item.currency}{describe ? ' · ' + describe(item) : ''}</AppText></View>
          {item.id === value && <Ionicons name="checkmark-circle" color={p.tint} size={24} accessible={false} />}
        </PressFeedback>} />
    </SelectionSheet>
  </>;
}

export function DateField({ value, onChange, disabled = false, allowFuture = false, label = 'Fecha' }: {
  value: Date; onChange: (date: Date) => void; disabled?: boolean; allowFuture?: boolean; label?: string;
}) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value);
  const open = () => { Keyboard.dismiss(); setDraft(new Date(value)); setVisible(true); };
  const picker = <DateTimePicker value={draft} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    themeVariant={p.isDark ? 'dark' : 'light'} minimumDate={new Date(1900, 0, 1)}
    maximumDate={allowFuture ? new Date(2100, 11, 31) : new Date()}
    style={{ width: '100%' }} onChange={(event, next) => {
      if (Platform.OS !== 'ios') {
        setVisible(false);
        if (event.type === 'set' && next) onChange(next);
      } else if (event.type === 'set' && next) setDraft(next);
    }} />;
  return <>
    <DetailRow label={label} icon="calendar-outline" last disabled={disabled} onPress={open}
      value={value.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })} />
    {Platform.OS === 'ios' ? <SelectionSheet visible={visible} title={label === 'Fecha' ? 'Elegir fecha' : label} onClose={() => setVisible(false)}
      onDone={() => { onChange(draft); setVisible(false); }}>
      <View style={{ width: '100%', overflow: 'hidden', paddingTop: 20 }}>{picker}</View>
    </SelectionSheet> : visible && picker}
  </>;
}

export function CategoryField({ entries, kind, value, onChange, disabled = false, prominent = false, detail, detailTone }: {
  entries: Entry[]; kind: EntryKind; value: string; onChange: (category: string) => void; disabled?: boolean;
  prominent?: boolean; detail?: string; detailTone?: 'neutral' | 'warning' | 'expense';
}) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const choices = useMemo(() => categoryChoices(entries, kind, query, value), [entries, kind, query, value]);
  const custom = customCategory(query, choices);
  const choose = (category: string) => { Keyboard.dismiss(); if (categoryKey(category) !== categoryKey(value)) selectionHaptic(); onChange(category); setVisible(false); };
  const open = () => { Keyboard.dismiss(); setQuery(''); setVisible(true); };
  return <>
    {prominent ? <SelectorCard label="Categoría" value={value || undefined} placeholder="Elegir categoría" detail={detail} detailTone={detailTone}
      icon={value ? categoryIcon(value) : 'pricetag-outline'} tone={kind === 'income' && value ? 'income' : 'neutral'} disabled={disabled} onPress={open} />
      : <DetailRow label="Categoría" value={value || 'Elegir categoría'} icon="pricetag-outline" disabled={disabled} onPress={open} />}
    <SelectionSheet visible={visible} title="Categorías" onClose={() => setVisible(false)}>
      <FlatList data={choices} keyExtractor={categoryKey} keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }}
        ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 16 }}>
          <Field label="Buscar o crear categoría" value={query} onChangeText={setQuery}
            placeholder="Nombre de la categoría" maxLength={60} autoCapitalize="sentences"
            clearButtonMode="while-editing" autoCorrect={false} />
          {custom && <PressFeedback accessibilityRole="button" accessibilityLabel={'Usar categoría ' + custom}
            onPress={() => choose(custom)} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: p.transferSoft }}>
            <Ionicons name="add-circle-outline" color={p.tint} size={24} accessible={false} />
            <AppText style={{ color: p.tint, fontWeight: '600', flex: 1 }}>Usar «{custom}»</AppText>
          </PressFeedback>}
        </View>}
        renderItem={({ item }) => <PressFeedback accessibilityRole="button" accessibilityLabel={item}
          accessibilityState={{ selected: categoryKey(value) === categoryKey(item) }} onPress={() => choose(item)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, marginBottom: 6, backgroundColor: p.surface, borderRadius: 18 }}>
          <CategoryBadge category={item} />
          <AppText style={{ flex: 1, fontWeight: '500' }}>{item}</AppText>
          {categoryKey(value) === categoryKey(item) && <Ionicons name="checkmark-circle" color={p.tint} size={23} accessible={false} />}
        </PressFeedback>} />
    </SelectionSheet>
  </>;
}
