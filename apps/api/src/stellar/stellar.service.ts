import { Inject, Injectable } from '@nestjs/common';
import {
  TransactionBuilder,
  Transaction,
  FeeBumpTransaction,
  Keypair,
  Networks,
  Operation,
  xdr as StellarXdr,
  rpc,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

const STARTING_BALANCE = '2'; // base reserve + buffer for future trustlines

@Injectable()
export class StellarService {
  private readonly passphrase: string;
  private readonly server: rpc.Server;
  private readonly sponsor: Keypair;

  constructor(@Inject(APP_CONFIG) config: Env, server?: rpc.Server) {
    this.passphrase =
      config.stellarNetwork === 'public' ? Networks.PUBLIC : Networks.TESTNET;
    this.server = server ?? new rpc.Server(config.sorobanRpcUrl);
    this.sponsor = Keypair.fromSecret(config.feeSponsorSecretKey);
  }

  hashForSigning(xdr: string): { hash: string } {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    return { hash: '0x' + tx.hash().toString('hex') };
  }

  /** Creates the account on-chain (sponsor pays) if it doesn't exist. Idempotent. */
  async ensureAccountFunded(address: string): Promise<void> {
    if (await this.exists(address)) return;
    const source = await this.server.getAccount(this.sponsor.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase,
    })
      .addOperation(
        Operation.createAccount({ destination: address, startingBalance: STARTING_BALANCE }),
      )
      .setTimeout(30)
      .build();
    tx.sign(this.sponsor);
    await this.submit(tx);
  }

  /** Attaches the user's signature, wraps in a sponsor-paid fee bump, submits. */
  async attachAndSubmit(
    xdr: string,
    stellarAddress: string,
    signatureHex: string,
  ): Promise<{ txHash: string }> {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase) as Transaction;
    const kp = Keypair.fromPublicKey(stellarAddress);
    tx.signatures.push(
      new StellarXdr.DecoratedSignature({
        hint: kp.signatureHint(),
        signature: Buffer.from(signatureHex.replace(/^0x/, ''), 'hex'),
      }),
    );
    // baseFee × (ops + 1) must cover the inner fee (Soroban resource fees are large).
    const baseFee = Math.max(
      Number(BASE_FEE),
      Math.ceil(Number(tx.fee) / (tx.operations.length + 1)),
    ).toString();
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      this.sponsor,
      baseFee,
      tx,
      this.passphrase,
    );
    feeBump.sign(this.sponsor);
    return { txHash: await this.submit(feeBump) };
  }

  private async exists(address: string): Promise<boolean> {
    try {
      await this.server.getAccount(address);
      return true;
    } catch {
      return false;
    }
  }

  /** Sends a signed tx, polls to a terminal ledger state, returns the hash. */
  private async submit(tx: Transaction | FeeBumpTransaction): Promise<string> {
    const sent = await this.server.sendTransaction(tx);
    if (sent.status === 'ERROR') {
      throw new Error(`submit rejected by RPC: ${JSON.stringify(sent.errorResult)}`);
    }
    if (sent.status === 'TRY_AGAIN_LATER') {
      throw new Error('submit throttled by RPC (TRY_AGAIN_LATER); retry later');
    }
    const final = await this.server.pollTransaction(sent.hash, { attempts: 30 });
    if (final.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      throw new Error(
        `tx ${sent.hash} not confirmed after polling — still pending on-chain`,
      );
    }
    if (final.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(
        `tx ${sent.hash} failed on-chain: ${final.resultXdr.result().switch().name}`,
      );
    }
    return sent.hash;
  }
}
