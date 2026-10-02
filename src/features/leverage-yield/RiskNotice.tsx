import { Callout } from '@/components/ui/callout';

/** The risks a user must see before signing, from the leverage-yield guide. */
export function RiskNotice({ compact = false }: { compact?: boolean }) {
  return (
    <Callout>
      <p className="font-semibold">Real funds, leveraged position</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
        <li>The APR is variable and can go negative when borrowing costs exceed the yield.</li>
        <li>The vault holds debt (health factor around 1.2). A depeg or price move can hurt the share price.</li>
        {!compact && <li>Your shares live in your hub wallet on Sonic, per source network, not in your wallet app.</li>}
        <li>The only way out is to withdraw. Shares can't be sent elsewhere from this app.</li>
      </ul>
    </Callout>
  );
}
