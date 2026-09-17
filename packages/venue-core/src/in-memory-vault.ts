export class InMemoryVault {
  private readonly positions = new Map<string, bigint>();
  private nonce = 0;

  credit(owner: string, amount: bigint): void {
    this.positions.set(owner, (this.positions.get(owner) ?? 0n) + amount);
  }

  debit(owner: string, amount: bigint): void {
    const held = this.positions.get(owner) ?? 0n;
    if (amount > held) throw new Error("insufficient_position");
    this.positions.set(owner, held - amount);
  }

  balance(owner: string): bigint {
    return this.positions.get(owner) ?? 0n;
  }

  nextTxRef(prefix: string): string {
    this.nonce += 1;
    return `${prefix}-${this.nonce}`;
  }
}

export type MockOp = {
  op: "deposit" | "withdraw";
  owner: string;
  amount: string;
};

export function encodeMockOp(body: MockOp): string {
  return `MOCK:${JSON.stringify(body)}`;
}

export function decodeMockOp(raw: string): MockOp {
  const text = raw.startsWith("MOCK:") ? raw.slice(5) : raw;
  return JSON.parse(text) as MockOp;
}

export function applyMockOp(vault: InMemoryVault, body: MockOp): void {
  const amount = BigInt(body.amount);
  if (body.op === "deposit") vault.credit(body.owner, amount);
  else vault.debit(body.owner, amount);
}
