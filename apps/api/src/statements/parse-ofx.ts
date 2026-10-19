import { parseAmountToCents } from '../expenses/parse-amount';
import { normalizeDate } from './parse-csv';
import {
  StatementFormatError,
  type ParsedStatementRow,
} from './statement.errors';

export function parseOfx(text: string): ParsedStatementRow[] {
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];
  if (blocks.length === 0) {
    throw new StatementFormatError();
  }

  return blocks.map(([, body]) => {
    const posted = ofxTag(body, 'DTPOSTED') ?? '';
    const ymd = posted.slice(0, 8);
    const spentOn =
      normalizeDate(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`) ??
      '';
    const merchant = (ofxTag(body, 'NAME') ?? ofxTag(body, 'MEMO') ?? '').trim();
    const amountCents = parseAmountToCents(ofxTag(body, 'TRNAMT') ?? '');
    return { spentOn, merchant, amountCents };
  });
}

function ofxTag(block: string, name: string): string | undefined {
  const withClose = new RegExp(`<${name}>([^<]*)`, 'i').exec(block);
  return withClose?.[1]?.trim();
}
