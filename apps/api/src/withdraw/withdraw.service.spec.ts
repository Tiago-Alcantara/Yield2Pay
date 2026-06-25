import { WithdrawService } from './withdraw.service';

it('build: builds withdraw xdr for the company wallet', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildWithdraw: vi.fn().mockResolvedValue({ xdr: 'WXDR' }) };
  const stellar = {
    hashForSigning: vi.fn().mockReturnValue({ hash: '0xdef' }),
  };
  const svc = new WithdrawService(vault as any, stellar as any, wallet as any);
  const r = await svc.build('co_1', 250000n);
  expect(vault.buildWithdraw).toHaveBeenCalledWith('GADDR', 250000n);
  expect(r).toEqual({ xdr: 'WXDR', hash: '0xdef' });
});

it('submit: attaches sig and submits', async () => {
  const stellar = {
    attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'TXW' }),
  };
  const svc = new WithdrawService({} as any, stellar as any, {} as any);
  const r = await svc.submit('co_1', {
    xdr: 'X',
    signatureHex: '0xs',
    stellarAddress: 'GADDR',
    amount: '250000',
  });
  expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xs');
  expect(r).toEqual({ txHash: 'TXW' });
});
