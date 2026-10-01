import { Redirect } from 'expo-router';
import { setPendingRoute } from '../src/lib/pendingRoute';

export default function SaqueDeepLink() {
  setPendingRoute('/(app)/withdraw');
  return <Redirect href="/(app)/withdraw" />;
}
