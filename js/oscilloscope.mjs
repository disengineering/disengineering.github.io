/**
 * Sidebar oscilloscope: Web Audio demo oscillator + analyser-driven canvas trace.
 * Knobs via <input-knob> (https://github.com/GoogleChromeLabs/input-knob).
 * Defaults to power off. Browsers require a user gesture to run AudioContext — the Power button provides that.
 * When on: scope runs with sound enabled by default; Mute silences speakers.
 * Display: triggered timebase (rising-edge sync + fixed cycles across the graticule), not a rolling trace.
 */
import "https://unpkg.com/input-knob@0.0.11/dist/input-knob.esm.js";

const ASSETS = {
  faderTrack: "/assets/sidebar/oscilloscope/fader-track.png",
  faderKnob: "/assets/sidebar/oscilloscope/fader-knob.png",
  knobTop: "/assets/sidebar/oscilloscope/knob-top.png",
  knobTopMove: "/assets/sidebar/oscilloscope/knob-top-move.png",
  knobBottom: "/assets/sidebar/oscilloscope/knob-bottom.png",
  knobBottomMove: "/assets/sidebar/oscilloscope/knob-bottom-move.png",
};

const root = document.getElementById("oscilloscope-root");
const canvas = document.getElementById("oscilloscope-canvas");
const faderEl = document.getElementById("osc-fader");
const muteBtn = document.getElementById("osc-mute");
const powerBtn = document.getElementById("osc-power");

const knobFreq = document.getElementById("osc-knob-freq");
const knobTime = document.getElementById("osc-knob-time");

if (!root || !canvas || !faderEl || !knobFreq || !knobTime || !muteBtn || !powerBtn) {
  throw new Error("Oscilloscope markup missing required elements");
}

const padButtons = root.querySelectorAll(".osc-btn--pad");
let currentWave = "sine";

const ctx2d = canvas.getContext("2d", { alpha: false });

let audioCtx = null;
let oscillator = null;
let gainNode = null;
let analyser = null;
let rafId = 0;
let faderValue = Number(faderEl.value) / 100;
/** When true: no output to speakers (gain 0). Scope still shows waveform after audio has started. */
let muted = false;
/** Audio engine off until Power ON (user gesture unlocks AudioContext.resume). */
let powerOn = false;

function hzFromFreqKnob() {
  const fMin = 20;
  const fMax = 5000;
  const t =
    (Number(knobFreq.value) - Number(knobFreq.min)) / (Number(knobFreq.max) - Number(knobFreq.min));
  return fMin * (fMax / fMin) ** Math.max(0, Math.min(1, t));
}

function ensureAudio() {
  if (audioCtx) return audioCtx;
  audioCtx = new AudioContext();
  oscillator = audioCtx.createOscillator();
  oscillator.type = currentWave;
  oscillator.frequency.value = hzFromFreqKnob();

  gainNode = audioCtx.createGain();
  gainNode.gain.value = muted ? 0 : faderValue;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0;

  /* Output path (mute = gain 0). Visualization taps the oscillator directly so the trace stays visible when muted. */
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.connect(analyser);

  oscillator.start();
  return audioCtx;
}

function syncKnobsToAudio() {
  if (!oscillator || !gainNode || !analyser || !audioCtx) return;
  oscillator.frequency.setValueAtTime(hzFromFreqKnob(), audioCtx.currentTime);
  gainNode.gain.setValueAtTime(muted ? 0 : faderValue, audioCtx.currentTime);
  oscillator.type = currentWave;
}

/** Single-flight boot after Power ON (user gesture). */
let bootPromise = null;

function bootFromGesture() {
  if (!powerOn) return Promise.resolve();
  if (audioCtx) return Promise.resolve();
  if (!bootPromise) {
    bootPromise = (async () => {
      await ensureAudio();
      await audioCtx.resume();
      syncKnobsToAudio();
      if (!rafId) drawLoop();
    })();
  }
  return bootPromise;
}

function turnPowerOff() {
  stopWaveformLoop();
  bootPromise = null;
  if (oscillator) {
    try {
      oscillator.stop();
    } catch {
      /* ignore */
    }
  }
  oscillator = null;
  gainNode = null;
  analyser = null;
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  muted = false;
  powerOn = false;
  updatePowerUi();
  updateMuteUi();
  drawIdleScreen();
}

function updatePowerUi() {
  powerBtn.setAttribute("aria-checked", powerOn ? "true" : "false");
  powerBtn.setAttribute(
    "aria-label",
    powerOn ? "Power on. Press to turn off audio engine." : "Power off. Press to turn on audio engine.",
  );
}

function updateMuteUi() {
  const canMute = powerOn;
  muteBtn.disabled = !canMute;
  muteBtn.setAttribute("aria-checked", muted ? "true" : "false");
  muteBtn.setAttribute(
    "aria-label",
    !canMute
      ? "Mute unavailable. Turn power on first."
      : muted
        ? "Muted. Press to hear sound."
        : "Sound on. Press to mute.",
  );
}

