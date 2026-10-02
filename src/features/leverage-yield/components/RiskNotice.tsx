import { WarningIcon } from '@phosphor-icons/react';
import { useCallback, useId, useState } from 'react';
import { Disclosure } from '@/components/ui/disclosure';

const ACK_KEY = 'leverage-yield:risks-acknowledged';

/** Whether the user ticked "I understand the risks" in this browser session. */
export function useRiskAcknowledgement(): [boolean, (value: boolean) => void] {
  const [acknowledged, setAcknowledged] = useState(() => {
    try {
      return sessionStorage.getItem(ACK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const set = useCallback((value: boolean) => {
    setAcknowledged(value);
    try {
      if (value) sessionStorage.setItem(ACK_KEY, '1');
      else sessionStorage.removeItem(ACK_KEY);
    } catch {
      // Storage blocked (private window): the tick still holds for this page view.
    }
  }, []);
  return [acknowledged, set];
}

/**
 * Shown before any deposit. The app handles real mainnet funds. One line by default; the full list is one click away,
 * and the explicit "I understand the risks" tick gates the deposit button.
 */
export function RiskNotice({
  acknowledged,
  onAcknowledge,
}: {
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}) {
  const checkboxId = useId();
  return (
    <div
      role="note"
      className="flex flex-col gap-3 rounded-md border border-l-4 border-l-primary bg-notice p-4 text-sm"
    >
      <Disclosure
        label={
          <span className="flex items-center gap-2 text-sm text-foreground">
            <WarningIcon weight="duotone" className="size-4 shrink-0" />
            Real funds, variable leveraged yield. Read the risks
          </span>
        }
      >
        <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
          <li>This uses real funds on mainnet. Deposit only what you are prepared to lose.</li>
          <li>
            Vault shares go to your own SODAX hub wallet on Sonic, which only your wallet controls. They won't appear in
            your wallet app, but this page shows them.
          </li>
          <li>Withdraw later from the same network you deposit from.</li>
          <li>
            The vault is leveraged: the APR can change or turn negative, and the share price can fall. Solvers may be
            unable to fill very small amounts.
          </li>
        </ul>
      </Disclosure>
      <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          id={checkboxId}
          type="checkbox"
          checked={acknowledged}
          onChange={event => onAcknowledge(event.target.checked)}
          className="size-4 accent-primary"
        />
        I understand the risks
      </label>
    </div>
  );
}
