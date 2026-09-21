import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { CompanyService } from '../company/company.service';

@Controller('account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly companies: CompanyService) {}

  @Get('export')
  export(@Req() req: AuthenticatedRequest) {
    return this.companies.exportAccount(req.companyId);
  }

  @Delete()
  @HttpCode(204)
  remove(@Req() req: AuthenticatedRequest) {
    return this.companies.deleteAccount(req.companyId);
  }
}
