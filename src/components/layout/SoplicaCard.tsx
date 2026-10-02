import { type PointerEvent, useRef, useState } from 'react';

const TOASTS = ['Na zdrowie!', 'Sto lat!', 'Za yield!', 'Wasze zdrowie!'];
const SPARKS = 14;

type Burst = { id: number; x: number; y: number };

/**
 * A white "polaroid" of the Soplica minis. It floats, tilts toward the pointer with a moving glare, and a click pours
 * out a burst of gold coins and a new toast. Motion is skipped when the user prefers reduced motion.
 */
export function SoplicaCard() {
  const ref = useRef<HTMLDivElement>(null);
  const next = useRef(0);
  const [toast, setToast] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduced()) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    el.style.transform = `perspective(800px) rotateY(${(x - 0.5) * 18}deg) rotateX(${(0.5 - y) * 18}deg) scale(1.05)`;
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
    el.style.setProperty('--go', '1');
  };
  const reset = () => {
    ref.current?.style.setProperty('--go', '0');
    if (ref.current) ref.current.style.transform = '';
  };

  const cheers = (event: PointerEvent<HTMLButtonElement>) => {
    setToast(t => (t + 1) % TOASTS.length);
    if (reduced()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const id = next.current++;
    setBursts(list => [...list, { id, x: event.clientX - rect.left, y: event.clientY - rect.top }]);
    setTimeout(() => setBursts(list => list.filter(b => b.id !== id)), 1000);
  };

  return (
    <div className="soplica-float hidden shrink-0 sm:block sm:w-64 lg:w-[26rem]">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .soplica-float { animation: soplica-float 5s ease-in-out infinite; }
          .soplica-shine { animation: soplica-shine 4.5s ease-in-out infinite; }
          .soplica-spark { animation: soplica-spark 0.9s cubic-bezier(0.1, 0.7, 0.3, 1) forwards; }
        }
        @keyframes soplica-float { 0%, 100% { translate: 0 0; rotate: -3deg; } 50% { translate: 0 -12px; rotate: 2deg; } }
        @keyframes soplica-shine { from { transform: translateX(-130%) skewX(-18deg); } 60%, to { transform: translateX(330%) skewX(-18deg); } }
        @keyframes soplica-spark { from { transform: translate(0, 0) scale(1); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; } }
      `}</style>
      <div
        ref={ref}
        onPointerMove={tilt}
        onPointerLeave={reset}
        className="relative rounded-3xl bg-card p-3 shadow-2xl ring-4 ring-primary/60 transition-transform duration-200 ease-out"
      >
        <button
          type="button"
          onPointerDown={cheers}
          aria-label="Raise a toast"
          className="relative block w-full cursor-pointer overflow-hidden rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <img
            src="/brand/soplica-set.jpg"
            alt="A set of twelve Soplica liqueur miniatures in different flavours"
            width={900}
            height={630}
            className="block w-full"
            draggable={false}
          />
          {/* pointer glare */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-opacity duration-200"
            style={{
              background:
                'radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgb(255 255 255 / 0.55), transparent 45%)',
            }}
          />
          {/* idle shine sweep */}
          <span
            aria-hidden
            className="soplica-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          />
          {bursts.map(burst => (
            <span
              key={burst.id}
              aria-hidden
              className="pointer-events-none absolute"
              style={{ left: burst.x, top: burst.y }}
            >
              {Array.from({ length: SPARKS }, (_, i) => {
                const angle = (i / SPARKS) * Math.PI * 2;
                const dist = 70 + (i % 3) * 30;
                return (
                  <span
                    key={`${burst.id}-${angle}`}
                    className="soplica-spark absolute -ml-1.5 -mt-1.5 block size-3 rounded-full bg-accent shadow"
                    style={
                      {
                        '--dx': `${Math.cos(angle) * dist}px`,
                        '--dy': `${Math.sin(angle) * dist}px`,
                      } as React.CSSProperties
                    }
                  />
                );
              })}
            </span>
          ))}
        </button>
        <p aria-live="polite" className="px-1 pb-1 pt-2 text-center font-accent text-xl text-primary">
          {TOASTS[toast]}
        </p>
        <p className="pb-1 text-center text-[10px] uppercase tracking-widest text-subtle-foreground">
          Click to raise a toast
        </p>
      </div>
    </div>
  );
}
