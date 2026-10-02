import { Callout } from '@/components/ui/callout';

/** The risks a depositor takes, shown before they sign. */
export function RiskNotice() {
  return (
    <Callout className="flex flex-col gap-1.5 text-xs leading-relaxed">
      <p className="font-display text-sm tracking-wide">Before you sign</p>
      <ul className="list-disc space-y-0.5 pl-4">
        <li>Real funds. The vault borrows against its collateral; APR is variable and can turn negative.</li>
        <li>If the borrowed asset rises against the collateral, the vault can be liquidated and lose value.</li>
        <li>
          Smart contract, solver and cross-network delivery risk. Shares sit in your SODAX hub wallet on Sonic, not in
          your wallet app.
        </li>
      </ul>
    </Callout>
  );
}
