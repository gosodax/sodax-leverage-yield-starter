import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useWindowManager } from './WindowManager';

/** Keep at least this much of a window on screen so its title bar can always be grabbed again. */
const KEEP_VISIBLE_PX = 96;

/**
 * A Windows 95-style window. It sits in the normal page layout until dragged by its title bar, then floats at an
 * offset. Minimize sends it to the taskbar, maximize fills the screen between the header and taskbar, close hides it
 * until it is reopened from the Start menu. Clicking anywhere in it brings it to the front.
 */
export function Window({
  id,
  title,
  className,
  bodyClassName,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const wm = useWindowManager();
  const { register } = wm;
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerX: number; pointerY: number; x: number; y: number; rect: DOMRect } | null>(null);
  // Animate programmatic moves (see useDodge) but not drags, which must track the pointer exactly.
  const [dragging, setDragging] = useState(false);

  useEffect(() => register(id, title), [register, id, title]);

  const state = wm.windows[id];
  if (!state) return null;

  const hidden = state.status !== 'open';
  const focused = wm.focusedId === id;
  // Map unbounded z counters to a small rank so windows stay below dialogs (z-50) and the taskbar.
  const rank = Object.values(wm.windows).filter(w => w.z < state.z).length;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || state.maximized || (e.target as HTMLElement).closest('button')) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerX: e.clientX, pointerY: e.clientY, x: state.offset.x, y: state.offset.y, rect };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    // Clamp so the title bar never leaves the viewport.
    const dx = Math.min(
      Math.max(e.clientX - d.pointerX, KEEP_VISIBLE_PX - d.rect.right),
      window.innerWidth - KEEP_VISIBLE_PX - d.rect.left,
    );
    const dy = Math.min(Math.max(e.clientY - d.pointerY, -d.rect.top), window.innerHeight - 48 - d.rect.top);
    wm.setOffset(id, { x: d.x + dx, y: d.y + dy });
  }

  function onPointerUp() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <section
      ref={ref}
      aria-label={title}
      data-window-id={id}
      onPointerDownCapture={() => wm.focus(id)}
      style={
        state.maximized
          ? { zIndex: 45 }
          : { transform: `translate(${state.offset.x}px, ${state.offset.y}px)`, zIndex: 10 + rank }
      }
      className={cn(
        'win-window relative flex flex-col bg-card text-card-foreground',
        !dragging && 'transition-transform duration-200 ease-out motion-reduce:transition-none',
        // Minimized and closed windows keep their spot, like icons left on a desktop, so nothing else jumps.
        hidden && 'invisible',
        state.maximized && 'fixed inset-x-2 top-[4.5rem] bottom-14 overflow-auto',
        className,
      )}
    >
      <div
        className={cn(
          'win-titlebar touch-none select-none',
          !state.maximized && 'cursor-grab',
          !focused && 'opacity-75',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={e => {
          if (!(e.target as HTMLElement).closest('button')) wm.toggleMaximize(id);
        }}
      >
        <span className="truncate">{title}</span>
        <span className="flex shrink-0 gap-0.5">
          <button
            type="button"
            className="win-control"
            aria-label={`Minimize ${title}`}
            onClick={() => wm.minimize(id)}
          >
            _
          </button>
          <button
            type="button"
            className="win-control"
            aria-label={state.maximized ? `Restore ${title}` : `Maximize ${title}`}
            onClick={() => wm.toggleMaximize(id)}
          >
            {state.maximized ? '❐' : '□'}
          </button>
          <button type="button" className="win-control" aria-label={`Close ${title}`} onClick={() => wm.close(id)}>
            ×
          </button>
        </span>
      </div>
      <div className={cn('flex flex-1 flex-col', bodyClassName)} inert={hidden}>
        {children}
      </div>
    </section>
  );
}
