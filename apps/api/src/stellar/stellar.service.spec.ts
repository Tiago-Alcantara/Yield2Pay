import { StellarService } from './stellar.service';
import {
  Keypair,
  TransactionBuilder,
  Transaction,
  Account,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
  rpc,
} from '@stellar/stellar-sdk';

const SPONSOR_KP = Keypair.random();
const cfg = {
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  stellarNetwork: 'testnet',
  feeSponsorSecretKey: SPONSOR_KP.secret(),
} as any;

function sampleTx(): { xdr: string; address: string; kp: Keypair } {
  const kp = Keypair.random();
  const tx = new TransactionBuilder(new Account(kp.publicKey(), '0'), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: kp.publicKey(),
        asset: Asset.native(),
        amount: '1',
      }),
    )
    .setTimeout(60)
    .build();
  return { xdr: tx.toXDR(), address: kp.publicKey(), kp };
}

// ── hashForSigning ────────────────────────────────────────────────────────────

it('returns a 0x-prefixed 32-byte hash for signing', () => {
  const { hash } = new StellarService(cfg).hashForSigning(sampleTx().xdr);
  expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
});

it('hash matches the SDK transaction hash', () => {
  const { xdr } = sampleTx();
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  expect(new StellarService(cfg).hashForSigning(xdr).hash.slice(2)).toBe(
    tx.hash().toString('hex'),
  );
});

// ── ensureAccountFunded ───────────────────────────────────────────────────────

it('does nothing when the account already exists', async () => {
  const server = {
    getAccount: vi.fn().mockResolvedValue(new Account(Keypair.random().publicKey(), '1')),
    sendTransaction: vi.fn(),
  } as unknown as rpc.Server;

  await new StellarService(cfg, server).ensureAccountFunded(Keypair.random().publicKey());
  expect(server.sendTransaction).not.toHaveBeenCalled();
});

it('submits a createAccount tx when the account is missing', async () => {
  const server = {
    getAccount: vi
      .fn()
      .mockRejectedValueOnce(new Error('Account not found')) // user: missing
      .mockResolvedValueOnce(new Account(SPONSOR_KP.publicKey(), '42')), // sponsor
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'h1' }),
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.SUCCESS }),
  } as unknown as rpc.Server;

  await new StellarService(cfg, server).ensureAccountFunded(Keypair.random().publicKey());
  expect(server.sendTransaction).toHaveBeenCalledTimes(1);
});

it('throws when the createAccount tx is not confirmed', async () => {
  const server = {
    getAccount: vi
      .fn()
      .mockRejectedValueOnce(new Error('Account not found'))
      .mockResolvedValueOnce(new Account(SPONSOR_KP.publicKey(), '42')),
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'h2' }),
    pollTransaction: vi.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.FAILED,
      resultXdr: {
        result: () => ({
          switch: () => ({ name: 'txFailed' }),
        }),
      },
    }),
  } as unknown as rpc.Server;

  await expect(
    new StellarService(cfg, server).ensureAccountFunded(Keypair.random().publicKey()),
  ).rejects.toThrow('failed on-chain');
});

// ── attachAndSubmit (fee bump) ────────────────────────────────────────────────

it('ensureAccountFunded re-throws when getAccount rejects with a non-not-found error', async () => {
  const server = {
    getAccount: vi.fn().mockRejectedValueOnce(new Error('RPC 500: service unavailable')),
    sendTransaction: vi.fn(),
  } as unknown as rpc.Server;

  await expect(
    new StellarService(cfg, server).ensureAccountFunded(Keypair.random().publicKey()),
  ).rejects.toThrow('RPC 500: service unavailable');
  expect(server.sendTransaction).not.toHaveBeenCalled();
});

it('wraps the inner tx in a sponsor-signed fee bump and submits it', async () => {
  const { xdr, address, kp } = sampleTx();
  const inner = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
  const signatureHex = '0x' + kp.sign(inner.hash()).toString('hex');

  const server = {
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'tx123' }),
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.SUCCESS }),
  } as unknown as rpc.Server;

  const result = await new StellarService(cfg, server).attachAndSubmit(xdr, address, signatureHex);

  expect(result).toEqual({ txHash: 'tx123' });
  const submitted = (server.sendTransaction as any).mock.calls[0][0];
  expect(submitted.toEnvelope().switch().name).toBe('envelopeTypeTxFeeBump');
});

// ── fundClient (sponsor → cliente) ────────────────────────────────────────────

it('fundClient envia um payment nativo do sponsor para o cliente e espera confirmar', async () => {
  const server = {
    getAccount: vi.fn().mockResolvedValue(new Account(SPONSOR_KP.publicKey(), '10')),
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'pay1' }),
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.SUCCESS }),
  } as unknown as rpc.Server;

  const client = Keypair.random().publicKey();
  const txHash = await new StellarService(cfg, server).fundClient(client, 100000000n); // 10 XLM

  expect(txHash).toBe('pay1'); // retorna o hash da tx confirmada
  expect(server.getAccount).toHaveBeenCalledWith(SPONSOR_KP.publicKey());
  expect(server.sendTransaction).toHaveBeenCalledTimes(1);

  const submitted = (server.sendTransaction as any).mock.calls[0][0];
  // Tx simples (não fee-bump) com um único payment nativo pro cliente.
  expect(submitted.toEnvelope().switch().name).toBe('envelopeTypeTx');
  const op = submitted.operations[0];
  expect(op.type).toBe('payment');
  expect(op.destination).toBe(client);
  expect(op.asset.isNative()).toBe(true);
  expect(Number(op.amount)).toBe(10);
});

