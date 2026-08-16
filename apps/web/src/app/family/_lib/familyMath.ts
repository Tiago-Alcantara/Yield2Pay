/**
 * Matemática do "Percentual de Liberdade".
 *
 * Regra do produto: só o rendimento do depósito paga as assinaturas — o
 * principal nunca é gasto. A lista de assinaturas é ordenada por prioridade:
 * o rendimento do mês cobre de cima para baixo, e uma conta só é "coberta"
 * quando o acumulado até ela cabe dentro do rendimento mensal.
 *
 * Todos os valores são em reais (number), não em base units — estas telas
 * ainda são front puro, sem DeFindex/Privy por trás.
 */

export interface FamilySub {
  id: string;
  name: string;
  /** Valor mensal em R$. */
  price: number;
  /** Dia de vencimento (1–28). */
  dia: number;
}

export interface CoverageRow extends FamilySub {
  /** Soma das assinaturas até esta (inclusive). */
  cumulative: number;
  /** O rendimento mensal já cobre esta conta. */
  covered: boolean;
  /** Depósito necessário para cobrir esta conta e as acima dela. */
  cumNeeded: number;
  /** Quanto ainda falta depositar para cobrir esta conta. */
  missing: number;
}

/** Rendimento mensal de um depósito a `ratePct`% ao ano. */
export function monthlyYieldOf(deposit: number, ratePct: number): number {
  if (deposit <= 0 || ratePct <= 0) return 0;
  return (deposit * (ratePct / 100)) / 12;
}

/** Soma mensal das assinaturas. */
export function monthlyTotalOf(subs: Array<{ price: number }>, extra = 0): number {
  return subs.reduce((sum, s) => sum + s.price, 0) + extra;
}

/** Depósito necessário para que o rendimento cubra `monthly` todo mês. */
export function depositForMonthly(monthly: number, ratePct: number): number {
  if (monthly <= 0 || ratePct <= 0) return 0;
  return (monthly * 12) / (ratePct / 100);
}

/** Percentual de liberdade (0–100, arredondado). */
export function freedomPercent(monthly: number, yieldPerMonth: number): number {
  if (monthly <= 0) return 0;
  return Math.min(100, Math.round((yieldPerMonth / monthly) * 100));
}

/**
 * Cobertura conta a conta, na ordem de prioridade da lista.
 * A tolerância de 0,005 evita que arredondamento de centavo marque como
 * descoberta uma conta que fecha exatamente no rendimento.
 */
export function coverageRows(
  subs: FamilySub[],
  deposit: number,
  ratePct: number,
): CoverageRow[] {
  const yieldPerMonth = monthlyYieldOf(deposit, ratePct);
  let cumulative = 0;
  return subs.map((s) => {
    cumulative += s.price;
    const cumNeeded = depositForMonthly(cumulative, ratePct);
    return {
      ...s,
      cumulative,
      covered: cumulative <= yieldPerMonth + 0.005,
      cumNeeded,
      missing: Math.max(0, cumNeeded - deposit),
    };
  });
}

/** Quanto do total mensal o rendimento efetivamente paga (nunca mais que o total). */
export function coveredAmount(monthly: number, yieldPerMonth: number): number {
  return Math.min(yieldPerMonth, monthly);
}
