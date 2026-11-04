import type { LeverageYieldVault } from '@sodax/types';
import { useState } from 'react';
import { chainLogo, chainName } from '@/lib/chains';
import { formatBps, formatRayPercent, formatTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useVaultData } from '../hooks/useVaultData';
import { formatExposure, formatHealth, healthPct } from '../lib/display';
import { formatTvlUsd, formatUsd, priceFor, toUsd, type UsdPrices } from '../lib/usd';
import {
  exposureWad,
  flavorOf,
  formatShares,
  projectedInterest,
  SHARE_DECIMALS,
  shareValue,
  underlying,
} from '../lib/vaults';
import { Btn, ProgressBar, Prop } from '../win/controls';
import { BottleIcon, WarnIcon } from '../win/icons';

type Tab = 'general' | 'risk' | 'mine';

/** Win2k property sheet for the selected vault: General (yield), Risk (leverage, health), My shares. */
export function VaultProperties({
  vault,
  address,
  prices,
  onDeposit,
  onWithdraw,
}: {
  vault: LeverageYieldVault;
  address: string | undefined;
  prices: UsdPrices;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const [tab, setTab] = useState<Tab>('general');
  const { apr, tvl, position, sharePrice, holdings, holdingsLoaded, totalShares } = useVaultData(vault, address);
  const asset = underlying(vault);
  const flavor = flavorOf(vault);
  const price = priceFor(prices, vault.asset);
  const a = apr.data;
  const exposure = a ? exposureWad(a.leverageMultiplierWad) : undefined;
  const hf = position.data?.healthFactor;
  const myValue = shareValue(totalShares, sharePrice.data);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'risk', label: 'Leverage & Risk' },
    { id: 'mine', label: 'My Shares' },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <BottleIcon size={32} color={flavor.color} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold">{flavor.soda}</p>
          <p className="truncate text-[var(--win-dark)]">{flavor.tagline}</p>
        </div>
      </div>

      <div role="tablist" className="w2k-tabs mt-1">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="w2k-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="w2k-tabpanel -mt-2 min-h-[228px]">
        {tab === 'general' && (
          <dl>
            <Prop
              label="Net APR (variable)"
              hint="Steady-state estimate at today's rates and the vault's target LTV. Can go negative."
            >
              <span className={cn('text-[13px]', a && a.effectiveNetAprRay < 0n && 'text-[var(--destructive)]')}>
                {apr.isError ? 'Unavailable' : formatRayPercent(a?.effectiveNetAprRay)}
              </span>
            </Prop>
            <Prop label="Staking yield (LSD)" hint={a?.lsdApr.label}>
              {formatRayPercent(a?.lsdApr.aprRay)}
              {a?.lsdApr.stale && <span className="ml-1 font-normal text-[var(--win-gray-text)]">(est.)</span>}
            </Prop>
            <Prop label="Supply APR">{formatRayPercent(a?.supplyAprRay)}</Prop>
            <Prop label="Borrow APR">{formatRayPercent(a?.borrowAprRay)}</Prop>
            <div className="etched-h my-1.5" />
            <Prop label="Total value locked">
              {formatTokenAmount(tvl.data, asset.decimals, 2)} {asset.symbol}
            </Prop>
            <Prop label="">
              <span className="font-normal text-[var(--win-dark)]">
                {formatTvlUsd(toUsd(tvl.data, asset.decimals, price))}
              </span>
            </Prop>
            <Prop label="Share price">
              1 {vault.name} = {formatTokenAmount(sharePrice.data, asset.decimals, 6)} {asset.symbol}
            </Prop>
            <Prop label="Yield source">{vault.lsdSource?.label ?? '–'}</Prop>
          </dl>
        )}

        {tab === 'risk' && (
          <dl>
            <Prop
              label="Exposure"
              hint="1 + the borrowed multiple. Gains and losses on the spread are multiplied by this."
            >
              <span className="text-[13px]">{formatExposure(exposure)}</span>
            </Prop>
            <Prop label="Target LTV">{a ? formatBps(a.targetLtvBps) : '–'}</Prop>
            <Prop label="Current LTV">{position.data ? formatBps(position.data.ltv) : '–'}</Prop>
            <Prop
              label="Health factor (vault)"
              hint="The vault's, not yours. Below 1.00 the vault's position can be liquidated."
            >
              {formatHealth(hf)}
            </Prop>
            <div className="py-1">
              <ProgressBar value={healthPct(hf)} />
              <div className="mt-0.5 flex justify-between text-[10px] text-[var(--win-gray-text)]">
                <span>1.00 liquidation</span>
                <span>2.00+</span>
              </div>
            </div>
            <Prop label="Collateral">
              {formatTokenAmount(position.data?.collateral, asset.decimals, 2)} {asset.symbol}
            </Prop>
            <Prop label="Debt">
              {formatTokenAmount(position.data?.debt, asset.decimals, 2)} {asset.symbol}
            </Prop>
            <div className="mt-2 flex items-start gap-2 bg-[var(--win-tooltip)] p-1.5 bevel-thin-in">
              <WarnIcon size={16} />
              <p className="leading-snug">
                Leverage multiplies yield and risk. The APR is variable and can turn negative, the share price can fall,
                and the only exit is a withdrawal.
              </p>
            </div>
          </dl>
        )}

        {tab === 'mine' &&
          (!address ? (
            <p className="p-2 text-[var(--win-dark)]">Connect a wallet to see your shares.</p>
          ) : !holdingsLoaded ? (
            <div className="p-2">
              <p className="mb-2">Reading your hub wallets on Sonic…</p>
              <ProgressBar indeterminate />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Prop label="Total">{formatShares(totalShares)}</Prop>
              <Prop label="Worth">
                {formatTokenAmount(myValue, asset.decimals, 6)} {asset.symbol}{' '}
                <span className="font-normal text-[var(--win-dark)]">
                  {formatUsd(toUsd(myValue, asset.decimals, price))}
                </span>
              </Prop>
              {myValue !== undefined && a && myValue > 0n && (
                <Prop label="Est. 30 days" hint="Simple interest at today's variable APR. An estimate, not a promise.">
                  {formatTokenAmount(projectedInterest(myValue, a.effectiveNetAprRay, 30), asset.decimals, 6)}{' '}
                  {asset.symbol}
                </Prop>
              )}
              <div className="bevel-field mt-1 p-[2px]">
                <ul className="bg-[var(--win-window)]">
                  {holdings.map(h => (
                    <li key={h.chainKey} className="flex items-center gap-2 px-1.5 py-1">
                      <img src={chainLogo(h.chainKey)} alt="" className="size-4" />
                      <span className="flex-1">From {chainName(h.chainKey)}</span>
                      <span className={cn('font-bold', h.shares === 0n && 'font-normal text-[var(--win-gray-text)]')}>
                        {formatTokenAmount(h.shares, SHARE_DECIMALS, 6)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-[var(--win-dark)]">
                Shares sit in your SODAX hub wallet on Sonic, one per source network. They won't appear in your wallet
                extension. Withdraw from the network that deposited.
              </p>
            </div>
          ))}
      </div>

      <div className="flex justify-end gap-1.5 pt-1">
        <Btn onClick={onWithdraw} disabled={!address || !holdingsLoaded || !totalShares}>
          Withdraw…
        </Btn>
        <Btn isDefault onClick={onDeposit}>
          Deposit…
        </Btn>
      </div>
    </div>
  );
}
