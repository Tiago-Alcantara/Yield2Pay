import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
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
import type { CompleteOnboarding, PatchHouseholdProfile, UpsertHouseholdProfile } from '@yield2pay/shared';
import { AuthGuard } from '../auth/auth.guard';
import type {
  AuthenticatedRequest,
  HouseholdMemberRequest,
} from '../auth/authenticated-request';
import { readRequestedHouseholdId } from './active-household';
import { HouseholdMemberGuard } from './household-member.guard';
import {
  HouseholdConflictError,
  HouseholdForbiddenError,
  HouseholdInvalidError,
  HouseholdNotFoundError,
} from './household.errors';
import { HouseholdService, readDisplayNamePatch } from './household.service';

@Controller()
@UseGuards(AuthGuard)
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Get('account')
  async getAccount(@Req() req: AuthenticatedRequest) {
    try {
      return await this.householdService.getAccount(
        req.companyId,
        req.email,
        readRequestedHouseholdId(req.headers),
      );
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Patch('account')
  async patchAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: unknown,
  ) {
    try {
      return await this.householdService.updateDisplayName(
        req.companyId,
        readDisplayNamePatch(dto),
        req.email,
        readRequestedHouseholdId(req.headers),
      );
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('account/data')
  @UseGuards(HouseholdMemberGuard)
  async clearData(
    @Req() req: HouseholdMemberRequest,
    @Body() dto: { mode?: 'expenses' | 'all' },
  ) {
    try {
      const mode = dto.mode === 'all' ? 'all' : 'expenses';
      return await this.householdService.clearMyData(req.membership, mode);
    } catch (error) {
      this.rethrow(error);
    }
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
  @UseGuards(HouseholdMemberGuard)
  async getProfile(@Req() req: HouseholdMemberRequest) {
    try {
      return await this.householdService.getProfile(req.membership);
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Put('household/profile')
  @UseGuards(HouseholdMemberGuard)
  async putProfile(
    @Req() req: HouseholdMemberRequest,
    @Body() dto: UpsertHouseholdProfile,
  ) {
    try {
      return await this.householdService.putProfile(req.membership, dto);
    } catch (error) {
      if (error instanceof HouseholdInvalidError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Post('household/onboarding')
  @UseGuards(HouseholdMemberGuard)
  async completeOnboarding(
    @Req() req: HouseholdMemberRequest,
    @Body() dto: CompleteOnboarding,
  ) {
    try {
      return await this.householdService.completeOnboarding(
        req.membership,
        req.email,
        dto,
      );
    } catch (error) {
      if (error instanceof HouseholdInvalidError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Patch('household/profile')
  @UseGuards(HouseholdMemberGuard)
  async patchProfile(
    @Req() req: HouseholdMemberRequest,
    @Body() dto: PatchHouseholdProfile,
  ) {
    try {
      return await this.householdService.patchProfile(req.membership, dto);
    } catch (error) {
      if (error instanceof HouseholdInvalidError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Post('household/profile/skip')
  @UseGuards(HouseholdMemberGuard)
  async skip(@Req() req: HouseholdMemberRequest) {
    try {
      return await this.householdService.skip(req.membership);
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  @Patch('households/current')
  @UseGuards(HouseholdMemberGuard)
  async rename(
    @Req() req: HouseholdMemberRequest,
    @Body() dto: { name?: string },
  ) {
    try {
      return await this.householdService.renameHousehold(
        req.membership,
        dto.name ?? '',
      );
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Get('households/current/people')
  @UseGuards(HouseholdMemberGuard)
  async people(@Req() req: HouseholdMemberRequest) {
    try {
      return await this.householdService.listPeople(req.membership);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('households/current/leave')
  @UseGuards(HouseholdMemberGuard)
  async leave(@Req() req: HouseholdMemberRequest) {
    try {
      return await this.householdService.leave(req.membership);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete('households/current/members/:id')
  @UseGuards(HouseholdMemberGuard)
  async removeMember(
    @Req() req: HouseholdMemberRequest,
    @Param('id') id: string,
  ) {
    try {
      return await this.householdService.removeMember(req.membership, id);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Get('households/current')
  @UseGuards(HouseholdMemberGuard)
  async getCurrent(@Req() req: HouseholdMemberRequest) {
    try {
      return await this.householdService.getCurrent(req.membership);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('households/current/invites')
  @UseGuards(HouseholdMemberGuard)
  async invite(
    @Req() req: HouseholdMemberRequest,
    @Body() dto: { email: string },
  ) {
    try {
      return await this.householdService.invite(req.membership, dto.email);
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
  @UseGuards(HouseholdMemberGuard)
  async revokeInvite(
    @Req() req: HouseholdMemberRequest,
    @Param('id') id: string,
  ) {
    try {
      return await this.householdService.revokeInvite(req.membership, id);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof HouseholdForbiddenError) {
      throw error.message ? new ForbiddenException(error.message) : new ForbiddenException();
    }
    if (error instanceof HouseholdInvalidError) {
      throw new BadRequestException(error.message);
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
