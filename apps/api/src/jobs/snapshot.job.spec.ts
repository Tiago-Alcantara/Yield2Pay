import { SnapshotJob } from './snapshot.job';

it('snapshots every company that has a wallet', async () => {
  const prisma = {
    company: {
      findMany: vi.fn().mockResolvedValue([{ id: 'co_1' }, { id: 'co_2' }]),
    },
  } as any;
  const ledger = { snapshot: vi.fn().mockResolvedValue(undefined) } as any;
  const job = new SnapshotJob(prisma, ledger);
  const r = await job.runOnce();
  expect(prisma.company.findMany).toHaveBeenCalledWith({
    where: { wallet: { isNot: null } },
    select: { id: true },
  });
  expect(ledger.snapshot).toHaveBeenCalledTimes(2);
  expect(r.count).toBe(2);
});

it('continues past a failing company snapshot', async () => {
  const prisma = {
    company: {
      findMany: vi.fn().mockResolvedValue([{ id: 'co_1' }, { id: 'co_2' }]),
    },
  } as any;
  const ledger = {
    snapshot: vi
      .fn()
      .mockRejectedValueOnce(new Error('rpc'))
      .mockResolvedValue(undefined),
  } as any;
  const job = new SnapshotJob(prisma, ledger);
  const r = await job.runOnce();
  expect(r.count).toBe(1);
});
