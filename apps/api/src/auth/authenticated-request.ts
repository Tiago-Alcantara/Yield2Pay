import { Request } from 'express';

/**
 * Request após o AuthGuard: carrega o companyId resolvido a partir do token Privy.
 * O AuthGuard anexa `req.companyId` antes de qualquer controller rodar.
 */
export interface AuthenticatedRequest extends Request {
  companyId: string;
}
