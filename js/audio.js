// ============================================================
// BUBBLE POP! — Web Audio API sound engine
// ============================================================
// Generates all SFX procedurally via OscillatorNode + GainNode.
// No external audio assets required — keeps bundle small.
// ============================================================

import { Storage } from './storage.js';

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.enabled = true;
        this.volume = 0.8;
        this.initialized = false;
    }

    /**
     * Lazy-init on first user interaction (autoplay policy).
     */
    init() {
        if (this.initialized) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('[audio] init failed:', e);
        }
    }

    /**
     * Resume context (needed after user gesture on mobile).
     */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    /**
     * Set master volume (0..1).
     */
    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
        }
    }

    /**
     * Mute / unmute.
     */
    setMuted(muted) {
        this.enabled = !muted;
    }

    /**
     * Low-level: play a tone with envelope.
     */
    tone({ freq, type = 'sine', duration = 0.15, attack = 0.005, decay = 0.05, gain = 0.5, slide = 0 }) {
        if (!this.enabled || !this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slide) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + duration);
        }
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + attack);
        g.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration + 0.05);
    }

    /**
     * Noise burst for percussive sounds (pop, bounce).
     */
    noise({ duration = 0.1, gain = 0.3, filter = 1000 }) {
        if (!this.enabled || !this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decay envelope
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filterNode = this.ctx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = filter;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        source.connect(filterNode);
        filterNode.connect(g);
        g.connect(this.masterGain);
        source.start(now);
    }

    // ---------- Public SFX ----------

    /** Pop bubble — bright "bubble-like" descending blip + tiny noise click */
    pop() {
        this.tone({ freq: 1200, type: 'sine', duration: 0.08, attack: 0.001, decay: 0.07, gain: 0.4, slide: -700 });
        this.tone({ freq: 400, type: 'sine', duration: 0.06, attack: 0.002, decay: 0.05, gain: 0.15, slide: -200 });
        this.noise({ duration: 0.025, gain: 0.08, filter: 3000 });
    }

    /** Shoot — rising whoosh */
    shoot() {
        this.tone({ freq: 200, type: 'sawtooth', duration: 0.15, attack: 0.005, decay: 0.1, gain: 0.25, slide: 400 });
    }

    /** Bounce off wall — short tick */
    bounce() {
        this.tone({ freq: 400, type: 'square', duration: 0.05, attack: 0.001, decay: 0.04, gain: 0.3, slide: -100 });
    }

    /** Win — triumphant arpeggio */
    win() {
        const notes = [523, 659, 784, 1047]; // C, E, G, C
        notes.forEach((freq, i) => {
            setTimeout(() => this.tone({ freq, type: 'triangle', duration: 0.25, attack: 0.01, decay: 0.2, gain: 0.5 }), i * 120);
        });
    }

    /** Lose — descending sad tone */
    lose() {
        const notes = [440, 392, 349, 294];
        notes.forEach((freq, i) => {
            setTimeout(() => this.tone({ freq, type: 'sawtooth', duration: 0.35, attack: 0.01, decay: 0.3, gain: 0.4 }), i * 180);
        });
    }

    /** Power-up collected — magical shimmer */
    powerup() {
        const notes = [523, 659, 880, 1047, 1318];
        notes.forEach((freq, i) => {
            setTimeout(() => this.tone({ freq, type: 'sine', duration: 0.15, attack: 0.005, decay: 0.12, gain: 0.4 }), i * 50);
        });
    }

    /** Click — UI tap */
    click() {
        this.tone({ freq: 600, type: 'square', duration: 0.04, attack: 0.001, decay: 0.03, gain: 0.2 });
    }

    /** Achievement unlocked — fanfare */
    achievement() {
        const notes = [659, 784, 988, 1319];
        notes.forEach((freq, i) => {
            setTimeout(() => this.tone({ freq, type: 'triangle', duration: 0.2, attack: 0.005, decay: 0.15, gain: 0.45 }), i * 80);
        });
    }

    /** Better pop — punchier, two-stage decay */
    pop2() {
        if (!this.enabled || !this.initialized) return;
        this.tone({ freq: 1400, type: 'square', duration: 0.04, attack: 0.001, decay: 0.03, gain: 0.18 });
        this.tone({ freq: 700, type: 'sine', duration: 0.10, attack: 0.002, decay: 0.08, gain: 0.35, slide: -400 });
        this.noise({ duration: 0.06, gain: 0.18, filter: 1500 });
    }

    /** Combo sparkle — intensity scales the number of notes */
    combo(intensity = 1) {
        const notes = [523, 659, 784, 988, 1175];
        const n = Math.min(notes.length, 2 + intensity);
        for (let i = 0; i < n; i++) {
            setTimeout(() => this.tone({
                freq: notes[i], type: 'triangle', duration: 0.18,
                attack: 0.005, decay: 0.14, gain: 0.35,
            }), i * 60);
        }
    }

    /** Level-up jingle — longer fanfare */
    levelUp() {
        const seq = [
            [523, 0], [659, 100], [784, 200], [1047, 300],
            [1319, 450], [1047, 600], [1319, 750],
        ];
        seq.forEach(([f, t]) => setTimeout(() => this.tone({
            freq: f, type: 'triangle', duration: 0.22, attack: 0.005, decay: 0.18, gain: 0.45,
        }), t));
    }

    /** UI hover tick — quick blip */
    hoverTick() {
        this.tone({ freq: 1800, type: 'square', duration: 0.025, attack: 0.001, decay: 0.02, gain: 0.08 });
    }

    /** Locked action — low buzz */
    buzz() {
        this.tone({ freq: 220, type: 'square', duration: 0.12, attack: 0.005, decay: 0.1, gain: 0.25 });
    }

    /** Bigger achievement fanfare */
    achievement2() {
        const notes = [523, 659, 784, 988, 1319, 1568];
        notes.forEach((f, i) => setTimeout(() => this.tone({
            freq: f, type: 'triangle', duration: 0.2, attack: 0.005, decay: 0.16, gain: 0.45,
        }), i * 70));
    }

    /** v1.3 — Swap current/next bubble — two-note ascending chirp */
    swap() {
        this.tone({ freq: 600, type: 'triangle', duration: 0.08, attack: 0.005, decay: 0.06, gain: 0.3, slide: 400 });
        this.tone({ freq: 1000, type: 'triangle', duration: 0.08, attack: 0.005, decay: 0.06, gain: 0.3 });
    }
}

