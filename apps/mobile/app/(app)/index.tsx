import { formatUsdc, type Bill, type SpendableView } from '@yield2pay/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../../src/api/client';
import { useYieldApi } from '../../src/auth/useYieldApi';
import { Body, Card, ErrorText, Eyebrow, GhostButton, Loading, Screen, Title } from '../../src/components/ui';
import { LEGAL_NOTE } from '../../src/config';
import { freedomSnapshot } from '../../src/lib/freedom';
import { colors } from '../../src/theme';

export default function DashboardScreen() {
  const { api, logout } = useYieldApi();
  const [dashboard, setDashboard] = useState<SpendableView | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextDashboard, nextBills] = await Promise.all([api.getDashboard(), api.listBills()]);
      setDashboard(nextDashboard);
      setBills(nextBills);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !dashboard) return <Loading />;

  const snapshot = dashboard
    ? freedomSnapshot({
        principalBaseUnits: dashboard.principal,
        apyPercent: dashboard.apyPercent,
        bills,
      })
    : null;

  return (
    <Screen>
      <Eyebrow>Percentual de liberdade</Eyebrow>
      <Title>{snapshot ? `${snapshot.freedom}%` : '—'}</Title>
      <Body>
        {snapshot
          ? `O rendimento cobre ${money(snapshot.yieldPerMonth)} de ${money(snapshot.monthly)} por mês.`
          : 'Não foi possível ler o cofre.'}
      </Body>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {dashboard ? (
        <Card>
          <Stat label="Principal" value={usdc(dashboard.principal)} />
          <Stat label="No cofre" value={usdc(dashboard.vaultValue)} />
          <Stat label="Rendimento disponível" value={usdc(dashboard.spendable)} />
          <Stat label="Taxa anual" value={`${dashboard.apyPercent}%`} />
        </Card>
      ) : null}
      {snapshot?.rows.map((row) => (
        <Card key={row.id}>
          <Text style={styles.vendor}>{row.name}</Text>
          <Text style={styles.meta}>
            {row.covered ? 'Coberta pelo rendimento' : `Faltam ${money(row.missing)} no depósito`}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, snapshot.freedom)}%` }]} />
          </View>
        </Card>
      ))}
      <GhostButton label="Sair" onPress={() => void logout()} />
      <Text style={styles.legal}>{LEGAL_NOTE}</Text>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function usdc(baseUnits: string): string {
  return `${formatUsdc(baseUnits).replace('.', ',')} USDC`;
}

function money(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} USDC`;
}

const styles = StyleSheet.create({
  vendor: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.text2, fontSize: 13 },
  value: { color: colors.text, fontSize: 18 },
  stat: { gap: 2 },
  track: { height: 4, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.chrome },
  legal: { color: colors.text3, fontSize: 12, lineHeight: 18 },
});
