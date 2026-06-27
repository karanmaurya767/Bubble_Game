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
}

export const Audio = new AudioEngine();

// Apply stored settings on module load
const settings = Storage.getSettings();
Audio.setVolume(settings.volume / 100);

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