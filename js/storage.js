// ============================================================
// BUBBLE POP! — Centralized localStorage wrapper
// ============================================================
// Namespaced keys, JSON helpers, versioned for migrations.
// All persistent data flows through this single module.
// ============================================================

const NAMESPACE = 'bubblepop';
const VERSION = 1;

const KEYS = {
    PROGRESS:    `${NAMESPACE}:progress`,    // unlocked levels, stars, current level
    HIGH_SCORE:  `${NAMESPACE}:highScore`,   // legacy compat
    SETTINGS:    `${NAMESPACE}:settings`,    // sound, haptics, particles, reducedMotion
    ACHIEVEMENTS:`${NAMESPACE}:achievements`,// unlocked badges, XP, level
    LEADERBOARD: `${NAMESPACE}:leaderboard`, // top scores
    STREAK:      `${NAMESPACE}:streak`,      // daily streak
    ONBOARDING:  `${NAMESPACE}:onboarded`,   // has seen onboarding
};

/**
 * Safe JSON parse with fallback.
 */
function parseJSON(value, fallback) {
    if (value === null || value === undefined) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

/**
 * Read a namespaced key. Returns default if missing or invalid.
 */
export function get(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(key);
        return parseJSON(raw, defaultValue);
    } catch (e) {
        // localStorage may throw in private mode / quota errors
        console.warn('[storage] read failed:', e);
        return defaultValue;
    }
}

/**
 * Write a namespaced key. Returns true on success.
 */
export function set(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn('[storage] write failed:', e);
        return false;
    }
}

/**
 * Remove a single key.
 */
export function remove(key) {
    try { localStorage.removeItem(key); } catch {}
}

/**
 * Wipe all bubblepop data (used by Settings → Reset).
 */
export function wipeAll() {
    Object.values(KEYS).forEach(remove);
}

/**
 * One-time migration helper (currently no-op; future-proof).
 */
export function migrate() {
    const stored = get(`${NAMESPACE}:version`, 0);
    if (stored < VERSION) {
        set(`${NAMESPACE}:version`, VERSION);
    }
}

// ---------- Typed accessors (preferred) ----------

export const Storage = {
    KEYS,

    getProgress() {
        return get(KEYS.PROGRESS, {
            currentLevel: 1,
            stars: {}, // { [levelId]: 0|1|2|3 }
            unlocked: 1,
        });
    },

    saveProgress(data) {
        set(KEYS.PROGRESS, data);
    },

    getSettings() {
        return get(KEYS.SETTINGS, {
            volume: 80,
            haptics: true,
            particles: 'med', // low | med | high
            reducedMotion: false,
        });
    },

    saveSettings(data) {
        set(KEYS.SETTINGS, data);
    },

    getAchievements() {
        return get(KEYS.ACHIEVEMENTS, {
            xp: 0,
            level: 1,
            unlocked: {}, // { [badgeId]: timestamp }
        });
    },

    saveAchievements(data) {
        set(KEYS.ACHIEVEMENTS, data);
    },

    getLeaderboard() {
        return get(KEYS.LEADERBOARD, []);
    },

    addToLeaderboard(entry) {
        const lb = Storage.getLeaderboard();
        lb.push({
            score: entry.score,
            level: entry.level || 1,
            date: Date.now(),
            name: entry.name || 'PLAYER',
        });
        // Keep top 50 entries; sort by score desc
        lb.sort((a, b) => b.score - a.score);
        const trimmed = lb.slice(0, 50);
        set(KEYS.LEADERBOARD, trimmed);
        return trimmed;
    },

    getStreak() {
        return get(KEYS.STREAK, {
            count: 0,
            lastPlayed: 0,
        });
    },

    saveStreak(data) {
        set(KEYS.STREAK, data);
    },

    hasOnboarded() {
        return !!get(KEYS.ONBOARDING, false);
    },

    setOnboarded() {
        set(KEYS.ONBOARDING, true);
    },

    // legacy high score (kept for backward compat with existing saves)
    getHighScore() {
        return get(KEYS.HIGH_SCORE, 0);
    },

    setHighScore(value) {
        set(KEYS.HIGH_SCORE, value);
    },
};

// Run migration on load
migrate();