it('fundClient lança quando o payment não confirma', async () => {
  const server = {
    getAccount: vi.fn().mockResolvedValue(new Account(SPONSOR_KP.publicKey(), '10')),
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'pay2' }),
    pollTransaction: vi.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.FAILED,
      resultXdr: { result: () => ({ switch: () => ({ name: 'txFailed' }) }) },
    }),
  } as unknown as rpc.Server;

  await expect(
    new StellarService(cfg, server).fundClient(Keypair.random().publicKey(), 100000000n),
  ).rejects.toThrow('failed on-chain');
});

// ── submit: retry em TRY_AGAIN_LATER (throttle transiente do RPC) ──────────────

it('retenta o send quando o RPC responde TRY_AGAIN_LATER e então confirma', async () => {
  const sendTransaction = vi
    .fn()
    .mockResolvedValueOnce({ status: 'TRY_AGAIN_LATER' })
    .mockResolvedValueOnce({ status: 'PENDING', hash: 'pay3' });
  const server = {
    getAccount: vi.fn().mockResolvedValue(new Account(SPONSOR_KP.publicKey(), '10')),
    sendTransaction,
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.SUCCESS }),
  } as unknown as rpc.Server;

  const svc = new StellarService(cfg, server);
  vi.spyOn(svc as any, 'sleep').mockResolvedValue(undefined); // sem espera real no teste

  const txHash = await svc.fundClient(Keypair.random().publicKey(), 100000000n);

  expect(txHash).toBe('pay3');
  expect(sendTransaction).toHaveBeenCalledTimes(2); // 1 throttle + 1 sucesso
});

it('desiste após esgotar as tentativas se o RPC continua em TRY_AGAIN_LATER', async () => {
  const sendTransaction = vi.fn().mockResolvedValue({ status: 'TRY_AGAIN_LATER' });
  const pollTransaction = vi.fn();
  const server = {
    getAccount: vi.fn().mockResolvedValue(new Account(SPONSOR_KP.publicKey(), '10')),
    sendTransaction,
    pollTransaction,
  } as unknown as rpc.Server;

  const svc = new StellarService(cfg, server);
  vi.spyOn(svc as any, 'sleep').mockResolvedValue(undefined);

  await expect(
    svc.fundClient(Keypair.random().publicKey(), 100000000n),
  ).rejects.toThrow('TRY_AGAIN_LATER');
  expect(sendTransaction.mock.calls.length).toBeGreaterThan(1); // tentou mais de uma vez
  expect(pollTransaction).not.toHaveBeenCalled();
});

// ── serialização do sequence do sponsor (corrida → txBadSeq) ──────────────────

// Mock que modela o sequence on-chain do sponsor: aceita a tx só se o seu seq
// for exatamente (onChain + 1); senão devolve ERROR/txBadSeq como o RPC real.
function sponsorSeqServer(startSeq: number): rpc.Server {
  let onChain = startSeq;
  return {
    getAccount: vi.fn(async (pub: string) => new Account(pub, String(onChain))),
    sendTransaction: vi.fn(async (tx: Transaction) => {
      const txSeq = Number(tx.sequence);
      if (txSeq === onChain + 1) {
        onChain = txSeq;
        return { status: 'PENDING', hash: 'h' + txSeq };
      }
      return {
        status: 'ERROR',
        errorResult: { result: () => ({ switch: () => ({ name: 'txBadSeq' }) }) },
      };
    }),
    pollTransaction: vi.fn(async () => ({ status: rpc.Api.GetTransactionStatus.SUCCESS })),
  } as unknown as rpc.Server;
}

it('serializa txs concorrentes do sponsor sem colidir com txBadSeq', async () => {
  const svc = new StellarService(cfg, sponsorSeqServer(100));
  const c1 = Keypair.random().publicKey();
  const c2 = Keypair.random().publicKey();

  // Duas chamadas concorrentes que consomem o sequence do sponsor. Sem
  // serialização, ambas leem seq 100, montam seq 101 e a 2ª leva txBadSeq.
  await expect(
    Promise.all([svc.fundClient(c1, 100000000n), svc.fundClient(c2, 100000000n)]),
  ).resolves.toEqual(['h101', 'h102']);
});

// ── getNativeBalance ──────────────────────────────────────────────────────────

it('getNativeBalance lê o balance nativo do AccountEntry (stroops)', async () => {
  const addr = Keypair.random().publicKey();
  const server = {
    getLedgerEntries: vi.fn().mockResolvedValue({
      entries: [
        { val: { account: () => ({ balance: () => ({ toString: () => '250000000' }) }) } },
      ],
      latestLedger: 1,
    }),
  } as unknown as rpc.Server;

  const bal = await new StellarService(cfg, server).getNativeBalance(addr);
  expect(bal).toBe(250000000n); // 25 XLM
  expect(server.getLedgerEntries).toHaveBeenCalledTimes(1);
});

it('getNativeBalance retorna 0n quando a conta não existe (sem entries)', async () => {
  const server = {
    getLedgerEntries: vi.fn().mockResolvedValue({ entries: [], latestLedger: 1 }),
  } as unknown as rpc.Server;

  const bal = await new StellarService(cfg, server).getNativeBalance(Keypair.random().publicKey());
  expect(bal).toBe(0n);
});
