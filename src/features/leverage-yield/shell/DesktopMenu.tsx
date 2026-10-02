import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type DesktopMenuItem = { label: string; onSelect: () => void; separatorBefore?: boolean; disabled?: boolean };

/** Right-click menu for the desktop background, positioned at the cursor and kept on screen. */
export function DesktopMenu({
  at,
  items,
  onClose,
}: {
  at: { x: number; y: number };
  items: DesktopMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const width = 180;
  const height = items.length * 22 + 12;
  const left = Math.min(at.x, window.innerWidth - width - 4);
  const top = Math.min(at.y, window.innerHeight - 30 - height - 4);

  return (
    <div ref={ref} role="menu" className="bevel-out fixed z-[45] p-[3px]" style={{ left, top, width }}>
      {items.map(item => (
        <div key={item.label}>
          {item.separatorBefore && <div className="etched-h mx-0.5 my-[3px]" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cn(
              'w2k-menu-item block w-full px-5 py-[3px] text-left',
              item.disabled && 'text-[var(--win-gray-text)]',
            )}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
