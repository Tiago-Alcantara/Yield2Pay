import * as LocalAuthentication from 'expo-local-authentication';
import { biometricRequired } from '../config';
import { confirmIfRequired, type BiometricPrompt } from './biometric';

export const devicePrompt: BiometricPrompt = {
  hasHardware: () => LocalAuthentication.hasHardwareAsync(),
  isEnrolled: () => LocalAuthentication.isEnrolledAsync(),
  async authenticate(message: string) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar senha',
      disableDeviceFallback: false,
    });
    return result.success;
  },
};

export function requireBiometric(message: string): Promise<void> {
  return confirmIfRequired(devicePrompt, message, biometricRequired());
}
