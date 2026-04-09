/**
 * Sidebar oscilloscope: Web Audio dual oscillators + analyser-driven canvas trace.
 * Knobs via <input-knob> (https://github.com/GoogleChromeLabs/input-knob).
 * Defaults to power off. Browsers require a user gesture to run AudioContext — the Power button provides that.
 * When on: scope runs with sound enabled by default; Mute silences speakers. Two faders set per-oscillator level.
 * Display: triggered timebase (rising-edge sync). Horizontal timebase is fixed; top knob = osc 1 pitch, bottom = osc 2 pitch.
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
const faderEl1 = document.getElementById("osc-fader-1");
const faderEl2 = document.getElementById("osc-fader-2");
const muteBtn = document.getElementById("osc-mute");
const powerBtn = document.getElementById("osc-power");

const knobFreq = document.getElementById("osc-knob-freq");
const knobTone = document.getElementById("osc-knob-tone");

if (!root || !canvas || !faderEl1 || !faderEl2 || !knobFreq || !knobTone || !muteBtn || !powerBtn) {
  throw new Error("Oscilloscope markup missing required elements");
}

const padButtons = root.querySelectorAll(".osc-btn--pad");
let currentWave1 = "sine";
let currentWave2 = "sine";

const ctx2d = canvas.getContext("2d", { alpha: false });

let audioCtx = null;
let oscillator1 = null;
let oscillator2 = null;
/** Per-oscillator output level (0–1). */
let gainOsc1 = null;
let gainOsc2 = null;
/** Master mute: 0 when muted, 1 when audible. */
let muteGain = null;
let analyser = null;
let rafId = 0;
let faderValue1 = Number(faderEl1.value) / 100;
let faderValue2 = Number(faderEl2.value) / 100;
/** When true: no output to speakers (gain 0). Scope still shows waveform after audio has started. */
let muted = false;
/** Audio engine off until Power ON (user gesture unlocks AudioContext.resume). */
let powerOn = false;

/** Seconds of signal across full graticule width (was the former time-scale knob at ~72/100). */
const SCOPE_WINDOW_SEC = (() => {
  const tNorm = 0.72;
  const minWindowSec = 0.0004;
  const maxWindowSec = 0.04;
  return minWindowSec * (maxWindowSec / minWindowSec) ** tNorm;
})();

function hzFromFreqKnob() {
  const fMin = 20;
  const fMax = 5000;
  const t =
    (Number(knobFreq.value) - Number(knobFreq.min)) / (Number(knobFreq.max) - Number(knobFreq.min));
  return fMin * (fMax / fMin) ** Math.max(0, Math.min(1, t));
}

function hzFromToneKnob() {
  const fMin = 20;
  const fMax = 5000;
  const t =
    (Number(knobTone.value) - Number(knobTone.min)) / (Number(knobTone.max) - Number(knobTone.min));
  return fMin * (fMax / fMin) ** Math.max(0, Math.min(1, t));
}

function ensureAudio() {
  if (audioCtx) return audioCtx;
  audioCtx = new AudioContext();
  oscillator1 = audioCtx.createOscillator();
  oscillator1.type = currentWave1;
  oscillator1.frequency.value = hzFromFreqKnob();
  oscillator2 = audioCtx.createOscillator();
  oscillator2.type = currentWave2;
  oscillator2.frequency.value = hzFromToneKnob();

  gainOsc1 = audioCtx.createGain();
  gainOsc1.gain.value = faderValue1;
  gainOsc2 = audioCtx.createGain();
  gainOsc2.gain.value = faderValue2;
  muteGain = audioCtx.createGain();
  muteGain.gain.value = muted ? 0 : 1;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0;

  /* Per-osc faders → mute → speakers. Analyser taps after per-osc gain so the trace matches level; mute does not affect scope. */
  oscillator1.connect(gainOsc1);
  oscillator2.connect(gainOsc2);
  gainOsc1.connect(muteGain);
  gainOsc2.connect(muteGain);
  muteGain.connect(audioCtx.destination);
  gainOsc1.connect(analyser);
  gainOsc2.connect(analyser);

  oscillator1.start();
  oscillator2.start();
  return audioCtx;
}

function syncKnobsToAudio() {
  if (!oscillator1 || !oscillator2 || !gainOsc1 || !gainOsc2 || !muteGain || !analyser || !audioCtx) return;
  oscillator1.frequency.setValueAtTime(hzFromFreqKnob(), audioCtx.currentTime);
  oscillator2.frequency.setValueAtTime(hzFromToneKnob(), audioCtx.currentTime);
  gainOsc1.gain.setValueAtTime(faderValue1, audioCtx.currentTime);
  gainOsc2.gain.setValueAtTime(faderValue2, audioCtx.currentTime);
  muteGain.gain.setValueAtTime(muted ? 0 : 1, audioCtx.currentTime);
  oscillator1.type = currentWave1;
  oscillator2.type = currentWave2;
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
  if (oscillator1) {
    try {
      oscillator1.stop();
    } catch {
      /* ignore */
    }
  }
  if (oscillator2) {
    try {
      oscillator2.stop();
    } catch {
      /* ignore */
    }
  }
  oscillator1 = null;
  oscillator2 = null;
  gainOsc1 = null;
  gainOsc2 = null;
  muteGain = null;
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

  const windowSec = SCOPE_WINDOW_SEC;
  let spanSamples = windowSec * sampleRate;
  spanSamples = Math.max(64, Math.min(spanSamples, buf.length - 2));

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
  faderEl1.value = String(Math.round(faderValue1 * 100));
  faderEl2.value = String(Math.round(faderValue2 * 100));
}

function applyPerOscGainsFromFaders() {
  if (!gainOsc1 || !gainOsc2 || !audioCtx) return;
  gainOsc1.gain.setValueAtTime(faderValue1, audioCtx.currentTime);
  gainOsc2.gain.setValueAtTime(faderValue2, audioCtx.currentTime);
}

function readFader1FromInput() {
  faderValue1 = Number(faderEl1.value) / 100;
  applyPerOscGainsFromFaders();
}

function readFader2FromInput() {
  faderValue2 = Number(faderEl2.value) / 100;
  applyPerOscGainsFromFaders();
}

faderEl1.addEventListener("input", readFader1FromInput);
faderEl2.addEventListener("input", readFader2FromInput);

function onKnobInteraction() {
  if (oscillator1) syncKnobsToAudio();
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
    if (muteGain && audioCtx) muteGain.gain.setValueAtTime(0, audioCtx.currentTime);
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
    const oscKey = btn.dataset.osc;
    if (!w || (oscKey !== "1" && oscKey !== "2")) return;
    if (oscKey === "1") {
      if (w === currentWave1) return;
      currentWave1 = w;
    } else {
      if (w === currentWave2) return;
      currentWave2 = w;
    }
    root.querySelectorAll(`.osc-btn--pad[data-osc="${oscKey}"]`).forEach((p) => {
      p.setAttribute("aria-pressed", p === btn ? "true" : "false");
    });
    if (oscillator1) syncKnobsToAudio();
  });
});

["knob-move-change", "knob-move-end"].forEach((ev) => {
  knobFreq.addEventListener(ev, onKnobInteraction);
  knobTone.addEventListener(ev, onKnobInteraction);
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
