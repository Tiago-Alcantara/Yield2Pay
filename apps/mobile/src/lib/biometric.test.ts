import { describe, expect, it, vi } from 'vitest';
import { confirmBiometric, confirmIfRequired, type BiometricPrompt } from './biometric';

function prompt(overrides: Partial<BiometricPrompt> = {}): BiometricPrompt {
  return {
    hasHardware: vi.fn().mockResolvedValue(true),
    isEnrolled: vi.fn().mockResolvedValue(true),
    authenticate: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('confirmBiometric', () => {
  it('aceita quando a biometria confirma', async () => {
    await expect(confirmBiometric(prompt(), 'Assinar')).resolves.toBeUndefined();
  });

  it('recusa aparelho sem biometria', async () => {
    await expect(
      confirmBiometric(prompt({ hasHardware: vi.fn().mockResolvedValue(false) }), 'Assinar'),
    ).rejects.toThrow(/biometria/);
  });

  it('recusa quando a pessoa cancela', async () => {
    await expect(
      confirmBiometric(prompt({ authenticate: vi.fn().mockResolvedValue(false) }), 'Assinar'),
    ).rejects.toThrow(/cancelada/);
  });
});

describe('confirmIfRequired', () => {
  it('não chama o aparelho quando a trava está desligada', async () => {
    const gate = prompt();
    await confirmIfRequired(gate, 'Abrir', false);
    expect(gate.hasHardware).not.toHaveBeenCalled();
  });
});
