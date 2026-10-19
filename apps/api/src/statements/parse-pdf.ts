import { parseAmountToCents } from '../expenses/parse-amount';
import { normalizeDate } from './parse-csv';
import type { ParsedStatementRow } from './statement.errors';

const PDF_LINE =
  /(\d{2}\/\d{2}\/\d{4}).*?(\d{1,3}(?:\.\d{3})*,\d{2})/;

export function parsePdf(text: string): ParsedStatementRow[] {
  const rows: ParsedStatementRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = PDF_LINE.exec(line);
    if (!match) {
      continue;
    }
    const dateRaw = match[1];
    const amountRaw = match[2];
    const dateStart = match.index;
    const amountStart = line.lastIndexOf(amountRaw);
    const merchant = line
      .slice(dateStart + dateRaw.length, amountStart)
      .trim();
    rows.push({
      spentOn: normalizeDate(dateRaw) ?? '',
      merchant,
      amountCents: parseAmountToCents(amountRaw),
    });
  }
  return rows;
}
