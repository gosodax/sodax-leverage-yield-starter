import { type LeverageYieldVault, sonicSupportedTokens, type XToken } from '@sodax/types';
import { formatTokenAmount, ONE_SHARE } from '@/lib/format';

/** lsoda* vault shares are always 18 decimals. */
export const SHARE_DECIMALS = 18;

const RAY = 10n ** 27n;

const hubTokenByAddress = new Map(
  (Object.values(sonicSupportedTokens) as XToken[]).map(token => [token.address.toLowerCase(), token]),
);

/** The vault's underlying asset on Sonic (TVL and share price are denominated in it). */
export function underlying(vault: LeverageYieldVault): { symbol: string; decimals: number } {
  const asset = hubTokenByAddress.get(vault.asset.toLowerCase());
  return { symbol: asset?.symbol ?? vault.name.replace(/^lsoda/, ''), decimals: asset?.decimals ?? SHARE_DECIMALS };
}

export type Flavor = {
  /** Soda name shown on the bottle label. */
  soda: string;
  /** One line on what the vault earns. */
  tagline: string;
  /** CSS variable names for the liquid colour. */
  color: string;
  colorDark: string;
};

const FLAVORS: Record<string, Flavor> = {
  lsodaSUSDS: {
    soda: 'Sky Orange',
    tagline: 'Leveraged Sky savings yield on sUSDS',
    color: 'var(--soda-orange)',
    colorDark: 'var(--soda-orange-dark)',
  },
  lsodaWEETH: {
    soda: 'Ether Grape',
    tagline: 'Leveraged EtherFi restaking yield on weETH',
    color: 'var(--soda-grape)',
    colorDark: 'var(--soda-grape-dark)',
  },
  lsodaWSTETH: {
    soda: 'Lido Blue Razz',
    tagline: 'Leveraged Lido staking yield on wstETH',
    color: 'var(--soda-blue)',
    colorDark: 'var(--soda-blue-dark)',
  },
  lsodaJITOSOL: {
    soda: 'Jito Lime',
    tagline: 'Leveraged Jito staking yield on JitoSOL',
    color: 'var(--soda-lime)',
    colorDark: 'var(--soda-lime-dark)',
  },
};

export function flavorOf(vault: LeverageYieldVault): Flavor {
  return (
    FLAVORS[vault.name] ?? {
      soda: `${underlying(vault).symbol} Cola`,
      tagline: `Leveraged ${vault.lsdSource?.label ?? 'staking'} yield`,
      color: 'var(--soda-cola)',
      colorDark: 'var(--soda-cola-dark)',
    }
  );
}

/** "4.53 shares", "1 share". */
export function formatShares(shares: bigint | undefined): string {
  const amount = formatTokenAmount(shares, SHARE_DECIMALS);
  return `${amount} ${amount === '1' ? 'share' : 'shares'}`;
}

/** Underlying value of `shares` at `sharePrice` (underlying per 1 share). */
export function shareValue(shares: bigint | undefined, sharePrice: bigint | undefined): bigint | undefined {
  return shares !== undefined && sharePrice !== undefined ? (shares * sharePrice) / ONE_SHARE : undefined;
}

/** Simple-interest estimate over `days` at today's RAY APR. Negative when the APR is. */
export function projectedInterest(assets: bigint, aprRay: bigint, days: number): bigint {
  return (assets * aprRay * BigInt(days)) / (365n * RAY);
}

/** Exposure the depositor holds, as WAD: 1 + the borrowed multiple. */
export function exposureWad(leverageMultiplierWad: bigint): bigint {
  return ONE_SHARE + leverageMultiplierWad;
}

/** RAY → plain number of percent (display maths only). */
export function rayToPct(ray: bigint): number {
  return Number((ray * 10_000n) / RAY) / 100;
}
