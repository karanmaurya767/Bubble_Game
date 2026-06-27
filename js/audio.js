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

    /** Pop bubble — short descending blip */
    pop() {
        this.tone({ freq: 800, type: 'sine', duration: 0.12, attack: 0.005, decay: 0.08, gain: 0.4, slide: -300 });
        this.noise({ duration: 0.04, gain: 0.15, filter: 2000 });
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
}

export const Audio = new AudioEngine();

// ============================================================
// Procedural Music — looping chiptune via OscillatorNode
// ============================================================
// 16-step pattern, minor pentatonic lead + square-wave bass.
// All synthesized — no audio files. Starts on first user gesture.
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
        this.timer = null;
        this.stepIndex = 0;
        this.enabled = false;
        this.volume = 0.15;
        this.tempo = 124;          // BPM
        this.stepInterval = 0;     // seconds per 16th note
        this.scale = [0, 3, 5, 7, 10]; // minor pentatonic (semitones)
        this.root = 220;           // A3
        this.leadPattern = [];
        this.barCount = 0;
    }

    start() {
        if (this.timer) return;
        if (!this.audio.initialized || !this.audio.ctx) return; // wait for gesture

        this.ctx = this.audio.ctx;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.audio.masterGain);

        // Bass — square through lowpass
        this.bassOsc = this.ctx.createOscillator();
        this.bassOsc.type = 'square';
        this.bassFilter = this.ctx.createBiquadFilter();
        this.bassFilter.type = 'lowpass';
        this.bassFilter.frequency.value = 600;
        this.bassGain = this.ctx.createGain();
        this.bassGain.gain.value = 0.12;
        this.bassOsc.connect(this.bassFilter);
        this.bassFilter.connect(this.bassGain);
        this.bassGain.connect(this.masterGain);
        this.bassOsc.start();

        // Lead bus
        this.leadGain = this.ctx.createGain();
        this.leadGain.gain.value = 0.18;
        this.leadGain.connect(this.masterGain);

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
        this.masterGain = null;
    }

    regeneratePattern() {
        const notes = this.scale;
        this.leadPattern = [];
        for (let i = 0; i < 16; i++) {
            if (Math.random() < 0.32) {
                const oct = Math.random() < 0.25 ? 12 : 0;
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

        // Bass hit on beats 0, 2 (every 8 sixteenths)
        if (stepInBar % 8 === 0 && this.bassOsc) {
            this.bassOsc.frequency.setValueAtTime(this.root / 2, t);
            this.bassOsc.frequency.exponentialRampToValueAtTime(this.root, t + this.stepInterval * 2);
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

    setEnabled(on) {
        this.enabled = on;
        if (on) this.start(); else this.stop();
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(0.4, v));
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.2);
        }
    }
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
Audio.setVolume(settings.volume / 100);
if (settings.music) Music.setEnabled(false); // wait for first gesture before starting
if (settings.voice) Voice.setEnabled(true);

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