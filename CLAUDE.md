# Thenopi — Project Context for Claude

## What this is

Client-side static web app that synthesizes relaxation audio in the browser using the Web Audio API. No build step, no backend. Hosted on any static file server (GitHub Pages, Netlify, etc.).

## File structure

```
index.html              — HTML shell; loads js/main.js as an ES module
css/style.css           — All styles (extracted from original monolithic HTML)
js/
  main.js               — Entry point: boot, DOMContentLoaded, all handler callbacks
  state.js              — DEFAULTS, BUILTIN_PRESETS, BRAINWAVES, CHAKRAS constants;
                          mutable `state` object and `presetStore`; load/persist via localStorage
  ui.js                 — All DOM rendering (showMode, syncUI, renderLabels, renderChakra,
                          renderBrainwave, renderProximityMood, renderPlayBtn,
                          renderCustomPresets) + setupEvents
  audio/
    core.js             — AudioContext lifecycle, togglePlay, switchMode (teardown/build),
                          keepAlive trick, mediaSession, setMediaHandlers
    binaural.js         — Mode 1: two oscillators + ChannelMerger + HRTF noise panners + spatial LFO
    bowls.js            — Mode 2: inharmonic partials synthesis (4 oscillators), strike timer
    earclean.js         — Mode 3: all no-ops (placeholder)
    personalspace.js    — Mode 4: bilateral HRTF near-field synthesis, breath LFO, drift timer
```

## Audio mode architecture

Each mode module exports a consistent interface:

```js
build(ctx, state)          // create and connect nodes; called on init or mode switch
teardown()                 // stop oscillators, disconnect nodes, reset internal state
applyState(state, ctx)     // smooth-update live parameters (setTargetAtTime)
startTimer(state)          // start LFO/strike interval (called on play)
stopTimer()                // clear interval (called on pause or teardown)
```

`core.js` holds the active mode number in `eng.activeMode` and dispatches to the right module via `MODES = { 1: BinauralMode, 2: BowlsMode, 3: EarcleanMode }`.

Mode switch flow: `stopTimer()` → `teardown()` → `build()` → `startTimer()` (if playing). AudioContext stays alive across mode switches.

## Critical technical decisions & gotchas

**HRTF Z-axis is fixed at -1.** A circular X/Z orbit was tried and discarded — the HRTF front/back hemisphere transition creates asymmetric spectral coloration, making the return path sound like a whip. Only the X axis is swept (left-right) via the spatial LFO.

**keepAlive trick for mobile.** A silent oscillator is routed to a `MediaStreamDestination` and played via a hidden `<audio>` element. This registers the app as an active media player with the OS, preventing the AudioContext from being suspended when the screen locks.

**ES modules require a web server.** `file://` protocol won't load ES modules in most browsers. Local dev: `npx serve .` or `python3 -m http.server`. This is not a regression — the app is designed to be deployed on a static host.

**`bowlStrikeInterval` timer reset.** The `setInterval` duration is fixed at call time, so changing `bowlStrikeInterval` requires clearing and restarting the interval. `bowls.js` tracks `_lastInterval` and only resets when the value actually changes, to avoid disrupting the strike cadence on unrelated slider moves (volume, sustain, etc.).

**State is a single mutable object.** `state` in `state.js` is mutated in place everywhere. `presetStore` uses a wrapper object (`{ custom: [] }`) so the array can be reassigned without breaking imports. Do not replace `state` itself — `Object.assign` it.

**Backwards-compatible localStorage.** `Object.assign(state, JSON.parse(stored))` merges over `DEFAULTS`, so old saves missing new keys (e.g., bowl params) will silently use defaults.

## Mode 2: Tibetan Singing Bowls synthesis

Two independent bowl voices. Each has 4 inharmonic partial oscillators at these ratios (hemispherical shell vibration modes):

| Partial | Ratio  | Gain | Decay multiplier |
|---------|--------|------|-----------------|
| 1st     | 1.000  | 1.00 | 1.00            |
| 2nd     | 2.756  | 0.55 | 0.65            |
| 3rd     | 5.404  | 0.25 | 0.40            |
| 4th     | 8.933  | 0.10 | 0.25            |

Each oscillator gets ±2 cents random detune at `build()` time for shimmer.

**Strike envelope:** `exponentialRampToValueAtTime(peak, now + 0.45)` (450 ms) — bowl "blooms" to full voice in roughly half a second, per real mallet behaviour; no transient click. Followed by `setTargetAtTime(0.0001, now + 0.45, τ)` decay. `bowlSustain` (0–100%) maps to `decayBase = sustain × 40` seconds; τ = `decayBase × decayMult / 5`. At max sustain the fundamental rings to near-inaudibility in ~40 s (5τ).

