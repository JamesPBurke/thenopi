// Mode 4: Nearfield
//
// Four independent gesture streams produce gentle sounds close to the ears.
// Each stream has its own spectral character and HRTF panner; they fire on
// randomised independent schedules so the listener never anticipates the next event.
//
// Gesture types:
//   stroke  — low-pass (~820 Hz)   — warm soft sweep tracing an arc past one ear, 3–5.5 s
//   puff    — high-pass (~2100 Hz) — brief airy burst near the ear canal, 0.35–0.8 s
//   rustle  — band-pass (~5800 Hz) — high-frequency crispness with slow drift, 3.5–7 s
//   crackle — band-pass (~5500 Hz) — very brief (3–8 ms) impulsive micro-pops
//
// 3D positioning uses expanded X/Y/Z ranges so HRTF coloration is pronounced.
// Strokes trace long arcs (change in Y and Z), giving a clear sense of movement.
// Crackle fires at ~3 /s and provides continuous micro-texture between gestures.

const TICK_MS = 20;

const GTYPES = {
  stroke: {
    filterType: 'lowpass',  filterFreq: 820,  filterQ: 0.8,
    peakGain: 0.28,
    durMin: 3.0,  durMax: 5.5,
    waitMin: 1.5, waitMax: 4.5,
  },
  puff: {
    filterType: 'highpass', filterFreq: 2100, filterQ: 1.1,
    peakGain: 0.32,
    durMin: 0.35, durMax: 0.80,
    waitMin: 1.8, waitMax: 5.5,
  },
  rustle: {
    filterType: 'bandpass', filterFreq: 5800, filterQ: 1.5,
    peakGain: 0.26,
    durMin: 3.5,  durMax: 7.0,
    waitMin: 2.0, waitMax: 6.0,
  },
  crackle: {
    filterType: 'bandpass', filterFreq: 5500, filterQ: 0.5,
    peakGain: 0.28,
    durMin: 0.003, durMax: 0.010,
    waitMin: 0.04, waitMax: 0.35,
  },
};

let _ctx        = null;
let _noiseSrc   = null;
let _masterGain = null;
let _voices     = null;
let _tickTimer  = null;

function _rand(min, max) { return min + Math.random() * (max - min); }
function _lerp(a, b, t)  { return a + (b - a) * t; }
function _smooth(t)      { return t * t * (3 - 2 * t); }

