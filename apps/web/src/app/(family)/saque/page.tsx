import { notFound } from 'next/navigation';
import { isFinancialProductEnabled } from '@/lib/financial-product';

export default async function FamilyWithdrawPage() {
  if (!isFinancialProductEnabled()) notFound();
  const { default: Screen } = await import('./product-screen');
  return <Screen />;
}
