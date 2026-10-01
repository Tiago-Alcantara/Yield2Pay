import { AuthBoundary } from '@privy-io/expo';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { BiometricGate } from '../../src/components/BiometricGate';
import { Loading, Screen, Title } from '../../src/components/ui';
import { privyConfig } from '../../src/config';
import { consumePendingRoute } from '../../src/lib/pendingRoute';
import { colors } from '../../src/theme';

export default function AppLayout() {
  if (!privyConfig().configured) {
    return <Redirect href="/sign-in" />;
  }
  return <Protected />;
}

function Protected() {
  return (
    <AuthBoundary
      loading={<Loading />}
      error={(error) => (
        <Screen>
          <Title>Não foi possível entrar</Title>
          <Text style={{ color: colors.danger }}>{error.message}</Text>
        </Screen>
      )}
      unauthenticated={<Redirect href="/sign-in" />}
    >
      <AuthedTabs />
    </AuthBoundary>
  );
}

function AuthedTabs() {
  const router = useRouter();

  useEffect(() => {
    const pending = consumePendingRoute();
    if (pending) router.replace(pending);
  }, [router]);

  return (
    <BiometricGate>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.chrome,
          tabBarInactiveTintColor: colors.text3,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Painel' }} />
        <Tabs.Screen name="bills" options={{ title: 'Contas' }} />
        <Tabs.Screen name="deposit" options={{ title: 'Depositar' }} />
        <Tabs.Screen name="withdraw" options={{ title: 'Sacar' }} />
      </Tabs>
    </BiometricGate>
  );
}
