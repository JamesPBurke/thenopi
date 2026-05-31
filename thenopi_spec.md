# **Product Specification: "Thenopi" \- Browser-Based Relaxation Audio Engine**

## **1\. Executive Summary**

"Thenopi" is a client-side, static web application that generates customizable audio environments to aid in relaxation, sleep, focus, and meditation. It uses the browser's native Web Audio API to synthesize four distinct audio modes: binaural beats with 3D spatial noise, Tibetan singing bowls, a near-field personal space soundscape, and (planned) a binaural ASMR ear cleaning experience. The application prioritizes a mobile-first, elegant UI and is optimized for headphone use.

## **2\. Target Platforms & Technical Architecture**

* **Architecture:** Static Web Application (Single Page Application). No backend server, no build step required.
* **Hosting:** Any static file server (GitHub Pages, Netlify, Vercel, AWS S3). **Local development requires a web server** (`npx serve .` or `python3 -m http.server`) — ES modules do not load over `file://`.
* **Core Technologies:**
  * HTML5 / CSS3 with Tailwind CSS (CDN).
  * **Vanilla JavaScript ES Modules** — multi-file, no bundler. Entry point: `js/main.js` loaded as `<script type="module">`.
  * **Web Audio API:** All sound synthesis, routing, and spatialization.
  * **Media Session API:** Mobile OS lock screen integration and hardware media controls.
  * **Web Storage API (localStorage):** Persistent user preferences.

### **2.1 File Structure**

```
index.html                  — HTML shell + all mode UI sections
css/style.css               — All styles
js/
  main.js                   — Boot, DOMContentLoaded, all event handler callbacks
  state.js                  — DEFAULTS, BUILTIN_PRESETS, mode badge constants,
                              mutable state object, presetStore, load/persist
  ui.js                     — All DOM rendering and event wiring
  audio/
    core.js                 — AudioContext lifecycle, mode switching, keepAlive,
                              mediaSession, togglePlay
    binaural.js             — Mode 1 audio engine
    bowls.js                — Mode 2 audio engine
    earclean.js             — Mode 3 audio engine (placeholder, all no-ops)
    personalspace.js        — Mode 4 audio engine
```

### **2.2 Audio Mode Architecture**

All mode modules export an identical interface, dispatched by `core.js`:

```js
build(ctx, state)      // create and connect Web Audio nodes
teardown()             // stop sources, disconnect nodes, reset module state
applyState(state, ctx) // smooth live parameter updates (setTargetAtTime)
startTimer(state)      // start LFOs / strike timers (called on play)
stopTimer()            // clear timers (called on pause or before teardown)
```

Mode switch flow: `stopTimer()` → `teardown()` → `build()` → `startTimer()` (if playing). The `AudioContext` stays alive across all mode switches. Loading a preset that belongs to a different mode triggers an automatic mode switch.

## **3\. Audio Modes**

### **3.1 Mode 1: Binaural Beats + Soundscapes** ✅ Implemented

* **Binaural Beats:** Two sine wave oscillators at slightly different frequencies routed to left and right channels via `ChannelMergerNode`. A brainwave-state badge (Delta / Theta / Alpha / Beta / Gamma) updates as the beat frequency changes.
  * *Controls:* Carrier Frequency (100–500 Hz), Beat Frequency (0.5–40 Hz), Volume.
* **Soundscapes:** White, pink, and brown noise generated via buffer manipulation, each routed through an HRTF `PannerNode`. A spatial LFO sweeps the X position to simulate sound orbiting the head.
  * *Note:* Z axis is held fixed at −1 (directly in front). A circular X/Z orbit was tried and discarded — the HRTF front/back hemisphere transition creates asymmetric spectral coloration that sounds like a whip on the return pass.
  * *Controls:* Individual volume for white/pink/brown noise, 3D Movement Intensity.
* **Built-in Presets:** Deep Sleep, Study Focus, Anxiety Relief, Meditation.

### **3.2 Mode 2: Tibetan Singing Bowls** ✅ Implemented

Fully synthesized. Four oscillators at inharmonic frequency ratios derived from hemispherical shell vibration modes (Bessel function zeros): 1×, 2.756×, 5.404×, 8.933× the fundamental. Each partial has a micro-detune (±2 cents random) for shimmer, and a distinct exponential decay rate — higher partials fade faster, reproducing the signature of a real struck bowl.

