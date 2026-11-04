import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type MenuEntry = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
  shortcut?: string;
};
export type Menu = { label: string; items: MenuEntry[] };

/** Win2k menu bar with drop-down menus. Alt-style underlined first letter, Esc/outside click closes. */
export function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="w2k-menubar relative" role="menubar">
      {menus.map((menu, i) => (
        <div key={menu.label} className="relative">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            className="px-1.5 py-0.5"
            onClick={() => setOpen(open === i ? null : i)}
            onPointerEnter={() => open !== null && setOpen(i)}
          >
            <span className="underline">{menu.label[0]}</span>
            {menu.label.slice(1)}
          </button>
          {open === i && (
            <div role="menu" className="bevel-out absolute top-full left-0 z-30 min-w-[180px] p-[3px]">
              {menu.items.map(item => (
                <div key={item.label}>
                  {item.separatorBefore && <div className="etched-h mx-0.5 my-[3px]" />}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={cn(
                      'w2k-menu-item flex w-full items-center justify-between gap-6 px-5 py-[3px] text-left',
                      item.disabled && 'text-[var(--win-gray-text)]',
                    )}
                    onClick={() => {
                      setOpen(null);
                      item.onSelect();
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span>{item.shortcut}</span>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
