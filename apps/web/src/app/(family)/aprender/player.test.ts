/**
 * Módulo: player
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: O player avança, volta e marca o ponto da aula.
 * Sequência: formata o relógio e avança a cena a cada 8 segundos; preenche o segmento da cena atual e salta para o início dela; guarda a posição assistida e aponta a próxima aula em aberto.
 */
import { describe, expect, it } from 'vitest';
import {
  aprenderPath,
  firstOpenIndex,
  missingLessonMessage,
  openingLessonIndex,
  formatClock,
  lessonDuration,
  nextSpeed,
  readPlayback,
  sceneIndex,
  seekTime,
  segmentFill,
  writePlayback,
} from './player';

describe('player das aulas', () => {
  it('formata o relógio e avança a cena a cada 8 segundos', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(lessonDuration(6)).toBe(48);
    expect(sceneIndex(0, 6)).toBe(0);
    expect(sceneIndex(16, 6)).toBe(2);
    expect(sceneIndex(48, 6)).toBe(5);
  });

  it('preenche o segmento da cena atual e salta para o início dela', () => {
    expect(segmentFill(4, 0, 6)).toBe(50);
    expect(segmentFill(4, 1, 6)).toBe(0);
    expect(segmentFill(16, 0, 6)).toBe(100);
    expect(segmentFill(48, 5, 6)).toBe(100);
    expect(seekTime(2, 6)).toBe(16.001);
    expect(seekTime(-1, 6)).toBe(0.001);
  });

  it('guarda a posição assistida e aponta a próxima aula em aberto', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    writePlayback(storage, { li: 1, pos: [0, 12, 0, 0] });
    expect(readPlayback(storage, 4)).toEqual({ li: 1, pos: [0, 12, 0, 0] });
    expect(firstOpenIndex([true, false, false, false])).toBe(1);
    expect(firstOpenIndex([true, true, true, true])).toBe(0);
    expect(nextSpeed(1)).toBe(1.25);
    expect(nextSpeed(2)).toBe(1);
    expect(aprenderPath(3)).toBe('/aprender?aula=3');
    expect(openingLessonIndex('4', 7, [false, false, false, false, false, false, true])).toBe(3);
    expect(openingLessonIndex(null, 7, [true, true, false, false, false, false, false])).toBe(2);
    expect(openingLessonIndex('9', 7, [false])).toBe(0);
    expect(missingLessonMessage([])).toBeNull();
    expect(missingLessonMessage([3])).toBe('Ainda falta a aula 3. O investimento só libera quando todas estiverem concluídas com o teste certo.');
    expect(missingLessonMessage([1, 2, 4])).toBe('Ainda faltam as aulas 1, 2 e 4. O investimento só libera quando todas estiverem concluídas com o teste certo.');
  });
});
