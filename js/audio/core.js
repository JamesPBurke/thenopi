import * as BinauralMode     from './binaural.js';
import * as BowlsMode        from './bowls.js';
import * as EarcleanMode     from './earclean.js';
import * as PersonalSpaceMode from './personalspace.js';

const MODES = { 1: BinauralMode, 2: BowlsMode, 3: EarcleanMode, 4: PersonalSpaceMode };

export const eng = {
  ctx: null,
  playing: false,
  activeMode: null,
};

export function initAudio(state) {
  if (eng.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) { alert('Web Audio API not supported in this browser.'); return; }
  eng.ctx = new Ctx();
  _buildMode(state);
  _keepAlive();
  _setupMediaSession();
}

function _buildMode(state) {
  MODES[state.mode].build(eng.ctx, state);
  eng.activeMode = state.mode;
}

// Teardown current mode and build a new one.
// Call this whenever state.mode has already been updated to the new value.
export function switchMode(newModeNum, state) {
  if (eng.activeMode !== null) {
    MODES[eng.activeMode].stopTimer();
    MODES[eng.activeMode].teardown();
    eng.activeMode = null;
  }
  if (eng.ctx) {
    MODES[newModeNum].build(eng.ctx, state);
    eng.activeMode = newModeNum;
    if (eng.playing) MODES[newModeNum].startTimer(state);
  }
}

export function togglePlay(state) {
  if (!eng.ctx) initAudio(state);

  if (eng.playing) {
    if (eng.activeMode !== null) MODES[eng.activeMode].stopTimer();
    eng.ctx.suspend();
    eng.playing = false;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  } else {
    eng.ctx.resume();
    if (eng.activeMode !== null) MODES[eng.activeMode].startTimer(state);
    eng.playing = true;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  }

  return eng.playing;
}

export function applyAudioState(state) {
  if (eng.activeMode !== null && eng.ctx) {
    MODES[eng.activeMode].applyState(state, eng.ctx);
  }
}

// Silent MediaStream keeps the AudioContext alive when the mobile screen locks
function _keepAlive() {
  try {
    const silGain = eng.ctx.createGain();
    silGain.gain.value = 0;
    const silOsc = eng.ctx.createOscillator();
    silOsc.connect(silGain);
    const dest = eng.ctx.createMediaStreamDestination();
    silGain.connect(dest);
    silOsc.start();
    const a = new Audio();
    a.srcObject = dest.stream;
    a.play().catch(() => {});
  } catch(e) {}
}

function _setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Thenopi — Relaxing Audio',
    artist: 'Thenopi Audio Engine',
    album: 'Thenopi',
  });
}

export function setMediaHandlers(onPlay, onPause) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play',  onPlay);
  navigator.mediaSession.setActionHandler('pause', onPause);
  navigator.mediaSession.setActionHandler('stop',  onPause);
}
