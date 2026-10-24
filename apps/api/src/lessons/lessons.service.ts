import { Injectable } from '@nestjs/common';
import { gradeQuiz, type LessonProgressView } from '@yield2pay/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALL_LESSONS,
  BEGINNER_LESSONS,
  FUND_LESSONS,
  canonicalLessonId,
  lessonById,
  type CatalogLesson,
  type LessonTrack,
} from './lesson-catalog';
import { LessonNotFoundError, LessonQuizError, LessonTrackError } from './lesson.errors';

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
    const byLesson = new Map(rows.map((row) => [canonicalLessonId(row.lessonId), row]));
    return ALL_LESSONS.map((lesson) => {
      const row = byLesson.get(lesson.id);
      const answers = readAnswers(row?.quizAnswers);
      const quizPassed = gradeQuiz(lesson.id, answers);
      return {
        lessonId: lesson.id,
        completed: row?.completed === true && quizPassed,
        quizPassed,
        answers,
      };
    });
  }

  async setCompleted(
    companyId: string,
    lessonId: string,
    completed: boolean,
    answers?: number[],
  ): Promise<void> {
    const id = canonicalLessonId(lessonId);
    if (!lessonById(id)) {
      throw new LessonNotFoundError();
    }
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { companyId_lessonId: { companyId, lessonId: id } },
    });
    const stored = answers ?? readAnswers(existing?.quizAnswers) ?? [];
    const quizPassed = gradeQuiz(id, stored);
    if (completed && !quizPassed) {
      await this.write(companyId, id, false, false, stored);
      throw new LessonQuizError();
    }
    await this.write(companyId, id, completed && quizPassed, quizPassed, stored);
  }

  async reset(companyId: string): Promise<void> {
    await this.prisma.lessonProgress.deleteMany({ where: { companyId } });
  }

  private write(
    companyId: string,
    lessonId: string,
    completed: boolean,
    quizPassed: boolean,
    quizAnswers: number[],
  ): Promise<unknown> {
    return this.prisma.lessonProgress.upsert({
      where: { companyId_lessonId: { companyId, lessonId } },
      create: { companyId, lessonId, completed, quizPassed, quizAnswers },
      update: { completed, quizPassed, quizAnswers },
    });
  }
}

function readAnswers(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const answers = value.filter((item): item is number => Number.isInteger(item));
  return answers.length === value.length ? answers : null;
}
