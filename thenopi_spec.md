# **Product Specification: "Thenopi" \- Browser-Based Relaxation Audio Engine**

## **1\. Executive Summary**

"Thenopi" (working title) is a client-side, static web application designed to generate customizable audio environments to aid in relaxation, sleep, focus, and meditation. It utilizes the browser's native Web Audio API to synthesize binaural beats, generate noise profiles (white, pink, brown), and simulate 3D spatial audio environments. The application prioritizes a mobile-first, elegant UI and is optimized for headphone use.

## **2\. Target Platforms & Technical Architecture**

* **Architecture:** Static Web Application (Single Page Application). No backend server required for operation.  
* **Hosting:** Can be hosted on any static file server (GitHub Pages, Netlify, Vercel, AWS S3).  
* **Core Technologies:**  
  * HTML5 / CSS3 (Recommendation: Tailwind CSS for rapid, elegant mobile-first styling).  
  * Vanilla JavaScript or a lightweight framework (e.g., React, Preact, or Vue) for state management.  
  * **Web Audio API:** For all sound synthesis, routing, and spatialization.  
  * **Media Session API:** To integrate with mobile OS lock screens and hardware media controls.  
  * **Web Storage API (localStorage):** For saving user preferences locally.

## **3\. Core Features & Functional Requirements**

### **3.1. Binaural Beats Generator**

* **Mechanism:** Two sine wave oscillators playing slightly different frequencies in the left and right ear channels.  
* **Controls:**  
  * **Carrier Frequency (Pitch):** Slider (e.g., 100Hz \- 500Hz).  
  * **Beat Frequency (Brainwave State):** Slider (0.5Hz \- 40Hz).  
    * Delta (0.5-4 Hz): Deep sleep.  
    * Theta (4-8 Hz): Meditation, creativity.  
    * Alpha (8-14 Hz): Relaxation, light focus.  
    * Beta (14-30 Hz): Active concentration, alertness.  
    * Gamma (30-40 Hz): Peak focus.  
* **Volume Control:** Independent volume slider for the binaural beats layer.

### **3.2. 3D Spatial Audio (Soundscapes)**

* **Mechanism:** Utilizing the Web Audio API's PannerNode (configured for HRTF \- Head-Related Transfer Function) to position sounds in a 3D space around the listener's head.  
* **Elements:** Synthesized ambient sounds or procedurally generated noises.  
  * *Noise Generators:* Brown noise (deep, rumbling), Pink noise (balanced), White noise (hissing).  
  * *Spatial Elements:* Slow-moving, panning oscillators or low-pass filtered noise to simulate wind or waves moving around the user.  
* **Controls:**  
  * Individual volume controls for different noise colors.  
  * Spatial depth/movement intensity slider.

### **3.3. Preset & Settings Management**

* **Built-in Presets:** Pre-configured settings for "Deep Sleep," "Study Focus," "Anxiety Relief," and "Meditation."  
* **Custom Presets:** Ability for users to save their current slider configurations to localStorage.  
* **Export/Import:**  
  * **Export:** Serialize current state to a JSON file and trigger a browser download.  
  * **Import:** File input to upload a JSON settings file and apply it to the audio engine.

### **3.4. Background Playback (Mobile Screen-Off)**

* **Challenge:** Mobile browsers aggressively throttle JavaScript and pause audio when the screen turns off.  
* **Solution Requirements:**  
  * Implementation of the **Media Session API** to register the app as an active media player (showing metadata on the lock screen).  
  * Use of a silent HTML5 \<audio\> element looped in the background. This often tricks iOS/Android into keeping the Web Audio API context alive while the screen is off.

### **3.5. User Interface (UI) & User Experience (UX)**

* **Design Language:** Dark mode default. Deep blues, purples, and soft gradients. Minimalist typography.  
* **Layout:**  
  * Large, easily tappable play/pause master button.  
  * Smooth, custom-styled sliders with large touch targets for mobile.  
  * Expandable/collapsible sections for advanced settings to avoid overwhelming the user.  
