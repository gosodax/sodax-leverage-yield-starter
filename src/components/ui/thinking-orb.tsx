import { Component, lazy, type ReactNode, Suspense, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The app's one loading indicator: Jakub Antalik's thinking orbs (MIT, npm `thinking-orbs`), a dotted sphere drawn
 * on a 2D canvas. Use it only while work is actually happening (a quote loading, a wallet prompt open, a relay or
 * solver fill pending), never as idle decoration.
 *
 * Colour comes from the brand theme, never the library: the ink is read from `--foreground` (espresso) or
 * `--primary` (amber) in src/brand/theme.css and passed as the orb's tint. The library pauses offscreen and in a
 * hidden tab, and draws a still frame for anyone whose system asks for less motion. Its code loads on demand, so the
 * orb's box is reserved up front and nothing shifts when the canvas arrives.
 */

export type OrbState = 'working' | 'searching' | 'solving' | 'composing' | 'connecting' | 'breathing';
export type OrbSize = 20 | 32 | 64;

const Orb = lazy(() => import('thinking-orbs').then(module => ({ default: module.ThinkingOrb })));

/** A chunk that fails to load (a tab left open across a deploy) shows nothing rather than taking the page down. */
class OrbBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const SIZE_CLASS: Record<OrbSize, string> = { 20: 'size-5', 32: 'size-8', 64: 'size-16' };

const LABEL: Record<OrbState, string> = {
  working: 'Working',
  searching: 'Getting a quote',
  solving: 'Waiting for the solver',
  composing: 'Preparing',
  connecting: 'Waiting for your wallet',
  breathing: 'Loading',
};

/** The library's `color` takes #rgb, #rrggbb or rgb(); the theme tokens are hex. Light theme only. */
function readInk(tone: 'ink' | 'amber'): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(tone === 'amber' ? '--primary' : '--foreground')
    .trim();
  return value || undefined;
}

export function ThinkingOrb({
  state = 'working',
  size = 20,
  tone = 'ink',
  decorative = false,
  label,
  className,
  speed,
  paused = false,
  fill = false,
}: {
  state?: OrbState;
  /** The library's tuned presets: 20 inline with text, 64 avatar scale; 32 sits between. */
  size?: OrbSize;
  /** Espresso ink (default) or amber, from the theme. */
  tone?: 'ink' | 'amber';
  /** Beside words that already say what is happening: hidden from assistive tech. */
  decorative?: boolean;
  label?: string;
  className?: string;
  /** Animation speed multiplier on the preset (1 = tuned speed). */
  speed?: number;
  paused?: boolean;
  /** Stretch the canvas to the parent box (a large, blurred backdrop). The preset still sets the drawing. */
  fill?: boolean;
}) {
  const [ink] = useState(() => readInk(tone));
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        fill ? 'size-full' : SIZE_CLASS[size],
        className,
      )}
      role={decorative ? undefined : 'status'}
      aria-hidden={decorative || undefined}
      data-orb={state}
    >
      <OrbBoundary>
        <Suspense fallback={null}>
          <Orb
            state={state}
            size={size}
            theme="light"
            color={ink}
            speed={speed}
            paused={paused}
            aria-label={decorative ? undefined : (label ?? LABEL[state])}
            aria-hidden={decorative || undefined}
            style={
              fill
                ? { width: '100%', height: '100%', display: 'block' }
                : { width: size, height: size, display: 'block' }
            }
          />
        </Suspense>
      </OrbBoundary>
    </span>
  );
}

/** A reserved block with a centred orb and a line of text, in place of a loading quote or card. */
export function OrbPanel({
  state = 'searching',
  children,
  className,
}: {
  state?: OrbState;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-8 text-sm text-muted-foreground',
        className,
      )}
    >
      <ThinkingOrb state={state} size={32} decorative />
      <span role="status">{children}</span>
    </div>
  );
}