export const Audio = new AudioEngine();

// ============================================================
// Procedural Music — looping bubble-pop chiptune
// ============================================================
// v1.3 — Major pentatonic + percussion (kick + hi-hat) for bouncy feel.
// 16-step pattern. All synthesized — no audio files. Starts on first user gesture.
// ============================================================
class MusicEngine {
    constructor(audioEngine) {
        this.audio = audioEngine;
        this.ctx = null;
        this.masterGain = null;
        this.bassOsc = null;
        this.bassGain = null;
        this.bassFilter = null;
        this.leadGain = null;
        this.hiHatGain = null;
        this.kickGain = null;
        this.timer = null;
        this.stepIndex = 0;
        this.enabled = false;
        this.pendingStart = false; // v1.2 — wait for first user gesture
        this.volume = 0.15;
        this.tempo = 104;          // BPM — slower, more relaxed bubble-pop feel
        this.stepInterval = 0;     // seconds per 16th note
        this.scale = [0, 2, 4, 7, 9]; // v1.3 — MAJOR pentatonic (happy/bouncy)
        this.root = 262;           // v1.3 — C4 (brighter than A3)
        this.bassRoot = 130;       // C3
        this.leadPattern = [];
        this.bassPattern = [0, 0, 5, 0, 0, 0, 7, 0, 0, 0, 5, 0, 0, 0, 4, 0]; // v1.3 syncopated
        this.barCount = 0;
    }

    /** v1.2 — called from any user gesture; starts music if user opted in */
    tryStartOnGesture() {
        if (this.timer) return; // already playing
        if (!this.pendingStart) return;
        if (!Storage.getSettings().music) {
            this.pendingStart = false;
            return;
        }
        // Audio context needs init from a gesture; Audio.init() is idempotent
        this.audio.init();
        this.audio.resume();
        if (this.audio.initialized) {
            this.pendingStart = false;
            // Apply user's music volume (default 50%)
            const mv = Storage.getSettings().musicVolume ?? 50;
            this.setMusicVolume(mv / 100);
            this.start();
        }
    }

    start() {
        if (this.timer) return;
        if (!this.audio.initialized || !this.audio.ctx) return; // wait for gesture

        this.ctx = this.audio.ctx;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.audio.masterGain);

        // Bass — triangle through lowpass (warmer than square)
        this.bassOsc = this.ctx.createOscillator();
        this.bassOsc.type = 'triangle';
        this.bassFilter = this.ctx.createBiquadFilter();
        this.bassFilter.type = 'lowpass';
        this.bassFilter.frequency.value = 500;
        this.bassGain = this.ctx.createGain();
        this.bassGain.gain.value = 0;
        this.bassOsc.connect(this.bassFilter);
        this.bassFilter.connect(this.bassGain);
        this.bassGain.connect(this.masterGain);
        this.bassOsc.start();

