import { useLeverageYieldPreviewRedeem, useLeverageYieldShareBalances } from '@sodax/dapp-kit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { isSourceChain, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import { formatTokenAmount, ONE_SHARE } from '@/lib/format';
import { formatUsd, SHARE_DECIMALS, shareValue, toUsd } from './units';
import { useHolders } from './useHolders';
import { useAssetUsdPrice, type VaultInfo } from './useVaults';

/** Shares held in one vault from one source network and address: the unit a withdraw spends. */
export type Holding = { vault: VaultInfo; chainKey: SourceChainKey; address: string; shares: bigint };

/** The user's shares, per vault and per network, with a withdraw action on each. */
export function YourPositions({
  vaults,
  address,
  onWithdraw,
}: {
  vaults: VaultInfo[];
  address: string;
  onWithdraw: (holding: Holding) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your position</CardTitle>
        <CardDescription>
          Shares live in your SODAX hub wallet on Sonic, one per network you deposit from, so they don't show in your
          wallet extension. Withdraw from the network that deposited.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Rows render nothing when a vault has no shares; the message shows only when it is the sole child. */}
        <ul className="flex flex-col divide-y">
          {vaults.map(v => (
            <VaultHoldings key={v.vault.name} info={v} address={address} onWithdraw={onWithdraw} />
          ))}
          <li className="hidden py-2 text-sm text-muted-foreground only:block">
            No shares yet. Deposit into a vault below and they show up here once a solver fills it.
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function VaultHoldings({
  info,
  address,
  onWithdraw,
}: {
  info: VaultInfo;
  address: string;
  onWithdraw: (holding: Holding) => void;
}) {
  const vault = info.vault.vault;
  const holders = useHolders(address);
  const balances = useLeverageYieldShareBalances({ params: { vault, holders } });
  const { data: pricePerShare } = useLeverageYieldPreviewRedeem({ params: { vault, shares: ONE_SHARE } });
  const price = useAssetUsdPrice(info.vault.asset);

  if (balances.some(q => q.isLoading)) {
    return (
      <li className="py-3">
        <Skeleton className="h-6 w-full" />
      </li>
    );
  }

  return balances.map((q, index) => {
    const holder = holders[index];
    if (q.isError && holder) {
      return (
        <li key={holder.chainKey} className="py-3 text-sm text-destructive">
          Couldn't read your {info.shareSymbol} shares from {chainName(holder.chainKey)}. Retrying.
        </li>
      );
    }
    const holding = q.data;
    if (!holding || holding.shares === 0n || !isSourceChain(holding.chainKey)) return null;
    const assets = pricePerShare !== undefined ? shareValue(holding.shares, pricePerShare) : undefined;
    const chainKey = holding.chainKey;
    const logo = chainLogo(chainKey);
    return (
      <li key={chainKey} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img src={info.logo} alt="" className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold">{info.shareSymbol}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {logo && <img src={logo} alt="" className="size-3.5 rounded-full" />}
              from {chainName(chainKey)}
            </span>
          </div>
        </div>
        <div className="flex flex-col text-right tabular-nums">
          <span className="font-medium">{formatTokenAmount(holding.shares, SHARE_DECIMALS)} shares</span>
          <span className="text-xs text-muted-foreground">
            {assets !== undefined
              ? `≈ ${formatTokenAmount(assets, info.assetDecimals)} ${info.assetSymbol} · ${formatUsd(toUsd(assets, info.assetDecimals, price))}`
              : '–'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onWithdraw({ vault: info, chainKey, address, shares: holding.shares })}
        >
          Withdraw
        </Button>
      </li>
    );
  });
}
