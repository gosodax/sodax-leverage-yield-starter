import { getAudio } from '../../boot/sounds';

/** Minesweeper sounds, synthesised. Silent when globally muted or audio is locked. */

export function playTick() {
  const env = getAudio();
  if (!env) return;
  const { ac, out } = env;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1500, t);
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.03);
}

export function playExplosion() {
  const env = getAudio();
  if (!env) return;
  const { ac, out } = env;
  const t = ac.currentTime;
  const length = Math.floor(ac.sampleRate * 0.9);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2400, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 0.8);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.55, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  src.connect(lp).connect(gain).connect(out);
  src.start(t);
  // low thump under the crack
  const boom = ac.createOscillator();
  const bg = ac.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(110, t);
  boom.frequency.exponentialRampToValueAtTime(35, t + 0.5);
  bg.gain.setValueAtTime(0.5, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  boom.connect(bg).connect(out);
  boom.start(t);
  boom.stop(t + 0.6);
}

export function playFanfare() {
  const env = getAudio();
  if (!env) return;
  const { ac, out } = env;
  const t0 = ac.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const t = t0 + i * 0.11;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (i === 3 ? 0.5 : 0.16));
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}