        // Lead bus
        this.leadGain = this.ctx.createGain();
        this.leadGain.gain.value = 0.20;
        this.leadGain.connect(this.masterGain);

        // Hi-hat bus (white noise burst)
        this.hiHatGain = this.ctx.createGain();
        this.hiHatGain.gain.value = 0.08;
        const hiHatFilter = this.ctx.createBiquadFilter();
        hiHatFilter.type = 'highpass';
        hiHatFilter.frequency.value = 7000;
        this.hiHatGain.connect(hiHatFilter);
        hiHatFilter.connect(this.masterGain);

        // Kick bus (low sine pulse)
        this.kickGain = this.ctx.createGain();
        this.kickGain.gain.value = 0.0;
        this.kickGain.connect(this.masterGain);

        this.stepInterval = 60 / this.tempo / 4;
        this.stepIndex = 0;
        this.barCount = 0;
        this.regeneratePattern();

        // Fade in
        this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.8);
        this.tick();
    }

    stop() {
        if (!this.timer) return;
        clearTimeout(this.timer);
        this.timer = null;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
        }
        const bass = this.bassOsc;
        const mg = this.masterGain;
        const lg = this.leadGain;
        const bf = this.bassFilter;
        const bg = this.bassGain;
        setTimeout(() => {
            try { bass?.stop(); } catch {}
            try { bass?.disconnect(); } catch {}
            try { bf?.disconnect(); } catch {}
            try { bg?.disconnect(); } catch {}
            try { lg?.disconnect(); } catch {}
            try { mg?.disconnect(); } catch {}
        }, 600);
        this.bassOsc = null;
        this.bassFilter = null;
        this.bassGain = null;
        this.leadGain = null;
        this.hiHatGain = null;
        this.kickGain = null;
        this.masterGain = null;
    }

    regeneratePattern() {
        const notes = this.scale;
        this.leadPattern = [];
        for (let i = 0; i < 16; i++) {
            if (Math.random() < 0.35) {
                const oct = Math.random() < 0.3 ? 12 : 0;
                const semi = notes[Math.floor(Math.random() * notes.length)] + oct;
                this.leadPattern.push(semi);
            } else {
                this.leadPattern.push(null);
            }
        }
    }

    tick() {
        if (!this.timer || !this.ctx) return;
        const stepInBar = this.stepIndex % 16;
        if (stepInBar === 0) {
            this.barCount++;
            if (this.barCount % 2 === 0) this.regeneratePattern();
        }
        const t = this.ctx.currentTime;

        // v1.3 — Bass: hit on syncopated pattern (notes from bassPattern)
        if (this.bassOsc) {
            const semi = this.bassPattern[stepInBar];
            if (semi !== 0 || stepInBar === 0) {
                const freq = this.bassRoot * Math.pow(2, semi / 12);
                this.bassOsc.frequency.setValueAtTime(freq, t);
                this.bassGain.gain.cancelScheduledValues(t);
                this.bassGain.gain.setValueAtTime(0, t);
                this.bassGain.gain.linearRampToValueAtTime(0.18, t + 0.005);
                this.bassGain.gain.exponentialRampToValueAtTime(0.001, t + this.stepInterval * 1.2);
            }
        }

        // v1.3 — Hi-hat on every odd 8th (8 hits per bar)
        if (this.hiHatGain && stepInBar % 2 === 1) {
            this.playHiHat(t, stepInBar % 4 === 1 ? 0.5 : 1.0);
        }

        // v1.3 — Kick on beats 0 and 2 (every 8 sixteenths)
        if (this.kickGain && stepInBar % 8 === 0) {
            this.playKick(t);
        }

        // Lead note
        const semi = this.leadPattern[stepInBar];
        if (semi != null && this.leadGain) {
            const freq = this.root * 2 * Math.pow(2, semi / 12);
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.18, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t + this.stepInterval * 1.5);
            osc.connect(g);
            g.connect(this.leadGain);
            osc.start(t);
            osc.stop(t + this.stepInterval * 2);
        }

        this.stepIndex++;
        this.timer = setTimeout(() => this.tick(), this.stepInterval * 1000);
    }

    // v1.3 — Hi-hat: short white noise burst through highpass filter
    playHiHat(t, accent = 1.0) {
        if (!this.ctx || !this.hiHatGain) return;
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.04 * accent, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        src.connect(g);
        g.connect(this.hiHatGain);
        src.start(t);
    }

    // v1.3 — Kick: low sine sweep with envelope
    playKick(t) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.4, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(g);
        g.connect(this.kickGain);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    setEnabled(on) {
        this.enabled = on;
        if (on) this.start(); else this.stop();
    }

    /** v1.3 — separate volume for music channel (independent from SFX) */
    setMusicVolume(v) {
        this.volume = Math.max(0, Math.min(0.5, v));
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.2);
        }
    }

    /** Backward-compat alias */
    setVolume(v) { this.setMusicVolume(v); }
}

