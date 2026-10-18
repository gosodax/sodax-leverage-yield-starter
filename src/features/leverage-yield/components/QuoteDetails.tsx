import type { LeverageYieldVault, XToken } from '@sodax/types';
import { DEFAULT_SLIPPAGE_BPS } from '@/config/workshop';
import { formatBps, formatTokenAmount } from '@/lib/format';
import { useShareValue } from '../hooks/useShareValue';
import { SHARE_DECIMALS, underlying } from '../lib/vaults';

/** Deposit summary: what goes in, the shares expected, what they're worth now, the minimum accepted. */
export function QuoteDetails({
  vault,
  token,
  inputAmount,
  shares,
  minShares,
}: {
  vault: LeverageYieldVault;
  token: XToken;
  inputAmount: bigint;
  shares: bigint;
  minShares: bigint;
}) {
  const value = useShareValue(vault.vault, shares);
  const asset = underlying(vault);

  return (
    <dl className="grid grid-cols-2 gap-y-2 rounded-md bg-secondary p-4 text-sm">
      <dt className="text-muted-foreground">You deposit</dt>
      <dd className="text-right font-medium">
        {formatTokenAmount(inputAmount, token.decimals)} {token.symbol}
      </dd>
      <dt className="text-muted-foreground">You receive (est.)</dt>
      <dd className="text-right font-semibold">
        {formatTokenAmount(shares, SHARE_DECIMALS)} {vault.name}
      </dd>
      {value !== undefined && (
        <>
          <dt className="text-muted-foreground">Worth now</dt>
          <dd className="text-right">
            ≈ {formatTokenAmount(value, asset.decimals)} {asset.symbol}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Minimum received</dt>
      <dd className="text-right">
        {formatTokenAmount(minShares, SHARE_DECIMALS)} {vault.name}
      </dd>
      <dt className="text-muted-foreground">Max slippage</dt>
      <dd className="text-right">{formatBps(DEFAULT_SLIPPAGE_BPS)}</dd>
    </dl>
  );
}