* **Strike envelope:** 15 ms linear attack → `setTargetAtTime` exponential decay. `bowlSustain` (0–100%) maps to a 1.2–12 s audible decay window.
* **Badge:** Chakra label (Root C / Sacral D / Solar Plexus E / Heart F / Throat G / Third Eye A / Crown B) updates with bowl frequency.
* **Controls:** Bowl Frequency (100–600 Hz), Strike Every (2–20 s), Sustain, Volume.
* **Built-in Presets:** Heart Bowl (341 Hz / F), Crown Bowl (480 Hz / B).

### **3.3 Mode 3: Simulated Binaural Ear Cleaning** ⏳ Placeholder

ASMR-style spatial audio simulating ear cleaning tools (ear picks, cotton swabs, brushes, air puffs) moving closely around the listener's head via scripted HRTF `PannerNode` position automation.

* **Status: Blocked on audio asset sourcing.** Pure Web Audio synthesis cannot produce the organic, granular textures that trigger the ASMR response. This mode requires either permissively-licensed binaural-ready samples (e.g., CC0 assets from Freesound.org) or original recordings made with in-ear binaural microphones (e.g., Roland CS-10EM). The implementation architecture once assets are sourced is `AudioBufferSourceNode` → HRTF `PannerNode` → scripted position automation, identical to Mode 4's spatial approach.
* The module slot (`js/audio/earclean.js`), UI card, and mode button are already wired — all exports are no-ops until implementation begins.

### **3.4 Mode 4: Personal Space Audio** ✅ Implemented

Synthesized near-field spatial audio designed to create the sensation of intimate, close-proximity sound positioned just outside the listener's ears.

* **Signal chain:** Pink noise → two parallel paths (low-pass warmth filter + narrow bandpass shimmer at 7 kHz) → mix → breath gain → two HRTF `PannerNode`s at mirrored positions (`±psProximity, y:0, z:−0.05`).
* **Breath LFO:** `OscillatorNode` at 0.08 Hz (≈12 s period) connected directly to a `GainNode.gain` AudioParam — audio-rate modulation, no `setInterval`. Gain oscillates 0.76–1.0 for a subtle breathing quality.
* **Drift:** A 50 ms `setInterval` oscillates both panner X positions by ±0.03 units over a 20–40 s period (controlled by Movement Speed). `_currentDrift` is tracked module-internally so position updates from the slider don't snap the drift to zero.
* **Proximity control:** Maps to the panner X position (0.05–0.4), not `refDistance`. At the panner's fixed distance, most of the `refDistance` range clamps gain to 1.0 with no audible effect; the HRTF coloration from position change is the meaningful variable. `refDistance` is fixed at 0.5.
* **Badge:** Intimate / Present / Enveloping based on proximity value.
* **Controls:** Proximity (Very Close → Wider), Warmth (400–2000 Hz low-pass), Drift Speed, Volume.
* **Built-in Presets:** Cocoon (ultra-close, warm, barely drifting), Night Presence (mid-range, airier, faster drift).

## **4\. Shared Features**

### **4.1 Mode Switcher**

Four-button pill switcher (🎵 Binaural / 🔔 Bowls / 👂 ASMR / 🫧 Presence) above the section cards. Switching modes tears down the current audio graph, builds the new one, and restarts timers — all without destroying the `AudioContext`. Mode 3 shows a Coming Soon card with no active audio.

### **4.2 Preset & Settings Management** ✅ Implemented

* **Built-in Presets:** 8 total across all modes (4 binaural, 2 bowls, 2 personal space), grouped by mode in the Presets section. Loading a preset from a different mode switches automatically.
* **Custom Presets:** Save full application state (all mode parameters + current mode) to `localStorage`, named by the user via prompt. Load or delete individually.
* **Export/Import:** Serialize state to `{ version: 2, state, customPresets }` JSON and trigger a browser download. Import parses the file and applies immediately.
* **Auto-persist:** Every slider change and preset load writes to `localStorage`. Settings are restored on next visit. Adding new state keys is backwards-compatible — old saves missing new keys fall back to `DEFAULTS`.

