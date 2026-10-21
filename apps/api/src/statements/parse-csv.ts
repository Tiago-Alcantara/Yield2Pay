import { parseSignedAmount } from '../expenses/parse-amount';
import {
  StatementFormatError,
  type ParsedStatementRow,
} from './statement.errors';

const DATE_HEADERS = new Set(['data', 'date']);
const MERCHANT_HEADERS = new Set([
  'descricao',
  'description',
  'memo',
  'historico',
  'lancamento',
  'titulo',
  'title',
  'estabelecimento',
]);
const AMOUNT_HEADERS = new Set(['valor', 'amount']);

export function parseCsv(text: string): ParsedStatementRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new StatementFormatError();
  }

  const header = findHeader(lines);
  if (!header) {
    throw new StatementFormatError();
  }

  const rows: ParsedStatementRow[] = [];
  for (const line of lines.slice(header.index + 1)) {
    const fields = splitCsvLine(line, header.delimiter);
    const spentOn = normalizeDate(fields[header.dateIdx] ?? '');
    const merchant = (fields[header.merchantIdx] ?? '').trim();
    const amount = parseSignedAmount(fields[header.amountIdx] ?? '');
    rows.push({
      spentOn: spentOn ?? '',
      merchant,
      amountCents: amount.amountCents,
      signed: amount.signed,
    });
  }

  if (rows.length === 0) {
    throw new StatementFormatError();
  }
  return rows;
}

function findHeader(lines: string[]) {
  const scan = Math.min(lines.length, 30);
  for (let index = 0; index < scan; index++) {
    const delimiter = delimiterOf(lines[index]);
    const headers = splitCsvLine(lines[index], delimiter).map(foldHeader);
    const dateIdx = headers.findIndex((header) => DATE_HEADERS.has(header));
    const merchantIdx = headers.findIndex((header) => MERCHANT_HEADERS.has(header));
    const amountIdx = headers.findIndex((header) => AMOUNT_HEADERS.has(header));
    if (dateIdx >= 0 && merchantIdx >= 0 && amountIdx >= 0) {
      return { index, delimiter, dateIdx, merchantIdx, amountIdx };
    }
  }
  return null;
}

function delimiterOf(line: string): ',' | ';' {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === ',') {
      commas += 1;
    } else if (!inQuotes && ch === ';') {
      semis += 1;
    }
  }
  return semis > commas ? ';' : ',';
}

function foldHeader(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function splitCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}
