import { Redirect } from 'expo-router';
import { setPendingRoute } from '../src/lib/pendingRoute';

export default function DepositoDeepLink() {
  setPendingRoute('/(app)/deposit');
  return <Redirect href="/(app)/deposit" />;
}
