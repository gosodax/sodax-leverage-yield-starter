import {
  useLeverageYieldDeposit,
  useLeverageYieldQuote,
  useLeverageYieldVaultSwap,
  useSodaxContext,
} from '@sodax/dapp-kit';
import { messageOf } from '@sodax/sdk';
import { ChainKeys } from '@sodax/types';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  MAX_SLIPPAGE_BPS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { formatBps, formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { TransactionDialog, type TxPhase, useTxSteps } from './TransactionDialog';

const SHARE_DECIMALS = 18;
const STEP_LABELS = {
  approve: 'Approve the token (only if needed)',
  deposit: 'Sign the deposit, deliver to Sonic, solver fills',
};
const SLIPPAGE_OPTIONS = [50, DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS];

type Props = { vaultName: string; onVaultChange: (name: string) => void };

export function DepositForm({ vaultName, onVaultChange }: Props) {
  const { sodax } = useSodaxContext();
  const vaults = sodax.leverageYield.listVaults();

  const [chainKey, setChainKey] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const [tokenAddress, setTokenAddress] = useState<string | undefined>();
  const [amount, setAmount] = useState('5');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);

  const { address, walletProvider, isConnected, isWrongChain, switchChain, connect } = useEvmWallet(chainKey);
  const { steps, update, reset } = useTxSteps(STEP_LABELS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState<TxPhase>('review');
  const [error, setError] = useState<string>();
  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();

  const tokens = useMemo(() => getDepositTokens(chainKey), [chainKey]);
  const token =
    tokens.find(t => t.address === tokenAddress) ?? tokens.find(t => t.symbol === DEFAULT_TOKEN_KEY) ?? tokens[0];
  const vault = vaults.find(v => v.name === vaultName);
  const inputAmount = token ? parseTokenAmount(amount, token.decimals) : undefined;

  const { data: quote, isFetching } = useLeverageYieldQuote({
    params: {
      payload:
        vault && token && inputAmount && inputAmount > 0n
          ? {
              token_src: token.address,
              token_src_blockchain_id: chainKey,
              token_dst: vault.vault,
              token_dst_blockchain_id: ChainKeys.SONIC_MAINNET,
              amount: inputAmount,
              quote_type: 'exact_input',
            }
          : undefined,
    },
  });

  const quotedShares = quote?.ok ? quote.value.quoted_amount : undefined;
  const minShares = quotedShares === undefined ? undefined : minAmountAfterSlippage(quotedShares, slippageBps);

  const fail = (stepId: string, message: string) => {
    update(stepId, 'error');
    setError(message);
    setPhase('failed');
  };

  async function deposit() {
    if (!vault || !token || !inputAmount || !minShares || !address || !walletProvider) return;
    reset();
    setError(undefined);
    setPhase('running');
    update('approve', 'active');

    const built = await buildDeposit({
      vault: vault.vault,
      srcChainKey: chainKey,
      srcAddress: address,
      inputToken: token.address,
      inputAmount,
      minOutputAmount: minShares,
    });
    if (!built.ok) return fail('approve', messageOf(built.error, 'Could not build the deposit'));

    const allowance = await sodax.swaps.isAllowanceValid({ params: built.value.params, walletProvider });
    if (!allowance.ok) return fail('approve', messageOf(allowance.error, 'Allowance check failed'));
    if (!allowance.value) {
      const approval = await sodax.swaps.approve<typeof chainKey, false>({
        params: { ...built.value.params, srcChainKey: chainKey },
        walletProvider,
      });
      if (!approval.ok) return fail('approve', messageOf(approval.error, 'Approval failed'));
      const receipt = await walletProvider.waitForTransactionReceipt(approval.value);
      if (receipt.status === 'reverted' || receipt.status === '0x0') return fail('approve', 'Approval reverted');
      const url = explorerTxUrl(chainKey, approval.value);
      update('approve', 'done', url ? [{ label: 'Approval transaction', url }] : []);
    } else {
      update('approve', 'done');
    }

    update('deposit', 'active');
    const swap = await vaultSwap({ ...built.value, walletProvider });
    if (!swap.ok) return fail('deposit', messageOf(swap.error, 'Deposit failed'));

    const { srcTxHash, dstTxHash } = swap.value.intentDeliveryInfo;
    const links = [
      { label: `Deposit on ${chainName(chainKey)}`, url: explorerTxUrl(chainKey, srcTxHash) },
      { label: 'Delivered on Sonic', url: explorerTxUrl(ChainKeys.SONIC_MAINNET, dstTxHash) },
    ].flatMap(({ label, url }) => (url ? [{ label, url }] : []));
    update('deposit', 'done', links);
    setPhase('done');
  }

  function openReview() {
    reset();
    setError(undefined);
    setPhase('review');
    setDialogOpen(true);
  }

  const canReview = !!vault && !!token && !!inputAmount && !!minShares && !isWrongChain;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deposit</CardTitle>
        <CardDescription>
          Pay with any supported token; vault shares arrive in your SODAX hub wallet on Sonic.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Callout>
          Real funds. Vaults borrow against their collateral (health factor around 1.2), the APR is variable and can go
          negative, and share price can fall.
        </Callout>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <span>Vault</span>
          <Select value={vaultName} onValueChange={onVaultChange}>
            <SelectTrigger aria-label="Vault">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vaults.map(v => (
                <SelectItem key={v.name} value={v.name}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Network</span>
            <Select
              value={chainKey}
              onValueChange={value => {
                setChainKey(value as SourceChainKey);
                setTokenAddress(undefined);
              }}
            >
              <SelectTrigger aria-label="Network">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_CHAINS.map(key => (
                  <SelectItem key={key} value={key}>
                    {chainName(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Token</span>
            <Select value={token?.address} onValueChange={setTokenAddress}>
              <SelectTrigger aria-label="Token">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens.map(t => (
                  <SelectItem key={t.address} value={t.address}>
                    {t.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <span>Amount</span>
          <Input
            aria-label="Amount"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.0"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Slippage
          <div className="flex gap-2">
            {SLIPPAGE_OPTIONS.map(bps => (
              <Button
                key={bps}
                size="sm"
                variant={bps === slippageBps ? 'default' : 'outline'}
                onClick={() => setSlippageBps(bps)}
              >
                {formatBps(bps)}
              </Button>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted p-4 text-sm">
          <dt className="text-muted-foreground">You receive (est.)</dt>
          <dd className="text-right font-medium">
            {quotedShares === undefined
              ? isFetching
                ? 'Fetching quote…'
                : '–'
              : `${formatTokenAmount(quotedShares, SHARE_DECIMALS)} ${vaultName}`}
          </dd>
          <dt className="text-muted-foreground">Minimum you accept</dt>
          <dd className="text-right font-medium">
            {minShares === undefined ? '–' : `${formatTokenAmount(minShares, SHARE_DECIMALS)} ${vaultName}`}
          </dd>
        </dl>

        {quote && !quote.ok ? (
          <Callout variant="destructive">
            No route right now. Solvers may be rebalancing; the quote retries automatically.
          </Callout>
        ) : null}
        {inputAmount === undefined && amount !== '' ? (
          <Callout variant="destructive">Enter a valid amount.</Callout>
        ) : null}

        {isConnected ? (
          isWrongChain ? (
            <Button onClick={switchChain}>Switch to {chainName(chainKey)}</Button>
          ) : (
            <Button disabled={!canReview} onClick={openReview}>
              Review deposit
            </Button>
          )
        ) : (
          <Button onClick={connect}>Connect wallet</Button>
        )}

        <TransactionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={`Deposit into ${vaultName}`}
          rows={[
            { label: 'You pay', value: `${amount} ${token?.symbol ?? ''} on ${chainName(chainKey)}` },
            {
              label: 'You receive (est.)',
              value: `${formatTokenAmount(quotedShares, SHARE_DECIMALS)} ${vaultName}`,
            },
            {
              label: `Minimum you accept (${formatBps(slippageBps)} slippage)`,
              value: `${formatTokenAmount(minShares, SHARE_DECIMALS)} ${vaultName}`,
            },
          ]}
          steps={steps}
          phase={phase}
          error={error}
          confirmLabel="Confirm deposit"
          onConfirm={deposit}
        />
      </CardContent>
    </Card>
  );
}
