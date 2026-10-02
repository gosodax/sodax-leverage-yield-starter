import { type ReactNode, useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * One toast when a flow reaches 'done', carrying its explorer links so they stay reachable after the dialog closes.
 * Neutral style (not sonner's coloured success) to keep the palette.
 */
export function useDoneToast(done: boolean, title: string, links: ReactNode) {
  const shown = useRef(false);
  const latest = useRef({ title, links });
  latest.current = { title, links };
  useEffect(() => {
    if (!done || shown.current) return;
    shown.current = true;
    toast(latest.current.title, {
      description: <div className="flex flex-col gap-1 pt-1 text-xs">{latest.current.links}</div>,
      duration: 20_000,
    });
  }, [done]);
}
