import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { WithdrawService } from './withdraw.service';
import { parseBaseUnits } from '../common/parse-money';
import type { SubmitTxDto } from '@yield2pay/shared';

@Controller('withdraw')
@UseGuards(AuthGuard)
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('build')
  build(@Req() req: AuthenticatedRequest, @Body() body: { amount: string }) {
    return this.withdrawService.build(
      req.companyId,
      parseBaseUnits(body.amount),
    );
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('submit')
  submit(@Req() req: AuthenticatedRequest, @Body() body: SubmitTxDto) {
    return this.withdrawService.submit(req.companyId, body);
  }
}
