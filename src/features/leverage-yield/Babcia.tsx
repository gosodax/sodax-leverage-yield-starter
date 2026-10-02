import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Plon is Polish for yield, as in a harvest.
const SAYINGS = ['Yield, kochanie!', 'Yield? Proszę!', 'Plon means yield!', 'Jedz yield, jedz!', 'Sto lat yieldu!'];

/**
 * A babcia fixed to the bottom-left of the screen, rendered on <body> and on top of the page so she is always there as
 * you scroll. She ignores the pointer, so she never blocks a click. Wide screens only. The top fades into the page,
 * she sways, and her speech bubble bobs. The photo is cropped to remove the source's title and watermark.
 */
export function Babcia() {
  const [saying, setSaying] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSaying(n => (n + 1) % SAYINGS.length), 4000);
    return () => clearInterval(timer);
  }, []);

  return createPortal(
    <div
      aria-hidden
      className="babcia pointer-events-none fixed bottom-0 -left-12 z-40 hidden w-42 xl:block 2xl:w-[320px]"
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .babcia-photo { transform-origin: 20% 100%; animation: babcia-sway 6s ease-in-out infinite; }
          .babcia-bubble { animation: babcia-bob 2.8s ease-in-out infinite; }
        }
        @keyframes babcia-sway { 0%, 100% { transform: rotate(-0.8deg); } 50% { transform: rotate(1deg) translateX(3px); } }
        @keyframes babcia-bob { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
      `}</style>
      <span className="babcia-bubble absolute right-2 top-2 z-10 rounded-2xl rounded-bl-sm bg-card px-4 py-2 font-accent text-lg text-primary shadow-lg ring-2 ring-primary/40">
        {SAYINGS[saying]}
      </span>
      <img
        src="/brand/babcia.jpg"
        alt=""
        width={362}
        height={474}
        draggable={false}
        className="babcia-photo block w-full rounded-t-[3rem] opacity-95"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%)' }}
      />
    </div>,
    document.body,
  );
}
