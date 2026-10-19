import { parseCsv } from './parse-csv';
import { parseOfx } from './parse-ofx';
import { parsePdf } from './parse-pdf';
import { StatementFormatError } from './statement.errors';

it('reads a CSV header in Portuguese', () => {
  const text = 'data,descricao,valor\n12/10/2026,Supermercado Dia,"1.234,56"\n';
  expect(parseCsv(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Supermercado Dia', amountCents: 123456 },
  ]);
});

it('reads one OFX debit as a positive centavo amount', () => {
  const text = `<STMTTRN><DTPOSTED>20261012</DTPOSTED><TRNAMT>-10.50</TRNAMT><NAME>Uber</NAME></STMTTRN>`;
  expect(parseOfx(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Uber', amountCents: 1050 },
  ]);
});

it('throws when a CSV header is missing', () => {
  expect(() => parseCsv('foo,bar\n1,2\n')).toThrow(StatementFormatError);
});

it('throws when OFX has no STMTTRN blocks', () => {
  expect(() => parseOfx('<OFX></OFX>')).toThrow(StatementFormatError);
});

it('reads a PDF line with a Brazilian amount', () => {
  const text = '12/10/2026 Supermercado Dia 1.234,56\nignored line\n';
  expect(parsePdf(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Supermercado Dia', amountCents: 123456 },
  ]);
});
