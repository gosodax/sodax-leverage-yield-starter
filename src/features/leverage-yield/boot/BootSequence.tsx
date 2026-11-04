import { useCallback, useEffect, useRef, useState } from 'react';
import { BuiltOn, Wordmark } from '../win/Logo';
import { audioRunning, playBootSequence, playStartupChime, unlockAudio, useMuted } from './sounds';

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
export function BootSequence({
  onDone,
  cold = false,
}: {
  onDone: () => void /** Always show the power button. */;
  cold?: boolean;
}) {
  // Already unlocked (e.g. Start → Restart): go straight to POST with sound. Otherwise ask for the power button,
  // which is the click every browser (Safari included) needs before it will play audio.
  const [phase, setPhase] = useState<Phase>(() => (!cold && audioRunning() ? 'post' : 'power'));
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

  const [muted, setMuted] = useMuted();
  const startSound = useCallback(() => {
    if (soundRef.current || doneRef.current) return;
    soundRef.current = playBootSequence();
  }, []);

  // Restart path: audio already running, start the soundscape with the POST.
  useEffect(() => {
    if (!cold && audioRunning()) startSound();
  }, [startSound, cold]);

  const powerOn = useCallback(() => {
    void unlockAudio(true).then(startSound);
    setPhase('post');
  }, [startSound]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overflow-x-hidden bg-[var(--win-text)]"
      role="dialog"
      aria-modal="true"
      aria-label="HazyVault2000 start-up"
    >
      {phase === 'power' && (
        <PowerScreen onPower={powerOn} onSkip={() => finish(false)} muted={muted} onMute={setMuted} />
      )}
      {phase === 'post' && <PostScreen onDone={() => setPhase('splash')} />}
      {phase === 'splash' && <Splash onDone={() => finish(true)} />}
      {phase !== 'power' && (
        <button
          type="button"
          onClick={() => finish(false)}
          className="w2k-btn fixed right-3 bottom-3 z-[101] min-w-0 px-2 text-[11px]"
        >
          Skip ▸
        </button>
      )}
    </div>
  );
}

function PostScreen({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [memory, setMemory] = useState(0);
  const reduced = useRef(prefersReducedMotion()).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const speed = reduced ? 0.25 : 1;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    POST_LINES.forEach((line, i) => {
      at += line.delay * speed;
      timers.push(setTimeout(() => setCount(i + 1), at));
    });
    timers.push(setTimeout(() => doneRef.current(), at + 900 * speed));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

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
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => doneRef.current(), reduced ? 1200 : 3200);
    return () => clearTimeout(timer);
  }, [reduced]);

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

/**
 * The machine is off: a dark room, a beige case front with a glowing standby LED and a big power button.
 * Clicking anywhere (or Enter / Space) powers on: that click is also what lets the browser play the boot sounds.
 */
