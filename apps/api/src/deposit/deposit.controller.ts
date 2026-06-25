import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { DepositService } from './deposit.service';
import { parseBaseUnits } from '../common/parse-money';
import type { SubmitTxDto } from '@fixearn/shared';

@Controller('deposit')
@UseGuards(AuthGuard)
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  @Post('build')
  build(@Req() req: AuthenticatedRequest, @Body() body: { amount: string }) {
    return this.depositService.build(
      req.companyId,
      parseBaseUnits(body.amount),
    );
  }

  @Post('submit')
  submit(@Req() req: AuthenticatedRequest, @Body() body: SubmitTxDto) {
    return this.depositService.submit(req.companyId, body);
  }
}
