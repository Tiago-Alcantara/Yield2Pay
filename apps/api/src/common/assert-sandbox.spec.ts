import { ForbiddenException } from '@nestjs/common';
import { assertSandboxEnabled } from './assert-sandbox';

it('allows sandbox outside production', () => {
  expect(() => assertSandboxEnabled('development')).not.toThrow();
  expect(() => assertSandboxEnabled('staging')).not.toThrow();
});

it('forbids sandbox in production', () => {
  expect(() => assertSandboxEnabled('production')).toThrow(ForbiddenException);
});
