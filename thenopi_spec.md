# Product Specification: "Thenopi" — Browser-Based Relaxation Audio Engine

## 1. Executive Summary

Thenopi is a client-side static web application that generates customizable audio environments to aid in relaxation, sleep, focus, and meditation. It uses the browser's native Web Audio API to synthesize four distinct audio modes: binaural beats with 3D spatial noise, Tibetan singing bowls, a near-field personal soundscape (Nearfield), and a planned binaural ASMR ear cleaning experience. The application prioritizes a mobile-first, elegant UI and is optimized for headphone use.

## 2. Target Platforms & Technical Architecture

- **Architecture:** Static Web Application (SPA). No backend server, no build step.
- **Hosting:** Any static file server (GitHub Pages, Netlify, etc.). Local dev requires a web server — ES modules do not load over `file://`.
- **Core Technologies:** HTML5, CSS3, Tailwind CSS (CDN), Vanilla JS ES Modules, Web Audio API, Media Session API, localStorage.

### 2.1 File Structure

```
index.html                  — HTML shell + all mode UI sections
css/style.css               — All styles
js/
  main.js                   — Boot, DOMContentLoaded, all event handler callbacks
  state.js                  — DEFAULTS, BUILTIN_PRESETS, mode badge constants,
                              mutable state object, presetStore, load/persist
  ui.js                     — All DOM rendering and event wiring
  audio/
    core.js                 — AudioContext lifecycle, outputGain, mode switching,
                              keepAlive, mediaSession, togglePlay (with fade)
    binaural.js             — Mode 1 audio engine
    bowls.js                — Mode 2 audio engine
    earclean.js             — Mode 3 placeholder (all no-ops)
    personalspace.js        — Mode 4 audio engine (Nearfield)
```

### 2.2 Audio Mode Architecture

All mode modules export an identical interface dispatched by `core.js`:

```js
build(ctx, state, dest)  // create nodes; connect to dest (NOT ctx.destination directly)
teardown()               // stop sources, disconnect nodes, reset module state
applyState(state, ctx)   // smooth live parameter updates (setTargetAtTime)
startTimer(state)        // start LFOs / schedulers (called on play)
stopTimer()              // clear timers (called on pause or before teardown)
```

Mode switch flow: `stopTimer()` → `teardown()` → `build()` → `startTimer()` (if playing). The `AudioContext` stays alive across all mode switches.

### 2.3 Global Output Gain & Fade

A single `outputGain` GainNode (`eng.outputGain`) sits between all modes and `ctx.destination`. All mode `build()` functions accept `dest` as their third parameter and connect to it rather than `ctx.destination`.

- **Stop:** 1-second linear ramp of `outputGain` to 0, then `ctx.suspend()` at 1.1 s.
- **Resume during fade:** cancels the ramp, ramps back to 1 over 150 ms.

### 2.4 Volume Safety

`_safeVol(mode)` in `main.js` resets the active mode's volume state key to 0.15. Called at every entry point where settings change hands: page load, mode switch, preset load, and settings import. The user is never surprised by loud audio; they always bring volume up from 15%.

## 3. Audio Modes

### 3.1 Mode 1: Binaural Beats + Soundscapes ✅

**Binaural Beats:** Two sine oscillators at slightly different frequencies routed to L/R channels via `ChannelMergerNode`. A brainwave badge (Delta/Theta/Alpha/Beta/Gamma) updates with beat frequency.
- Controls: Carrier Frequency (100–500 Hz), Beat Frequency (0.5–40 Hz), Volume.

**Soundscapes:** White, pink, and brown noise buffers, each through an HRTF `PannerNode`. A spatial LFO sweeps X position. Z axis fixed at −1 (circular X/Z orbit discarded — HRTF front/back hemisphere transition creates an audible asymmetry on the return pass).
- Controls: Individual volume for white/pink/brown noise, 3D Movement Intensity.
- **Proportional ± buttons** at the top of the Soundscapes section scale all three noise volumes together by ×0.80 (−) or ×1.25 (+) per click, maintaining their relative balance.

