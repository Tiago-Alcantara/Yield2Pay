import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { LessonNotFoundError, LessonQuizError, LessonTrackError } from './lesson.errors';
import type { LessonTrack } from './lesson-catalog';
import { LessonsService } from './lessons.service';

@Controller()
@UseGuards(AuthGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get('lessons')
  list(@Query('track') track: string) {
    try {
      return this.lessonsService.list(track as LessonTrack);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Get('lesson-progress')
  progress(@Req() req: AuthenticatedRequest) {
    return this.lessonsService.progress(req.companyId);
  }

  @Put('lesson-progress/:id')
  async setCompleted(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { completed?: boolean; answers?: number[] },
  ) {
    if (typeof body?.completed !== 'boolean' || (body.answers != null && !answersOf(body.answers))) {
      throw new BadRequestException();
    }
    try {
      await this.lessonsService.setCompleted(req.companyId, id, body.completed, body.answers);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete('lesson-progress')
  @HttpCode(204)
  reset(@Req() req: AuthenticatedRequest) {
    return this.lessonsService.reset(req.companyId);
  }

  private rethrow(error: unknown): never {
    if (error instanceof LessonTrackError) {
      throw new BadRequestException();
    }
    if (error instanceof LessonNotFoundError) {
      throw new NotFoundException();
    }
    if (error instanceof LessonQuizError) {
      throw new BadRequestException('Acerte o teste da aula para concluí-la');
    }
    throw error;
  }
}

function answersOf(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}
