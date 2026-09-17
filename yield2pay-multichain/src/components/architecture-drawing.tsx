import { cn } from "@/lib/utils";

const views = [
  { id: "vista-hoje", label: "1. Hoje: dois forks" },
  { id: "vista-nucleo", label: "2. Alvo: um núcleo" },
  { id: "vista-deposito", label: "3. Um depósito" },
  { id: "vista-conta", label: "4. Uma conta, duas chains" },
] as const;

function Box({
  title,
  subtitle,
  tone = "core",
  className,
}: {
  title: string;
  subtitle?: string;
  tone?: "ui" | "api" | "core" | "port" | "stellar" | "solana" | "ext";
  className?: string;
}) {
  const tones: Record<string, string> = {
    ui: "border-amber-200/40 bg-amber-200/8",
    api: "border-sky-300/35 bg-sky-400/8",
    core: "border-primary/50 bg-primary/10",
    port: "border-violet-300/40 bg-violet-400/10",
    stellar: "border-blue-400/50 bg-blue-500/10",
    solana: "border-fuchsia-400/50 bg-fuchsia-500/10",
    ext: "border-border bg-muted/40",
  };
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        tones[tone],
        className,
      )}
    >
      <p className="text-sm font-medium leading-tight">{title}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

function ArrowDown({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1 text-muted-foreground">
      <div className="h-3 w-px bg-border" />
      <span className="text-[10px] tracking-wide">{label ?? "↓"}</span>
      <div className="h-3 w-px bg-border" />
    </div>
  );
}

function ViewCaption({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4 border-b border-border pb-3">
      <p className="font-mono text-[11px] tracking-widest text-primary">{kicker}</p>
      <p className="mt-1 text-lg font-medium">{title}</p>
    </div>
  );
}

function HojeView() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <ViewCaption
          kicker="VISTA A · HOJE"
          title="Dois repositórios, duas pilhas completas. Nada compartilhado de verdade."
        />
      </div>
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/5 p-4">
        <p className="mb-3 font-mono text-[11px] tracking-widest text-blue-300">STELLAR · Yield2Pay</p>
        <div className="flex flex-col items-stretch">
          <Box tone="ui" title="Web B2B + /family (protótipo)" subtitle="useStellarTx · chainType stellar" />
          <ArrowDown />
          <Box tone="api" title="API Nest" subtitle="Company · 7 decimais · XDR" />
          <ArrowDown />
          <Box tone="stellar" title="Tudo misturado" subtitle="StellarService + DeFindex + Etherfuse" />
          <ArrowDown />
          <div className="grid grid-cols-3 gap-2">
            <Box tone="ext" title="Privy" subtitle="Stellar" />
            <Box tone="ext" title="DeFindex" subtitle="Blend" />
            <Box tone="ext" title="Etherfuse" subtitle="PIX" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/5 p-4">
        <p className="mb-3 font-mono text-[11px] tracking-widest text-fuchsia-300">
          SOLANA · hackathon
        </p>
        <div className="flex flex-col items-stretch">
          <Box tone="ui" title="Web /family plugado" subtitle="useSolanaTx · chainType solana" />
          <ArrowDown />
          <Box tone="api" title="API Nest (cópia)" subtitle="Household · 6 decimais · tx base64" />
          <ArrowDown />
          <Box tone="solana" title="Tudo misturado" subtitle="SolanaService + Kamino / MockVault" />
          <ArrowDown />
          <div className="grid grid-cols-3 gap-2">
            <Box tone="ext" title="Privy" subtitle="Solana" />
            <Box tone="ext" title="Kamino" subtitle="mainnet" />
            <Box tone="ext" title="Mock vault" subtitle="devnet" />
          </div>
        </div>
      </div>
      <p className="md:col-span-2 text-center text-sm text-muted-foreground">
        Mesmo produto, duas pilhas. Qualquer feature nova (liberdade %, saque, erro) precisa ser
        feita duas vezes.
      </p>
    </div>
  );
}

function AlvoView() {
  return (
    <div className="space-y-2">
      <ViewCaption
        kicker="VISTA B · ALVO"
        title="Um motor no meio. Stellar e Solana só existem embaixo, como adapters."
      />
      <Box tone="ui" title="apps/web — telas de família / B2B" subtitle="não importa Stellar SDK nem web3.js" />
      <ArrowDown label="ChainSession · chainId ativo" />
      <Box
        tone="api"
        title="apps/api — casos de uso"
        subtitle="depositar · sacar · dashboard · bills  ·  POST /v1/{chainId}/…"
      />
      <ArrowDown label="só Money, Account, Ledger" />
      <Box
        tone="core"
        title="packages/domain — o motor Yield2Pay"
        subtitle="Account · Money · spendable = vault − principal · liberdade %"
      />
      <ArrowDown label="ports (contratos estáveis)" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Box tone="port" title="WalletPort" subtitle="endereço, saldo" />
        <Box tone="port" title="TxPort" subtitle="patrocina + submit" />
        <Box tone="port" title="VaultPort" subtitle="deposit / APY" />
        <Box tone="port" title="RampPort?" subtitle="PIX se existir" />
      </div>
      <ArrowDown label="ChainRegistry escolhe o adapter" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-blue-400/30 p-3">
          <Box tone="stellar" title="chain-stellar" subtitle="fee-bump · XDR · 7 casas" />
          <div className="grid grid-cols-3 gap-2">
            <Box tone="ext" title="Privy" subtitle="stellar" />
            <Box tone="ext" title="DeFindex" />
            <Box tone="ext" title="Etherfuse" />
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-fuchsia-400/30 p-3">
          <Box tone="solana" title="chain-solana" subtitle="feePayer · base64 · 6 casas" />
          <div className="grid grid-cols-3 gap-2">
            <Box tone="ext" title="Privy" subtitle="solana" />
            <Box tone="ext" title="Kamino" />
            <Box tone="ext" title="Mock" />
          </div>
        </div>
      </div>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        Uma terceira chain (EVM) seria só mais um pacote embaixo. O núcleo não muda.
      </p>
    </div>
  );
}

