import { classifyMerchant, isFixedRepeat } from './classify';

it('maps grocery keywords and falls back to shopping', () => {
  expect(classifyMerchant('Supermercado Dia')).toBe('groceries');
  expect(classifyMerchant('PIX enviado')).toBe('shopping');
});

it('maps Brazilian merchants that the short keyword list used to miss', () => {
  expect(classifyMerchant('Padaria Estrela')).toBe('groceries');
  expect(classifyMerchant('ENEL SP')).toBe('housing');
  expect(classifyMerchant('Vivo Celular')).toBe('subscriptions');
  expect(classifyMerchant('iFood *Burger')).toBe('restaurant');
  expect(classifyMerchant('Drogaria Sao Paulo')).toBe('health');
  expect(classifyMerchant('99 POP')).toBe('transport');
  expect(classifyMerchant('Farmácia Raia')).toBe('health');
});

it('treats a repeat within 5 percent as fixed', () => {
  expect(isFixedRepeat(10000, 10400)).toBe(true);
  expect(isFixedRepeat(10000, 10600)).toBe(false);
});
