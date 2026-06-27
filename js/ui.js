// ============================================================
// BUBBLE POP! — UI Controllers
// ============================================================
// Onboarding flow, modal management, toast system, settings.
// ============================================================

import { Storage } from './storage.js';
import { Audio, Music, Voice, setHapticsEnabled, vibrate } from './audio.js';
import { Achievements } from './achievements.js';
import { LEVELS, getLevelsByTier, getStarsForScore } from './levels.js';
import { Leaderboard } from './leaderboard.js';

// ============================================================
// Onboarding
// ============================================================
export class Onboarding {
    constructor() {
        this.overlay = document.getElementById('onboardingOverlay');
        this.slidesContainer = document.getElementById('onboardingSlides');
        this.dotsContainer = document.getElementById('onboardingDots');
        this.skipBtn = document.getElementById('onboardingSkip');
        this.nextBtn = document.getElementById('onboardingNext');
        this.currentSlide = 1;
        this.totalSlides = this.slidesContainer ? this.slidesContainer.querySelectorAll('.onboarding-slide').length : 3;
        this.bind();
    }

    bind() {
        this.skipBtn?.addEventListener('click', () => this.finish());
        this.nextBtn?.addEventListener('click', () => this.next());
    }

    show() {
        if (!this.overlay) return;
        this.overlay.hidden = false;
        this.currentSlide = 1;
        this.render();
    }

    next() {
        Audio.init();
        Audio.resume();
        Audio.click();
        vibrate(20);
        if (this.currentSlide >= this.totalSlides) {
            this.finish();
        } else {
            this.currentSlide++;
            this.render();
        }
    }

    render() {
        const slides = this.slidesContainer?.querySelectorAll('.onboarding-slide') || [];
        slides.forEach((s) => {
            s.hidden = parseInt(s.dataset.slide) !== this.currentSlide;
        });
        const dots = this.dotsContainer?.querySelectorAll('.dot') || [];
        dots.forEach((d, i) => {
            d.classList.toggle('dot--active', i === this.currentSlide - 1);
        });
        if (this.nextBtn) {
            this.nextBtn.querySelector('span').textContent = this.currentSlide >= this.totalSlides ? 'PLAY!' : 'NEXT →';
        }
    }

    finish() {
        if (!this.overlay) return;
        this.overlay.hidden = true;
        Storage.setOnboarded();
        // Trigger a custom event so game.js knows to start
        window.dispatchEvent(new CustomEvent('onboarding:done'));
    }
}

// ============================================================
// Modal Manager
// ============================================================
export class ModalManager {
    constructor() {
        this.openModal = null;
        // Bind all [data-close] buttons
        document.addEventListener('click', (e) => {
            const closeEl = e.target.closest('[data-close]');
            if (closeEl) {
                this.close();
            }
        });
        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    open(id) {
        Audio.click();
        vibrate(15);
        const el = document.getElementById(id);
        if (!el) return;
        this.close(); // close any other
        el.hidden = false;
        this.openModal = el;
    }

    close() {
        if (this.openModal) {
            this.openModal.hidden = true;
            this.openModal = null;
        }
        // Also hide any other open ones (safety)
        document.querySelectorAll('.modal').forEach((m) => { m.hidden = true; });
    }
}

// ============================================================
// Toast System
// ============================================================
export class Toaster {
    constructor() {
        this.stack = document.getElementById('toastStack');
    }

    show(text, type = 'info', duration = 2800, icon = null) {
        if (!this.stack) return;
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        const iconChar = icon || (type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️');
        toast.innerHTML = `<span class="toast__icon">${iconChar}</span><span class="toast__text">${text}</span>`;
        this.stack.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('is-leaving');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    success(text, icon = '✅') { this.show(text, 'success', 2500, icon); }
    warning(text) { this.show(text, 'warning'); }
    error(text) { this.show(text, 'error'); }
    info(text) { this.show(text, 'info'); }
}

// ============================================================
// Level Select Renderer
// ============================================================
export class LevelSelect {
    constructor(modalManager, onSelect) {
        this.modalManager = modalManager;
        this.onSelect = onSelect;
        this.grid = document.getElementById('levelGrid');
        this.filterButtons = document.querySelectorAll('[data-filter]');
        this.currentFilter = 'all';
        this.bind();
    }

    bind() {
        this.filterButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                this.filterButtons.forEach((b) => b.classList.remove('chip--active'));
                btn.classList.add('chip--active');
                this.currentFilter = btn.dataset.filter;
                this.render();
            });
        });
    }

    render() {
        if (!this.grid) return;
        const progress = Storage.getProgress();
        const levels = getLevelsByTier(this.currentFilter);
        this.grid.innerHTML = '';
        levels.forEach((level) => {
            const stars = progress.stars[level.id] || 0;
            const locked = level.id > progress.unlocked;
            const card = document.createElement('div');
            card.className = `level-card ${locked ? 'is-locked' : ''}`;
            card.innerHTML = `
                <div class="level-card__num">${level.id}</div>
                <div class="level-card__name">${level.name.toUpperCase()}</div>
                <div class="level-card__stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                ${locked ? '<div class="level-card__lock">🔒</div>' : ''}
            `;
            if (!locked) {
                card.addEventListener('click', () => {
                    Audio.click();
                    vibrate(20);
                    this.modalManager.close();
                    this.onSelect(level.id);
                });
            }
            this.grid.appendChild(card);
        });
    }
}

