// Named re-exports on purpose. Node's require() of this ESM entry drops `export *`,
// so Nest would see isMature and gradeQuiz as missing.
export {
  CRYPTO_ACTIONS,
  CRYPTO_FAMILIARITY,
  IMPORT_MODES,
  ONBOARDING_GOALS,
  countedActions,
  cryptoExperienceFor,
  defaultSwitches,
  familiarityIndex,
  hasCryptoInterest,
  isMature,
  onboardingLevel,
  questionSteps,
  unlocks,
} from './onboarding.ts';

export { LESSON_QUIZ_ANSWERS, gradeQuiz } from './lesson-quiz.ts';

export { accountInitials, personInitials } from './household.ts';
