import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { VenueService } from './venue.service';
import type { ChainId } from '@yield2pay/venue-core';

@Controller('account')
@UseGuards(AuthGuard)
export class AccountChainController {
  constructor(private readonly venues: VenueService) {}

  @Get('chain')
  get(@Req() req: AuthenticatedRequest) {
    return this.venues.getAccountChains(req.companyId);
  }

  @Post('chain')
  post(
    @Req() req: AuthenticatedRequest,
    @Body() body: { action: 'unlock' | 'select'; chainId: ChainId },
  ) {
    if (body.action === 'unlock') {
      return this.venues.unlock(req.companyId, body.chainId);
    }
    if (body.action === 'select') {
      return this.venues.select(req.companyId, body.chainId);
    }
    return this.venues.getAccountChains(req.companyId);
  }
}
