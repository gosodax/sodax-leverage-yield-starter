/**
 * Risk tiers, Seeker-style. A vault's tier is derived from its target LTV (how hard it leverages):
 * higher LTV → more aggressive. The colour is used as the card's accent only, never a text colour on
 * dark (these pastels are chips/strips/among icons, not body text).
 */

export type Tier = { name: string; color: string };

// Seeker tier palette (src/theme/tokens.ts → `tier`).
const SAFE = '#99BBFF';
const CONSERVATIVE = '#99FFDD';
const BALANCED = '#BBFF99';
const OPTIMISTIC = '#FFDD99';
const AGGRESSIVE = '#FF99BB';
const YOLO = '#DD99FF';

/** Map a target LTV (basis points, 10_000 = 100%) to a risk tier. */
export function tierForLtv(targetLtvBps: bigint | undefined): Tier {
  if (targetLtvBps === undefined) return { name: 'Vault', color: SAFE };
  const ltv = Number(targetLtvBps);
  if (ltv <= 0) return { name: 'Unleveraged', color: SAFE };
  if (ltv < 5000) return { name: 'Conservative', color: CONSERVATIVE };
  if (ltv < 6500) return { name: 'Balanced', color: BALANCED };
  if (ltv < 8000) return { name: 'Optimistic', color: OPTIMISTIC };
  if (ltv < 9000) return { name: 'Aggressive', color: AGGRESSIVE };
  return { name: 'High leverage', color: YOLO };
}

export type HealthTone = 'success' | 'warning' | 'destructive' | 'muted';

/** Above this WAD health factor there is effectively no debt (contract returns type(uint256).max). */
const NO_DEBT_WAD = 10n ** 24n; // 1e6 in 1.0 units — any real position is far below this

/** A health factor (WAD, 1e18 = 1.0) as a labelled, toned badge. */
export function healthLabel(healthFactor: bigint | undefined): { label: string; tone: HealthTone } {
  if (healthFactor === undefined) return { label: '—', tone: 'muted' };
  if (healthFactor >= NO_DEBT_WAD) return { label: 'No debt', tone: 'success' };
  const hf = Number(healthFactor) / 1e18;
  if (hf >= 1.5) return { label: `Healthy · ${hf.toFixed(2)}`, tone: 'success' };
  if (hf >= 1.2) return { label: `Moderate · ${hf.toFixed(2)}`, tone: 'warning' };
  return { label: `At risk · ${hf.toFixed(2)}`, tone: 'destructive' };
}
