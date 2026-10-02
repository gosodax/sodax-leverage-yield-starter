/**
 * Soda Cadet pinball engine: pure TypeScript, no DOM. A circle ball on a 400×640 table (y points down the slope)
 * against line segments, circles and two rotating flippers, integrated at a fixed 480 Hz with an accumulator so a
 * fast ball moves at most ~3.5 units per step and can never skip through a wall (ball radius 8).
 *
 * The UI calls `update(dt)` every frame, sets `input`, and drains `events` for sounds, particles and popups.
 */

export const WORLD = { w: 400, h: 640 } as const;
export const BALL_R = 8;
const STEP = 1 / 480;
const GRAVITY = 1150;
const MAX_SPEED = 1700;
const DRAIN_Y = 664;
const BALLS_PER_GAME = 3;
const BALL_SAVE_S = 8;

export type Vec = { x: number; y: number };

type SegKind = 'wall' | 'sling' | 'gate' | 'post';
export type Segment = { a: Vec; b: Vec; kind: SegKind; e: number };

export type Bumper = { x: number; y: number; r: number; lit: number };

export type DropTarget = { a: Vec; b: Vec; down: boolean };

export type Flipper = {
  side: 'left' | 'right';
  pivot: Vec;
  len: number;
  rest: number;
  up: number;
  angle: number;
  omega: number;
  /** Radius at the pivot and at the tip (a tapered capsule). */
  r0: number;
  r1: number;
};

export type Lane = { x: number; y: number; lit: boolean };

export type Phase = 'ready' | 'play' | 'hold' | 'between' | 'over';

export type EventType =
  | 'flip'
  | 'flipDown'
  | 'bumper'
  | 'sling'
  | 'wall'
  | 'lane'
  | 'lanesComplete'
  | 'target'
  | 'bank'
  | 'spin'
  | 'saucer'
  | 'eject'
  | 'launch'
  | 'plunger'
  | 'drain'
  | 'ballSave'
  | 'kickback'
  | 'mission'
  | 'rank'
  | 'extraBall'
  | 'tiltWarn'
  | 'tilt'
  | 'bonus'
  | 'gameOver'
  | 'newBall'
  | 'inlane';

export type GameEvent = { type: EventType; x: number; y: number; points?: number; text?: string; speed?: number };

export type Mission = { id: string; title: string; metric: Metric; goal: number };

type Metric = 'saucer' | 'bumper' | 'bank' | 'spin' | 'lanes';

const MISSION_BASE: { id: string; title: string; metric: Metric; goal: number }[] = [
  { id: 'sonic', title: 'Launch to Sonic: sink the SONIC hub', metric: 'saucer', goal: 1 },
  { id: 'fizz', title: 'Fizz the bumpers', metric: 'bumper', goal: 10 },
  { id: 'refuel', title: 'Refuel: knock down all 3 cans', metric: 'bank', goal: 1 },
  { id: 'orbit', title: 'Orbit run: spin the spinner', metric: 'spin', goal: 15 },
  { id: 'lanes', title: 'Light all three top lanes', metric: 'lanes', goal: 1 },
];

export const RANKS = ['Cadet', 'Ensign', 'Lieutenant', 'Captain', 'Commander', 'Commodore', 'Admiral', 'Fleet Admiral'];

/** Rank indexes that award an extra ball the first time they are reached in a game. */
const EXTRA_BALL_RANKS = new Set([2, 4, 6]);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const v = (x: number, y: number): Vec => ({ x, y });

/** Closest point on segment ab to p, and the parameter t along it. */
function closest(p: Vec, a: Vec, b: Vec): { c: Vec; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1e-9;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { c: v(a.x + abx * t, a.y + aby * t), t };
}

// ---------------------------------------------------------------- table layout

const PLUNGER_REST_Y = 622;
const PLUNGER_TRAVEL = 30;
const LANE_X0 = 360; // plunger lane inner wall
const LANE_X1 = 390; // outer wall

