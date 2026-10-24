import { C } from '../_lib/familyTheme';

export const EDUCATION_NOTICE =
  'Conteúdo educativo. Não é recomendação de investimento. A Yield2Pay não oferece produtos de investimento nesta versão.';

export function EducationNotice() {
  return (
    <p
      role="note"
      style={{
        margin: '0 0 20px',
        padding: '12px 14px',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        background: C.card,
        color: C.text2,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {EDUCATION_NOTICE}
    </p>
  );
}
