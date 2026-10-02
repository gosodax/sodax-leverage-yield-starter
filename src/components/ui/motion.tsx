import { AnimatePresence, animate, domAnimation, LazyMotion, MotionConfig, m, useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Motion for the app: quiet and short, so state changes are easy to follow. Ease out, 150 to 250ms, 4 to 8px.
 * No bounces, no springs, no parallax. Everything honours prefers-reduced-motion (MotionConfig reducedMotion="user").
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const FAST = { duration: 0.15, ease: EASE_OUT };
export const BASE = { duration: 0.2, ease: EASE_OUT };
export const SLOW = { duration: 0.25, ease: EASE_OUT };

/** Wraps the app once: lazy `domAnimation` features for `m` components, reduced motion from the OS setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={BASE}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * Content that appears and disappears by animating its height, so the layout below slides instead of jumping.
 * `id` names the current content: a new id swaps it with a short crossfade. Nothing animates on first render.
 */
export function Reveal({ id, children, className }: { id?: string | false; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {id !== false && children ? (
        <m.div
          key={id || 'content'}
          className={className}
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={SLOW}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * A value that briefly fades and rises into place when it changes (a quote refreshing), so the change is noticed.
 * Keyed by the rendered text: an unchanged refetch renders the same key and does not animate.
 */
export function Flash({ value, className }: { value: string; className?: string }) {
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);
  return (
    <m.span
      key={value}
      className={className}
      style={{ display: 'inline-block' }}
      initial={first.current ? false : { opacity: 0.3, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={BASE}
    >
      {value}
    </m.span>
  );
}

/**
 * A bigint that tweens from its previous value to the new one over 250ms when it changes (share balances).
 * The first value and unchanged refetches render as is; reduced motion jumps straight to the new value.
 */
export function useTweenedBigint(value: bigint | undefined): bigint | undefined {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (value === undefined || from === undefined || from === value || reduce) {
      setShown(value);
      return;
    }
    const steps = 1_000_000n;
    const controls = animate(0, 1, {
      ...SLOW,
      onUpdate: progress => setShown(from + ((value - from) * BigInt(Math.round(progress * 1e6))) / steps),
      onComplete: () => setShown(value),
    });
    return () => controls.stop();
  }, [value, reduce]);

  return shown;
}
