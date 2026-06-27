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
    pollTransaction: vi.fn().mockResolvedValue({ status: rpc.Api.GetTransactionStatus.FAILED }),
  } as unknown as rpc.Server;

  await expect(
    new StellarService(cfg, server).ensureAccountFunded(Keypair.random().publicKey()),
  ).rejects.toThrow('not confirmed');
});

// ── attachAndSubmit (fee bump) ────────────────────────────────────────────────

it('wraps the inner tx in a sponsor-signed fee bump and submits it', async () => {
  const { xdr, address, kp } = sampleTx();
  const inner = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
  inner.sign(kp);
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
