import { BRAINWAVES, CHAKRAS, PROXIMITY_MOODS } from './state.js';

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
  _setSlider('s-bowl-freq',     state.bowlFreq,          100, 600);
  _setSlider('s-bowl-interval', state.bowlStrikeInterval, 5,   30);
  _setSlider('s-bowl-sustain',  state.bowlSustain,        0.1, 1);
  _setSlider('s-bowl-vol',      state.bowlVol,            0,   1);
  // Mode 4 sliders
  _setSlider('s-ps-proximity',  state.psProximity,        0.05, 0.4);
  _setSlider('s-ps-warmth',     state.psWarmth,           400,  2000);
  _setSlider('s-ps-movespeed',  state.psMoveSpeed,        0,    1);
  _setSlider('s-ps-vol',        state.psVol,              0,    1);

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
    _setText('d-bowl-freq',     Math.round(state.bowlFreq) + ' Hz');
    _setText('d-bowl-interval', state.bowlStrikeInterval.toFixed(1) + ' s');
    _setText('d-bowl-sustain',  Math.round(state.bowlSustain * 100) + '%');
    _setText('d-bowl-vol',      Math.round(state.bowlVol * 100) + '%');
    renderChakra(state);
    _renderBowl2Controls(state);
  } else if (state.mode === 4) {
    _setText('d-ps-proximity',  state.psProximity.toFixed(2));
    _setText('d-ps-warmth',     Math.round(state.psWarmth) + ' Hz');
    _setText('d-ps-movespeed',  Math.round(state.psMoveSpeed * 100) + '%');
    _setText('d-ps-vol',        Math.round(state.psVol * 100) + '%');
    renderProximityMood(state);
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

function _renderBowl2Controls(state) {
  const on = state.bowl2Enabled;

  const toggleBtn = document.getElementById('bowl2-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = on ? 'On' : 'Off';
    toggleBtn.setAttribute('aria-pressed', String(on));
    toggleBtn.style.background = on
      ? 'linear-gradient(135deg,#4c1d95,#7c3aed)'
      : 'rgba(139,92,246,0.1)';
    toggleBtn.style.border = on
      ? '1px solid rgba(167,139,250,0.4)'
      : '1px solid rgba(139,92,246,0.2)';
    toggleBtn.style.color = on ? '#fff' : '#c4b5fd';
  }

  const intervalSection = document.getElementById('bowl2-interval-section');
  if (intervalSection) intervalSection.hidden = !on;

  if (!on) return;

  // Highlight the active interval button
  document.querySelectorAll('.bowl2-interval-btn').forEach(btn => {
    const match = Math.abs(parseFloat(btn.dataset.ratio) - state.bowl2Ratio) < 0.005;
    btn.style.background = match ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)';
    btn.style.border     = match ? '1px solid rgba(139,92,246,0.55)' : '1px solid rgba(255,255,255,0.1)';
    btn.style.color      = match ? '#c4b5fd' : 'rgba(255,255,255,0.5)';
  });

  // Bowl 2 derived chakra badge
  const freq2 = state.bowlFreq * state.bowl2Ratio;
  const ck2   = CHAKRAS.find(c => freq2 <= c.max) || CHAKRAS[CHAKRAS.length - 1];
  const pill2 = document.getElementById('bowl2-chakra-pill');
  if (pill2) {
    const { r, g, b } = ck2;
    pill2.textContent      = `Bowl 2: ${ck2.label} (${ck2.note}) — ${Math.round(freq2)} Hz`;
    pill2.style.background = `rgba(${r},${g},${b},0.15)`;
    pill2.style.border     = `1px solid rgba(${r},${g},${b},0.3)`;
    pill2.style.color      = `rgb(${r},${g},${b})`;
  }
}

export function renderProximityMood(state) {
  const pm   = PROXIMITY_MOODS.find(m => state.psProximity <= m.max) || PROXIMITY_MOODS[PROXIMITY_MOODS.length - 1];
  const pill = document.getElementById('ps-mood-pill');
  if (!pill) return;
  const { r, g, b } = pm;
  pill.textContent      = pm.label + ' — ' + pm.desc;
  pill.style.background = `rgba(${r},${g},${b},0.2)`;
  pill.style.border     = `1px solid rgba(${r},${g},${b},0.4)`;
  pill.style.color      = `rgb(${r},${g},${b})`;
  pill.classList.remove('badge-animate');
  void pill.offsetWidth;
  pill.classList.add('badge-animate');
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
    { id: 's-bowl-freq',     key: 'bowlFreq'           },
    { id: 's-bowl-interval', key: 'bowlStrikeInterval' },
    { id: 's-bowl-sustain',  key: 'bowlSustain'        },
    { id: 's-bowl-vol',      key: 'bowlVol'            },
    { id: 's-ps-proximity',  key: 'psProximity'        },
    { id: 's-ps-warmth',     key: 'psWarmth'           },
    { id: 's-ps-movespeed',  key: 'psMoveSpeed'        },
    { id: 's-ps-vol',        key: 'psVol'              },
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

  // Bowl 2 toggle and interval buttons (Mode 2)
  const bowl2Toggle = document.getElementById('bowl2-toggle');
  if (bowl2Toggle) bowl2Toggle.addEventListener('click', cb.onBowl2Toggle);
  document.querySelectorAll('.bowl2-interval-btn').forEach(btn => {
    btn.addEventListener('click', () => cb.onBowl2Interval(parseFloat(btn.dataset.ratio)));
  });

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
