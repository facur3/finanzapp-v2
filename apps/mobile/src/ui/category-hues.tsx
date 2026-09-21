import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useLedger } from '../storage/LedgerProvider';
import { assignCategoryHues, categoryColor } from './category-color';
import { usePalette } from './theme';

const HuesContext = createContext<Map<string, number>>(new Map());

/** One hue map for the whole app, derived from the recorded expenses, so a
 * category looks the same in a row, a tile, the donut and the legend. */
export function CategoryHuesProvider({ children }: { children: ReactNode }) {
  const { snapshot } = useLedger();
  const hues = useMemo(() => assignCategoryHues(snapshot?.entries ?? []), [snapshot?.entries]);
  return createElement(HuesContext.Provider, { value: hues }, children);
}

export const useCategoryHues = () => useContext(HuesContext);

/** The colour for a category label in the current theme. */
export function useCategoryColor(label: string): string {
  const hues = useCategoryHues();
  const p = usePalette();
  return categoryColor(label, hues, p);
}
