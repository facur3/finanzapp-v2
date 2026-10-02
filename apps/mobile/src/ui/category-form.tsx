import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { assertCategoryName, categoryNameTaken, editedCategoryDefinition, newCategoryDefinition, sameCategoryDefinition, validateCategoryDefinition,
  validateCategoryDefinitions, type CategoryDefinition, type CategoryIdentity, type EntryKind } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { CATEGORY_ICON_CHOICES, COLOR_CHOICES, identityGlyph, localizedCategoryLabel } from './appearance';
import { IconColorPicker } from './appearance-picker';
import { ActionButton, AppText, Choices, ErrorMessage, Field, FieldNote, IconButton, LifecycleNote, Screen } from './components';
import { space } from './theme';
import { useI18n } from '../i18n/provider';

/** 24UX6E: the icon a category opens on. A historical string has no stored icon; it opens on the curated icon whose glyph
 * the app already draws for it (the synonym map: «nafta» on fuel), else on «other». Its derived hue is not a palette
 * colour, so the colour opens on graphite. */
function prefillIcon(identity: CategoryIdentity | undefined): CategoryDefinition['icon'] {
  if (!identity) return 'other';
  if (identity.icon) return identity.icon;
  const glyph = identityGlyph(identity);
  return (CATEGORY_ICON_CHOICES.find(choice => choice.glyph === glyph)?.id ?? 'other') as CategoryDefinition['icon'];
}

/** Create a custom category, or edit how an existing one looks. Editing changes
 * the display name, icon and colour of an identity; the string movements carry
 * (`storedLabel`) never changes, so history, budgets, rules and reports keep
 * grouping exactly as before. Archiving hides the category from new choices
 * and keeps every historical movement readable.
 *
 * A built-in category the person never renamed is prefilled with its name in
 * the interface language ("Food"). Saving that same text keeps the definition's
 * own label ("Comida"), so an English look is never stored as a rename; only
 * a name the person actually typed becomes one. */