**Built-in Presets:** Deep Sleep, Study Focus, Anxiety Relief, Meditation.

### 3.2 Mode 2: Tibetan Singing Bowls ✅ (redesigned)

Two equal, always-present bowl voices. Neither is primary; neither can be disabled. Both always play together, overlapping, with silence rare by design.

**Signal chain per voice:** 4 inharmonic oscillators (ratios 1×, 2.756×, 5.404×, 8.933×) → individual GainNodes → per-voice beat GainNode (AM LFO 1–4 Hz, ±10%) → masterGain → outputGain.

**Envelope:**
- Attack: 600 ms exponential bloom.
- Decay: `setTargetAtTime(0, ...)` true exponential toward zero.
- Tail: explicit `setValueAtTime` + `linearRampToValueAtTime(0, ...)` at 6τ prevents browser denormal flush from sounding abrupt.
- Re-strike blend: reads `gainNode.gain.value` before `cancelScheduledValues` so a new attack blooms from the current level, not from near-zero.
- Max ring: ~275 s at full Ring slider (τ_fundamental = sustain × 55 s).

**Scheduler:**
- Alternates A → B → A → B. Next bowl enters while previous is still audible.
- Overlap delay: `−τ × ln(0.20 + pace × 0.35)`, floor = max(τ × 0.25, 3 s).
- Performance arc advances after 2–4 A+B pairs per harmonic step.

**Performance arcs (PERF_ARCS):**
| Arc | Ratios | Character |
|---|---|---|
| drift | 1.5, 2.0 alternating | Open space & sleep, very slow |
| ground | 1.5, 1.333 alternating | Stable & settled |
| warm | 1.5 → 1.333 → 1.25 → back | Held & soothed |
| journey | 2.0 → 1.5 → 1.333 → 1.25 → 1.125 → back | Full arc meditation |

**UX:** "Choose an experience" selector (Drift / Ground / Warm / Journey). Each button loads a complete preset (frequency + ring + pace + vol + arc). No separate bowl presets in the global Presets section.

**UI labels:** Ring slider shows real-world duration ("~58 s"). Pace slider shows word label (Still/Calm/Gentle/Flowing) + "~X s between bowls".

**State params:** `bowlFreq`, `bowlSustain`, `bowlPace`, `bowlPerformance`, `bowlVol`

**Built-in Presets:** bowl-drift (174 Hz), bowl-ground (256 Hz), bowl-warm (341 Hz), bowl-journey (256 Hz).

### 3.3 Mode 3: Binaural Ear Cleaning ⏳ Placeholder

ASMR-style spatial audio simulating ear cleaning tools via scripted HRTF PannerNode automation. Blocked on audio asset sourcing. Module slot, UI card, and mode button are wired — all exports are no-ops. See §6.1.

### 3.4 Mode 4: Nearfield ✅ (redesigned)

Renamed from "Personal Space." Button: 🫧 Nearfield. Inspired by near-ear sensation (stroking, puffing, rustling near the ears) but not a medical ear-care simulation — a separate Ear Care mode may be added in future.

**Architecture:** Four independent gesture streams, each: `noiseSrc → filter → gain → HRTF panner → masterGain`. A single looping pink noise buffer (15 s) feeds all four filters.

**Gesture types:**

| Type | Filter | Default gain | Duration | Wait between |
|---|---|---|---|---|
| stroke | LPF 820 Hz, Q=0.8 | psStroke = 0.28 | 3–5.5 s | 1.5–4.5 s |
| puff | HPF 2100 Hz, Q=1.1 | psPuff = 0.32 | 0.35–0.8 s | 1.8–5.5 s |
| rustle | BPF 5800 Hz, Q=1.5 | psRustle = 0.26 | 3.5–7 s | 2–6 s |
| crackle | BPF 5500 Hz, Q=0.5 | psCrackle = 1.40 | 3–10 ms | 0.04–0.35 s |

