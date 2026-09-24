import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { categoryNameTaken, editedCategoryDefinition, newCategoryDefinition, sameCategoryDefinition, validateCategoryDefinition,
  type CategoryDefinition, type CategoryIdentity, type EntryKind } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { CATEGORY_ICON_CHOICES, COLOR_CHOICES, localizedCategoryLabel } from './appearance';
import { IconColorPicker } from './appearance-picker';
import { ActionButton, AppText, Choices, ErrorMessage, Field, IconButton, Screen } from './components';
import { space } from './theme';
import { useI18n } from '../i18n/provider';

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
  const [icon, setIcon] = useState(before?.icon ?? 'other');
  const [color, setColor] = useState(before?.color ?? 'graphite');
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
        if (!before.definition && name === before.label && icon === before.icon && color === before.color) { close(); return; }
      } else {
        if (categoryNameTaken(kind, label, definitions)) throw new Error('categoryManager.form.nameTaken');
        definition = newCategoryDefinition(kind, label, icon, color, now);
      }
      validateCategoryDefinition(definition);
      void apply(definition);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'categoryManager.form.checkName'); }
  }
  function toggleArchive() {
    if (!before || saving.current || confirming.current) return;
    confirming.current = true;
    const archiving = !before.archived;
    const definition = editedCategoryDefinition(before, { archived: archiving }, new Date().toISOString());
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
    {!before && <Choices<EntryKind> value={kind} onChange={setKind} disabled={locked}
      options={[{ value: 'expense', label: t('movement.expense') }, { value: 'income', label: t('movement.income') }]} />}
    <Field label={t('categoryManager.form.name')} value={label} onChangeText={value => { setLabel(value); setError(null); }} maxLength={60}
      autoCapitalize="sentences" autoCorrect={false} placeholder={t('categoryManager.form.namePlaceholder')} editable={!locked} />
    <IconColorPicker icons={CATEGORY_ICON_CHOICES} colors={COLOR_CHOICES} icon={icon} color={color}
      onIconChange={setIcon} onColorChange={setColor} disabled={locked} previewLabel={label} />
    {before && <AppText secondary variant="footnote">
      {t(before.archived ? 'categoryManager.form.archivedNote' : 'categoryManager.form.editNote') + ' '}
      {renamed ? t('categoryManager.form.renamedNote', { stored: before.storedLabel, shown: label.trim() || before.storedLabel }) : ''}
    </AppText>}
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
