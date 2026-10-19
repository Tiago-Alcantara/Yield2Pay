import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { UpsertHouseholdProfile } from '@yield2pay/shared';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import {
  HouseholdConflictError,
  HouseholdForbiddenError,
  HouseholdNotFoundError,
} from './household.errors';
import { HouseholdService } from './household.service';

@Controller()
@UseGuards(AuthGuard)
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Get('account')
  getAccount(@Req() req: AuthenticatedRequest) {
    return this.householdService.getAccount(req.companyId, req.email);
  }

  @Post('households')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { name: string },
  ) {
    try {
      return await this.householdService.create(req.companyId, dto.name);
    } catch (error) {
      if (error instanceof HouseholdConflictError) {
        throw new ConflictException();
      }
      throw error;
    }
  }

  @Get('household/profile')
  async getProfile(@Req() req: AuthenticatedRequest) {
    try {
      return await this.householdService.getProfile(req.companyId);
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Put('household/profile')
  async putProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpsertHouseholdProfile,
  ) {
    try {
      return await this.householdService.putProfile(req.companyId, dto);
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Patch('household/profile')
  async patchProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: Partial<UpsertHouseholdProfile>,
  ) {
    try {
      return await this.householdService.patchProfile(req.companyId, dto);
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Post('household/profile/skip')
  async skip(@Req() req: AuthenticatedRequest) {
    try {
      return await this.householdService.skip(req.companyId);
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Get('households/current')
  async getCurrent(@Req() req: AuthenticatedRequest) {
    try {
      return await this.householdService.getCurrent(req.companyId);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('households/current/invites')
  async invite(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { email: string },
  ) {
    try {
      return await this.householdService.invite(req.companyId, dto.email);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('households/invites/:id/accept')
  async acceptInvite(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    try {
      return await this.householdService.acceptInvite(
        req.companyId,
        id,
        req.email,
      );
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('households/invites/:id/revoke')
  async revokeInvite(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    try {
      return await this.householdService.revokeInvite(req.companyId, id);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof HouseholdForbiddenError) {
      throw new ForbiddenException();
    }
    if (error instanceof HouseholdConflictError) {
      throw new ConflictException();
    }
    if (error instanceof HouseholdNotFoundError) {
      throw new NotFoundException();
    }
    throw error;
  }
}
