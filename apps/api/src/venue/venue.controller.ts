import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { VenueService } from './venue.service';

@Controller('venues')
@UseGuards(AuthGuard)
export class VenueController {
  constructor(private readonly venues: VenueService) {}

  @Get()
  list() {
    return this.venues.list();
  }

  @Post(':chain/:protocol/deposit/build')
  buildDeposit(
    @Req() req: AuthenticatedRequest,
    @Param('chain') chain: string,
    @Param('protocol') protocol: string,
    @Body() body: { amount: string },
  ) {
    return this.venues.buildDeposit(req.companyId, chain, protocol, body.amount);
  }

  @Post(':chain/:protocol/deposit/submit')
  submitDeposit(
    @Req() req: AuthenticatedRequest,
    @Param('chain') chain: string,
    @Param('protocol') protocol: string,
    @Body() body: Record<string, string | undefined>,
  ) {
    return this.venues.submitDeposit(req.companyId, chain, protocol, {
      amount: body.amount ?? '',
      xdr: body.xdr,
      signatureHex: body.signatureHex,
      stellarAddress: body.stellarAddress,
      address: body.address,
      signedTransactionBase64: body.signedTransactionBase64,
    });
  }

  @Post(':chain/:protocol/withdraw/build')
  buildWithdraw(
    @Req() req: AuthenticatedRequest,
    @Param('chain') chain: string,
    @Param('protocol') protocol: string,
    @Body() body: { amount: string },
  ) {
    return this.venues.buildWithdraw(
      req.companyId,
      chain,
      protocol,
      body.amount,
    );
  }

  @Post(':chain/:protocol/withdraw/submit')
  submitWithdraw(
    @Req() req: AuthenticatedRequest,
    @Param('chain') chain: string,
    @Param('protocol') protocol: string,
    @Body() body: Record<string, string | undefined>,
  ) {
    return this.venues.submitWithdraw(req.companyId, chain, protocol, {
      amount: body.amount ?? '',
      xdr: body.xdr,
      signatureHex: body.signatureHex,
      stellarAddress: body.stellarAddress,
      address: body.address,
      signedTransactionBase64: body.signedTransactionBase64,
    });
  }
}
