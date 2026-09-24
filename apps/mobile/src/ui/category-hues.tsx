import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import type { AccountAppearance, CategoryDefinition, EntryKind } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { resolveAccountLook, resolveCategoryLook, type AccountLook, type CategoryLook } from './appearance';
import { assignCategoryHues } from './category-color';
import { usePalette } from './theme';
import { useI18n } from '../i18n/provider';

export type { AccountLook, CategoryLook } from './appearance';

/** One identity context for the whole app. A category looks the same in a
 * row, a tile, the donut and the legend; an account looks the same in Cuentas,
 * its detail, every selector and every detail row. The resolution itself is
 * pure (appearance.ts); this file only provides the data. It keeps its
 * historical name. */
type Identity = { definitions: CategoryDefinition[]; appearances: AccountAppearance[]; hues: Map<string, number> };
const IdentityContext = createContext<Identity>({ definitions: [], appearances: [], hues: new Map() });

export function CategoryHuesProvider({ children }: { children: ReactNode }) {
  const { snapshot, archive } = useLedger();
  const value = useMemo<Identity>(() => ({
    definitions: archive?.categories ?? [],
    appearances: archive?.appearances ?? [],
    hues: assignCategoryHues(snapshot?.entries ?? []),
  }), [archive?.categories, archive?.appearances, snapshot?.entries]);
  return createElement(IdentityContext.Provider, { value }, children);
}

export const useCategoryHues = () => useContext(IdentityContext).hues;
export const useCategoryDefinitions = () => useContext(IdentityContext).definitions;

/** A built-in category's name follows the interface language; see `localizedCategoryLabel`. */
export function useCategoryLook(stored: string, kind: EntryKind = 'expense'): CategoryLook {
  const identity = useContext(IdentityContext);
  const p = usePalette();
  const { language } = useI18n();
  return useMemo(() => resolveCategoryLook(kind, stored, identity, p, language), [kind, stored, identity, p.isDark, language]);
}

/** The colour for a category label in the current theme. */
export function useCategoryColor(label: string, kind: EntryKind = 'expense'): string {
  return useCategoryLook(label, kind).hex;
}

/** The display name for a stored category string. */
export function useCategoryLabel(stored: string, kind: EntryKind = 'expense'): string {
  return useCategoryLook(stored, kind).label;
}

/** A resolver for lists (legend, donut) that need many looks at once. */
export function useCategoryLookOf(kind: EntryKind = 'expense'): (stored: string) => CategoryLook {
  const identity = useContext(IdentityContext);
  const p = usePalette();
  const { language } = useI18n();
  return useMemo(() => (stored: string) => resolveCategoryLook(kind, stored, identity, p, language), [kind, identity, p.isDark, language]);
}

export function useAccountLook(accountId: string | undefined): AccountLook {
  const { appearances } = useContext(IdentityContext);
  const p = usePalette();
  return useMemo(() => resolveAccountLook(accountId ?? '', appearances, p), [accountId, appearances, p.isDark]);
}

export function useAccountLookOf(): (accountId: string) => AccountLook {
  const { appearances } = useContext(IdentityContext);
  const p = usePalette();
  return useMemo(() => (accountId: string) => resolveAccountLook(accountId, appearances, p), [appearances, p.isDark]);
}
