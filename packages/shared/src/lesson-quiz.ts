/** Gabarito da trilha Cripto do zero. A aula só conta se todas as respostas estiverem certas. */
export const LESSON_QUIZ_ANSWERS: Record<string, readonly number[]> = {
  'beginner-1': [1, 0, 2],
  'beginner-2': [1, 2, 0],
  'beginner-3': [1, 2, 0],
  'beginner-4': [0, 1, 2],
  'beginner-5': [1, 2, 0],
  'beginner-6': [2, 0, 1],
};

export function gradeQuiz(lessonId: string, answers: readonly number[] | null | undefined): boolean {
  const key = LESSON_QUIZ_ANSWERS[lessonId];
  if (!key) return false;
  if (!answers || answers.length !== key.length) return false;
  return key.every((expected, index) => answers[index] === expected);
}
