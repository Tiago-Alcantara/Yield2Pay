import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WalletService } from './wallet.service';
import type { RegisterWalletDto } from '@fixearn/shared';

@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly wallets: WalletService) {}
  @Post()
  register(@Req() req: any, @Body() body: RegisterWalletDto) {
    return this.wallets.register(req.companyId, body.stellarAddress);
  }
}
