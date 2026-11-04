import { Account, MuxedAccount, StrKey } from '@stellar/stellar-sdk';
import { WalletInvalidError } from './wallet.errors';

export type ParsedAddress = { accountId: string; muxedId: string | null };

/** Aceita só G ou M com checksum. Chave secreta e lixo caem no mesmo erro genérico. */
export function parseWalletAddress(raw: unknown): ParsedAddress {
  if (typeof raw !== 'string') throw new WalletInvalidError();
  const address = raw.trim();
  if (StrKey.isValidEd25519PublicKey(address)) {
    return { accountId: address, muxedId: null };
  }
  if (StrKey.isValidMed25519PublicKey(address)) {
    const muxed = MuxedAccount.fromAddress(address, '0');
    return {
      accountId: muxed.baseAccount().accountId(),
      muxedId: muxed.id(),
    };
  }
  throw new WalletInvalidError();
}

/**
 * Pedaço com cara de chave Stellar num texto livre, como o apelido. O apelido tem
 * até 40 caracteres, então a chave inteira já cai no limite de tamanho.
 */
export function containsStellarKey(text: string): boolean {
  return /[GMS][A-Z2-7]{30,}/.test(text);
}

/** G...ABCD. Numa carteira M, a máscara sai do endereço M. */
export function maskWalletAddress(
  accountId: string,
  muxedId: string | null,
): string {
  const address =
    muxedId == null
      ? accountId
      : new MuxedAccount(new Account(accountId, '0'), muxedId).accountId();
  return `${address.slice(0, 1)}...${address.slice(-4)}`;
}
