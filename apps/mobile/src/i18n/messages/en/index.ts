import type { Messages } from '../../messages.ts';
/** US English, composed from the same modules as the Spanish catalogue. Each
 * module is typed against its Spanish namespaces, so a missing or extra key is
 * a compile error in the module that owns it. */
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
import { display } from './display.ts';
import { onboarding } from './onboarding.ts';

export const en: Messages = {
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
  ...display,
  ...onboarding,
};
