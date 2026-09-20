import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { BudgetForm } from '../../src/ui/budget-form';
import { EmptyState, Screen } from '../../src/ui/components';

export default function EditBudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const budget = archive?.budgets?.find(item => item.id === id && item.active);
  if (!budget) return <Screen><EmptyState title="No encontramos este presupuesto"
    detail="Volvé a Presupuestos para elegir uno activo guardado en este dispositivo." icon="speedometer-outline" /></Screen>;
  return <BudgetForm original={budget} monthISO={budget.monthISO} />;
}
