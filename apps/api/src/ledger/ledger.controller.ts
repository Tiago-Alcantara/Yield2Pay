import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { LedgerService } from './ledger.service';
import { VaultService } from '../vault/vault.service';
import { SpendableView } from '@fixearn/shared';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly vault: VaultService,
  ) {}
  @Get()
  async dashboard(@Req() req: AuthenticatedRequest): Promise<SpendableView> {
    const [s, apyPercent] = await Promise.all([
      this.ledger.computeSpendable(req.companyId),
      this.vault.getApyPercent(),
    ]);
    return {
      vaultValue: s.vaultValue.toString(),
      principal: s.principal.toString(),
      spendable: s.spendable.toString(),
      apyPercent,
    };
  }
}
