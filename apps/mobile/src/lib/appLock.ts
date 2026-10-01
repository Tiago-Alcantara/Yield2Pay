export type AppPresence = 'active' | 'background' | 'inactive';

/** Trava o app quando ele vai para o fundo e pede biometria ao voltar. */
export function createAppLock() {
  let locked = true;
  return {
    isLocked: () => locked,
    lock: () => {
      locked = true;
    },
    unlock: () => {
      locked = false;
    },
    onPresence(state: AppPresence) {
      if (state === 'background') locked = true;
    },
  };
}
