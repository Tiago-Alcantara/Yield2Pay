import { describe, it, expect } from 'vitest';
import { formatUsdc } from '@/lib/money';
import { SERVICE_CATALOG } from './serviceCatalog';

describe('SERVICE_CATALOG', () => {
  it('contains the 8 curated services', () => {
    expect(SERVICE_CATALOG).toHaveLength(8);
    expect(SERVICE_CATALOG.map((s) => s.vendor)).toEqual([
      'OpenAI', 'Anthropic Claude', 'Midjourney',
      'Notion', 'Slack', 'Figma', 'GitHub', 'Linear',
    ]);
  });

  it('stores prices as USDC base units that format back to the mockup values', () => {
    const openai = SERVICE_CATALOG.find((s) => s.vendor === 'OpenAI')!;
    expect(formatUsdc(openai.monthlyCost)).toBe('49.90');
    const slack = SERVICE_CATALOG.find((s) => s.vendor === 'Slack')!;
    expect(formatUsdc(slack.monthlyCost)).toBe('9.50');
  });

  it('only uses known categories and software type', () => {
    const cats = new Set(['ai', 'productivity', 'dev']);
    for (const s of SERVICE_CATALOG) {
      expect(cats.has(s.category)).toBe(true);
      expect(s.type).toBe('software');
      expect(s.monthlyCost).toMatch(/^\d+$/);
    }
  });
});