// ============================================================
// Achievements Renderer
// ============================================================
export class AchievementsView {
    constructor() {
        this.grid = document.getElementById('badgeGrid');
        this.lvlEl = document.getElementById('achPlayerLevel');
        this.xpEl = document.getElementById('achPlayerXp');
        this.unlockedEl = document.getElementById('achUnlocked');
    }

    render() {
        const state = Achievements.getState();
        if (this.lvlEl)  this.lvlEl.textContent = state.level;
        if (this.xpEl)   this.xpEl.textContent = state.xp;
        if (this.unlockedEl) this.unlockedEl.textContent = `${state.unlockedCount} / ${state.totalBadges}`;
        if (!this.grid) return;
        const badges = Achievements.getBadges();
        this.grid.innerHTML = '';
        badges.forEach((b) => {
            const card = document.createElement('div');
            card.className = `badge-card ${b.unlocked ? '' : 'is-locked'}`;
            card.innerHTML = `
                <div class="badge-card__icon">${b.icon}</div>
                <div class="badge-card__name">${b.name}</div>
            `;
            card.title = b.desc;
            this.grid.appendChild(card);
        });
    }
}

// ============================================================
// Leaderboard View
// ============================================================
export class LeaderboardView {
    constructor() {
        this.tableEl = document.getElementById('lbTable');
        this.filterButtons = document.querySelectorAll('[data-lb]');
        this.currentFilter = 'all';
        this.bind();
    }

    bind() {
        this.filterButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                this.filterButtons.forEach((b) => b.classList.remove('chip--active'));
                btn.classList.add('chip--active');
                this.currentFilter = btn.dataset.lb;
                this.render();
            });
        });
    }

    render() {
        if (!this.tableEl) return;
        const top = Leaderboard.getTop(this.currentFilter, 10);
        if (top.length === 0) {
            this.tableEl.innerHTML = `
                <div class="lb-empty">
                    <div class="lb-empty__emoji">🎯</div>
                    <p>No scores yet. Play your first game!</p>
                </div>`;
            return;
        }
        this.tableEl.innerHTML = '';
        top.forEach((entry) => {
            const row = document.createElement('div');
            row.className = `lb-row ${entry.rank === 1 ? 'lb-row--gold' : entry.rank === 2 ? 'lb-row--silver' : entry.rank === 3 ? 'lb-row--bronze' : ''}`;
            row.innerHTML = `
                <div class="lb-row__rank">${entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : '#' + entry.rank}</div>
                <div>
                    <div class="lb-row__name">LVL ${entry.level} · ${entry.name}</div>
                    <div class="lb-row__meta">${entry.dateLabel}</div>
                </div>
                <div class="lb-row__score">${entry.score.toLocaleString()}</div>
            `;
            this.tableEl.appendChild(row);
        });
    }
}

// ============================================================
// Settings Manager
// ============================================================
export class SettingsManager {
    constructor(toaster, onChange) {
        this.toaster = toaster;
        this.onChange = onChange;
        this.volumeInput = document.getElementById('setVolume');
        this.hapticsInput = document.getElementById('setHaptics');
        this.particlesInput = document.getElementById('setParticles');
        this.reducedMotionInput = document.getElementById('setReducedMotion');
        this.musicInput = document.getElementById('setMusic');
        this.voiceInput = document.getElementById('setVoice');
        this.dragAimInput = document.getElementById('setDragAim');
        this.resetBtn = document.getElementById('setReset');
        this.volumeLabel = document.getElementById('setVolumeValue');
        this.bind();
        this.load();
    }