Crackle is the primary texture. The crackle gain slider max is 2.0 (not 1.0) to accommodate boosted gain.

**Envelopes:**
- stroke/rustle: linear ramp to peak at 40% of duration, linear ramp to 0 at end.
- puff: 50 ms attack, `setTargetAtTime(0, ...)` exponential decay.
- crackle: instantaneous onset, `setTargetAtTime(0, ...)` very fast decay.

**3D Positioning** (expanded for strong HRTF coloration):
- Gesture chooses left or right ear randomly each time (sign = ±1).
- Stroke: sweeps from above-front (Y+, Z-) to below-behind (Y-, Z+) of one ear — maximum HRTF arc.
- Rustle: furthest lateral (X 0.14–0.22) for clearest HRTF coloration.
- Position updates via `setTargetAtTime` on positionX/Y/Z AudioParams (τ = 0.05 s) for smooth motion.

**Pace formula:** `waitLeft = rand(min, max) × Math.pow(4, 0.5 − pace)`
- pace=0: ~2× longer waits; pace=0.5: base rate; pace=1: ~2× shorter.

**State params:** `psStroke`, `psPuff`, `psRustle`, `psCrackle`, `psPace`, `psVol`

**Built-in Presets:** cocoon (subtle, slow), night-presence (more active).

## 4. Shared Features

### 4.1 Mode Switcher

Four-button pill switcher: 🎵 Binaural / 🔔 Bowls / 👂 ASMR / 🫧 Nearfield. Switching tears down current audio graph, builds the new one, restarts timers — AudioContext stays alive. Volume is reset to 15% on every switch.

### 4.2 Preset & Settings Management ✅

- **Built-in Presets:** 10 total — 4 binaural, 4 bowls, 2 nearfield. Bowls presets are also the 4 experience buttons; they do not appear separately in the Presets section.
- **Custom Presets:** Save full state to localStorage, named by user. Load or delete individually.
- **Export/Import:** JSON download/upload (`{ version: 2, state, customPresets }`). Volume safety applied on import.
- **Auto-persist:** Every slider change and preset load writes to localStorage.

### 4.3 Background Playback ✅

Silent oscillator → MediaStreamDestination → hidden `<audio>` keeps AudioContext alive on screen lock. `mediaSession` metadata + hardware key bindings.

### 4.4 User Interface ✅

- Dark mode. Deep blues and purples. Minimalist typography.
- Custom range sliders with fill-track CSS custom property.
- Expandable/collapsible section cards.
- Mode-specific badge (brainwave / chakra note) with fade-in animation.
- Headphone reminder modal on first visit.

## 5. Development Stages

### Stages 1–6: Complete ✅

Core audio engine, noise generation, 3D spatialization, mobile UI, background playback, state management, export/import, Mode 2 (bowls), Mode 4 (Nearfield), global fade system, volume safety, Soundscapes proportional ± controls.

## 6. Remaining Work

### 6.1 Mode 3 — Asset Sourcing

Blocked on permissively-licensed binaural-ready audio samples. Options: CC0 from Freesound.org or original in-ear binaural recordings (e.g., Roland CS-10EM). Once assets are sourced, implementation follows `AudioBufferSourceNode → HRTF PannerNode → scripted position automation`.

### 6.2 Visualizer

Slow, pulsing Canvas/WebGL visualizer synced to active mode's primary frequency.

### 6.3 Sleep Timer

Configurable fade-out timer (15/30/60 min) using `AudioParam.linearRampToValueAtTime`.

### 6.4 PWA / Offline Support

Service Worker + `manifest.json` for home-screen install and fully offline playback.

### 6.5 Ear Care Mode

A dedicated Mode 4 replacement or addition that more directly simulates ear cleaning/massage using scripted HRTF gestures. Nearfield (current Mode 4) is the precursor.

### 6.6 Lighthouse Audit & Device Testing

Formal verification on real iOS/Android: audio continuity with screen locked, lock screen controls, accessibility score ≥ 90.
