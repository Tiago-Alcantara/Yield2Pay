import { formatUsdc, toBaseUnits } from './money';

describe('formatUsdc (7 decimals)', () => {
  it('formats whole + fraction, trimming trailing zeros', () => {
    expect(formatUsdc('10750000')).toBe('1.075');     // 1.0750000 → 1.075
  });
  it('formats sub-unit values', () => {
    expect(formatUsdc('75000')).toBe('0.0075');        // 0.0075000
  });
  it('formats zero', () => {
    expect(formatUsdc('0')).toBe('0');
  });
  it('formats large values without precision loss', () => {
    expect(formatUsdc('9000000000000')).toBe('900000');
  });
});

describe('toBaseUnits', () => {
  it('converts a human USDC string to 7-decimal base units', () => {
    expect(toBaseUnits('1.075')).toBe('10750000');
    expect(toBaseUnits('900000')).toBe('9000000000000');
  });
  it('rejects more than 7 decimal places', () => {
    expect(() => toBaseUnits('1.12345678')).toThrow();
  });
});
