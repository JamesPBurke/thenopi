import { BRAINWAVES, CHAKRAS } from './state.js';

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Mode display ──────────────────────────────────────────────────────────────

export function showMode(modeNum) {
  document.querySelectorAll('[data-mode-section]').forEach(el => {
    const modes = el.dataset.modeSection.split(',').map(Number);
    el.hidden = !modes.includes(modeNum);
  });
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const active = Number(btn.dataset.mode) === modeNum;
    btn.style.background  = active ? 'linear-gradient(135deg,#4c1d95,#7c3aed)' : 'transparent';
    btn.style.color       = active ? '#fff' : 'rgba(255,255,255,0.45)';
    btn.style.boxShadow   = active ? '0 0 14px rgba(124,58,237,0.35)' : 'none';
    btn.setAttribute('aria-pressed', String(active));
  });
}

// ── Play button ───────────────────────────────────────────────────────────────

export function renderPlayBtn(playing) {
  const btn   = document.getElementById('play-btn');
  const icon  = document.getElementById('play-icon');
  const label = document.getElementById('play-label');
  if (playing) {
    btn.classList.add('playing');
    icon.textContent  = '⏸';
    label.textContent = 'Playing';
  } else {
    btn.classList.remove('playing');
    icon.textContent  = '▶';
    label.textContent = 'Start';
  }
}

// ── Sliders ───────────────────────────────────────────────────────────────────

function _setSlider(id, value, min, max) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  el.style.setProperty('--fill', ((value - min) / (max - min) * 100) + '%');
}

export function fillFromSlider(el) {
  const pct = (parseFloat(el.value) - parseFloat(el.min)) / (parseFloat(el.max) - parseFloat(el.min)) * 100;
  el.style.setProperty('--fill', pct + '%');
}

// ── Full UI sync ──────────────────────────────────────────────────────────────

export function syncUI(state) {
  // Mode 1 sliders
  _setSlider('s-carrier', state.carrierFreq,     100, 500);
  _setSlider('s-beat',    state.beatFreq,          0.5, 40);
  _setSlider('s-bvol',    state.binauralVol,       0,   1);
  _setSlider('s-white',   state.whiteVol,          0,   1);
  _setSlider('s-pink',    state.pinkVol,           0,   1);
  _setSlider('s-brown',   state.brownVol,          0,   1);
  _setSlider('s-spatial', state.spatialIntensity,  0,   1);
  // Mode 2 sliders
  _setSlider('s-bowl-freq',    state.bowlFreq,    100, 600);
  _setSlider('s-bowl-sustain', state.bowlSustain, 0.1, 1);
  _setSlider('s-bowl-pace',    state.bowlPace,    0,   1);
  _setSlider('s-bowl-vol',     state.bowlVol,     0,   1);
  // Mode 4 sliders
  _setSlider('s-ps-stroke',  state.psStroke,  0, 1);
  _setSlider('s-ps-puff',    state.psPuff,    0, 1);
  _setSlider('s-ps-rustle',  state.psRustle,  0, 1);
  _setSlider('s-ps-crackle', state.psCrackle, 0, 2);
  _setSlider('s-ps-pace',     state.psPace,     0, 1);
  _setSlider('s-ps-duration', state.psDuration, 0, 1);
  _setSlider('s-ps-vol',      state.psVol,      0, 1);

  showMode(state.mode);
  renderLabels(state);
}

