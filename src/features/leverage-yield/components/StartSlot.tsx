import { CheckIcon, RocketIcon, WalletIcon, XIcon } from '@phosphor-icons/react';
import type { LeverageYieldVault } from '@sodax/types';
import { sortConnectors, useXConnect, useXConnectors } from '@sodax/wallet-sdk-react';
import { AnimatePresence, m } from 'motion/react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BASE, useTweenedBigint } from '@/components/ui/motion';
import { ThinkingOrb } from '@/components/ui/thinking-orb';
import { chainName } from '@/lib/chains';
import { formatTokenAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import type { Holding } from '../hooks/useHoldings';
import { useShareValue } from '../hooks/useShareValue';
import { useSourceEligibility } from '../hooks/useSourceEligibility';
import { vaultBrand } from '../lib/brands';
import { useVaultPending } from '../lib/pending';
import { SHARE_DECIMALS, underlying } from '../lib/vaults';
import { VaultApr } from './VaultApr';
import { VaultIcon } from './VaultIcon';
import { WithdrawDialog } from './WithdrawDialog';

const NUDGE_DISMISS_KEY = 'leverage-yield:first-deposit-nudge-dismissed';

const SLOT_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: BASE,
};

/**
 * The above-the-fold slot under the hero. Not connected: one-click wallet buttons. Connected with no shares anywhere:
 * the first-deposit nudge. Holding shares: "Your deposits". All decided from on-chain share balances.
 */
