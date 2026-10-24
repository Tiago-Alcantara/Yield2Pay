import { Suspense } from 'react';
import AulaCripto from './AulaCripto';
import { EducationNotice } from '../_components/EducationNotice';

export default function AprenderPage() {
  return (
    <Suspense fallback={null}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 20px 0' }}>
        <EducationNotice />
      </div>
      <AulaCripto />
    </Suspense>
  );
}
