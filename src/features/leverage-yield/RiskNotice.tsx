import { Callout } from '@/components/ui/callout';

/** Risks the user must see before signing a deposit. */
export function RiskNotice({
  accepted,
  onAcceptedChange,
}: {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
}) {
  return (
    <Callout className="flex flex-col gap-2">
      <p className="font-semibold">Real funds, leveraged risk</p>
      <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
        <li>The vault borrows against its asset; leverage multiplies yield and losses.</li>
        <li>APR is variable and can go negative. The share price can fall.</li>
        <li>Shares sit in your SODAX hub wallet on Sonic, per network, not in your wallet extension.</li>
        <li>The only exit is a withdraw, signed from the same network and address.</li>
      </ul>
      <label className="mt-1 flex cursor-pointer items-center gap-2 font-medium">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={accepted}
          onChange={e => onAcceptedChange(e.target.checked)}
        />
        I understand these risks
      </label>
    </Callout>
  );
}
