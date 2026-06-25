import { StellarService } from './stellar.service';
import {
  Keypair,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from '@stellar/stellar-sdk';

const cfg = {
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  stellarNetwork: 'testnet',
} as any;

function sampleXdr(): { xdr: string; address: string; kp: Keypair } {
  const kp = Keypair.random();
  const account = new Account(kp.publicKey(), '0');
  const tx = new TransactionBuilder(account, {
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

it('returns a 0x-prefixed 32-byte hash for signing', () => {
  const svc = new StellarService(cfg);
  const { xdr } = sampleXdr();
  const { hash } = svc.hashForSigning(xdr);
  expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
});

it('hash matches the SDK transaction hash', () => {
  const svc = new StellarService(cfg);
  const { xdr } = sampleXdr();
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  const { hash } = svc.hashForSigning(xdr);
  expect(hash.slice(2)).toBe(tx.hash().toString('hex'));
});
