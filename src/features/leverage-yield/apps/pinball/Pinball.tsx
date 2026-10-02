import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Btn } from '../../win/controls';
import { CaptionGlyph } from '../../win/icons';
import { MenuBar } from '../../win/MenuBar';
import { type GameEvent, PinballEngine, RANKS, WORLD } from './engine';
import { PinballIcon } from './icon';
import { TableRenderer } from './render';
import * as sfx from './sound';

const SCORES_KEY = 'hazyvault.pinball.scores';
const SOUND_KEY = 'hazyvault.pinball.sound';

type HighScore = { name: string; score: number };

function loadScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    const parsed = raw ? (JSON.parse(raw) as HighScore[]) : [];
    return Array.isArray(parsed) ? parsed.filter(s => typeof s.score === 'number').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveScores(scores: HighScore[]) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, 5)));
  } catch {
    // storage blocked: scores live for this session only
  }
}

function loadSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

type Hud = {
  score: number;
  ball: number;
  balls: number;
  extra: number;
  rank: string;
  mission: string;
  progress: number;
  goal: number;
  multiplier: number;
  kickback: boolean;
  ballSave: boolean;
  message: string;
  phase: PinballEngine['phase'];
  tilted: boolean;
};

function snapshot(e: PinballEngine, display: number): Hud {
  const m = e.mission;
  return {
    score: Math.round(display),
    ball: e.ballNumber,
    balls: e.ballsLeft,
    extra: e.extraBalls,
    rank: e.rankName,
    mission: m.title,
    progress: e.missionProgress,
    goal: m.goal,
    multiplier: e.multiplier,
    kickback: e.kickbackLit,
    ballSave: e.ballSaveActive,
    message: e.message,
    phase: e.phase,
    tilted: e.tilted,
  };
}

type DialogKind = 'scores' | 'controls' | 'about' | 'name';

const FLIP_LEFT = new Set(['KeyZ', 'ShiftLeft', 'ArrowLeft']);
const FLIP_RIGHT = new Set(['Slash', 'ShiftRight', 'ArrowRight']);
const PLUNGER = new Set(['Space', 'ArrowDown']);
const HANDLED = new Set([...FLIP_LEFT, ...FLIP_RIGHT, ...PLUNGER, 'KeyX', 'Period', 'ArrowUp', 'F2', 'F3']);

/**
 * Soda Cadet Pinball: the window body (menu bar, table, side panel). The host window provides the frame and the
 * title bar. The game pauses whenever the window isn't active.
 */
