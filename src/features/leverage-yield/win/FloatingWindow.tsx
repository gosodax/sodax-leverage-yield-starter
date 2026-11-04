import { type ReactNode, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Window } from './Window';

export type FloatPos = { x: number; y: number };

/** Space reserved for the taskbar at the bottom of the screen. */
const TASKBAR = 30;

/**
 * A movable top-level window: drag it by the title bar (mouse, pen or touch), double-click the title to maximize,
 * and it is clamped so the title bar always stays reachable. On phones it opens full-screen above the taskbar.
 */
export function FloatingWindow({
  title,
  icon,
  pos,
  z,
  active,
  maximized,
  onFocus,
  onMove,
  onMinimize,
  onMaximize,
  onClose,
  children,
  bodyClassName,
}: {
  title: string;
  icon: ReactNode;
  pos: FloatPos;
  z: number;
  active: boolean;
  maximized: boolean;
  onFocus: () => void;
  onMove: (pos: FloatPos) => void;
  onMinimize: () => void;
  onMaximize?: () => void;
  onClose: () => void;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const drag = useRef<{ dx: number; dy: number; id: number } | null>(null);

  const clamp = useCallback((x: number, y: number): FloatPos => {
    const width = ref.current?.offsetWidth ?? 300;
    const maxX = window.innerWidth - Math.min(width, 120);
    const maxY = window.innerHeight - TASKBAR - 24;
    return { x: Math.max(Math.min(x, maxX), -width + 120), y: Math.max(0, Math.min(y, maxY)) };
  }, []);

  // Keep the window reachable when the viewport shrinks.
  useEffect(() => {
    const onResize = () => onMove(clamp(pos.x, pos.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pos.x, pos.y, onMove, clamp]);

  const onTitlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (maximized || event.button !== 0) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    drag.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y, id: event.pointerId };
    const move = (e: PointerEvent) => {
      if (!drag.current || e.pointerId !== drag.current.id) return;
      onMove(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
    };
    const up = (e: PointerEvent) => {
      if (drag.current && e.pointerId !== drag.current.id) return;
      drag.current = null;
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  return (
    <div
      ref={el => {
        ref.current = el;
      }}
      className={cn(
        'fixed',
        maximized ? 'inset-x-0 top-0 bottom-[30px]' : 'max-sm:inset-x-0 max-sm:top-0 max-sm:bottom-[30px] sm:w-fit',
      )}
      style={{ zIndex: z, ...(maximized ? {} : { left: pos.x, top: pos.y }) }}
    >
      <Window
        title={title}
        icon={icon}
        active={active}
        onFocus={onFocus}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        maximized={maximized}
        onClose={onClose}
        onTitlePointerDown={onTitlePointerDown}
        onTitleDoubleClick={onMaximize}
        className={cn('h-full touch-none', !maximized && 'sm:h-auto')}
        bodyClassName={cn('min-h-0 overflow-auto touch-auto', bodyClassName)}
      >
        {children}
      </Window>
    </div>
  );
}
