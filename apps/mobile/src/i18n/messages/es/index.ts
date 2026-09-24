/** The reference catalogue, in the product's Argentine Spanish, composed from
 * one module per functional area. Every key exists here first. Values may carry
 * `{name}` placeholders; a plural entry is `{ one, other }` (plus any other CLDR
 * category a language needs) and receives `{count}`. Keys name the place and the
 * meaning, never the wording, so a copy change never renames a key. A module
 * owns its top-level namespaces; two modules never share one. */
import { common } from './common.ts';
import { navigation } from './navigation.ts';
import { home } from './home.ts';
import { activity } from './activity.ts';
import { forms } from './forms.ts';
import { categories } from './categories.ts';
import { preferences } from './preferences.ts';
import { errors } from './errors.ts';
import { reports } from './reports.ts';
import { cards } from './cards.ts';
import { debts } from './debts.ts';
import { accounts } from './accounts.ts';
import { budgets } from './budgets.ts';
import { recurring } from './recurring.ts';
import { categoryManager } from './category-manager.ts';
import { backup } from './backup.ts';
import { settings } from './settings.ts';
import { assistant } from './assistant.ts';

export const es = {
  ...common,
  ...navigation,
  ...home,
  ...activity,
  ...forms,
  ...categories,
  ...preferences,
  ...errors,
  ...reports,
  ...cards,
  ...debts,
  ...accounts,
  ...budgets,
  ...recurring,
  ...categoryManager,
  ...backup,
  ...settings,
  ...assistant,
} as const;
