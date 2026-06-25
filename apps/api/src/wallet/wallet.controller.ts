import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { WalletService } from './wallet.service';
import type { RegisterWalletDto } from '@fixearn/shared';

@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}
  @Post()
  register(@Req() req: AuthenticatedRequest, @Body() body: RegisterWalletDto) {
    return this.walletService.register(req.companyId, body.stellarAddress);
  }
}