export default function Pinball({ active, onClose }: { active: boolean; onClose: () => void }) {
  const engineRef = useRef<PinballEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new PinballEngine((Date.now() & 0xffff) + 1);
    engineRef.current.newGame();
  }
  const engine = engineRef.current;
  const rendererRef = useRef<TableRenderer | null>(null);
  if (!rendererRef.current) rendererRef.current = new TableRenderer();
  const renderer = rendererRef.current;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ scale: 1, dpr: 1 });
  const displayScore = useRef(0);
  const timeRef = useRef(0);

  const [userPaused, setUserPaused] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [soundOn, setSoundOn] = useState(loadSoundPref);
  const [scores, setScores] = useState<HighScore[]>(loadScores);
  const [hud, setHud] = useState<Hud>(() => snapshot(engine, 0));
  const [nameDraft, setNameDraft] = useState('Player 1');
  const pendingScore = useRef(0);

  useEffect(() => sfx.setPinballSound(soundOn), [soundOn]);

  const over = hud.phase === 'over';
  const running = active && !userPaused && !dialog && !over;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    renderer.draw(ctx, engine, viewRef.current.scale, viewRef.current.dpr, timeRef.current);
  }, [engine, renderer]);

  // Crisp canvas: size the backing store to CSS pixels × devicePixelRatio, keep the world 400×640.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const cssW = wrap.clientWidth;
      const cssH = (cssW * WORLD.h) / WORLD.w;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      viewRef.current = { scale: cssW / WORLD.w, dpr };
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const checkHighScore = useCallback((score: number) => {
    const current = loadScores();
    const qualifies = score > 0 && (current.length < 5 || score > (current[current.length - 1]?.score ?? 0));
    if (qualifies) {
      pendingScore.current = score;
      setDialog('name');
    }
  }, []);

  const onEvent = useCallback(
    (ev: GameEvent) => {
      const pts = ev.points ? `+${ev.points.toLocaleString('en-US')}` : '';
      switch (ev.type) {
        case 'flip':
          sfx.sfxFlip();
          break;
        case 'flipDown':
          sfx.sfxFlipDown();
          break;
        case 'bumper':
          sfx.sfxBumper();
          renderer.fizz(ev.x, ev.y, 10);
          renderer.popup(ev.x, ev.y - 26, pts);
          renderer.bump(2);
          break;
        case 'sling':
          sfx.sfxSling();
          renderer.fizz(ev.x, ev.y, 4);
          break;
        case 'wall':
          if (ev.speed) sfx.sfxWall(ev.speed);
          break;
        case 'lane':
        case 'inlane':
          sfx.sfxLane();
          renderer.popup(ev.x, ev.y - 10, pts);
          break;
        case 'lanesComplete':
          sfx.sfxJingle(4);
          renderer.popup(185, 140, `MULTIPLIER ${engine.multiplier}X`, true);
          break;
        case 'target':
          sfx.sfxTarget();
          renderer.popup(ev.x + 22, ev.y, pts);
          break;
        case 'bank':
          sfx.sfxJingle(5);
          renderer.fizz(ev.x, ev.y, 18);
          renderer.popup(120, 330, 'CANS REFUELLED', true);
          break;
        case 'spin':
          sfx.sfxSpin();
          break;
        case 'saucer':
          sfx.sfxSaucer();
          renderer.fizz(ev.x, ev.y, 16);
          renderer.popup(220, 170, `SONIC DOCK ${pts}`, true);
          break;
        case 'eject':
          sfx.sfxEject();
          break;
        case 'launch':
          sfx.sfxLaunch(ev.speed ?? 1);
          break;
        case 'plunger':
          sfx.sfxPlunger(ev.speed ?? 0.5);
          break;
        case 'drain':
          sfx.sfxDrain();
          renderer.bump(4);
          break;
        case 'ballSave':
          sfx.sfxBallSave();
          renderer.popup(185, 520, 'BALL SAVED', true);
          break;
        case 'kickback':
          sfx.sfxKickback();
          renderer.popup(60, 520, 'KICKBACK', true);
          break;
        case 'mission':
          sfx.sfxJingle(6);
          renderer.popup(185, 300, `MISSION COMPLETE ${pts}`, true);
          break;
        case 'rank':
          renderer.popup(185, 325, `PROMOTED: ${(ev.text ?? '').toUpperCase()}`, true);
          break;
        case 'extraBall':
          sfx.sfxExtraBall();
          renderer.popup(185, 350, 'EXTRA BALL', true);
          break;
        case 'tiltWarn':
          sfx.sfxTiltWarn();
          renderer.popup(185, 300, 'DANGER', true);
          renderer.bump(5);
          break;
        case 'tilt':
          sfx.sfxTilt();
          renderer.bump(9);
          break;
        case 'bonus':
          renderer.popup(185, 360, `BONUS ${pts} (${ev.text})`, true);
          break;
        case 'gameOver':
          sfx.sfxGameOver();
          displayScore.current = engine.score;
          checkHighScore(engine.score);
          break;
        default:
          break;
      }
    },
    [engine, renderer, checkHighScore],
  );

  // Game loop: only while running; fully stopped otherwise.
  useEffect(() => {
    if (!running) {
      engine.input.left = false;
      engine.input.right = false;
      engine.input.plunger = false;
      displayScore.current = engine.score;
      setHud(snapshot(engine, engine.score));
      draw();
      return;
    }
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    let tickAt = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      timeRef.current += dt;
      engine.update(dt);
      for (const ev of engine.takeEvents()) onEvent(ev);
      renderer.tick(dt);
      const gap = engine.score - displayScore.current;
      if (gap > 0) {
        displayScore.current += Math.max(1, Math.ceil(gap * Math.min(1, dt * 6)));
        if (gap > 2000 && now - tickAt > 60) {
          tickAt = now;
          sfx.sfxBonusTick();
        }
      } else displayScore.current = engine.score;
      draw();
      if (now - hudAt > 90) {
        hudAt = now;
        setHud(snapshot(engine, displayScore.current));
      }
      if (engine.phase === 'over') {
        setHud(snapshot(engine, engine.score));
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, engine, renderer, draw, onEvent]);

  const newGame = useCallback(() => {
    engine.newGame();
    displayScore.current = 0;
    timeRef.current = 0;
    setUserPaused(false);
    setDialog(null);
    sfx.sfxStart();
    setHud(snapshot(engine, 0));
  }, [engine]);

  // Keyboard, only while this window is active and no dialog is open.
  useEffect(() => {
    if (!active || dialog) return;
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const down = (event: KeyboardEvent) => {
      if (isTyping(event.target) || !HANDLED.has(event.code)) return;
      event.preventDefault();
      if (event.code === 'F2') {
        if (!event.repeat) newGame();
        return;
      }
      if (event.code === 'F3') {
        if (!event.repeat && !over) setUserPaused(p => !p);
        return;
      }
      if (FLIP_LEFT.has(event.code)) engine.input.left = true;
      else if (FLIP_RIGHT.has(event.code)) engine.input.right = true;
      else if (PLUNGER.has(event.code)) engine.input.plunger = true;
      else if (!event.repeat) {
        if (event.code === 'KeyX') engine.nudge(-1);
        else if (event.code === 'Period') engine.nudge(1);
        else if (event.code === 'ArrowUp') engine.nudge(0);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (FLIP_LEFT.has(event.code)) engine.input.left = false;
      else if (FLIP_RIGHT.has(event.code)) engine.input.right = false;
      else if (PLUNGER.has(event.code)) engine.input.plunger = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [active, dialog, engine, newGame, over]);

  // Touch / mouse on the table: left half flips left, right half flips right, bottom of the plunger lane pulls.
  const pointers = useRef(new Map<number, 'left' | 'right' | 'plunger'>());
  const releaseControl = (control: 'left' | 'right' | 'plunger') => {
    if (![...pointers.current.values()].includes(control)) engine.input[control] = false;
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!running) {
      if (active && userPaused && !over) setUserPaused(false);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const control = x > 0.88 && y > 0.55 ? 'plunger' : x < 0.5 ? 'left' : 'right';
    pointers.current.set(event.pointerId, control);
    engine.input[control] = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const control = pointers.current.get(event.pointerId);
    pointers.current.delete(event.pointerId);
    if (control) releaseControl(control);
  };

  const holdButton = (control: 'left' | 'right' | 'plunger') => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault();
      if (!running) return;
      engine.input[control] = true;
    },
    onPointerUp: () => {
      engine.input[control] = false;
    },
    onPointerCancel: () => {
      engine.input[control] = false;
    },
    onPointerLeave: () => {
      engine.input[control] = false;
    },
  });

  const toggleSound = () => {
    setSoundOn(on => {
      try {
        localStorage.setItem(SOUND_KEY, on ? '0' : '1');
      } catch {
        // ignore
      }
      return !on;
    });
  };

  const saveName = () => {
    const name = nameDraft.trim().slice(0, 16) || 'Player 1';
    const next = [...loadScores(), { name, score: pendingScore.current }].sort((a, b) => b.score - a.score).slice(0, 5);
    saveScores(next);
    setScores(next);
    setDialog('scores');
  };

  const menus = [
    {
      label: 'Game',
      items: [
        { label: 'New Game', shortcut: 'F2', onSelect: newGame },
        {
          label: userPaused ? 'Resume Game' : 'Pause Game',
          shortcut: 'F3',
          onSelect: () => setUserPaused(p => !p),
          disabled: over,
        },
        {
          label: 'High Scores…',
          onSelect: () => {
            setScores(loadScores());
            setDialog('scores');
          },
          separatorBefore: true,
        },
        { label: 'Exit', onSelect: onClose, separatorBefore: true },
      ],
    },
    {
      label: 'Options',
      items: [
        { label: `${soundOn ? '✓ ' : ' '}Sounds`, onSelect: toggleSound },
        { label: 'Player Controls…', onSelect: () => setDialog('controls'), separatorBefore: true },
      ],
    },
    { label: 'Help', items: [{ label: 'About Soda Cadet…', onSelect: () => setDialog('about') }] },
  ];

  const pausedReason = !active
    ? 'Paused: click this window to keep playing'
    : userPaused
      ? 'Paused: press F3 or click to resume'
      : '';

  return (
    <div className="relative flex min-w-0 flex-col">
      <MenuBar menus={menus} />
      <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-start">
        {/* Table */}
        <div className="bevel-field mx-auto w-full max-w-[400px] p-[2px] sm:mx-0 sm:w-[340px] sm:shrink-0">
          <div
            ref={wrapRef}
            className="relative w-full touch-none select-none"
            style={{ aspectRatio: `${WORLD.w} / ${WORLD.h}`, background: 'var(--pin-bg)' }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas ref={canvasRef} className="block" aria-label="Soda Cadet pinball table" />
            {pausedReason && !over && !dialog && (
              <Overlay>
                <p className="text-[18px] font-bold">Paused</p>
                <p>{pausedReason.replace('Paused: ', '')}</p>
              </Overlay>
            )}
            {over && !dialog && (
              <Overlay>
                <p className="text-[22px] font-bold tracking-wide text-[var(--pin-text)]">GAME OVER</p>
                <p>Final score {engine.score.toLocaleString('en-US')}</p>
                <Btn isDefault onClick={newGame} onPointerDown={e => e.stopPropagation()}>
                  New Game (F2)
                </Btn>
              </Overlay>
            )}
            {hud.phase === 'ready' && !pausedReason && hud.ball === 1 && hud.score === 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex justify-center">
                <p className="w2k-balloon max-w-[80%] text-center">
                  Hold <b>Space</b> to pull the plunger, release to launch. <b>Z</b> and <b>/</b> flip.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="bevel-field w-full p-[2px] sm:w-[214px] sm:self-stretch">
          <div
            className="flex h-full flex-col gap-2 p-3 text-[var(--pin-accent)]"
            style={{ background: 'var(--pin-panel)', fontFamily: '"Courier New", ui-monospace, monospace' }}
          >
            <div className="flex items-center gap-2 text-[var(--pin-text)]">
              <PinballIcon size={20} />
              <span
                className="text-[13px] font-bold italic tracking-wider"
                style={{ fontFamily: '"Arial Black", Impact, sans-serif' }}
              >
                SODA CADET
              </span>
            </div>
            <Led value={hud.score} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-1">
              <Row label="PLAYER" value="1" />
              <Row label="BALL" value={`${hud.ball}${hud.extra ? ` +${hud.extra}` : ''} / ${hud.balls}`} />
              <Row label="RANK" value={hud.rank.toUpperCase()} />
              <Row label="BONUS" value={`${hud.multiplier}X`} />
              <Row label="KICKBACK" value={hud.kickback ? 'LIT' : 'OFF'} dim={!hud.kickback} />
              <Row label="BALL SAVE" value={hud.ballSave ? 'ON' : 'OFF'} dim={!hud.ballSave} />
            </div>
            <div className="flex flex-col gap-1 border-t border-[var(--pin-accent-dim)] pt-2">
              <span className="text-[10px] text-[var(--pin-text)]">
                MISSION · next rank {RANKS[Math.min(RANKS.indexOf(hud.rank) + 1, RANKS.length - 1)]}
              </span>
              <span className="text-[12px] leading-tight">{hud.mission}</span>
              {hud.goal > 1 && (
                <div className="h-2 w-full bg-[var(--pin-accent-dim)]">
                  <div
                    className="h-full bg-[var(--pin-accent)]"
                    style={{ width: `${Math.min(100, (hud.progress / hud.goal) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <p
              className={cn(
                'min-h-[34px] border-t border-[var(--pin-accent-dim)] pt-2 text-[12px] leading-tight',
                hud.tilted && 'text-[var(--pin-tilt)]',
              )}
              aria-live="polite"
            >
              {hud.message}
            </p>
            <p
              className="mt-auto hidden text-[10px] leading-snug text-[var(--pin-accent-dim)] sm:block"
              style={{ color: 'var(--pin-star)' }}
            >
              Z / ← left flipper · / / → right flipper
              <br />
              Space / ↓ plunger · X . ↑ nudge
              <br />
              F2 new game · F3 pause
            </p>
          </div>
        </div>
      </div>

      {/* Touch controls (phones) */}
      <div className="grid grid-cols-3 gap-1.5 px-2 pb-2 sm:hidden">
        <Btn className="h-12 select-none" {...holdButton('left')}>
          ◀ Flip
        </Btn>
        <Btn className="h-12 select-none" {...holdButton('plunger')}>
          Launch
        </Btn>
        <Btn className="h-12 select-none" {...holdButton('right')}>
          Flip ▶
        </Btn>
      </div>

      {dialog === 'scores' && (
        <Dialog title="High Scores" onClose={() => setDialog(null)}>
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="py-1">Rank</th>
                <th>Name</th>
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, i) => scores[i]).map((s, i) => (
                <tr key={i}>
                  <td className="py-0.5">{i + 1}.</td>
                  <td>{s?.name ?? '—'}</td>
                  <td className="text-right font-bold">{s ? s.score.toLocaleString('en-US') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-end gap-1.5">
            <Btn
              onClick={() => {
                saveScores([]);
                setScores([]);
              }}
            >
              Reset
            </Btn>
            <Btn isDefault onClick={() => setDialog(null)}>
              OK
            </Btn>
          </div>
        </Dialog>
      )}
      {dialog === 'name' && (
        <Dialog title="New High Score" onClose={saveName}>
          <p>Congratulations, Cadet! You scored {pendingScore.current.toLocaleString('en-US')}.</p>
          <p className="mt-2">Enter your name:</p>
          <form
            className="mt-1 flex gap-1.5"
            onSubmit={event => {
              event.preventDefault();
              saveName();
            }}
          >
            <input
              className="w2k-input min-w-0 flex-1"
              value={nameDraft}
              maxLength={16}
              autoFocus
              onChange={event => setNameDraft(event.target.value)}
            />
            <Btn isDefault type="submit">
              OK
            </Btn>
          </form>
        </Dialog>
      )}
      {dialog === 'controls' && (
        <Dialog title="Player Controls" onClose={() => setDialog(null)}>
          <table className="w-full">
            <tbody>
              {[
                ['Left flipper', 'Z, Left Shift, ←'],
                ['Right flipper', '/, Right Shift, →'],
                ['Plunger', 'Hold Space or ↓, release'],
                ['Nudge left / right / up', 'X  /  .  /  ↑'],
                ['New game', 'F2'],
                ['Pause / resume', 'F3'],
                ['Touch', 'Tap left/right half to flip; Launch button or bottom-right corner'],
              ].map(([action, keys]) => (
                <tr key={action}>
                  <td className="py-0.5 pr-3 align-top">{action}</td>
                  <td className="font-bold">{keys}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[var(--win-dark)]">
            Nudging too often in a few seconds tilts the table: flippers die until the ball drains.
          </p>
          <div className="mt-3 flex justify-end">
            <Btn isDefault onClick={() => setDialog(null)}>
              OK
            </Btn>
          </div>
        </Dialog>
      )}
      {dialog === 'about' && (
        <Dialog title="About Soda Cadet" onClose={() => setDialog(null)}>
          <div className="flex items-start gap-3">
            <PinballIcon size={32} />
            <div>
              <p className="font-bold">Soda Cadet Pinball</p>
              <p>Version 1.0 for HazyVault2000</p>
              <p className="mt-2 text-[var(--win-dark)]">
                Fly a fizz-powered cadet ship from the plunger to the SONIC hub. Complete missions to climb from Cadet
                to Fleet Admiral: dock at SONIC, fizz the bumpers, knock down the cans, run the orbit and light the
                lanes.
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Btn isDefault onClick={() => setDialog(null)}>
              OK
            </Btn>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--pin-shadow)] text-center text-[var(--pin-ball)]">
      {children}
    </div>
  );
}

function Led({ value }: { value: number }) {
  const text = value.toLocaleString('en-US');
  const ghost = '8,888,888,888'.slice(-Math.max(text.length, 9));
  return (
    <div
      className="bevel-thin-in relative overflow-hidden px-2 py-1 text-right"
      style={{ background: 'var(--pin-panel)' }}
    >
      <span
        className="absolute inset-y-1 right-2 text-[22px] font-bold leading-none text-[var(--pin-accent-dim)]"
        aria-hidden="true"
      >
        {ghost}
      </span>
      <span className="relative text-[22px] font-bold leading-none">
        <span className="sr-only">Score </span>
        {text}
      </span>
    </div>
  );
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--pin-text)]">{label}</span>
      <span className={cn('font-bold', dim && 'text-[var(--pin-accent-dim)]')}>{value}</span>
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center p-3"
      style={{ background: 'var(--pin-shadow)' }}
    >
      <div role="dialog" aria-label={title} className="w2k-window bevel-out w-full max-w-[320px]">
        <div className="w2k-titlebar">
          <span className="w2k-titlebar-text">{title}</span>
          <button type="button" className="w2k-caption-btn bevel-out" onClick={onClose} aria-label="Close">
            <CaptionGlyph kind="close" />
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}