export const Music = new MusicEngine(Audio);

// ============================================================
// Voice — Web Speech API callouts
// ============================================================
// Wraps speechSynthesis. Voice/music toggle from settings.
// Requires user gesture before speaking (autoplay policy).
// ============================================================
class VoiceEngine {
    constructor() {
        this.enabled = false;
        this.volume = 1.0;
        this.voice = null;
        this.lastSpoke = 0;
        this.minGapMs = 700;
        this.unlocked = false;
        this.available = ('speechSynthesis' in window);
    }

    /** Must be called inside a user gesture. Primes the synthesis engine. */
    unlock() {
        if (this.unlocked || !this.available) return;
        try {
            const voices = window.speechSynthesis.getVoices();
            this.voice = voices.find((v) => /en[-_]?(GB|US)/i.test(v.lang) && /female|samantha|karen|google/i.test(v.name))
                       || voices.find((v) => /en/i.test(v.lang))
                       || voices[0] || null;
            // Prime with silent utterance to satisfy autoplay heuristics
            const u = new SpeechSynthesisUtterance(' ');
            u.volume = 0;
            u.rate = 0.1;
            window.speechSynthesis.speak(u);
        } catch (e) {
            console.warn('[voice] unlock failed:', e);
        }
        this.unlocked = true;
    }

    setEnabled(on) { this.enabled = !!on; }

    /** v1.3 — separate volume for voice channel */
    setVoiceVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
    }

    say(text, opts = {}) {
        if (!this.enabled || !this.available || !this.unlocked) return;
        const now = Date.now();
        if (now - this.lastSpoke < this.minGapMs) return;
        this.lastSpoke = now;
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            if (this.voice) u.voice = this.voice;
            u.volume = this.volume;
            u.rate = opts.rate ?? 1.1;
            u.pitch = opts.pitch ?? 1.15;
            window.speechSynthesis.speak(u);
        } catch (e) {
            console.warn('[voice] say failed:', e);
        }
    }

    /** Combo callout — picks based on count */
    combo(count) {
        if (!this.enabled) return;
        if (count >= 7) this.say('Combo legend!');
        else if (count >= 5) this.say('Amazing combo!');
        else if (count >= 3) this.say('Nice combo!');
    }

    powerup(type) {
        if (!this.enabled) return;
        const map = { bomb: 'Bomb!', rainbow: 'Rainbow!', lightning: 'Lightning!' };
        this.say(map[type] || 'Power up!');
    }

    achievement(name) { this.say(name); }
    levelUp() { this.say('Level up!'); }
    win() { this.say('You win!'); }
    lose() { this.say('Game over.'); }
    great() { this.say('Great!'); }
}

export const Voice = new VoiceEngine();

// Load voices async (some browsers populate after window load)
if (Voice.available) {
    window.speechSynthesis.onvoiceschanged = () => {
        if (!Voice.voice) {
            const voices = window.speechSynthesis.getVoices();
            Voice.voice = voices.find((v) => /en/i.test(v.lang)) || voices[0] || null;
        }
    };
}

// Apply stored settings on module load
const settings = Storage.getSettings();
Audio.setVolume((settings.sfxVolume ?? settings.volume ?? 80) / 100);
Voice.setVoiceVolume((settings.voiceVolume ?? 80) / 100);
// v1.2 — mark music as pending; will start on first user gesture (tryStartOnGesture)
if (settings.music) Music.pendingStart = true;
if (settings.voice) {
    Voice.unlock();
    Voice.setEnabled(true);
}

// ============================================================
// Haptic feedback helper
// ============================================================
let hapticsEnabled = true;

export function setHapticsEnabled(enabled) {
    hapticsEnabled = enabled;
}

export function vibrate(pattern = 50) {
    if (!hapticsEnabled) return;
    if (navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch {}
    }
}

export function hapticPop()    { vibrate(30); }
export function hapticBigPop() { vibrate([60, 30, 60]); }
export function hapticShoot()  { vibrate(15); }
export function hapticBounce() { vibrate(20); }
export function hapticAchievement() { vibrate([100, 50, 100, 50, 200]); }

// Apply stored haptics setting
hapticsEnabled = Storage.getSettings().haptics !== false;