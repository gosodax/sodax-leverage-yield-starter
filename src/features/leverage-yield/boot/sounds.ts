import { useSyncExternalStore } from 'react';

/**
 * HazyVault2000 sound board. Everything is synthesised live with WebAudio: no audio files, no samples.
 * Every export is a silent no-op when muted, before the first user gesture, or where WebAudio is missing.
 */

const MUTE_KEY = 'hazyvault.muted';
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readMuted();

export function getMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    // storage blocked: keep the in-memory value
  }
  if (m) stopAll();
  for (const cb of listeners) cb();
}

export function subscribeMuted(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const value = useSyncExternalStore(subscribeMuted, getMuted, () => false);
  return [value, setMuted];
}

// ---------------------------------------------------------------------------------------------------------------

type Ctor = typeof AudioContext;
let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let noiseBuffer: AudioBuffer | undefined;
const active = new Set<{ stop(): void }>();

function audioCtor(): Ctor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Create / resume the AudioContext. Call from a user gesture. */
export function unlockAudio(): void {
  try {
    const C = audioCtor();
    if (!C) return;
    if (!ctx) {
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.25;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  } catch {
    ctx = undefined;
  }
}

function ready(): { ac: AudioContext; out: GainNode } | undefined {
  if (muted || !ctx || !master) return undefined;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return { ac: ctx, out: master };
}

function noise(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ac.sampleRate) {
    const length = ac.sampleRate * 2;
    noiseBuffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function stopAll(): void {
  for (const handle of [...active]) handle.stop();
}

/** Run `build` with a private bus so the whole sound can be faded and stopped as one. */
function voice(build: (ac: AudioContext, bus: GainNode, t0: number) => AudioScheduledSourceNode[], length: number) {
  const env = ready();
  const handle = { stop() {} };
  if (!env) return handle;
  try {
    const { ac, out } = env;
    const bus = ac.createGain();
    bus.connect(out);
    const t0 = ac.currentTime + 0.02;
    const sources = build(ac, bus, t0);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      active.delete(handle);
      try {
        const now = ac.currentTime;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(bus.gain.value, now);
        bus.gain.linearRampToValueAtTime(0, now + 0.08);
        for (const s of sources) {
          try {
            s.stop(now + 0.1);
          } catch {
            // already stopped
          }
        }
        setTimeout(() => bus.disconnect(), 200);
      } catch {
        // context gone
      }
    };
    handle.stop = finish;
    active.add(handle);
    setTimeout(
      () => {
        done = true;
        active.delete(handle);
        try {
          bus.disconnect();
        } catch {
          // ignore
        }
      },
      (length + 0.5) * 1000,
    );
  } catch {
    // never throw from a sound
  }
  return handle;
}

function noiseSource(ac: AudioContext, t: number, duration: number): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  src.loopStart = Math.random();
  src.start(t, Math.random() * 1.5);
  src.stop(t + duration);
  return src;
}

/** A short bandpassed noise burst: a head seek / click. */
function burst(ac: AudioContext, bus: AudioNode, t: number, freq: number, q: number, gain: number, dur: number) {
  const src = noiseSource(ac, t, dur + 0.02);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(bus);
  return src;
}

function tone(
  ac: AudioContext,
  bus: AudioNode,
  type: OscillatorType,
  freq: number,
  t: number,
  dur: number,
  gain: number,
  attack = 0.005,
) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur - 0.03));
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return osc;
}