function buildWalls(): Segment[] {
  const walls: Segment[] = [];
  const wall = (ax: number, ay: number, bx: number, by: number, kind: SegKind = 'wall', e = 0.5) =>
    walls.push({ a: v(ax, ay), b: v(bx, by), kind, e });

  // Top dome: half ellipse from the left wall over to the right outer wall.
  const cx = 200;
  const cy = 150;
  const rx = 190;
  const ry = 132;
  const N = 32;
  let prev = v(cx - rx, cy);
  for (let i = 1; i <= N; i++) {
    const ang = Math.PI + (Math.PI * i) / N;
    const p = v(cx + rx * Math.cos(ang), cy + ry * Math.sin(ang));
    walls.push({ a: prev, b: p, kind: 'wall', e: 0.4 });
    prev = p;
  }

  // Outer walls.
  wall(10, 150, 10, 700); // left
  wall(390, 150, 390, 700); // right (plunger lane outer)
  // Plunger lane inner wall.
  wall(LANE_X0, 205, LANE_X0, 700);
  // Lane-top shoulder guiding a returning ball left into the orbit instead of back down the lane.
  // (One-way gate across the lane top is separate, see GATE.)

  // Right orbit inner wall (the spinner sits between it and the lane wall).
  wall(320, 262, 320, 402, 'wall', 0.45);
  wall(320, 262, 330, 250, 'wall', 0.45);

  // Drop-target pocket guide: deflects a ball rolling down the left wall out in front of the cans.
  wall(10, 276, 48, 292, 'wall', 0.45);

  // Outlane / inlane separator posts.
  wall(42, 432, 42, 500, 'post', 0.55);
  wall(318, 432, 318, 500, 'post', 0.55);
  // Inlane guides into the flipper pivots.
  // Each guide is tangent to its flipper's pivot cap, so the ball rolls over the cap onto the flipper.
  wall(42, 500, 130.2, 562.7, 'wall', 0.3);
  wall(318, 500, 239.4, 563.0, 'wall', 0.3);
  // Inlane / outlane outer apron below the posts so the outlanes funnel into the drain.
  wall(10, 600, 60, 640, 'wall', 0.3);
  wall(LANE_X0, 600, 310, 640, 'wall', 0.3);

  // Slingshots (triangles above the flippers): two passive edges and one active kicker face.
  wall(66, 418, 66, 488, 'wall', 0.4);
  wall(66, 488, 106, 518, 'wall', 0.4);
  wall(66, 418, 106, 518, 'sling', 0.6);
  wall(294, 418, 294, 488, 'wall', 0.4);
  wall(294, 488, 254, 518, 'wall', 0.4);
  wall(294, 418, 254, 518, 'sling', 0.6);

  // Top rollover lane posts.
  for (const x of [142, 182, 222, 262]) wall(x, 62, x, 98, 'post', 0.5);

  // Saucer surround (a little cup under the dome on the right).
  wall(272, 104, 284, 136, 'wall', 0.4);
  wall(316, 104, 304, 136, 'wall', 0.4);
  return walls;
}

/** One-way gate across the plunger lane top: blocks only a ball coming back down. */
const GATE: Segment = { a: v(392, 178), b: v(352, 206), kind: 'gate', e: 0.3 };

const BUMPERS_LAYOUT = [v(142, 214), v(232, 204), v(188, 276)];
const BUMPER_R = 20;

const TARGET_LAYOUT: [number, number][] = [
  [300, 322],
  [326, 348],
  [352, 374],
];
const TARGET_X = 50;

const LANES_X = [162, 202, 242];
const LANE_Y = 84;

const SAUCER = v(294, 124);
const SAUCER_R = 11;

const SPINNER = { x0: 322, x1: LANE_X0, y: 318 };

const LEFT_OUTLANE = { x0: 10, x1: 42, y0: 540, y1: 590 };
const RIGHT_OUTLANE = { x0: 318, x1: LANE_X0, y0: 540, y1: 590 };
const LEFT_INLANE = { x0: 42, x1: 80, y0: 505, y1: 535 };
const RIGHT_INLANE = { x0: 280, x1: 318, y0: 505, y1: 535 };

function inRect(p: Vec, r: { x0: number; x1: number; y0: number; y1: number }) {
  return p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
}

// ---------------------------------------------------------------- engine

export type Ball = { x: number; y: number; vx: number; vy: number };

