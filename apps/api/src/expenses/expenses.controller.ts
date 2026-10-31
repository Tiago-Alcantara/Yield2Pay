import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ExpenseCategory } from '@yield2pay/shared';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { HouseholdNotFoundError } from '../household/household.errors';
import { ExpenseInvalidError, ExpenseNotFoundError } from './expense.errors';
import { ExpensesService } from './expenses.service';
import { parseExpensePage } from './page-query';

@Controller('expenses')
@UseGuards(AuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body()
    dto: {
      merchant?: string;
      amountCents?: number;
      spentOn?: string;
      category?: ExpenseCategory;
    },
  ) {
    try {
      return await this.expensesService.create(req.companyId, dto);
    } catch (error) {
      if (error instanceof ExpenseInvalidError) {
        throw new BadRequestException();
      }
      this.rethrow(error);
    }
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('month') month: string,
    @Query('category') category?: ExpenseCategory,
    @Query('limit') limit?: string | string[],
    @Query('offset') offset?: string | string[],
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string | string[],
  ) {
    try {
      return await this.expensesService.list(
        req.companyId,
        month,
        category,
        parseExpensePage({ limit, offset, cursor }),
        from || to ? { from: from ?? '', to: to ?? '' } : undefined,
      );
    } catch (error) {
      if (error instanceof ExpenseInvalidError) {
        throw new BadRequestException(error.message);
      }
      this.rethrow(error);
    }
  }

  @Get('months')
  async months(@Req() req: AuthenticatedRequest) {
    try {
      return await this.expensesService.months(req.companyId);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Patch(':id')
  async patch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: { category?: ExpenseCategory; fixed?: boolean },
  ) {
    try {
      return await this.expensesService.patch(req.companyId, id, dto);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    try {
      await this.expensesService.remove(req.companyId, id);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof ExpenseNotFoundError) {
      throw new NotFoundException();
    }
    if (error instanceof HouseholdNotFoundError) {
      throw new NotFoundException();
    }
    throw error;
  }
}
