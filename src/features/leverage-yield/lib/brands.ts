import { AnchorIcon, CoinsIcon, DropIcon, EngineIcon, type Icon, SunHorizonIcon } from '@phosphor-icons/react';
import type { LeverageYieldVault } from '@sodax/types';
import { underlying } from './vaults';

/** Friendly identity for a vault: what people see instead of the lsoda* share-token name. */
export type VaultBrand = {
  /** "Dollar Drip". */
  name: string;
  /** One line on what it is. Describes, never promises yield. */
  tagline: string;
  /** The plain asset ticker used everywhere for this vault ("sUSDS"), never the share-token symbol. */
  ticker: string;
  icon: Icon;
  /** Tailwind background class for the icon tile, a palette wash from src/brand/theme.css. */
  wash: string;
};

/** Keyed by the vault `name` from `sodax.leverageYield.listVaults()`. */
const BRANDS: Record<string, VaultBrand> = {
  lsodaWEETH: {
    name: 'Ether Engine',
    tagline: 'Leveraged yield on staked ETH (EtherFi)',
    ticker: 'weETH',
    icon: EngineIcon,
    wash: 'bg-wash-honey',
  },
  lsodaWSTETH: {
    name: 'Steady Staker',
    tagline: 'Leveraged yield on staked ETH (Lido)',
    ticker: 'wstETH',
    icon: AnchorIcon,
    wash: 'bg-wash-linen',
  },
  lsodaJITOSOL: {
    name: 'Solar Flare',
    tagline: 'Leveraged yield on staked SOL (Jito)',
    ticker: 'JitoSOL',
    icon: SunHorizonIcon,
    wash: 'bg-wash-terracotta',
  },
  lsodaSUSDS: {
    name: 'Dollar Drip',
    tagline: 'Leveraged yield on the Sky savings dollar',
    ticker: 'sUSDS',
    icon: DropIcon,
    wash: 'bg-wash-wisteria',
  },
};

/** The vault's brand, or a plain fallback built from its asset symbol for a vault not in the map. */
export function vaultBrand(vault: LeverageYieldVault): VaultBrand {
  const known = BRANDS[vault.name];
  if (known) return known;
  const ticker = underlying(vault).symbol;
  return { name: ticker, tagline: 'Leveraged yield vault', ticker, icon: CoinsIcon, wash: 'bg-wash-linen' };
}
