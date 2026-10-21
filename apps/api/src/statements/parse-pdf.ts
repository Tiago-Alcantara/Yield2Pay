import { parseSignedAmount } from '../expenses/parse-amount';
import { normalizeDate } from './parse-csv';
import type { ParsedStatementRow } from './statement.errors';

const PDF_LINE =
  /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

export function parsePdf(text: string): ParsedStatementRow[] {
  const rows: ParsedStatementRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = PDF_LINE.exec(line.trim());
    if (!match) {
      continue;
    }
    const amount = parseSignedAmount(match[3]);
    rows.push({
      spentOn: normalizeDate(match[1]) ?? '',
      merchant: match[2].trim(),
      amountCents: amount.amountCents,
      signed: amount.signed,
    });
  }
  return rows;
}