const steps = [
  { n: "1", who: "Você", title: "Deposita R$ X", detail: "A UI não escolhe XDR nem instrução SPL. Só o valor." },
  { n: "2", who: "API", title: "Pede ao VaultPort", detail: "buildDeposit(owner, Money) no adapter da chain ativa." },
  { n: "3", who: "Adapter", title: "Monta tx nativa", detail: "Stellar: XDR + fee-bump. Solana: VersionedTx com sponsor." },
  { n: "4", who: "Privy", title: "Você assina", detail: "stellar: hash. solana: a transação inteira. Chave nunca vai ao servidor." },
  { n: "5", who: "Chain", title: "Confirma no cofre", detail: "DeFindex ou Kamino/mock. Tesouraria só pagou a taxa." },
  { n: "6", who: "Ledger", title: "Registra o aporte", detail: "DB guarda principal. Cofre on-chain é o vaultValue. Spendable = diferença." },
];

function FluxoView() {
  return (
    <div>
      <ViewCaption
        kicker="VISTA C · UM DEPÓSITO"
        title="O valor sobe pela pilha; só o adapter fala com a chain."
      />
      <div className="flex flex-col gap-0 md:flex-row md:flex-wrap md:items-stretch md:justify-between">
        {steps.map((s, i) => (
          <div key={s.n} className="flex flex-1 items-stretch md:min-w-[30%] md:max-w-[32%]">
            <div className="flex w-full flex-col">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="font-mono text-[10px] text-primary">
                  {s.n} · {s.who}
                </p>
                <p className="mt-1 text-sm font-medium">{s.title}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{s.detail}</p>
              </div>
              {i < steps.length - 1 ? (
                <p className="py-1 text-center text-muted-foreground md:hidden">↓</p>
              ) : null}
            </div>
            {i < steps.length - 1 && i % 3 !== 2 ? (
              <p className="hidden self-center px-1 text-muted-foreground md:block">→</p>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Saque é o mesmo caminho ao contrário. Pagar Netflix com o yield ainda não existe — seria um
        7º passo (PaymentEngine) depois.
      </p>
    </div>
  );
}

function ContaView() {
  return (
    <div className="space-y-4">
      <ViewCaption
        kicker="VISTA D · CONTA"
        title="Uma Account, duas carteiras. Ledger e spendable nunca se misturam."
      />
      <Box
        tone="core"
        title="Account (você / a família)"
        subtitle="privyUserId · kind: family | company · assinaturas off-chain (Netflix, escola…)"
      />
      <ArrowDown label="N carteiras, nunca uma só misturada" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-blue-400/30 p-3">
          <Box tone="stellar" title="Wallet Stellar" subtitle="G… · 7 decimais" />
          <Box tone="ext" title="Position DeFindex" subtitle="vaultValue on-chain" />
          <Box tone="ext" title="Ledger Stellar" subtitle="aportes desta chain" />
          <p className="text-center text-[12px] text-muted-foreground">
            spendable<sub>stellar</sub> = vault − principal
          </p>
        </div>
        <div className="space-y-2 rounded-xl border border-fuchsia-400/30 p-3">
          <Box tone="solana" title="Wallet Solana" subtitle="base58 · ATA · 6 decimais" />
          <Box tone="ext" title="Position Kamino / mock" subtitle="vaultValue on-chain" />
          <Box tone="ext" title="Ledger Solana" subtitle="aportes desta chain" />
          <p className="text-center text-[12px] text-muted-foreground">
            spendable<sub>solana</sub> = vault − principal
          </p>
        </div>
      </div>
      <Box
        tone="ui"
        title="UI: liberdade % por chain, e opcionalmente um anel total"
        subtitle="O anel total soma rendimento estimado em BRL. O banco nunca soma 7 casas com 6."
      />
    </div>
  );
}

export function ArchitectureDrawing() {
  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-30 flex flex-wrap gap-2 rounded-2xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur-md">
        {views.map((v) => (
          <a
            key={v.id}
            href={`#${v.id}`}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            {v.label}
          </a>
        ))}
      </div>

      <article
        id="vista-hoje"
        className="scroll-mt-32 overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-6"
      >
        <HojeView />
      </article>
      <article
        id="vista-nucleo"
        className="scroll-mt-32 overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-6"
      >
        <AlvoView />
      </article>
      <article
        id="vista-deposito"
        className="scroll-mt-32 overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-6"
      >
        <FluxoView />
      </article>
      <article
        id="vista-conta"
        className="scroll-mt-32 overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-6"
      >
        <ContaView />
      </article>
    </div>
  );
}
