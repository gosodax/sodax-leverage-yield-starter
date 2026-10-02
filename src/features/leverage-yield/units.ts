import { formatUnits, maxUint256 } from 'viem';
import { formatWad } from '@/lib/format';

const WAD = 10n ** 18n;

/** lsoda* shares are always 18 decimals. */
export const SHARE_DECIMALS = 18;

/** Asset units for `shares`, given `previewRedeem(ONE_SHARE)` as the price per share. */
export function shareValue(shares: bigint, pricePerShare: bigint): bigint {
  return (shares * pricePerShare) / WAD;
}

/** Exposure a depositor holds: 1 + the borrowed multiple (`leverageMultiplierWad` is only the borrowed part). */
export function formatExposure(leverageMultiplierWad: bigint | undefined): string {
  return leverageMultiplierWad === undefined ? '–' : `${formatWad(WAD + leverageMultiplierWad)}×`;
}

/** Health factor is WAD; `maxUint256` means the vault has no debt. */
export function formatHealthFactor(healthFactor: bigint | undefined): string {
  if (healthFactor === undefined) return '–';
  return healthFactor === maxUint256 ? 'No debt' : formatWad(healthFactor);
}

export function toUsd(amount: bigint, decimals: number, priceUsd: number | undefined): number | undefined {
  return priceUsd === undefined ? undefined : Number(formatUnits(amount, decimals)) * priceUsd;
}

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function formatUsd(value: number | undefined): string {
  return value === undefined ? '–' : usdFormatter.format(value);
}
