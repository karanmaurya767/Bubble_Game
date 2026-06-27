// ============================================================
// BUBBLE POP! — Achievements & XP System
// ============================================================
// 15+ unlockable badges. XP accumulates → player levels up.
// Streak counter for daily play.
// ============================================================

import { Storage } from './storage.js';

export const BADGES = [
    { id: 'first_pop',     icon: '🫧', name: 'First Pop',          desc: 'Pop your first bubble' },
    { id: 'combo_3',       icon: '🔥', name: 'Combo Starter',      desc: 'Pop 3 bubbles in one shot' },
    { id: 'combo_5',       icon: '💥', name: 'Combo Master',       desc: 'Pop 5+ bubbles in one shot' },
    { id: 'combo_7',       icon: '🌟', name: 'Combo Legend',       desc: 'Pop 7+ bubbles in one shot' },
    { id: 'level_5',       icon: '🎯', name: 'Halfway There',      desc: 'Complete level 5' },
    { id: 'level_10',      icon: '🏅', name: 'Ten Down',           desc: 'Complete level 10' },
    { id: 'level_15',      icon: '🏆', name: 'Halfway Hero',       desc: 'Complete level 15' },
    { id: 'level_20',      icon: '👑', name: 'Bubble Royalty',     desc: 'Complete all 20 levels' },
    { id: 'perfect_3',     icon: '⭐', name: 'Triple Star',        desc: 'Earn 3 stars on 3 levels' },
    { id: 'perfect_10',    icon: '🌠', name: 'Star Collector',     desc: 'Earn 3 stars on 10 levels' },
    { id: 'powerup_first', icon: '💣', name: 'Power Up',           desc: 'Use your first power-up' },
    { id: 'powerup_all',   icon: '🧰', name: 'Arsenal',            desc: 'Use all 3 power-up types' },
    { id: 'streak_3',      icon: '🔥', name: 'On Fire',            desc: 'Play 3 days in a row' },
    { id: 'streak_7',      icon: '⚡', name: 'Weekly Warrior',     desc: 'Play 7 days in a row' },
    { id: 'score_5k',      icon: '💎', name: 'High Scorer',        desc: 'Score 5,000 in a single game' },
    { id: 'score_10k',     icon: '💠', name: 'Diamond Hands',      desc: 'Score 10,000 in a single game' },
];

const XP_PER_LEVEL = 100;

/**
 * Compute level from XP.
 */
export function levelFromXP(xp) {
    return Math.floor(1 + xp / XP_PER_LEVEL);
}

/**
 * Compute XP progress within current level (0..1).
 */
export function xpProgressInLevel(xp) {
    const intoLevel = xp % XP_PER_LEVEL;
    return intoLevel / XP_PER_LEVEL;
}

class AchievementSystem {
    constructor() {
        this.state = Storage.getAchievements(); // { xp, level, unlocked }
        this.listeners = new Set();
        this.powerupTypesUsed = new Set();
    }

    /**
     * Add XP. Returns the new level if it changed.
     */
    addXP(amount) {
        const prevLevel = this.state.level;
        this.state.xp += amount;
        this.state.level = levelFromXP(this.state.xp);
        Storage.saveAchievements(this.state);
        if (this.state.level > prevLevel) {
            this.emit({ type: 'levelup', level: this.state.level });
        }
        return this.state.level;
    }

    /**
     * Unlock a badge by id. Returns true if newly unlocked.
     */
    unlock(badgeId) {
        if (this.state.unlocked[badgeId]) return false;
        const badge = BADGES.find((b) => b.id === badgeId);
        if (!badge) return false;
        this.state.unlocked[badgeId] = Date.now();
        this.addXP(25);
        Storage.saveAchievements(this.state);
        this.emit({ type: 'unlock', badge });
        return true;
    }

    /**
     * Check and unlock contextual achievements based on game state.
     */
    checkGameState(state) {
        // state: { score, matchesThisShot, level, starsByLevel, combo, powerupUsed }
        if (state.score >= 5000) this.unlock('score_5k');
        if (state.score >= 10000) this.unlock('score_10k');
        if (state.matchesThisShot >= 7) this.unlock('combo_7');
        else if (state.matchesThisShot >= 5) this.unlock('combo_5');
        else if (state.matchesThisShot >= 3) this.unlock('combo_3');

        const clearedLevels = Object.keys(state.starsByLevel || {}).filter((id) => state.starsByLevel[id] > 0).length;
        if (clearedLevels >= 3) this.unlock('perfect_3');
        if (clearedLevels >= 10) this.unlock('perfect_10');

        const goldLevels = Object.values(state.starsByLevel || {}).filter((s) => s === 3).length;
        if (goldLevels >= 3) this.unlock('perfect_3'); // alias
    }

    /**
     * Hook for UI to react.
     */
    on(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit(event) {
        this.listeners.forEach((l) => l(event));
    }

    /**
     * Reset (for "Reset all progress" in Settings).
     */
    reset() {
        this.state = { xp: 0, level: 1, unlocked: {} };
        this.powerupTypesUsed.clear();
        Storage.saveAchievements(this.state);
    }

    getState() {
        return {
            ...this.state,
            xpProgress: xpProgressInLevel(this.state.xp),
            totalBadges: BADGES.length,
            unlockedCount: Object.keys(this.state.unlocked).length,
        };
    }

    getBadges() {
        return BADGES.map((b) => ({
            ...b,
            unlocked: !!this.state.unlocked[b.id],
            unlockedAt: this.state.unlocked[b.id] || null,
        }));
    }
}

export const Achievements = new AchievementSystem();