export function CategoryForm({ original, kind: requestedKind }: { original?: CategoryIdentity; kind?: string }) {
  const { archive, saveCategory } = useLedger();
  const { t, language } = useI18n();
  const definitions = archive?.categories ?? [];
  const [before] = useState(original);
  // The name this identity shows now, and the one the field was prefilled with (the language may change while the form is open).
  const shown = before ? localizedCategoryLabel(before, language) : '';
  const [prefilled] = useState(shown);
  const [kind, setKind] = useState<EntryKind>(before?.kind ?? (requestedKind === 'income' ? 'income' : 'expense'));
  const [label, setLabel] = useState(prefilled);
  // 24UX6E: the look the form opened on. An untouched save compares against it, so a historical string is never adopted
  // (and so recoloured and re-glyphed everywhere) by a save that changed nothing.
  const [initial] = useState(() => ({ icon: prefillIcon(before), color: before?.color ?? 'graphite' as CategoryDefinition['color'] }));
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CategoryDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false), confirming = useRef(false);
  const locked = busy || pending !== null;
  /** The label to store for what the field holds: a displayed built-in name left as it was keeps the identity's own label. */
  const storedName = (typed: string) => before && (typed === prefilled || typed === shown) ? before.label : typed;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/categories'); } };

  async function apply(definition: CategoryDefinition) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null); setPending(definition);
    Keyboard.dismiss();
    try {
      await saveCategory(definition);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'categoryManager.form.saveUnverified');
    } finally { saving.current = false; setBusy(false); }
  }
  /** 24UX6E: the two name rules storage applies (saveCategoryDefinition), checked here first so a clash is an editable
   * input error, never a frozen «Reintentar guardado» that can only fail again. Mirrors storage exactly; Guardar and
   * Archivar both pass through it. */
  function checkStorageRules(definition: CategoryDefinition) {
    const existing = definitions.find(item => item.kind === definition.kind && item.key === definition.key);
    if (!existing || existing.label !== definition.label) assertCategoryName(definition, definitions);
    validateCategoryDefinitions(existing ? definitions.map(item => item === existing ? definition : item) : [...definitions, definition]);
  }
  function save() {
    if (saving.current || confirming.current) return;
    setError(null);
    if (pending) { void apply(pending); return; }
    try {
      const now = new Date().toISOString();
      let definition: CategoryDefinition;
      if (before) {
        const name = storedName(label.trim());
        definition = editedCategoryDefinition(before, { label: name, icon, color }, now);
        if (before.definition && sameCategoryDefinition(before.definition, { ...definition, revision: before.definition.revision, updatedAt: before.definition.updatedAt })) { close(); return; }
        if (!before.definition && name === before.label && icon === initial.icon && color === initial.color) { close(); return; }
      } else {
        if (categoryNameTaken(kind, label, definitions)) throw new Error('categoryManager.form.nameTaken');
        definition = newCategoryDefinition(kind, label, icon, color, now);
      }
      validateCategoryDefinition(definition);
      checkStorageRules(definition);
      void apply(definition);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'categoryManager.form.checkName'); }
  }
  function toggleArchive() {
    if (!before || saving.current || confirming.current) return;
    confirming.current = true;
    const archiving = !before.archived;
    // 24UX6E: the icon the form opened on, so archiving a never-adopted historical string keeps its synonym glyph.
    const definition = editedCategoryDefinition(before, { archived: archiving, icon: initial.icon }, new Date().toISOString());
    setError(null);
    try { checkStorageRules(definition); } catch (cause) {
      confirming.current = false;
      setError(cause instanceof Error ? cause.message : 'categoryManager.form.checkName');
      return;
    }
    Alert.alert(t(archiving ? 'categoryManager.form.archiveTitle' : 'categoryManager.form.unarchiveTitle'),
      t(archiving ? 'categoryManager.form.archiveMessage' : 'categoryManager.form.unarchiveMessage', { name: shown }), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: t(archiving ? 'categoryManager.form.archiveConfirm' : 'categoryManager.form.unarchiveConfirm'), style: archiving ? 'destructive' : 'default', onPress: () => { confirming.current = false; void apply(definition); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }
  const renamed = !!before && storedName(label.trim()) !== before.storedLabel;
  return <Screen gap={space.l}>
    <Stack.Screen options={{ title: t(before ? 'nav.titles.editCategory' : 'nav.titles.newCategory'), gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label={t('common.close')} onPress={close} disabled={busy} /> }} />
    {/* 24UX6E: an archived category says so first, with what it still does and how to undo it. */}
    {before?.archived && <LifecycleNote icon="archive-outline" title={t('categoryManager.form.archivedTitle')} detail={t('categoryManager.form.archivedDetail')} />}
    {!before && <Choices<EntryKind> value={kind} onChange={setKind} disabled={locked}
      options={[{ value: 'expense', label: t('movement.expense') }, { value: 'income', label: t('movement.income') }]} />}
    <Field label={t('categoryManager.form.name')} value={label} onChangeText={value => { setLabel(value); setError(null); }} maxLength={60}
      autoCapitalize="sentences" autoCorrect={false} placeholder={t('categoryManager.form.namePlaceholder')} editable={!locked} />
    {/* 24UX6E: the rename note right under the field that causes it. */}
    {renamed && <FieldNote>{t('categoryManager.form.renamedNote', { stored: before.storedLabel, shown: label.trim() || before.storedLabel })}</FieldNote>}
    <IconColorPicker icons={CATEGORY_ICON_CHOICES} colors={COLOR_CHOICES} icon={icon} color={color}
      onIconChange={setIcon} onColorChange={setColor} disabled={locked} previewLabel={label} />
    {before && <AppText secondary variant="footnote">{t('categoryManager.form.editNote')}</AppText>}
    {!before && <AppText secondary variant="footnote">{t(kind === 'expense' ? 'categoryManager.form.availableExpense' : 'categoryManager.form.availableIncome')}</AppText>}
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary variant="footnote">{t('categoryManager.form.retryNote')}</AppText>}
    <View style={{ gap: 10 }}>
      <ActionButton label={t(pending && error ? 'common.retrySave' : before ? 'common.saveChanges' : 'categoryManager.form.create')} onPress={save} busy={busy} disabled={!label.trim()} />
      {before && <ActionButton label={t(before.archived ? 'categoryManager.form.unarchive' : 'categoryManager.form.archive')} icon={before.archived ? 'arrow-redo-outline' : 'archive-outline'}
        secondary onPress={toggleArchive} disabled={locked} />}
    </View>
  </Screen>;
}
