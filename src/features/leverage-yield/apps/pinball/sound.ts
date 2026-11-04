import { getAudio } from '../../boot/sounds';

/**
 * Soda Cadet sound effects, synthesised on the app's shared audio graph (so the global mute and the Safari
 * unlock both apply). Every call is a silent no-op when audio is locked, muted or turned off in Options.
 */

let enabled = true;
export function setPinballSound(on: boolean) {
  enabled = on;
}

function env() {
  return enabled ? getAudio() : undefined;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, delay = 0) {
  const a = env();
  if (!a) return;
  try {
    const t0 = a.ac.currentTime + delay;
    const osc = a.ac.createOscillator();
    const g = a.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // never throw from a sound
  }
}

let noiseBuffer: AudioBuffer | undefined;
function noise(dur: number, freq: number, q: number, gain: number, delay = 0, type: BiquadFilterType = 'bandpass') {
  const a = env();
  if (!a) return;
  try {
    if (!noiseBuffer || noiseBuffer.sampleRate !== a.ac.sampleRate) {
      noiseBuffer = a.ac.createBuffer(1, a.ac.sampleRate, a.ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = a.ac.currentTime + delay;
    const src = a.ac.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = a.ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = a.ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(a.out);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  } catch {
    // ignore
  }
}

/** Solenoid clack of a flipper firing. */
export function sfxFlip() {
  noise(0.05, 2200, 1.2, 0.5);
  tone(140, 0.07, 'square', 0.18, 70);
}

export function sfxFlipDown() {
  noise(0.03, 1400, 1.5, 0.18);
}

/** Pop bumper: thump plus a bright fizz pop. */
export function sfxBumper() {
  tone(180, 0.09, 'square', 0.22, 90);
  tone(980, 0.06, 'triangle', 0.16, 1500, 0.01);
  noise(0.08, 5200, 2, 0.12, 0.01, 'highpass');
}

export function sfxSling() {
  tone(260, 0.06, 'sawtooth', 0.16, 120);
  noise(0.05, 3000, 1, 0.25);
}

export function sfxWall(speed: number) {
  noise(0.025, 900, 1, Math.min(0.2, speed / 4000));
}

export function sfxPlunger(power: number) {
  noise(0.12, 600 + power * 900, 0.8, 0.35);
  tone(90, 0.15, 'sine', 0.3, 50);
}

export function sfxLaunch(power: number) {
  sfxPlunger(power);
  tone(300, 0.35, 'triangle', 0.12, 300 + power * 1100, 0.02);
}

export function sfxLane() {
  tone(1318, 0.09, 'square', 0.1);
  tone(1760, 0.12, 'square', 0.1, undefined, 0.07);
}

export function sfxTarget() {
  noise(0.06, 1800, 3, 0.35);
  tone(520, 0.08, 'square', 0.12, 260);
}

export function sfxSpin() {
  tone(2400, 0.03, 'square', 0.06);
}

/** Rising arpeggio for multipliers, bank completion and missions. */
export function sfxJingle(steps = 4) {
  const notes = [523, 659, 784, 1046, 1318, 1568];
  for (let i = 0; i < steps; i++) tone(notes[i % notes.length] as number, 0.12, 'square', 0.1, undefined, i * 0.08);
}

export function sfxSaucer() {
  tone(220, 0.5, 'sawtooth', 0.12, 880);
  tone(440, 0.6, 'triangle', 0.1, 1760, 0.15);
}

export function sfxEject() {
  noise(0.1, 700, 1, 0.4);
  tone(160, 0.12, 'square', 0.15, 80);
}

export function sfxKickback() {
  noise(0.12, 500, 0.8, 0.5);
  tone(120, 0.2, 'square', 0.2, 600);
}

export function sfxBallSave() {
  for (let i = 0; i < 3; i++) tone(880, 0.08, 'square', 0.1, undefined, i * 0.12);
}

export function sfxDrain() {
  tone(400, 0.7, 'sawtooth', 0.14, 60);
  tone(300, 0.7, 'square', 0.06, 45, 0.05);
}

export function sfxBonusTick() {
  tone(1200, 0.025, 'square', 0.05);
}

export function sfxTiltWarn() {
  tone(110, 0.25, 'square', 0.18);
}

export function sfxTilt() {
  tone(90, 0.9, 'sawtooth', 0.2);
  tone(93, 0.9, 'square', 0.12);
}

export function sfxExtraBall() {
  sfxJingle(6);
  tone(1568, 0.4, 'triangle', 0.12, undefined, 0.5);
}

export function sfxGameOver() {
  const notes = [523, 466, 415, 349];
  notes.forEach((n, i) => {
    tone(n, 0.28, 'square', 0.1, undefined, i * 0.22);
  });
}

export function sfxStart() {
  const notes = [392, 523, 659, 784];
  notes.forEach((n, i) => {
    tone(n, 0.14, 'square', 0.1, undefined, i * 0.09);
  });
}
