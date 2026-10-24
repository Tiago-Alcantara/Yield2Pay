import type { BillType } from '@yield2pay/shared';
import { toBaseUnits } from '@/lib/money';

export type ServiceCategory = 'ai' | 'productivity' | 'dev';

export interface CatalogService {
  /** Exact match key against Bill.vendor. */
  vendor: string;
  /** Avatar tile text. */
  initials: string;
  /** Monthly cost in USDC base units (7 dp). */
  monthlyCost: string;
  /** Bill type persisted on activation. */
  type: BillType;
  /** Frontend-only grouping for the category filter. */
  category: ServiceCategory;
}

/** Curated catalog of popular software subscriptions. Prices are placeholders, edit freely. */
export const SERVICE_CATALOG: CatalogService[] = [
  { vendor: 'OpenAI',           initials: 'AI', monthlyCost: toBaseUnits('49.90'), type: 'software', category: 'ai' },
  { vendor: 'Anthropic Claude', initials: 'AC', monthlyCost: toBaseUnits('99.00'), type: 'software', category: 'ai' },
  { vendor: 'Midjourney',       initials: 'MJ', monthlyCost: toBaseUnits('59.00'), type: 'software', category: 'ai' },
  { vendor: 'Notion',           initials: 'N',  monthlyCost: toBaseUnits('24.90'), type: 'software', category: 'productivity' },
  { vendor: 'Slack',            initials: 'SL', monthlyCost: toBaseUnits('9.50'),  type: 'software', category: 'productivity' },
  { vendor: 'Figma',            initials: 'Fi', monthlyCost: toBaseUnits('39.90'), type: 'software', category: 'productivity' },
  { vendor: 'GitHub',           initials: 'GH', monthlyCost: toBaseUnits('21.00'), type: 'software', category: 'dev' },
  { vendor: 'Linear',           initials: 'Li', monthlyCost: toBaseUnits('16.00'), type: 'software', category: 'dev' },
];
