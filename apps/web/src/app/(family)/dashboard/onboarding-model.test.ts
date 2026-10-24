/**
 * Módulo: onboarding-model
 * Criado em: 2026-10-21
 * Última atualização: 2026-10-22
 * Intuito: Nível, interruptores e experiência de cripto saem das respostas, inclusive quando se pula.
 * Sequência: hides experience until the person has bought crypto; maps answers to the four levels; uses the skipped-answer defaults; derives the lesson track from the level and the learn switch; builds the skipped request without a name.
 */
import { describe, expect, it } from 'vitest';
import {
  completionBody,
  defaultSwitches,
  onboardingLevel,
  questionSteps,
  cryptoExperienceFor,
  EMPTY_DRAFT,
} from './onboarding-model';

describe('onboarding rules', () => {
  it('hides experience until the person has bought crypto', () => {
    expect(questionSteps(null)).not.toContain('experience');
    expect(questionSteps('nunca')).not.toContain('experience');
    expect(questionSteps('ouvi')).not.toContain('experience');
    expect(questionSteps('comprei')).toContain('experience');
    expect(questionSteps('frequente')).toContain('experience');
  });

  it('maps answers to the four levels', () => {
    expect(onboardingLevel([], null, [])).toBe('fora');
    expect(onboardingLevel([], 'nunca', [])).toBe('fora');
    expect(onboardingLevel(['aprender'], 'nunca', [])).toBe('curioso');
    expect(onboardingLevel([], 'ouvi', [])).toBe('curioso');
    expect(onboardingLevel([], 'comprei', [])).toBe('praticante');
    expect(onboardingLevel([], 'comprei', ['rendimento'])).toBe('avancado');
    expect(onboardingLevel([], 'comprei', ['autocustodia'])).toBe('avancado');
    expect(onboardingLevel([], 'frequente', [])).toBe('avancado');
  });

  it('uses the skipped-answer defaults', () => {
    expect(defaultSwitches([], null)).toEqual({
      showFreedom: true,
      showFamily: false,
      learnCrypto: false,
    });
    expect(defaultSwitches(['reserva', 'familia'], 'ouvi')).toEqual({
      showFreedom: true,
      showFamily: true,
      learnCrypto: true,
    });
  });

  it('derives the lesson track from the level and the learn switch', () => {
    expect(cryptoExperienceFor('fora', false)).toBe('declined');
    expect(cryptoExperienceFor('fora', true)).toBe('beginner');
    expect(cryptoExperienceFor('curioso', true)).toBe('beginner');
    expect(cryptoExperienceFor('praticante', true)).toBe('fund');
    expect(cryptoExperienceFor('avancado', false)).toBe('declined');
  });

  it('builds the skipped request without a name', () => {
    expect(completionBody(EMPTY_DRAFT, defaultSwitches([], null))).toEqual({
      fullName: null,
      displayName: null,
      goals: [],
      importMode: null,
      cryptoFamiliarity: null,
      cryptoActions: [],
      showFreedom: true,
      showFamily: false,
      learnCrypto: false,
    });
  });
});
