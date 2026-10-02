import { Callout } from '@/components/ui/callout';

/** Shown before every signature, with an explicit acknowledgement. */
export function RiskNotice({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Callout className="flex flex-col gap-2 text-xs">
      <p>
        <strong>Real funds, real risk.</strong> This vault is leveraged (health factor ~1.2): the APR is variable and
        can turn negative, the share price can fall, and smart contracts can fail. Shares sit in your SODAX hub wallet
        on Sonic, and the only exit is a withdraw.
      </p>
      <label className="flex cursor-pointer items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="size-4 accent-primary"
        />
        I understand the risks
      </label>
    </Callout>
  );
}
