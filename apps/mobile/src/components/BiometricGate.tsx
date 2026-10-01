import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { requireBiometric } from '../lib/biometricDevice';
import { createAppLock } from '../lib/appLock';
import { colors } from '../theme';
import { ChromeButton, Title } from './ui';

export function BiometricGate({ children }: { children: ReactNode }) {
  const lock = useRef(createAppLock()).current;
  const prompting = useRef(false);
  const [locked, setLocked] = useState(true);
  const [message, setMessage] = useState('Confirme que é você para abrir o Yield2Pay.');

  const unlock = useCallback(async () => {
    if (prompting.current || !lock.isLocked()) return;
    prompting.current = true;
    try {
      await requireBiometric('Desbloqueie o Yield2Pay');
      lock.unlock();
      setLocked(false);
    } catch (error) {
      lock.lock();
      setLocked(true);
      setMessage(error instanceof Error ? error.message : 'Não foi possível desbloquear.');
    } finally {
      prompting.current = false;
    }
  }, [lock]);

  useEffect(() => {
    void unlock();
  }, [unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'active' || state === 'inactive') {
        lock.onPresence(state);
      }
      if (state === 'background') setLocked(true);
      if (state === 'active' && lock.isLocked()) void unlock();
    });
    return () => subscription.remove();
  }, [lock, unlock]);

  if (!locked) return children;

  return (
    <View style={styles.lock}>
      <Text style={styles.mark}>Y2P</Text>
      <Title>Yield2Pay</Title>
      <Text style={styles.message}>{message}</Text>
      <ChromeButton label="Desbloquear" onPress={() => void unlock()} />
    </View>
  );
}

const styles = StyleSheet.create({
  lock: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  mark: { color: colors.silver, letterSpacing: 4, fontSize: 14 },
  message: { color: colors.text2, textAlign: 'center', fontSize: 16, lineHeight: 22 },
});
