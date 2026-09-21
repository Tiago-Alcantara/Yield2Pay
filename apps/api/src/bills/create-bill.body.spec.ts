import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBillBody } from './create-bill.body';

async function errorsOf(plain: Record<string, unknown>) {
  const instance = plainToInstance(CreateBillBody, plain);
  return validate(instance);
}

it('accepts a valid bill body', async () => {
  const errors = await errorsOf({
    vendor: 'OpenAI',
    monthlyCost: '2000000',
    type: 'software',
  });
  expect(errors).toHaveLength(0);
});

it('rejects an empty vendor', async () => {
  const errors = await errorsOf({
    vendor: '',
    monthlyCost: '1',
    type: 'software',
  });
  expect(errors.length).toBeGreaterThan(0);
});

it('rejects a vendor longer than 80 chars', async () => {
  const errors = await errorsOf({
    vendor: 'x'.repeat(81),
    monthlyCost: '1',
    type: 'software',
  });
  expect(errors.length).toBeGreaterThan(0);
});

it('rejects a non-digit monthlyCost', async () => {
  const errors = await errorsOf({
    vendor: 'OpenAI',
    monthlyCost: '12.5',
    type: 'software',
  });
  expect(errors.length).toBeGreaterThan(0);
});

it('rejects monthlyCost with more than 16 digits', async () => {
  const errors = await errorsOf({
    vendor: 'OpenAI',
    monthlyCost: '1'.repeat(17),
    type: 'software',
  });
  expect(errors.length).toBeGreaterThan(0);
});

it('rejects an unknown type', async () => {
  const errors = await errorsOf({
    vendor: 'OpenAI',
    monthlyCost: '1',
    type: 'saas',
  });
  expect(errors.length).toBeGreaterThan(0);
});
