export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_HITS = 60;

export function allowRequest(
  buckets: Map<string, number[]>,
  key: string,
  nowMs: number,
  windowMs: number,
  maxHits: number,
): boolean {
  const cutoff = nowMs - windowMs;
  const kept = (buckets.get(key) ?? []).filter((stamp) => stamp > cutoff);
  if (kept.length >= maxHits) {
    buckets.set(key, kept);
    return false;
  }
  kept.push(nowMs);
  buckets.set(key, kept);
  return true;
}

export function pruneExpiredBuckets(
  buckets: Map<string, number[]>,
  nowMs: number,
  windowMs: number,
): void {
  const cutoff = nowMs - windowMs;
  for (const [key, stamps] of buckets) {
    const kept = stamps.filter((stamp) => stamp > cutoff);
    if (kept.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, kept);
    }
  }
}
