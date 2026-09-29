import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { planFinancingCategories, type Account, type AccountAppearance, type CategoryDefinition, type EntryKind, type PersonalDebtProfile } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { resolveAccountLook, resolveCategoryLook, type AccountLook, type CategoryLook } from './appearance';
import { assignCategoryHues } from './category-color';
import { accountDisplayName } from './liability-presentation';
import { usePalette } from './theme';
import { useI18n } from '../i18n/provider';

export type { AccountLook, CategoryLook } from './appearance';

/** One identity context for the whole app. A category looks the same in a
 * row, a tile, the donut and the legend; an account looks the same in Cuentas,
 * its detail, every selector and every detail row. The resolution itself is
 * pure (appearance.ts); this file only provides the data. It keeps its
 * historical name. */
type Identity = { definitions: CategoryDefinition[]; appearances: AccountAppearance[]; hues: Map<string, number>; debts: PersonalDebtProfile[];
  /** 24T2: stored categories saved plans need (their interest), so a latent category is listed from then on. */
  inUse: string[] };
const IdentityContext = createContext<Identity>({ definitions: [], appearances: [], hues: new Map(), debts: [], inUse: [] });

export function CategoryHuesProvider({ children }: { children: ReactNode }) {
  const { snapshot, archive } = useLedger();
  const value = useMemo<Identity>(() => ({
    definitions: archive?.categories ?? [],
    appearances: archive?.appearances ?? [],
    hues: assignCategoryHues(snapshot?.entries ?? []),
    debts: archive?.debts ?? [],
    inUse: planFinancingCategories(archive?.installmentPlans),
  }), [archive?.categories, archive?.appearances, snapshot?.entries, archive?.debts, archive?.installmentPlans]);
  return createElement(IdentityContext.Provider, { value }, children);
}

export const useCategoryHues = () => useContext(IdentityContext).hues;
export const useCategoryDefinitions = () => useContext(IdentityContext).definitions;
/** 24T2: stored categories in use beyond the movements (a plan's interest), for the catalogue and the pickers. */
export const useCategoriesInUse = () => useContext(IdentityContext).inUse;

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

/** The name an account shows as one side of a transfer: a personal debt's hidden account reads
 * "Debo · Juan" / "I owe · Juan" from the debt itself; every other account its own name. */
export function useAccountNameOf(): (account: Account) => string {
  const { debts } = useContext(IdentityContext);
  const { t } = useI18n();
  return useMemo(() => (account: Account) => accountDisplayName(account, debts, t), [debts, t]);
}
