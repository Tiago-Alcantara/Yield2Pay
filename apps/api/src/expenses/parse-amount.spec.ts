import { parseAmountToCents } from './parse-amount';

it('parses Brazilian and dot amounts to centavos', () => {
  expect(parseAmountToCents('R$ 1.234,56')).toBe(123456);
  expect(parseAmountToCents('1234.56')).toBe(123456);
  expect(parseAmountToCents('-10.50')).toBe(1050);
});
