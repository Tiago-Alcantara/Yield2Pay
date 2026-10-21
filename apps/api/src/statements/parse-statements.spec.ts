import { parseCsv } from './parse-csv';
import { parseOfx } from './parse-ofx';
import { parsePdf } from './parse-pdf';
import { StatementFormatError } from './statement.errors';

it('reads a CSV header in Portuguese', () => {
  const text = 'data,descricao,valor\n12/10/2026,Supermercado Dia,"1.234,56"\n';
  expect(parseCsv(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Supermercado Dia', amountCents: 123456, signed: 'unsigned' },
  ]);
});

it('reads a Nubank CSV and an Itau semicolon file', () => {
  const nubank = 'Data,Valor,Identificador,Descrição\n12/10/2026,-18.90,abc,Padaria Estrela\n';
  expect(parseCsv(nubank)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Padaria Estrela', amountCents: 1890, signed: 'debit' },
  ]);
  const itau = 'data;lançamento;valor\n12/10/2026;Uber Trip;-25,50\n';
  expect(parseCsv(itau)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Uber Trip', amountCents: 2550, signed: 'debit' },
  ]);
});

it('reads one OFX debit as a positive centavo amount', () => {
  const text = `<STMTTRN><DTPOSTED>20261012</DTPOSTED><TRNAMT>-10.50</TRNAMT><NAME>Uber</NAME></STMTTRN>`;
  expect(parseOfx(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Uber', amountCents: 1050, signed: 'debit' },
  ]);
});

it('reads an OFX credit as money in', () => {
  const text = `<STMTTRN><DTPOSTED>20261001</DTPOSTED><TRNAMT>3500.00</TRNAMT><NAME>Salario</NAME></STMTTRN>`;
  expect(parseOfx(text)).toEqual([
    { spentOn: '2026-10-01', merchant: 'Salario', amountCents: 350000, signed: 'credit' },
  ]);
});

it('reads SGML OFX blocks that omit the closing tag', () => {
  const text = `<STMTTRN>
<DTPOSTED>20261012
<TRNAMT>-10.50
<MEMO>Uber
<STMTTRN>
<DTPOSTED>20261013
<TRNAMT>-5.00
<NAME>Padaria`;
  expect(parseOfx(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Uber', amountCents: 1050, signed: 'debit' },
    { spentOn: '2026-10-13', merchant: 'Padaria', amountCents: 500, signed: 'debit' },
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
    { spentOn: '2026-10-12', merchant: 'Supermercado Dia', amountCents: 123456, signed: 'unsigned' },
  ]);
});

it('reads a PDF debit with a leading minus', () => {
  const text = '12/10/2026 Padaria Estrela -45,90\n12/10/2026 Enel R$ 89,90\n';
  expect(parsePdf(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Padaria Estrela', amountCents: 4590, signed: 'debit' },
    { spentOn: '2026-10-12', merchant: 'Enel', amountCents: 8990, signed: 'unsigned' },
  ]);
});
