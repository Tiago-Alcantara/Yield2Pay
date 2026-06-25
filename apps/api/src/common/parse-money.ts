import { BadRequestException } from '@nestjs/common';

/**
 * Parse a string representing a monetary amount in base units (e.g. stroops/cents)
 * into a bigint.
 *
 * Rules:
 *  - Must be a non-empty string of digits (no decimal point, no sign, no whitespace)
 *  - Must be > 0
 *
 * Throws BadRequestException for any invalid input.
 */
export function parseBaseUnits(raw: string | undefined | null): bigint {
  if (raw === undefined || raw === null || raw === '') {
    throw new BadRequestException('amount is required');
  }

  if (!/^\d+$/.test(raw)) {
    throw new BadRequestException(
      'amount must be a non-negative integer string (base units)',
    );
  }

  const value = BigInt(raw);

  if (value <= 0n) {
    throw new BadRequestException('amount must be greater than zero');
  }

  return value;
}
