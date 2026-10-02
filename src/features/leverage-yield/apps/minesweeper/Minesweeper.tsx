import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Btn } from '../../win/controls';
import { CaptionGlyph } from '../../win/icons';
import { MenuBar } from '../../win/MenuBar';
import { MinesweeperIcon } from './icon';
import {
  type Board,
  type Cell,
  chord,
  clampCustom,
  createBoard,
  cycleMark,
  flagsPlaced,
  LEVELS,
  type Level,
  neighbours,
  reveal,
} from './logic';
import { playExplosion, playFanfare, playTick } from './sounds';

type Config = { level: Level; rows: number; cols: number; mines: number };
type Best = Record<Exclude<Level, 'custom'>, { name: string; time: number }>;
type Face = 'smile' | 'ooh' | 'cool' | 'dead' | 'pressed';

const CELL = 16;
const STORE_CONFIG = 'hazyvault.mine.config';
const STORE_BEST = 'hazyvault.mine.best';
const STORE_PREFS = 'hazyvault.mine.prefs';
const DEFAULT_BEST: Best = {
  beginner: { name: 'Anonymous', time: 999 },
  intermediate: { name: 'Anonymous', time: 999 },
  expert: { name: 'Anonymous', time: 999 },
};
const LEVEL_NAMES: Record<Exclude<Level, 'custom'>, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: keep in memory only
  }
}

/**
 * Minesweeper, as shipped with Windows 2000: three levels plus custom, first click always safe, flags and marks,
 * chording, seven-segment counters, the smiley, best times. Renders the window body; the host draws the frame.
 */
