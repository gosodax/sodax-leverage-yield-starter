import {
  useLeverageYieldQuote,
  useLeverageYieldShareBalances,
  useLeverageYieldVaultSwap,
  useLeverageYieldWithdraw,
} from '@sodax/dapp-kit';
import type { SpokeChainKey } from '@sodax/types';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_KEY,
  getDepositTokens,
  getTokenByKey,
  MAX_SLIPPAGE_BPS,
  SOURCE_CHAINS,
  type SourceChainKey,
} from '@/config/workshop';
import { chainName } from '@/lib/chains';
import { formatTokenAmount, minAmountAfterSlippage, parseTokenAmount } from '@/lib/format';
import { useEvmWallet } from '@/wallet';
import { ErrorNote, type Step, Stepper, useTrackedState } from './TxProgress';
import { useHolders, type Vault, withdrawQuotePayload } from './vaults';

const SHARE_DECIMALS = 18;

type Props = { vaults: Vault[]; vaultName: string; onVaultChange: (name: string) => void };

export function WithdrawForm({ vaults, vaultName, onVaultChange }: Props) {
  const vault = vaults.find(v => v.name === vaultName);
  const [holdChain, setHoldChain] = useState<SourceChainKey>(SOURCE_CHAINS[0]);
  const [dstChain, setDstChain] = useState<SourceChainKey>(SOURCE_CHAINS[0]);
  const dstTokens = useMemo(() => getDepositTokens(dstChain), [dstChain]);
  const [tokenKey, setTokenKey] = useState<string>(DEFAULT_TOKEN_KEY);
  const token = getTokenByKey(dstChain, tokenKey) ?? dstTokens[0];
  const [amount, setAmount] = useState('');
  const [slippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [srcTx, setSrcTx] = useState<string>();

  const wallet = useEvmWallet(holdChain);
  const holders = useHolders(wallet.address);
  const balances = useLeverageYieldShareBalances({ params: { vault: vault?.vault, holders } });
  const sharesByChain = new Map<string, bigint>();
  for (const q of balances) if (q.data) sharesByChain.set(q.data.chainKey, q.data.shares);
  const held = sharesByChain.get(holdChain) ?? 0n;

  const sharesRaw = parseTokenAmount(amount, SHARE_DECIMALS);
  const validShares = sharesRaw !== undefined && sharesRaw > 0n && sharesRaw <= held ? sharesRaw : undefined;

  const { data: quote, isFetching: quoting } = useLeverageYieldQuote({
    params: {
      payload:
        vault && token && validShares ? withdrawQuotePayload(dstChain, token, vault.vault, validShares) : undefined,
    },
  });
  const quoted = quote?.ok ? quote.value.quoted_amount : undefined;
  const minOut = quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined;

  const { mutateAsyncSafe: buildWithdraw } = useLeverageYieldWithdraw();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const tracked = useTrackedState(srcTx ? holdChain : undefined, srcTx);

  const setStep = (label: string, state: Step['state'], txHash?: string) =>
    setSteps(prev =>
      prev.map(s => (s.label === label ? { ...s, state, txHash: txHash ?? s.txHash, chain: holdChain } : s)),
    );

  async function submit() {
    if (!vault || !token || !validShares || minOut === undefined || !wallet.address || !wallet.walletProvider) return;
    setError(undefined);
    setSrcTx(undefined);
    setBusy(true);
    setSteps([
      { label: 'Sign withdraw', state: 'active' },
      { label: 'Delivery to Sonic and solver fill', state: 'todo' },
    ]);
    try {
      const built = await buildWithdraw({
        vault: vault.vault,
        srcChainKey: holdChain,
        srcAddress: wallet.address,
        dstChainKey: dstChain,
        outputToken: token.address,
        inputAmount: validShares,
        minOutputAmount: minOut,
      });
      if (!built.ok) throw built.error;
      const swap = await vaultSwap({ ...built.value, walletProvider: wallet.walletProvider });
      if (!swap.ok) throw swap.error;
      setStep('Sign withdraw', 'done', swap.value.intentDeliveryInfo.srcTxHash);
      setStep('Delivery to Sonic and solver fill', 'active');
      setSrcTx(swap.value.intentDeliveryInfo.srcTxHash);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSteps(prev => prev.map(s => (s.state === 'active' ? { ...s, state: 'error' } : s)));
    } finally {
      setBusy(false);
    }
  }

  const shownSteps: Step[] = steps.map(s =>
    s.label.startsWith('Delivery') && srcTx
      ? { ...s, state: tracked === 'done' ? 'done' : tracked === 'failed' ? 'error' : 'active' }
      : s,
  );

  let action: React.ReactNode;
  if (!wallet.isConnected) action = <Button onClick={wallet.connect}>Connect wallet</Button>;
  else if (wallet.isWrongChain) action = <Button onClick={wallet.switchChain}>Switch to {chainName(holdChain)}</Button>;
  else
    action = (
      <Button onClick={submit} disabled={busy || minOut === undefined || !validShares}>
        {busy ? 'Working…' : 'Withdraw'}
      </Button>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm font-medium">
        Vault
        <Select value={vaultName} onValueChange={onVaultChange}>
          <SelectTrigger>
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
      <div className="flex flex-col gap-1 text-sm font-medium">
        Shares held via (the network you deposited from)
        <Select value={holdChain} onValueChange={c => setHoldChain(c as SourceChainKey)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_CHAINS.map(c => (
              <SelectItem key={c} value={c}>
                {chainName(c)} · {formatTokenAmount(sharesByChain.get(c), SHARE_DECIMALS, 4)} shares
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium">
        <span className="flex justify-between">
          Shares to withdraw
          <button type="button" className="text-primary" onClick={() => setAmount(formatMax(held))}>
            Max ({formatTokenAmount(held, SHARE_DECIMALS, 6)})
          </button>
        </span>
        <Input
          aria-label="Shares to withdraw"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.0"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm font-medium">
          Receive on
          <Select
            value={dstChain}
            onValueChange={c => {
              setDstChain(c as SourceChainKey);
              if (!getTokenByKey(c as SpokeChainKey, tokenKey)) setTokenKey(DEFAULT_TOKEN_KEY);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_CHAINS.map(c => (
                <SelectItem key={c} value={c}>
                  {chainName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium">
          Token
          <Select value={token ? tokenKey : undefined} onValueChange={setTokenKey}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dstTokens.map(t => (
                <SelectItem key={t.address} value={t.symbol}>
                  {t.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md bg-muted p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">You receive (est.)</span>
          <span>
            {quoting && quoted === undefined
              ? '…'
              : `${formatTokenAmount(quoted, token?.decimals ?? 18, 6)} ${token?.symbol ?? ''}`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Minimum you accept (max {MAX_SLIPPAGE_BPS / 100}% slippage)</span>
          <span>
            {formatTokenAmount(minOut, token?.decimals ?? 18, 6)} {token?.symbol}
          </span>
        </div>
      </div>
      {action}
      {shownSteps.length > 0 && <Stepper steps={shownSteps} />}
      {tracked === 'done' && <Callout variant="success">Withdraw filled.</Callout>}
      {tracked === 'failed' && <Callout variant="destructive">The solver could not fill this withdraw.</Callout>}
      <ErrorNote message={error} />
    </div>
  );
}

function formatMax(shares: bigint): string {
  const s = shares.toString().padStart(SHARE_DECIMALS + 1, '0');
  const whole = s.slice(0, -SHARE_DECIMALS);
  const frac = s.slice(-SHARE_DECIMALS).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}
