// Mode 2: Tibetan Singing Bowls
//
// Two equal, independent bowl voices. Neither is primary.
// They alternate strikes with overlap — the next bowl always enters
// while the previous is still audible, so silence is rare.
// A performance arc slowly moves through harmonic interval ratios
// (per the progression described in singbowls.md last paragraph).
//
// Key design:
//  - 600 ms exponential attack — gentle bloom, no click
//  - Decay up to ~55 s at full ring — long, soft exhale
//  - Upper partials decay slightly more gently than before for a
//    warmer, less brittle tail
//  - Overlap delay derived from sustain × pace: next bowl enters at
//    20–55 % of peak amplitude (slow pace → enter later, bowl quieter;
//    fast pace → enter earlier, both bowls louder simultaneously)
//  - Performance arc cycles through harmonic ratios; advances after
//    2–4 pairs at each position
//  - Either bowl may effectively "end first" due to random velocity
//    and the staggered timing

const HARMONICS = [
  { ratio: 1,     gainFactor: 1.0,  decayMult: 1.00 },
  { ratio: 2.756, gainFactor: 0.50, decayMult: 0.75 },
  { ratio: 5.404, gainFactor: 0.22, decayMult: 0.52 },
  { ratio: 8.933, gainFactor: 0.08, decayMult: 0.35 },
];

// Each arc is a list of interval ratios (Bowl B / Bowl A).
// Arc cycles: after 2–4 A+B pairs at one step, it advances to the next.
// Arcs follow the singbowls.md arc shape: open → complex → open.
const PERF_ARCS = {
  drift:   [1.5, 2.0, 1.5, 2.0, 1.5],
  ground:  [1.5, 1.333, 1.5, 1.333, 1.5],
  warm:    [1.5, 1.333, 1.25, 1.333, 1.25, 1.333, 1.5],
  journey: [2.0, 1.5, 1.333, 1.25, 1.125, 1.25, 1.333, 1.5, 2.0],
};

let _ctx           = null;
let _masterGain    = null;
let _bowl1BeatGain = null;
let _bowl2BeatGain = null;
let _beatLFO1      = null;
let _beatLFODepth1 = null;
let _beatLFO2      = null;
let _beatLFODepth2 = null;
let _bowl1Nodes    = [];
let _bowl2Nodes    = [];

// Scheduling state — persists across stop/start so the arc continues
let _strikeTimer = null;
let _arcIdx      = 0;
let _pairCount   = 0;   // A+B pairs completed at the current arc step
let _nextBowl    = 'A'; // which voice strikes next

export function build(ctx, state, dest) {
  _ctx = ctx;

  _masterGain = ctx.createGain();
  _masterGain.gain.value = state.bowlVol;
  _masterGain.connect(dest);

  _bowl1BeatGain = ctx.createGain();
  _bowl1BeatGain.gain.value = 1.0;
  _bowl1BeatGain.connect(_masterGain);

  _beatLFO1 = ctx.createOscillator();
  _beatLFO1.type = 'sine';
  _beatLFO1.frequency.value = 1.5 + Math.random() * 2.0;
  _beatLFODepth1 = ctx.createGain();
  _beatLFODepth1.gain.value = 0.10;
  _beatLFO1.connect(_beatLFODepth1);
  _beatLFODepth1.connect(_bowl1BeatGain.gain);
  _beatLFO1.start();

  _bowl1Nodes = _buildVoice(ctx, state.bowlFreq, _bowl1BeatGain);

  _bowl2BeatGain = ctx.createGain();
  _bowl2BeatGain.gain.value = 1.0;
  _bowl2BeatGain.connect(_masterGain);

  _beatLFO2 = ctx.createOscillator();
  _beatLFO2.type = 'sine';
  _beatLFO2.frequency.value = 1.2 + Math.random() * 1.8; // different from LFO1
  _beatLFODepth2 = ctx.createGain();
  _beatLFODepth2.gain.value = 0.10;
  _beatLFO2.connect(_beatLFODepth2);
  _beatLFODepth2.connect(_bowl2BeatGain.gain);
  _beatLFO2.start();

  _bowl2Nodes = _buildVoice(ctx, state.bowlFreq * _getCurrentRatio(state), _bowl2BeatGain);

  _arcIdx    = 0;
  _pairCount = 0;
  _nextBowl  = 'A';
}

function _buildVoice(ctx, baseFreq, destGain) {
  return HARMONICS.map(h => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.detune.value = (Math.random() - 0.5) * 4;
    osc.frequency.value = baseFreq * h.ratio;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    osc.connect(gainNode);
    gainNode.connect(destGain);
    osc.start();

    return { osc, gainNode, h };
  });
}