### **4.3 Background Playback (Mobile Screen-Off)** ✅ Implemented

* A silent oscillator is routed to a `MediaStreamDestination` and played via a hidden `<audio>` element on first user interaction. This registers Thenopi as an active media player with the OS, preventing `AudioContext` suspension when the screen locks.
* `navigator.mediaSession.metadata` displays app name on the device lock screen. Hardware play/pause/stop keys are bound.

### **4.4 User Interface** ✅ Implemented

* Dark mode. Deep blues, purples, and soft gradients. Minimalist typography.
* Custom `<input type="range">` sliders with 24px touch targets and fill-track via CSS custom property.
* Expandable/collapsible section cards (animated height transition).
* Mode-specific badge (brainwave state / chakra note / proximity mood) with fade-in animation on change.
* Headphone reminder modal on first visit (dismissed state saved to `localStorage`).

## **5\. Development Stages**

### **Stage 1: Core Audio Engine** ✅ Complete

Binaural beat oscillators, `ChannelMergerNode`, play/pause logic, slider-to-AudioParam wiring.

### **Stage 2: Noise Generation & 3D Spatialization** ✅ Complete

White/pink/brown noise via buffer generation. HRTF `PannerNode` with X-axis LFO sweep. Z-axis fixed at −1 (circular orbit discarded — see §3.1 note).

### **Stage 3: UI Implementation & Mobile Optimization** ✅ Complete

Full styled mobile-first UI. Custom sliders. Expandable sections. Mode switcher. All content fits standard mobile viewport.

*Verification items pending formal audit:*
* \[ \] Google Lighthouse Accessibility / Best Practices score ≥ 90.
* \[ \] Touch targets verified at ≥ 44×44 CSS px on device.
* \[ \] No double-tap zoom on mobile.

### **Stage 4: Background Playback Resiliency** ✅ Complete

Silent `MediaStream` keep-alive, `mediaSession` metadata, hardware key bindings.

*Verification items pending live device test:*
* \[ \] (Critical) iOS Safari: audio continues for ≥15 minutes with screen locked.
* \[ \] Lock screen shows app title and play/pause controls function.

### **Stage 5: State Management & Export** ✅ Complete

`localStorage` auto-persist on every change. JSON export (download) and import (file input). Settings restored on page reload. Custom presets with name, save, load, and delete.

### **Stage 6: Alternate Audio Modes** ✅ Largely Complete

* \[x\] Mode switcher UI (teardown/build on switch, AudioContext preserved).
* \[x\] Mode 2: Tibetan Singing Bowls (fully synthesized).
* \[x\] Mode 4: Personal Space Audio (fully synthesized).
* \[ \] Mode 3: Binaural Ear Cleaning (architecture wired; blocked on asset sourcing — see §3.3).

## **6\. Remaining Work**

### **6.1 Mode 3 — Asset Sourcing**

The only blocker for Mode 3 completion is sourcing or creating permissively-licensed binaural-ready audio samples. Options:

1. **CC0 samples** from Freesound.org, searched for binaural ear cleaning ASMR recordings.
2. **Original recordings** using in-ear binaural microphones (e.g., Roland CS-10EM). This produces the highest quality result.

Once assets are available, implementation follows the same `AudioBufferSourceNode` → HRTF `PannerNode` → scripted position automation pattern already established by Mode 4.

### **6.2 Visualizer**

A slow, pulsing Canvas or WebGL visualizer synced to the active mode's primary frequency (binaural beat frequency in Mode 1; bowl frequency in Mode 2; breath LFO rate in Mode 4).

### **6.3 Sleep Timer / Fade-Out**

A configurable timer (e.g., 15, 30, 60 minutes) that ramps master volume to zero using `AudioParam.linearRampToValueAtTime`, then pauses playback. Prevents abrupt audio cutoff mid-sleep.

### **6.4 PWA / Offline Support**

A `Service Worker` + `manifest.json` to allow home-screen installation and fully offline playback. Low implementation cost given the app is already entirely static with no external runtime dependencies.

### **6.5 Lighthouse Audit & Mobile Device Testing**

Formal verification of Stage 3 and Stage 4 criteria on real iOS and Android devices (see §5 open checkboxes).
