// Mode 1: Binaural Beats + Noise + 3D Spatial Audio

const NOISE_TYPES = ['white', 'pink', 'brown'];

let _ctx = null;
let _leftOsc = null, _rightOsc = null, _binauralGain = null;
let _noiseGains = {}, _noisePanners = {};
let _lfoTimer = null, _lfoPhase = 0;

export function build(ctx, state) {
  _ctx = ctx;
  _buildBinaural(state);
  _buildNoise(state);
}

function _buildBinaural(state) {
  const ctx = _ctx;
  const merger = ctx.createChannelMerger(2);
  _binauralGain = ctx.createGain();
  _binauralGain.gain.value = state.binauralVol;
  merger.connect(_binauralGain);
  _binauralGain.connect(ctx.destination);

  const lGain = ctx.createGain();
  const rGain = ctx.createGain();
  lGain.connect(merger, 0, 0);
  rGain.connect(merger, 0, 1);

  _leftOsc = ctx.createOscillator();
  _leftOsc.type = 'sine';
  _leftOsc.frequency.value = state.carrierFreq - state.beatFreq / 2;
  _leftOsc.connect(lGain);
  _leftOsc.start();

  _rightOsc = ctx.createOscillator();
  _rightOsc.type = 'sine';
  _rightOsc.frequency.value = state.carrierFreq + state.beatFreq / 2;
  _rightOsc.connect(rGain);
  _rightOsc.start();
}

function _buildNoise(state) {
  const ctx = _ctx;
  const len = Math.floor(ctx.sampleRate * 15);

  NOISE_TYPES.forEach(type => {
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    _fillNoise(buf.getChannelData(0), type);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.rolloffFactor = 0;
    panner.coneInnerAngle = 360;
    _setPos(panner, 0, 0, -1);

    const gain = ctx.createGain();
    gain.gain.value = state[type + 'Vol'];

    src.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    _noisePanners[type] = panner;
    _noiseGains[type] = gain;
  });
}

function _fillNoise(data, type) {
  const n = data.length;
  if (type === 'white') {
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === 'pink') {
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      data[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
      b6=w*0.115926;
    }
  } else {
    // Brown noise
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * w) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    }
  }
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

export function startTimer(state) {
  if (_lfoTimer) return;
  _lfoTimer = setInterval(() => {
    _lfoPhase += 0.07;
    const r = state.spatialIntensity * 4;
    const x = Math.sin(_lfoPhase) * r;
    NOISE_TYPES.forEach(t => {
      if (_noisePanners[t]) _setPos(_noisePanners[t], x, 0, -1);
    });
  }, 50);
}

export function stopTimer() {
  if (_lfoTimer) { clearInterval(_lfoTimer); _lfoTimer = null; }
}

export function teardown() {
  stopTimer();
  try { if (_leftOsc)  _leftOsc.stop();  } catch(e) {}
  try { if (_rightOsc) _rightOsc.stop(); } catch(e) {}
  if (_binauralGain) _binauralGain.disconnect();
  NOISE_TYPES.forEach(t => {
    if (_noiseGains[t])   _noiseGains[t].disconnect();
    if (_noisePanners[t]) _noisePanners[t].disconnect();
  });
  _ctx = null;
  _leftOsc = null; _rightOsc = null; _binauralGain = null;
  _noiseGains = {}; _noisePanners = {};
  _lfoPhase = 0;
}

export function applyState(state, ctx) {
  if (!_ctx) return;
  const t = ctx.currentTime;
  if (_leftOsc) {
    _leftOsc.frequency.setTargetAtTime(state.carrierFreq - state.beatFreq / 2, t, 0.05);
    _rightOsc.frequency.setTargetAtTime(state.carrierFreq + state.beatFreq / 2, t, 0.05);
  }
  if (_binauralGain) _binauralGain.gain.setTargetAtTime(state.binauralVol, t, 0.05);
  NOISE_TYPES.forEach(type => {
    if (_noiseGains[type]) _noiseGains[type].gain.setTargetAtTime(state[type + 'Vol'], t, 0.05);
  });
}
