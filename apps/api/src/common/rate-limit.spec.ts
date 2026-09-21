import {
  allowRequest,
  pruneExpiredBuckets,
  RATE_LIMIT_MAX_HITS,
} from './rate-limit';

it('allows the first request', () => {
  const buckets = new Map<string, number[]>();
  expect(allowRequest(buckets, '1.1.1.1', 1_000, 60_000, 2)).toBe(true);
});

it('rejects when the window is full', () => {
  const buckets = new Map<string, number[]>();
  expect(allowRequest(buckets, 'ip', 1_000, 60_000, 2)).toBe(true);
  expect(allowRequest(buckets, 'ip', 1_100, 60_000, 2)).toBe(true);
  expect(allowRequest(buckets, 'ip', 1_200, 60_000, 2)).toBe(false);
});

it('allows again after timestamps leave the window', () => {
  const buckets = new Map<string, number[]>();
  allowRequest(buckets, 'ip', 1_000, 1_000, 1);
  expect(allowRequest(buckets, 'ip', 1_500, 1_000, 1)).toBe(false);
  expect(allowRequest(buckets, 'ip', 2_100, 1_000, 1)).toBe(true);
});

it('isolates keys', () => {
  const buckets = new Map<string, number[]>();
  allowRequest(buckets, 'a', 1_000, 60_000, 1);
  expect(allowRequest(buckets, 'b', 1_000, 60_000, 1)).toBe(true);
});

it('exports a production cap of 60 hits per 60s', () => {
  expect(RATE_LIMIT_MAX_HITS).toBe(60);
});

it('pruneExpiredBuckets deletes keys whose stamps all left the window', () => {
  const buckets = new Map<string, number[]>();
  buckets.set('stale', [1_000]);
  buckets.set('fresh', [2_000]);
  pruneExpiredBuckets(buckets, 2_100, 1_000);
  expect(buckets.has('stale')).toBe(false);
  expect(buckets.get('fresh')).toEqual([2_000]);
});
