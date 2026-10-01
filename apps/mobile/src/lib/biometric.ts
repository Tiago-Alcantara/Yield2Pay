export interface BiometricPrompt {
  hasHardware(): Promise<boolean>;
  isEnrolled(): Promise<boolean>;
  authenticate(message: string): Promise<boolean>;
}

export async function confirmBiometric(prompt: BiometricPrompt, message: string): Promise<void> {
  const hardware = await prompt.hasHardware();
  if (!hardware) {
    throw new Error('Este aparelho não tem biometria. Use um celular com bloqueio de tela.');
  }
  const enrolled = await prompt.isEnrolled();
  if (!enrolled) {
    throw new Error('Ative a biometria ou o bloqueio de tela para continuar.');
  }
  const ok = await prompt.authenticate(message);
  if (!ok) throw new Error('Autenticação cancelada.');
}

export async function confirmIfRequired(
  prompt: BiometricPrompt,
  message: string,
  required: boolean,
): Promise<void> {
  if (!required) return;
  await confirmBiometric(prompt, message);
}
