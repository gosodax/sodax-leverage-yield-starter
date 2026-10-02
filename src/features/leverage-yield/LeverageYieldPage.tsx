import { useCallback, useEffect, useMemo, useState } from 'react';
import { brand } from '@/brand/brand.config';
import { NextPrompt } from '@/components/workshop/NextPrompt';
import type { SourceChainKey } from '@/config/workshop';
import { DEFAULT_VAULT_NAME } from '@/config/workshop';
import { cn } from '@/lib/utils';
import { useEvmWallet } from '@/wallet';
import { BootSequence } from './boot/BootSequence';
import { GESTURE_EVENTS, playDing, playError, unlockAudio, useMuted } from './boot/sounds';
import { DepositWizard, type FlowNotice } from './components/DepositWizard';
import { AboutBox, GettingStarted, RecycleBin } from './components/Dialogs';
import { MyShares, type ShareRowKey, type ShareSummary } from './components/MyShares';
import { VaultProperties } from './components/VaultProperties';
import { VaultShelf } from './components/VaultShelf';
import { WithdrawWizard } from './components/WithdrawWizard';
import { useUsdPrices } from './hooks/useVaultData';
import { useVaults } from './hooks/useVaults';
import { flavorOf } from './lib/vaults';
import { Taskbar } from './shell/Taskbar';
import { Wallpaper } from './shell/Wallpaper';
import { BottleIcon, CrateIcon, GlobeIcon, NotepadIcon, WizardIcon } from './win/icons';
import { Flag } from './win/Logo';
import { MenuBar } from './win/MenuBar';
import { Window } from './win/Window';
import './win2k.css';

type WinId = 'dispenser' | 'shares' | 'workshop';
type WinState = { open: boolean; minimized: boolean };

const WINDOW_TITLES: Record<WinId, string> = {
  dispenser: 'Vault Dispenser',
  shares: 'My Shares',
  workshop: 'WORKSHOP.TXT - Notepad',
};

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}
function writeFlag(storage: 'local' | 'session', key: string, value: boolean) {
  try {
    (storage === 'local' ? localStorage : sessionStorage).setItem(key, value ? '1' : '0');
  } catch {
    // storage blocked: keep the in-memory value only
  }
}

/**
 * HazyVault2000: SODAX Leverage Yield vaults on a Windows 2000 desktop. Bottles are vaults (fill = APR, fizz =
 * leverage), wizards deposit and withdraw, My Shares lists every position per network.
 */
