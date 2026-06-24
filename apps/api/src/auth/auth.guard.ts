import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrivyService } from './privy.service';
import { CompanyService } from '../company/company.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly privy: PrivyService, private readonly companies: CompanyService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const token = header.slice('Bearer '.length);
    if (!token) throw new UnauthorizedException('missing bearer token');
    let claims: { privyUserId: string };
    try { claims = await this.privy.verify(token); }
    catch { throw new UnauthorizedException('invalid token'); }
    const company = await this.companies.findOrCreate(claims.privyUserId);
    req.companyId = company.id;
    return true;
  }
}
