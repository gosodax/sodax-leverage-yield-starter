import type { SpokeChainKey, XToken } from '@sodax/types';
import type { ReactNode } from 'react';
import { SOURCE_CHAINS, type SourceChainKey } from '@/config/workshop';
import { chainLogo, chainName } from '@/lib/chains';
import { cn } from '@/lib/utils';
import { Hourglass } from '../win/icons';

export function NetworkRadios({
  name,
  value,
  onChange,
  current,
  disabled,
}: {
  name: string;
  value: SourceChainKey;
  onChange: (chainKey: SourceChainKey) => void;
  /** The wallet's current network, marked so users see where they are. */
  current?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5" role="radiogroup">
      {SOURCE_CHAINS.map(chainKey => (
        <label key={chainKey} className={cn('flex items-center gap-1.5', disabled && 'text-[var(--win-gray-text)]')}>
          <input
            type="radio"
            className="w2k-radio"
            name={name}
            checked={value === chainKey}
            onChange={() => onChange(chainKey)}
            disabled={disabled}
          />
          <img src={chainLogo(chainKey)} alt="" className="size-4" />
          {chainName(chainKey)}
          {current === chainKey && <span className="text-[10px] text-[var(--win-gray-text)]">(wallet)</span>}
        </label>
      ))}
    </div>
  );
}

export function TokenSelect({
  id,
  tokens,
  value,
  onChange,
}: {
  id: string;
  tokens: XToken[];
  value: XToken | undefined;
  onChange: (token: XToken) => void;
}) {
  return (
    <select
      id={id}
      className="w2k-select w-full"
      value={value?.address ?? ''}
      onChange={event => {
        const next = tokens.find(t => t.address === event.target.value);
        if (next) onChange(next);
      }}
    >
      {tokens.map(token => (
        <option key={token.address} value={token.address}>
          {token.symbol}
          {isNative(token) ? ' (native)' : ''}
        </option>
      ))}
    </select>
  );
}

export function isNative(token: XToken | undefined): boolean {
  return !!token && /^0x0{40}$/i.test(token.address);
}

export function FieldRow({ label, htmlFor, children }: { label: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[110px_1fr] sm:gap-2">
      <label htmlFor={htmlFor} className="text-[var(--win-text)]">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const SLIPPAGE_CHOICES = [50, 100, 200, 300];

export function SlippageSelect({ value, onChange }: { value: number; onChange: (bps: number) => void }) {
  return (
    <select
      aria-label="Slippage tolerance"
      className="w2k-select w-[72px]"
      value={value}
      onChange={event => onChange(Number(event.target.value))}
    >
      {SLIPPAGE_CHOICES.map(bps => (
        <option key={bps} value={bps}>
          {bps / 100}%
        </option>
      ))}
    </select>
  );
}

/** "Refreshing…" hourglass vs. idle dot for the live quote. */
export function LiveDot({ busy }: { busy: boolean }) {
  return busy ? (
    <Hourglass size={11} />
  ) : (
    <span className="inline-block size-[7px] rounded-full bg-[var(--success)]" aria-hidden="true" />
  );
}

export function chainKeyIsSource(chainKey: SpokeChainKey | undefined): chainKey is SourceChainKey {
  return !!chainKey && (SOURCE_CHAINS as readonly string[]).includes(chainKey);
}

/** One line on where shares live, shown under the deposit form. */
export function FlowStepsNote() {
  return (
    <p className="text-[10px] leading-snug text-[var(--win-dark)]">
      Shares are delivered to your SODAX hub wallet on Sonic (one per network you deposit from), not to your wallet
      extension. You sign on your network; SODAX delivers the order to Sonic and an independent solver fills it.
    </p>
  );
}
