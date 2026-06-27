// ============================================================
// BUBBLE POP! — Level Configuration
// ============================================================
// 20+ levels across Easy / Medium / Hard tiers with
// progression, star thresholds, and unlock requirements.
// ============================================================

export const LEVELS = [
    // ===== EASY (1-7) =====
    { id: 1,  name: 'Sunny Start',    tier: 'easy',   rows: 5, density: 0.55, colors: 4, shots: 60, stars: { bronze: 500,  silver: 1000, gold: 1800 } },
    { id: 2,  name: 'Pink Path',      tier: 'easy',   rows: 5, density: 0.60, colors: 4, shots: 55, stars: { bronze: 700,  silver: 1200, gold: 2000 } },
    { id: 3,  name: 'Blue Lagoon',    tier: 'easy',   rows: 6, density: 0.55, colors: 5, shots: 55, stars: { bronze: 900,  silver: 1500, gold: 2400 } },
    { id: 4,  name: 'Green Garden',   tier: 'easy',   rows: 6, density: 0.60, colors: 5, shots: 50, stars: { bronze: 1100, silver: 1800, gold: 2800 } },
    { id: 5,  name: 'Orange Oasis',   tier: 'easy',   rows: 6, density: 0.65, colors: 5, shots: 50, stars: { bronze: 1300, silver: 2100, gold: 3200 } },
    { id: 6,  name: 'Yellow Yard',    tier: 'easy',   rows: 7, density: 0.60, colors: 6, shots: 50, stars: { bronze: 1500, silver: 2500, gold: 3800 } },
    { id: 7,  name: 'Pastel Plains',  tier: 'easy',   rows: 7, density: 0.65, colors: 6, shots: 45, stars: { bronze: 1700, silver: 2800, gold: 4200 } },

    // ===== MEDIUM (8-14) =====
    { id: 8,  name: 'Color Storm',    tier: 'medium', rows: 7, density: 0.70, colors: 6, shots: 45, stars: { bronze: 2000, silver: 3200, gold: 4800 } },
    { id: 9,  name: 'Midnight Maze',  tier: 'medium', rows: 8, density: 0.65, colors: 7, shots: 45, stars: { bronze: 2300, silver: 3600, gold: 5400 } },
    { id: 10, name: 'Rainbow Ridge',  tier: 'medium', rows: 8, density: 0.70, colors: 7, shots: 40, stars: { bronze: 2600, silver: 4000, gold: 6000 } },
    { id: 11, name: 'Bubble Tower',   tier: 'medium', rows: 8, density: 0.75, colors: 7, shots: 40, stars: { bronze: 2900, silver: 4400, gold: 6600 } },
    { id: 12, name: 'Color Clash',    tier: 'medium', rows: 9, density: 0.70, colors: 7, shots: 40, stars: { bronze: 3200, silver: 4800, gold: 7200 } },
    { id: 13, name: 'Pop Frenzy',     tier: 'medium', rows: 9, density: 0.75, colors: 7, shots: 35, stars: { bronze: 3500, silver: 5200, gold: 7800 } },
    { id: 14, name: 'Hex Haven',      tier: 'medium', rows: 9, density: 0.80, colors: 7, shots: 35, stars: { bronze: 3800, silver: 5600, gold: 8400 } },

    // ===== HARD (15-20) =====
    { id: 15, name: 'Crystal Canyon', tier: 'hard',   rows: 9,  density: 0.85, colors: 7, shots: 35, stars: { bronze: 4500, silver: 6500, gold: 9500  } },
    { id: 16, name: 'Neon Nightmare', tier: 'hard',   rows: 10, density: 0.85, colors: 7, shots: 30, stars: { bronze: 5000, silver: 7200, gold: 10500 } },
    { id: 17, name: 'Chaos Chamber',  tier: 'hard',   rows: 10, density: 0.90, colors: 7, shots: 30, stars: { bronze: 5500, silver: 7900, gold: 11500 } },
    { id: 18, name: 'Lava Lake',      tier: 'hard',   rows: 10, density: 0.95, colors: 7, shots: 28, stars: { bronze: 6000, silver: 8600, gold: 12500 } },
    { id: 19, name: 'Volcano Vault',  tier: 'hard',   rows: 11, density: 0.90, colors: 7, shots: 28, stars: { bronze: 7000, silver: 9800, gold: 14000 } },
    { id: 20, name: 'Final Frontier', tier: 'hard',   rows: 11, density: 0.95, colors: 7, shots: 25, stars: { bronze: 8500, silver: 12000, gold: 17000 } },
];

export const COLORS = {
    easy: ['#FF6B6B', '#4ECDC4', '#FFE15D', '#B983FF'],
    medium: ['#FF6B6B', '#4ECDC4', '#FFE15D', '#B983FF', '#FF9F45', '#7ED957'],
    hard: ['#FF6B6B', '#4ECDC4', '#FFE15D', '#B983FF', '#FF9F45', '#7ED957', '#FF6BB5'],
};

export const ALL_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE15D', '#B983FF', '#FF9F45', '#7ED957', '#FF6BB5'];

/**
 * Get a level by id.
 */
export function getLevel(id) {
    return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

/**
 * Compute 0–3 stars for a given score on a level.
 */
export function getStarsForScore(level, score) {
    if (score >= level.stars.gold)   return 3;
    if (score >= level.stars.silver) return 2;
    if (score >= level.stars.bronze) return 1;
    return 0;
}

/**
 * Filter levels by tier.
 */
export function getLevelsByTier(tier) {
    if (tier === 'all') return LEVELS;
    return LEVELS.filter((l) => l.tier === tier);
}

/**
 * Pick palette for a level.
 */
export function getPaletteForLevel(level) {
    const palette = COLORS[level.tier] || ALL_COLORS;
    return palette.slice(0, level.colors);
}