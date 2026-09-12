import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, Modal, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Account, Entry, EntryKind } from '@finanzapp/domain';
import { AppText, CategoryBadge, DetailRow, Field, PressFeedback } from './components';
import { usePalette, useReduceMotion } from './theme';
import { categoryChoices, categoryKey, customCategory } from './categories';

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
        <PressFeedback accessibilityRole="button" onPress={onClose}><AppText style={{ color: p.accent, fontSize: 16 }}>Cancelar</AppText></PressFeedback>
        <AppText accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}>{title}</AppText>
        {onDone && <PressFeedback accessibilityRole="button" onPress={onDone}><AppText style={{ color: p.accent, fontSize: 16, fontWeight: '600' }}>Listo</AppText></PressFeedback>}
      </View>
      {children}
    </SafeAreaView>
  </Modal>;
}

export function AccountField({ accounts, value, onChange, disabled = false }: {
  accounts: Account[]; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  const selected = accounts.find(account => account.id === value);
  return <>
    <DetailRow label="Cuenta" value={selected ? selected.name + ' · ' + selected.currency : 'Elegir cuenta'} icon="wallet-outline"
      disabled={disabled} onPress={() => { Keyboard.dismiss(); setVisible(true); }} />
    <SelectionSheet visible={visible} title="Elegir cuenta" onClose={() => setVisible(false)}>
      <FlatList data={accounts} keyExtractor={account => account.id} contentContainerStyle={{ padding: 20, paddingTop: 0 }}
        renderItem={({ item }) => <PressFeedback accessibilityRole="button" accessibilityState={{ selected: value === item.id }}
          accessibilityLabel={item.name + ', ' + item.currency} onPress={() => { onChange(item.id); setVisible(false); }}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14, backgroundColor: p.surface, borderRadius: 16, marginBottom: 8 }}>
          <View style={{ flex: 1, gap: 4 }}><AppText style={{ fontWeight: '600' }}>{item.name}</AppText><AppText secondary style={{ fontSize: 14 }}>{item.currency}</AppText></View>
          {item.id === value && <Ionicons name="checkmark-circle" color={p.accent} size={24} accessible={false} />}
        </PressFeedback>} />
    </SelectionSheet>
  </>;
}

export function DateField({ value, onChange, disabled = false }: { value: Date; onChange: (date: Date) => void; disabled?: boolean }) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value);
  const open = () => { Keyboard.dismiss(); setDraft(new Date(value)); setVisible(true); };
  const picker = <DateTimePicker value={draft} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    themeVariant={p.isDark ? 'dark' : 'light'} minimumDate={new Date(1900, 0, 1)} maximumDate={new Date()}
    style={{ width: '100%' }} onChange={(event, next) => {
      if (Platform.OS !== 'ios') {
        setVisible(false);
        if (event.type === 'set' && next) onChange(next);
      } else if (event.type === 'set' && next) setDraft(next);
    }} />;
  return <>
    <DetailRow label="Fecha" icon="calendar-outline" last disabled={disabled} onPress={open}
      value={value.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })} />
    {Platform.OS === 'ios' ? <SelectionSheet visible={visible} title="Elegir fecha" onClose={() => setVisible(false)}
      onDone={() => { onChange(draft); setVisible(false); }}>
      <View style={{ width: '100%', overflow: 'hidden', paddingTop: 20 }}>{picker}</View>
    </SelectionSheet> : visible && picker}
  </>;
}

export function CategoryField({ entries, kind, value, onChange, disabled = false }: {
  entries: Entry[]; kind: EntryKind; value: string; onChange: (category: string) => void; disabled?: boolean;
}) {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const choices = useMemo(() => categoryChoices(entries, kind, query, value), [entries, kind, query, value]);
  const custom = customCategory(query, choices);
  const choose = (category: string) => { Keyboard.dismiss(); onChange(category); setVisible(false); };
  return <>
    <DetailRow label="Categoría" value={value || 'Elegir categoría'} icon="pricetag-outline" disabled={disabled}
      onPress={() => { Keyboard.dismiss(); setQuery(''); setVisible(true); }} />
    <SelectionSheet visible={visible} title="Categorías" onClose={() => setVisible(false)}>
      <FlatList data={choices} keyExtractor={categoryKey} keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }}
        ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 16 }}>
          <Field label="Buscar o crear categoría" value={query} onChangeText={setQuery}
            placeholder="Nombre de la categoría" maxLength={60} autoCapitalize="sentences"
            clearButtonMode="while-editing" autoCorrect={false} />
          {custom && <PressFeedback accessibilityRole="button" accessibilityLabel={'Usar categoría ' + custom}
            onPress={() => choose(custom)} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: p.accentSoft }}>
            <Ionicons name="add-circle-outline" color={p.accent} size={24} accessible={false} />
            <AppText style={{ color: p.accent, fontWeight: '600', flex: 1 }}>Usar «{custom}»</AppText>
          </PressFeedback>}
        </View>}
        renderItem={({ item }) => <PressFeedback accessibilityRole="button" accessibilityLabel={item}
          accessibilityState={{ selected: categoryKey(value) === categoryKey(item) }} onPress={() => choose(item)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, marginBottom: 6, backgroundColor: p.surface, borderRadius: 18 }}>
          <CategoryBadge category={item} />
          <AppText style={{ flex: 1, fontWeight: '500' }}>{item}</AppText>
          {categoryKey(value) === categoryKey(item) && <Ionicons name="checkmark-circle" color={p.accent} size={23} accessible={false} />}
        </PressFeedback>} />
    </SelectionSheet>
  </>;
}
