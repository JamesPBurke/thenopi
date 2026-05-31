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

function handleBowl2Toggle() {
  state.bowl2Enabled = !state.bowl2Enabled;
  renderLabels(state);
  applyAudioState(state);
  persist();
}

function handleBowl2Interval(ratio) {
  state.bowl2Ratio = ratio;
  renderLabels(state);
  applyAudioState(state);
  persist();
}

function handleModeSwitch(newMode) {
  if (newMode === state.mode) return;
  state.mode = newMode;
  switchMode(newMode, state);
  showMode(newMode);
  renderLabels(state);
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
    onBowl2Toggle:   handleBowl2Toggle,
    onBowl2Interval: handleBowl2Interval,
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
