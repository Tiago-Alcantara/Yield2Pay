export type LessonTrack = 'beginner' | 'fund';

export interface CatalogLesson {
  id: string;
  title: string;
  durationMinutes: number;
}

/** Minutos de leitura publicados no texto de cada aula. */
export const CATALOG_LESSONS: CatalogLesson[] = [
  { id: 'beginner-1', title: 'O que é criptomoeda?', durationMinutes: 5 },
  { id: 'beginner-2', title: 'Blockchain: o caderno que ninguém apaga', durationMinutes: 5 },
  { id: 'beginner-3', title: 'Carteira cripto: o que é e para que serve', durationMinutes: 5 },
  { id: 'beginner-4', title: 'Chaves, endereço e frase de recuperação', durationMinutes: 6 },
  { id: 'beginner-5', title: 'Enviar e receber cripto, sem susto', durationMinutes: 6 },
  { id: 'beginner-6', title: 'Segurança: como não cair em golpes', durationMinutes: 6 },
];

/** A aula do produto financeiro saiu do catálogo. Ids antigos não são reescritos. */
export function canonicalLessonId(id: string): string {
  return id;
}

export const BEGINNER_LESSONS = CATALOG_LESSONS;
export const FUND_LESSONS = CATALOG_LESSONS;
export const ALL_LESSONS: CatalogLesson[] = CATALOG_LESSONS;

export function lessonById(id: string): CatalogLesson | undefined {
  const canonical = canonicalLessonId(id);
  return ALL_LESSONS.find((lesson) => lesson.id === canonical);
}
