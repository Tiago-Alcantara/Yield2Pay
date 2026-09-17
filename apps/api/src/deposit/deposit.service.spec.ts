import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DepositService } from './deposit.service';

it('build: monta o xdr do vault USDC e retorna o hash (sem checar saldo XLM)', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn().mockResolvedValue({ xdr: 'XDR1' }) };
  const stellar = {
    getNativeBalance: vi.fn(),
    hashForSigning: vi.fn().mockReturnValue({ hash: '0xabc' }),
    fundClient: vi.fn(),
  };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  const r = await svc.build('co_1', 1000000n);

  // Cofre USDC: não checa mais saldo XLM nativo.
  expect(stellar.getNativeBalance).not.toHaveBeenCalled();
  expect(vault.buildDeposit).toHaveBeenCalledWith('GADDR', 1000000n);
  expect(r).toEqual({ xdr: 'XDR1', hash: '0xabc' });
});

it('build: rejeita amount acima do teto MAX_DEPOSIT', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const vault = { buildDeposit: vi.fn() };
  const stellar = { getNativeBalance: vi.fn(), hashForSigning: vi.fn(), fundClient: vi.fn() };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService(vault as any, stellar as any, ledger as any, wallet as any);

  await expect(svc.build('co_1', 100_000_000_001n)).rejects.toThrow(BadRequestException);
  expect(vault.buildDeposit).not.toHaveBeenCalled();
});

it('submit: attaches sig, submits, records deposit', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const stellar = { attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'TX9' }) };
  const ledger = { recordDeposit: vi.fn().mockResolvedValue(undefined) };
  const svc = new DepositService({} as any, stellar as any, ledger as any, wallet as any);

  const r = await svc.submit('co_1', { xdr: 'X', signatureHex: '0xsig', stellarAddress: 'GADDR', amount: '1000000' });
  expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xsig');
  expect(ledger.recordDeposit).toHaveBeenCalledWith(
    'co_1',
    1000000n,
    'TX9',
    'stellar:blend',
    undefined,
  );
  expect(r).toEqual({ txHash: 'TX9' });
});

it('submit: rejeita com Forbidden quando o address não bate com a wallet registrada', async () => {
  const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
  const stellar = { attachAndSubmit: vi.fn() };
  const ledger = { recordDeposit: vi.fn() };
  const svc = new DepositService({} as any, stellar as any, ledger as any, wallet as any);

  await expect(
    svc.submit('co_1', { xdr: 'X', signatureHex: '0xsig', stellarAddress: 'GEVIL', amount: '1000000' }),
  ).rejects.toThrow(ForbiddenException);
  expect(stellar.attachAndSubmit).not.toHaveBeenCalled();
  expect(ledger.recordDeposit).not.toHaveBeenCalled();
});