* **Headphone Requirement:** An initial modal or persistent UI hint reminding the user that headphones are required for binaural and 3D effects.

## **4\. Development Stages & Verification Criteria**

This project should be broken down into the following implementation stages:

### **Stage 1: Core Audio Engine (The Foundation)**

* **Tasks:**  
  * Initialize Web Audio API AudioContext.  
  * Build the Binaural Beat module (two oscillators, merged with a ChannelMergerNode).  
  * Implement basic play/pause logic.  
  * Connect HTML range sliders to oscillator frequency and volume parameters.  
* **Verification:**  
  * \[ \] User can hear a distinct tone in each ear when wearing headphones.  
  * \[ \] Adjusting the "Carrier" slider changes the overall pitch smoothly without audio clicking.  
  * \[ \] Adjusting the "Beat" slider changes the pulsing speed.

### **Stage 2: Noise Generation & 3D Spatialization**

* **Tasks:**  
  * Implement algorithms to generate White, Pink, and Brown noise using AudioWorklet or buffer manipulation.  
  * Implement PannerNode (set to HRTF panning model).  
  * Route a noise source through the PannerNode and automate its X coordinate using a slow LFO (Low Frequency Oscillator) to create a smooth left-right sweeping effect. **Note:** A circular X/Z orbit was originally attempted but discarded — the HRTF front/back hemisphere transition creates asymmetric spectral coloration, making one direction sound smooth and the return feel like a whip. The Z axis is held fixed at -1 (directly in front of the listener).  
* **Verification:**  
  * \[ \] Noise generators produce distinct, accurate frequency profiles (Brown is bassy, White is static).  
  * \[ \] The 3D audio element sounds like it is physically moving around the user's head when wearing headphones.

### **Stage 3: UI Implementation & Mobile Optimization**

* **Tasks:**  
  * Translate HTML controls into a styled, beautiful mobile-first interface.  
  * Implement custom sliders that are easy to drag on touch screens.  
  * Ensure layout fits within standard mobile viewport without horizontal scrolling.  
* **Verification:**  
  * \[ \] UI achieves a Google Lighthouse Accessibility and Best Practices score of 90+.  
  * \[ \] All sliders have touch targets of at least 44x44 CSS pixels.  
  * \[ \] No double-tap zoom issues on mobile devices.

### **Stage 4: Background Playback Resiliency**

* **Tasks:**  
  * Implement a hidden, looping \<audio\> element containing silence that starts on the first user interaction.  
  * Implement navigator.mediaSession.metadata to show "Thenopi \- Relaxing Audio" on the device lock screen.  
  * Bind hardware media keys (Play/Pause) to the Web Audio Context state.  
* **Verification:**  
  * \[ \] (Critical Test) Start audio on an iOS Safari device, lock the screen. Audio must continue playing for at least 15 minutes without stopping.  
  * \[ \] Lock screen shows appropriate app title and play/pause controls work.

### **Stage 5: State Management & Export**

* **Tasks:**  
  * Create a central state object representing all slider values and toggle states.  
  * Implement saving this state to localStorage on change.  
  * Implement a "Download Settings" button that creates a Blob from the JSON state and triggers a download.  
  * Implement an "Upload Settings" button to parse JSON and update the state.  
* **Verification:**  
  * \[ \] Refreshing the page retains the exact audio settings from the previous session.  
  * \[ \] Downloading produces a valid .json file.  
  * \[ \] Uploading a previously downloaded .json file instantly updates the UI and audio output.

## **5\. Future Considerations (V2)**

* **Visualizer:** A slow, pulsing WebGL or Canvas-based visualizer synced to the binaural beat frequency.  
* **Timer/Fade-out:** A sleep timer that slowly reduces the master volume to zero over a set period (e.g., 30 minutes) to prevent sudden wake-ups.  
* **Offline PWA:** Add a Service Worker and manifest.json to allow users to "Install" the static page to their home screen so it works entirely without an internet connection.