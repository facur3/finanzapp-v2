# Producto 20 — Personalization: custom categories and account identity

Date: 2026-09-21. Status: implemented on `feat/mobile-producto-20-personalization`.
Scope: `apps/mobile` and `packages/domain`. Not a redesign; Interfaz 17 stays.

## Category identity model

`Entry.category` remains a free string. Reports, budgets, recurring rules and
backups keep grouping by `categoryKey(string)` (case, accents and spacing folded).
Presentation is layered on that key, never rewritten under it.

- Identity = `(kind, key)`. Kind-scoped because "Regalos" as expense and as
  income are different things.
- **Preset**: built-in identity in code (`CATEGORY_PRESETS`) with label, icon and
  colour. Nothing is seeded into SQLite or a backup.
- **Definition** (`category_definitions` row): decorates one identity with `label`
  (display), `icon`, `color`, `archived`, and `storedLabel`, the exact string new
  movements record. `storedLabel` is fixed at creation and `key ===
  categoryKey(storedLabel)`, so renaming only changes `label`. "Comida" renamed to
  "Alimentación" still records "Comida"; old and new movements resolve to one
  identity and no report group splits.
- **Historical**: a string with no definition and no preset (e.g. "sjsjn", "JD").
  Rendered as stored, with a deterministic synonym glyph and a hash/first-use hue.
  Can be dressed or archived, which creates a definition with the recorded spelling.
- Archive hides an identity from new choices; the current value of a movement being
  edited stays selectable; history, budgets and rules keep resolving. No hard delete.
- Collection rule: unique identity; within a kind, no display name may read as
  another definition's name, another definition's key or a preset key.

Rejected: a `categoryId` on entries (bulk rewrite, risky, unnecessary) and an alias
list per definition (grouping would need definitions inside the domain reports).

## Account appearance

`AccountAppearance { accountId, icon, color, createdAt, revision, updatedAt }` is a
profile beside the account, like cards and debts. The `accounts` row, `sameAccount`,
the audit receipt and the backup `accounts` array are untouched. No row means the
default look (wallet on cobalt), so existing accounts migrate by reading. Created
with the account or upserted alone; a name/balance correction and a look change go
through one commit when both change. Cards and debts never get a look.

## Shared foundation

- Domain `appearance.ts`: eleven colours (id, Spanish name, light/dark hex), twelve
  account icon ids, 37 category icon ids, validators, `accountLook`.
- Mobile `appearance.ts`: id → Ionicons glyph, id → hex per theme, historical
  synonym glyphs, `resolveCategoryLook` / `resolveAccountLook` (pure, tested).
- `category-hues.tsx` provides definitions, looks and the fallback hue map to hooks:
  `useCategoryLook`, `useCategoryLabel`, `useCategoryLookOf`, `useAccountLook(Of)`.
- `appearance-picker.tsx`: one `IconColorPicker` for accounts and categories.

## Storage and backup

- Schema 8: `account_appearances` (PK accountId, FK accounts) and
  `category_definitions` (PK kind, key). Additive, no rows, one exclusive
  transaction, idempotent, interruption-safe.
- Backup `finanzapp.native-pilot.v8`: adds `appearances` and `categories`. v1–v7
  files import without them; a v7 file cannot carry them. Import is additive by
  account / identity; a differing row is a conflict.

## Surfaces

Accounts: Cuentas, account detail, `AccountField` card and sheet (entry, transfer,
recurring), movement and transfer detail rows. Categories: display name through the
identity everywhere; Más → Categorías manages (create, edit, archive). Más → Finanzas
rows carry a tinted tile each; App y datos stays neutral. Assistant untouched.

## Tests

Domain (vitest), storage (Node SQLite), UI harnesses (appearance glyphs/contrast,
categories helpers, Más/categories screens, account forms, category form,
selectors, picker). Device checks listed in `docs/mobile-device-checklist.md`.