export class PinballEngine {
  readonly walls = buildWalls();
  readonly gate = GATE;
  bumpers: Bumper[] = BUMPERS_LAYOUT.map(p => ({ x: p.x, y: p.y, r: BUMPER_R, lit: 0 }));
  targets: DropTarget[] = TARGET_LAYOUT.map(([y0, y1]) => ({ a: v(TARGET_X, y0), b: v(TARGET_X, y1), down: false }));
  lanes: Lane[] = LANES_X.map(x => ({ x, y: LANE_Y, lit: false }));
  readonly saucer = { ...SAUCER, r: SAUCER_R };
  readonly spinner = SPINNER;
  flippers: Flipper[] = [
    { side: 'left', pivot: v(125, 570), len: 56, rest: 0.64, up: -0.46, angle: 0.64, omega: 0, r0: 9, r1: 5 },
    {
      side: 'right',
      pivot: v(245, 570),
      len: 56,
      rest: Math.PI - 0.64,
      up: Math.PI + 0.46,
      angle: Math.PI - 0.64,
      omega: 0,
      r0: 9,
      r1: 5,
    },
  ];

  ball: Ball | null = null;
  input = { left: false, right: false, plunger: false };
  plungerPull = 0;
  plungerY = PLUNGER_REST_Y;
  phase: Phase = 'over';

  score = 0;
  ballNumber = 1;
  ballsLeft = BALLS_PER_GAME;
  extraBalls = 0;
  multiplier = 1;
  rank = 0;
  missionIndex = 0;
  missionCycle = 0;
  missionProgress = 0;
  kickbackLit = true;
  ballSaveUntil = 0;
  ballSaveUsed = false;
  tilted = false;
  tiltWarnings = 0;
  spinnerAngle = 0;
  spinnerSpeed = 0;
  slingFlash = [0, 0];
  time = 0;
  /** Ticker message from the latest notable event, with when it was set. */
  message = 'Press F2 for a new game';
  messageAt = 0;
  events: GameEvent[] = [];

  private acc = 0;
  private rand: () => number;
  private holdTimer = 0;
  private betweenTimer = 0;
  private nudges: number[] = [];
  private extraRanksAwarded = new Set<number>();
  private ballStats = { bumpers: 0, targets: 0, lanes: 0, spins: 0 };
  private wasInLane = [false, false, false];
  private wasOutlane = [false, false];
  private wasInlane = [false, false];
  private spinnerPrevY = 0;
  private stillFor = 0;
  private prevPressed = { left: false, right: false };
  private bankResetAt = 0;

  constructor(seed = 1) {
    this.rand = mulberry32(seed);
  }

  get mission(): Mission {
    const base = MISSION_BASE[this.missionIndex % MISSION_BASE.length] as (typeof MISSION_BASE)[number];
    const scale = base.goal > 1 ? 1 + this.missionCycle * 0.5 : 1;
    return { ...base, goal: Math.round(base.goal * scale) };
  }

  get rankName(): string {
    return RANKS[Math.min(this.rank, RANKS.length - 1)] as string;
  }

  get ballSaveActive(): boolean {
    return this.phase === 'play' && !this.ballSaveUsed && this.time < this.ballSaveUntil;
  }

  newGame() {
    this.score = 0;
    this.ballNumber = 1;
    this.ballsLeft = BALLS_PER_GAME;
    this.extraBalls = 0;
    this.rank = 0;
    this.missionIndex = 0;
    this.missionCycle = 0;
    this.missionProgress = 0;
    this.extraRanksAwarded.clear();
    this.kickbackLit = true;
    this.resetTable();
    this.serveBall();
    this.say(`Mission: ${this.mission.title}`);
  }

  private resetTable() {
    for (const t of this.targets) t.down = false;
    for (const l of this.lanes) l.lit = false;
    this.multiplier = 1;
  }

  private serveBall() {
    this.ball = { x: (LANE_X0 + LANE_X1) / 2, y: PLUNGER_REST_Y - BALL_R - 0.5, vx: 0, vy: 0 };
    this.phase = 'ready';
    this.tilted = false;
    this.tiltWarnings = 0;
    this.nudges = [];
    this.ballSaveUsed = false;
    this.ballSaveUntil = 0;
    this.multiplier = 1;
    this.ballStats = { bumpers: 0, targets: 0, lanes: 0, spins: 0 };
    this.emit('newBall', this.ball.x, this.ball.y);
  }

  private say(text: string) {
    this.message = text;
    this.messageAt = this.time;
  }

  private emit(type: EventType, x: number, y: number, extra: Partial<GameEvent> = {}) {
    if (this.events.length < 200) this.events.push({ type, x, y, ...extra });
  }

