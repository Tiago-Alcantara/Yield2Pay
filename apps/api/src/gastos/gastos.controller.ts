import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
import type { ConfirmNotaDto, CreateContaDto, ExpenseCategory, JaGasteiDto } from '@yield2pay/shared';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { GastosService } from './gastos.service';

const CATEGORIES = ['mercado', 'conta_da_casa', 'transporte', 'outros'] as const;

export class CreateContaBody implements CreateContaDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  amountCents!: number;
}

export class JaGasteiBody implements JaGasteiDto {
  @IsIn(CATEGORIES)
  category!: ExpenseCategory;
}

export class ConfirmNotaBody implements ConfirmNotaDto {
  @IsString()
  @Length(1, 120)
  merchant!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  amountCents!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  spentOn!: string;

  @IsIn(CATEGORIES)
  category!: ExpenseCategory;

  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @Matches(/^\d{44}$/)
  accessKey?: string | null;
}

@Controller('gastos')
@UseGuards(AuthGuard)
export class GastosController {
  constructor(private readonly gastos: GastosService) {}

  @Post('contas')
  createConta(@Req() req: AuthenticatedRequest, @Body() body: CreateContaBody) {
    return this.gastos.createConta(req.companyId, body);
  }

  @Get('contas')
  listContas(@Req() req: AuthenticatedRequest) {
    return this.gastos.listContas(req.companyId);
  }

  @Post('contas/:id/ja-gastei')
  jaGastei(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: JaGasteiBody) {
    return this.gastos.jaGastei(req.companyId, id, body);
  }

  @Post('notas')
  confirmNota(@Req() req: AuthenticatedRequest, @Body() body: ConfirmNotaBody) {
    return this.gastos.confirmNota(req.companyId, body);
  }

  @Get()
  listMonth(@Req() req: AuthenticatedRequest) {
    return this.gastos.listMonth(req.companyId);
  }
}
