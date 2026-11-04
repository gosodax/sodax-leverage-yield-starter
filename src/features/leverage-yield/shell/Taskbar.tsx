import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { chainLogo, chainName } from '@/lib/chains';
import { shortenAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Hourglass } from '../win/icons';
import { Flag } from '../win/Logo';

export type TaskWindow = { id: string; title: string; icon: ReactNode; active: boolean; minimized: boolean };

export type StartItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  separatorBefore?: boolean;
  disabled?: boolean;
  hint?: string;
};

type TaskbarProps = {
  windows: TaskWindow[];
  onWindowClick: (id: string) => void;
  startItems: StartItem[];
  muted: boolean;
  onToggleMute: () => void;
  address: string | undefined;
  chainKey: string | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
  pending?: { label: string; onClick: () => void };
};

/** Close a popover on outside pointer-down or Escape. */
function useDismiss(open: boolean, close: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (refs.some(ref => ref.current?.contains(event.target as Node))) return;
      close();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, refs]);
}

/** Windows 2000 classic taskbar: Start menu, quick launch, task buttons and the system tray. */
export function Taskbar({
  windows,
  onWindowClick,
  startItems,
  muted,
  onToggleMute,
  address,
  chainKey,
  onConnect,
  onDisconnect,
  pending,
}: TaskbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const refs = useRef([startRef, menuRef]).current;
  useDismiss(menuOpen, () => setMenuOpen(false), refs);

  const quick = startItems.filter(item => !item.disabled).slice(0, 3);

  return (
    <div
      className="w2k-taskbar fixed inset-x-0 bottom-0 z-40 box-content flex items-center gap-1 px-0.5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative shrink-0">
        <button
          ref={startRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}
          className={cn(
            'flex h-[22px] items-center gap-1 px-1.5 font-bold',
            menuOpen ? 'bevel-in bg-[var(--win-face)]' : 'bevel-out',
          )}
        >
          <Flag className="h-4 w-5" />
          Start
        </button>
        {menuOpen && <StartMenu menuRef={menuRef} items={startItems} onClose={() => setMenuOpen(false)} />}
      </div>

      {quick.length > 0 && (
        <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
          <div className="etched-v h-[22px]" />
          <div className="bevel-thin-out ml-0.5 h-[20px] w-[3px]" />
          {quick.map(item => (
            <button
              key={item.id}
              type="button"
              title={item.hint ?? item.label}
              aria-label={item.label}
              onClick={item.onSelect}
              className="w2k-toolbtn !min-w-0 !p-[3px] [&_svg]:size-4"
            >
              {item.icon}
            </button>
          ))}
          <div className="etched-v ml-0.5 h-[22px]" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {windows.map(win => (
          <button
            key={win.id}
            type="button"
            title={win.title}
            aria-pressed={win.active && !win.minimized}
            onClick={() => onWindowClick(win.id)}
            className="w2k-taskbtn max-sm:!w-[30px] max-sm:!flex-none max-sm:justify-center"
          >
            <span className="flex shrink-0 [&_svg]:size-4">{win.icon}</span>
            <span className="hidden min-w-0 truncate sm:inline">{win.title}</span>
          </button>
        ))}
      </div>

      <Tray
        muted={muted}
        onToggleMute={onToggleMute}
        address={address}
        chainKey={chainKey}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        pending={pending}
      />
    </div>
  );
}

function StartMenu({
  menuRef,
  items,
  onClose,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  items: StartItem[];
  onClose: () => void;
}) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current.find((el, i) => el && !items[i]?.disabled)?.focus();
  }, [items]);

  const move = (from: number, dir: 1 | -1) => {
    const n = items.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + dir * step + n) % n;
      if (!items[i]?.disabled) {
        itemRefs.current[i]?.focus();
        return;
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(current, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(current < 0 ? 0 : current, -1);
    } else if (event.key === 'Tab') {
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Start menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="bevel-out absolute bottom-[calc(100%+3px)] left-0 z-50 flex max-w-[calc(100vw-8px)] p-[3px]"
    >
      <div
        className="w2k-start-menu-banner flex w-[22px] shrink-0 items-center justify-end px-0.5 py-1.5 text-[var(--win-highlight)]"
        style={{ fontFamily: 'var(--font-display)' }}
        aria-hidden="true"
      >
        <span className="whitespace-nowrap text-[15px] leading-none">
          <span className="font-bold">HazyVault</span>
          <span className="font-light"> 2000 Professional</span>
        </span>
      </div>
      <ul className="flex min-w-[190px] flex-col py-0.5">
        {items.map((item, index) => (
          <li key={item.id} role="none">
            {item.separatorBefore && <hr className="etched-h mx-1 my-1 border-x-0" />}
            <button
              ref={el => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              title={item.hint}
              disabled={item.disabled}
              aria-disabled={item.disabled}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
              className={cn(
                'w2k-menu-item flex w-full items-center gap-2.5 py-1 pr-6 pl-1.5 text-left',
                item.disabled &&
                  'pointer-events-none text-[var(--win-gray-text)] [text-shadow:1px_1px_var(--win-highlight)]',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center [&_svg]:size-6',
                  item.disabled && 'opacity-50 grayscale',
                )}
              >
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tray({
  muted,
  onToggleMute,
  address,
  chainKey,
  onConnect,
  onDisconnect,
  pending,
}: Pick<TaskbarProps, 'muted' | 'onToggleMute' | 'address' | 'chainKey' | 'onConnect' | 'onDisconnect' | 'pending'>) {
  return (
    <div className="bevel-thin-in flex h-[22px] shrink-0 items-center gap-1 px-1.5">
      {pending && (
        <button
          type="button"
          title={pending.label}
          aria-label={pending.label}
          onClick={pending.onClick}
          className="flex"
        >
          <Hourglass size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleMute}
        title={muted ? 'Sounds off' : 'Sounds on'}
        aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
        aria-pressed={muted}
        className="flex"
      >
        <Speaker muted={muted} />
      </button>
      <WalletTray address={address} chainKey={chainKey} onConnect={onConnect} onDisconnect={onDisconnect} />
      <Clock />
    </div>
  );
}

function Speaker({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 6h3l4-4v12l-4-4H2z" fill="var(--win-face)" stroke="var(--win-text)" strokeWidth="1" />
      <rect x="3" y="7" width="2" height="2" fill="var(--win-shadow)" />
      {muted ? (
        <path d="M10 5l5 6M15 5l-5 6" stroke="var(--destructive)" strokeWidth="1.6" />
      ) : (
        <>
          <rect x="11" y="6" width="1" height="4" fill="var(--win-text)" />
          <rect x="13" y="4" width="1" height="8" fill="var(--win-text)" />
        </>
      )}
    </svg>
  );
}

function WalletTray({
  address,
  chainKey,
  onConnect,
  onDisconnect,
}: Pick<TaskbarProps, 'address' | 'chainKey' | 'onConnect' | 'onDisconnect'>) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const refs = useRef([buttonRef, menuRef]).current;
  useDismiss(open, () => setOpen(false), refs);

  if (!address) {
    return (
      <button
        type="button"
        onClick={onConnect}
        className="w2k-link px-0.5 no-underline hover:underline"
        title="Connect an EVM wallet"
      >
        Connect
      </button>
    );
  }

  const logo = chainKey ? chainLogo(chainKey as Parameters<typeof chainLogo>[0]) : undefined;
  const network = chainKey ? chainName(chainKey as Parameters<typeof chainName>[0]) : 'Unsupported network';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  };

  return (
    <div className="relative flex">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${address}\n${network}`}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1"
      >
        {logo ? <img src={logo} alt="" className="size-4" /> : <span className="size-4 bg-[var(--win-shadow)]" />}
        <span className="hidden font-mono text-[10px] sm:inline">{shortenAddress(address)}</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Wallet"
          className="bevel-out absolute right-0 bottom-[calc(100%+6px)] z-50 flex min-w-[150px] flex-col p-[3px]"
        >
          <p className="truncate px-2 py-1 text-[var(--win-dark)]">{network}</p>
          <div className="etched-h mx-1 my-0.5" />
          <button
            type="button"
            role="menuitem"
            className="w2k-menu-item px-2 py-1 text-left"
            onClick={() => void copy()}
          >
            {copied ? 'Copied!' : 'Copy address'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w2k-menu-item px-2 py-1 text-left"
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <time dateTime={now.toISOString()} title={date} className="pl-1 whitespace-nowrap">
      {time}
    </time>
  );
}
