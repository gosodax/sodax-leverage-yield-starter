import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useWindowManager } from './WindowManager';

const formatTime = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function useClock(): string {
  const [time, setTime] = useState(formatTime);
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 15_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/** Windows 95-style taskbar: Start menu to reopen any window, a button per open/minimized window, and a clock. */
export function Taskbar() {
  const wm = useWindowManager();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const time = useClock();

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const running = wm.order.filter(id => wm.windows[id] && wm.windows[id].status !== 'closed');

  return (
    <div className="taskbar fixed inset-x-0 bottom-0 z-[46] flex h-11 items-center gap-1.5 px-1.5">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
          className={cn(
            'flex h-8 items-center gap-2 px-2 font-display text-[10px]',
            menuOpen ? 'win-button-pressed' : 'win-button',
          )}
        >
          <span className="size-3 bg-primary win-sunken" aria-hidden="true" />
          Start
        </button>
        {menuOpen && (
          <div role="menu" className="win-window taskbar absolute bottom-10 left-0 flex w-64 flex-col p-1">
            <div className="px-2 py-1 font-display text-[8px] uppercase">Programs</div>
            {wm.order.map(id => {
              const w = wm.windows[id];
              if (!w) return null;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    wm.open(id);
                    setMenuOpen(false);
                  }}
                  className="taskbar-item flex items-center justify-between gap-2 px-2 py-1.5 text-left text-sm"
                >
                  <span className="truncate">{w.title}</span>
                  <span className="text-xs">
                    {w.status === 'closed' ? 'closed' : w.status === 'minimized' ? '_' : '●'}
                  </span>
                </button>
              );
            })}
            <div className="my-1 h-px bg-[var(--bevel-dark)]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                wm.resetLayout();
                setMenuOpen(false);
              }}
              className="taskbar-item px-2 py-1.5 text-left text-sm"
            >
              Reset desktop
            </button>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {running.map(id => {
          const w = wm.windows[id];
          const active = wm.focusedId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => (active ? wm.minimize(id) : wm.open(id))}
              aria-pressed={active}
              className={cn(
                'h-8 w-40 shrink-0 truncate px-2 text-left text-xs',
                active ? 'win-button-pressed font-bold' : 'win-button',
              )}
            >
              {w.title}
            </button>
          );
        })}
      </div>

      <div className="win-sunken flex h-8 shrink-0 items-center px-3 text-xs tabular-nums">{time}</div>
    </div>
  );
}
