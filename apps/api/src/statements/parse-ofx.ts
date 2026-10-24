import { parseSignedAmount } from '../expenses/parse-amount';
import { normalizeDate } from './parse-csv';
import {
  StatementFormatError,
  type ParsedStatementRow,
} from './statement.errors';

const OFX_TAG =
  'DTPOSTED|TRNAMT|FITID|NAME|MEMO|TRNTYPE|CHECKNUM|STMTTRN|BANKTRANLIST|REFNUM';

export function decodeOfx(bytes: Buffer): string {
  const header = bytes.subarray(0, 512).toString('latin1');
  const charset = /CHARSET:\s*(\d+)/i.exec(header)?.[1];
  if (charset === '1252') {
    return new TextDecoder('windows-1252').decode(bytes);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

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
    const fitId = (ofxTag(body, 'FITID') ?? '').trim();
    return {
      spentOn,
      merchant,
      amountCents: amount.amountCents,
      signed: amount.signed === 'debit' ? 'debit' : 'credit',
      ...(fitId ? { fitId } : {}),
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
    .map((part) => part.split(/<\/STMTTRN>/i)[0]?.trim() ?? '')
    .filter((part) => part.length > 0);
  if (open.length === 0) {
    throw new StatementFormatError();
  }
  return open;
}

function ofxTag(block: string, name: string): string | undefined {
  const start = new RegExp(`<${name}>`, 'i').exec(block);
  if (!start) return undefined;
  const rest = block.slice(start.index + start[0].length);
  const end = rest.search(new RegExp(`</?(?:${OFX_TAG})\\b`, 'i'));
  const raw = end === -1 ? rest : rest.slice(0, end);
  const value = decodeEntities(raw).trim();
  return value.length > 0 ? value : undefined;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}
