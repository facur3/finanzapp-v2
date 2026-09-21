import { useLocalSearchParams } from 'expo-router';
import { CategoryForm } from '../src/ui/category-form';

export default function NewCategoryScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  return <CategoryForm kind={params.kind} />;
}