// ── Label rendering ───────────────────────────────────────────────────────────

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function renderLabels(state) {
  if (state.mode === 1) {
    _setText('d-carrier', Math.round(state.carrierFreq) + ' Hz');
    _setText('d-beat',    state.beatFreq.toFixed(1) + ' Hz');
    _setText('d-bvol',    Math.round(state.binauralVol * 100) + '%');
    _setText('d-white',   Math.round(state.whiteVol * 100) + '%');
    _setText('d-pink',    Math.round(state.pinkVol * 100) + '%');
    _setText('d-brown',   Math.round(state.brownVol * 100) + '%');
    _setText('d-spatial', Math.round(state.spatialIntensity * 100) + '%');
    renderBrainwave(state);
  } else if (state.mode === 2) {
    _setText('d-bowl-freq',    Math.round(state.bowlFreq) + ' Hz');
    _setText('d-bowl-sustain',      Math.round(state.bowlSustain * 100) + '%');
    _setText('d-bowl-sustain-real', _ringDuration(state.bowlSustain));
    _setText('d-bowl-pace',         _paceLabel(state.bowlPace));
    _setText('d-bowl-pace-real',    _paceDelayText(state.bowlSustain, state.bowlPace));
    _setText('d-bowl-vol',     Math.round(state.bowlVol * 100) + '%');
    renderChakra(state);
    _renderBowlPerformance(state);
  } else if (state.mode === 4) {
    _setText('d-ps-stroke',  Math.round(state.psStroke  * 100) + '%');
    _setText('d-ps-puff',    Math.round(state.psPuff    * 100) + '%');
    _setText('d-ps-rustle',  Math.round(state.psRustle  * 100) + '%');
    _setText('d-ps-crackle', Math.round(state.psCrackle * 100) + '%');
    _setText('d-ps-pace',     _paceLabel(state.psPace));
    _setText('d-ps-duration', _nearfieldDurLabel(state.psDuration));
    _setText('d-ps-vol',      Math.round(state.psVol * 100) + '%');
  }
}

export function renderBrainwave(state) {
  const bw   = BRAINWAVES.find(b => state.beatFreq <= b.max) || BRAINWAVES[BRAINWAVES.length - 1];
  const pill = document.getElementById('brainwave-pill');
  if (!pill) return;
  pill.textContent  = bw.label + ' — ' + bw.desc;
  pill.style.background = bw.bg;
  pill.style.border     = '1px solid ' + bw.border;
  pill.style.color      = bw.text;
  pill.classList.remove('badge-animate');
  void pill.offsetWidth; // force reflow to restart animation
  pill.classList.add('badge-animate');
}

function _nearfieldDurLabel(v) {
  // linear map: 0 → ~3 s, 0.5 → ~9 s, 1 → ~15 s
  return '~' + Math.round(3 + v * 12) + ' s';
}

function _intensityLabel(v) {
  if (v < 0.33) return 'Subtle';
  if (v < 0.67) return 'Present';
  return 'Strong';
}

function _paceLabel(pace) {
  if (pace < 0.25) return 'Still';
  if (pace < 0.50) return 'Calm';
  if (pace < 0.75) return 'Gentle';
  return 'Flowing';
}

function _ringDuration(sustain) {
  // audible lifespan ≈ 3 × tau, tau = (sustain × 275) / 5
  const secs = Math.round(sustain * 165);
  if (secs < 60) return '~' + secs + ' s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `~${m} min ${s} s` : `~${m} min`;
}

function _paceDelayText(sustain, pace) {
  // mirrors _overlapDelay in bowls.js
  const tau      = (sustain * 275) / 5;
  const frac     = 0.20 + pace * 0.35;
  const minDelay = Math.max(tau * 0.25, 3);
  const secs     = Math.max(Math.round(-tau * Math.log(frac)), Math.round(minDelay));
  if (secs < 60) return '~' + secs + ' s between bowls';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `~${m} min ${s} s between bowls` : `~${m} min between bowls`;
}

function _renderBowlPerformance(state) {
  document.querySelectorAll('.perf-btn').forEach(btn => {
    const match = btn.dataset.perf === state.bowlPerformance;
    btn.style.background = match ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)';
    btn.style.border     = match ? '1px solid rgba(139,92,246,0.55)' : '1px solid rgba(255,255,255,0.1)';
    btn.style.color      = match ? '#c4b5fd' : 'rgba(255,255,255,0.5)';
  });
}


export function renderChakra(state) {
  const ck   = CHAKRAS.find(c => state.bowlFreq <= c.max) || CHAKRAS[CHAKRAS.length - 1];
  const pill = document.getElementById('chakra-pill');
  if (!pill) return;
  const { r, g, b } = ck;
  pill.textContent      = ck.label + ' — ' + ck.desc;
  pill.style.background = `rgba(${r},${g},${b},0.2)`;
  pill.style.border     = `1px solid rgba(${r},${g},${b},0.4)`;
  pill.style.color      = `rgb(${r},${g},${b})`;
  pill.classList.remove('badge-animate');
  void pill.offsetWidth;
  pill.classList.add('badge-animate');
}

