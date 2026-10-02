import type { ReactNode } from 'react';
import { Callout } from '@/components/ui/callout';
import { cn } from '@/lib/utils';
import { type SuccessAmount, SuccessBurst } from './motion';
import type { FillStatus } from './useFillStatus';

/** A label and its value; `text` sets a non-numeric value in the body face instead of the monospace. */
export function SummaryRow({ label, children, text }: { label: ReactNode; children: ReactNode; text?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right font-medium', text ? '' : 'font-mono tabular-nums')}>{children}</span>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="font-mono font-semibold tabular-nums">{value}</div>
      {hint && <span className="font-mono text-xs text-subtle-foreground tabular-nums">{hint}</span>}
    </div>
  );
}

export function RiskNotice() {
  return (
    <Callout className="text-xs leading-relaxed">
      <strong>Real funds, leveraged vault.</strong> The APR is variable and can go negative, the share price can fall,
      and the vault runs at a health factor near 1.2. Your shares sit in your SODAX hub wallet on Sonic for the network
      you sign from, not in your wallet extension. The only exit is a withdraw.
    </Callout>
  );
}

/** Terminal outcome of a tracked vault swap, or nothing while it is still running. */
export function FillOutcome({
  fill,
  success,
}: {
  fill: FillStatus;
  success: { title: string; amount?: SuccessAmount; caption?: ReactNode };
}) {
  if (fill.state === 'filled') return <SuccessBurst {...success} />;
  if (fill.state === 'failed') {
    return (
      <Callout variant="destructive">
        {fill.message} An intent that is not filled expires at its deadline. Check the transaction links above to see
        where your funds are.
      </Callout>
    );
  }
  if (fill.state === 'timeout') {
    return (
      <Callout variant="destructive">
        No fill after several minutes. Your transaction is on-chain: check the links above, or check your position again
        in a few minutes.
      </Callout>
    );
  }
  return null;
}

export function Field({
  label,
  htmlFor,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}
