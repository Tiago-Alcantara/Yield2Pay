export class ExpenseInvalidError extends Error {
  constructor(message = 'Invalid expense') {
    super(message);
    this.name = 'ExpenseInvalidError';
  }
}

export class ExpenseNotFoundError extends Error {
  constructor(message = 'Expense not found') {
    super(message);
    this.name = 'ExpenseNotFoundError';
  }
}
