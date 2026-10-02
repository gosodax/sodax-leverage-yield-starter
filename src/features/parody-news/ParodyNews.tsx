import { MegaphoneIcon, XIcon } from '@phosphor-icons/react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HEADLINES } from './headlines';

const FIRST_DELAY_MS = 8_000;
const INTERVAL_MS = 120_000;
const VISIBLE_MS = 10_000;
const DIALOG_RECHECK_MS = 2_000;

/** A deposit, withdraw or wallet dialog is open: hold the next headline until it closes. */
function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"]');
}

/**
 * Parody "breaking news" toasts for the live stream. One at a
 * time, top left under the header: the first after 8s, then every 2 minutes, each for 10s (paused while hovered),
 * cycling HEADLINES in order. Every toast is clearly tagged "Parody".
 */
export function ParodyNews() {
  const index = useRef(0);
  const [current, setCurrent] = useState<{ id: number; text: string }>();
  const [hovered, setHovered] = useState(false);
  const reduce = useReducedMotion();

  const next = useCallback(() => {
    const text = HEADLINES[index.current % HEADLINES.length];
    index.current += 1;
    if (text) setCurrent({ id: Date.now(), text });
  }, []);

  // Schedule: first after FIRST_DELAY_MS, then every INTERVAL_MS, deferred while a dialog is open.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fire = () => {
      if (dialogOpen()) {
        timer = setTimeout(fire, DIALOG_RECHECK_MS);
        return;
      }
      next();
      timer = setTimeout(fire, INTERVAL_MS);
    };
    timer = setTimeout(fire, FIRST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [next]);

  // Each toast stays VISIBLE_MS of un-hovered time, then leaves.
  const remaining = useRef(VISIBLE_MS);
  const startedAt = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart the countdown for each new toast id
  useEffect(() => {
    remaining.current = VISIBLE_MS;
  }, [current?.id]);
  useEffect(() => {
    if (!current || hovered) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => setCurrent(undefined), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [current, hovered]);

  return (
    <div className="pointer-events-none fixed top-20 left-4 right-4 z-40 sm:right-auto sm:w-[360px]">
      <AnimatePresence>
        {current && (
          <m.div
            key={current.id}
            role="status"
            aria-live="polite"
            className="pointer-events-auto relative overflow-hidden rounded-lg border border-l-[3px] border-l-destructive bg-card shadow-card"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="flex flex-col gap-2 p-4 pr-10">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-destructive" />
                </span>
                <MegaphoneIcon weight="duotone" className="size-4 text-foreground" />
                <span className="font-semibold uppercase text-destructive">Breaking</span>
                <span className="rounded-sm bg-wash-wisteria px-1.5 py-0.5 font-medium text-foreground">Parody</span>
                <span className="text-subtle-foreground">· SODAX Wire</span>
                <span className="ml-auto text-subtle-foreground">just now</span>
              </div>
              <p className="line-clamp-2 text-base font-semibold text-foreground">{current.text}</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setCurrent(undefined)}
              className="absolute right-2 top-2 rounded-md p-1 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon weight="duotone" className="size-4" />
            </button>
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-accent"
              style={{
                animation: `parody-news-progress ${VISIBLE_MS}ms linear forwards`,
                animationPlayState: hovered ? 'paused' : 'running',
              }}
            />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
