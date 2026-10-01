import { PrivyProvider } from '@privy-io/expo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { privyConfig } from '../src/config';
import { colors } from '../src/theme';

export default function RootLayout() {
  const { configured, appId, clientId } = privyConfig();
  const stack = (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </GestureHandlerRootView>
  );

  if (!configured) return stack;

  return (
    <PrivyProvider appId={appId} clientId={clientId}>
      {stack}
    </PrivyProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