export default function Minesweeper({ active, onClose }: { active: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<Config>(() =>
    load<Config>(STORE_CONFIG, { level: 'beginner', ...LEVELS.beginner }),
  );
  const [prefs, setPrefs] = useState(() => load(STORE_PREFS, { marks: true, sound: true }));
  const [best, setBest] = useState<Best>(() => load<Best>(STORE_BEST, DEFAULT_BEST));
  const [board, setBoard] = useState<Board>(() => createBoard(config.rows, config.cols, config.mines));
  const [time, setTime] = useState(0);
  const [pressed, setPressed] = useState<number[]>([]);
  const [face, setFace] = useState<Face>('smile');
  const [dialog, setDialog] = useState<'custom' | 'best' | 'about' | 'name' | null>(null);
  const startRef = useRef<number | null>(null);
  const soundRef = useRef(prefs.sound);
  soundRef.current = prefs.sound;

  const newGame = useCallback(
    (next: Config = config) => {
      setBoard(createBoard(next.rows, next.cols, next.mines));
      setTime(0);
      setPressed([]);
      setFace('smile');
      startRef.current = null;
    },
    [config],
  );

  const choose = (next: Config) => {
    setConfig(next);
    save(STORE_CONFIG, next);
    newGame(next);
  };

  // Timer: starts on the first reveal, 1..999, ticking.
  const playing = board.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    if (startRef.current === null) {
      startRef.current = Date.now();
      setTime(1);
      if (soundRef.current) playTick();
    }
    let shown = 1;
    const id = setInterval(() => {
      const elapsed = Math.min(999, Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000) + 1);
      if (elapsed === shown) return;
      shown = elapsed;
      setTime(elapsed);
      if (soundRef.current && elapsed < 999) playTick();
    }, 250);
    return () => clearInterval(id);
  }, [playing]);

  // End of game: face, sounds, best time. Latest values via a ref so it fires once per status change.
  const status = board.status;
  const endRef = useRef({ level: config.level, time, best });
  endRef.current = { level: config.level, time, best };
  useEffect(() => {
    if (status === 'lost') {
      setFace('dead');
      if (soundRef.current) playExplosion();
    }
    if (status === 'won') {
      const { level, time: finalTime, best: scores } = endRef.current;
      setFace('cool');
      if (soundRef.current) playFanfare();
      if (level !== 'custom' && finalTime < scores[level].time) setDialog('name');
    }
  }, [status]);

  // F2 = new game while the window is active.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        newGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, newGame]);

  // ---------- input ----------
  const over = board.status === 'won' || board.status === 'lost';
  const buttonsRef = useRef(0);
  const chordingRef = useRef(false);
  const hoverRef = useRef<number | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchFlagged = useRef(false);

  const previewFor = useCallback(
    (index: number | null, isChord: boolean): number[] => {
      if (index === null) return [];
      const cells = isChord ? [index, ...neighbours(board, index)] : [index];
      return cells.filter(i => {
        const cell = board.cells[i] as Cell;
        return !cell.revealed && cell.mark !== 'flag';
      });
    },
    [board],
  );

  const cellAt = (event: { clientX: number; clientY: number }): number | null => {
    const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const value = el?.closest<HTMLElement>('[data-cell]')?.dataset.cell;
    return value === undefined ? null : Number(value);
  };

  const act = (index: number, isChord: boolean) => {
    const cell = board.cells[index] as Cell;
    if (isChord || cell.revealed) setBoard(b => chord(b, index));
    else setBoard(b => reveal(b, index));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (over) return;
    const index = cellAt(event);
    if (index === null) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (event.pointerType === 'touch') {
      touchFlagged.current = false;
      hoverRef.current = index;
      setPressed(previewFor(index, (board.cells[index] as Cell).revealed));
      setFace('ooh');
      touchTimer.current = setTimeout(() => {
        touchFlagged.current = true;
        setPressed([]);
        setFace('smile');
        setBoard(b => cycleMark(b, index, prefs.marks));
        navigator.vibrate?.(15);
      }, 400);
      return;
    }
    buttonsRef.current = event.buttons;
    hoverRef.current = index;
    if (event.button === 2 && !(event.buttons & 1)) {
      // Right button alone: flag immediately, like the original.
      setBoard(b => cycleMark(b, index, prefs.marks));
      return;
    }
    chordingRef.current = event.button === 1 || (event.buttons & 3) === 3;
    setPressed(previewFor(index, chordingRef.current));
    setFace('ooh');
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (over) return;
    if (event.pointerType === 'touch') {
      const index = cellAt(event);
      if (index !== hoverRef.current && touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
        hoverRef.current = null;
        setPressed([]);
        setFace('smile');
      }
      return;
    }
    if (!event.buttons) return;
    // A second button pressed while the first is held arrives as a move: it becomes a chord.
    if ((event.buttons & 3) === 3 || event.buttons & 4) chordingRef.current = true;
    buttonsRef.current = event.buttons;
    const index = cellAt(event);
    hoverRef.current = index;
    if (event.buttons & 1 || chordingRef.current) setPressed(previewFor(index, chordingRef.current));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
        if (!touchFlagged.current && hoverRef.current !== null && !over) act(hoverRef.current, false);
      }
      hoverRef.current = null;
      setPressed([]);
      if (!over) setFace('smile');
      return;
    }
    const index = hoverRef.current;
    const wasChord = chordingRef.current;
    const wasLeft = (buttonsRef.current & 1) === 1;
    // Release when all buttons are up (a chord fires on the first release, like the original).
    if (index !== null && !over && (wasChord || (wasLeft && event.button === 0))) act(index, wasChord);
    if (event.buttons === 0 || wasChord) {
      chordingRef.current = false;
      buttonsRef.current = event.buttons;
      hoverRef.current = event.buttons ? hoverRef.current : null;
      setPressed([]);
      setFace(f => (f === 'ooh' ? 'smile' : f));
    }
  };

  const onPointerCancel = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = null;
    chordingRef.current = false;
    hoverRef.current = null;
    setPressed([]);
    setFace(f => (f === 'ooh' ? 'smile' : f));
  };

  useEffect(
    () => () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
    },
    [],
  );

  // keep the face in sync with game end even if a press was in progress
  const shownFace: Face = status === 'won' ? 'cool' : status === 'lost' ? 'dead' : face;
  const minesLeft = board.mines - flagsPlaced(board);
  const pressedSet = new Set(pressed);
  const check = (on: boolean, label: string) => `${on ? '✓ ' : ' '}${label}`;

  const menus = [
    {
      label: 'Game',
      items: [
        { label: ' New', shortcut: 'F2', onSelect: () => newGame() },
        {
          label: check(config.level === 'beginner', 'Beginner'),
          separatorBefore: true,
          onSelect: () => choose({ level: 'beginner', ...LEVELS.beginner }),
        },
        {
          label: check(config.level === 'intermediate', 'Intermediate'),
          onSelect: () => choose({ level: 'intermediate', ...LEVELS.intermediate }),
        },
        {
          label: check(config.level === 'expert', 'Expert'),
          onSelect: () => choose({ level: 'expert', ...LEVELS.expert }),
        },
        { label: check(config.level === 'custom', 'Custom…'), onSelect: () => setDialog('custom') },
        {
          label: check(prefs.marks, 'Marks (?)'),
          separatorBefore: true,
          onSelect: () =>
            setPrefs(p => {
              const n = { ...p, marks: !p.marks };
              save(STORE_PREFS, n);
              return n;
            }),
        },
        {
          label: check(prefs.sound, 'Sound'),
          onSelect: () =>
            setPrefs(p => {
              const n = { ...p, sound: !p.sound };
              save(STORE_PREFS, n);
              return n;
            }),
        },
        { label: ' Best Times…', separatorBefore: true, onSelect: () => setDialog('best') },
        { label: ' Exit', separatorBefore: true, onSelect: onClose },
      ],
    },
    { label: 'Help', items: [{ label: 'About Minesweeper…', onSelect: () => setDialog('about') }] },
  ];

  return (
    <div className="w2k flex w-fit max-w-full flex-col select-none">
      <MenuBar menus={menus} />
      <div className="max-w-full overflow-x-auto">
        {/* outer raised frame */}
        <div
          className="inline-flex flex-col gap-[6px] p-[6px]"
          style={{
            background: 'var(--win-face)',
            boxShadow: 'inset 3px 3px 0 var(--win-highlight), inset -1px -1px 0 var(--win-shadow)',
          }}
        >
          {/* status panel */}
          <div
            className="flex items-center justify-between px-[6px] py-[4px]"
            style={{ boxShadow: 'inset 2px 2px 0 var(--win-shadow), inset -2px -2px 0 var(--win-highlight)' }}
          >
            <Led value={minesLeft} label="Mines remaining" />
            <SmileyButton face={shownFace} onClick={() => newGame()} />
            <Led value={time} label="Seconds elapsed" />
          </div>
          {/* board */}
          <div
            className="p-[3px]"
            style={{ boxShadow: 'inset 3px 3px 0 var(--win-shadow), inset -3px -3px 0 var(--win-highlight)' }}
          >
            <div
              role="application"
              aria-label={`Minesweeper board, ${board.rows} by ${board.cols}`}
              className="grid touch-none"
              style={{ gridTemplateColumns: `repeat(${board.cols}, ${CELL}px)` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onContextMenu={event => event.preventDefault()}
            >
              {board.cells.map((cell, i) => (
                <CellView
                  key={i}
                  index={i}
                  cell={cell}
                  pressed={pressedSet.has(i)}
                  status={board.status}
                  exploded={board.exploded === i}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <CustomDialog
        open={dialog === 'custom'}
        initial={config}
        onClose={() => setDialog(null)}
        onApply={(rows, cols, mines) => {
          setDialog(null);
          choose({ level: 'custom', ...clampCustom(rows, cols, mines) });
        }}
      />
      <BestDialog
        open={dialog === 'best'}
        best={best}
        onClose={() => setDialog(null)}
        onReset={() => {
          setBest(DEFAULT_BEST);
          save(STORE_BEST, DEFAULT_BEST);
        }}
      />
      <NameDialog
        open={dialog === 'name'}
        level={config.level === 'custom' ? 'beginner' : config.level}
        onDone={name => {
          if (config.level !== 'custom') {
            const next = { ...best, [config.level]: { name: name.trim() || 'Anonymous', time } };
            setBest(next);
            save(STORE_BEST, next);
          }
          setDialog('best');
        }}
      />
      <MsDialog open={dialog === 'about'} title="About Minesweeper" onClose={() => setDialog(null)}>
        <div className="flex gap-3 p-4">
          <MinesweeperIcon size={32} />
          <div className="flex flex-col gap-1">
            <p className="font-bold">Minesweeper</p>
            <p>Version 5.0 (HazyVault2000 edition)</p>
            <p className="text-[var(--win-dark)]">Find every mine without detonating one. Right-click to flag.</p>
          </div>
        </div>
        <DialogButtons>
          <Btn isDefault onClick={() => setDialog(null)}>
            OK
          </Btn>
        </DialogButtons>
      </MsDialog>
    </div>
  );
}

// ---------- cells ----------

function CellView({
  index,
  cell,
  pressed,
  status,
  exploded,
}: {
  index: number;
  cell: Cell;
  pressed: boolean;
  status: Board['status'];
  exploded: boolean;
}) {
  const lost = status === 'lost';
  const showMine = cell.mine && (cell.revealed || (lost && cell.mark !== 'flag'));
  const wrongFlag = lost && cell.mark === 'flag' && !cell.mine;
  const open = cell.revealed || pressed || showMine || wrongFlag;

  let content: ReactNode = null;
  if (wrongFlag) content = <MineGlyph crossed />;
  else if (showMine) content = <MineGlyph />;
  else if (cell.revealed && cell.adjacent > 0)
    content = (
      <span
        className="text-[13px] leading-none font-bold"
        style={{ color: `var(--mine-${cell.adjacent})`, fontFamily: 'var(--font-sans)' }}
      >
        {cell.adjacent}
      </span>
    );
  else if (!cell.revealed && !pressed && cell.mark === 'flag') content = <FlagGlyph />;
  else if (!cell.revealed && cell.mark === 'question')
    content = <span className="text-[12px] leading-none font-bold text-[var(--win-text)]">?</span>;

  return (
    <div
      data-cell={index}
      className="flex size-[16px] items-center justify-center"
      style={
        open
          ? {
              background: exploded ? 'var(--mine-hit)' : 'var(--win-face)',
              boxShadow: 'inset 1px 1px 0 var(--win-shadow)',
            }
          : {
              background: 'var(--win-face)',
              boxShadow: 'inset -2px -2px 0 var(--win-shadow), inset 2px 2px 0 var(--win-highlight)',
            }
      }
    >
      {content}
    </div>
  );
}

function MineGlyph({ crossed }: { crossed?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="6" y="0" width="1" height="13" fill="var(--win-text)" />
      <rect x="0" y="6" width="13" height="1" fill="var(--win-text)" />
      <rect x="2" y="2" width="1" height="1" fill="var(--win-text)" />
      <rect x="10" y="2" width="1" height="1" fill="var(--win-text)" />
      <rect x="2" y="10" width="1" height="1" fill="var(--win-text)" />
      <rect x="10" y="10" width="1" height="1" fill="var(--win-text)" />
      <rect x="4" y="2" width="5" height="9" fill="var(--win-text)" />
      <rect x="2" y="4" width="9" height="5" fill="var(--win-text)" />
      <rect x="3" y="3" width="7" height="7" fill="var(--win-text)" />
      <rect x="4" y="4" width="2" height="2" fill="var(--win-highlight)" />
      {crossed && <path d="M1 1L12 12M12 1L1 12" stroke="var(--mine-hit)" strokeWidth="1.6" shapeRendering="auto" />}
    </svg>
  );
}

function FlagGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="2" y="1" width="5" height="1" fill="var(--mine-hit)" />
      <rect x="1" y="2" width="6" height="2" fill="var(--mine-hit)" />
      <rect x="2" y="4" width="5" height="1" fill="var(--mine-hit)" />
      <rect x="6" y="1" width="1" height="7" fill="var(--win-text)" />
      <rect x="4" y="8" width="4" height="1" fill="var(--win-text)" />
      <rect x="2" y="9" width="8" height="2" fill="var(--win-text)" />
    </svg>
  );
}

// ---------- LED counters ----------

const SEGMENTS: Record<string, string> = {
  a: '2,1 11,1 9,3 4,3',
  b: '12,2 12,10.5 10,9.5 10,4',
  c: '12,12.5 12,21 10,19 10,13.5',
  d: '2,22 11,22 9,20 4,20',
  e: '1,12.5 3,13.5 3,19 1,21',
  f: '1,2 3,4 3,9.5 1,10.5',
  g: '2,11.5 4,10.5 9,10.5 11,11.5 9,12.5 4,12.5',
};
const DIGITS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
};

function Led({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(-99, Math.min(999, value));
  const text = clamped < 0 ? `-${String(-clamped).padStart(2, '0')}` : String(clamped).padStart(3, '0');
  return (
    <div
      role="status"
      aria-label={`${label}: ${clamped}`}
      className="flex"
      style={{
        background: 'var(--mine-led-bg)',
        boxShadow: '1px 1px 0 var(--win-highlight), -1px -1px 0 var(--win-shadow)',
      }}
    >
      {text.split('').map((ch, i) => (
        <svg key={i} width="13" height="23" viewBox="0 0 13 23" aria-hidden="true">
          {Object.entries(SEGMENTS).map(([seg, points]) => (
            <polygon
              key={seg}
              points={points}
              fill={DIGITS[ch]?.includes(seg) ? 'var(--mine-led-on)' : 'var(--mine-led-off)'}
            />
          ))}
        </svg>
      ))}
    </div>
  );
}

// ---------- smiley ----------

function SmileyButton({ face, onClick }: { face: Face; onClick: () => void }) {
  const [down, setDown] = useState(false);
  return (
    <button
      type="button"
      aria-label="New game"
      title="New game (F2)"
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={onClick}
      className="flex size-[26px] items-center justify-center"
      style={{
        background: 'var(--win-face)',
        boxShadow: down
          ? 'inset 0 0 0 1px var(--win-shadow), inset 2px 2px 0 var(--win-shadow)'
          : '0 0 0 1px var(--win-shadow), inset -2px -2px 0 var(--win-shadow), inset 2px 2px 0 var(--win-highlight)',
      }}
    >
      <span style={{ transform: down ? 'translate(1px,1px)' : undefined }}>
        <FaceGlyph face={face} />
      </span>
    </button>
  );
}

function FaceGlyph({ face }: { face: Face }) {
  const k = 'var(--win-text)';
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="7.8" fill="var(--mine-smiley)" stroke={k} strokeWidth="1" />
      {face === 'dead' ? (
        <>
          <path d="M4.3 4.3l3 3M7.3 4.3l-3 3M9.7 4.3l3 3M12.7 4.3l-3 3" stroke={k} strokeWidth="1.5" />
          <path d="M5 13c1.8-2.2 5.2-2.2 7 0" fill="none" stroke={k} strokeWidth="1.1" />
        </>
      ) : face === 'cool' ? (
        <>
          <path d="M2.5 6h12" stroke={k} strokeWidth="1" />
          <path
            d="M3.5 6h4.2v1.6c0 .9-.9 1.5-2.1 1.5s-2.1-.6-2.1-1.5zM9.3 6h4.2v1.6c0 .9-.9 1.5-2.1 1.5s-2.1-.6-2.1-1.5z"
            fill={k}
          />
          <path d="M5 11c1.8 2.2 5.2 2.2 7 0" fill="none" stroke={k} strokeWidth="1.1" />
        </>
      ) : (
        <>
          <rect x="5" y="5.2" width="2" height="2" fill={k} />
          <rect x="10" y="5.2" width="2" height="2" fill={k} />
          {face === 'ooh' ? (
            <ellipse cx="8.5" cy="11.6" rx="1.8" ry="2" fill="none" stroke={k} strokeWidth="1.1" />
          ) : (
            <path d="M5 10.6c1.8 2.2 5.2 2.2 7 0" fill="none" stroke={k} strokeWidth="1.1" />
          )}
        </>
      )}
    </svg>
  );
}

// ---------- dialogs ----------

function MsDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={next => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="w2k w2k-window bevel-out fixed top-1/2 left-1/2 z-[60] flex w-[calc(100%-16px)] max-w-[320px] -translate-x-1/2 -translate-y-1/2 flex-col outline-none"
        >
          <div className="w2k-titlebar">
            <MinesweeperIcon size={14} />
            <DialogPrimitive.Title className="w2k-titlebar-text text-[11px]">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="w2k-caption-btn bevel-out" aria-label="Close">
              <CaptionGlyph kind="close" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DialogButtons({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-1.5 px-3 pt-1 pb-3">{children}</div>;
}

function CustomDialog({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: Config;
  onClose: () => void;
  onApply: (rows: number, cols: number, mines: number) => void;
}) {
  const [values, setValues] = useState({
    rows: String(initial.rows),
    cols: String(initial.cols),
    mines: String(initial.mines),
  });
  useEffect(() => {
    if (open) setValues({ rows: String(initial.rows), cols: String(initial.cols), mines: String(initial.mines) });
  }, [open, initial]);
  const apply = () => onApply(Number(values.rows), Number(values.cols), Number(values.mines));
  const field = (key: 'rows' | 'cols' | 'mines', label: string) => (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="underline">{label[0]}</span>
        {label.slice(1)}:
      </span>
      <input
        className="w2k-input w-[56px]"
        inputMode="numeric"
        value={values[key]}
        onChange={e => setValues(v => ({ ...v, [key]: e.target.value.replace(/[^0-9]/g, '') }))}
        onKeyDown={e => e.key === 'Enter' && apply()}
      />
    </label>
  );
  return (
    <MsDialog open={open} title="Custom Field" onClose={onClose}>
      <div className="flex gap-4 p-4">
        <div className="flex flex-1 flex-col gap-2">
          {field('rows', 'Height')}
          {field('cols', 'Width')}
          {field('mines', 'Mines')}
        </div>
        <div className="flex flex-col gap-1.5">
          <Btn isDefault onClick={apply}>
            OK
          </Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
      <p className="px-4 pb-3 text-[10px] text-[var(--win-dark)]">
        Height 9–24, width 9–30. Mines up to (height−1)×(width−1).
      </p>
    </MsDialog>
  );
}

function BestDialog({
  open,
  best,
  onClose,
  onReset,
}: {
  open: boolean;
  best: Best;
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <MsDialog open={open} title="Fastest Mine Sweepers" onClose={onClose}>
      <div className="p-4">
        <table className="w-full">
          <tbody>
            {(Object.keys(LEVEL_NAMES) as (keyof Best)[]).map(level => (
              <tr key={level}>
                <td className="pr-3 pb-1">{LEVEL_NAMES[level]}:</td>
                <td className="pr-3 pb-1 text-right">{best[level].time} seconds</td>
                <td className="pb-1">{best[level].name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DialogButtons>
        <Btn onClick={onReset}>Reset Scores</Btn>
        <Btn isDefault onClick={onClose}>
          OK
        </Btn>
      </DialogButtons>
    </MsDialog>
  );
}

function NameDialog({ open, level, onDone }: { open: boolean; level: keyof Best; onDone: (name: string) => void }) {
  const [name, setName] = useState('Anonymous');
  return (
    <MsDialog open={open} title="Congratulations" onClose={() => onDone(name)}>
      <div className="flex flex-col items-center gap-3 p-4 text-center">
        <p>
          You have the fastest time
          <br />
          for {LEVEL_NAMES[level].toLowerCase()} level.
          <br />
          Please type your name:
        </p>
        <input
          className="w2k-input w-[160px]"
          value={name}
          maxLength={32}
          // biome-ignore lint/a11y/noAutofocus: the original dialog focuses the name field
          autoFocus
          onFocus={e => e.currentTarget.select()}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onDone(name)}
        />
      </div>
      <DialogButtons>
        <Btn isDefault onClick={() => onDone(name)}>
          OK
        </Btn>
      </DialogButtons>
    </MsDialog>
  );
}
