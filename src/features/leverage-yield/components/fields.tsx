import type { SpokeChainKey, XToken } from '@sodax/types';
import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import { formatBps, formatTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        {hint && <span className="text-subtle-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function ChainLabel({ chainKey }: { chainKey: SpokeChainKey }) {
  const logo = chainLogo(chainKey);
  return (
    <span className="flex items-center gap-2">
      {logo && <img src={logo} alt="" className="size-5 rounded-full" />}
      {chainName(chainKey)}
    </span>
  );
}

export function ChainSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: SpokeChainKey;
  options: readonly SpokeChainKey[];
  onChange: (chainKey: SpokeChainKey) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SpokeChainKey)} disabled={disabled}>
      <SelectTrigger aria-label="Network">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(chainKey => (
          <SelectItem key={chainKey} value={chainKey}>
            <ChainLabel chainKey={chainKey} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TokenSelect({
  value,
  tokens,
  balances,
  onChange,
  disabled,
}: {
  value: string;
  tokens: XToken[];
  balances?: Record<string, bigint>;
  onChange: (address: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || tokens.length === 0}>
      <SelectTrigger aria-label="Token">
        <SelectValue placeholder="Token" />
      </SelectTrigger>
      <SelectContent>
        {tokens.map(token => (
          <SelectItem key={token.address} value={token.address}>
            <span className="font-medium">{token.symbol}</span>
            {balances?.[token.address] !== undefined && (
              <span className="text-xs text-muted-foreground">
                {formatTokenAmount(balances[token.address], token.decimals)}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SLIPPAGE_CHOICES = [50, DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS].filter(
  (bps, i, all) => bps <= MAX_SLIPPAGE_BPS && all.indexOf(bps) === i,
);

export function SlippagePicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (bps: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">Max slippage</span>
      <div className="flex gap-1 rounded-full bg-muted p-0.5">
        {SLIPPAGE_CHOICES.map(bps => (
          <button
            key={bps}
            type="button"
            aria-pressed={value === bps}
            disabled={disabled}
            onClick={() => onChange(Math.min(bps, MAX_SLIPPAGE_BPS))}
            className={cn(
              'rounded-full px-2.5 py-1 font-medium transition-colors disabled:opacity-50',
              value === bps ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {formatBps(bps)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SummaryRow({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right tabular-nums', strong && 'font-semibold text-foreground')}>{children}</span>
    </div>
  );
}
