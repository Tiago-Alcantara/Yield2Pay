/**
 * Módulo: wallet-address
 * Criado em: 2026-11-04
 * Última atualização: 2026-11-04
 * Intuito: Só endereço público com checksum entra, chave secreta nunca, e o endereço só sai mascarado.
 * Sequência: aceita G com checksum; aceita M e separa a conta do muxed id; recusa S, checksum errado, texto e tipos estranhos sem ecoar o valor; mascara G e M; os emissores do USDC da Circle têm checksum válido; acha chave Stellar num texto livre; a conta em centavos não passa por float.
 */
import { StrKey } from '@stellar/stellar-sdk';
import {
  OTHER_G,
  SECRET_S,
  WALLET_G,
  WALLET_M42,
} from '../../test/wallet-fixtures';
import { USDC_CIRCLE_ISSUER } from './classify-operation';
import {
  containsStellarKey,
  maskWalletAddress,
  parseWalletAddress,
} from './wallet-address';
import {
  priceCentsPerUnit,
  stroopsToQuantity,
  valueInCents,
} from './wallet-money';
import { WalletInvalidError } from './wallet.errors';

describe('parseWalletAddress', () => {
  it('aceita G com checksum', () => {
    expect(parseWalletAddress(` ${WALLET_G} `)).toEqual({
      accountId: WALLET_G,
      muxedId: null,
    });
  });

  it('aceita M e separa a conta do muxed id', () => {
    expect(parseWalletAddress(WALLET_M42)).toEqual({
      accountId: WALLET_G,
      muxedId: '42',
    });
  });

  const wrongChecksum = `${WALLET_G.slice(0, -1)}${WALLET_G.endsWith('A') ? 'B' : 'A'}`;
  it.each([
    ['chave secreta', SECRET_S],
    ['checksum errado', wrongChecksum],
    ['texto', 'minha carteira'],
    ['vazio', ''],
    ['número', 42],
    ['nulo', null],
    ['objeto', { address: WALLET_G }],
  ])('recusa %s com o erro genérico, sem ecoar o valor', (_name, value) => {
    let caught: unknown;
    try {
      parseWalletAddress(value);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(WalletInvalidError);
    const text = `${(caught as Error).message} ${(caught as Error).stack}`;
    expect(text).not.toContain(SECRET_S);
    expect(text).not.toContain(wrongChecksum);
  });
});

describe('maskWalletAddress', () => {
  it('mascara G e M', () => {
    expect(maskWalletAddress(WALLET_G, null)).toBe(`G...${WALLET_G.slice(-4)}`);
    expect(maskWalletAddress(WALLET_G, '42')).toBe(
      `M...${WALLET_M42.slice(-4)}`,
    );
  });
});

describe('constantes e textos', () => {
  it('os emissores do USDC da Circle têm checksum válido', () => {
    expect(StrKey.isValidEd25519PublicKey(USDC_CIRCLE_ISSUER.public)).toBe(
      true,
    );
    expect(StrKey.isValidEd25519PublicKey(USDC_CIRCLE_ISSUER.testnet)).toBe(
      true,
    );
  });

  it('acha chave Stellar num texto livre', () => {
    expect(containsStellarKey(`minha ${SECRET_S}`)).toBe(true);
    expect(containsStellarKey(OTHER_G.slice(0, 35))).toBe(true);
    expect(containsStellarKey('Nubank da família')).toBe(false);
    expect(containsStellarKey('POUPANCA')).toBe(false);
  });
});

describe('contas em centavos', () => {
  it('não passa por float', () => {
    // 0.1 + 0.2 em float daria 0.30000000000000004.
    expect(priceCentsPerUnit('0.3', '5.4321')).toBe('162.9630000');
    expect(priceCentsPerUnit('1', '5.1234')).toBe('512.3400000');
    expect(valueInCents('10.5', '250.0000000')).toBe(2625);
    expect(valueInCents('0.0000100', '250.0000000')).toBe(0);
    expect(valueInCents('0.0199', '100.0000000')).toBe(2);
    expect(stroopsToQuantity('100')).toBe('0.0000100');
    expect(stroopsToQuantity(12_345_678n)).toBe('1.2345678');
  });

  it('valor acima da coluna não vira linha', () => {
    expect(valueInCents('922337203685.4775807', '250.0000000')).toBeNull();
  });
});