/** ~9s of late-90s tower PC: PSU thunk, fan + platter spin-up, POST beep, floppy grind, drive chatter, wind-down. */
export function playBootSequence(): { stop(): void } {
  const LENGTH = 9.5;
  return voice((ac, bus, t0) => {
    const sources: AudioScheduledSourceNode[] = [];

    // PSU relay click + thunk
    sources.push(burst(ac, bus, t0, 2400, 2, 0.9, 0.03));
    const thunk = ac.createOscillator();
    thunk.type = 'sine';
    thunk.frequency.setValueAtTime(120, t0);
    thunk.frequency.exponentialRampToValueAtTime(38, t0 + 0.25);
    const thunkGain = ac.createGain();
    thunkGain.gain.setValueAtTime(0.9, t0);
    thunkGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    thunk.connect(thunkGain).connect(bus);
    thunk.start(t0);
    thunk.stop(t0 + 0.32);
    sources.push(thunk);

    // Fan: lowpassed noise swelling into a steady airy hum
    const fan = noiseSource(ac, t0 + 0.05, LENGTH);
    const fanLp = ac.createBiquadFilter();
    fanLp.type = 'lowpass';
    fanLp.frequency.setValueAtTime(200, t0);
    fanLp.frequency.linearRampToValueAtTime(900, t0 + 1.6);
    const fanGain = ac.createGain();
    fanGain.gain.setValueAtTime(0, t0);
    fanGain.gain.linearRampToValueAtTime(0.22, t0 + 1.4);
    fanGain.gain.setValueAtTime(0.22, t0 + LENGTH - 1.6);
    fanGain.gain.linearRampToValueAtTime(0.0, t0 + LENGTH);
    fan.connect(fanLp).connect(fanGain).connect(bus);
    sources.push(fan);

    // Mains hum
    const hum = ac.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 60;
    const humGain = ac.createGain();
    humGain.gain.setValueAtTime(0, t0);
    humGain.gain.linearRampToValueAtTime(0.12, t0 + 0.8);
    humGain.gain.setValueAtTime(0.12, t0 + LENGTH - 1.6);
    humGain.gain.linearRampToValueAtTime(0, t0 + LENGTH);
    hum.connect(humGain).connect(bus);
    hum.start(t0);
    hum.stop(t0 + LENGTH);
    sources.push(hum);

    // Platter spin-up whine: sawtooth rising, settles to a faint high whine
    const whine = ac.createOscillator();
    whine.type = 'sawtooth';
    whine.frequency.setValueAtTime(60, t0 + 0.2);
    whine.frequency.exponentialRampToValueAtTime(2400, t0 + 2.6);
    whine.frequency.exponentialRampToValueAtTime(7200, t0 + 3.6);
    const whineLp = ac.createBiquadFilter();
    whineLp.type = 'lowpass';
    whineLp.frequency.value = 5000;
    const whineGain = ac.createGain();
    whineGain.gain.setValueAtTime(0, t0 + 0.2);
    whineGain.gain.linearRampToValueAtTime(0.05, t0 + 1.2);
    whineGain.gain.linearRampToValueAtTime(0.025, t0 + 3.6);
    whineGain.gain.setValueAtTime(0.012, t0 + LENGTH - 1.6);
    whineGain.gain.linearRampToValueAtTime(0, t0 + LENGTH);
    whine.connect(whineLp).connect(whineGain).connect(bus);
    whine.start(t0 + 0.2);
    whine.stop(t0 + LENGTH);
    sources.push(whine);

    // The one short POST beep: all good
    sources.push(tone(ac, bus, 'square', 1000, t0 + 2.1, 0.15, 0.22));

    // Floppy: head steps (buzzy low clunks) then a seek grind
    const floppyAt = t0 + 3.0;
    for (let i = 0; i < 4; i++) {
      const t = floppyAt + i * 0.16;
      sources.push(tone(ac, bus, 'square', 70 + i * 12, t, 0.09, 0.18, 0.002));
      sources.push(burst(ac, bus, t, 900, 4, 0.35, 0.05));
    }
    for (let i = 0; i < 3; i++) {
      const t = floppyAt + 0.8 + i * 0.22;
      const grind = ac.createOscillator();
      grind.type = 'sawtooth';
      grind.frequency.setValueAtTime(95 - i * 8, t);
      grind.frequency.linearRampToValueAtTime(140 - i * 10, t + 0.18);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.01);
      g.gain.linearRampToValueAtTime(0, t + 0.19);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      grind.connect(lp).connect(g).connect(bus);
      grind.start(t);
      grind.stop(t + 0.2);
      sources.push(grind);
    }

    // Hard-drive seek chatter: irregular clusters of tiny clicks through the rest of the boot
    let t = t0 + 2.4;
    const end = t0 + LENGTH - 0.6;
    while (t < end) {
      const cluster = 1 + Math.floor(Math.random() * 5);
      for (let i = 0; i < cluster && t < end; i++) {
        sources.push(burst(ac, bus, t, 2600 + Math.random() * 2400, 6, 0.45 + Math.random() * 0.3, 0.012));
        t += 0.025 + Math.random() * 0.05;
      }
      t += 0.08 + Math.random() * 0.45;
    }
    return sources;
  }, LENGTH);
}

/** Original warm pad arpeggio (D major add9 rising), ~3s, with a soft echo. */
export function playStartupChime(): void {
  voice((ac, bus, t0) => {
    const sources: AudioScheduledSourceNode[] = [];
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.23;
    const feedback = ac.createGain();
    feedback.gain.value = 0.32;
    const wet = ac.createGain();
    wet.gain.value = 0.35;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    delay.connect(feedback).connect(delay);
    delay.connect(lp).connect(wet).connect(bus);

    const notes = [293.66, 440, 369.99, 659.25, 554.37]; // D4 A4 F#4 E5 C#5
    notes.forEach((freq, i) => {
      const t = t0 + i * 0.22;
      const dur = 2.6 - i * 0.25;
      for (const [type, detune, level] of [
        ['sine', 0, 0.22],
        ['triangle', 6, 0.09],
      ] as const) {
        const osc = ac.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(bus);
        g.connect(delay);
        osc.start(t);
        osc.stop(t + dur + 0.05);
        sources.push(osc);
      }
    });
    // low root underneath
    sources.push(tone(ac, bus, 'sine', 146.83, t0, 2.8, 0.12, 0.4));
    return sources;
  }, 4);
}

/** Balloon notification: bright two-tone ding. */
export function playDing(): void {
  voice((ac, bus, t0) => {
    const sources: AudioScheduledSourceNode[] = [];
    for (const [freq, at] of [
      [880, 0],
      [1318.5, 0.11],
    ] as const) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(0.35, t0 + at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.6);
      osc.connect(g).connect(bus);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.65);
      sources.push(osc);
    }
    return sources;
  }, 1);
}

/** Critical-stop style thunk: a low, slightly dissonant chord with a hard attack. */
export function playError(): void {
  voice((ac, bus, t0) => {
    const sources: AudioScheduledSourceNode[] = [];
    for (const freq of [196, 207.65, 293.66]) {
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.22, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      osc.connect(g).connect(bus);
      osc.start(t0);
      osc.stop(t0 + 0.75);
      sources.push(osc);
    }
    sources.push(burst(ac, bus, t0, 300, 1, 0.5, 0.08));
    return sources;
  }, 1);
}

/** Very short UI tick. */
export function playClick(): void {
  voice((ac, bus, t0) => [burst(ac, bus, t0, 3200, 3, 0.25, 0.015)], 0.2);
}
