import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Reveal } from './Reveal';

const HEADLINE = 'Na zdrowie.';
const QUIPS = [
  'Your health factor is fine. Your dancing, less so.',
  'Nalewka is not accepted as collateral.',
  'Ciocia says: eat something first.',
  'Sto lat! Sto lat! (That is the whole song.)',
  'Still 1.19 and holding. Like Babcia’s recipe.',
  'Okay, that is enough. Mind your health factor.',
] as const;

function Glass({ side }: { side: 'l' | 'r' }) {
  return (
    <svg viewBox="0 0 24 30" aria-hidden className={`closing-glass closing-glass-${side} size-14 shrink-0`}>
      <path
        d="M3 3h18l-2 22a3 3 0 0 1-3 2.5H8A3 3 0 0 1 5 25z"
        className="fill-hero-dark stroke-hero-foreground"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M4.2 12h15.6l-1 13a2.2 2.2 0 0 1-2.2 2H7.4a2.2 2.2 0 0 1-2.2-2z" className="fill-accent" />
    </svg>
  );
}

/**
 * A dark closing banner with a pun on health factor. The letters wobble like a tipsy toast, two glasses clink on a
 * loop, and "Pour another" cycles jokes while a health bar sways but never drops. Static if motion is reduced.
 */
export function ClosingBand() {
  const [count, setCount] = useState(0);
  const quip = count === 0 ? undefined : QUIPS[(count - 1) % QUIPS.length];
  // The more toasts, the more the letters wobble; the bar sways but stays well clear of liquidation.
  const wobble = Math.min(count, 6);

  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-3xl bg-hero-dark px-6 py-12 text-center text-hero-foreground shadow-xl sm:px-12">
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            .closing-glow { animation: closing-glow 6s ease-in-out infinite alternate; }
            .closing-star { animation: closing-star 3s ease-in-out infinite; }
            .closing-letter { display: inline-block; animation: closing-tipsy 2.4s ease-in-out infinite; animation-delay: calc(var(--i) * 120ms); }
            .closing-glass-l { transform-origin: 50% 100%; animation: closing-clink-l 3.2s ease-in-out infinite; }
            .closing-glass-r { transform-origin: 50% 100%; animation: closing-clink-r 3.2s ease-in-out infinite; }
            .closing-ding { animation: closing-ding 3.2s ease-out infinite; }
            .closing-bar { animation: closing-sway 2.2s ease-in-out infinite; }
            .closing-btn { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s; }
            .closing-btn:hover { transform: translateY(-3px) scale(1.06); }
            .closing-pour { animation: closing-pulse 2.6s ease-out infinite; }
            .closing-emoji { animation: closing-wiggle 2.6s ease-in-out infinite; transform-origin: 50% 80%; }
            .closing-pour:hover .closing-emoji { animation: closing-pourtip 0.5s ease-in-out infinite alternate; }
            .closing-arrow { animation: closing-hop 1.2s ease-in-out infinite; }
            .closing-pick:hover .closing-arrow { animation-duration: 0.5s; }
            .closing-shine { animation: closing-shine 3.4s ease-in-out infinite; }
            .closing-quip { animation: closing-quip 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
          }
          @keyframes closing-glow { from { transform: translateX(-12%); opacity: 0.5; } to { transform: translateX(12%); opacity: 0.9; } }
          @keyframes closing-star { 0%, 100% { transform: scale(0.6) rotate(0); opacity: 0.3; } 50% { transform: scale(1.1) rotate(20deg); opacity: 1; } }
          @keyframes closing-tipsy {
            0%, 100% { transform: translateY(0) rotate(0); }
            25% { transform: translateY(calc(var(--w, 1) * -2px)) rotate(calc(var(--w, 1) * -2deg)); }
            75% { transform: translateY(calc(var(--w, 1) * 2px)) rotate(calc(var(--w, 1) * 2.5deg)); }
          }
          @keyframes closing-clink-l { 0%, 55% { transform: translateX(-14px) rotate(-16deg); } 72% { transform: translateX(6px) rotate(10deg); } 80% { transform: translateX(0) rotate(0); } 100% { transform: translateX(-14px) rotate(-16deg); } }
          @keyframes closing-clink-r { 0%, 55% { transform: translateX(14px) rotate(16deg); } 72% { transform: translateX(-6px) rotate(-10deg); } 80% { transform: translateX(0) rotate(0); } 100% { transform: translateX(14px) rotate(16deg); } }
          @keyframes closing-ding { 0%, 68% { opacity: 0; transform: translateY(6px) scale(0.5); } 76% { opacity: 1; transform: translateY(-8px) scale(1.15); } 92%, 100% { opacity: 0; transform: translateY(-16px) scale(1); } }
          @keyframes closing-sway { 0%, 100% { translate: calc(var(--w, 0) * -3px) 0; } 50% { translate: calc(var(--w, 0) * 3px) 0; } }
          @keyframes closing-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 70%, transparent); } 70%, 100% { box-shadow: 0 0 0 16px transparent; } }
          @keyframes closing-wiggle { 0%, 70%, 100% { transform: rotate(0); } 78% { transform: rotate(-18deg); } 86% { transform: rotate(14deg); } 94% { transform: rotate(-8deg); } }
          @keyframes closing-pourtip { from { transform: rotate(-10deg); } to { transform: rotate(-55deg) translateY(2px); } }
          @keyframes closing-hop { 0%, 100% { transform: translateY(2px); } 50% { transform: translateY(-5px); } }
          @keyframes closing-shine { from { transform: translateX(-150%) skewX(-18deg); } 55%, to { transform: translateX(450%) skewX(-18deg); } }
          @keyframes closing-quip { from { opacity: 0; transform: translateY(8px) scale(0.9); } to { opacity: 1; transform: none; } }
        `}</style>
        <span
          aria-hidden
          className="closing-glow pointer-events-none absolute -bottom-24 left-1/2 h-48 w-3/4 -translate-x-1/2 rounded-full bg-primary/50 blur-3xl"
        />
        <span aria-hidden className="closing-star absolute left-[12%] top-8 text-xl text-accent">
          ✦
        </span>
        <span aria-hidden className="closing-star absolute right-[14%] top-14 text-sm text-accent [animation-delay:1s]">
          ✦
        </span>
        <span
          aria-hidden
          className="closing-star absolute bottom-10 right-[26%] text-lg text-accent [animation-delay:2s]"
        >
          ✦
        </span>
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center gap-2">
            <Glass side="l" />
            <span aria-hidden className="closing-ding absolute -top-5 font-accent text-lg text-accent opacity-0">
              *clink!*
            </span>
            <Glass side="r" />
          </div>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            <span className="sr-only">{HEADLINE}</span>
            <span
              aria-hidden
              className="font-accent text-hero-accent"
              style={{ '--w': 1 + wobble } as React.CSSProperties}
            >
              {[...HEADLINE].map((char, i) => (
                <span key={i} aria-hidden className="closing-letter" style={{ '--i': i } as React.CSSProperties}>
                  {char === ' ' ? ' ' : char}
                </span>
              ))}
            </span>
            <span className="mt-1 block">Mind your health factor.</span>
          </h2>
          <p className="max-w-md text-sm text-hero-muted">
            Zdrowie means health, and in a leveraged vault it is also the number that keeps you from liquidation. Drink
            to both, responsibly.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-1.5" style={{ '--w': wobble } as React.CSSProperties}>
            <div className="flex items-baseline justify-between text-xs uppercase tracking-widest text-hero-muted">
              <span>Health factor</span>
              <span className="tabular-nums text-hero-foreground">1.19</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-hero-foreground/15" role="presentation">
              <div className="closing-bar h-full w-3/4 rounded-full bg-gradient-to-r from-primary to-accent" />
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-hero-muted">
              <span>Liquidation 1.00</span>
              <span>Toasts: {count}</span>
            </div>
          </div>
          <p aria-live="polite" className="min-h-6 text-sm font-semibold text-hero-accent">
            {quip && (
              <span key={count} className="closing-quip inline-block">
                {quip}
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => setCount(c => c + 1)}
              className="closing-btn closing-pour group/btn relative overflow-hidden bg-accent px-7 text-base font-bold text-accent-foreground shadow-lg hover:bg-accent hover:brightness-105 active:scale-95"
            >
              <span aria-hidden className="closing-emoji inline-block text-xl">
                🥃
              </span>
              Pour another toast
            </Button>
            <Button
              size="lg"
              onClick={() => document.getElementById('vaults-heading')?.scrollIntoView({ behavior: 'smooth' })}
              className="closing-btn closing-pick group/btn relative overflow-hidden px-7 text-base font-bold shadow-lg ring-2 ring-hero-foreground/70 active:scale-95"
            >
              <span
                aria-hidden
                className="closing-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              />
              Pick a vault
              <span aria-hidden className="closing-arrow inline-block text-lg">
                ↑
              </span>
            </Button>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
