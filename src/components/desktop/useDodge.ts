import { type PointerEvent, useRef } from 'react';
import { toast } from 'sonner';
import { useWindowManager } from './WindowManager';

const HEADER_PX = 72;
const TASKBAR_PX = 52;
const MARGIN_PX = 8;

/**
 * A joke, with a hard stop: when the mouse reaches the button, its window jumps somewhere else on screen. After a few
 * (3–5) dodges it gives up and the button works normally, so withdrawing is never actually blocked. Only mouse
 * pointers trigger it, so touch and keyboard users are never affected, and maximized windows stay put.
 */
export function useDodge(windowId: string) {
  const wm = useWindowManager();
  const dodges = useRef(0);
  const limit = useRef(3 + Math.floor(Math.random() * 3));
  const gaveUp = useRef(false);

  function onPointerEnter(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== 'mouse' || gaveUp.current) return;
    const state = wm.windows[windowId];
    if (!state || state.maximized || state.status !== 'open') return;

    if (dodges.current >= limit.current) {
      gaveUp.current = true;
      toast('Fine. You win. Withdraw unlocked.');
      return;
    }

    const el = document.querySelector(`[data-window-id="${CSS.escape(windowId)}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxLeft = Math.max(MARGIN_PX, window.innerWidth - rect.width - MARGIN_PX);
    const maxTop = Math.max(HEADER_PX, window.innerHeight - TASKBAR_PX - rect.height);

    // Pick a spot that no longer sits under the cursor (best effort on small screens).
    let left = MARGIN_PX;
    let top = HEADER_PX;
    for (let attempt = 0; attempt < 12; attempt++) {
      left = MARGIN_PX + Math.random() * (maxLeft - MARGIN_PX);
      top = HEADER_PX + Math.random() * (maxTop - HEADER_PX);
      const underCursor =
        e.clientX >= left - 24 &&
        e.clientX <= left + rect.width + 24 &&
        e.clientY >= top - 24 &&
        e.clientY <= top + rect.height + 24;
      if (!underCursor) break;
    }

    dodges.current++;
    wm.focus(windowId);
    wm.setOffset(windowId, {
      x: state.offset.x + (left - rect.left),
      y: state.offset.y + (top - rect.top),
    });
  }

  return { onPointerEnter };
}