  private addScore(points: number, x: number, y: number, type: EventType = 'wall') {
    if (this.tilted) return;
    this.score += points;
    this.emit(type, x, y, { points });
  }

  /** Nudge the table: -1 left, 1 right, 0 up. Too many in a short time tilts. */
  nudge(dir: -1 | 0 | 1) {
    if (!this.ball || this.phase !== 'play' || this.tilted) return;
    this.ball.vx += dir * 85;
    this.ball.vy -= 55;
    this.nudges = this.nudges.filter(t => this.time - t < 3);
    this.nudges.push(this.time);
    if (this.nudges.length >= 6) {
      this.tilted = true;
      this.say('TILT');
      this.emit('tilt', this.ball.x, this.ball.y);
    } else if (this.nudges.length >= 4) {
      this.tiltWarnings++;
      this.say('DANGER: stop nudging');
      this.emit('tiltWarn', this.ball.x, this.ball.y);
    }
  }

  /** Advance the simulation by `dt` seconds of wall time. */
  update(dt: number) {
    this.acc += Math.min(Math.max(dt, 0), 0.05);
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
  }

  private step(h: number) {
    this.time += h;
    for (const b of this.bumpers) b.lit = Math.max(0, b.lit - h);
    this.slingFlash = this.slingFlash.map(f => Math.max(0, f - h));
    this.spinnerAngle += this.spinnerSpeed * h;
    this.spinnerSpeed *= 1 - 2.2 * h;
    if (Math.abs(this.spinnerSpeed) < 0.5) this.spinnerSpeed = 0;

    if (this.bankResetAt && this.time >= this.bankResetAt) {
      this.bankResetAt = 0;
      for (const t of this.targets) t.down = false;
    }

    this.updateFlippers(h);
    this.updatePlunger(h);

    if (this.phase === 'between') {
      this.betweenTimer -= h;
      if (this.betweenTimer <= 0) this.nextBallOrOver();
      return;
    }
    if (this.phase === 'over' || !this.ball) return;

    if (this.phase === 'hold') {
      this.holdTimer -= h;
      if (this.holdTimer <= 0) this.ejectSaucer();
      return;
    }

    const ball = this.ball;
    ball.vy += GRAVITY * h;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAX_SPEED) {
      ball.vx *= MAX_SPEED / sp;
      ball.vy *= MAX_SPEED / sp;
    }
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;

    this.collide(ball);
    this.sensors(ball);

    // Ball search: a ball parked somewhere it shouldn't be (not cradled, not on the plunger) gets a little kick.
    const still = Math.hypot(ball.vx, ball.vy) < 6;
    const cradled = ball.y > 520 && ball.y < 600 && (this.input.left || this.input.right);
    const onPlunger = ball.x > LANE_X0 && ball.y > 560;
    if (still && !cradled && !onPlunger) {
      this.stillFor += h;
      if (this.stillFor > 2.5) {
        ball.vx += (this.rand() - 0.5) * 220;
        ball.vy -= 160;
        this.stillFor = 0;
      }
    } else this.stillFor = 0;

