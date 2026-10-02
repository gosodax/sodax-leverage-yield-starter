import type { XToken } from '@sodax/types';
import { CheckIcon, CircleIcon, ExternalLinkIcon, Loader2Icon, MinusIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS, SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName, explorerTxUrl } from '@/lib/chains';
import { formatBps, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Step } from './flow';

/** Round letter badge for a token or vault (the registry carries no logos). */
export function TokenBadge({ symbol, className }: { symbol: string; className?: string }) {
  const letters = symbol.replace(/^lsoda/, '').slice(0, 2);
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground ring-1 ring-border',
        className,
      )}
    >
      {letters}
    </span>
  );
}

export function ChainIcon({ chainKey, className }: { chainKey: SourceChainKey; className?: string }) {
  const logo = chainLogo(chainKey);
  return logo ? <img src={logo} alt="" className={cn('size-4 rounded-full', className)} /> : null;
}

export function ChainSelect({
  value,
  onChange,
  chains = SOURCE_CHAINS,
  suffix,
  label,
}: {
  value: SourceChainKey;
  onChange: (chainKey: SourceChainKey) => void;
  chains?: readonly SourceChainKey[];
  suffix?: (chainKey: SourceChainKey) => ReactNode;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as SourceChainKey)}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {chains.map(chainKey => (
          <SelectItem key={chainKey} value={chainKey}>
            <ChainIcon chainKey={chainKey} />
            {chainName(chainKey)}
            {suffix && <span className="ml-1 text-xs text-muted-foreground">{suffix(chainKey)}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TokenSelect({
  tokens,
  value,
  onChange,
  label,
}: {
  tokens: XToken[];
  value: string | undefined;
  onChange: (address: string) => void;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder="Token" />
      </SelectTrigger>
      <SelectContent>
        {tokens.map(t => (
          <SelectItem key={t.address} value={t.address}>
            <span className="font-medium">{t.symbol}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FieldLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs font-medium text-muted-foreground">
      <span className="uppercase tracking-wide">{children}</span>
      {aside}
    </div>
  );
}

const SLIPPAGE_CHOICES = [50, DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS].filter((v, i, a) => a.indexOf(v) === i);

export function SlippagePicker({ value, onChange }: { value: number; onChange: (bps: number) => void }) {
  return (
    <fieldset className="flex items-center gap-1" aria-label="Slippage tolerance">
      {SLIPPAGE_CHOICES.map(bps => (
        <button
          key={bps}
          type="button"
          aria-pressed={value === bps}
          onClick={() => onChange(bps)}
          className={cn(
            'rounded-sm border px-2.5 py-0.5 text-xs font-medium transition-colors',
            value === bps ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary',
          )}
        >
          {formatBps(bps)}
        </button>
      ))}
    </fieldset>
  );
}

/** One label/value line in a summary box. */
export function SummaryRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">
        {hint ? (
          <Tooltip content={hint}>
            <span className="cursor-help underline decoration-dotted underline-offset-4">{label}</span>
          </Tooltip>
        ) : (
          label
        )}
      </span>
      <span className="text-right font-medium tabular-nums">{children}</span>
    </div>
  );
}

const STEP_ICON: Record<Step['state'], ReactNode> = {
  pending: <CircleIcon className="size-3 text-subtle-foreground" />,
  active: <Loader2Icon className="size-4 animate-spin text-primary" />,
  done: <CheckIcon className="size-4 text-success" />,
  error: <XIcon className="size-4 text-destructive" />,
  skipped: <MinusIcon className="size-4 text-subtle-foreground" />,
};

/** Planned steps before signing, then live progress with explorer links. */
export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, i) => {
        const url = step.hash && step.chainKey ? explorerTxUrl(step.chainKey, step.hash) : undefined;
        return (
          <li
            key={step.id}
            className={cn(
              'flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
              step.state === 'active' && 'border-primary/40 bg-secondary',
              step.state === 'error' && 'border-destructive/40 bg-destructive-muted',
              step.state === 'skipped' && 'opacity-60',
            )}
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">{STEP_ICON[step.state]}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn('font-medium', step.state === 'pending' && 'text-muted-foreground')}>
                {i + 1}. {step.label}
              </span>
              {step.detail && <span className="text-xs text-muted-foreground">{step.detail}</span>}
            </div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {shortenAddress(step.hash, 3)}
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function formatUsd(value: number | undefined, compact = false): string {
  if (value === undefined || !Number.isFinite(value)) return '–';
  if (value > 0 && value < 0.01) return '< $0.01';
  return (compact ? usdCompact : usd).format(value);
}