function PowerScreen({
  onPower,
  onSkip,
  muted,
  onMute,
}: {
  onPower: () => void;
  onSkip: () => void;
  muted: boolean;
  onMute: (muted: boolean) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pressed, setPressed] = useState(false);
  useEffect(() => buttonRef.current?.focus(), []);

  const press = () => {
    if (pressed) return;
    setPressed(true);
    onPower();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the focused power button handles Enter/Space; this is a big click target
    <div
      className="w2k relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-8 px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at 50% 45%, var(--win-dark) 0%, var(--win-text) 70%)' }}
      onClick={press}
    >
      {/* case front */}
      <div
        className="relative flex w-[min(320px,86vw)] flex-col items-center gap-5 rounded-[10px] px-6 pt-6 pb-7"
        style={{
          background:
            'linear-gradient(180deg, var(--pc-beige-light) 0%, var(--pc-beige) 55%, var(--pc-beige-dark) 100%)',
          boxShadow:
            'inset 2px 2px 0 var(--pc-beige-light), inset -2px -3px 0 var(--pc-beige-shadow), 0 30px 60px -20px var(--win-text), 0 0 0 1px var(--pc-beige-shadow)',
        }}
      >
        {/* badge + drive bays */}
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] font-bold tracking-wide text-[var(--pc-beige-shadow)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              HazyVault 2000
            </span>
          </div>
          <span
            className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold text-[var(--pc-beige-light)]"
            style={{ background: 'var(--pc-beige-shadow)' }}
          >
            733 MHz
          </span>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Bay label="SODA-ROM 48X" />
          <Bay label="3½ FLOPPY" slot />
        </div>

        {/* power button */}
        <div className="relative mt-1 flex items-center justify-center">
          {!pressed && (
            <>
              <span
                className="absolute size-[132px] animate-ping rounded-full opacity-30"
                style={{ background: 'var(--led-green)' }}
              />
              <span
                className="absolute size-[120px] rounded-full opacity-20 blur-md"
                style={{ background: 'var(--led-green)' }}
              />
            </>
          )}
          <button
            ref={buttonRef}
            type="button"
            aria-label="Power on HazyVault2000"
            onClick={event => {
              event.stopPropagation();
              press();
            }}
            className="relative flex size-[104px] items-center justify-center rounded-full outline-none transition-transform focus-visible:ring-4 focus-visible:ring-[var(--led-green)] active:scale-95"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, var(--pc-beige-light) 0%, var(--pc-beige) 55%, var(--pc-beige-dark) 100%)',
              boxShadow: pressed
                ? 'inset 3px 3px 8px var(--pc-beige-shadow), 0 0 0 4px var(--pc-beige-dark)'
                : '0 6px 0 var(--pc-beige-shadow), 0 10px 18px -4px var(--win-text), 0 0 0 4px var(--pc-beige-dark), inset -2px -3px 4px var(--pc-beige-dark)',
              transform: pressed ? 'translateY(5px)' : undefined,
            }}
          >
            <svg viewBox="0 0 24 24" className="size-11" aria-hidden="true">
              <path d="M12 3v8" stroke="var(--pc-beige-shadow)" strokeWidth="2.6" strokeLinecap="round" />
              <path
                d="M6.6 6.8a7.5 7.5 0 1 0 10.8 0"
                fill="none"
                stroke="var(--pc-beige-shadow)"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* LEDs */}
        <div className="flex items-center gap-5 text-[9px] font-bold tracking-wider text-[var(--pc-beige-shadow)]">
          <span className="flex items-center gap-1.5">
            <span
              className={pressed ? 'size-2 rounded-full' : 'size-2 animate-pulse rounded-full'}
              style={{
                background: pressed ? 'var(--led-green)' : 'var(--led-amber)',
                boxShadow: `0 0 8px ${pressed ? 'var(--led-green)' : 'var(--led-amber)'}`,
              }}
            />
            POWER
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: 'var(--pc-beige-shadow)' }} />
            HDD
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-[18px] font-bold text-[var(--win-highlight)]" style={{ fontFamily: 'var(--font-sans)' }}>
          Click anywhere to power on
        </p>
        <p className="text-[12px] text-[var(--win-gray-text)]">
          🔊 Turn your sound up. The boot is noisy, like it should be.
        </p>
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops the background power-on click */}
      <div
        className="flex items-center gap-5 text-[11px] text-[var(--win-gray-text)]"
        onClick={event => event.stopPropagation()}
      >
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            className="w2k-check"
            checked={muted}
            onChange={event => onMute(event.target.checked)}
          />
          Mute sounds
        </label>
        <button type="button" className="underline hover:text-[var(--win-highlight)]" onClick={onSkip}>
          Skip boot
        </button>
      </div>
    </div>
  );
}

function Bay({ label, slot }: { label: string; slot?: boolean }) {
  return (
    <div
      className="flex h-7 items-center justify-between rounded-[3px] px-2"
      style={{
        background: 'var(--pc-beige)',
        boxShadow: 'inset 1px 1px 0 var(--pc-beige-shadow), inset -1px -1px 0 var(--pc-beige-light)',
      }}
    >
      <span className="text-[8px] font-bold tracking-wider text-[var(--pc-beige-shadow)]">{label}</span>
      {slot ? (
        <span className="h-[3px] w-24 rounded-full" style={{ background: 'var(--pc-beige-shadow)' }} />
      ) : (
        <span className="h-2 w-3 rounded-[1px]" style={{ background: 'var(--pc-beige-dark)' }} />
      )}
    </div>
  );
}
