import { useLocalSearchParams } from 'expo-router';
import { currentMonthISO, todayKey } from '@finanzapp/domain';
import { BudgetForm } from '../src/ui/budget-form';

export default function NewBudgetScreen() {
  const { currency, month, scope } = useLocalSearchParams<{ currency?: string; month?: string; scope?: string }>();
  return <BudgetForm currency={currency} scope={scope} monthISO={month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthISO(todayKey())} />;
}
