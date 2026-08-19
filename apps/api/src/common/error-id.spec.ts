import { generateErrorId, generateRequestId } from './error-id';

it('generates an error id in the ERR-XXXX-XXXX format', () => {
  expect(generateErrorId()).toMatch(/^ERR-[0-9A-F]{4}-[0-9A-F]{4}$/);
});

it('generates a distinct error id on each call', () => {
  const ids = new Set(Array.from({ length: 50 }, () => generateErrorId()));
  expect(ids.size).toBe(50);
});

it('generates a request id prefixed with req_', () => {
  expect(generateRequestId()).toMatch(/^req_[0-9a-z]{8,}$/);
});
