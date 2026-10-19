import { LessonNotFoundError } from './lesson.errors';
import { LessonsService } from './lessons.service';

describe('LessonsService', () => {
  it('returns four beginner lessons and resets progress for the person only', async () => {
    const prisma = {
      lessonProgress: {
        findMany: vi.fn().mockResolvedValue([{ lessonId: 'beginner-1', completed: true }]),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    const svc = new LessonsService(prisma as never);
    expect(svc.list('beginner')).toHaveLength(4);
    await svc.setCompleted('co_1', 'beginner-1', true);
    await svc.reset('co_1');
    expect(prisma.lessonProgress.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'co_1' } });
  });

  it('rejects an unknown lesson id', async () => {
    const svc = new LessonsService({ lessonProgress: {} } as never);
    await expect(svc.setCompleted('co_1', 'nope', true)).rejects.toBeInstanceOf(LessonNotFoundError);
  });
});
