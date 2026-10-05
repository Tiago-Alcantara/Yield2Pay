import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ConfirmNotaDto,
  CreateContaDto,
  ExpenseCategory,
  JaGasteiDto,
  MonthExpenseView,
  MonthExpensesView,
  RecurringAccountView,
} from '@yield2pay/shared';
import { PrismaService } from '../prisma/prisma.service';

const MAX_CENTAVOS = 2_147_483_647;
const TZ = 'America/Sao_Paulo';

/** Integer BRL centavos. Not a USDC base-unit string. */
export function parseCentavos(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new BadRequestException('amountCents must be an integer number of BRL centavos');
  }
  if (value < 1 || value > MAX_CENTAVOS) {
    throw new BadRequestException('amountCents must be between 1 and 2147483647');
  }
  return value;
}

function saoPauloParts(now: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const bag = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]));
  return { year: Number(bag.year), month: Number(bag.month), day: Number(bag.day) };
}

export function saoPauloYearMonth(now: Date = new Date()): string {
  const p = saoPauloParts(now);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

/** UTC midnight of today's calendar date in America/Sao_Paulo, for a Prisma @db.Date. */
export function saoPauloTodayDate(now: Date = new Date()): Date {
  const p = saoPauloParts(now);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

export function monthRange(yearMonth: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) throw new Error(`bad yearMonth ${yearMonth}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002',
  );
}

function calendarDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new BadRequestException('spentOn must be YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestException('spentOn is not a calendar date');
  }
  return date;
}

function normalizeAccessKey(key: string | null | undefined): string | null {
  if (key == null || key === '') return null;
  if (!/^\d{44}$/.test(key)) throw new BadRequestException('accessKey must be 44 digits');
  return key;
}

function toMonthExpenseView(row: {
  id: string;
  amountCents: number;
  merchant: string;
  spentOn: Date;
  source: 'conta' | 'nota';
  category: ExpenseCategory;
}): MonthExpenseView {
  return {
    id: row.id,
    amountCents: row.amountCents,
    merchant: row.merchant,
    spentOn: row.spentOn.toISOString().slice(0, 10),
    source: row.source,
    category: row.category,
  };
}

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  async createConta(companyId: string, dto: CreateContaDto): Promise<RecurringAccountView> {
    const amountCents = parseCentavos(dto.amountCents);
    const name = dto.name.trim();
    if (!name || name.length > 80) throw new BadRequestException('name is required');
    const row = await this.prisma.recurringAccount.create({
      data: { companyId, name, amountCents },
    });
    return { id: row.id, name: row.name, amountCents: row.amountCents, spentThisMonth: false };
  }

  async listContas(companyId: string, now: Date = new Date()): Promise<RecurringAccountView[]> {
    const accounts = await this.prisma.recurringAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
    const spent = await this.prisma.monthExpense.findMany({
      where: {
        companyId,
        yearMonth: saoPauloYearMonth(now),
        recurringAccountId: { not: null },
      },
      select: { recurringAccountId: true },
    });
    const spentIds = new Set(spent.map((row) => row.recurringAccountId));
    return accounts.map((row) => ({
      id: row.id,
      name: row.name,
      amountCents: row.amountCents,
      spentThisMonth: spentIds.has(row.id),
    }));
  }

  async jaGastei(
    companyId: string,
    contaId: string,
    dto: JaGasteiDto,
    now: Date = new Date(),
  ): Promise<MonthExpenseView> {
    const account = await this.prisma.recurringAccount.findFirst({
      where: { id: contaId, companyId },
    });
    if (!account) throw new NotFoundException('conta não encontrada');
    try {
      const row = await this.prisma.monthExpense.create({
        data: {
          companyId,
          amountCents: account.amountCents,
          merchant: account.name,
          spentOn: saoPauloTodayDate(now),
          source: 'conta',
          category: dto.category,
          accessKey: null,
          recurringAccountId: account.id,
          yearMonth: saoPauloYearMonth(now),
        },
      });
      return toMonthExpenseView(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('já lançado neste mês');
      throw error;
    }
  }

  async confirmNota(companyId: string, dto: ConfirmNotaDto): Promise<MonthExpenseView> {
    const amountCents = parseCentavos(dto.amountCents);
    const merchant = dto.merchant.trim();
    if (!merchant || merchant.length > 120) throw new BadRequestException('merchant is required');
    const spentOn = calendarDate(dto.spentOn);
    const accessKey = normalizeAccessKey(dto.accessKey);
    try {
      const row = await this.prisma.monthExpense.create({
        data: {
          companyId,
          amountCents,
          merchant,
          spentOn,
          source: 'nota',
          category: dto.category,
          accessKey,
          recurringAccountId: null,
          yearMonth: null,
        },
      });
      return toMonthExpenseView(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('nota já lançada');
      throw error;
    }
  }

  async listMonth(companyId: string, now: Date = new Date()): Promise<MonthExpensesView> {
    const month = saoPauloYearMonth(now);
    const range = monthRange(month);
    const rows = await this.prisma.monthExpense.findMany({
      where: { companyId, spentOn: { gte: range.start, lt: range.end } },
      orderBy: [{ spentOn: 'asc' }, { createdAt: 'asc' }],
    });
    return { month, expenses: rows.map(toMonthExpenseView) };
  }
}
