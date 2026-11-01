import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import {
  readRequestedHouseholdId,
  resolveActiveHousehold,
} from './active-household';
import { HouseholdNotFoundError } from './household.errors';

/**
 * Roda depois do AuthGuard. Resolve o grupo ativo (header X-Household-Id ou o
 * padrão da pessoa) e anexa `req.membership`. Grupo alheio, id malformado ou
 * pessoa sem grupo respondem 404, nunca 403, para não revelar se o grupo existe.
 */
@Injectable()
export class HouseholdMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    try {
      req.membership = await resolveActiveHousehold(
        this.prisma,
        req.companyId,
        readRequestedHouseholdId(req.headers),
      );
      return true;
    } catch (error) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
