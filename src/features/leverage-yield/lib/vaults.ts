import type { LeverageYieldVault, XToken } from '@sodax/types';
import { zeroAddress } from 'viem';

type VaultMeta = {
  /** The liquid staking token the vault holds and loops. */
  asset: string;
  /** What it is, in one line. */
  blurb: string;
};

const VAULT_META: Record<string, VaultMeta> = {
  lsodaWEETH: { asset: 'weETH', blurb: 'EtherFi restaked ETH, looped against ETH' },
  lsodaWSTETH: { asset: 'wstETH', blurb: 'Lido staked ETH, looped against ETH' },
  lsodaJITOSOL: { asset: 'JitoSOL', blurb: 'Jito staked SOL, looped against SOL' },
  lsodaSUSDS: { asset: 'sUSDS', blurb: 'Sky savings USDS, looped against USDS' },
};

export function vaultMeta(vault: LeverageYieldVault): VaultMeta {
  return VAULT_META[vault.name] ?? { asset: vault.name.replace(/^lsoda/, ''), blurb: 'Leveraged staking vault' };
}

/** lsoda* shares always have 18 decimals. */
export const SHARE_DECIMALS = 18;

/** Vault-asset amounts (TVL, share price, collateral) are 18 decimals too. */
export const ASSET_DECIMALS = 18;

/** AAVE reports "no debt" as type(uint256).max. Anything this large is effectively infinite. */
const INFINITE_HEALTH = 10n ** 30n;

export function isInfiniteHealth(healthFactor: bigint): boolean {
  return healthFactor >= INFINITE_HEALTH;
}

const NATIVE_ADDRESSES = new Set([zeroAddress, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee']);

export function isNativeToken(token: XToken): boolean {
  return NATIVE_ADDRESSES.has(token.address.toLowerCase());
}
