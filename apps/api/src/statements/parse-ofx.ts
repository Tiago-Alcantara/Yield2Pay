import { parseSignedAmount } from '../expenses/parse-amount';
import { normalizeDate } from './parse-csv';
import {
  StatementFormatError,
  type ParsedStatementRow,
} from './statement.errors';

export function parseOfx(text: string): ParsedStatementRow[] {
  return statementBodies(text).map((body) => {
    const posted = (ofxTag(body, 'DTPOSTED') ?? '').replace(/\D/g, '');
    const ymd = posted.slice(0, 8);
    const spentOn =
      ymd.length === 8
        ? normalizeDate(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`) ?? ''
        : '';
    const merchant = (ofxTag(body, 'NAME') ?? ofxTag(body, 'MEMO') ?? '').trim();
    const amount = parseSignedAmount(ofxTag(body, 'TRNAMT') ?? '');
    return {
      spentOn,
      merchant,
      amountCents: amount.amountCents,
      signed: amount.signed === 'debit' ? 'debit' : 'credit',
    };
  });
}

function statementBodies(text: string): string[] {
  const closed = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map((match) => match[1]);
  if (closed.length > 0) {
    return closed;
  }
  const open = text
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (open.length === 0) {
    throw new StatementFormatError();
  }
  return open;
}

function ofxTag(block: string, name: string): string | undefined {
  const withClose = new RegExp(`<${name}>([^<]*)`, 'i').exec(block);
  return withClose?.[1]?.trim();
}
