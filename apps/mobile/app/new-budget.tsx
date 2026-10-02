import { useLocalSearchParams } from 'expo-router';
import { currentMonthISO, todayKey, validMonthISO } from '@finanzapp/domain';
import { BudgetForm } from '../src/ui/budget-form';

export default function NewBudgetScreen() {
  const { currency, month, scope } = useLocalSearchParams<{ currency?: string; month?: string; scope?: string }>();
  // 24UX6E: a month the domain accepts; «2026-13» used to reach the form as its title and fail only at save.
  return <BudgetForm currency={currency} scope={scope} monthISO={month && validMonthISO(month) ? month : currentMonthISO(todayKey())} />;
}
