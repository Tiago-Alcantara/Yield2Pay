import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { HouseholdMemberRequest } from '../auth/authenticated-request';
import { HouseholdMemberGuard } from '../household/household-member.guard';
import { HouseholdWalletService } from './household-wallet.service';
import {
  WalletAccountNotFoundError,
  WalletDuplicateError,
  WalletForbiddenError,
  WalletInvalidError,
  WalletNotFoundError,
  WalletUpstreamError,
} from './wallet.errors';

/** O endereço só entra no corpo do POST: a URL vai para o log. */
@Controller('household-wallets')
@UseGuards(AuthGuard, HouseholdMemberGuard)
export class HouseholdWalletController {
  constructor(private readonly wallets: HouseholdWalletService) {}

  @Get()
  async list(@Req() req: HouseholdMemberRequest) {
    return this.wallets.list(req.membership);
  }

  @Post()
  async add(
    @Req() req: HouseholdMemberRequest,
    @Body() body: { address?: unknown; label?: unknown; network?: unknown },
  ) {
    try {
      return await this.wallets.add(req.membership, body);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('sync')
  @HttpCode(200)
  async sync(@Req() req: HouseholdMemberRequest) {
    return this.wallets.syncAll(req.membership);
  }

  @Get('movements')
  async movements(
    @Req() req: HouseholdMemberRequest,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    try {
      return await this.wallets.movements(req.membership, { month, from, to });
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Patch('movements/:id')
  @HttpCode(204)
  async markOwnTransfer(
    @Req() req: HouseholdMemberRequest,
    @Param('id') id: string,
    @Body() body: { ownTransfer?: unknown },
  ) {
    try {
      await this.wallets.markOwnTransfer(req.membership, id, body);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Patch(':id')
  async rename(
    @Req() req: HouseholdMemberRequest,
    @Param('id') id: string,
    @Body() body: { label?: unknown },
  ) {
    try {
      return await this.wallets.rename(req.membership, id, body);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: HouseholdMemberRequest, @Param('id') id: string) {
    try {
      await this.wallets.remove(req.membership, id);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof WalletInvalidError) {
      throw new BadRequestException(error.message);
    }
    if (
      error instanceof WalletAccountNotFoundError ||
      error instanceof WalletNotFoundError
    ) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof WalletDuplicateError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof WalletForbiddenError) {
      throw new ForbiddenException(error.message);
    }
    if (error instanceof WalletUpstreamError) {
      throw new ServiceUnavailableException(error.message);
    }
    throw error;
  }
}
