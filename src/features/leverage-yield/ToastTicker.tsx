const TOASTS = [
  ['Na zdrowie', 'to your health factor'],
  ['Sto lat', 'may your shares live a hundred years'],
  ['Za yield', 'to the yield'],
  ['Smacznego', 'enjoy your APR'],
  ['Wasze zdrowie', 'to your good health'],
  ['Dobra robota', 'good work, depositor'],
] as const;

function Row() {
  return (
    <>
      {TOASTS.map(([polish, english]) => (
        <span key={polish} className="flex shrink-0 items-center gap-3 pr-8">
          <span aria-hidden className="text-accent">
            ✦
          </span>
          <span className="font-accent text-xl text-hero-foreground">{polish}</span>
          <span className="text-xs uppercase tracking-widest text-hero-muted">{english}</span>
        </span>
      ))}
    </>
  );
}

/** A slow marquee of Polish toasts and their yield-flavoured translations. Pauses on hover; static if motion is reduced. */
export function ToastTicker() {
  return (
    <div className="toast-ticker group relative overflow-hidden rounded-full bg-hero-dark py-3 shadow-lg ring-1 ring-primary/40">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .toast-track { animation: toast-scroll 38s linear infinite; }
          .toast-ticker:hover .toast-track { animation-play-state: paused; }
        }
        @keyframes toast-scroll { to { transform: translateX(-50%); } }
      `}</style>
      <div className="toast-track flex w-max">
        <div className="flex">
          <Row />
        </div>
        <div className="flex" aria-hidden>
          <Row />
        </div>
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-hero-dark to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-hero-dark to-transparent"
      />
    </div>
  );
}
