import { toStellarAmount } from './format-amount';

it('converte valor inteiro de XLM sem casas decimais', () => {
  expect(toStellarAmount(100000000n)).toBe('10'); // 10 XLM
});

it('converte valor com fração', () => {
  expect(toStellarAmount(105000000n)).toBe('10.5'); // 10.5 XLM
});

it('converte o menor stroop', () => {
  expect(toStellarAmount(1n)).toBe('0.0000001');
});

it('remove zeros à direita da fração', () => {
  expect(toStellarAmount(100500000n)).toBe('10.05'); // 10.05 XLM
});

it('converte valor sub-unitário', () => {
  expect(toStellarAmount(5000000n)).toBe('0.5'); // 0.5 XLM
});

it('lança para zero ou negativo (fora de contrato)', () => {
  expect(() => toStellarAmount(0n)).toThrow();
  expect(() => toStellarAmount(-1n)).toThrow();
});
