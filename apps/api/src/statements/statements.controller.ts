import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import type { HouseholdMemberRequest } from '../auth/authenticated-request';
import { HouseholdMemberGuard } from '../household/household-member.guard';
import { HouseholdNotFoundError } from '../household/household.errors';
import {
  StatementDuplicateError,
  StatementFormatError,
  StatementNotFoundError,
  StatementTooLargeError,
} from './statement.errors';
import { parseStatementKinds, StatementsService } from './statements.service';

@Controller('statements')
@UseGuards(AuthGuard, HouseholdMemberGuard)
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async preview(
    @Req() req: HouseholdMemberRequest,
    @UploadedFile() file?: { originalname: string; buffer: Buffer },
  ) {
    if (!file) {
      throw new BadRequestException();
    }
    try {
      return await this.statementsService.preview(
        req.membership,
        file.originalname,
        file.buffer,
      );
    } catch (error) {
      this.rethrowImport(error);
    }
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importFile(
    @Req() req: HouseholdMemberRequest,
    @UploadedFile() file?: { originalname: string; buffer: Buffer },
    @Body('kinds') kinds?: unknown,
  ) {
    if (!file) {
      throw new BadRequestException();
    }
    try {
      return await this.statementsService.importFile(
        req.membership,
        file.originalname,
        file.buffer,
        parseStatementKinds(kinds),
      );
    } catch (error) {
      this.rethrowImport(error);
    }
  }

  @Get()
  async list(@Req() req: HouseholdMemberRequest) {
    try {
      return await this.statementsService.list(req.membership);
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: HouseholdMemberRequest, @Param('id') id: string) {
    try {
      await this.statementsService.remove(req.membership, id);
    } catch (error) {
      if (error instanceof StatementNotFoundError || error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  private rethrowImport(error: unknown): never {
    if (error instanceof StatementTooLargeError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof StatementDuplicateError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof StatementFormatError) {
      throw new BadRequestException();
    }
    if (error instanceof HouseholdNotFoundError) {
      throw new NotFoundException();
    }
    throw error;
  }
}
