import { describe, expect, it } from 'vitest';
import { createAppLock } from './appLock';

describe('createAppLock', () => {
  it('começa travado e destrava só depois do unlock', () => {
    const lock = createAppLock();
    expect(lock.isLocked()).toBe(true);
    lock.unlock();
    expect(lock.isLocked()).toBe(false);
  });

  it('trava de novo quando o app vai para o fundo', () => {
    const lock = createAppLock();
    lock.unlock();
    lock.onPresence('inactive');
    expect(lock.isLocked()).toBe(false);
    lock.onPresence('background');
    expect(lock.isLocked()).toBe(true);
  });
});