    if (ball.y > DRAIN_Y || ball.x < -40 || ball.x > WORLD.w + 40) this.drain();
  }

  private updateFlippers(h: number) {
    for (const f of this.flippers) {
      const pressed = !this.tilted && (f.side === 'left' ? this.input.left : this.input.right);
      const prev = f.side === 'left' ? this.prevPressed.left : this.prevPressed.right;
      if (pressed !== prev) {
        const tip = this.tip(f);
        this.emit(pressed ? 'flip' : 'flipDown', tip.x, tip.y);
        if (pressed && this.phase !== 'over') this.rotateLanes(f.side === 'left' ? -1 : 1);
      }
      if (f.side === 'left') this.prevPressed.left = pressed;
      else this.prevPressed.right = pressed;

      const target = pressed ? f.up : f.rest;
      const speed = pressed ? 20 : 13;
      const diff = target - f.angle;
      if (Math.abs(diff) <= speed * h) {
        f.angle = target;
        f.omega = 0;
      } else {
        f.omega = Math.sign(diff) * speed;
        f.angle += f.omega * h;
      }
    }
  }

  private rotateLanes(dir: -1 | 1) {
    const lit = this.lanes.map(l => l.lit);
    const n = lit.length;
    for (let i = 0; i < n; i++) (this.lanes[i] as Lane).lit = lit[(i - dir + n) % n] as boolean;
  }

  private updatePlunger(h: number) {
    if (this.input.plunger) {
      this.plungerPull = Math.min(1, this.plungerPull + h / 0.85);
    } else if (this.plungerPull > 0) {
      const power = this.plungerPull;
      this.plungerPull = 0;
      const ball = this.ball;
      if (
        ball &&
        ball.x > LANE_X0 &&
        ball.y > PLUNGER_REST_Y - 40 &&
        (this.phase === 'ready' || this.phase === 'play')
      ) {
        // The spring snaps back to rest carrying the ball on its face.
        ball.y = Math.min(ball.y, PLUNGER_REST_Y - BALL_R - 0.5);
        ball.vy = -(260 + 1300 * power);
        ball.vx = 0;
        if (this.phase === 'ready') {
          this.phase = 'play';
          this.ballSaveUntil = this.time + BALL_SAVE_S;
        }
        this.emit('launch', ball.x, ball.y, { speed: power });
      } else {
        this.emit('plunger', (LANE_X0 + LANE_X1) / 2, PLUNGER_REST_Y, { speed: power });
      }
    }
    this.plungerY = PLUNGER_REST_Y + this.plungerPull * PLUNGER_TRAVEL;
  }

  tip(f: Flipper): Vec {
    return v(f.pivot.x + Math.cos(f.angle) * f.len, f.pivot.y + Math.sin(f.angle) * f.len);
  }

  private resolve(ball: Ball, nx: number, ny: number, e: number, svx = 0, svy = 0, friction = 0.015) {
    const rvx = ball.vx - svx;
    const rvy = ball.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    const tx = rvx - vn * nx;
    const ty = rvy - vn * ny;
    ball.vx -= (1 + e) * vn * nx + tx * friction;
    ball.vy -= (1 + e) * vn * ny + ty * friction;
    return -vn;
  }

  /** Push the ball out of segment ab (with extra radius) and return the contact normal, or null. */
  private pushOut(ball: Ball, a: Vec, b: Vec, extra = 0): { nx: number; ny: number; c: Vec; t: number } | null {
    const { c, t } = closest(ball, a, b);
    let dx = ball.x - c.x;
    let dy = ball.y - c.y;
    const min = BALL_R + extra;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return null;
    let d = Math.sqrt(d2);
    if (d < 1e-6) {
      // Exactly on the line: use the segment normal.
      dx = -(b.y - a.y);
      dy = b.x - a.x;
      d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      d = 1;
      ball.x = c.x + dx * min;
      ball.y = c.y + dy * min;
      return { nx: dx, ny: dy, c, t };
    }
    const nx = dx / d;
    const ny = dy / d;
    ball.x += nx * (min - d);
    ball.y += ny * (min - d);
    return { nx, ny, c, t };
  }

  private collide(ball: Ball) {
    for (let s = 0; s < this.walls.length; s++) {
      const seg = this.walls[s] as Segment;
      const hit = this.pushOut(ball, seg.a, seg.b);
      if (!hit) continue;
      const impact = this.resolve(ball, hit.nx, hit.ny, seg.e);
      if (seg.kind === 'sling' && impact > 70 && !this.tilted) {
        ball.vx += hit.nx * 420;
        ball.vy += hit.ny * 420;
        const left = seg.a.x < 200 ? 0 : 1;
        this.slingFlash[left] = 0.15;
        this.addScore(100, hit.c.x, hit.c.y, 'sling');
      } else if (impact > 240) {
        this.emit('wall', hit.c.x, hit.c.y, { speed: impact });
      }
    }

    // One-way gate: only stops a ball travelling down from above it.
    if (ball.vy > 0) {
      const { c } = closest(ball, this.gate.a, this.gate.b);
      if (ball.y < c.y + 2) {
        const hit = this.pushOut(ball, this.gate.a, this.gate.b);
        if (hit && hit.ny < 0) this.resolve(ball, hit.nx, hit.ny, this.gate.e);
      }
    }

    for (const bump of this.bumpers) {
      const dx = ball.x - bump.x;
      const dy = ball.y - bump.y;
      const min = bump.r + BALL_R;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1;
      const nx = dx / d;
      const ny = dy / d;
      ball.x = bump.x + nx * min;
      ball.y = bump.y + ny * min;
      this.resolve(ball, nx, ny, 0.8);
      if (!this.tilted) {
        const out = ball.vx * nx + ball.vy * ny;
        if (out < 520) {
          ball.vx += nx * (520 - out);
          ball.vy += ny * (520 - out);
        }
        if (bump.lit < 0.08) {
          bump.lit = 0.18;
          this.ballStats.bumpers++;
          this.addScore(500, bump.x, bump.y, 'bumper');
          this.progress('bumper', 1);
        }
      }
    }

    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i] as DropTarget;
      if (t.down) continue;
      const hit = this.pushOut(ball, t.a, t.b, 1);
      if (!hit) continue;
      const impact = this.resolve(ball, hit.nx, hit.ny, 0.35);
      if (impact > 90 && !this.tilted) {
        t.down = true;
        this.ballStats.targets++;
        this.addScore(750, (t.a.x + t.b.x) / 2, (t.a.y + t.b.y) / 2, 'target');
        if (this.targets.every(x => x.down)) {
          this.addScore(10000, TARGET_X + 20, 336, 'bank');
          this.kickbackLit = true;
          this.say('Cans refuelled! Kickback lit');
          this.progress('bank', 1);
          this.bankResetAt = this.time + 1.2;
        }
      }
    }

    for (const f of this.flippers) {
      const tip = this.tip(f);
      const { t } = closest(ball, f.pivot, tip);
      const extra = f.r0 + (f.r1 - f.r0) * t;
      const hit = this.pushOut(ball, f.pivot, tip, extra);
      if (!hit) continue;
      // Surface velocity of the flipper at the contact point: omega × r.
      const rx = hit.c.x - f.pivot.x;
      const ry = hit.c.y - f.pivot.y;
      const svx = -f.omega * ry;
      const svy = f.omega * rx;
      this.resolve(ball, hit.nx, hit.ny, f.omega !== 0 ? 0.45 : 0.15, svx, svy, 0.006);
    }

    // Plunger top.
    if (ball.x > LANE_X0 - 1 && ball.x < LANE_X1 + 1) {
      const hit = this.pushOut(ball, v(LANE_X0, this.plungerY), v(LANE_X1, this.plungerY));
      if (hit) this.resolve(ball, hit.nx, hit.ny, 0.1);
    }
  }

  private sensors(ball: Ball) {
    // Top rollover lanes.
    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[i] as Lane;
      const inside = Math.abs(ball.x - lane.x) < 14 && Math.abs(ball.y - lane.y) < 12;
      if (inside && !this.wasInLane[i] && ball.vy > 0) {
        if (!lane.lit) {
          lane.lit = true;
          this.ballStats.lanes++;
        }
        this.addScore(1000, lane.x, lane.y, 'lane');
        if (this.lanes.every(l => l.lit)) {
          for (const l of this.lanes) l.lit = false;
          this.multiplier = Math.min(5, this.multiplier + 1);
          this.addScore(5000, 202, 60, 'lanesComplete');
          this.say(`Bonus multiplier ${this.multiplier}x`);
          this.progress('lanes', 1);
        }
      }
      this.wasInLane[i] = inside;
    }

    // Spinner in the right orbit.
    const sp = this.spinner;
    if (ball.x > sp.x0 && ball.x < sp.x1) {
      const crossed = (this.spinnerPrevY - sp.y) * (ball.y - sp.y) < 0;
      if (crossed) {
        const speed = Math.abs(ball.vy);
        const spins = Math.max(1, Math.floor(speed / 140));
        this.spinnerSpeed = Math.sign(-ball.vy || 1) * speed * 0.09;
        this.ballStats.spins += spins;
        this.addScore(200 * spins, (sp.x0 + sp.x1) / 2, sp.y, 'spin');
        this.progress('spin', spins);
      }
    }
    this.spinnerPrevY = ball.y;

    // SONIC saucer.
    const dx = ball.x - this.saucer.x;
    const dy = ball.y - this.saucer.y;
    if (dx * dx + dy * dy < this.saucer.r * this.saucer.r && Math.hypot(ball.vx, ball.vy) < 900 && !this.tilted) {
      this.phase = 'hold';
      this.holdTimer = 1.3;
      ball.x = this.saucer.x;
      ball.y = this.saucer.y;
      ball.vx = 0;
      ball.vy = 0;
      this.addScore(25000, this.saucer.x, this.saucer.y, 'saucer');
      this.say('Docked at SONIC hub');
      this.progress('saucer', 1);
    }

    // Outlanes (kickback on the left) and inlanes.
    const outs = [inRect(ball, LEFT_OUTLANE), inRect(ball, RIGHT_OUTLANE)];
    if (outs[0] && !this.wasOutlane[0]) {
      if (this.kickbackLit && !this.tilted) {
        ball.vy = -1050;
        ball.vx = 25;
        this.kickbackLit = false;
        this.addScore(2000, ball.x, ball.y, 'kickback');
        this.say('Kickback! Relight it at the cans');
      }
    }
    this.wasOutlane = outs;
    const ins = [inRect(ball, LEFT_INLANE), inRect(ball, RIGHT_INLANE)];
    for (let i = 0; i < 2; i++) {
      if (ins[i] && !this.wasInlane[i] && ball.vy > 0) this.addScore(500, ball.x, ball.y, 'inlane');
    }
    this.wasInlane = ins;
  }

  private ejectSaucer() {
    if (!this.ball) return;
    this.phase = 'play';
    this.ball.x = this.saucer.x - 6;
    this.ball.y = this.saucer.y + 12;
    this.ball.vx = -260 - this.rand() * 80;
    this.ball.vy = 260;
    this.emit('eject', this.ball.x, this.ball.y);
  }

  private progress(metric: Metric, amount: number) {
    if (this.phase === 'over' || this.tilted) return;
    const m = this.mission;
    if (m.metric !== metric) return;
    this.missionProgress += amount;
    if (this.missionProgress >= m.goal) {
      const reward = 50000 * (this.rank + 1);
      this.rank++;
      this.missionProgress = 0;
      this.missionIndex++;
      if (this.missionIndex % MISSION_BASE.length === 0) this.missionCycle++;
      this.addScore(reward, 200, 340, 'mission');
      this.emit('rank', 200, 340, { text: this.rankName });
      this.say(`Mission complete! Promoted to ${this.rankName}`);
      if (EXTRA_BALL_RANKS.has(this.rank) && !this.extraRanksAwarded.has(this.rank)) {
        this.extraRanksAwarded.add(this.rank);
        this.extraBalls++;
        this.emit('extraBall', 200, 360);
        this.say(`Promoted to ${this.rankName}: EXTRA BALL`);
      }
    } else if (m.goal > 1) {
      this.say(`${m.title}: ${this.missionProgress}/${m.goal}`);
    }
  }

  private drain() {
    const ball = this.ball;
    if (!ball) return;
    if (this.ballSaveActive) {
      this.ballSaveUsed = true;
      this.emit('ballSave', ball.x, DRAIN_Y);
      this.say('Ball saved!');
      this.ball = { x: (LANE_X0 + LANE_X1) / 2, y: PLUNGER_REST_Y - BALL_R - 0.5, vx: 0, vy: 0 };
      this.phase = 'ready';
      return;
    }
    this.emit('drain', ball.x, DRAIN_Y);
    this.ball = null;
    const bonus = this.tilted
      ? 0
      : (this.ballStats.bumpers * 100 +
          this.ballStats.targets * 250 +
          this.ballStats.lanes * 500 +
          this.ballStats.spins * 25 +
          1000) *
        this.multiplier;
    if (bonus > 0) {
      this.score += bonus;
      this.emit('bonus', 200, 340, { points: bonus, text: `${this.multiplier}x` });
      this.say(`End of ball bonus ${bonus.toLocaleString('en-US')}`);
    }
    this.phase = 'between';
    this.betweenTimer = 1.6;
  }

  private nextBallOrOver() {
    if (this.extraBalls > 0) {
      this.extraBalls--;
      this.say('Extra ball! Shoot again');
      this.serveBall();
      return;
    }
    if (this.ballNumber >= this.ballsLeft) {
      this.phase = 'over';
      this.say('GAME OVER: press F2 to play again');
      this.emit('gameOver', 200, 320, { points: this.score });
      return;
    }
    this.ballNumber++;
    this.serveBall();
    this.say(`Ball ${this.ballNumber}: ${this.mission.title}`);
  }

  /** Test helper: place the ball. */
  placeBall(x: number, y: number, vx = 0, vy = 0) {
    this.ball = { x, y, vx, vy };
    this.phase = 'play';
  }

  takeEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