export function StartSlot({
  holdings,
  loaded,
  vaultPicked,
  amountEntered,
  onStart,
  onAddMore,
}: {
  holdings: Holding[];
  loaded: boolean;
  vaultPicked: boolean;
  amountEntered: boolean;
  onStart: () => void;
  onAddMore: (vault: LeverageYieldVault) => void;
}) {
  const { address } = useEvmWallet();
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(NUDGE_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const dismissNudge = () => {
    setNudgeDismissed(true);
    try {
      sessionStorage.setItem(NUDGE_DISMISS_KEY, '1');
    } catch {
      // Storage blocked: hidden for this page view only.
    }
  };

  const state = !address
    ? 'connect'
    : !loaded
      ? 'loading'
      : holdings.length > 0
        ? 'deposits'
        : nudgeDismissed
          ? 'none'
          : 'nudge';

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state === 'connect' && (
        <m.div key="connect" {...SLOT_MOTION}>
          <ConnectCard />
        </m.div>
      )}
      {state === 'nudge' && (
        <m.div key="nudge" {...SLOT_MOTION}>
          <FirstDepositNudge
            address={address}
            vaultPicked={vaultPicked}
            amountEntered={amountEntered}
            onStart={onStart}
            onDismiss={dismissNudge}
          />
        </m.div>
      )}
      {state === 'deposits' && (
        <m.div key="deposits" {...SLOT_MOTION}>
          <DepositsCard holdings={holdings} onAddMore={onAddMore} />
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** wagmi remembers the last connector it used; read it to put that wallet first. */
function lastConnectorId(): string | undefined {
  try {
    const raw = localStorage.getItem('wagmi.recentConnectorId');
    return raw ? (JSON.parse(raw) as string) : undefined;
  } catch {
    return undefined;
  }
}

const INSTALL_LINKS = [
  { name: 'MetaMask', url: 'https://metamask.io/download/' },
  { name: 'Rabby', url: 'https://rabby.io/' },
];

/** State A: one button per detected browser wallet (EIP-6963), connecting directly with that wallet. EVM only. */
function ConnectCard() {
  const connectors = useXConnectors({ xChainType: 'EVM' });
  const { mutateAsync: connect } = useXConnect();
  const { connect: openModal } = useEvmWallet();
  const [connectingId, setConnectingId] = useState<string>();
  const [error, setError] = useState<string>();

  const installed = useMemo(() => {
    const list = sortConnectors(connectors, {}).filter(connector => connector.isInstalled);
    const last = lastConnectorId();
    return last ? [...list].sort((a, b) => Number(b.id === last) - Number(a.id === last)) : list;
  }, [connectors]);

  const pick = async (connector: (typeof installed)[number]) => {
    setError(undefined);
    setConnectingId(connector.id);
    try {
      await connect(connector);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(
        /reject|denied|cancel/i.test(message)
          ? 'Connection request was declined in your wallet.'
          : 'Could not connect. Try again.',
      );
    } finally {
      setConnectingId(undefined);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
          <WalletIcon weight="duotone" className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Connect a wallet to start</h2>
          {installed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No browser wallet found. Install{' '}
              {INSTALL_LINKS.map((wallet, index) => (
                <span key={wallet.name}>
                  {index > 0 && ' or '}
                  <a
                    href={wallet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline decoration-link decoration-2 underline-offset-4 hover:decoration-primary"
                  >
                    {wallet.name}
                  </a>
                </span>
              ))}
              .
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">EVM wallets only. You sign everything in your own wallet.</p>
          )}
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {installed.map(connector => (
          <Button
            key={connector.id}
            variant={installed.length === 1 ? 'default' : 'outline'}
            disabled={!!connectingId}
            onClick={() => void pick(connector)}
          >
            {connectingId === connector.id ? (
              <ThinkingOrb state="connecting" size={20} decorative />
            ) : connector.icon ? (
              <img src={connector.icon} alt="" className="size-6 rounded-sm" />
            ) : (
              <WalletIcon weight="duotone" />
            )}
            {connector.name}
          </Button>
        ))}
        {installed.length === 0 && (
          <Button variant="outline" onClick={openModal}>
            More options
          </Button>
        )}
      </div>
    </Card>
  );
}

/** State B: connected, no shares in any vault. A slim prompt with a three-step hint. No yield claims. */
function FirstDepositNudge({
  address,
  vaultPicked,
  amountEntered,
  onStart,
  onDismiss,
}: {
  address: string | undefined;
  vaultPicked: boolean;
  amountEntered: boolean;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const sources = useSourceEligibility(address);
  const suggestion = useMemo(() => {
    for (const chain of Object.values(sources.chains)) {
      if (!chain.eligible) continue;
      const option = sources.tokens(chain.chainKey).find(token => token.eligible && token.balance);
      if (option) return `You can pay with ${option.token.symbol} on ${chainName(chain.chainKey)}.`;
    }
    return undefined;
  }, [sources]);

  const steps = [
    { label: 'Choose vault', done: vaultPicked },
    { label: 'Amount', done: amountEntered },
    { label: 'Sign', done: false },
  ];

  return (
    <Card className="relative flex flex-col gap-4 p-6 pr-12 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon weight="duotone" className="size-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
          <RocketIcon weight="duotone" className="size-5" />
        </span>
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-lg font-semibold">Make your first universal deposit</h2>
            <p className="text-sm text-muted-foreground">
              Pick a vault, choose an amount, sign once. Takes about a minute.
            </p>
            {suggestion && <p className="text-sm text-muted-foreground">{suggestion}</p>}
          </div>
          <ol className="flex flex-wrap items-center gap-3 text-xs">
            {steps.map((step, index) => (
              <li key={step.label} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex size-5 items-center justify-center rounded-full border text-[10px] transition-colors duration-200 ease-out',
                    step.done ? 'border-primary bg-primary text-primary-foreground' : 'text-subtle-foreground',
                  )}
                >
                  {step.done ? <CheckIcon weight="duotone" className="size-3" /> : index + 1}
                </span>
                <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Button onClick={onStart} className="shrink-0">
        Start
      </Button>
    </Card>
  );
}

/** State C: every vault position above zero, with withdraw and add more. */
function DepositsCard({
  holdings,
  onAddMore,
}: {
  holdings: Holding[];
  onAddMore: (vault: LeverageYieldVault) => void;
}) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Your deposits</h2>
        <Badge variant="muted">{holdings.length}</Badge>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {holdings.map(holding => (
          <DepositRow
            key={`${holding.vault.name}:${holding.chainKey}`}
            holding={holding}
            showChain={holdings.some(
              other => other.vault.name === holding.vault.name && other.chainKey !== holding.chainKey,
            )}
            onAddMore={() => onAddMore(holding.vault)}
          />
        ))}
      </ul>
    </Card>
  );
}

function DepositRow({
  holding,
  showChain,
  onAddMore,
}: {
  holding: Holding;
  showChain: boolean;
  onAddMore: () => void;
}) {
  const { vault, chainKey, shares } = holding;
  const brand = vaultBrand(vault);
  const value = useShareValue(vault.vault, shares);
  const shownShares = useTweenedBigint(shares);
  const shownValue = useTweenedBigint(value);
  const pending = useVaultPending(vault.name);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <li className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <VaultIcon vault={vault} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{brand.name}</span>
            <Badge variant="muted">{brand.ticker}</Badge>
            {pending && (
              <Badge variant="default">
                <ThinkingOrb state="working" size={20} decorative />
                Pending
              </Badge>
            )}
          </div>
          <p className="text-sm tabular-nums">
            {formatTokenAmount(shownShares ?? shares, SHARE_DECIMALS)} shares
            {shownValue !== undefined && (
              <span className="text-muted-foreground">
                {' '}
                ≈ {formatTokenAmount(shownValue, underlying(vault).decimals)} {brand.ticker}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            <VaultApr vault={vault.vault} />, variable
            {showChain && ` · deposited from ${chainName(chainKey)}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>
          Withdraw
        </Button>
        <Button size="sm" variant="secondary" onClick={onAddMore}>
          Add more
        </Button>
      </div>
      {withdrawOpen && (
        <WithdrawDialog
          vault={vault}
          chainKey={chainKey}
          shareBalance={shares}
          onClose={() => setWithdrawOpen(false)}
        />
      )}
    </li>
  );
}
