import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { saoPauloToday } from '../summary/summary.math';
import { WalletGateway } from './wallet-gateway';
import { priceCentsPerUnit } from './wallet-money';

export type PricedAsset = 'XLM' | 'USDC';
export type PriceRequest = { asset: PricedAsset; day: string };

export const priceKey = (asset: string, day: string) => `${asset}|${day}`;

const DAY_MS = 86_400_000;
/** Dias para trás ao procurar o último dia útil. Cobre Carnaval e emendas. */
const PTAX_LOOKBACK_DAYS = 10;
/** O trade_aggregations devolve até 200 linhas por página. */
const MAX_DAYS_PER_CALL = 180;

function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function dateOf(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function chunkDays(first: string, last: string): [string, string][] {
  const chunks: [string, string][] = [];
  let start = first;
  while (start <= last) {
    const candidate = shiftDay(start, MAX_DAYS_PER_CALL - 1);
    const end = candidate < last ? candidate : last;
    chunks.push([start, end]);
    start = shiftDay(end, 1);
  }
  return chunks;
}

/**
 * Preço em centavos de real por unidade, sempre da mainnet. XLM é a média diária de
 * XLM/USDC × PTAX de venda; USDC é a PTAX. Fim de semana e feriado usam o último dia
 * útil. Só busca o que falta e só guarda dia já fechado: o de hoje ainda muda.
 */
@Injectable()
export class WalletPricesService {
  private readonly logger = new Logger(WalletPricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WalletGateway,
  ) {}

  /** O dia sem preço fica fora do mapa. Falha de fonte externa não sobe. */
  async prices(requests: PriceRequest[]): Promise<Map<string, string>> {
    const prices = new Map<string, string>();
    if (requests.length === 0) return prices;
    const wanted = new Map(
      requests.map((item) => [priceKey(item.asset, item.day), item]),
    );
    const cached = await this.prisma.assetPriceDaily.findMany({
      where: {
        asset: { in: [...new Set(requests.map((item) => item.asset))] },
        date: {
          in: [...new Set(requests.map((item) => dateOf(item.day)))],
        },
      },
    });
    for (const row of cached) {
      prices.set(
        priceKey(row.asset, row.date.toISOString().slice(0, 10)),
        row.priceCentsPerUnit.toFixed(7),
      );
    }
    const missing = [...wanted.entries()]
      .filter(([key]) => !prices.has(key))
      .map(([, item]) => item);
    if (missing.length === 0) return prices;

    const fetched = await this.fetchPrices(missing);
    const today = saoPauloToday(new Date());
    const rows: {
      asset: string;
      date: Date;
      priceCentsPerUnit: string;
      source: string;
    }[] = [];
    for (const item of missing) {
      const price = fetched.get(priceKey(item.asset, item.day));
      if (!price) continue;
      prices.set(priceKey(item.asset, item.day), price);
      if (item.day < today) {
        rows.push({
          asset: item.asset,
          date: dateOf(item.day),
          priceCentsPerUnit: price,
          source: item.asset === 'XLM' ? 'horizon+ptax' : 'ptax',
        });
      }
    }
    if (rows.length > 0) {
      await this.prisma.assetPriceDaily.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
    return prices;
  }

  private async fetchPrices(missing: PriceRequest[]) {
    const prices = new Map<string, string>();
    const days = missing.map((item) => item.day).sort();
    const first = days[0];
    const last = days[days.length - 1];
    let ptax: Map<string, string>;
    try {
      ptax = await this.gateway.ptaxSell(
        shiftDay(first, -PTAX_LOOKBACK_DAYS),
        last,
      );
    } catch (error) {
      this.logger.warn(`PTAX indisponível: ${(error as Error).name}`);
      return prices;
    }
    const averages = await this.loadXlmAverages(missing);
    for (const item of missing) {
      const rate = lastBusinessRate(ptax, item.day);
      if (!rate) continue;
      if (item.asset === 'USDC') {
        prices.set(
          priceKey(item.asset, item.day),
          priceCentsPerUnit('1', rate),
        );
        continue;
      }
      const average = averages.get(item.day);
      if (average) {
        prices.set(
          priceKey(item.asset, item.day),
          priceCentsPerUnit(average, rate),
        );
      }
    }
    return prices;
  }

  private async loadXlmAverages(missing: PriceRequest[]) {
    const averages = new Map<string, string>();
    const days = missing
      .filter((item) => item.asset === 'XLM')
      .map((item) => item.day)
      .sort();
    const first = days[0];
    const last = days[days.length - 1];
    if (!first || !last) return averages;
    try {
      for (const [start, end] of chunkDays(first, last)) {
        const page = await this.gateway.xlmUsdcDailyAverages(start, end);
        for (const [day, average] of page) averages.set(day, average);
      }
    } catch (error) {
      this.logger.warn(`Média de XLM indisponível: ${(error as Error).name}`);
    }
    return averages;
  }
}

function lastBusinessRate(
  ptax: Map<string, string>,
  day: string,
): string | null {
  for (let back = 0; back <= PTAX_LOOKBACK_DAYS; back += 1) {
    const rate = ptax.get(shiftDay(day, -back));
    if (rate) return rate;
  }
  return null;
}
