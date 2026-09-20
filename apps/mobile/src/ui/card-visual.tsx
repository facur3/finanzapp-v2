import type { ReactNode } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { PressFeedback } from './components';
import { radius, space, usePalette } from './theme';

/** Card faces use a small curated set of deep, calm tones chosen per card by a
 * stable hash of its id, so a card keeps its colour across sessions and devices. */
const FACES = [
  { base: '#1F2937', highlight: '#374151' }, // graphite
  { base: '#0F1F3D', highlight: '#1E3A6E' }, // navy
  { base: '#12352A', highlight: '#1F5C46' }, // forest
  { base: '#3B1F44', highlight: '#5B3268' }, // plum
  { base: '#4A3A1D', highlight: '#6E5730' }, // bronze
  { base: '#1F2A36', highlight: '#33475B' }, // slate
] as const;

export function cardFaceIndex(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash % FACES.length;
}

export const CARD_ASPECT = 1.586;

export function CardFace({ id, name, issuer, last4, currency, width, onPress, accessibilityHint }: {
  id: string; name: string; issuer: string; last4: string; currency: Currency; width: number; onPress?: () => void; accessibilityHint?: string;
}) {
  const face = FACES[cardFaceIndex(id)];
  const height = Math.round(width / CARD_ASPECT);
  const label = [name, issuer || null, last4 ? 'termina en ' + last4 : null, currency === 'USD' ? 'dólares' : 'pesos'].filter(Boolean).join(', ');
  const body = <View accessible accessibilityRole={onPress ? 'button' : 'image'} accessibilityLabel={'Tarjeta ' + label} accessibilityHint={accessibilityHint}
    style={[styles.face, { width, height, backgroundColor: face.base }]}>
    <View pointerEvents="none" style={[styles.sheen, { backgroundColor: face.highlight, width: height * 1.5, height: height * 1.5, borderRadius: height, right: -height * 0.55, top: -height * 0.75 }]} />
    <View pointerEvents="none" style={[styles.sheen, { backgroundColor: '#FFFFFF', opacity: 0.05, width: height, height, borderRadius: height, left: -height * 0.35, bottom: -height * 0.5 }]} />
    <View style={styles.faceRow}>
      <Text numberOfLines={1} style={styles.issuer}>{(issuer || 'FinanzApp').toUpperCase()}</Text>
      <View style={styles.chip}><Text style={styles.chipText}>{currency}</Text></View>
    </View>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end' }}>
      <Ionicons name="wifi-outline" size={22} color="rgba(255,255,255,0.55)" style={{ transform: [{ rotate: '90deg' }] }} accessible={false} />
    </View>
    <View style={[styles.faceRow, { alignItems: 'flex-end' }]}>
      <Text numberOfLines={1} style={styles.name}>{name}</Text>
      <Text style={styles.last4}>{last4 ? '••••  ' + last4 : '••••'}</Text>
    </View>
  </View>;
  return onPress ? <PressFeedback accessible={false} onPress={onPress} style={{ minHeight: undefined }}>{body}</PressFeedback> : body;
}

/** Horizontal, snapping card stack. The selected index follows the scroll
 * position; the card content below the carousel reacts to it. */
export function CardCarousel<T extends { id: string }>({ items, render, onSelect, selectedIndex }: {
  items: T[]; render: (item: T, width: number) => ReactNode; onSelect: (index: number) => void; selectedIndex: number;
}) {
  const p = usePalette();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth - space.xl * 2, 420);
  const gap = space.m;
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (width + gap));
    const next = Math.max(0, Math.min(items.length - 1, index));
    if (next !== selectedIndex) onSelect(next);
  };
  return <View style={{ gap: space.m }}>
    <FlatList data={items} keyExtractor={item => item.id} horizontal showsHorizontalScrollIndicator={false}
      snapToInterval={width + gap} snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum
      contentContainerStyle={{ paddingHorizontal: space.xl, gap }}
      onMomentumScrollEnd={settle} onScrollEndDrag={settle} scrollEventThrottle={32} onScroll={settle}
      getItemLayout={(_, index) => ({ length: width + gap, offset: (width + gap) * index, index })}
      renderItem={({ item }) => <View style={{ width }}>{render(item, width)}</View>} />
    {items.length > 1 && <View accessible accessibilityLabel={`Tarjeta ${selectedIndex + 1} de ${items.length}`} style={styles.dots}>
      {items.map((item, index) => <View key={item.id} style={[styles.dot, { backgroundColor: index === selectedIndex ? p.text : p.line }]} />)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  face: { borderRadius: radius.creditCard, padding: 18, overflow: 'hidden', justifyContent: 'space-between' },
  sheen: { position: 'absolute', opacity: 0.35 },
  faceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  issuer: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '600', letterSpacing: 1.1, flexShrink: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)' },
  chipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  name: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', letterSpacing: -0.2, flexShrink: 1 },
  last4: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '500', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
