import { ForbiddenException } from '@nestjs/common';
import { RampController } from './ramp.controller';

function makeController(appEnv: 'production' | 'staging') {
  const ramp = {
    markKycApproved: vi.fn().mockResolvedValue(undefined),
    simulateFiatReceived: vi.fn().mockResolvedValue(undefined),
  };
  const config = { appEnv };
  return {
    ctrl: new RampController(ramp as any, config as any),
    ramp,
  };
}

it('blocks kyc-approved in production before calling the service', async () => {
  const { ctrl, ramp } = makeController('production');
  await expect(
    ctrl.markKycApproved({ companyId: 'co_1' } as any),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(ramp.markKycApproved).not.toHaveBeenCalled();
});

it('blocks onramp/simulate in production before calling the service', async () => {
  const { ctrl, ramp } = makeController('production');
  await expect(
    ctrl.simulateFiatReceived({ companyId: 'co_1' } as any, { orderId: 'o1' }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(ramp.simulateFiatReceived).not.toHaveBeenCalled();
});

it('delegates kyc-approved in staging', async () => {
  const { ctrl, ramp } = makeController('staging');
  await ctrl.markKycApproved({ companyId: 'co_1' } as any);
  expect(ramp.markKycApproved).toHaveBeenCalledWith('co_1');
});
