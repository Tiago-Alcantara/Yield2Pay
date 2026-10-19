export class StatementFormatError extends Error {
  constructor(message = 'Invalid statement file') {
    super(message);
    this.name = 'StatementFormatError';
  }
}

export type ParsedStatementRow = {
  spentOn: string;
  merchant: string;
  amountCents: number;
};
