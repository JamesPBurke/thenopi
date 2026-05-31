import { state, presetStore, BUILTIN_PRESETS, load, persist } from './state.js';
import { eng, initAudio, togglePlay, switchMode, applyAudioState, setMediaHandlers } from './audio/core.js';
import {
  syncUI, renderLabels, renderPlayBtn, renderCustomPresets,
  setupEvents, showMode,
} from './ui.js';

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleTogglePlay() {
  const playing = togglePlay(state);
  renderPlayBtn(playing);
}

function handleSliderChange(key, value) {
  state[key] = value;
  renderLabels(state);
  applyAudioState(state);
  persist();
}

function handlePerfSelect(perf) {
  handlePresetLoad('bowl-' + perf);
}

function handleSoundscapeScale(factor) {
  ['whiteVol', 'pinkVol', 'brownVol'].forEach(key => {
    state[key] = Math.min(1, Math.max(0, state[key] * factor));
  });
  syncUI(state);
  applyAudioState(state);
  persist();
}

const MODE_VOL_KEY = { 1: 'binauralVol', 2: 'bowlVol', 4: 'psVol' };

// Always reset the active mode's volume to 15% so the user is never surprised.
function _safeVol(mode) {
  const k = MODE_VOL_KEY[mode];
  if (k) state[k] = 0.15;
}

function handleModeSwitch(newMode) {
  if (newMode === state.mode) return;
  state.mode = newMode;
  _safeVol(newMode);
  switchMode(newMode, state);
  syncUI(state);
  persist();
}

function handlePresetLoad(presetKey) {
  let patch;
  if (presetKey.startsWith('custom:')) {
    const i = parseInt(presetKey.slice(7), 10);
    const { name, ...rest } = presetStore.custom[i];
    patch = rest;
  } else {
    patch = BUILTIN_PRESETS[presetKey];
  }
  if (!patch) return;

  const newMode = patch.mode ?? state.mode;
  Object.assign(state, patch);
  state.mode = newMode;
  _safeVol(newMode);  // override whatever volume the preset carried

  syncUI(state);

  if (eng.ctx) {
    switchMode(newMode, state);
    applyAudioState(state);
  }
  persist();
}

function handlePresetSave() {
  const name = window.prompt('Name for this preset:');
  if (!name || !name.trim()) return;
  presetStore.custom.push({ name: name.trim(), ...state });
  renderCustomPresets(presetStore);
  persist();
}

function handlePresetDelete(i) {
  if (confirm('Delete preset "' + presetStore.custom[i].name + '"?')) {
    presetStore.custom.splice(i, 1);
    renderCustomPresets(presetStore);
    persist();
  }
}

function handleExport() {
  const blob = new Blob(
    [JSON.stringify({ version: 2, state, customPresets: presetStore.custom }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: 'thenopi-settings.json' });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImport(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.state) {
        Object.assign(state, data.state);
        _safeVol(state.mode);  // imported files may carry loud settings
        syncUI(state);
        if (eng.ctx) {
          switchMode(state.mode, state);
          applyAudioState(state);
        }
      }
      if (Array.isArray(data.customPresets)) {
        presetStore.custom = data.customPresets;
        renderCustomPresets(presetStore);
      }
      persist();
    } catch {
      alert('Invalid settings file.');
    }
  };
  reader.readAsText(file);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  load();
  _safeVol(state.mode);  // always start quiet, regardless of saved or default value
  syncUI(state);
  renderCustomPresets(presetStore);

  setupEvents({
    onTogglePlay:   handleTogglePlay,
    onSliderChange: handleSliderChange,
    onModeSwitch:   handleModeSwitch,
    onPresetLoad:   handlePresetLoad,
    onPresetSave:   handlePresetSave,
    onPresetDelete: handlePresetDelete,
    onExport:        handleExport,
    onImport:        handleImport,
    onPerfSelect:         handlePerfSelect,
    onSoundscapeScale:    handleSoundscapeScale,
  });

  setMediaHandlers(
    () => { if (!eng.playing) handleTogglePlay(); },
    () => { if (eng.playing)  handleTogglePlay(); },
  );

  try {
    if (!localStorage.getItem('thenopi-hp-ack')) {
      document.getElementById('headphone-modal').style.display = 'flex';
    }
  } catch {
    document.getElementById('headphone-modal').style.display = 'flex';
  }
});