export function LeverageYieldPage() {
  const vaults = useVaults();
  const prices = useUsdPrices();
  const wallet = useEvmWallet();
  const [muted, setMuted] = useMuted();

  const [booting, setBooting] = useState(() => {
    try {
      return sessionStorage.getItem('hazyvault.booted') !== '1';
    } catch {
      return false;
    }
  });
  const [showAtStartup, setShowAtStartup] = useState(() => readFlag('hazyvault.welcome', true));
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [binOpen, setBinOpen] = useState(false);

  const [selected, setSelected] = useState<string>(
    () => vaults.find(v => v.name === DEFAULT_VAULT_NAME)?.name ?? vaults[0]?.name ?? '',
  );
  const [aprs, setAprs] = useState<Record<string, number>>({});
  const onApr = useCallback(
    (name: string, pct: number) => setAprs(prev => (prev[name] === pct ? prev : { ...prev, [name]: pct })),
    [],
  );
  const [summaries, setSummaries] = useState<Record<string, ShareSummary>>({});
  const onSummary = useCallback(
    (name: string, s: ShareSummary) =>
      setSummaries(prev => {
        const old = prev[name];
        return old && old.rows === s.rows && old.usd === s.usd && old.loaded === s.loaded
          ? prev
          : { ...prev, [name]: s };
      }),
    [],
  );

  const [windows, setWindows] = useState<Record<WinId, WinState>>({
    dispenser: { open: true, minimized: false },
    shares: { open: true, minimized: false },
    workshop: { open: true, minimized: true },
  });
  const [active, setActive] = useState<WinId>('dispenser');
  const [maximized, setMaximized] = useState(false);

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPick, setWithdrawPick] = useState<{ vaultName: string; heldOn: SourceChainKey | undefined }>({
    vaultName: selected,
    heldOn: undefined,
  });
  const [shareRow, setShareRow] = useState<ShareRowKey>();

  const [depositNotice, setDepositNotice] = useState<FlowNotice>();
  const [withdrawNotice, setWithdrawNotice] = useState<FlowNotice>();
  const [balloon, setBalloon] = useState<{ title: string; text: string; failed: boolean } | null>(null);

  // Sounds (balloon ding, error) need the audio context unlocked by a gesture, even when the boot was skipped.
  useEffect(() => {
    const unlock = () => void unlockAudio(true);
    for (const type of GESTURE_EVENTS) window.addEventListener(type, unlock);
    return () => {
      for (const type of GESTURE_EVENTS) window.removeEventListener(type, unlock);
    };
  }, []);

  const finishBoot = useCallback(() => {
    writeFlag('session', 'hazyvault.booted', true);
    setBooting(false);
    if (readFlag('hazyvault.welcome', true)) setWelcomeOpen(true);
  }, []);

  // Balloon tip + sound when a tracked order finishes (even with its wizard hidden).
  const announce = useCallback((notice: FlowNotice) => {
    if (!notice || (!notice.done && !notice.failed)) return;
    setBalloon({
      title: notice.done ? (notice.kind === 'deposit' ? 'Deposit filled' : 'Withdrawal filled') : 'Order not filled',
      text: notice.done
        ? notice.kind === 'deposit'
          ? 'Your new shares are in your hub wallet. Open My Shares to see them.'
          : 'Your tokens are on their way to your wallet.'
        : 'Open the wizard from the taskbar to see what happened.',
      failed: notice.failed,
    });
    if (notice.done) playDing();
    else playError();
  }, []);
  useEffect(() => announce(depositNotice), [depositNotice, announce]);
  useEffect(() => announce(withdrawNotice), [withdrawNotice, announce]);

  useEffect(() => {
    if (!balloon) return;
    const timer = setTimeout(() => setBalloon(null), 9000);
    return () => clearTimeout(timer);
  }, [balloon]);

  const openWindow = (id: WinId) => {
    setWindows(prev => ({ ...prev, [id]: { open: true, minimized: false } }));
    setActive(id);
    requestAnimationFrame(() =>
      document.getElementById(`win-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    );
  };
  const minimize = (id: WinId) => setWindows(prev => ({ ...prev, [id]: { ...prev[id], minimized: true } }));
  const close = (id: WinId) => setWindows(prev => ({ ...prev, [id]: { open: false, minimized: false } }));
  const onTaskClick = (id: string) => {
    const w = windows[id as WinId];
    if (!w) return;
    if (w.minimized || active !== id) openWindow(id as WinId);
    else minimize(id as WinId);
  };

  const startDeposit = (vaultName?: string) => {
    if (vaultName) setSelected(vaultName);
    setDepositOpen(true);
  };
  const startWithdraw = (vaultName: string, heldOn?: SourceChainKey) => {
    setWithdrawPick({ vaultName, heldOn });
    setWithdrawOpen(true);
  };

  const selectedVault = vaults.find(v => v.name === selected) ?? vaults[0];
  const pending =
    depositNotice && !depositNotice.done && !depositNotice.failed
      ? { label: depositNotice.label, onClick: () => setDepositOpen(true) }
      : withdrawNotice && !withdrawNotice.done && !withdrawNotice.failed
        ? { label: withdrawNotice.label, onClick: () => setWithdrawOpen(true) }
        : undefined;

  const taskWindows = useMemo(
    () =>
      (Object.keys(windows) as WinId[])
        .filter(id => windows[id].open)
        .map(id => ({
          id,
          title: WINDOW_TITLES[id],
          icon: id === 'dispenser' ? <BottleIcon /> : id === 'shares' ? <CrateIcon /> : <NotepadIcon />,
          active: active === id,
          minimized: windows[id].minimized,
        })),
    [windows, active],
  );

  const startItems = [
    {
      id: 'dispenser',
      label: 'Vault Dispenser',
      icon: <BottleIcon size={24} />,
      onSelect: () => openWindow('dispenser'),
    },
    { id: 'deposit', label: 'Deposit Wizard', icon: <WizardIcon size={24} />, onSelect: () => startDeposit() },
    { id: 'shares', label: 'My Shares', icon: <CrateIcon size={24} />, onSelect: () => openWindow('shares') },
    {
      id: 'withdraw',
      label: 'Withdraw Wizard',
      icon: <WizardIcon size={24} />,
      onSelect: () => startWithdraw(selected),
      disabled: !wallet.address,
    },
    {
      id: 'workshop',
      label: 'Workshop Notes',
      icon: <NotepadIcon size={24} />,
      onSelect: () => openWindow('workshop'),
      separatorBefore: true,
    },
    {
      id: 'docs',
      label: 'SODAX Docs',
      icon: <GlobeIcon size={24} />,
      onSelect: () => window.open(brand.links.docs, '_blank', 'noopener,noreferrer'),
    },
    {
      id: 'help',
      label: 'Getting Started',
      icon: <WizardIcon size={24} />,
      onSelect: () => setWelcomeOpen(true),
      separatorBefore: true,
    },
    {
      id: 'about',
      label: 'About HazyVault2000',
      icon: <Flag className="h-5 w-6" />,
      onSelect: () => setAboutOpen(true),
    },
    {
      id: 'restart',
      label: 'Restart…',
      icon: <Flag className="h-5 w-6" />,
      onSelect: () => setBooting(true),
      separatorBefore: true,
    },
  ];

  const dispenserMenus = [
    {
      label: 'File',
      items: [
        { label: 'Deposit…', onSelect: () => startDeposit(), shortcut: 'Enter' },
        { label: 'Withdraw…', onSelect: () => startWithdraw(selected), disabled: !wallet.address },
        {
          label: wallet.address ? 'Disconnect wallet' : 'Connect wallet…',
          onSelect: () => (wallet.address ? void wallet.disconnect() : wallet.connect()),
          separatorBefore: true,
        },
        { label: 'Close', onSelect: () => minimize('dispenser'), separatorBefore: true },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'My Shares', onSelect: () => openWindow('shares') },
        { label: 'Workshop Notes', onSelect: () => openWindow('workshop') },
        {
          label: maximized ? 'Restore layout' : 'Maximize',
          onSelect: () => setMaximized(m => !m),
          separatorBefore: true,
        },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Getting Started', onSelect: () => setWelcomeOpen(true) },
        { label: 'SODAX Docs', onSelect: () => window.open(brand.links.docs, '_blank', 'noopener,noreferrer') },
        { label: 'About HazyVault2000', onSelect: () => setAboutOpen(true), separatorBefore: true },
      ],
    },
  ];

  const showDispenser = windows.dispenser.open && !windows.dispenser.minimized;
  const showShares = windows.shares.open && !windows.shares.minimized;
  const showWorkshop = windows.workshop.open && !windows.workshop.minimized;
  const totalUsd = Object.values(summaries).reduce((n, s) => n + s.usd, 0);

  return (
    <div className="w2k w2k-desktop relative pb-[34px]">
      {booting && <BootSequence onDone={finishBoot} />}
      <Wallpaper />

      <div className="relative z-10 flex gap-3 p-2 sm:p-3">
        {/* desktop icons */}
        <nav aria-label="Desktop" className="hidden w-[80px] shrink-0 flex-col gap-4 pt-1 lg:-ml-1 lg:flex">
          <DesktopIcon label="Vault Dispenser" icon={<BottleIcon size={32} />} onOpen={() => openWindow('dispenser')} />
          <DesktopIcon label="My Shares" icon={<CrateIcon size={32} />} onOpen={() => openWindow('shares')} />
          <DesktopIcon label="Deposit Wizard" icon={<WizardIcon size={32} />} onOpen={() => startDeposit()} />
          <DesktopIcon label="WORKSHOP.TXT" icon={<NotepadIcon size={32} />} onOpen={() => openWindow('workshop')} />
          <DesktopIcon
            label="SODAX Docs"
            icon={<GlobeIcon size={32} />}
            onOpen={() => window.open(brand.links.docs, '_blank', 'noopener,noreferrer')}
          />
          <DesktopIcon label="Recycle Bin" icon={<RecycleIcon />} onOpen={() => setBinOpen(true)} />
        </nav>

        <div className="mx-auto flex min-w-0 max-w-[1200px] flex-1 flex-col gap-3">
          {showWorkshop && (
            <Window
              id="win-workshop"
              title={WINDOW_TITLES.workshop}
              icon={<NotepadIcon />}
              active={active === 'workshop'}
              onFocus={() => setActive('workshop')}
              onMinimize={() => minimize('workshop')}
              onClose={() => close('workshop')}
              bodyClassName="bevel-field m-[2px] bg-[var(--win-window)] p-2"
            >
              <NextPrompt next="done" />
            </Window>
          )}

          <div className="grid min-w-0 gap-3">
            {showDispenser && selectedVault && (
              <Window
                id="win-dispenser"
                title={`Vault Dispenser - ${flavorOf(selectedVault).soda}`}
                icon={<BottleIcon />}
                active={active === 'dispenser'}
                onFocus={() => setActive('dispenser')}
                onMinimize={() => minimize('dispenser')}
                onMaximize={() => setMaximized(m => !m)}
                maximized={maximized}
                onClose={() => close('dispenser')}
                onHelp={() => setWelcomeOpen(true)}
                className={cn(maximized && 'fixed inset-x-0 top-0 bottom-[30px] z-30 overflow-y-auto')}
                menu={<MenuBar menus={dispenserMenus} />}
                status={
                  <>
                    <span className="flex-1">{vaults.length} vault(s) · double-click a can to deposit</span>
                    <span className="hidden sm:block">Fizz height = APR · Bubbles = leverage</span>
                    <span className="w-28 text-right">{wallet.address ? 'Wallet connected' : 'No wallet'}</span>
                  </>
                }
              >
                <div className="grid gap-3 p-2 md:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="flex min-w-0 flex-col gap-2">
                    {!wallet.address && (
                      <div className="flex flex-wrap items-center gap-2 bg-[var(--win-tooltip)] p-2 bevel-thin-in">
                        <WizardIcon />
                        <span className="flex-1">Connect a wallet to deposit and see your shares.</span>
                        <button type="button" className="w2k-btn" data-default="true" onClick={wallet.connect}>
                          Connect wallet…
                        </button>
                      </div>
                    )}
                    <VaultShelf
                      vaults={vaults}
                      selected={selected}
                      onSelect={setSelected}
                      onOpen={name => startDeposit(name)}
                      aprs={aprs}
                      onApr={onApr}
                    />
                    <p className="px-1 text-[10px] text-[var(--win-highlight)] [text-shadow:1px_1px_0_var(--win-dark)] md:hidden">
                      Tap a can to see its details below.
                    </p>
                  </div>
                  <VaultProperties
                    vault={selectedVault}
                    address={wallet.address}
                    prices={prices}
                    onDeposit={() => startDeposit()}
                    onWithdraw={() => startWithdraw(selectedVault.name)}
                  />
                </div>
              </Window>
            )}

            {showShares && (
              <Window
                id="win-shares"
                title={WINDOW_TITLES.shares}
                icon={<CrateIcon />}
                active={active === 'shares'}
                onFocus={() => setActive('shares')}
                onMinimize={() => minimize('shares')}
                onClose={() => close('shares')}
                toolbar={
                  <>
                    <ToolButton icon={<WizardIcon size={20} />} label="Deposit" onClick={() => startDeposit()} />
                    <ToolButton
                      icon={<WizardIcon size={20} />}
                      label="Withdraw"
                      disabled={!shareRow}
                      onClick={() => shareRow && startWithdraw(shareRow.vaultName, shareRow.chainKey)}
                    />
                    <div className="etched-v mx-1 self-stretch" />
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-[var(--win-dark)]">Total value</span>
                      <span className="bevel-thin-in bg-[var(--win-window)] px-2 py-0.5 font-bold">
                        {wallet.address ? `$${totalUsd.toFixed(2)}` : '–'}
                      </span>
                    </div>
                  </>
                }
                bodyClassName="bevel-field m-[2px] p-[2px]"
              >
                <MyShares
                  vaults={vaults}
                  address={wallet.address}
                  prices={prices}
                  selected={shareRow}
                  onSelect={setShareRow}
                  onWithdraw={key => startWithdraw(key.vaultName, key.chainKey)}
                  onDeposit={() => startDeposit()}
                  onConnect={wallet.connect}
                  summaries={summaries}
                  onSummary={onSummary}
                />
              </Window>
            )}
          </div>

          {!showDispenser && !showShares && !showWorkshop && (
            <p className="p-6 text-center text-[var(--win-highlight)] [text-shadow:1px_1px_0_var(--win-dark)]">
              All windows are minimized. Use the taskbar or the Start menu to bring them back.
            </p>
          )}
        </div>
      </div>

      {balloon && (
        <div role="status" className="w2k-balloon fixed right-2 bottom-[38px] z-40 w-[290px] max-w-[calc(100%-16px)]">
          <div className="flex items-start gap-2">
            <Flag className="h-4 w-5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{balloon.title}</p>
              <p>{balloon.text}</p>
            </div>
            <button type="button" className="w2k-caption-btn" aria-label="Dismiss" onClick={() => setBalloon(null)}>
              ✕
            </button>
          </div>
          <span className="absolute right-10 -bottom-[9px] h-0 w-0 border-x-[8px] border-t-[9px] border-x-transparent border-t-[var(--win-text)]" />
        </div>
      )}

      <Taskbar
        windows={taskWindows}
        onWindowClick={onTaskClick}
        startItems={startItems}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
        address={wallet.address}
        chainKey={wallet.currentChainKey}
        onConnect={wallet.connect}
        onDisconnect={() => void wallet.disconnect()}
        pending={pending}
      />

      <DepositWizard
        open={depositOpen}
        onOpenChange={setDepositOpen}
        vaults={vaults}
        vaultName={selected}
        onVaultChange={setSelected}
        prices={prices}
        onNotice={setDepositNotice}
      />
      <WithdrawWizard
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        vaults={vaults}
        vaultName={withdrawPick.vaultName}
        heldOn={withdrawPick.heldOn}
        onPick={(vaultName, heldOn) => setWithdrawPick({ vaultName, heldOn })}
        prices={prices}
        onNotice={setWithdrawNotice}
      />
      <GettingStarted
        open={welcomeOpen}
        onOpenChange={setWelcomeOpen}
        showAtStartup={showAtStartup}
        onShowAtStartup={show => {
          setShowAtStartup(show);
          writeFlag('local', 'hazyvault.welcome', show);
        }}
        connected={!!wallet.address}
        onConnect={wallet.connect}
        onDeposit={() => startDeposit()}
        onShares={() => openWindow('shares')}
      />
      <AboutBox open={aboutOpen} onOpenChange={setAboutOpen} />
      <RecycleBin open={binOpen} onOpenChange={setBinOpen} />
    </div>
  );
}

function DesktopIcon({ label, icon, onOpen }: { label: string; icon: React.ReactNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="w2k-desktop-icon flex flex-col items-center gap-1"
      onDoubleClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      onClick={e => e.detail === 0 && onOpen()}
      title="Double-click to open"
    >
      {icon}
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="w2k-toolbtn" onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function RecycleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M3 4h10l-1 11H4z" fill="var(--win-light)" stroke="var(--win-text)" strokeWidth="0.8" />
      <rect x="2" y="3" width="12" height="1.5" fill="var(--win-shadow)" />
      <path d="M6 6v7M8 6v7M10 6v7" stroke="var(--win-shadow)" strokeWidth="0.8" />
      <circle cx="8" cy="9" r="2.2" fill="none" stroke="var(--soda-lime-dark)" strokeWidth="0.9" />
    </svg>
  );
}
