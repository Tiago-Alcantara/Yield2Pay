import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WithdrawService } from './withdraw.service';
import type { SubmitTxDto } from '@fixearn/shared';

@Controller('withdraw')
@UseGuards(AuthGuard)
export class WithdrawController {
  constructor(private readonly withdraws: WithdrawService) {}

  @Post('build')
  build(@Req() req: any, @Body() body: { amount: string }) {
    return this.withdraws.build(req.companyId, BigInt(body.amount));
  }

  @Post('submit')
  submit(@Req() req: any, @Body() body: SubmitTxDto) {
    return this.withdraws.submit(req.companyId, body);
  }
}
