import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
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
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { HouseholdNotFoundError } from '../household/household.errors';
import {
  StatementDuplicateError,
  StatementFormatError,
  StatementNotFoundError,
  StatementTooLargeError,
} from './statement.errors';
import { StatementsService } from './statements.service';

@Controller('statements')
@UseGuards(AuthGuard)
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importFile(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: { originalname: string; buffer: Buffer },
  ) {
    if (!file) {
      throw new BadRequestException();
    }
    try {
      return await this.statementsService.importFile(
        req.companyId,
        file.originalname,
        file.buffer,
      );
    } catch (error) {
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

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    try {
      await this.statementsService.remove(req.companyId, id);
    } catch (error) {
      if (error instanceof StatementNotFoundError || error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
