// Mode 4: Personal Space Audio
//
// Two HRTF PannerNodes placed at mirrored near-field positions create the
// sensation of intimate close-proximity audio. The effect is driven by HRTF
// coloration (position-based), not by gain rolloff — refDistance is fixed at
// 0.5 so gain stays at 1 throughout the proximity slider range.
//
// Signal chain (mono noise → bilateral HRTF):
//
//   noiseSrc ─┬─→ lpFilter(warmth) ──────┬→ mixGain → breathGain ─→ leftPanner  → masterGain
//             └─→ bpFilter(7kHz) → shimmer┘                        → rightPanner → masterGain

const BASE_Z    = -0.05;  // fixed depth (slightly in front of listener)
const DRIFT_AMP = 0.03;   // X position oscillation amplitude (±0.03 units)
const BREATH_RATE_HZ = 0.08; // ~12s breath period (not user-controlled)
const BREATH_DEPTH   = 0.12; // gain modulation depth (breathGain oscillates 0.76–1.0)

let _ctx         = null;
let _noiseSrc    = null;
let _lfoOsc      = null;
let _masterGain  = null;
let _lpFilter    = null;
let _leftPanner  = null;
let _rightPanner = null;
let _driftTimer  = null;
let _driftPhase  = 0;
let _currentDrift = 0;  // tracked so applyState can include live drift in position

export function build(ctx, state) {
  _ctx = ctx;

  // ── Master output ─────────────────────────────────────────────────────────
  _masterGain = ctx.createGain();
  _masterGain.gain.value = state.psVol;
  _masterGain.connect(ctx.destination);

  // ── Noise source (pink) ───────────────────────────────────────────────────
  const len = Math.floor(ctx.sampleRate * 15);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  _fillPink(buf.getChannelData(0));
  _noiseSrc = ctx.createBufferSource();
  _noiseSrc.buffer = buf;
  _noiseSrc.loop = true;

  // ── Warmth: low-pass filter ───────────────────────────────────────────────
  _lpFilter = ctx.createBiquadFilter();
  _lpFilter.type = 'lowpass';
  _lpFilter.frequency.value = state.psWarmth;
  _lpFilter.Q.value = 0.7;

  // ── Shimmer: narrow bandpass at ~7kHz, very low gain (parallel path) ──────
  const bpFilter = ctx.createBiquadFilter();
  bpFilter.type = 'bandpass';
  bpFilter.frequency.value = 7000;
  bpFilter.Q.value = 1.5;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.04;

  // ── Mix: main + shimmer ───────────────────────────────────────────────────
  const mixGain = ctx.createGain();
  mixGain.gain.value = 1;

  // ── Breath LFO: audio-rate amplitude modulation via AudioParam ────────────
  // breathGain.gain oscillates: base(0.88) ± depth(0.12) → range [0.76, 1.0]
  const breathGain = ctx.createGain();
  breathGain.gain.value = 1 - BREATH_DEPTH;

  _lfoOsc = ctx.createOscillator();
  _lfoOsc.type = 'sine';
  _lfoOsc.frequency.value = BREATH_RATE_HZ;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = BREATH_DEPTH;
  _lfoOsc.connect(lfoDepth);
  lfoDepth.connect(breathGain.gain); // modulate the GainNode's AudioParam
  _lfoOsc.start();

  // ── Wire signal chain ─────────────────────────────────────────────────────
  _noiseSrc.connect(_lpFilter);
  _lpFilter.connect(mixGain);
  _noiseSrc.connect(bpFilter);
  bpFilter.connect(shimmerGain);
  shimmerGain.connect(mixGain);
  mixGain.connect(breathGain);

  // ── Bilateral HRTF panners (mirrored X, fixed Z) ─────────────────────────
  _leftPanner  = _makePanner(ctx, -state.psProximity, 0, BASE_Z);
  _rightPanner = _makePanner(ctx,  state.psProximity, 0, BASE_Z);
  breathGain.connect(_leftPanner);
  breathGain.connect(_rightPanner);
  _leftPanner.connect(_masterGain);
  _rightPanner.connect(_masterGain);

  _noiseSrc.start();
}

function _makePanner(ctx, x, y, z) {
  const p = ctx.createPanner();
  p.panningModel   = 'HRTF';
  p.distanceModel  = 'inverse';
  p.refDistance    = 0.5;   // source is always within this, so gain = 1.0
  p.rolloffFactor  = 1;
  p.coneInnerAngle = 360;
  _setPos(p, x, y, z);
  return p;
}

function _setPos(panner, x, y, z) {
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else {
    panner.setPosition(x, y, z);
  }
}

function _fillPink(data) {
  const n = data.length;
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
    b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
    b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
    data[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
    b6=w*0.115926;
  }
}

export function startTimer(state) {
  if (_driftTimer) return;
  _driftTimer = setInterval(() => {
    // psMoveSpeed (0–1) → period (40s → 20s): slower slider = longer drift cycle
    const period = 40 - state.psMoveSpeed * 20;
    _driftPhase += (2 * Math.PI * 0.05) / period; // 0.05 s per 50 ms tick
    _currentDrift = Math.sin(_driftPhase) * DRIFT_AMP;
    if (_leftPanner)  _setPos(_leftPanner,  -(state.psProximity + _currentDrift), 0, BASE_Z);
    if (_rightPanner) _setPos(_rightPanner,   state.psProximity + _currentDrift,  0, BASE_Z);
  }, 50);
}

export function stopTimer() {
  if (_driftTimer) { clearInterval(_driftTimer); _driftTimer = null; }
}

export function teardown() {
  stopTimer();
  try { if (_noiseSrc) _noiseSrc.stop(); } catch(e) {}
  try { if (_lfoOsc)   _lfoOsc.stop();   } catch(e) {}
  if (_masterGain)  _masterGain.disconnect();
  if (_leftPanner)  _leftPanner.disconnect();
  if (_rightPanner) _rightPanner.disconnect();
  _ctx = null;
  _noiseSrc = null; _lfoOsc = null;
  _masterGain = null; _lpFilter = null;
  _leftPanner = null; _rightPanner = null;
  _driftPhase = 0; _currentDrift = 0;
}

export function applyState(state, ctx) {
  if (!_ctx) return;
  const now = ctx.currentTime;
  if (_masterGain) _masterGain.gain.setTargetAtTime(state.psVol, now, 0.05);
  if (_lpFilter)   _lpFilter.frequency.setTargetAtTime(state.psWarmth, now, 0.1);
  // Include live drift so position doesn't snap when proximity slider moves
  if (_leftPanner) {
    _setPos(_leftPanner,  -(state.psProximity + _currentDrift), 0, BASE_Z);
    _setPos(_rightPanner,   state.psProximity + _currentDrift,  0, BASE_Z);
  }
  // psMoveSpeed is read on each drift tick — no timer reset needed
}
