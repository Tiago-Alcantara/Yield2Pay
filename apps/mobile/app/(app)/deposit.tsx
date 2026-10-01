import { useRef, useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { errorMessage } from '../../src/api/client';
import { useYieldApi } from '../../src/auth/useYieldApi';
import { Body, Card, ChromeButton, ErrorText, Eyebrow, Field, GhostButton, Screen, Title } from '../../src/components/ui';
import { rampSimulateEnabled } from '../../src/config';
import { requireBiometric } from '../../src/lib/biometricDevice';
import { createDepositJourney } from '../../src/lib/moneyJourneys';
import { colors } from '../../src/theme';

export default function DepositScreen() {
  const { api, signer, profile } = useYieldApi();
  const journey = useRef(createDepositJourney()).current;
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<'idle' | 'awaiting' | 'ready' | 'done'>('idle');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const order = journey.getOrder();

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await journey.start(api, profile, amount.trim());
      setPhase('awaiting');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function refresh(simulate: boolean) {
    setBusy(true);
    setError(null);
    try {
      const status = await journey.waitForFiat(api, simulate);
      setPhase('ready');
      setNote(status === 'funded' ? 'Transferência reconhecida.' : 'Ainda não reconhecemos a transferência. Você pode tentar de novo.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const txHash = await journey.confirm(api, signer, { confirm: requireBiometric });
      setPhase('done');
      setNote(`Depósito no cofre: ${txHash}`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Eyebrow>Entrada</Eyebrow>
      <Title>Depositar</Title>
      <Body>O valor em reais vira USDC e entra no cofre. Só o rendimento paga as contas.</Body>
      {phase === 'idle' ? (
        <>
          <Field label="Valor em reais" value={amount} onChangeText={setAmount} placeholder="100.00" keyboardType="decimal-pad" />
          <ChromeButton label={busy ? 'Preparando…' : 'Gerar transferência'} onPress={() => void start()} disabled={busy || !amount.trim()} />
        </>
      ) : null}
      {order && phase !== 'idle' && phase !== 'done' ? (
        <Card>
          <Text style={styles.label}>Banco</Text>
          <Text style={styles.value}>{order.depositBankName}</Text>
          <Text style={styles.label}>Conta para transferência</Text>
          <Text style={styles.value}>{order.depositClabe}</Text>
          <Text style={styles.label}>USDC a receber</Text>
          <Text style={styles.value}>{order.targetAmount}</Text>
          <GhostButton label="Abrir status" onPress={() => void Linking.openURL(order.statusPage)} />
        </Card>
      ) : null}
      {phase === 'awaiting' || phase === 'ready' ? (
        <>
          <ChromeButton label={busy ? 'Consultando…' : 'Já transferi'} onPress={() => void refresh(false)} disabled={busy} />
          {rampSimulateEnabled() ? (
            <GhostButton label="Simular transferência (sandbox)" onPress={() => void refresh(true)} />
          ) : null}
        </>
      ) : null}
      {phase === 'ready' ? (
        <ChromeButton label={busy ? 'Assinando…' : 'Guardar no cofre'} onPress={() => void confirm()} disabled={busy} />
      ) : null}
      {phase === 'done' ? <GhostButton label="Novo depósito" onPress={() => { journey.reset(); setPhase('idle'); setNote(null); }} /> : null}
      {note ? <Body>{note}</Body> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text3, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 18 },
});