**Per-strike velocity:** random 70–100% scales `peak = h.gainFactor × 0.85 × velocity`.

**Timing:** recursive `setTimeout` (not `setInterval`). Each callback computes `delay = max(baseMs + jitter, 4000)` where `jitter = baseMs × 0.35 × random(−1,1)`. Floor of 4 s matches the shortest natural silence in real relaxation playing. Slider range 5–30 s.

**Bowl 2:** frequency = `bowlFreq × bowl2Ratio`. Signal chain: voice nodes → `_bowl2BeatGain` (AM LFO target) → `_bowl2Gate` (enable/disable, 80 ms τ fade) → `_masterGain`. The gate placement after the LFO ensures disabling bowl 2 is clean regardless of LFO phase. Stagger delay (400–1600 ms after Bowl 1) is randomised per cycle. Available intervals: M3 (×1.25), P4 (×1.333), P5 (×1.5), Oct (×2.0). Default: P5.

**Bowl 2 beating LFO:** `OscillatorNode` at 1–4 Hz (randomised at `build()` time) → `_beatLFODepth` (gain 0.12) → `_bowl2BeatGain.gain`. Creates ±12% amplitude modulation that models the slow interference beats (below rhythm-threshold, ~breathing sensation) produced when paired real bowls' overtone clouds interact. The LFO frequency is fixed for the session; rebuilding on mode switch re-randomises it.

**Chakra badge** (Bowl 1): frequency bands Root C 256 / Sacral D 288 / Solar Plexus E 320 / Heart F 341 / Throat G 384 / Third Eye A 426 / Crown B 480. Slider range 100–600 Hz. Bowl 2 shows a derived chakra badge inside the interval section.

**State keys:** `bowlFreq`, `bowlStrikeInterval`, `bowlSustain`, `bowlVol`, `bowl2Enabled` (bool), `bowl2Ratio` (float).

## Mode 4: Personal Space Audio

Two HRTF PannerNodes at mirrored X positions (`±psProximity, y:0, z:-0.05`) create the sensation of something close on both sides of the head. Pink noise through two parallel paths:

- **Main path**: `lpFilter(psWarmth)` → `mixGain` (warmth control, 400–2000 Hz)
- **Shimmer path**: `bpFilter(7kHz, Q=1.5)` → `shimmerGain(0.04)` → `mixGain` (presence sensation)
- **Breath LFO**: `OscillatorNode(0.08 Hz)` → `lfoDepthGain(0.12)` → `breathGain.gain` AudioParam. This is audio-rate modulation — no setInterval needed. breathGain oscillates between 0.76–1.0.
- **Drift**: `setInterval` at 50 ms updates both panner X positions by `±0.03 * sin(phase)`. Period: 40s (speed=0) → 20s (speed=1). `_currentDrift` is tracked so `applyState` can include live drift when updating positions — prevents snapping when proximity slider moves.

**Why position-based proximity (not `refDistance`):** The spec references `refDistance` but at the fixed panner distance (~0.094 m), most of the refDistance range (0.09–0.5) clamps to gain=1 with no audible effect. The HRTF coloration from position change is far more impactful. `refDistance` is fixed at 0.5; the proximity slider moves the panner X position directly (0.05–0.4).

**State keys:** `psProximity` (0.05–0.4), `psWarmth` (400–2000 Hz), `psMoveSpeed` (0–1), `psVol` (0–1)

**Badge:** `PROXIMITY_MOODS` in `state.js` — Intimate / Present / Enveloping based on `psProximity`.

**Presets:** Cocoon (ultra-close, warm, barely drifting), Night Presence (mid-range, airier, faster drift).

## Mode 3: Binaural Ear Cleaning (planned)

ASMR-style spatial audio — ear cleaning tools (probes, brushes, air puffs) scripted via HRTF PannerNode position automation closely around the listener's head. All exports are no-ops until implementation. The module slot and UI card are already wired.

## Development stages (spec §4)

- [x] Stage 1: Core audio engine (binaural + play/pause)
- [x] Stage 2: Noise generation + HRTF spatialization
- [x] Stage 3: Styled mobile-first UI
- [x] Stage 4: Background playback (keepAlive + mediaSession)
- [x] Stage 5: State management + export/import
- [x] Alternate Audio Modes: Mode switcher, Mode 2 (Bowls), Mode 3 placeholder, Mode 4 (Personal Space)

## Preset system

Built-in presets live in `BUILTIN_PRESETS` in `state.js`. Each preset carries a `mode` key — loading a preset switches mode automatically. Custom presets save full `state` (all modes). Export format is `{ version: 2, state, customPresets }`.
