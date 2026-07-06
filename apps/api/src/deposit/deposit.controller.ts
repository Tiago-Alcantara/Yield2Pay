import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { DepositService } from './deposit.service';
import { parseBaseUnits } from '../common/parse-money';
import type { SubmitTxDto } from '@yield2pay/shared';

@Controller('deposit')
@UseGuards(AuthGuard)
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  // fund paga XLM do sponsor → o mais caro. Trava dura por IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('fund')
  fund(@Req() req: AuthenticatedRequest, @Body() body: { amount: string }) {
    return this.depositService.fund(
      req.companyId,
      parseBaseUnits(body.amount),
    );
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('build')
  build(@Req() req: AuthenticatedRequest, @Body() body: { amount: string }) {
    return this.depositService.build(
      req.companyId,
      parseBaseUnits(body.amount),
    );
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('submit')
  submit(@Req() req: AuthenticatedRequest, @Body() body: SubmitTxDto) {
    return this.depositService.submit(req.companyId, body);
  }
}