function _strikeVoice(nodes, state, velocity) {
  if (!_ctx) return;
  const now       = _ctx.currentTime;
  const attack    = 0.60;                        // 600 ms — gentle bloom
  const decayBase = state.bowlSustain * 275;     // up to ~275 s at full ring

  nodes.forEach(({ gainNode, h }) => {
    const peak    = h.gainFactor * 0.85 * velocity;
    const tau     = (decayBase * h.decayMult) / 5;
    const current = gainNode.gain.value;  // read before canceling

    gainNode.gain.cancelScheduledValues(now);
    // Start from current level so a re-strike never cuts the existing ring abruptly
    gainNode.gain.setValueAtTime(Math.max(current, 0.0001), now);
    gainNode.gain.exponentialRampToValueAtTime(peak, now + attack);
    // Exponential decay toward true 0 (no asymptote floor)
    gainNode.gain.setTargetAtTime(0, now + attack, tau);
    // After 6 τ the gain is ≈ 0.25 % of peak — schedule an explicit
    // linear fade so the tail dissolves gently rather than being flushed by the browser
    const tailStart = now + attack + tau * 6;
    gainNode.gain.setValueAtTime(peak * Math.exp(-6), tailStart);
    gainNode.gain.linearRampToValueAtTime(0, tailStart + Math.min(tau, 5));
  });
}

// How long (ms) from the current strike until the next bowl enters.
// pace=0 (still):    next bowl enters when current is at ~20 % of peak → long wait
// pace=1 (flowing):  next bowl enters when current is at ~55 % of peak → shorter wait
// Both values ensure overlap — neither causes silence.
// State is read at schedule time so live slider changes take effect on the next cycle.
function _overlapDelay(state) {
  const tau            = (state.bowlSustain * 275) / 5;
  const targetFraction = 0.20 + state.bowlPace * 0.35;   // 0.20–0.55
  const delay          = -tau * Math.log(targetFraction); // seconds
  const jitter         = delay * 0.18 * (Math.random() * 2 - 1);
  const minDelay       = Math.max(tau * 0.25, 3);         // proportional floor, at least 3 s
  return Math.max(delay + jitter, minDelay) * 1000;
}

function _getCurrentRatio(state) {
  const arc = PERF_ARCS[state.bowlPerformance] || PERF_ARCS.ground;
  return arc[_arcIdx % arc.length];
}

function _updateBowl2Freq(state) {
  if (!_ctx) return;
  const now   = _ctx.currentTime;
  const ratio = _getCurrentRatio(state);
  _bowl2Nodes.forEach(({ osc, h }) => {
    osc.frequency.setTargetAtTime(state.bowlFreq * ratio * h.ratio, now, 0.30);
  });
}

function _advancePair(state) {
  const stayPairs = 2 + Math.floor(Math.random() * 3); // 2–4 pairs before moving
  _pairCount++;
  if (_pairCount >= stayPairs) {
    _pairCount = 0;
    const arc = PERF_ARCS[state.bowlPerformance] || PERF_ARCS.ground;
    _arcIdx   = (_arcIdx + 1) % arc.length;
    _updateBowl2Freq(state);
  }
}

function _scheduleNext(state) {
  const delay = _overlapDelay(state);

  _strikeTimer = setTimeout(() => {
    const velocity = 0.65 + Math.random() * 0.30;

    if (_nextBowl === 'A') {
      _strikeVoice(_bowl1Nodes, state, velocity);
      _nextBowl = 'B';
    } else {
      _strikeVoice(_bowl2Nodes, state, velocity);
      _nextBowl = 'A';
      _advancePair(state); // arc advances after each A+B pair
    }

    _scheduleNext(state); // recurse; fresh state read each iteration
  }, delay);
}

export function startTimer(state) {
  if (_strikeTimer) return;
  _strikeVoice(_bowl1Nodes, state, 0.80 + Math.random() * 0.18);
  _nextBowl = 'B';
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
  [_beatLFO1, _beatLFO2].forEach(lfo => {
    if (lfo) { try { lfo.stop(); } catch(e) {} }
  });
  if (_masterGain) _masterGain.disconnect();
  _ctx           = null;
  _masterGain    = null;
  _bowl1BeatGain = null; _bowl2BeatGain = null;
  _beatLFO1      = null; _beatLFODepth1 = null;
  _beatLFO2      = null; _beatLFODepth2 = null;
  _bowl1Nodes    = [];   _bowl2Nodes    = [];
  _arcIdx        = 0;    _pairCount     = 0;    _nextBowl = 'A';
}

export function applyState(state, ctx) {
  if (!_ctx) return;
  const now = ctx.currentTime;

  if (_masterGain) _masterGain.gain.setTargetAtTime(state.bowlVol, now, 0.05);

  _bowl1Nodes.forEach(({ osc, h }) => {
    osc.frequency.setTargetAtTime(state.bowlFreq * h.ratio, now, 0.15);
  });

  // Bowl 2 tracks both the current ratio (from arc + performance choice) and bowlFreq
  _updateBowl2Freq(state);
}
