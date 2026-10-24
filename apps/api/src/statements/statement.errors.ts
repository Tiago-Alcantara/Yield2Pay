export class StatementFormatError extends Error {
  constructor(message = 'Invalid statement file') {
    super(message);
    this.name = 'StatementFormatError';
  }
}

export class StatementTooLargeError extends Error {
  constructor() {
    super('file is too large');
    this.name = 'StatementTooLargeError';
  }
}

export class StatementDuplicateError extends Error {
  constructor() {
    super('statement already imported');
    this.name = 'StatementDuplicateError';
  }
}

export class StatementNotFoundError extends Error {
  constructor() {
    super('statement not found');
    this.name = 'StatementNotFoundError';
  }
}

export type AmountSign = 'debit' | 'credit' | 'unsigned';

export type ParsedStatementRow = {
  spentOn: string;
  merchant: string;
  amountCents: number;
  signed: AmountSign;
  fitId?: string;
};
