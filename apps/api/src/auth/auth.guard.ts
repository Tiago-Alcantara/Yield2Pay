import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrivyService } from './privy.service';
import { CompanyService } from '../company/company.service';
import { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
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
    let claims: { privyUserId: string };
    try {
      claims = await this.privy.verify(token);
    } catch {
      // Nunca logar o token nem o header — só a falha.
      throw new UnauthorizedException('invalid token');
    }
    try {
      const company = await this.companies.findOrCreate(claims.privyUserId);
      req.companyId = company.id;
      return true;
    } catch (e) {
      // Sem token/PII no log; só sinaliza falha de provisionamento.
      this.logger.error('findOrCreate failed', e instanceof Error ? e.stack : undefined);
      throw e;
    }
  }
}
