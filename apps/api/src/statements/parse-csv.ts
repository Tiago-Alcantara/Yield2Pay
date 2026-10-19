import { parseAmountToCents } from '../expenses/parse-amount';
import {
  StatementFormatError,
  type ParsedStatementRow,
} from './statement.errors';

const DATE_HEADERS = new Set(['data', 'date']);
const MERCHANT_HEADERS = new Set(['descricao', 'description', 'memo']);
const AMOUNT_HEADERS = new Set(['valor', 'amount']);

export function parseCsv(text: string): ParsedStatementRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new StatementFormatError();
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => DATE_HEADERS.has(h));
  const merchantIdx = headers.findIndex((h) => MERCHANT_HEADERS.has(h));
  const amountIdx = headers.findIndex((h) => AMOUNT_HEADERS.has(h));
  if (dateIdx < 0 || merchantIdx < 0 || amountIdx < 0) {
    throw new StatementFormatError();
  }

  const rows: ParsedStatementRow[] = [];
  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line);
    const spentOn = normalizeDate(fields[dateIdx] ?? '');
    const merchant = (fields[merchantIdx] ?? '').trim();
    const amountCents = parseAmountToCents(fields[amountIdx] ?? '');
    rows.push({ spentOn: spentOn ?? '', merchant, amountCents });
  }

  if (rows.length === 0) {
    throw new StatementFormatError();
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
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
    } else if (ch === ',' && !inQuotes) {
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
