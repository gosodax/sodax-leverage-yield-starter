import type { Address } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { chainName } from '@/lib/chains';
import { formatTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { useShareHoldings } from './usePosition';

type Props = { vaultName: string; vault: Address | undefined };

export function PositionCard({ vaultName, vault }: Props) {
  const { isConnected } = useEvmWallet();
  const { holdings, total, isLoading } = useShareHoldings(vault);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your position</CardTitle>
        <CardDescription>
          Shares live in your SODAX hub wallet on Sonic, one per deposit network, not in MetaMask.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {!isConnected ? (
          <p className="text-muted-foreground">Connect a wallet to see your shares.</p>
        ) : isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <p className="text-2xl font-bold">
              {formatTokenAmount(total, 18, 6)} {vaultName}
            </p>
            {holdings
              .filter(holding => holding.shares > 0n)
              .map(holding => (
                <p key={holding.chainKey} className="flex justify-between text-muted-foreground">
                  <span>Deposited from {chainName(holding.chainKey)}</span>
                  <span>{formatTokenAmount(holding.shares, 18, 6)}</span>
                </p>
              ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
