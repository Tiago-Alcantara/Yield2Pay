import { classifyMerchant, isFixedRepeat } from './classify';

it('maps grocery keywords and falls back to shopping', () => {
  expect(classifyMerchant('Supermercado Dia')).toBe('groceries');
  expect(classifyMerchant('Padaria')).toBe('shopping');
});

it('treats a repeat within 5 percent as fixed', () => {
  expect(isFixedRepeat(10000, 10400)).toBe(true);
  expect(isFixedRepeat(10000, 10600)).toBe(false);
});
