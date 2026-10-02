import { useCallback, useEffect, useRef, useState } from 'react';
import { BuiltOn, Wordmark } from '../win/Logo';
import { playBootSequence, playStartupChime, unlockAudio, useMuted } from './sounds';

type Phase = 'power' | 'post' | 'splash';

type PostLine = { text: string; delay: number; counter?: boolean };

const POST_LINES: PostLine[] = [
  { text: 'HazyBIOS v2.00  (C) 2000 hazy2go', delay: 0 },
  { text: 'Soda-Hub 440SX PCIset(TM)', delay: 250 },
  { text: '', delay: 100 },
  { text: 'Main Processor : Fizz-II 733MHz (133x5.5)', delay: 350 },
  { text: 'Memory Testing : ', delay: 300, counter: true },
  { text: '', delay: 1500 },
  { text: 'Detecting IDE drives ...', delay: 250 },
  { text: '  Primary Master   : SODAX HUB SONIC', delay: 450 },
  { text: '  Primary Slave    : None', delay: 300 },
  { text: '  Secondary Master : HAZY CD-ROM 48X', delay: 300 },
  { text: '  Secondary Slave  : None', delay: 250 },
  { text: 'Floppy A: 1.44M, 3.5 in.', delay: 300 },
  { text: '', delay: 100 },
  { text: 'Linking hub wallet on Sonic ... OK', delay: 500 },
  { text: 'Loading vault drivers: lsodaSUSDS lsodaWEETH lsodaWSTETH lsodaJITOSOL', delay: 450 },
  { text: 'Verifying DMI Pool Data ......', delay: 400 },
];

const MEMORY_KB = 65536;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Cold-boot experience: power button → BIOS POST → splash, with a synthesised boot soundscape.
 * Esc or "Skip" ends it at any point.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('post');
  const soundRef = useRef<{ stop(): void } | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(
    (chime: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      if (!chime) soundRef.current?.stop();
      if (chime) playStartupChime();
      onDone();
    },
    [onDone],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  // Boot starts on its own. Browsers only allow sound after a user gesture, so the soundscape starts right away
  // where autoplay is allowed, and otherwise on the first click or key press during the boot.
  useEffect(() => {
    let started = false;
    const start = () => {
      if (started || doneRef.current) return;
      unlockAudio();
      const sound = playBootSequence();
      started = true;
      soundRef.current = sound;
    };
    start();
    const onGesture = () => {
      if (started) {
        unlockAudio();
        return;
      }
      start();
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overflow-x-hidden bg-[var(--win-text)]"
      role="dialog"
      aria-modal="true"
      aria-label="HazyVault2000 start-up"
    >
      {phase === 'post' && <PostScreen onDone={() => setPhase('splash')} />}
      {phase === 'splash' && <Splash onDone={() => finish(true)} />}
      {
        <button
          type="button"
          onClick={() => finish(false)}
          className="w2k-btn fixed right-3 bottom-3 z-[101] min-w-0 px-2 text-[11px]"
        >
          Skip ▸
        </button>
      }
    </div>
  );
}

function PostScreen({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [memory, setMemory] = useState(0);
  const reduced = useRef(prefersReducedMotion()).current;

  useEffect(() => {
    const speed = reduced ? 0.25 : 1;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    POST_LINES.forEach((line, i) => {
      at += line.delay * speed;
      timers.push(setTimeout(() => setCount(i + 1), at));
    });
    timers.push(setTimeout(onDone, at + 900 * speed));
    return () => timers.forEach(clearTimeout);
  }, [onDone, reduced]);

  const counterIndex = POST_LINES.findIndex(l => l.counter);
  const counting = count > counterIndex;
  useEffect(() => {
    if (!counting) return;
    const step = reduced ? MEMORY_KB / 4 : 1024;
    const timer = setInterval(() => {
      setMemory(m => {
        const next = Math.min(MEMORY_KB, m + step);
        if (next >= MEMORY_KB) clearInterval(timer);
        return next;
      });
    }, 20);
    return () => clearInterval(timer);
  }, [counting, reduced]);

  return (
    <div className="flex flex-1 flex-col px-4 py-5 font-mono text-[12px] leading-[1.45] text-[var(--win-face)] sm:px-8 sm:text-[14px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {POST_LINES.slice(0, count).map((line, i) => (
            <p key={`${i}-${line.text}`} className="min-h-[1.45em] break-words whitespace-pre-wrap">
              {line.text}
              {line.counter && (
                <span className="text-[var(--win-highlight)]">
                  {memory}K{memory >= MEMORY_KB ? ' OK' : ''}
                </span>
              )}
            </p>
          ))}
        </div>
        <SodaStar />
      </div>
      <p className="mt-auto pt-6 animate-pulse text-[var(--win-highlight)]">Press DEL to enter SETUP</p>
    </div>
  );
}

/** Original pixel "SODA-STAR" badge: a little bottle, not any real certification mark. */
function SodaStar() {
  return (
    <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex" aria-hidden="true">
      <svg viewBox="0 0 24 32" width="48" height="64" shapeRendering="crispEdges">
        <rect x="9" y="0" width="6" height="3" fill="var(--soda-cap)" />
        <rect x="9" y="3" width="6" height="6" fill="var(--soda-glass)" />
        <rect x="6" y="9" width="12" height="21" fill="var(--soda-lime)" />
        <rect x="6" y="15" width="12" height="5" fill="var(--win-highlight)" />
        <rect x="8" y="10" width="2" height="18" fill="var(--win-highlight)" opacity="0.5" />
        <rect x="14" y="24" width="2" height="2" fill="var(--win-highlight)" />
        <rect x="11" y="12" width="2" height="2" fill="var(--win-highlight)" />
        <rect x="6" y="30" width="12" height="2" fill="var(--soda-lime-dark)" />
      </svg>
      <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--soda-lime)]">SODA-STAR</span>
    </div>
  );
}

function Splash({ onDone }: { onDone: () => void }) {
  const reduced = useRef(prefersReducedMotion()).current;
  useEffect(() => {
    const timer = setTimeout(onDone, reduced ? 1200 : 3200);
    return () => clearTimeout(timer);
  }, [onDone, reduced]);

  return (
    <div className="w2k flex flex-1 items-center justify-center bg-[var(--win-text)] p-4">
      <div className="w-full max-w-[460px] overflow-hidden">
        <div className="flex flex-col items-center gap-1 bg-gradient-to-b from-[var(--win-highlight)] to-[var(--win-face)] px-6 pt-8 pb-5">
          <Wordmark tone="dark" />
          <BuiltOn className="self-end pr-2 text-[var(--win-dark)]" />
        </div>
        <div className="h-3 bg-gradient-to-r from-[var(--win-title-a)] via-[var(--win-title-b)] to-[var(--win-title-a)]" />
        <div className="flex flex-col gap-2 bg-[var(--win-face)] px-6 py-4">
          <p className="text-[11px]">Starting up...</p>
          <div className="w2k-progress bevel-thin-in overflow-hidden bg-[var(--win-window)]">
            <div className="w2k-progress-marquee" />
          </div>
        </div>
      </div>
    </div>
  );
}
