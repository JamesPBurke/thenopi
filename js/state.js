export const DEFAULTS = {
  mode: 1,
  // Mode 1: Binaural Beats
  carrierFreq: 200, beatFreq: 6,
  binauralVol: 0.5, whiteVol: 0, pinkVol: 0.3, brownVol: 0.3,
  spatialIntensity: 0.5,
  // Mode 2: Tibetan Singing Bowls
  bowlFreq: 256, bowlStrikeInterval: 8, bowlSustain: 0.7, bowlVol: 0.7,
  bowl2Enabled: false, bowl2Ratio: 1.5,  // second bowl: Perfect Fifth above
  // Mode 4: Personal Space Audio
  psProximity: 0.12, psWarmth: 800, psMoveSpeed: 0.4, psVol: 0.65,
};

export const BUILTIN_PRESETS = {
  'deep-sleep':     { mode:1, carrierFreq:150, beatFreq:2,  binauralVol:0.65, whiteVol:0,   pinkVol:0.15, brownVol:0.55, spatialIntensity:0.2  },
  'study-focus':    { mode:1, carrierFreq:260, beatFreq:18, binauralVol:0.55, whiteVol:0.1, pinkVol:0.4,  brownVol:0.1,  spatialIntensity:0.35 },
  'anxiety-relief': { mode:1, carrierFreq:180, beatFreq:10, binauralVol:0.5,  whiteVol:0,   pinkVol:0.3,  brownVol:0.45, spatialIntensity:0.6  },
  'meditation':     { mode:1, carrierFreq:200, beatFreq:6,  binauralVol:0.6,  whiteVol:0,   pinkVol:0.2,  brownVol:0.35, spatialIntensity:0.5  },
  'heart-bowl':     { mode:2, bowlFreq:341, bowlStrikeInterval:10, bowlSustain:0.8,  bowlVol:0.7,  bowl2Enabled:false, bowl2Ratio:1.5   },
  'crown-bowl':     { mode:2, bowlFreq:256, bowlStrikeInterval:13, bowlSustain:0.9,  bowlVol:0.65, bowl2Enabled:true,  bowl2Ratio:2.0   },
  'root-harmony':   { mode:2, bowlFreq:256, bowlStrikeInterval:9,  bowlSustain:0.82, bowlVol:0.68, bowl2Enabled:true,  bowl2Ratio:1.5   },
  'cocoon':         { mode:4, psProximity:0.06, psWarmth:450, psMoveSpeed:0.15, psVol:0.75 },
  'night-presence': { mode:4, psProximity:0.18, psWarmth:1100, psMoveSpeed:0.55, psVol:0.55 },
};

export const BRAINWAVES = [
  { max: 4,  label: 'Delta', desc: 'Deep Sleep',               bg:'rgba(59,130,246,0.2)',  border:'rgba(59,130,246,0.4)',  text:'#93c5fd' },
  { max: 8,  label: 'Theta', desc: 'Meditation & Creativity',  bg:'rgba(139,92,246,0.2)',  border:'rgba(139,92,246,0.4)',  text:'#c4b5fd' },
  { max: 14, label: 'Alpha', desc: 'Relaxation & Light Focus', bg:'rgba(34,197,94,0.2)',   border:'rgba(34,197,94,0.4)',   text:'#86efac' },
  { max: 30, label: 'Beta',  desc: 'Active Concentration',     bg:'rgba(234,179,8,0.2)',   border:'rgba(234,179,8,0.4)',   text:'#fde047' },
  { max: 40, label: 'Gamma', desc: 'Peak Focus',               bg:'rgba(249,115,22,0.2)',  border:'rgba(249,115,22,0.4)',  text:'#fdba74' },
];

// Proximity mood bands for Mode 4 badge (keyed on psProximity panner X position)
export const PROXIMITY_MOODS = [
  { max: 0.10, label: 'Intimate',   desc: 'Just beyond the ear',  r:236, g:72,  b:153 },
  { max: 0.22, label: 'Present',    desc: 'Personal space',       r:168, g:85,  b:247 },
  { max: 0.40, label: 'Enveloping', desc: 'Surrounding warmth',   r:99,  g:102, b:241 },
];

// Chakra note frequencies and color channels (r,g,b) for dynamic styling
export const CHAKRAS = [
  { max: 272, label: 'Root',         note: 'C', desc: 'Grounding & stability',  r:239, g:68,  b:68  },
  { max: 304, label: 'Sacral',       note: 'D', desc: 'Creativity & flow',      r:249, g:115, b:22  },
  { max: 330, label: 'Solar Plexus', note: 'E', desc: 'Confidence & power',     r:234, g:179, b:8   },
  { max: 362, label: 'Heart',        note: 'F', desc: 'Love & compassion',      r:34,  g:197, b:94  },
  { max: 405, label: 'Throat',       note: 'G', desc: 'Communication & truth',  r:6,   g:182, b:212 },
  { max: 453, label: 'Third Eye',    note: 'A', desc: 'Intuition & vision',     r:99,  g:102, b:241 },
  { max: 600, label: 'Crown',        note: 'B', desc: 'Consciousness & spirit', r:168, g:85,  b:247 },
];

export const state = { ...DEFAULTS };

// Wrapper object so consumers can reassign the array without losing the reference
export const presetStore = { custom: [] };

export function load() {
  try {
    const s = localStorage.getItem('thenopi-state');
    if (s) Object.assign(state, JSON.parse(s));
    const p = localStorage.getItem('thenopi-presets');
    if (p) presetStore.custom = JSON.parse(p);
  } catch (e) {}
}

export function persist() {
  try {
    localStorage.setItem('thenopi-state',   JSON.stringify(state));
    localStorage.setItem('thenopi-presets', JSON.stringify(presetStore.custom));
  } catch (e) {}
}
