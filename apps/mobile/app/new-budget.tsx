import { useLocalSearchParams } from 'expo-router';
import { currentMonthISO, todayKey } from '@finanzapp/domain';
import { BudgetForm } from '../src/ui/budget-form';

export default function NewBudgetScreen() {
  const { currency, month } = useLocalSearchParams<{ currency?: string; month?: string }>();
  return <BudgetForm currency={currency} monthISO={month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthISO(todayKey())} />;
}
