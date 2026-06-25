import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { WithdrawService } from './withdraw.service';
import { parseBaseUnits } from '../common/parse-money';
import type { SubmitTxDto } from '@fixearn/shared';

@Controller('withdraw')
@UseGuards(AuthGuard)
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  @Post('build')
  build(@Req() req: AuthenticatedRequest, @Body() body: { amount: string }) {
    return this.withdrawService.build(
      req.companyId,
      parseBaseUnits(body.amount),
    );
  }

  @Post('submit')
  submit(@Req() req: AuthenticatedRequest, @Body() body: SubmitTxDto) {
    return this.withdrawService.submit(req.companyId, body);
  }
}
