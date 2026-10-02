import { CheckCircleIcon } from '@phosphor-icons/react';
import { sortConnectors, useWalletModal, useXAccount, useXConnectors, type XConnector } from '@sodax/wallet-sdk-react';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ThinkingOrb } from '@/components/ui/thinking-orb';
import { shortenAddress } from '@/lib/format';

/**
 * Connect modal built on the headless `useWalletModal` state machine from @sodax/wallet-sdk-react.
 * EVM is the only enabled chain family, so the chain step is skipped. Mounted once in the header.
 */
export function WalletModal() {
  const modal = useWalletModal();
  const { state } = modal;
  const { address } = useXAccount({ xChainType: 'EVM' });

  // Only EVM is enabled: skip the chain picker whenever something opens the modal.
  useEffect(() => {
    if (state.kind === 'chainSelect') modal.selectChain('EVM');
  }, [state.kind, modal]);

  // Close shortly after a successful connection.
  useEffect(() => {
    if (state.kind !== 'success') return;
    const timer = setTimeout(modal.close, 900);
    return () => clearTimeout(timer);
  }, [state.kind, modal.close]);

  // Cancel doesn't withdraw the request the wallet is showing. If the user approves it afterwards, the wallet
  // connects but the SDK drops that late result, so close the modal instead of leaving it on the list.
  useEffect(() => {
    if (address && (state.kind === 'walletSelect' || state.kind === 'error')) modal.close();
  }, [address, state.kind, modal.close]);

  return (
    <Dialog open={state.kind !== 'closed'} onOpenChange={open => !open && modal.close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.kind === 'success' ? 'Connected' : 'Connect a wallet'}</DialogTitle>
          <DialogDescription>
            EVM wallets only. Use a wallet you funded for this workshop, because transactions use real mainnet funds.
          </DialogDescription>
        </DialogHeader>

        {(state.kind === 'walletSelect' || state.kind === 'chainSelect') && <WalletList />}

        {state.kind === 'connecting' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <ThinkingOrb state="connecting" size={32} decorative />
            <p className="text-sm">
              Approve the connection in <span className="font-semibold">{state.connector.name}</span>.
            </p>
            <Button variant="ghost" size="sm" onClick={modal.back}>
              Cancel
            </Button>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="flex flex-col gap-3">
            <Callout variant="destructive">
              <p className="font-semibold">Could not connect {state.connector.name}</p>
              <p className="mt-1 break-words text-xs">{connectErrorMessage(state.error, state.connector.name)}</p>
            </Callout>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void modal.retry()}>
                Try again
              </Button>
              <Button className="flex-1" variant="outline" onClick={modal.back}>
                Other wallet
              </Button>
            </div>
          </div>
        )}

        {state.kind === 'success' && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircleIcon weight="duotone" className="size-8 text-foreground" />
            <p className="font-mono text-sm">{shortenAddress(state.account.address)}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Shown when no EIP-6963 wallet announced itself (nothing installed).
const SUGGESTED_WALLETS = [
  { name: 'MetaMask', url: 'https://metamask.io/download/' },
  { name: 'Rabby', url: 'https://rabby.io/' },
  { name: 'Hana Wallet', url: 'https://www.hanawallet.io/' },
];

/**
 * Wallet picker. It takes `selectWallet` from its own `useWalletModal()` on purpose: the SDK ignores a pick of a
 * connector whose earlier attempt is still pending, and Cancel leaves that attempt pending (the wallet keeps its
 * request open). The list remounts every time it is shown, so each visit gets a fresh attempt.
 */
function WalletList() {
  const { selectWallet } = useWalletModal();
  const connectors = useXConnectors({ xChainType: 'EVM' });
  const sorted = useMemo(() => {
    const byPreference = sortConnectors(connectors, { preferred: ['hana', 'metaMask', 'io.rabby'] });
    return [...byPreference].sort((a, b) => Number(b.isInstalled) - Number(a.isInstalled));
  }, [connectors]);
  const anyInstalled = sorted.some(connector => connector.isInstalled);

  return (
    <div className="flex flex-col gap-3">
      {!anyInstalled && <Callout>No browser wallet detected. Install one, then reload this page.</Callout>}
      {sorted.length === 0 && (
        <ul className="flex flex-col gap-2">
          {SUGGESTED_WALLETS.map(wallet => (
            <li key={wallet.name}>
              <a
                href={wallet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-md border border-dashed px-4 py-3 hover:bg-secondary"
              >
                <span className="font-medium">{wallet.name}</span>
                <span className="text-xs font-medium underline decoration-link decoration-2 underline-offset-4">
                  Install
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <ul className="flex flex-col gap-2">
        {sorted.map(connector => (
          <li key={connector.id}>
            {connector.isInstalled ? (
              <button
                type="button"
                onClick={() => void selectWallet(connector)}
                className="flex w-full items-center gap-3 rounded-md border bg-card px-4 py-3 text-left shadow-card transition-colors hover:border-border-strong hover:bg-secondary"
              >
                <ConnectorIcon connector={connector} />
                <span className="flex-1 font-medium">{connector.name}</span>
                <span className="rounded-sm bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                  Detected
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-dashed px-4 py-3">
                <ConnectorIcon connector={connector} />
                <span className="flex-1 text-muted-foreground">{connector.name}</span>
                {connector.installUrl ? (
                  <a
                    href={connector.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-foreground underline decoration-link decoration-2 underline-offset-4 hover:decoration-primary"
                  >
                    Install
                  </a>
                ) : (
                  <span className="text-xs text-subtle-foreground">Not installed</span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConnectorIcon({ connector }: { connector: XConnector }) {
  return connector.icon ? (
    <img src={connector.icon} alt="" className="size-7 rounded-md" />
  ) : (
    <div className="size-7 rounded-md bg-muted" />
  );
}

/** One short line for a failed connection. Wallet errors carry EIP-1193 codes; their messages run long. */
function connectErrorMessage(error: Error, walletName: string): string {
  const code = (error as { code?: number }).code;
  if (code === 4001 || /user rejected|denied/i.test(error.message)) {
    return `You rejected the connection in ${walletName}.`;
  }
  if (code === -32002 || /already pending/i.test(error.message)) {
    return `${walletName} still has an earlier connection request open. Open ${walletName}, approve or reject it, then try again.`;
  }
  return error.message.split('\n')[0];
}
