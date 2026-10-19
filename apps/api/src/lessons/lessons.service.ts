import { Injectable } from '@nestjs/common';
import type { LessonProgressView } from '@yield2pay/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALL_LESSONS,
  BEGINNER_LESSONS,
  FUND_LESSONS,
  lessonById,
  type CatalogLesson,
  type LessonTrack,
} from './lesson-catalog';
import { LessonNotFoundError, LessonTrackError } from './lesson.errors';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  list(track: LessonTrack): CatalogLesson[] {
    if (track === 'beginner') {
      return BEGINNER_LESSONS;
    }
    if (track === 'fund') {
      return FUND_LESSONS;
    }
    throw new LessonTrackError();
  }

  async progress(companyId: string): Promise<LessonProgressView[]> {
    const rows = await this.prisma.lessonProgress.findMany({ where: { companyId } });
    const completedByLessonId = new Map(rows.map((row) => [row.lessonId, row.completed]));
    return ALL_LESSONS.map((lesson) => ({
      lessonId: lesson.id,
      completed: completedByLessonId.get(lesson.id) ?? false,
    }));
  }

  async setCompleted(companyId: string, lessonId: string, completed: boolean): Promise<void> {
    if (!lessonById(lessonId)) {
      throw new LessonNotFoundError();
    }
    await this.prisma.lessonProgress.upsert({
      where: { companyId_lessonId: { companyId, lessonId } },
      create: { companyId, lessonId, completed },
      update: { completed },
    });
  }

  async reset(companyId: string): Promise<void> {
    await this.prisma.lessonProgress.deleteMany({ where: { companyId } });
  }
}
