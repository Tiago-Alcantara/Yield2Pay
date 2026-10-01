import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import { errorMessage } from '../../src/api/client';
import { useYieldApi } from '../../src/auth/useYieldApi';
import { Body, ChromeButton, ErrorText, Eyebrow, Field, GhostButton, Screen, Title } from '../../src/components/ui';
import { requireBiometric } from '../../src/lib/biometricDevice';
import { createWithdrawJourney } from '../../src/lib/moneyJourneys';

export default function WithdrawScreen() {
  const { api, signer, profile } = useYieldApi();
  const journey = useRef(createWithdrawJourney()).current;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const order = journey.getOrder();

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const result = await journey.start(api, signer, { confirm: requireBiometric }, profile, amount.trim());
      setNote(
        result.burnSigned
          ? 'Saque assinado. O PIX segue o status da ordem.'
          : 'O cofre já liberou o valor. A ordem de PIX ainda está sendo preparada.',
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Eyebrow>Saída</Eyebrow>
      <Title>Sacar</Title>
      <Body>O principal sai do cofre e volta em reais. A biometria confirma a assinatura.</Body>
      <Field label="Valor em USDC" value={amount} onChangeText={setAmount} placeholder="10.00" keyboardType="decimal-pad" />
      <ChromeButton label={busy ? 'Assinando…' : 'Sacar'} onPress={() => void start()} disabled={busy || !amount.trim()} />
      {order ? <GhostButton label="Abrir status" onPress={() => void Linking.openURL(order.statusPage)} /> : null}
      {note ? <Body>{note}</Body> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