    bind() {
        this.volumeInput?.addEventListener('input', () => {
            const v = parseInt(this.volumeInput.value);
            if (this.volumeLabel) this.volumeLabel.textContent = `${v}%`;
            Audio.setVolume(v / 100);
            // Music is quieter than SFX
            Music.setVolume((v / 100) * 0.3);
            const s = Storage.getSettings();
            s.volume = v;
            Storage.saveSettings(s);
            // If user mutes, stop music; if they unmute and music was on, restart
            if (v === 0 && Music.timer) Music.stop();
            else if (v > 0 && Storage.getSettings().music && !Music.timer) Music.setEnabled(true);
            this.onChange?.(s);
        });

        this.hapticsInput?.addEventListener('change', () => {
            const s = Storage.getSettings();
            s.haptics = this.hapticsInput.checked;
            Storage.saveSettings(s);
            setHapticsEnabled(s.haptics);
            if (s.haptics) vibrate(30);
            this.onChange?.(s);
        });

        this.particlesInput?.addEventListener('change', () => {
            const s = Storage.getSettings();
            s.particles = this.particlesInput.value;
            Storage.saveSettings(s);
            this.onChange?.(s);
        });

        this.reducedMotionInput?.addEventListener('change', () => {
            const s = Storage.getSettings();
            s.reducedMotion = this.reducedMotionInput.checked;
            Storage.saveSettings(s);
            document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
            this.onChange?.(s);
        });

        // v1.1 — Music toggle
        this.musicInput?.addEventListener('change', () => {
            const s = Storage.getSettings();
            s.music = this.musicInput.checked;
            Storage.saveSettings(s);
            // Music requires audio context (user gesture)
            Audio.init();
            Audio.resume();
            if (s.music) {
                Music.setVolume((s.volume / 100) * 0.3);
                Music.setEnabled(s.volume > 0);
                this.toaster?.success('🎵 Music ON');
            } else {
                Music.setEnabled(false);
                this.toaster?.success('Music OFF');
            }
            this.onChange?.(s);
        });

        // v1.1 — Voice toggle
        this.voiceInput?.addEventListener('change', () => {
            const s = Storage.getSettings();
            s.voice = this.voiceInput.checked;
            Storage.saveSettings(s);
            Voice.unlock();
            Voice.setEnabled(s.voice);
            if (s.voice) {
                setTimeout(() => Voice.say('Voice enabled'), 200);
                this.toaster?.success('🗣️ Voice ON');
            } else {
                this.toaster?.success('Voice OFF');
            }
            this.onChange?.(s);
        });

        // v1.1 — Drag-to-aim toggle (mobile)
        this.dragAimInput?.addEventListener('change', () => {
            const s = Storage.getSettings();
            s.dragAim = this.dragAimInput.checked;
            Storage.saveSettings(s);
            this.toaster?.success(s.dragAim ? 'Drag-to-aim ON' : 'Tap-to-shoot ON');
            this.onChange?.(s);
        });

        this.resetBtn?.addEventListener('click', () => {
            if (confirm('This will erase ALL progress, badges, and scores. Continue?')) {
                Storage.wipeAll();
                Achievements.reset();
                Leaderboard.reset();
                Music.setEnabled(false);
                Voice.setEnabled(false);
                this.toaster?.success('Progress reset. Reloading…');
                setTimeout(() => location.reload(), 800);
            }
        });
    }

    load() {
        const s = Storage.getSettings();
        if (this.volumeInput) this.volumeInput.value = s.volume;
        if (this.volumeLabel) this.volumeLabel.textContent = `${s.volume}%`;
        if (this.hapticsInput) this.hapticsInput.checked = s.haptics;
        if (this.particlesInput) this.particlesInput.value = s.particles;
        if (this.reducedMotionInput) this.reducedMotionInput.checked = !!s.reducedMotion;
        if (this.musicInput) this.musicInput.checked = !!s.music;
        if (this.voiceInput) this.voiceInput.checked = !!s.voice;
        if (this.dragAimInput) this.dragAimInput.checked = s.dragAim !== false;
        Audio.setVolume(s.volume / 100);
        Music.setVolume((s.volume / 100) * 0.3);
        setHapticsEnabled(s.haptics);
        Voice.setEnabled(!!s.voice);
        // Music starts only on first user gesture — defer to Audio.init()
        if (s.reducedMotion) document.documentElement.classList.add('reduced-motion');
    }
}

// ============================================================
// Top Bar (player level/XP display)
// ============================================================
export class TopBar {
    constructor() {
        this.levelEl = document.getElementById('playerLevel');
        this.xpFillEl = document.getElementById('playerXpFill');
        this.xpTextEl = document.getElementById('playerXpText');
    }

