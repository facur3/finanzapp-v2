/** The FinanzApp colour system, free of React Native so its contrast can be
 * checked in Node.
 *
 * Ink on ground stays the base. One brand primary, a cobalt blue, marks
 * interaction and selection: the active tab, the chosen segment, links, the
 * filled call to action, the account selector. Four semantic colours keep
 * their meaning (expense coral, income green, transfer azure, warning amber)
 * and win over the primary whenever meaning is at stake; the category hues in
 * category-color.ts are a separate, muted family. Normal text is never blue. */
export const lightPalette = {
  background: '#F2F2F6', surface: '#FFFFFF', inset: '#EEEEF3', elevated: '#FFFFFF',
  text: '#0A0A0C', secondary: '#6E7078', tertiary: '#8E9098', line: '#E6E6EC',
  /** Cobalt: selection, links and icons (6.2:1 on white). */
  primary: '#2557D6',
  /** The filled call to action; white text on it. */
  primaryFill: '#2557D6', onPrimary: '#FFFFFF',
  /** A whisper of the primary for a tinted row or tile. */
  primarySoft: '#E5ECFB',
  expense: '#C42F39', income: '#15804F', transfer: '#0B6BB3', warning: '#B45309',
  expenseSoft: '#FBE9EA', incomeSoft: '#E6F5EE', transferSoft: '#E8F3FC', warningSoft: '#FCF1E0',
  shadow: 'rgba(10, 10, 12, 0.08)',
};

export const darkPalette: typeof lightPalette = {
  background: '#000000', surface: '#1C1C1E', inset: '#2C2C2E', elevated: '#242426',
  text: '#F5F5F7', secondary: '#A0A0A8', tertiary: '#7C7C84', line: '#2C2C30',
  /** Sapphire: bright enough to read as text on every dark surface (4.7:1 on the segmented thumb). */
  primary: '#5B87FF',
  /** A deeper cobalt under white button text (5:1), so the button is a solid object rather than a glow. */
  primaryFill: '#3565EA', onPrimary: '#FFFFFF',
  primarySoft: '#122048',
  expense: '#F0555C', income: '#3DBE86', transfer: '#4DB0FF', warning: '#E8A030',
  expenseSoft: '#3A1E20', incomeSoft: '#173126', transferSoft: '#14304A', warningSoft: '#3A2C14',
  shadow: 'rgba(0, 0, 0, 0)',
};

export type PaletteColors = typeof lightPalette;
