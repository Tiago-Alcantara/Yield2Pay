/**
 * Módulo: shared-entry
 * Criado em: 2026-10-21
 * Última atualização: 2026-10-22
 * Intuito: O require() do pacote compartilhado enxerga as funções que o Nest usa.
 * Sequência: exposes the onboarding helpers Nest loads with require().
 */
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);

describe('@yield2pay/shared CommonJS entry', () => {
  it('exposes the onboarding helpers Nest loads with require()', () => {
    const shared = nodeRequire('@yield2pay/shared') as {
      isMature?: (value: string | null) => boolean;
      onboardingLevel?: unknown;
      cryptoExperienceFor?: unknown;
      gradeQuiz?: unknown;
    };

    expect(typeof shared.isMature).toBe('function');
    expect(shared.isMature?.('comprei')).toBe(true);
    expect(shared.isMature?.('ouvi')).toBe(false);
    expect(typeof shared.onboardingLevel).toBe('function');
    expect(typeof shared.cryptoExperienceFor).toBe('function');
    expect(typeof shared.gradeQuiz).toBe('function');
  });
});
