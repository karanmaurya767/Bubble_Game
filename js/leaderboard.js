// ============================================================
// BUBBLE POP! — Leaderboard
// ============================================================
// Local-only top scores with time filters (today / week / all).
// ============================================================

import { Storage } from './storage.js';

const DAY_MS = 24 * 60 * 60 * 1000;

class LeaderboardSystem {
    constructor() {
        this.entries = Storage.getLeaderboard();
    }

    /**
     * Submit a new score.
     */
    submit({ score, level, name }) {
        if (score <= 0) return;
        Storage.addToLeaderboard({ score, level, name });
        this.entries = Storage.getLeaderboard();
    }

    /**
     * Filter entries by time window.
     * @param {'today'|'week'|'all'} window
     */
    getFiltered(window = 'all') {
        const now = Date.now();
        return this.entries.filter((e) => {
            if (window === 'today') return (now - e.date) < DAY_MS;
            if (window === 'week')  return (now - e.date) < DAY_MS * 7;
            return true;
        });
    }

    /**
     * Top N from a filtered list, with rank (1-indexed).
     */
    getTop(window = 'all', n = 10) {
        return this.getFiltered(window)
            .sort((a, b) => b.score - a.score)
            .slice(0, n)
            .map((e, i) => ({
                ...e,
                rank: i + 1,
                dateLabel: this.formatDate(e.date),
            }));
    }

    formatDate(ts) {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return `Today ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }

    /**
     * Best score ever.
     */
    best() {
        return this.entries.reduce((max, e) => Math.max(max, e.score), 0);
    }

    reset() {
        Storage.remove(Storage.KEYS.LEADERBOARD);
        this.entries = [];
    }
}

export const Leaderboard = new LeaderboardSystem();