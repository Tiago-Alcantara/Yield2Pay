import { toBaseUnits, type Bill, type BillType } from '@yield2pay/shared';
import { formatUsdc } from '@yield2pay/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../../src/api/client';
import { useYieldApi } from '../../src/auth/useYieldApi';
import { Card, ChromeButton, ErrorText, Eyebrow, Field, Loading, Screen, Title } from '../../src/components/ui';
import { colors } from '../../src/theme';

const TYPES: Array<{ id: BillType; label: string }> = [
  { id: 'software', label: 'Software' },
  { id: 'utility', label: 'Conta' },
  { id: 'other', label: 'Outro' },
];

export default function BillsScreen() {
  const { api } = useYieldApi();
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<BillType>('other');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setBills(await api.listBills());
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function add() {
    setError(null);
    try {
      await api.createBill({ vendor: vendor.trim(), monthlyCost: toBaseUnits(amount.trim()), type });
      setVendor('');
      setAmount('');
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.deleteBill(id);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <Screen>
      <Eyebrow>Prioridade</Eyebrow>
      <Title>Contas do mês</Title>
      {loading ? <Loading /> : null}
      {bills.map((bill) => (
        <Card key={bill.id}>
          <Text style={styles.vendor}>{bill.vendor}</Text>
          <Text style={styles.meta}>{formatUsdc(String(bill.monthlyCost)).replace('.', ',')} USDC · {bill.type}</Text>
          <Pressable accessibilityRole="button" onPress={() => void remove(bill.id)}>
            <Text style={styles.remove}>Remover</Text>
          </Pressable>
        </Card>
      ))}
      {!loading && bills.length === 0 ? <Text style={styles.meta}>Nenhuma conta ainda. A primeira da lista é a prioridade.</Text> : null}
      <Field label="Nome" value={vendor} onChangeText={setVendor} placeholder="Netflix" />
      <Field label="Valor mensal em USDC" value={amount} onChangeText={setAmount} placeholder="59.90" keyboardType="decimal-pad" />
      <View style={styles.types}>
        {TYPES.map((item) => (
          <Pressable key={item.id} onPress={() => setType(item.id)} style={[styles.type, type === item.id && styles.typeOn]}>
            <Text style={[styles.typeLabel, type === item.id && styles.typeLabelOn]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <ChromeButton label="Adicionar conta" onPress={() => void add()} disabled={!vendor.trim() || !amount.trim()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  vendor: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.text2, fontSize: 14 },
  remove: { color: colors.danger, marginTop: 6 },
  types: { flexDirection: 'row', gap: 8 },
  type: { borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  typeOn: { backgroundColor: colors.chrome },
  typeLabel: { color: colors.text, fontSize: 14 },
  typeLabelOn: { color: colors.ink },
});
