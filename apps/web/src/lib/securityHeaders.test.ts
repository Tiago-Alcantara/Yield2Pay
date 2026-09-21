import { SECURITY_HEADERS } from './securityHeaders';

function value(key: string) {
  return SECURITY_HEADERS.find((header) => header.key === key)?.value;
}

it('denies framing and sniffing', () => {
  expect(value('X-Frame-Options')).toBe('DENY');
  expect(value('X-Content-Type-Options')).toBe('nosniff');
});

it('sends HSTS and a strict referrer policy', () => {
  expect(value('Strict-Transport-Security')).toBe(
    'max-age=63072000; includeSubDomains; preload',
  );
  expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
});

it('disables camera microphone and geolocation', () => {
  expect(value('Permissions-Policy')).toBe(
    'camera=(), microphone=(), geolocation=()',
  );
});
