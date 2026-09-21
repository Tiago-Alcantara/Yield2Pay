import { ForbiddenException } from '@nestjs/common';
import type { AppEnv } from '@yield2pay/shared';

export function assertSandboxEnabled(appEnv: AppEnv): void {
  if (appEnv === 'production') {
    throw new ForbiddenException('sandbox routes are disabled in production');
  }
}
