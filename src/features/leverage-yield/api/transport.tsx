import { createContext, type ReactNode, useContext, useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * How the feature talks to SODAX:
 * - 'sdk' (default): dapp-kit hooks over the @sodax/sdk (on-chain reads, SDK-built intents).
 * - 'api': the keyless REST API at https://api.sodax.com/v1/leverage-yield (via `sodax.api.leverageYield`
 *   and the `useLeverageYieldApi*` hooks). The API builds unsigned transactions; the wallet signs them.
 */
export type Transport = 'sdk' | 'api';

const STORAGE_KEY = 'leverage-yield:transport';
const OPTIONS: { value: Transport; label: string; hint: string }[] = [
  { value: 'sdk', label: 'SDK', hint: 'dapp-kit hooks over @sodax/sdk: reads from chain, SDK builds intents.' },
  { value: 'api', label: 'API', hint: 'Keyless REST API (api.sodax.com): builds unsigned txs, your wallet signs.' },
];

const TransportContext = createContext<{ transport: Transport; setTransport: (t: Transport) => void }>({
  transport: 'sdk',
  setTransport: () => {},
});

function readStored(): Transport {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'api' ? 'api' : 'sdk';
  } catch {
    return 'sdk';
  }
}

export function TransportProvider({ children }: { children: ReactNode }) {
  const [transport, setState] = useState<Transport>(readStored);
  const setTransport = (next: Transport) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable: keep in memory only
    }
  };
  return <TransportContext.Provider value={{ transport, setTransport }}>{children}</TransportContext.Provider>;
}

export function useTransport(): Transport {
  return useContext(TransportContext).transport;
}

export function TransportToggle() {
  const { transport, setTransport } = useContext(TransportContext);
  return (
    <fieldset
      aria-label="Data source"
      className="inline-flex items-center gap-1 rounded-full border bg-card p-1 text-sm"
    >
      {OPTIONS.map(option => (
        <Tooltip key={option.value} content={option.hint}>
          <button
            type="button"
            aria-pressed={transport === option.value}
            onClick={() => setTransport(option.value)}
            className={cn(
              'rounded-full px-3 py-1 font-medium transition-colors',
              transport === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        </Tooltip>
      ))}
    </fieldset>
  );
}
