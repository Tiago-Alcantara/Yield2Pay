# Yield2Pay mobile

App Expo (React Native) para Android e iPhone. Um código, duas lojas. Fala com a API Nest e usa a Privy para login e assinatura da carteira Stellar.

## Rodar

```bash
cp .env.example .env.local
pnpm install
pnpm --filter @yield2pay/mobile start
```

Privy no celular precisa de development build (`expo-dev-client`), não do Expo Go. No painel Privy, o app client precisa aceitar o scheme `yield2pay` e o identificador `com.yield2pay.app`.

No emulador Android, a API local é `http://10.0.2.2:3001`.

## Lojas

```bash
# TestFlight + faixa interna da Play (rascunho)
pnpm --filter @yield2pay/mobile submit:internal
```

Antes, troque em `eas.json` o `appleTeamId` e o `ascAppId`. O domínio dos Universal Links / App Links é `EXPO_PUBLIC_ASSOCIATED_HOST` (padrão `yield2pay.app`). O site publica os arquivos quando estas variáveis existem:

- `APPLE_TEAM_ID`
- `ANDROID_SHA256_CERT_FINGERPRINTS` (separadas por vírgula)

Os caminhos de volta do depósito e do saque são `/deposito` e `/saque`.
