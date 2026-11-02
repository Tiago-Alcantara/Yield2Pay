import { Request } from 'express';
import type { HouseholdRole } from '@yield2pay/shared';

/** Grupo ativo da pessoa no pedido, resolvido pelo HouseholdMemberGuard. */
export interface ActiveMembership {
  householdId: string;
  companyId: string;
  role: HouseholdRole;
  /** true quando é o grupo individual da pessoa. */
  personal: boolean;
}

/**
 * Request após o AuthGuard: carrega o companyId resolvido a partir do token Privy.
 * O AuthGuard anexa `req.companyId` antes de qualquer controller rodar.
 * O HouseholdMemberGuard, quando a rota usa, anexa `req.membership`.
 */
export interface AuthenticatedRequest extends Request {
  companyId: string;
  email: string | null;
  membership?: ActiveMembership;
}

/** Request de rota com AuthGuard + HouseholdMemberGuard: membership sempre presente. */
export interface HouseholdMemberRequest extends AuthenticatedRequest {
  membership: ActiveMembership;
}
