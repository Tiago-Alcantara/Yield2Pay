import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrivyService } from './privy.service';
import { CompanyService } from '../company/company.service';
import { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly privy: PrivyService,
    private readonly companies: CompanyService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException('missing bearer token');
    const token = header.slice('Bearer '.length);
    if (!token) throw new UnauthorizedException('missing bearer token');
    let claims: { privyUserId: string; email: string | null };
    try {
      claims = await this.privy.verify(token);
    } catch (e) {
      console.error('[AuthGuard] privy.verify failed:', e);
      throw new UnauthorizedException('invalid token');
    }
    try {
      const company = await this.companies.findOrCreate(claims.privyUserId);
      req.companyId = company.id;
      req.email =
        claims.email ?? (await this.identityEmail(req, claims.privyUserId));
      return true;
    } catch (e) {
      console.error('[AuthGuard] findOrCreate failed:', e);
      throw e;
    }
  }

  private async identityEmail(
    req: AuthenticatedRequest,
    privyUserId: string,
  ): Promise<string | null> {
    const header = req.headers['privy-id-token'];
    const idToken = Array.isArray(header) ? header[0] : header;
    if (!idToken) return null;
    try {
      return await this.privy.emailFromIdentity(idToken, privyUserId);
    } catch {
      return null;
    }
  }
}
