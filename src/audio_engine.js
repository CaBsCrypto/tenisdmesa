/**
 * Audio Engine for Argon Table Tennis 3D
 * Handles procedural Web Audio API synthesizers, dynamic court ambient soundscapes,
 * Lyria 3 soundtracks, TTS umpire callouts, and tactile UI click feedback.
 */

export const LYRIA_TRACKS = {
  menu_theme: {
    id: "menu_theme",
    title: "Argon Club Plaza Breeze",
    subtitle: "Title & Club Select Theme",
    src: "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/menu_theme.mp3",
    loop: true,
    baseVolume: 0.38
  },
  court_intro: {
    id: "court_intro",
    title: "Center Court Flyover",
    subtitle: "Stadium Intro Fanfare",
    src: "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/court_intro.mp3",
    loop: false,
    baseVolume: 0.45
  },
  match_rally: {
    id: "match_rally",
    title: "Sunny Baseline Rally",
    subtitle: "Active Match Atmosphere",
    src: "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/match_rally.mp3",
    loop: true,
    baseVolume: 0.32
  },
  victory_fanfare: {
    id: "victory_fanfare",
    title: "Grand Slam Trophy",
    subtitle: "Match Victory Celebration",
    src: "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/victory_fanfare.mp3",
    loop: false,
    baseVolume: 0.48
  }
};

const STATE_TRACK_MAP = {
  title: "menu_theme",
  menu: "menu_theme",
  select: "menu_theme",
  intro: "court_intro",
  start: "court_intro",
  serve: "match_rally",
  rally: "match_rally",
  playing: "match_rally",
  point: "match_rally",
  replay: "match_rally",
  victory: "victory_fanfare",
  match_over: "victory_fanfare"
};

export const GEMINI_TTS_CLIPS = {
  start: "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/tts/match_start.mp3",
  match_start: "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/tts/match_start.mp3",
  "game point": "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/tts/game_point.mp3",
  "match point": "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/tts/match_point.mp3",
  deuce: "https://www.gstatic.com/aistudio/starter-apps/tennis/audio/tts/score_deuce.mp3"
};

export class AudioEngine {
  constructor(options = {}) {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this.uiGain = null;
    this.reverbSend = null;

    this.muted = !!(options.muted ?? false);
    this.musicVolume = Number(options.musicVolume ?? 0.65);
    this.sfxVolume = Number(options.sfxVolume ?? 0.85);
    this.ambientVolume = Number(options.ambientVolume ?? 0.55);

    this.audioElements = new Map();
    this.ttsAudioElements = new Map();
    this._activeVoiceAudio = null;
    this._voiceTimers = [];

    this.currentTrackId = null;
    this.desiredTrackId = "menu_theme";
    this.unlocked = false;
    this.onTrackChange = typeof options.onTrackChange === "function" ? options.onTrackChange : null;

    this._noiseBuffer = null;
    this._pinkNoiseBuffer = null;
    this._fadeTimers = new Map();

    // Procedural Ambient Court Sound Nodes
    this._ambientNoiseSource = null;
    this._ambientFilter1 = null;
    this._ambientFilter2 = null;
    this._ambientLfo = null;
    this._ambientLfoGain = null;
    this.isAmbientActive = false;

    this._preloadTracks();
    this._preloadTtsClips();
    this._attachAutoplayUnlock();
    this._attachGlobalUiClickFeedback();
  }

  _preloadTracks() {
    for (const [key, track] of Object.entries(LYRIA_TRACKS)) {
      const audio = new Audio();
      audio.src = track.src;
      audio.loop = track.loop;
      audio.preload = "auto";
      audio.volume = 0;
      audio.crossOrigin = "anonymous";
      if (key === "court_intro") {
        audio.addEventListener("ended", () => {
          if (this.currentTrackId === "court_intro") {
            this.playMusicForState("rally");
          }
        });
      }
      this.audioElements.set(key, audio);
    }
  }

