// Mode 2: Tibetan Singing Bowls
//
// Two independent bowl voices, each built from 4 inharmonic partial oscillators.
//
// Key design choices:
//  - Exponential 450ms attack — bowl "blooms" to full voice in ~half a second,
//    no percussive click at the front edge, per real mallet behaviour.
//  - Per-strike velocity randomisation (70–100%) — each hit sounds different.
//  - Recursive setTimeout with ±35% jitter, 4s floor — never metronomic;
//    interval slider sets average pace, not exact period.
//  - Bowl 2 staggered 400–1600 ms after Bowl 1 so attacks don't mask each other.
//  - Bowl 2 frequency = bowlFreq × bowl2Ratio (harmonic interval above Bowl 1).
//  - Slow AM LFO (1–4 Hz, randomised) on Bowl 2's path simulates the interference
//    beat patterns described in acoustic analyses of paired singing bowls.

const HARMONICS = [
  { ratio: 1,     gainFactor: 1.0,  decayMult: 1.00 },
  { ratio: 2.756, gainFactor: 0.55, decayMult: 0.65 },
  { ratio: 5.404, gainFactor: 0.25, decayMult: 0.40 },
  { ratio: 8.933, gainFactor: 0.10, decayMult: 0.25 },
];

let _ctx           = null;
let _masterGain    = null;
let _bowl2Gate     = null;   // GainNode: mute/unmute bowl 2 (enable toggle)
let _bowl2BeatGain = null;   // GainNode: AM target for beating LFO
let _beatLFO       = null;   // OscillatorNode: 1–4 Hz slow beat
let _beatLFODepth  = null;   // GainNode: scales LFO to ±12% AM depth
let _bowl1Nodes    = [];     // [{ osc, gainNode, h }]
let _bowl2Nodes    = [];
let _strikeTimer   = null;   // setTimeout handle

export function build(ctx, state) {
  _ctx = ctx;

  _masterGain = ctx.createGain();
  _masterGain.gain.value = state.bowlVol;
  _masterGain.connect(ctx.destination);

  _bowl1Nodes = _buildVoice(ctx, state.bowlFreq, _masterGain);

  // Bowl 2 signal chain:
  //   voice nodes → _bowl2BeatGain (AM) → _bowl2Gate (enable) → _masterGain
  _bowl2Gate = ctx.createGain();
  _bowl2Gate.gain.value = state.bowl2Enabled ? 1 : 0;
  _bowl2Gate.connect(_masterGain);

  _bowl2BeatGain = ctx.createGain();
  _bowl2BeatGain.gain.value = 1.0;
  _bowl2BeatGain.connect(_bowl2Gate);

  // 1–4 Hz AM LFO models the slow interference beats between overtone clouds
  // of two real bowls. It sits before the gate so disabling bowl 2 stays clean.
  _beatLFO = ctx.createOscillator();
  _beatLFO.type = 'sine';
  _beatLFO.frequency.value = 1 + Math.random() * 3;
  _beatLFODepth = ctx.createGain();
  _beatLFODepth.gain.value = 0.12; // ±12% AM — subtle, not tremolo
  _beatLFO.connect(_beatLFODepth);
  _beatLFODepth.connect(_bowl2BeatGain.gain);
  _beatLFO.start();

  _bowl2Nodes = _buildVoice(ctx, state.bowlFreq * state.bowl2Ratio, _bowl2BeatGain);
}

function _buildVoice(ctx, baseFreq, destGain) {
  return HARMONICS.map(h => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.detune.value = (Math.random() - 0.5) * 4; // ±2 cents shimmer
    osc.frequency.value = baseFreq * h.ratio;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    osc.connect(gainNode);
    gainNode.connect(destGain);
    osc.start();

    return { osc, gainNode, h };
  });
}

// velocity 0–1 scales peak amplitude, giving each strike a different weight
function _strikeVoice(nodes, state, velocity) {
  if (!_ctx) return;
  const now      = _ctx.currentTime;
  const attack   = 0.45;                        // 450 ms — bowl blooms to full voice
  const decayBase = state.bowlSustain * 40;     // up to 40 s ring at max sustain

  nodes.forEach(({ gainNode, h }) => {
    const peak = h.gainFactor * 0.85 * velocity;
    const tau  = (decayBase * h.decayMult) / 5;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + attack);
    gainNode.gain.setTargetAtTime(0.0001, now + attack, tau);
  });
}

function _scheduleNext(state) {
  const baseMs  = state.bowlStrikeInterval * 1000;
  const jitter  = baseMs * 0.35 * (Math.random() * 2 - 1); // ±35%
  const delay   = Math.max(baseMs + jitter, 4000);          // never < 4 s

  _strikeTimer = setTimeout(() => {
    const v1 = 0.70 + Math.random() * 0.30;
    _strikeVoice(_bowl1Nodes, state, v1);

    if (state.bowl2Enabled) {
      // Stagger so bowl 2 does not mask bowl 1's attack
      const stagger = 400 + Math.random() * 1200;
      setTimeout(() => {
        const v2 = 0.65 + Math.random() * 0.35;
        _strikeVoice(_bowl2Nodes, state, v2);
      }, stagger);
    }

    _scheduleNext(state); // recurse with a fresh random delay
  }, delay);
}

export function startTimer(state) {
  if (_strikeTimer) return;
  // Immediate strike then hand off to the jittered scheduler
  _strikeVoice(_bowl1Nodes, state, 0.80 + Math.random() * 0.20);
  _scheduleNext(state);
}

export function stopTimer() {
  if (_strikeTimer) { clearTimeout(_strikeTimer); _strikeTimer = null; }
}

export function teardown() {
  stopTimer();
  [..._bowl1Nodes, ..._bowl2Nodes].forEach(({ osc }) => {
    try { osc.stop(); } catch(e) {}
  });
  if (_beatLFO)  { try { _beatLFO.stop(); } catch(e) {} _beatLFO = null; }
  if (_masterGain) _masterGain.disconnect();
  _ctx = null;
  _masterGain = null; _bowl2Gate = null; _bowl2BeatGain = null; _beatLFODepth = null;
  _bowl1Nodes = [];   _bowl2Nodes = [];
}

export function applyState(state, ctx) {
  if (!_ctx) return;
  const now = ctx.currentTime;

  if (_masterGain) _masterGain.gain.setTargetAtTime(state.bowlVol, now, 0.05);

  // Smooth enable/disable of bowl 2 (fade rather than click)
  if (_bowl2Gate) {
    _bowl2Gate.gain.setTargetAtTime(state.bowl2Enabled ? 1 : 0, now, 0.08);
  }

  // Live frequency update for both voices
  _bowl1Nodes.forEach(({ osc, h }) => {
    osc.frequency.setTargetAtTime(state.bowlFreq * h.ratio, now, 0.15);
  });
  _bowl2Nodes.forEach(({ osc, h }) => {
    osc.frequency.setTargetAtTime(state.bowlFreq * state.bowl2Ratio * h.ratio, now, 0.15);
  });

  // The jittered scheduler always reads the current state on each iteration,
  // so strike interval / sustain / bowl2Enabled changes take effect naturally
  // at the next scheduled hit with no timer reset required.
}
