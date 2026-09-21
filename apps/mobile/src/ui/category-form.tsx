import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { categoryNameTaken, editedCategoryDefinition, newCategoryDefinition, sameCategoryDefinition, validateCategoryDefinition,
  type CategoryDefinition, type CategoryIdentity, type EntryKind } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { CATEGORY_ICON_CHOICES, COLOR_CHOICES } from './appearance';
import { IconColorPicker } from './appearance-picker';
import { ActionButton, AppText, Choices, ErrorMessage, Field, IconButton, Screen } from './components';
import { space } from './theme';

/** Create a custom category, or edit how an existing one looks. Editing changes
 * the display name, icon and colour of an identity; the string movements carry
 * (`storedLabel`) never changes, so history, budgets, rules and reports keep
 * grouping exactly as before. Archiving hides the category from new choices
 * and keeps every historical movement readable. */
export function CategoryForm({ original, kind: requestedKind }: { original?: CategoryIdentity; kind?: string }) {
  const { archive, saveCategory } = useLedger();
  const definitions = archive?.categories ?? [];
  const [before] = useState(original);
  const [kind, setKind] = useState<EntryKind>(before?.kind ?? (requestedKind === 'income' ? 'income' : 'expense'));
  const [label, setLabel] = useState(before?.label ?? '');
  const [icon, setIcon] = useState(before?.icon ?? 'other');
  const [color, setColor] = useState(before?.color ?? 'graphite');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CategoryDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false), confirming = useRef(false);
  const locked = busy || pending !== null;
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
      setError(cause instanceof Error ? cause.message : 'No pudimos verificar el guardado. Reintentá el mismo cambio.');
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
        definition = editedCategoryDefinition(before, { label, icon, color }, now);
        if (before.definition && sameCategoryDefinition(before.definition, { ...definition, revision: before.definition.revision, updatedAt: before.definition.updatedAt })) { close(); return; }
        if (!before.definition && label.trim() === before.label && icon === before.icon && color === before.color) { close(); return; }
      } else {
        if (categoryNameTaken(kind, label, definitions)) throw new Error('Ya existe una categoría con ese nombre. Editala desde la lista o elegí otro nombre.');
        definition = newCategoryDefinition(kind, label, icon, color, now);
      }
      validateCategoryDefinition(definition);
      void apply(definition);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisá el nombre.'); }
  }
  function toggleArchive() {
    if (!before || saving.current || confirming.current) return;
    confirming.current = true;
    const archiving = !before.archived;
    const definition = editedCategoryDefinition(before, { archived: archiving }, new Date().toISOString());
    Alert.alert(archiving ? '¿Archivar categoría?' : '¿Desarchivar categoría?', archiving
      ? `«${before.label}» dejará de ofrecerse al registrar. Tus movimientos, presupuestos y recurrentes anteriores la conservan tal cual.`
      : `«${before.label}» volverá a ofrecerse al registrar movimientos.`, [
      { text: 'Cancelar', style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: archiving ? 'Archivar' : 'Desarchivar', style: archiving ? 'destructive' : 'default', onPress: () => { confirming.current = false; void apply(definition); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }
  const renamed = !!before && label.trim() !== before.storedLabel;
  return <Screen gap={space.l}>
    <Stack.Screen options={{ title: before ? 'Editar categoría' : 'Nueva categoría', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    {!before && <Choices<EntryKind> value={kind} onChange={setKind} disabled={locked}
      options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]} />}
    <Field label="Nombre" value={label} onChangeText={value => { setLabel(value); setError(null); }} maxLength={60}
      autoCapitalize="sentences" autoCorrect={false} placeholder="Ej. Kiosco" editable={!locked} />
    <IconColorPicker icons={CATEGORY_ICON_CHOICES} colors={COLOR_CHOICES} icon={icon} color={color}
      onIconChange={setIcon} onColorChange={setColor} disabled={locked} previewLabel={label} />
    {before && <AppText secondary variant="footnote">
      {before.archived ? 'Archivada: no se ofrece al registrar; tus movimientos anteriores la conservan. '
        : 'Cambiar el nombre, el ícono o el color no modifica ningún movimiento, presupuesto ni recurrente. '}
      {renamed ? `Los movimientos se siguen registrando como «${before.storedLabel}» y se muestran como «${label.trim() || before.storedLabel}».` : ''}
    </AppText>}
    {!before && <AppText secondary variant="footnote">Quedará disponible enseguida al registrar {kind === 'expense' ? 'gastos' : 'ingresos'}.</AppText>}
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary variant="footnote">Reintentá el mismo guardado. Para cambiarlo, cerrá y revisá primero la lista.</AppText>}
    <View style={{ gap: 10 }}>
      <ActionButton label={pending && error ? 'Reintentar guardado' : before ? 'Guardar cambios' : 'Crear categoría'} onPress={save} busy={busy} disabled={!label.trim()} />
      {before && <ActionButton label={before.archived ? 'Desarchivar categoría' : 'Archivar categoría'} icon={before.archived ? 'arrow-redo-outline' : 'archive-outline'}
        secondary onPress={toggleArchive} disabled={locked} />}
    </View>
  </Screen>;
}
