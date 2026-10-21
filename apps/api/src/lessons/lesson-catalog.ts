export type LessonTrack = 'beginner' | 'fund';

export interface CatalogLesson {
  id: string;
  title: string;
  durationMinutes: number;
}

/** Trilha publicada em https://github.com/Tiago-Alcantara/videos-cripto */
export const CATALOG_LESSONS: CatalogLesson[] = [
  { id: 'beginner-1', title: 'O que é criptomoeda?', durationMinutes: 6 },
  { id: 'beginner-2', title: 'Blockchain: o caderno que ninguém apaga', durationMinutes: 5 },
  { id: 'beginner-3', title: 'Carteira cripto: o que é e para que serve', durationMinutes: 5 },
  { id: 'beginner-4', title: 'Chaves, endereço e frase de recuperação', durationMinutes: 5 },
  { id: 'beginner-5', title: 'Enviar e receber cripto, sem susto', durationMinutes: 5 },
  { id: 'beginner-6', title: 'Segurança: como não cair em golpes', durationMinutes: 5 },
  { id: 'fund-1', title: 'Vault da DeFindex: como o seu dinheiro rende', durationMinutes: 6 },
];

export const BEGINNER_LESSONS = CATALOG_LESSONS;
export const FUND_LESSONS = CATALOG_LESSONS;
export const ALL_LESSONS: CatalogLesson[] = CATALOG_LESSONS;

export function lessonById(id: string): CatalogLesson | undefined {
  return ALL_LESSONS.find((lesson) => lesson.id === id);
}
