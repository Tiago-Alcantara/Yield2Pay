import { idsToMarkFixed } from './classify';

type ExpenseRow = {
  id: string;
  merchant: string;
  spentOn: Date;
  amountCents: number;
  category: string;
  fixed: boolean;
};

type FlagStore = {
  expense: {
    findMany: (args: {
      where: { householdId: string };
      select: {
        id: true;
        merchant: true;
        spentOn: true;
        amountCents: true;
        category: true;
        fixed: true;
      };
    }) => Promise<ExpenseRow[]>;
    updateMany: (args: {
      where: { id: { in: string[] } };
      data: { fixed: boolean };
    }) => Promise<unknown>;
  };
};

export async function refreshFixedFlags(store: FlagStore, householdId: string) {
  const rows = await store.expense.findMany({
    where: { householdId },
    select: {
      id: true,
      merchant: true,
      spentOn: true,
      amountCents: true,
      category: true,
      fixed: true,
    },
  });
  const wanted = new Set(
    idsToMarkFixed(
      rows.map((row) => ({
        id: row.id,
        merchant: row.merchant,
        spentOn: row.spentOn.toISOString().slice(0, 10),
        amountCents: row.amountCents,
        category: row.category,
      })),
    ),
  );
  const pending = rows.filter((row) => wanted.has(row.id) && !row.fixed).map((row) => row.id);
  if (pending.length === 0) return;
  await store.expense.updateMany({
    where: { id: { in: pending } },
    data: { fixed: true },
  });
}
