/**
 * Módulo: page-query
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: offset e limit só entram se forem inteiros decimais, com teto.
 * Sequência: 1e20, 0x10, 1e3, espaço e array são recusados antes da consulta.
 */
import { ExpenseInvalidError } from './expense.errors';

const DECIMAL = /^(0|[1-9][0-9]*)$/;
const CURSOR = /^(\d{4}-\d{2}-\d{2})\|([^|]+)$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Dia de calendário de verdade. 9999-99-99 passa no formato e quebra o banco. */
export function isCalendarDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const MAX_EXPENSE_LIMIT = 5000;
export const MAX_EXPENSE_OFFSET = 1_000_000;

export type ExpensePageQuery = {
  limit: number;
  offset: number;
  cursor?: string;
};

export function parseExpensePage(input: {
  limit?: unknown;
  offset?: unknown;
  cursor?: unknown;
}): ExpensePageQuery {
  const limit = readDecimal(input.limit, 'limit') ?? 100;
  const offset = readDecimal(input.offset, 'offset') ?? 0;
  if (limit < 1 || limit > MAX_EXPENSE_LIMIT) {
    throw new ExpenseInvalidError('limit is invalid');
  }
  if (offset < 0 || offset > MAX_EXPENSE_OFFSET) {
    throw new ExpenseInvalidError('offset is invalid');
  }
  if (input.cursor == null || input.cursor === '') {
    return { limit, offset };
  }
  const cursorMatch =
    typeof input.cursor === 'string' ? CURSOR.exec(input.cursor) : null;
  if (!cursorMatch || !isCalendarDay(cursorMatch[1] ?? '')) {
    throw new ExpenseInvalidError('cursor is invalid');
  }
  return { limit, offset, cursor: cursorMatch[0] };
}

function readDecimal(value: unknown, label: string): number | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !DECIMAL.test(value)) {
    throw new ExpenseInvalidError(`${label} is invalid`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ExpenseInvalidError(`${label} is invalid`);
  }
  return parsed;
}
