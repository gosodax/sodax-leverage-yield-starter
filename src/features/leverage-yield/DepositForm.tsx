import {
  useLeverageYieldDeposit,
  useLeverageYieldQuote,
  useLeverageYieldVaultSwap,
  useSodaxContext,
  useSwapApprove,
} from '@sodax/dapp-kit';
import type { SpokeChainKey } from '@sodax/types';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SOURCE_CHAIN,
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
import { depositQuotePayload, type Vault } from './vaults';

const SHARE_DECIMALS = 18;

type Props = { vaults: Vault[]; vaultName: string; onVaultChange: (name: string) => void };

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function DepositForm({ vaults, vaultName, onVaultChange }: Props) {
  const { sodax } = useSodaxContext();
  const [chain, setChain] = useState<SourceChainKey>(DEFAULT_SOURCE_CHAIN);
  const tokens = useMemo(() => getDepositTokens(chain), [chain]);
  const [tokenKey, setTokenKey] = useState<string>(DEFAULT_TOKEN_KEY);
  const token = getTokenByKey(chain, tokenKey) ?? tokens[0];
  const [amount, setAmount] = useState('5');
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [srcTx, setSrcTx] = useState<string>();

  const wallet = useEvmWallet(chain);
  const vault = vaults.find(v => v.name === vaultName);
  const amountRaw = token ? parseTokenAmount(amount, token.decimals) : undefined;
  const validAmount = amountRaw !== undefined && amountRaw > 0n ? amountRaw : undefined;

  const { data: quote, isFetching: quoting } = useLeverageYieldQuote({
    params: {
      payload: vault && token && validAmount ? depositQuotePayload(chain, token, vault.vault, validAmount) : undefined,
    },
  });
  const quoted = quote?.ok ? quote.value.quoted_amount : undefined;
  const minOut = quoted !== undefined ? minAmountAfterSlippage(quoted, slippageBps) : undefined;
  const noRoute = quote && !quote.ok;

  const { mutateAsyncSafe: buildDeposit } = useLeverageYieldDeposit();
  const { mutateAsyncSafe: approve } = useSwapApprove();
  const { mutateAsyncSafe: vaultSwap } = useLeverageYieldVaultSwap();
  const tracked = useTrackedState(srcTx ? chain : undefined, srcTx);

  const setStep = (label: string, state: Step['state'], txHash?: string) =>
    setSteps(prev => prev.map(s => (s.label === label ? { ...s, state, txHash: txHash ?? s.txHash, chain } : s)));

  async function submit() {
    if (!vault || !token || !validAmount || minOut === undefined || !wallet.address || !wallet.walletProvider) return;
    setError(undefined);
    setSrcTx(undefined);
    setBusy(true);
    setSteps([
      { label: 'Approve token', state: 'todo' },
      { label: 'Sign deposit', state: 'todo' },
      { label: 'Delivery to Sonic and solver fill', state: 'todo' },
    ]);
    try {
      const built = await buildDeposit({
        vault: vault.vault,
        srcChainKey: chain,
        srcAddress: wallet.address,
        inputToken: token.address,
        inputAmount: validAmount,
        minOutputAmount: minOut,
      });
      if (!built.ok) throw built.error;

      setStep('Approve token', 'active');
      const allowance = await sodax.swaps.isAllowanceValid({
        params: built.value.params,
        walletProvider: wallet.walletProvider,
      });
      if (!allowance.ok) throw allowance.error;
      if (!allowance.value) {
        const approval = await approve({
          params: { ...built.value.params, srcChainKey: chain },
          walletProvider: wallet.walletProvider,
        });
        if (!approval.ok) throw approval.error;
        const hash = approval.value as `0x${string}`;
        const receipt = await wallet.walletProvider.waitForTransactionReceipt(hash);
        if (receipt.status === 'reverted' || receipt.status === ('0x0' as string)) throw new Error('Approval reverted');
        setStep('Approve token', 'done', hash);
      } else {
        setStep('Approve token', 'done');
      }

      setStep('Sign deposit', 'active');
      const swap = await vaultSwap({ ...built.value, walletProvider: wallet.walletProvider });
      if (!swap.ok) throw swap.error;
      setStep('Sign deposit', 'done', swap.value.intentDeliveryInfo.srcTxHash);
      setStep('Delivery to Sonic and solver fill', 'active');
      setSrcTx(swap.value.intentDeliveryInfo.srcTxHash);
    } catch (e) {
      setError(errMessage(e));
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
  else if (wallet.isWrongChain) action = <Button onClick={wallet.switchChain}>Switch to {chainName(chain)}</Button>;
  else
    action = (
      <Button onClick={submit} disabled={busy || minOut === undefined || !validAmount}>
        {busy ? 'Working…' : 'Deposit'}
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
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-sm font-medium">
          From network
          <Select
            value={chain}
            onValueChange={c => {
              setChain(c as SourceChainKey);
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
              {tokens.map(t => (
                <SelectItem key={t.address} value={t.symbol}>
                  {t.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium">
        Amount
        <Input
          aria-label="Amount"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.0"
        />
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium">
        Slippage (max {MAX_SLIPPAGE_BPS / 100}%)
        <Input
          inputMode="decimal"
          value={slippageBps / 100}
          onChange={e => {
            const pct = Number(e.target.value);
            if (Number.isFinite(pct) && pct > 0) setSlippageBps(Math.min(MAX_SLIPPAGE_BPS, Math.round(pct * 100)));
          }}
        />
      </div>

      <div className="rounded-md bg-muted p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">You receive (est.)</span>
          <span>
            {quoting && quoted === undefined ? '…' : `${formatTokenAmount(quoted, SHARE_DECIMALS, 6)} ${vaultName}`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Minimum you accept</span>
          <span>
            {formatTokenAmount(minOut, SHARE_DECIMALS, 6)} {vaultName}
          </span>
        </div>
      </div>
      {noRoute && <Callout>No route right now. Solvers may be rebalancing; the quote retries automatically.</Callout>}
      <Callout>
        Leveraged vault: the APR is variable and can go negative, the share price can fall, and exit is only via
        withdraw. Real funds.
      </Callout>
      {action}
      {shownSteps.length > 0 && <Stepper steps={shownSteps} />}
      {tracked === 'done' && (
        <Callout variant="success">Deposit filled. Your shares appear under “Your vaults”.</Callout>
      )}
      {tracked === 'failed' && <Callout variant="destructive">The solver could not fill this deposit.</Callout>}
      <ErrorNote message={error} />
    </div>
  );
}
