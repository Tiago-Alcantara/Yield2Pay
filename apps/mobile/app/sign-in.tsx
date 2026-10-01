import { useLoginWithOAuth } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { LEGAL_NOTE, privyConfig } from '../src/config';
import { Body, ChromeButton, ErrorText, Eyebrow, GhostButton, Screen, Title } from '../src/components/ui';
import { errorMessage } from '../src/api/client';
import { colors } from '../src/theme';

export default function SignInScreen() {
  if (!privyConfig().configured) return <MissingPrivy />;
  return <OAuthSignIn />;
}

function MissingPrivy() {
  return (
    <Screen>
      <Eyebrow>Yield2Pay</Eyebrow>
      <Title>Falta configurar o login</Title>
      <Body>
        Defina EXPO_PUBLIC_PRIVY_APP_ID e EXPO_PUBLIC_PRIVY_CLIENT_ID no app de produção da Privy, com o bundle com.yield2pay.app.
      </Body>
    </Screen>
  );
}

function OAuthSignIn() {
  const router = useRouter();
  const { login, state } = useLoginWithOAuth();
  const [error, setError] = useState<string | null>(null);
  const busy = state.status === 'loading';

  async function enter(provider: 'google' | 'apple') {
    setError(null);
    try {
      await login({ provider });
      router.replace('/(app)');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <Screen>
      <Eyebrow>Yield2Pay</Eyebrow>
      <Title>O rendimento paga as contas.</Title>
      <Body>O principal continua seu. Entre para ver o percentual de liberdade da sua casa.</Body>
      <ChromeButton label={busy ? 'Entrando…' : 'Continuar com Google'} onPress={() => void enter('google')} disabled={busy} />
      {Platform.OS === 'ios' ? (
        <GhostButton label="Continuar com Apple" onPress={() => void enter('apple')} />
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Text style={styles.legal}>{LEGAL_NOTE}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legal: { color: colors.text3, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
