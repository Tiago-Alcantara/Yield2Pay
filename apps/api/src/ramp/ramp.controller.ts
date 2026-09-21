import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';
import { assertSandboxEnabled } from '../common/assert-sandbox';
import { RampService } from './ramp.service';

@Controller('ramp')
@UseGuards(AuthGuard)
export class RampController {
  constructor(
    private readonly ramp: RampService,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  @Get('status')
  getStatus(@Req() req: AuthenticatedRequest) {
    return this.ramp.getStatus(req.companyId);
  }

  @Post('setup')
  startOnboarding(
    @Req() req: AuthenticatedRequest,
    @Body() body: { email: string; displayName: string },
  ) {
    return this.ramp.startOnboarding(req.companyId, body.email, body.displayName);
  }

  @Post('kyc-approved')
  async markKycApproved(@Req() req: AuthenticatedRequest) {
    assertSandboxEnabled(this.config.appEnv);
    return this.ramp.markKycApproved(req.companyId);
  }

  @Get('assets')
  listAssets(@Req() req: AuthenticatedRequest) {
    return this.ramp.listAssets(req.companyId);
  }

  @Post('onramp/start')
  startOnramp(
    @Req() req: AuthenticatedRequest,
    @Body() body: { amountFiat?: string; amountMxn?: string },
  ) {
    const amount = body.amountFiat ?? body.amountMxn ?? '0';
    return this.ramp.startOnramp(req.companyId, amount);
  }

  @Post('onramp/simulate')
  async simulateFiatReceived(
    @Req() req: AuthenticatedRequest,
    @Body() body: { orderId: string },
  ) {
    assertSandboxEnabled(this.config.appEnv);
    return this.ramp.simulateFiatReceived(req.companyId, body.orderId);
  }

  @Post('offramp/start')
  startOfframp(
    @Req() req: AuthenticatedRequest,
    @Body() body: { amountToken: string },
  ) {
    return this.ramp.startOfframp(req.companyId, body.amountToken);
  }

  @Get('orders')
  listOrders(@Req() req: AuthenticatedRequest) {
    return this.ramp.listOrders(req.companyId);
  }

  @Get('order/:orderId')
  getOrderStatus(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.ramp.getOrderStatus(req.companyId, orderId);
  }

  @Get('order/:orderId/claim')
  getOrderClaim(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.ramp.getOrderClaim(req.companyId, orderId);
  }

  @Post('order/:orderId/claim')
  submitOrderClaim(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: { xdr: string; signatureHex: string; stellarAddress: string },
  ) {
    return this.ramp.submitOrderClaim(req.companyId, orderId, body);
  }

  @Get('order/:orderId/burn')
  getOrderBurn(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.ramp.getOrderBurn(req.companyId, orderId);
  }

  @Post('order/:orderId/burn')
  submitOrderBurn(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: { xdr: string; signatureHex: string; stellarAddress: string },
  ) {
    return this.ramp.submitOrderBurn(req.companyId, orderId, body);
  }
}
