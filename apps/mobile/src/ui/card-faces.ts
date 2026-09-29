/** The colours of a credit card's face (Producto 24T2), free of React Native so their contrast is checked in Node.
 *
 * A face is always deep with white text, in light and dark mode alike: a card is an object, not a surface of the
 * interface. When the person chose a colour for the card in Editar cuenta (an appearance row on the card's hidden
 * account), the face takes the deep tone of that colour; otherwise it keeps the calm tone FinanzApp has always given it,
 * chosen by a stable hash of the card's id, so a card keeps its colour across sessions and devices. Every base and every
 * highlight holds white text at 7:1 or more (tests/cards-deck.node.ts), and the issuer's softer white stays AA. */

export interface FaceTone {
  /** The face itself. */
  base: string;
  /** The soft sheen in the top corner (drawn at 35 % over the base). */
  highlight: string;
}

/** The tones of a card without a chosen colour, by hash (unchanged since Interfaz 10, except bronze's highlight, one
 * step deeper in 24T2 so it reaches 7:1 with white too). */
export const HASH_FACES: readonly FaceTone[] = [
  { base: '#1F2937', highlight: '#374151' }, // graphite
  { base: '#0F1F3D', highlight: '#1E3A6E' }, // navy
  { base: '#12352A', highlight: '#1F5C46' }, // forest
  { base: '#3B1F44', highlight: '#5B3268' }, // plum
  { base: '#4A3A1D', highlight: '#6A532D' }, // bronze
  { base: '#1F2A36', highlight: '#33475B' }, // slate
];

/** A deep tone for each appearance colour (`APPEARANCE_COLORS`, packages/domain/appearance.ts), the same hue as the
 * colour the account shows elsewhere, dark enough to carry white text. */
export const COLOR_FACES: Readonly<Record<string, FaceTone>> = {
  cobalt: { base: '#132B6B', highlight: '#21439A' },
  azure: { base: '#0B3252', highlight: '#15507E' },
  teal: { base: '#0E3A38', highlight: '#1A5A56' },
  green: { base: '#0F3A27', highlight: '#1A5A3E' },
  olive: { base: '#2C3816', highlight: '#475A24' },
  ochre: { base: '#46320F', highlight: '#6A4C19' },
  terracotta: { base: '#4C2318', highlight: '#723626' },
  rose: { base: '#471D30', highlight: '#6B2D48' },
  indigo: { base: '#29224F', highlight: '#40367A' },
  slate: { base: '#1F2A36', highlight: '#33475B' },
  graphite: { base: '#232326', highlight: '#3A3A3F' },
};

export function cardFaceIndex(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash % HASH_FACES.length;
}

/** The face of card `id`: the deep tone of the colour its account chose (`color`, an `AppearanceColorId`), or its hash
 * tone when it never chose one (no appearance row) or the id is unknown. */
export function cardFaceTone(id: string, color?: string | null): FaceTone {
  return (color && Object.hasOwn(COLOR_FACES, color) ? COLOR_FACES[color] : null) ?? HASH_FACES[cardFaceIndex(id)];
}
