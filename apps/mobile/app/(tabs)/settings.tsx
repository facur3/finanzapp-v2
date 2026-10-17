import { Tabs, router } from 'expo-router';
import { currentMonthISO, todayKey } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { FINANCE_ROW_LOOKS, appearanceHex } from '../../src/ui/appearance';
import { GlyphTile, IconButton, NavigationRow, Screen, Surface } from '../../src/ui/components';
import { usePalette } from '../../src/ui/theme';
import { useI18n } from '../../src/i18n/provider';

declare const __DEV__: boolean | undefined;
/** «Para revisar» stays in a development build even when empty, so its tray can be opened (25A-03). */
const DIAGNOSTICS = typeof __DEV__ !== 'undefined' && __DEV__;

/** Finanzas, the fourth tab (Producto 25N1, decision 005's amendment): the tools that shape the ledger, in one native
 * grouped list, each with a soft tinted identity tile from the same palette accounts and categories use (the row itself
 * stays neutral). Home only surfaces contextual information; permanent navigation lives here. The route file keeps its
 * historical name (settings).
 *
 * Before 25N1 this was Más, with a second group «App y datos». Its rows moved: Idioma, Región, Apariencia, Copia de
 * seguridad and the version footer to Ajustes (`app/preferences.tsx`), behind the gear of this navigation bar, a rare
 * destination one tap away; Movimientos deshechos to a button of Movimientos' navigation bar, beside what it restores. */
export default function FinancesScreen() {
  const { archive, review } = useLedger();
  const p = usePalette();
  const { t } = useI18n();
  const activeRecurring = archive?.recurring?.filter(rule => rule.active).length ?? 0;
  const activeDebts = archive?.debts?.filter(debt => debt.active).length ?? 0;
  const currentBudgets = archive?.budgets?.filter(budget => budget.active && budget.monthISO === currentMonthISO(todayKey())).length ?? 0;
  const customCategories = archive?.categories?.filter(definition => !definition.archived).length ?? 0;
  const activeCards = archive?.cards?.filter(card => card.active).length ?? 0;
  // 25A-03: «Para revisar» leads the list while a proposal waits or a row cannot be read (and always in a development
  // build, so its empty tray can be opened); otherwise, or while the review file is unavailable, it is not there at all.
  const tray = review && review !== 'unavailable' ? review : null;
  const pendingReview = tray?.items.length ?? 0;
  const showsReview = !!tray && (DIAGNOSTICS || pendingReview > 0 || tray.unreadable.length > 0);
  const reviewSubtitle = pendingReview ? t('settings.rows.reviewCount', { count: pendingReview }) : t('settings.rows.reviewNone');
  const tile = (key: keyof typeof FINANCE_ROW_LOOKS) => <GlyphTile icon={FINANCE_ROW_LOOKS[key].glyph} color={appearanceHex(FINANCE_ROW_LOOKS[key].color, p)} size={34} />;

  return <Screen>
    {/* 25N1: Ajustes is a trailing bar button, like the gear at the root of an iOS app; never a row among the ledger's tools. */}
    <Tabs.Screen options={{ headerRight: () => <IconButton name="settings-outline" label={t('settings.open')} onPress={() => router.push('/preferences')} /> }} />
    <Surface grouped>
      {showsReview && <NavigationRow title={t('settings.rows.review')} subtitle={reviewSubtitle} leading={<GlyphTile icon="file-tray-full-outline" size={34} />} onPress={() => router.push('/review')} />}
      <NavigationRow title={t('settings.rows.accounts')} subtitle={t('settings.rows.accountsSubtitle')} leading={tile('accounts')} onPress={() => router.push('/accounts')} />
      <NavigationRow title={t('settings.rows.cards')} subtitle={activeCards ? t('settings.rows.cardsCount', { count: activeCards }) : t('settings.rows.cardsSubtitle')} leading={tile('cards')} onPress={() => router.push('/cards')} />
      <NavigationRow title={t('settings.rows.budgets')} subtitle={currentBudgets ? t('settings.rows.budgetsCount', { count: currentBudgets }) : t('settings.rows.budgetsSubtitle')} leading={tile('budgets')} onPress={() => router.push('/budgets')} />
      <NavigationRow title={t('settings.rows.recurring')} subtitle={activeRecurring ? t('settings.rows.recurringCount', { count: activeRecurring }) : t('settings.rows.recurringSubtitle')} leading={tile('recurring')} onPress={() => router.push('/recurring')} />
      <NavigationRow title={t('settings.rows.debts')} subtitle={activeDebts ? t('settings.rows.debtsCount', { count: activeDebts }) : t('settings.rows.debtsSubtitle')} leading={tile('debts')} onPress={() => router.push('/debts')} />
      <NavigationRow title={t('settings.rows.categories')} subtitle={customCategories ? t('settings.rows.categoriesCount', { count: customCategories }) : t('settings.rows.categoriesSubtitle')} leading={tile('categories')} last onPress={() => router.push('/categories')} />
    </Surface>
  </Screen>;
}
