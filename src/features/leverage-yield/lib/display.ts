import { maxUint256 } from 'viem';
import { formatBps, formatWad } from '@/lib/format';

const WAD = 10n ** 18n;

/** Health factor (WAD): '∞' with no debt, otherwise two decimals. Below 1.0 is liquidatable. */
export function formatHealth(hf: bigint | undefined): string {
  if (hf === undefined) return '–';
  if (hf === maxUint256) return '∞ (no debt)';
  return formatWad(hf);
}

/** Health bar fill 0..100: 1.0 → 0%, 2.0+ → 100%. */
export function healthPct(hf: bigint | undefined): number {
  if (hf === undefined) return 0;
  if (hf === maxUint256) return 100;
  return Math.max(0, Math.min(100, (Number(hf - WAD) / 1e18) * 100));
}

export function formatExposure(exposureWad: bigint | undefined): string {
  return exposureWad === undefined ? '–' : `${formatWad(exposureWad)}×`;
}

export { formatBps };
