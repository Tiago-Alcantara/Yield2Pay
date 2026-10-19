import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { HouseholdNotFoundError } from '../household/household.errors';
import { SummaryService } from './summary.service';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

@Controller('household')
@UseGuards(AuthGuard)
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get('summary')
  async summary(
    @Req() req: AuthenticatedRequest,
    @Query('month') month?: string,
  ) {
    if (month === undefined || month === '') {
      throw new BadRequestException('month is required');
    }
    if (!MONTH.test(month)) {
      throw new BadRequestException('month is invalid');
    }
    try {
      return await this.summaryService.summary(req.companyId, month);
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