export function build(ctx, state, dest) {
  _ctx = ctx;

  _masterGain = ctx.createGain();
  _masterGain.gain.value = state.psVol;
  _masterGain.connect(dest);

  // Shared looping pink noise source
  const len = Math.floor(ctx.sampleRate * 15);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  _fillPink(buf.getChannelData(0));
  _noiseSrc = ctx.createBufferSource();
  _noiseSrc.buffer = buf;
  _noiseSrc.loop   = true;

  _voices = {};
  for (const [type, gdef] of Object.entries(GTYPES)) {
    const filter = ctx.createBiquadFilter();
    filter.type            = gdef.filterType;
    filter.frequency.value = gdef.filterFreq;
    filter.Q.value         = gdef.filterQ;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const panner = ctx.createPanner();
    panner.panningModel   = 'HRTF';
    panner.distanceModel  = 'inverse';
    panner.refDistance    = 0.5;
    panner.rolloffFactor  = 1;
    panner.coneInnerAngle = 360;
    _setPos(panner, 0, 0, -0.05);

    _noiseSrc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(_masterGain);

    _voices[type] = {
      filter, gain, panner,
      phase:    'idle',
      t:        0,
      waitLeft: _rand(0.1, gdef.waitMin),  // stagger initial starts
      duration: 0,
      startPos: { x: 0, y: 0, z: 0 },
      endPos:   { x: 0, y: 0, z: 0 },
    };
  }

  _noiseSrc.start();
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

function _smoothPos(panner, x, y, z) {
  if (panner.positionX) {
    const t = _ctx.currentTime, tau = 0.05;
    panner.positionX.setTargetAtTime(x, t, tau);
    panner.positionY.setTargetAtTime(y, t, tau);
    panner.positionZ.setTargetAtTime(z, t, tau);
  } else {
    panner.setPosition(x, y, z);
  }
}

const GAIN_KEY = { stroke: 'psStroke', puff: 'psPuff', rustle: 'psRustle', crackle: 'psCrackle' };

function _startGesture(type, voice, state) {
  const gdef = GTYPES[type];
  const now  = _ctx.currentTime;
  const peak = state[GAIN_KEY[type]] ?? gdef.peakGain;
  const dur  = _rand(gdef.durMin, gdef.durMax);
  const sign = Math.random() < 0.5 ? -1 : 1;  // left or right ear

  // Expanded position ranges for stronger HRTF coloration
  // X: well to the side; Y: meaningful vertical variation; Z: front-to-back arc
  let bx, by, bz, ex, ey, ez;

  if (type === 'stroke') {
    // Starts above-front of ear, sweeps to below-behind — maximum HRTF arc
    bx = sign * _rand(0.12, 0.20);
    by = _rand(0.06, 0.14);        // start above ear level
    bz = _rand(-0.10, -0.04);      // start slightly in front
    ex = bx + sign * _rand(-0.03, 0.03);
    ey = _rand(-0.10, -0.04);      // end below ear level
    ez = _rand(0.04, 0.10);        // end slightly behind
  } else if (type === 'puff') {
    // Stationary, close to ear canal, slight position jitter
    bx = sign * _rand(0.10, 0.16);
    by = _rand(-0.02, 0.04);
    bz = _rand(-0.06, 0.0);        // mostly in front (toward canal)
    ex = bx; ey = by; ez = bz;     // puff stays in place
  } else if (type === 'rustle') {
    // Slightly behind and above, slow drift
    bx = sign * _rand(0.14, 0.22);
    by = _rand(0.0, 0.10);
    bz = _rand(-0.04, 0.08);
    ex = bx + sign * _rand(-0.02, 0.02);
    ey = by + _rand(-0.04, 0.04);
    ez = bz + _rand(-0.04, 0.04);
  } else {
    // crackle — random near-ear position, no movement
    bx = sign * _rand(0.08, 0.18);
    by = _rand(-0.06, 0.10);
    bz = _rand(-0.08, 0.06);
    ex = bx; ey = by; ez = bz;
  }

  // Gain envelope
  const g = voice.gain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(0, now);

  if (type === 'crackle') {
    // Instantaneous attack, very fast exponential decay over the full (tiny) duration
    g.setValueAtTime(peak, now);
    g.setTargetAtTime(0, now, dur * 0.3);
  } else if (type === 'puff') {
    // 50 ms attack, exponential decay
    g.linearRampToValueAtTime(peak, now + 0.05);
    g.setTargetAtTime(0, now + 0.05, dur * 0.28);
  } else {
    // Soft ramp in to peak (40 % of duration), linear ramp out
    g.linearRampToValueAtTime(peak, now + dur * 0.40);
    g.linearRampToValueAtTime(0,    now + dur);
  }

  _setPos(voice.panner, bx, by, bz);

  voice.phase    = 'active';
  voice.t        = 0;
  voice.duration = dur;
  voice.startPos = { x: bx, y: by, z: bz };
  voice.endPos   = { x: ex, y: ey, z: ez };
}

function _tick(state) {
  if (!_ctx || !_voices) return;
  const dt = TICK_MS / 1000;
  // pace=0 → ~3× longer waits; pace=1 → ~2× shorter waits; pace=0.5 → base rates
  const paceScale = Math.pow(4, 0.5 - Math.max(0.01, state.psPace));

  for (const [type, voice] of Object.entries(_voices)) {
    const gdef = GTYPES[type];

    if (voice.phase === 'idle') {
      voice.waitLeft -= dt;
      if (voice.waitLeft <= 0) _startGesture(type, voice, state);
    } else {
      voice.t += dt / voice.duration;
      if (voice.t >= 1) {
        voice.phase    = 'idle';
        voice.waitLeft = _rand(gdef.waitMin, gdef.waitMax) * paceScale;
      } else if (type !== 'crackle') {
        // Update position for sustained gestures
        const et = _smooth(voice.t);
        _smoothPos(
          voice.panner,
          _lerp(voice.startPos.x, voice.endPos.x, et),
          _lerp(voice.startPos.y, voice.endPos.y, et),
          _lerp(voice.startPos.z, voice.endPos.z, et),
        );
      }
    }
  }
}

export function startTimer(state) {
  if (_tickTimer) return;
  _tickTimer = setInterval(() => _tick(state), TICK_MS);
}

export function stopTimer() {
  if (_tickTimer) { clearInterval(_tickTimer); _tickTimer = null; }
}

export function teardown() {
  stopTimer();
  try { if (_noiseSrc) _noiseSrc.stop(); } catch(e) {}
  if (_voices) {
    for (const v of Object.values(_voices)) {
      try { v.gain.disconnect(); } catch(e) {}
      try { v.panner.disconnect(); } catch(e) {}
    }
  }
  if (_masterGain) _masterGain.disconnect();
  _ctx = null; _noiseSrc = null; _masterGain = null; _voices = null;
}

export function applyState(state, ctx) {
  if (!_ctx) return;
  if (_masterGain) _masterGain.gain.setTargetAtTime(state.psVol, ctx.currentTime, 0.05);
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
