import { m, useAnimate, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ThinkingOrb } from '@/components/ui/thinking-orb';

/** One drift cycle, mirrored forever. Slow enough to read as light moving on paper. */
const DRIFT_SECONDS = 32;

/**
 * A large, faded amber thinking orb behind the hero, partly off canvas: warm light on the paper, not an object.
 * Transforms and opacity only, on its own layer. Pauses (drift and the orb's own animation) when the tab is hidden
 * or the layer is offscreen; static under prefers-reduced-motion. Fades down as the page scrolls past the hero.
 *
 * Contrast: at its brightest the glow mixes cream with amber to about #f6deaa. Espresso headline text on that
 * is about 14:1 and the Bark subline about 5.9:1, both above AA.
 */
export function BackgroundOrb() {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const layer = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 600], [1, 0.45]);
  const running = visible && tabVisible && !reduce;

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const element = layer.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const controls = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => {
    if (reduce || !scope.current) return;
    controls.current = animate(
      scope.current,
      { x: [0, -36, 18], y: [0, 28, -14], scale: [0.96, 1.04, 1], rotate: [0, 8, -4] },
      { duration: DRIFT_SECONDS, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY, repeatType: 'mirror' },
    );
    return () => controls.current?.stop();
  }, [reduce, animate, scope]);

  useEffect(() => {
    if (running) controls.current?.play();
    else controls.current?.pause();
  }, [running]);

  return (
    <m.div
      ref={layer}
      aria-hidden
      className="pointer-events-none absolute -top-24 -right-32 -z-10 size-[420px] md:-top-40 md:-right-40 md:size-[760px]"
      style={{ opacity }}
    >
      <div
        ref={scope}
        className="relative size-full"
        style={{
          willChange: 'transform',
          maskImage: 'radial-gradient(closest-side, black 55%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(closest-side, black 55%, transparent 100%)',
        }}
      >
        {/* Warm lamplight under the orb, so the corner glows even between dot pulses. */}
        <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgba(249,166,0,0.22),rgba(249,166,0,0.08)_60%,transparent)]" />
        <div className="absolute inset-0 opacity-45 blur-[1.5px]">
          <ThinkingOrb state="breathing" size={64} tone="amber" decorative fill speed={0.3} paused={!running} />
        </div>
      </div>
    </m.div>
  );
}
