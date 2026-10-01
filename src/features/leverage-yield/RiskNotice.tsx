import { Callout } from '@/components/ui/callout';

/** Shown before every deposit: the vault is leveraged and runs on mainnet with real funds. */
export function RiskNotice({
  asset,
  acknowledged,
  onAcknowledge,
  disabled,
}: {
  asset: string;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Callout className="flex flex-col gap-2">
      <p className="font-semibold">Real funds, leveraged risk</p>
      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        <li>The vault loops {asset} with borrowed funds. The APR is variable and can turn negative.</li>
        <li>If {asset} depegs or rates move against the vault, the share price can fall.</li>
        <li>Smart contract risk applies. Deposit only what you can afford to lose.</li>
      </ul>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={acknowledged}
          disabled={disabled}
          onChange={e => onAcknowledge(e.target.checked)}
        />
        I understand these risks
      </label>
    </Callout>
  );
}