  _preloadTtsClips() {
    for (const url of Object.values(GEMINI_TTS_CLIPS)) {
      if (!this.ttsAudioElements.has(url)) {
        const audio = new Audio();
        audio.src = url;
        audio.preload = "auto";
        audio.volume = Math.min(1, this.sfxVolume);
        this.ttsAudioElements.set(url, audio);
      }
    }
  }

  _attachAutoplayUnlock() {
    const unlockHandler = () => {
      this.unlock();
    };
    window.addEventListener("pointerdown", unlockHandler, { passive: true, once: false });
    window.addEventListener("keydown", unlockHandler, { passive: true, once: false });
    window.addEventListener("touchstart", unlockHandler, { passive: true, once: false });
  }

  _attachGlobalUiClickFeedback() {
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!target) return;
      const btn = target.closest("button, .wii-green-choice, .rules-tab-btn, .choice-main");
      if (btn) {
        // If it's the audio toggle button itself, let the dedicated toggle chime handle it
        if (btn.id === "btn-audio-toggle") return;
        this.playUiClick("click");
      }
    }, true);
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();

      // Master Gain Bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0.0001 : 1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Dedicated UI Audio Bus (can play toggle feedback directly)
      this.uiGain = this.ctx.createGain();
      this.uiGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.uiGain.connect(this.ctx.destination);

      // Ambient Court Sound Bus
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.muted ? 0.0001 : this.ambientVolume, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      // Gymnasium Stadium Reverb Delay Line
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.setValueAtTime(0.09, this.ctx.currentTime);
      const feedback = this.ctx.createGain();
      feedback.gain.setValueAtTime(0.22, this.ctx.currentTime);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3400, this.ctx.currentTime);

      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.setValueAtTime(0.2, this.ctx.currentTime);

      this.reverbSend.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      filter.connect(this.masterGain);

      this._buildNoiseBuffers();
      this._initAmbientCourtGenerator();
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  _buildNoiseBuffers() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;

    // White noise buffer
    this._noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = this._noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Pink noise buffer (Paul Kellet method)
    this._pinkNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const pinkData = this._pinkNoiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }
  }

  /**
   * Procedural Web Audio API Court Ambient Sound Generator
   * Generates organic indoor gymnasium / table tennis tournament hall acoustics
   */
  _initAmbientCourtGenerator() {
    if (!this.ctx || !this._pinkNoiseBuffer || this._ambientNoiseSource) return;

    try {
      // Looping pink noise source as base air presence
      this._ambientNoiseSource = this.ctx.createBufferSource();
      this._ambientNoiseSource.buffer = this._pinkNoiseBuffer;
      this._ambientNoiseSource.loop = true;

      // Filter 1: Lowpass for warm stadium room body (~420Hz)
      this._ambientFilter1 = this.ctx.createBiquadFilter();
      this._ambientFilter1.type = "lowpass";
      this._ambientFilter1.frequency.setValueAtTime(440, this.ctx.currentTime);
      this._ambientFilter1.Q.setValueAtTime(1.2, this.ctx.currentTime);

      // Filter 2: Bandpass to capture room air circulation (~850Hz)
      this._ambientFilter2 = this.ctx.createBiquadFilter();
      this._ambientFilter2.type = "bandpass";
      this._ambientFilter2.frequency.setValueAtTime(820, this.ctx.currentTime);
      this._ambientFilter2.Q.setValueAtTime(0.85, this.ctx.currentTime);

      // Organic slow room air modulation LFO (0.09 Hz)
      this._ambientLfo = this.ctx.createOscillator();
      this._ambientLfo.type = "sine";
      this._ambientLfo.frequency.setValueAtTime(0.09, this.ctx.currentTime);

      this._ambientLfoGain = this.ctx.createGain();
      this._ambientLfoGain.gain.setValueAtTime(60, this.ctx.currentTime);

      this._ambientLfo.connect(this._ambientLfoGain);
      this._ambientLfoGain.connect(this._ambientFilter1.frequency);

      // Routing
      this._ambientNoiseSource.connect(this._ambientFilter1);
      this._ambientFilter1.connect(this._ambientFilter2);
      this._ambientFilter2.connect(this.ambientGain);

      this._ambientNoiseSource.start(0);
      this._ambientLfo.start(0);
      this.isAmbientActive = true;
    } catch (err) {
      console.warn("[AudioEngine] Procedural court ambient failed to start:", err);
    }
  }

  /**
   * Sets dynamic intensity of ambient court sounds (e.g. rally hush, crowd swelling)
   */
  setCourtAmbientPhase(phase = "rally") {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const p = String(phase || "rally").toLowerCase();

    let targetGain = this.ambientVolume;
    if (this.muted) {
      targetGain = 0.0001;
    } else if (p === "serve" || p === "serve_toss") {
      targetGain = this.ambientVolume * 0.35; // Focused quiet hush
    } else if (p === "rally") {
      targetGain = this.ambientVolume * 0.95; // Active hall air
    } else if (p === "victory" || p === "celebration") {
      targetGain = this.ambientVolume * 1.25; // Energetic hall
    } else {
      targetGain = this.ambientVolume * 0.65;
    }

    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetGain), now + 0.6);
  }

  unlock() {
    this._ensureContext();
    this.unlocked = true;
    if (this.desiredTrackId && !this.muted) {
      const audio = this.audioElements.get(this.currentTrackId || this.desiredTrackId);
      if (!audio || audio.paused) {
        this._crossfadeToTrack(this.desiredTrackId);
      }
    }
  }

  playMusicForState(state) {
    const s = String(state || "rally").toLowerCase().trim();
    const trackId = STATE_TRACK_MAP[s] || "match_rally";
    this.desiredTrackId = trackId;

    this.setCourtAmbientPhase(s);

    if (this.currentTrackId === trackId) {
      const current = this.audioElements.get(trackId);
      if (current && current.paused && !this.muted) {
        current.play().catch(() => {});
      }
      return this.getCurrentTrackInfo();
    }

    this._crossfadeToTrack(trackId);
    return this.getCurrentTrackInfo();
  }

  _crossfadeToTrack(trackId) {
    const prevTrack = this.currentTrackId;
    this.currentTrackId = trackId;

    if (prevTrack && prevTrack !== trackId) {
      const prevAudio = this.audioElements.get(prevTrack);
      if (prevAudio) {
        this._fadeAudio(prevAudio, 0, 400, true);
      }
    }

    const nextAudio = this.audioElements.get(trackId);
    const trackDef = LYRIA_TRACKS[trackId];
    if (nextAudio && trackDef) {
      const targetVol = this.muted ? 0 : Math.min(1, trackDef.baseVolume * this.musicVolume);
      if (!trackDef.loop) {
        try { nextAudio.currentTime = 0; } catch {}
      }
      nextAudio.play().then(() => {
        this._fadeAudio(nextAudio, targetVol, 460, false);
      }).catch(() => {});
    }

    const info = this.getCurrentTrackInfo();
    if (typeof this.onTrackChange === "function") {
      this.onTrackChange(info);
    }
  }

  _fadeAudio(audioEl, targetVol, durationMs, pauseOnZero = false) {
    if (this._fadeTimers.has(audioEl)) {
      clearInterval(this._fadeTimers.get(audioEl));
    }

    const steps = 14;
    const interval = Math.max(16, Math.floor(durationMs / steps));
    const startVol = audioEl.volume;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const t = step / steps;
      audioEl.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * t));
      if (step >= steps) {
        clearInterval(timer);
        this._fadeTimers.delete(audioEl);
        audioEl.volume = Math.max(0, Math.min(1, targetVol));
        if (pauseOnZero && targetVol <= 0.001) {
          audioEl.pause();
        }
      }
    }, interval);

    this._fadeTimers.set(audioEl, timer);
  }

  getCurrentTrackInfo() {
    const id = this.currentTrackId || this.desiredTrackId || "menu_theme";
    return {
      ...(LYRIA_TRACKS[id] || LYRIA_TRACKS.menu_theme),
      muted: this.muted,
      musicVolume: this.musicVolume
    };
  }

  isMuted() {
    return this.muted;
  }

  /**
   * Sets Muted state and dynamically manages Web Audio API buses, ambient court tone, and UI chime
   * @param {boolean} shouldMute
   */
  setMuted(shouldMute) {
    this.muted = !!shouldMute;
    this._ensureContext();

    const now = this.ctx ? this.ctx.currentTime : 0;

    if (this.muted) {
      // 1. Play pleasant tactile descending 'mute' feedback via UI bus
      this.playUiClick("mute");

      // 2. Smoothly ramp master gain and ambient down
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      }

      if (this.ambientGain && this.ctx) {
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      }

      // 3. Mute all HTML5 music tracks
      for (const audio of this.audioElements.values()) {
        audio.volume = 0;
      }
    } else {
      // 1. Ramp master gain up to full
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
        this.masterGain.gain.exponentialRampToValueAtTime(1.0, now + 0.12);
      }

      // 2. Resume & ramp court ambient sound
      if (this.ambientGain && this.ctx) {
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), now);
        this.ambientGain.gain.exponentialRampToValueAtTime(this.ambientVolume, now + 0.2);
      }

      // 3. Play pleasant harmonious ascending 'unmute' chime
      this.playUiClick("unmute");

      // 4. Restore background track
      const activeTrack = this.audioElements.get(this.currentTrackId || this.desiredTrackId);
      const trackDef = LYRIA_TRACKS[this.currentTrackId || this.desiredTrackId];
      if (activeTrack && trackDef) {
        activeTrack.volume = Math.min(1, trackDef.baseVolume * this.musicVolume);
        if (activeTrack.paused) {
          activeTrack.play().catch(() => {});
        }
      }
    }

    const info = this.getCurrentTrackInfo();
    if (typeof this.onTrackChange === "function") {
      this.onTrackChange(info);
    }
    return this.muted;
  }

  /**
   * Toggles Mute / Unmute state dynamically
   */
  toggleMute() {
    return this.setMuted(!this.muted);
  }

  /**
   * Synthesizes responsive, tactile UI clicks and toggle chimes using the Web Audio API
   * @param {'click'|'unmute'|'mute'|'toggle'} variant
   */
  playUiClick(variant = "click") {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dest = this.uiGain || this.sfxGain || ctx.destination;

    if (variant === "unmute") {
      // Ascending major third (Eb5 622Hz -> G5 784Hz) with warm resonance
      [622.25, 783.99].forEach((freq, idx) => {
        const startTime = now + idx * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(startTime);
        osc.stop(startTime + 0.24);
      });
      return;
    }

    if (variant === "mute") {
      // Soft descending tone (784Hz -> 480Hz) to signal quiet
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.09);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    // If application is muted, skip ordinary button clicks to respect silence
    if (this.muted) return;

    // Standard crisp tactile button click (sine + snappy transient)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.038);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.046);

    // High subtle snap
    if (this._noiseBuffer) {
      const snapSource = ctx.createBufferSource();
      snapSource.buffer = this._noiseBuffer;
      const snapFilter = ctx.createBiquadFilter();
      snapFilter.type = "highpass";
      snapFilter.frequency.setValueAtTime(2400, now);
      const snapGain = ctx.createGain();
      snapGain.gain.setValueAtTime(0.0001, now);
      snapGain.gain.linearRampToValueAtTime(0.035, now + 0.001);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

      snapSource.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(dest);
      snapSource.start(now, Math.random() * 0.4, 0.02);
    }
  }

  // --- Gameplay SFX (synthesized + procedural) ---

  playSwingWhoosh(speedMultiplier = 1) {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._pinkNoiseBuffer) return;

    const now = ctx.currentTime;
    const spd = Math.max(0.6, Math.min(1.8, Number(speedMultiplier || 1)));
    const duration = 0.15;

    const noise = ctx.createBufferSource();
    noise.buffer = this._pinkNoiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(1.8, now);
    filter.frequency.setValueAtTime(320 * spd, now);
    filter.frequency.exponentialRampToValueAtTime(1420 * spd, now + duration * 0.55);
    filter.frequency.exponentialRampToValueAtTime(380, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12 * Math.min(1.2, spd), now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter).connect(gain).connect(this.sfxGain);
    noise.start(now, Math.random() * 0.5, duration + 0.02);
  }

  playRacketHit(shotType = "topspin", quality = "good") {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const s = String(shotType || "topspin").toLowerCase();
    const isSmash = s === "smash" || s === "power";
    const isSweet = quality === "perfect" || quality === "sweet_spot" || isSmash;

    // Table Tennis rubber pop transient (short, crisp)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isSmash ? "square" : "triangle";
    osc.frequency.setValueAtTime(isSmash ? 880 : 720, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + (isSmash ? 0.055 : 0.042));

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isSmash ? 0.17 : 0.12, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isSmash ? 0.06 : 0.045));

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);

    // Wood blade body resonance
    const wood = ctx.createOscillator();
    const woodGain = ctx.createGain();
    wood.type = "sine";
    wood.frequency.setValueAtTime(isSmash ? 440 : 360, now);
    wood.frequency.exponentialRampToValueAtTime(95, now + 0.07);

    woodGain.gain.setValueAtTime(0.001, now);
    woodGain.gain.linearRampToValueAtTime(isSmash ? 0.13 : 0.09, now + 0.004);
    woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    wood.connect(woodGain).connect(this.sfxGain);
    wood.start(now);
    wood.stop(now + 0.08);

    if (isSweet) {
      const sweet = ctx.createOscillator();
      const sweetGain = ctx.createGain();
      sweet.type = "sine";
      sweet.frequency.setValueAtTime(1240, now);
      sweet.frequency.exponentialRampToValueAtTime(600, now + 0.09);

      sweetGain.gain.setValueAtTime(0.001, now);
      sweetGain.gain.linearRampToValueAtTime(0.065, now + 0.003);
      sweetGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      sweet.connect(sweetGain).connect(this.sfxGain);
      sweet.start(now);
      sweet.stop(now + 0.095);
    }
  }

  playBallBounce(pitchMod = 1) {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const p = Math.max(0.5, Math.min(1.4, Number(pitchMod || 1)));

    // Classic 40mm Ping Pong table bounce "tok!"
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1240 * p, now);
    osc.frequency.exponentialRampToValueAtTime(510, now + 0.036);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.0025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.044);

    // Wooden table acoustic rebound
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(540 * p, now);
    body.frequency.exponentialRampToValueAtTime(210, now + 0.045);

    bodyGain.gain.setValueAtTime(0.001, now);
    bodyGain.gain.linearRampToValueAtTime(0.085, now + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    body.connect(bodyGain).connect(this.sfxGain);
    body.start(now);
    body.stop(now + 0.052);
  }

  playNetCord() {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playServeToss() {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.2;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playCrowdReaction(type = "cheer") {
    if (this.muted) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._pinkNoiseBuffer) return;

    const now = ctx.currentTime;
    const t = String(type || "cheer").toLowerCase();

    if (t === "gasp" || t === "ooh") {
      const source = ctx.createBufferSource();
      source.buffer = this._pinkNoiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(2.2, now);
      filter.frequency.setValueAtTime(740, now);
      filter.frequency.exponentialRampToValueAtTime(390, now + 0.52);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

      source.connect(filter).connect(gain).connect(this.sfxGain);
      if (this.reverbSend) gain.connect(this.reverbSend);
      source.start(now, 0, 0.55);
      return;
    }

    // Cheering ovation
    const duration = 1.3;
    const source = ctx.createBufferSource();
    source.buffer = this._pinkNoiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(1.1, now);
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.exponentialRampToValueAtTime(1280, now + duration * 0.35);
    filter.frequency.exponentialRampToValueAtTime(760, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter).connect(gain).connect(this.sfxGain);
    if (this.reverbSend) gain.connect(this.reverbSend);
    source.start(now, 0, duration + 0.05);

    // Chime chords
    [261.63, 329.63, 392.0].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.detune.setValueAtTime((idx - 1) * 10, now);
      osc.frequency.setValueAtTime(freq, now);

      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.001, now);
      cGain.gain.linearRampToValueAtTime(0.025, now + 0.12);
      cGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.72);

      osc.connect(cGain).connect(this.sfxGain);
      if (this.reverbSend) cGain.connect(this.reverbSend);
      osc.start(now);
      osc.stop(now + 0.75);
    });
  }

  announceScore(text, { delayMs = 0, playChime = true } = {}) {
    if (this.muted || !text) return;
    const str = String(text).trim();
    const ctx = this._ensureContext();

    if (ctx && playChime) {
      const startTime = ctx.currentTime + delayMs / 1000;
      const chords = /game|match|deuce|win|victoria|smash/i.test(str)
        ? [587.33, 739.99, 880.0]
        : [523.25, 659.25];

      chords.forEach((freq, i) => {
        const u = startTime + i * 0.06;
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = "sine";
        o2.type = "triangle";
        o1.frequency.setValueAtTime(freq, u);
        o2.frequency.setValueAtTime(freq, u);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, u);
        g.gain.linearRampToValueAtTime(0.05, u + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0008, u + 0.22);

        o1.connect(g);
        o2.connect(g);
        g.connect(this.sfxGain);
        if (this.reverbSend) g.connect(this.reverbSend);

        o1.start(u);
        o2.start(u);
        o1.stop(u + 0.24);
        o2.stop(u + 0.24);
      });
    }

    this.playVoiceCallout(str, { delayMs, clearQueue: delayMs === 0 });
  }

  playVoiceCallout(text, { delayMs = 0, clearQueue = false } = {}) {
    if (this.muted || !text) return;
    const key = String(text).trim().toLowerCase();
    const clipUrl = GEMINI_TTS_CLIPS[key];

    if (clearQueue && this._voiceTimers.length > 0) {
      this._voiceTimers.forEach(id => clearTimeout(id));
      this._voiceTimers = [];
    }

    const execute = () => {
      if (this.muted) return;
      if (clipUrl) {
        try {
          if (this._activeVoiceAudio && !this._activeVoiceAudio.paused) {
            this._activeVoiceAudio.pause();
            this._activeVoiceAudio.currentTime = 0;
          }
          let audio = this.ttsAudioElements.get(clipUrl);
          if (!audio) {
            audio = new Audio(clipUrl);
            this.ttsAudioElements.set(clipUrl, audio);
          }
          audio.currentTime = 0;
          audio.volume = Math.min(1, this.sfxVolume * 0.98);
          this._activeVoiceAudio = audio;
          audio.play().catch(() => {});
          return;
        } catch {}
      }

      // Web Speech API fallback
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const clean = String(text).replace(/\b00\b/g, "Love").replace(/\s*-\s*/g, " ").replace(/!/g, "");
          const utter = new SpeechSynthesisUtterance(clean);
          utter.rate = 1.05;
          utter.pitch = 1.04;
          utter.volume = Math.min(1, this.sfxVolume * 0.88);
          window.speechSynthesis.speak(utter);
        } catch {}
      }
    };

    if (delayMs > 0) {
      const timer = setTimeout(execute, delayMs);
      this._voiceTimers.push(timer);
    } else {
      execute();
    }
  }
}

export default AudioEngine;
