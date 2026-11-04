import { BALL_R, type Flipper, type PinballEngine, WORLD } from './engine';

/**
 * Canvas renderer for the Soda Cadet table. Colours come from the theme's --pin-* variables (read once), drawing
 * is in world units (400×640) scaled to the canvas, and particles/popups live here, not in the engine.
 */

const COLOR_KEYS = [
  'bg',
  'table',
  'rail',
  'rail-dark',
  'ball',
  'ball-shade',
  'bumper',
  'bumper-lit',
  'flipper',
  'light-off',
  'light-on',
  'text',
  'accent',
  'star',
  'grid',
  'shadow',
  'can',
  'can-dark',
  'can-light',
  'logo',
  'silver',
  'silver-dark',
  'sling',
  'sling-lit',
  'saucer',
  'saucer-ring',
  'bubble',
  'popup',
  'tilt',
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];
type Palette = Record<ColorKey, string>;

let palette: Palette | undefined;
function colors(): Palette {
  if (palette) return palette;
  const css = getComputedStyle(document.documentElement);
  palette = Object.fromEntries(
    COLOR_KEYS.map(k => [k, css.getPropertyValue(`--pin-${k}`).trim() || 'gray']),
  ) as Palette;
  return palette;
}

type Bubble = { x: number; y: number; vx: number; vy: number; r: number; life: number };
type Popup = { x: number; y: number; text: string; life: number; big: boolean };

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TableRenderer {
  private bubbles: Bubble[] = [];
  private popups: Popup[] = [];
  private stars: { x: number; y: number; r: number; phase: number }[];
  private trail: { x: number; y: number }[] = [];
  private shake = 0;

  constructor() {
    const rand = mulberry(2000);
    this.stars = Array.from({ length: 140 }, () => ({
      x: 12 + rand() * 376,
      y: 20 + rand() * 610,
      r: rand() < 0.15 ? 1.4 : 0.8,
      phase: rand() * Math.PI * 2,
    }));
  }

  fizz(x: number, y: number, n = 8) {
    for (let i = 0; i < n && this.bubbles.length < 160; i++) {
      this.bubbles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 70,
        r: 1 + Math.random() * 2.6,
        life: 0.6 + Math.random() * 0.6,
      });
    }
  }

  popup(x: number, y: number, text: string, big = false) {
    if (this.popups.length > 24) this.popups.shift();
    this.popups.push({ x, y, text, life: big ? 1.8 : 0.9, big });
  }

  bump(amount = 3) {
    this.shake = Math.max(this.shake, amount);
  }

  /** Advance particles. */
  tick(dt: number) {
    for (const b of this.bubbles) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 1 - 2 * dt;
      b.life -= dt;
    }
    this.bubbles = this.bubbles.filter(b => b.life > 0);
    for (const p of this.popups) {
      p.y -= (p.big ? 18 : 40) * dt;
      p.life -= dt;
    }
    this.popups = this.popups.filter(p => p.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  draw(ctx: CanvasRenderingContext2D, e: PinballEngine, scale: number, dpr: number, time: number) {
    const c = colors();
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    this.drawTable(ctx, e, c, time);
    this.drawInserts(ctx, e, c, time);
    this.drawWalls(ctx, e, c);
    this.drawTargets(ctx, e, c);
    this.drawBumpers(ctx, e, c);
    this.drawSaucer(ctx, e, c, time);
    this.drawSpinner(ctx, e, c);
    this.drawPlunger(ctx, e, c);
    for (const f of e.flippers) this.drawFlipper(ctx, e, f, c);
    this.drawBall(ctx, e, c);
    this.drawParticles(ctx, c);
    if (e.tilted) this.banner(ctx, 'TILT', c.tilt, time);
  }

  private tablePath(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.ellipse(200, 150, 190, 132, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(390, WORLD.h);
    ctx.lineTo(10, WORLD.h);
    ctx.closePath();
  }

  private drawTable(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette, time: number) {
    ctx.save();
    this.tablePath(ctx);
    ctx.fillStyle = c.table;
    ctx.fill();
    ctx.clip();

    // Retro perspective grid.
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let y = 40; y < WORLD.h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.w, y);
      ctx.stroke();
    }
    for (let x = -200; x <= 600; x += 40) {
      ctx.beginPath();
      ctx.moveTo(200 + (x - 200) * 0.4, 0);
      ctx.lineTo(x, WORLD.h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Starfield.
    for (const s of this.stars) {
      ctx.globalAlpha = 0.45 + 0.45 * Math.sin(time * 2 + s.phase);
      ctx.fillStyle = c.star;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // Planet SONIC behind the saucer.
    ctx.beginPath();
    ctx.arc(e.saucer.x + 4, e.saucer.y - 2, 30, 0, Math.PI * 2);
    ctx.fillStyle = c.grid;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(e.saucer.x + 4, e.saucer.y - 2, 46, 9, -0.25, 0, Math.PI * 2);
    ctx.strokeStyle = c['saucer-ring'];
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Table logo: orange swoosh + "Soda Cadet" + "HAZY" can.
    ctx.save();
    ctx.translate(185, 372);
    ctx.rotate(-0.12);
    ctx.fillStyle = c.logo;
    ctx.beginPath();
    ctx.moveTo(-110, 6);
    ctx.bezierCurveTo(-50, -26, 40, 26, 110, -8);
    ctx.lineTo(110, 4);
    ctx.bezierCurveTo(40, 38, -50, -14, -110, 18);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = 'italic 900 30px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = c['can-dark'];
    ctx.strokeText('SODA CADET', 0, -2);
    ctx.fillStyle = c.text;
    ctx.fillText('SODA CADET', 0, -2);
    ctx.font = 'bold 9px Tahoma, sans-serif';
    ctx.fillStyle = c.star;
    ctx.fillText('HUB MISSION TO SONIC', 0, 30);
    ctx.restore();

    // Apron text.
    ctx.font = 'bold 8px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = c.star;
    ctx.globalAlpha = 0.7;
    ctx.fillText('HAZYVAULT 2000', 185, 632);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private light(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    on: boolean,
    c: Palette,
    label?: string,
  ) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = on ? c['light-on'] : c['light-off'];
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = c['rail-dark'];
    ctx.stroke();
    if (on) {
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = c.popup;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (label) {
      ctx.font = 'bold 7px Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = on ? c.text : c['rail-dark'];
      ctx.fillText(label, x, y + r + 8);
    }
  }

  private drawInserts(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette, time: number) {
    // Top lanes.
    for (const lane of e.lanes) {
      this.light(ctx, lane.x, lane.y + 26, 5, lane.lit, c);
      ctx.fillStyle = lane.lit ? c['light-on'] : c['light-off'];
      ctx.beginPath();
      ctx.moveTo(lane.x - 5, lane.y - 8);
      ctx.lineTo(lane.x + 5, lane.y - 8);
      ctx.lineTo(lane.x, lane.y + 2);
      ctx.closePath();
      ctx.fill();
    }

    // Rank ladder (centre).
    const ranks = 8;
    for (let i = 0; i < ranks; i++) {
      const x = 185 + (i - (ranks - 1) / 2) * 15;
      this.light(ctx, x, 412, 4.5, i < e.rank, c);
    }
    ctx.font = 'bold 7px Tahoma, sans-serif';
    ctx.fillStyle = c.star;
    ctx.textAlign = 'center';
    ctx.fillText('RANK', 185, 428);

    // Multiplier.
    ['2X', '3X', '4X', '5X'].forEach((label, i) => {
      this.light(ctx, 155 + i * 20, 448, 5, e.multiplier >= i + 2, c, label);
    });

    // Mission progress arrow toward the current target.
    const m = e.mission;
    const progress = m.goal > 0 ? e.missionProgress / m.goal : 0;
    for (let i = 0; i < 5; i++) {
      this.light(
        ctx,
        145 + i * 20,
        488,
        4,
        progress >= (i + 1) / 5 || (Math.floor(time * 3) % 5 === i && progress < 1),
        c,
      );
    }
    ctx.fillStyle = c.star;
    ctx.fillText('MISSION', 185, 502);

    // Kickback + ball save.
    this.light(ctx, 26, 528, 5, e.kickbackLit, c, 'KICK');
    const save = e.ballSaveActive && Math.floor(time * 4) % 2 === 0;
    this.light(ctx, 185, 540, 6, save || e.phase === 'ready', c, 'SHOOT AGAIN');
  }

  private drawWalls(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette) {
    ctx.lineCap = 'round';
    // Slingshot bodies first.
    const slings = e.walls.filter(s => s.kind === 'sling');
    slings.forEach((s, i) => {
      const left = s.a.x < 200;
      const corner = left ? { x: 66, y: 488 } : { x: 294, y: 488 };
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(corner.x, corner.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.closePath();
      ctx.fillStyle = c.can;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = (e.slingFlash[left ? 0 : 1] ?? 0) > 0 ? c['sling-lit'] : c.sling;
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.stroke();
      void i;
    });

    for (const s of e.walls) {
      if (s.kind === 'sling') continue;
      ctx.lineWidth = s.kind === 'post' ? 6 : 4;
      ctx.strokeStyle = c['rail-dark'];
      ctx.beginPath();
      ctx.moveTo(s.a.x + 1, s.a.y + 1);
      ctx.lineTo(s.b.x + 1, s.b.y + 1);
      ctx.stroke();
      ctx.lineWidth = s.kind === 'post' ? 4 : 2.5;
      ctx.strokeStyle = c.rail;
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.stroke();
    }

    // One-way gate.
    ctx.lineWidth = 2;
    ctx.strokeStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(e.gate.a.x, e.gate.a.y);
    ctx.lineTo(e.gate.b.x, e.gate.b.y);
    ctx.stroke();
  }

  private drawTargets(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette) {
    for (const t of e.targets) {
      const x = t.a.x;
      const y0 = Math.min(t.a.y, t.b.y);
      const h = Math.abs(t.b.y - t.a.y);
      if (t.down) {
        ctx.fillStyle = c.bg;
        ctx.fillRect(x - 3, y0 + 2, 6, h - 4);
        continue;
      }
      // A little red can standing sideways.
      ctx.fillStyle = c['silver-dark'];
      ctx.fillRect(x - 6, y0, 12, h);
      ctx.fillStyle = c.can;
      ctx.fillRect(x - 5, y0 + 2, 10, h - 4);
      ctx.fillStyle = c['can-light'];
      ctx.fillRect(x - 3, y0 + 2, 2, h - 4);
      ctx.fillStyle = c.logo;
      ctx.fillRect(x - 5, y0 + h / 2 - 2, 10, 4);
    }
  }

  private drawBumpers(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette) {
    for (const b of e.bumpers) {
      const lit = b.lit > 0;
      // Skirt.
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
      ctx.fillStyle = lit ? c['bumper-lit'] : c['silver-dark'];
      ctx.fill();
      // Can top (top-down): silver rim, red lid with the orange logo ring.
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = c.silver;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 4, 0, Math.PI * 2);
      ctx.fillStyle = lit ? c['can-light'] : c.can;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 8, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = lit ? c['bumper-lit'] : c.bumper;
      ctx.stroke();
      // Pull tab.
      ctx.fillStyle = c['silver-dark'];
      ctx.fillRect(b.x - 3, b.y - 2, 6, 4);
      ctx.font = 'bold 7px Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = c.popup;
      ctx.fillText('500', b.x, b.y + b.r - 6);
    }
  }

  private drawSaucer(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette, time: number) {
    const s = e.saucer;
    const mission = e.mission.metric === 'saucer';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + 2, 0, Math.PI * 2);
    ctx.fillStyle = c.saucer;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = mission && Math.floor(time * 4) % 2 === 0 ? c['light-on'] : c['saucer-ring'];
    ctx.stroke();
    ctx.font = 'bold 8px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = c['saucer-ring'];
    ctx.fillText('SONIC', s.x, s.y + s.r + 12);
  }

  private drawSpinner(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette) {
    const sp = e.spinner;
    const w = Math.abs(Math.cos(e.spinnerAngle)) * 6 + 1;
    ctx.fillStyle = c['silver-dark'];
    ctx.fillRect(sp.x0, sp.y - 1, sp.x1 - sp.x0, 2);
    ctx.fillStyle = c.silver;
    ctx.fillRect(sp.x0 + 3, sp.y - w / 2, sp.x1 - sp.x0 - 6, w);
    ctx.font = 'bold 7px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = c.star;
    ctx.fillText('ORBIT', (sp.x0 + sp.x1) / 2, sp.y + 16);
  }

  private drawPlunger(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette) {
    const x0 = 362;
    const x1 = 388;
    const top = e.plungerY;
    // Spring.
    ctx.strokeStyle = c['silver-dark'];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const coils = 9;
    const bottom = WORLD.h;
    for (let i = 0; i <= coils; i++) {
      const y = top + 6 + ((bottom - top - 6) * i) / coils;
      ctx.lineTo(i % 2 ? x1 - 4 : x0 + 4, y);
    }
    ctx.stroke();
    // Head.
    ctx.fillStyle = c.silver;
    ctx.fillRect(x0, top, x1 - x0, 6);
    ctx.fillStyle = c.can;
    ctx.fillRect(x0 + 2, top + 1, x1 - x0 - 4, 2);
    // Power meter.
    if (e.plungerPull > 0) {
      ctx.fillStyle = c['light-off'];
      ctx.fillRect(366, 470, 18, 80);
      ctx.fillStyle = e.plungerPull > 0.95 ? c.accent : c['light-on'];
      const h = 80 * e.plungerPull;
      ctx.fillRect(366, 550 - h, 18, h);
    }
  }

  private drawFlipper(ctx: CanvasRenderingContext2D, e: PinballEngine, f: Flipper, c: Palette) {
    const tip = e.tip(f);
    const ang = f.angle;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    ctx.beginPath();
    ctx.moveTo(f.pivot.x + nx * f.r0, f.pivot.y + ny * f.r0);
    ctx.lineTo(tip.x + nx * f.r1, tip.y + ny * f.r1);
    ctx.arc(tip.x, tip.y, f.r1, ang + Math.PI / 2, ang - Math.PI / 2, true);
    ctx.lineTo(f.pivot.x - nx * f.r0, f.pivot.y - ny * f.r0);
    ctx.arc(f.pivot.x, f.pivot.y, f.r0, ang - Math.PI / 2, ang + Math.PI / 2, true);
    ctx.closePath();
    ctx.fillStyle = c.flipper;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = c.popup;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(f.pivot.x, f.pivot.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = c.silver;
    ctx.fill();
  }

  private drawBall(ctx: CanvasRenderingContext2D, e: PinballEngine, c: Palette) {
    const b = e.ball;
    if (!b) {
      this.trail = [];
      return;
    }
    this.trail.push({ x: b.x, y: b.y });
    if (this.trail.length > 6) this.trail.shift();
    this.trail.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * (0.4 + i * 0.08), 0, Math.PI * 2);
      ctx.fillStyle = c.ball;
      ctx.globalAlpha = 0.04 * i;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // Shadow.
    ctx.beginPath();
    ctx.arc(b.x + 3, b.y + 4, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = c.shadow;
    ctx.fill();
    const g = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BALL_R);
    g.addColorStop(0, c.popup);
    g.addColorStop(0.35, c.ball);
    g.addColorStop(1, c['ball-shade']);
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, c: Palette) {
    ctx.lineWidth = 1;
    for (const b of this.bubbles) {
      ctx.globalAlpha = Math.min(1, b.life * 1.5);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = c.bubble;
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.font = p.big ? 'bold 16px Tahoma, sans-serif' : 'bold 10px Tahoma, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.bg;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.big ? c.text : c.popup;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  private banner(ctx: CanvasRenderingContext2D, text: string, color: string, time: number) {
    if (Math.floor(time * 3) % 2) return;
    ctx.font = 'italic 900 56px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = colors().bg;
    ctx.strokeText(text, 185, 330);
    ctx.fillStyle = color;
    ctx.fillText(text, 185, 330);
  }
}