// ── Custom presets list ───────────────────────────────────────────────────────

export function renderCustomPresets(presetStore) {
  const list = document.getElementById('custom-list');
  if (!list) return;
  if (presetStore.custom.length === 0) {
    list.innerHTML = '<p class="text-xs italic" style="color:#4b5563;">No saved presets yet.</p>';
    return;
  }
  list.innerHTML = presetStore.custom.map((p, i) => `
    <div class="flex items-center gap-2">
      <button class="flex-1 py-2 px-3 rounded-xl text-xs font-medium text-left transition-all active:scale-95 cp-load" data-i="${i}"
        style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);color:#c4b5fd;">
        ${esc(p.name)}
      </button>
      <button class="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 cp-del" data-i="${i}"
        style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#fca5a5;" aria-label="Delete">
        ✕
      </button>
    </div>`).join('');
}

// ── Event wiring ──────────────────────────────────────────────────────────────

export function setupEvents(cb) {
  // Headphone modal
  document.getElementById('modal-dismiss').addEventListener('click', () => {
    document.getElementById('headphone-modal').style.display = 'none';
    try { localStorage.setItem('thenopi-hp-ack', '1'); } catch(e) {}
  });

  // Play button
  document.getElementById('play-btn').addEventListener('click', cb.onTogglePlay);

  // Mode switcher
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => cb.onModeSwitch(Number(btn.dataset.mode)));
  });

  // All sliders (covers both modes — hidden sliders are still wired)
  const SLIDERS = [
    { id: 's-carrier',       key: 'carrierFreq'        },
    { id: 's-beat',          key: 'beatFreq'           },
    { id: 's-bvol',          key: 'binauralVol'        },
    { id: 's-white',         key: 'whiteVol'           },
    { id: 's-pink',          key: 'pinkVol'            },
    { id: 's-brown',         key: 'brownVol'           },
    { id: 's-spatial',       key: 'spatialIntensity'   },
    { id: 's-bowl-freq',    key: 'bowlFreq'    },
    { id: 's-bowl-sustain', key: 'bowlSustain' },
    { id: 's-bowl-pace',    key: 'bowlPace'    },
    { id: 's-bowl-vol',     key: 'bowlVol'     },
    { id: 's-ps-stroke',  key: 'psStroke'  },
    { id: 's-ps-puff',    key: 'psPuff'    },
    { id: 's-ps-rustle',  key: 'psRustle'  },
    { id: 's-ps-crackle', key: 'psCrackle' },
    { id: 's-ps-pace',     key: 'psPace'     },
    { id: 's-ps-duration', key: 'psDuration' },
    { id: 's-ps-vol',      key: 'psVol'      },
  ];
  SLIDERS.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      fillFromSlider(el);
      cb.onSliderChange(key, parseFloat(el.value));
    });
  });

  // Section collapse toggles
  document.querySelectorAll('.section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      document.getElementById(btn.dataset.target).classList.toggle('open', !expanded);
    });
  });

  // Built-in preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => cb.onPresetLoad(btn.dataset.preset));
  });

  // Performance selector (Mode 2)
  document.querySelectorAll('.perf-btn').forEach(btn => {
    btn.addEventListener('click', () => cb.onPerfSelect(btn.dataset.perf));
  });

  // Soundscapes ± proportional scale buttons
  document.getElementById('soundscape-minus').addEventListener('click', () => cb.onSoundscapeScale(0.80));
  document.getElementById('soundscape-plus') .addEventListener('click', () => cb.onSoundscapeScale(1.25));

  // Save custom preset
  document.getElementById('save-preset').addEventListener('click', cb.onPresetSave);

  // Custom preset load / delete (event delegation)
  document.getElementById('custom-list').addEventListener('click', e => {
    const loadBtn = e.target.closest('.cp-load');
    const delBtn  = e.target.closest('.cp-del');
    if (loadBtn) cb.onPresetLoad('custom:' + loadBtn.dataset.i);
    if (delBtn)  cb.onPresetDelete(+delBtn.dataset.i);
  });

  // Export / import
  document.getElementById('export-btn').addEventListener('click', cb.onExport);
  document.getElementById('import-input').addEventListener('change', e => {
    if (e.target.files[0]) cb.onImport(e.target.files[0]);
    e.target.value = '';
  });
}
