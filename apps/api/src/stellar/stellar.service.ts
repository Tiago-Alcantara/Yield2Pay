import { Inject, Injectable } from '@nestjs/common';
import {
  TransactionBuilder,
  Keypair,
  Networks,
  xdr as StellarXdr,
  rpc,
} from '@stellar/stellar-sdk';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

@Injectable()
export class StellarService {
  private readonly passphrase: string;
  // Reusado entre requests: criar um rpc.Server por chamada adiciona overhead
  // de setup/conexão desnecessário a cada submit.
  private readonly server: rpc.Server;
  constructor(@Inject(APP_CONFIG) private readonly config: Env) {
    this.passphrase =
      config.stellarNetwork === 'public' ? Networks.PUBLIC : Networks.TESTNET;
    this.server = new rpc.Server(config.sorobanRpcUrl);
  }

  hashForSigning(xdr: string): { hash: string } {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    return { hash: '0x' + tx.hash().toString('hex') };
  }

  async attachAndSubmit(
    xdr: string,
    stellarAddress: string,
    signatureHex: string,
  ): Promise<{ txHash: string }> {
    const tx = TransactionBuilder.fromXDR(xdr, this.passphrase);
    const kp = Keypair.fromPublicKey(stellarAddress);
    const sig = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');
    const decorated = new StellarXdr.DecoratedSignature({
      hint: kp.signatureHint(),
      signature: sig,
    });
    tx.signatures.push(decorated);

    const sent = await this.server.sendTransaction(tx);

    // sendTransaction only reports whether the RPC *accepted* the tx into its
    // mempool. A Soroban contract invoke (deposit/withdraw) is asynchronous:
    // the network returns PENDING and the real on-chain outcome is only known
    // after polling getTransaction. We must NOT treat PENDING as success — a
    // tx can be accepted here and still FAIL on-chain.
    if (sent.status === 'ERROR') {
      throw new Error(
        `submit rejected by RPC: ${JSON.stringify(sent.errorResult)}`,
      );
    }
    if (sent.status === 'TRY_AGAIN_LATER') {
      throw new Error('submit throttled by RPC (TRY_AGAIN_LATER); retry later');
    }
    // PENDING or DUPLICATE → poll until the tx reaches a terminal ledger state.

    const final = await this.server.pollTransaction(sent.hash, {
      attempts: 30,
    });

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

    // status === SUCCESS — tx is confirmed in a ledger.
    return { txHash: sent.hash };
  }
}