function stopWaveformLoop() {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

/** First rising zero crossing (like a simple edge trigger) for a stable horizontal phase lock. */
function findRisingZeroCross(buf) {
  for (let i = 1; i < buf.length; i++) {
    if (buf[i - 1] <= 0 && buf[i] > 0) return i;
  }
  return 0;
}

function sampleBufferLinear(buf, idx) {
  const max = buf.length - 1;
  if (idx <= 0) return buf[0];
  if (idx >= max) return buf[max];
  const i0 = Math.floor(idx);
  const f = idx - i0;
  return buf[i0] + f * (buf[i0 + 1] - buf[i0]);
}

function drawFrame() {
  if (!analyser || !ctx2d || !audioCtx) return;
  resizeCanvas();
  const w = canvas.width;
  const h = canvas.height;
  const fft = analyser.fftSize;
  const buf = new Float32Array(fft);
  analyser.getFloatTimeDomainData(buf);

  const px = window.devicePixelRatio || 1;
  const sampleRate = audioCtx.sampleRate;
  const freqHz = Math.max(1, hzFromFreqKnob());
  const periodSamples = sampleRate / freqHz;

  /* Time knob = horizontal timebase: how many cycles of the fundamental fit across the graticule. */
  const tMin = Number(knobTime.min);
  const tMax = Number(knobTime.max);
  const tNorm = (Number(knobTime.value) - tMin) / (tMax - tMin);
  const cyclesVisible = 0.35 + tNorm * 7.65;
  let spanSamples = periodSamples * cyclesVisible;
  spanSamples = Math.max(periodSamples * 0.25, Math.min(spanSamples, buf.length - 2));

  const trigger = findRisingZeroCross(buf);
  const maxStart = Math.max(0, buf.length - 1 - spanSamples);
  const start = Math.min(trigger, maxStart);

  ctx2d.fillStyle = "#0a0f0a";
  ctx2d.fillRect(0, 0, w, h);

  const mid = h / 2;
  ctx2d.strokeStyle = "#2d6a2d";
  ctx2d.lineWidth = Math.max(1, px);
  ctx2d.globalAlpha = 0.35;
  ctx2d.beginPath();
  ctx2d.moveTo(0, mid);
  ctx2d.lineTo(w, mid);
  ctx2d.stroke();
  ctx2d.globalAlpha = 1;

  const ampScale = h * 0.42;
  const numPoints = Math.max(2, Math.min(2048, Math.floor(w)));

  ctx2d.strokeStyle = "#5cff5c";
  ctx2d.lineWidth = Math.max(1.5, px * 1.25);
  ctx2d.lineJoin = "round";
  ctx2d.beginPath();
  for (let i = 0; i < numPoints; i++) {
    const frac = i / (numPoints - 1);
    const idx = start + frac * spanSamples;
    const amp = sampleBufferLinear(buf, idx);
    const x = (i / (numPoints - 1)) * w;
    const y = mid - amp * ampScale;
    if (i === 0) ctx2d.moveTo(x, y);
    else ctx2d.lineTo(x, y);
  }
  ctx2d.stroke();
}

function drawLoop() {
  drawFrame();
  rafId = requestAnimationFrame(drawLoop);
}

function setFaderUi() {
  faderEl.value = String(Math.round(faderValue * 100));
}

function applyGainFromFader() {
  if (muted || !gainNode || !audioCtx) return;
  gainNode.gain.setValueAtTime(faderValue, audioCtx.currentTime);
}

function readFaderFromInput() {
  faderValue = Number(faderEl.value) / 100;
  applyGainFromFader();
}

faderEl.addEventListener("input", readFaderFromInput);

function onKnobInteraction() {
  if (oscillator) syncKnobsToAudio();
}

muteBtn.addEventListener("click", async () => {
  if (!powerOn) return;
  if (muted) {
    muted = false;
    updateMuteUi();
    syncKnobsToAudio();
  } else {
    muted = true;
    updateMuteUi();
    if (gainNode && audioCtx) gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  }
});

powerBtn.addEventListener("click", async () => {
  if (!powerOn) {
    powerOn = true;
    updatePowerUi();
    updateMuteUi();
    await bootFromGesture();
  } else {
    turnPowerOff();
  }
});

padButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const w = btn.dataset.wave;
    if (!w || w === currentWave) return;
    currentWave = w;
    padButtons.forEach((p) => p.setAttribute("aria-pressed", p === btn ? "true" : "false"));
    if (oscillator) syncKnobsToAudio();
  });
});

["knob-move-change", "knob-move-end"].forEach((ev) => {
  knobFreq.addEventListener(ev, onKnobInteraction);
  knobTime.addEventListener(ev, onKnobInteraction);
});

document.documentElement.style.setProperty("--osc-knob-top", `url(${ASSETS.knobTop})`);
document.documentElement.style.setProperty("--osc-knob-top-move", `url(${ASSETS.knobTopMove})`);
document.documentElement.style.setProperty("--osc-knob-bottom", `url(${ASSETS.knobBottom})`);
document.documentElement.style.setProperty("--osc-knob-bottom-move", `url(${ASSETS.knobBottomMove})`);
document.documentElement.style.setProperty("--osc-fader-track", `url(${ASSETS.faderTrack})`);
document.documentElement.style.setProperty("--osc-fader-knob", `url(${ASSETS.faderKnob})`);

updatePowerUi();
updateMuteUi();
setFaderUi();

function drawIdleScreen() {
  if (!ctx2d) return;
  resizeCanvas();
  const w = canvas.width;
  const h = canvas.height;
  const px = window.devicePixelRatio || 1;
  ctx2d.fillStyle = "#0a0f0a";
  ctx2d.fillRect(0, 0, w, h);
  ctx2d.strokeStyle = "#1f3d1f";
  ctx2d.lineWidth = Math.max(1, px);
  ctx2d.globalAlpha = 0.4;
  ctx2d.beginPath();
  const mid = h / 2;
  ctx2d.moveTo(0, mid);
  ctx2d.lineTo(w, mid);
  ctx2d.stroke();
  ctx2d.globalAlpha = 1;
}

drawIdleScreen();

const ro = new ResizeObserver(() => {
  if (!analyser) drawIdleScreen();
  else drawFrame();
});
ro.observe(canvas);

window.addEventListener("beforeunload", () => {
  turnPowerOff();
  ro.disconnect();
});
