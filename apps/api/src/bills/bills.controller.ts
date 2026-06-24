import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import type { CreateBillDto } from '@fixearn/shared';
import { BillsService } from './bills.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('bills')
@UseGuards(AuthGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateBillDto) {
    return this.billsService.create(req.companyId, dto);
  }

  @Get()
  list(@Req() req: any) {
    return this.billsService.list(req.companyId);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.billsService.remove(req.companyId, id);
  }
}