    update() {
        const s = Achievements.getState();
        if (this.levelEl) this.levelEl.textContent = s.level;
        if (this.xpFillEl) this.xpFillEl.style.width = `${Math.round(s.xpProgress * 100)}%`;
        if (this.xpTextEl) {
            const intoLevel = s.xp % 100;
            this.xpTextEl.textContent = `${intoLevel} / 100 XP`;
        }
    }
}

// ============================================================
// Stats Bar (in-game score, high score, shots, streak)
// ============================================================
export class StatsBar {
    constructor() {
        this.scoreEl = document.getElementById('score');
        this.highEl = document.getElementById('highScore');
        this.shotsEl = document.getElementById('bubblesLeft');
        this.streakEl = document.getElementById('streakValue');
        // v1.1 — Floating HUD mirrors (only visible during play)
        this.floatScoreEl = document.getElementById('floatScore');
        this.floatShotsEl = document.getElementById('floatShots');
        this.floatStreakEl = document.getElementById('floatStreak');
    }

    update({ score, highScore, shotsLeft, streak }) {
        this.setBump(this.scoreEl, score);
        if (this.highEl) this.highEl.textContent = highScore;
        if (this.shotsEl) this.shotsEl.textContent = shotsLeft;
        if (this.streakEl) this.streakEl.textContent = streak;

        // v1.1 — Mirror into floating HUD with bump animation
        this.setBump(this.floatScoreEl, score);
        this.setBump(this.floatShotsEl, shotsLeft);
        if (this.floatStreakEl) this.floatStreakEl.textContent = streak;
    }

    setBump(el, value) {
        if (!el) return;
        el.textContent = value;
        el.classList.remove('is-bump');
        // Force reflow to restart animation
        void el.offsetWidth;
        el.classList.add('is-bump');
    }
}

// ============================================================
// Level Bar (in-game level name + progress)
// ============================================================
export class LevelBar {
    constructor() {
        this.nameEl = document.getElementById('levelName');
        this.progressEl = document.getElementById('levelProgress');
        this.fillEl = document.getElementById('levelFill');
    }

    update({ level, popped, total }) {
        if (this.nameEl) this.nameEl.textContent = `LEVEL ${level.id} · ${level.name.toUpperCase()}`;
        if (this.progressEl) this.progressEl.textContent = `${popped} / ${total}`;
        if (this.fillEl) this.fillEl.style.width = `${total ? Math.round((popped / total) * 100) : 0}%`;
    }
}

// ============================================================
// Power-up Dock
// ============================================================
export class PowerupDock {
    constructor(onActivate) {
        this.onActivate = onActivate;
        this.buttons = {
            bomb:      { btn: document.getElementById('powerupBomb'),      count: document.getElementById('powerupBombCount') },
            rainbow:   { btn: document.getElementById('powerupRainbow'),   count: document.getElementById('powerupRainbowCount') },
            lightning: { btn: document.getElementById('powerupLightning'), count: document.getElementById('powerupLightningCount') },
        };
        this.bind();
    }

    bind() {
        Object.entries(this.buttons).forEach(([type, refs]) => {
            refs.btn?.addEventListener('click', () => this.onActivate?.(type));
        });
    }

    update(inventory, activeType) {
        Object.entries(this.buttons).forEach(([type, refs]) => {
            const count = inventory[type] || 0;
            if (refs.count) refs.count.textContent = count;
            if (refs.btn) {
                refs.btn.disabled = count <= 0;
                refs.btn.classList.toggle('is-active', activeType === type);
            }
        });
    }
}

// ============================================================
// Screen Shake helper
// ============================================================
export function shakeElement(el, intensity = 'heavy') {
    if (!el) return;
    el.classList.remove('shake-light', 'shake-heavy');
    void el.offsetWidth;
    el.classList.add(intensity === 'heavy' ? 'shake-heavy' : 'shake-light');
    setTimeout(() => el.classList.remove('shake-light', 'shake-heavy'), 500);
}

// ============================================================
// Loading Screen Manager
// ============================================================
export class LoadingScreen {
    constructor() {
        this.el = document.getElementById('loadingScreen');
        this.fill = document.getElementById('loadingBarFill');
        this.percent = document.getElementById('loadingPercent');
        this.progress = 0;
    }

    set(value) {
        this.progress = Math.max(this.progress, Math.min(100, value));
        if (this.fill) this.fill.style.width = `${this.progress}%`;
        if (this.percent) this.percent.textContent = `${Math.round(this.progress)}%`;
    }

    hide() {
        if (!this.el) return;
        this.el.classList.add('is-hidden');
        setTimeout(() => { this.el.style.display = 'none'; }, 400);
    }
}