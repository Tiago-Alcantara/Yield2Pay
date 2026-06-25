import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { CreateBillDto } from '@fixearn/shared';
import { BillsService } from './bills.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('bills')
@UseGuards(AuthGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateBillDto) {
    return this.billsService.create(req.companyId, dto);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.billsService.list(req.companyId);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.billsService.remove(req.companyId, id);
  }
}
