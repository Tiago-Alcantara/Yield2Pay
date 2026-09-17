import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArchitectureDrawing } from "@/components/architecture-drawing";
import { SiteNav } from "@/components/site-nav";
import {
  divergences,
  doNotUnify,
  frontendCode,
  gaps,
  layers,
  phases,
  portsCode,
  product,
  repos,
  sameEverywhere,
  schemaTarget,
} from "@/lib/architecture";

function Section({
  id,
  kicker,
  title,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.22em] text-primary">{kicker}</p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight md:text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-4 py-10 pb-24">
        <section id="veredito" className="scroll-mt-24 space-y-6">
          <Badge variant="secondary" className="font-mono text-[11px] tracking-wider">
            Estudo de arquitetura · Stellar + Solana
          </Badge>
          <h1 className="max-w-3xl text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            {product.name} já é o mesmo produto duas vezes. Multichain é extrair o motor, não
            reescrever o app.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{product.thesis}</p>
          <p className="max-w-2xl text-muted-foreground">{product.metric}</p>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Possível?</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Sim. Os dois repos já compartilham o mesmo fluxo não-custodial, o mesmo ledger e a
                mesma métrica. O que muda é envelope de transação, decimais, Privy chainType e o
                vendor do cofre.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Como</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Hexágono: domínio no centro, ports estáveis, um adapter por chain. A Solana já tem
                VaultService abstrato — esse é o molde. A Stellar hoje está acoplada ao DeFindex.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>O que não fazer</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Não fundir XDR com VersionedTransaction. Não somar USDC 7d com USDC 6d. Não esperar
                um contrato Yield2Pay próprio — nenhum dos dois repos tem escrow custom.
              </CardContent>
            </Card>
          </div>
        </section>

        <Section
          id="hoje"
          kicker="01 · ESTADO ATUAL"
          title="Dois forks de um mesmo monorepo"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                ["stellar", repos.stellar],
                ["solana", repos.solana],
              ] as const
            ).map(([key, repo]) => (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{repo.name}</CardTitle>
                    <Badge variant={key === "stellar" ? "default" : "secondary"}>{repo.status}</Badge>
                  </div>
                  <a
                    href={repo.url}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {repo.url.replace("https://", "")}
                  </a>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>{repo.role}</p>
                  <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
                    <dt className="text-foreground/80">Tenant</dt>
                    <dd>{repo.tenant}</dd>
                    <dt className="text-foreground/80">Decimais</dt>
                    <dd>{repo.decimals}</dd>
                    <dt className="text-foreground/80">Cofre</dt>
                    <dd>{repo.vault}</dd>
                    <dt className="text-foreground/80">Tx</dt>
                    <dd>{repo.txShape}</dd>
                    <dt className="text-foreground/80">Ramp</dt>
                    <dd>{repo.ramp}</dd>
                    <dt className="text-foreground/80">Privy</dt>
                    <dd className="font-mono text-xs">{repo.privy}</dd>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sameEverywhere.map((block) => (
              <Card key={block.title}>
                <CardHeader>
                  <CardTitle>Igual nos dois</CardTitle>
                  <p className="text-sm text-muted-foreground">{block.title}</p>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Onde os forks se afastam — e a decisão</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Eixo</th>
                    <th className="py-2 pr-3 font-medium">Stellar</th>
                    <th className="py-2 pr-3 font-medium">Solana</th>
                    <th className="py-2 font-medium">Alvo</th>
                  </tr>
                </thead>
                <tbody>
                  {divergences.map((row) => (
                    <tr key={row.axis} className="border-b border-border/70 align-top">
                      <td className="py-3 pr-3 font-medium">{row.axis}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{row.stellar}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{row.solana}</td>
                      <td className="py-3 text-foreground">{row.decision}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </Section>

        <Section
          id="desenho"
          kicker="02 · DESENHO"
          title="Como as peças se encaixam"
        >
          <p className="max-w-3xl text-muted-foreground">
            Quatro desenhos em sequência — role a página ou use os atalhos. 1 é o fork de hoje, 2 o
            núcleo com adapters, 3 um depósito, 4 a conta com duas carteiras.
          </p>
          <ArchitectureDrawing />
        </Section>

        <Section
          id="alvo"
          kicker="03 · ARQUITETURA ALVO"
          title="Núcleo de domínio + um adapter por chain"
        >
          <p className="max-w-3xl text-muted-foreground">
            A UI e os casos de uso não sabem o que é Soroban ou SPL. Eles pedem “deposita esta
            quantia na chain ativa”. O adapter da chain monta a transação no formato nativo,
            patrocina a taxa e devolve um envelope opaco. Um terceiro chain (EVM) entra como mais um
            pacote, sem tocar no ledger.
          </p>
          <div className="grid gap-3">
            {layers.map((layer, i) => (
              <div
                key={layer.id}
                className="rounded-xl border border-border bg-card px-5 py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs text-primary">
                    L{i} · {layer.name}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{layer.body}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-dashed border-primary/40 bg-card/50 p-5 font-mono text-xs leading-relaxed text-muted-foreground md:text-sm">
            <p className="text-primary">fluxo de depósito</p>
            <p className="mt-2">
              UI → POST /v1/{"{chainId}"}/deposit/build → VaultPort.buildDeposit →
              TxPort.buildSponsored → UnsignedTx
            </p>
            <p>
              Privy assina (stellar: hash, solana: tx) → POST /submit → TxPort.submit →
              Ledger.record(Money, txRef)
            </p>
            <p className="mt-2">
              dashboard: VaultPort.getPositionValue − Σ LedgerEntry(deposit) = spendable
            </p>
          </div>
        </Section>

        <Section
          id="ports"
          kicker="04 · CONTRATOS"
          title="Os ports que travam o desenho"
        >
          <Tabs defaultValue="ports">
            <TabsList>
              <TabsTrigger value="ports">TypeScript dos ports</TabsTrigger>
              <TabsTrigger value="web">Frontend</TabsTrigger>
            </TabsList>
            <TabsContent value="ports">
              <pre className="overflow-x-auto rounded-xl border border-border bg-black/40 p-4 text-[12px] leading-relaxed text-primary/90">
                {portsCode}
              </pre>
            </TabsContent>
            <TabsContent value="web">
              <pre className="overflow-x-auto rounded-xl border border-border bg-black/40 p-4 text-[12px] leading-relaxed text-primary/90">
                {frontendCode}
              </pre>
              <p className="mt-3 text-sm text-muted-foreground">
                useWallet deixa de hardcodar chainType. O ChainSession lê a chain escolhida, pede ao
                Privy a carteira correspondente e registra POST /wallet com {"{ chainId, address }"}.
              </p>
            </TabsContent>
          </Tabs>
        </Section>

        <Section
          id="dados"
          kicker="05 · MODELO"
          title="Uma Account, N carteiras, ledger por chain"
        >
          <p className="max-w-3xl text-muted-foreground">
            Liberdade financeira agregada pode aparecer na UI somando rendimento estimado em
            display currency. No banco, cada lançamento carrega chainId + decimals + asset. Fonte
            da verdade do cofre continua on-chain; o DB guarda o histórico de aportes para não
            confundir yield com principal.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {schemaTarget.map((row) => (
              <Card key={row.model} size="sm">
                <CardHeader>
                  <CardTitle className="font-mono text-sm">{row.model}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{row.fields}</CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          id="plano"
          kicker="06 · O QUE FAZER"
          title="Base = famílias (Solana). Stellar entra como adapter."
        >
          <ol className="space-y-4">
            {phases.map((p) => (
              <li key={p.n} className="flex gap-4">
                <span className="font-mono text-primary">{p.n.padStart(2, "0")}</span>
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <Separator />

          <h3 className="text-lg font-medium">Não unificar</h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {doNotUnify.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>

          <h3 className="text-lg font-medium">Lacunas que o estudo encontrou</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {gaps.map((g) => (
              <Card key={g.title}>
                <CardHeader>
                  <CardTitle>{g.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{g.body}</CardContent>
              </Card>
            ))}
          </div>
        </Section>
      </main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Estudo a partir de github.com/Tiago-Alcantara/Yield2Pay e yield2Pay-solana. Documento
        completo em docs/ARQUITETURA-MULTICHAIN.md.
      </footer>
    </>
  );
}
