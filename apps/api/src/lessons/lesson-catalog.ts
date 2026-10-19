export type LessonTrack = 'beginner' | 'fund';

export interface CatalogLesson {
  id: string;
  title: string;
  durationMinutes: number;
}

export const BEGINNER_LESSONS: CatalogLesson[] = [
  { id: 'beginner-1', title: 'O que é uma carteira', durationMinutes: 4 },
  { id: 'beginner-2', title: 'Custódia das suas chaves', durationMinutes: 5 },
  { id: 'beginner-3', title: 'O que é um cofre', durationMinutes: 6 },
  { id: 'beginner-4', title: 'Por que o rendimento não é gasto', durationMinutes: 4 },
];

export const FUND_LESSONS: CatalogLesson[] = [
  { id: 'fund-1', title: 'O que muda no fundo', durationMinutes: 5 },
  { id: 'fund-2', title: 'Risco e prazo', durationMinutes: 6 },
  { id: 'fund-3', title: 'Como o aporte entra', durationMinutes: 5 },
  { id: 'fund-4', title: 'Como o resgate sai', durationMinutes: 4 },
];

export const ALL_LESSONS: CatalogLesson[] = [...BEGINNER_LESSONS, ...FUND_LESSONS];

export function lessonById(id: string): CatalogLesson | undefined {
  return ALL_LESSONS.find((lesson) => lesson.id === id);
}
