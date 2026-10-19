import {
  BadRequestException,
  Controller,
  NotFoundException,
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
import { StatementFormatError } from './statement.errors';
import { StatementsService } from './statements.service';

@Controller('statements')
@UseGuards(AuthGuard)
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
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
      if (error instanceof StatementFormatError) {
        throw new BadRequestException();
      }
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
