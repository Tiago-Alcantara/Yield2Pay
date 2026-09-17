import { formatUsdc, toBaseUnits, toBaseUnitsForVenue } from './money';

describe('formatUsdc (display: 2 decimals)', () => {
  it('always renders exactly 2 decimal places, rounding half-up', () => {
    expect(formatUsdc('10750000')).toBe('1.08');       // 1.075 → 1.08
  });
  it('rounds sub-unit values to 2 dp', () => {
    expect(formatUsdc('75000')).toBe('0.01');          // 0.0075 → 0.01
  });
  it('formats zero', () => {
    expect(formatUsdc('0')).toBe('0.00');
  });
  it('formats large values without precision loss', () => {
    expect(formatUsdc('9000000000000')).toBe('900000.00');
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

describe('toBaseUnitsForVenue', () => {
  it('converts Solana USDC with 6 decimals', () => {
    expect(toBaseUnitsForVenue('10.25', 6)).toBe('10250000');
  });

  it('converts Stellar USDC with 7 decimals', () => {
    expect(toBaseUnitsForVenue('10.25', 7)).toBe('102500000');
  });

  it('rejects precision beyond the venue decimals', () => {
    expect(() => toBaseUnitsForVenue('1.1234567', 6)).toThrow(
      'too many decimals',
    );
  });
});
