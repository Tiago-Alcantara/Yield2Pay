/**
 * Módulo: lesson-quiz
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: O gabarito só passa a aula quando todas as respostas estão certas.
 * Sequência: só passa quando todas as respostas da aula estão certas.
 */
import { describe, expect, it } from 'vitest';
import { gradeQuiz } from './lesson-quiz';

describe('teste da trilha', () => {
  it('só passa quando todas as respostas da aula estão certas', () => {
    expect(gradeQuiz('beginner-2', [1, 2, 0])).toBe(true);
    expect(gradeQuiz('beginner-2', [1, 2, 1])).toBe(false);
    expect(gradeQuiz('beginner-2', [1, 2])).toBe(false);
    expect(gradeQuiz('beginner-2', null)).toBe(false);
    expect(gradeQuiz('fund-1', [0, 1, 2])).toBe(false);
  });
});
