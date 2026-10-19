import { Suspense } from 'react';
import AulaCripto from './AulaCripto';

export default function AprenderPage() {
  return (
    <Suspense fallback={null}>
      <AulaCripto />
    </Suspense>
  );
}
