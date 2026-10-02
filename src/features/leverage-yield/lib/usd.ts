import { formatUnits } from 'viem';

/** USD per whole token, keyed by lowercase money-market reserve address. Display only: never sizes a minimum. */
export type UsdPrices = ReadonlyMap<string, number>;

export function priceFor(prices: UsdPrices, address: string | undefined): number | undefined {
  return address ? prices.get(address.toLowerCase()) : undefined;
}

export function toUsd(amount: bigint | undefined, decimals: number, price: number | undefined): number | undefined {
  if (amount === undefined || price === undefined) return undefined;
  return Number(formatUnits(amount, decimals)) * price;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const compact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

/** 4.931 → "$4.93", 0.004 → "< $0.01", undefined → "". */
export function formatUsd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  if (value !== 0 && Math.abs(value) < 0.01) return value > 0 ? '< $0.01' : '> -$0.01';
  return usd.format(value);
}

/** TVL: "$632.04", "$12.3K", "$4.1M". */
export function formatTvlUsd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  return Math.abs(value) < 1000 ? usd.format(value) : compact.format(value);
}
