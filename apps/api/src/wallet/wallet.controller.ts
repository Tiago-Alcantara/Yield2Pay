import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { WalletService } from './wallet.service';
import type { RegisterWalletDto } from '@yield2pay/shared';

@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}
  // register cria conta on-chain paga pelo sponsor (2 XLM) → trava dura.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  register(@Req() req: AuthenticatedRequest, @Body() body: RegisterWalletDto) {
    return this.walletService.register(req.companyId, body.stellarAddress);
  }

  @Get('balance')
  balance(@Req() req: AuthenticatedRequest) {
    return this.walletService.getBalance(req.companyId);
  }
}
