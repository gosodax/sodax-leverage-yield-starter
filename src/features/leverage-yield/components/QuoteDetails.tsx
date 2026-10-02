import type { LeverageYieldVault, XToken } from '@sodax/types';
import { InfoTip } from '@/components/ui/info-tip';
import { Flash } from '@/components/ui/motion';
import { DEFAULT_SLIPPAGE_BPS } from '@/config/workshop';
import { formatBps, formatTokenAmount } from '@/lib/format';
import { useShareValue } from '../hooks/useShareValue';
import { vaultBrand } from '../lib/brands';
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
        <Flash value={`${formatTokenAmount(shares, SHARE_DECIMALS)} shares`} />
      </dd>
      {value !== undefined && (
        <>
          <dt className="text-muted-foreground">Worth now</dt>
          <dd className="text-right">
            <Flash value={`≈ ${formatTokenAmount(value, asset.decimals)} ${vaultBrand(vault).ticker}`} />
          </dd>
        </>
      )}
      <dt className="flex items-center gap-1 text-muted-foreground">
        Minimum received
        <InfoTip label="About the minimum">
          If the fill would give you fewer shares than this, it does not go through and your funds stay with you.
        </InfoTip>
      </dt>
      <dd className="text-right">
        <Flash value={`${formatTokenAmount(minShares, SHARE_DECIMALS)} shares`} />
      </dd>
      <dt className="flex items-center gap-1 text-muted-foreground">
        Max slippage
        <InfoTip label="About slippage">
          How far the result may move from this quote before the minimum above applies.
        </InfoTip>
      </dt>
      <dd className="text-right">{formatBps(DEFAULT_SLIPPAGE_BPS)}</dd>
    </dl>
  );
}
