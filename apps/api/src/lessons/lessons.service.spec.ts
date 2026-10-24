/**
 * Módulo: lessons.service
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: A aula só conta como concluída quando o teste está certo.
 * Sequência: returns the published crypto lessons and resets progress for the person only; rejects an unknown lesson id; não conclui a aula sem o teste certo e guarda a tentativa; não conta uma conclusão antiga que não passou no teste.
 */
import { LessonNotFoundError, LessonQuizError } from './lesson.errors';
import { LessonsService } from './lessons.service';

describe('LessonsService', () => {
  it('returns the published crypto lessons and resets progress for the person only', async () => {
    const prisma = {
      lessonProgress: {
        findMany: vi.fn().mockResolvedValue([{ lessonId: 'beginner-1', completed: true, quizPassed: true, quizAnswers: [1, 0, 2] }]),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    const svc = new LessonsService(prisma as never);
    expect(svc.list('beginner').map((lesson) => lesson.id)).toEqual([
      'beginner-1', 'beginner-2', 'beginner-3', 'beginner-4', 'beginner-5', 'beginner-6',
    ]);
    expect(svc.list('beginner').map((lesson) => lesson.durationMinutes)).toEqual([5, 5, 5, 6, 6, 6]);
    expect(svc.list('fund')).toHaveLength(6);
    const progress = await svc.progress('co_1');
    expect(progress[0]).toEqual({ lessonId: 'beginner-1', completed: true, quizPassed: true, answers: [1, 0, 2] });
    expect(progress[5].lessonId).toBe('beginner-6');
    await svc.setCompleted('co_1', 'beginner-1', true, [1, 0, 2]);
    expect(prisma.lessonProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ lessonId: 'beginner-1', completed: true, quizPassed: true, quizAnswers: [1, 0, 2] }),
    }));
    await svc.reset('co_1');
    expect(prisma.lessonProgress.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'co_1' } });
  });

  it('rejects an unknown lesson id', async () => {
    const svc = new LessonsService({ lessonProgress: {} } as never);
    await expect(svc.setCompleted('co_1', 'nope', true)).rejects.toBeInstanceOf(LessonNotFoundError);
  });

  it('não conclui a aula sem o teste certo e guarda a tentativa', async () => {
    const upsert = vi.fn();
    const svc = new LessonsService({
      lessonProgress: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert,
      },
    } as never);
    await expect(svc.setCompleted('co_1', 'beginner-6', true, [0, 0, 0])).rejects.toBeInstanceOf(LessonQuizError);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ lessonId: 'beginner-6', completed: false, quizPassed: false, quizAnswers: [0, 0, 0] }),
    }));
    await svc.setCompleted('co_1', 'beginner-6', true, [2, 0, 1]);
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      create: expect.objectContaining({ lessonId: 'beginner-6', completed: true, quizPassed: true }),
    }));
  });

  it('não conta uma conclusão antiga que não passou no teste', async () => {
    const svc = new LessonsService({
      lessonProgress: {
        findMany: vi.fn().mockResolvedValue([
          { lessonId: 'beginner-6', completed: true, quizPassed: false, quizAnswers: null },
        ]),
      },
    } as never);
    const progress = await svc.progress('co_1');
    expect(progress.find((row) => row.lessonId === 'beginner-6')).toEqual({
      lessonId: 'beginner-6',
      completed: false,
      quizPassed: false,
      answers: null,
    });
  });
});
