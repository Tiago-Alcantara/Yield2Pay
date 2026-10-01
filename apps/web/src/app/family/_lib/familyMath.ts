/**
 * A implementação vive em @yield2pay/shared para o site e o app
 * usarem a mesma matemática. Este arquivo mantém o caminho antigo.
 */
export {
  monthlyYieldOf,
  monthlyTotalOf,
  depositForMonthly,
  freedomPercent,
  coverageRows,
  coveredAmount,
} from '@yield2pay/shared';
export type { FamilySub, CoverageRow } from '@yield2pay/shared';
