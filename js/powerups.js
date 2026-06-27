// ============================================================
// BUBBLE POP! — Power-ups System
// ============================================================
// 3 power-up types: Bomb, Rainbow, Lightning.
// Inventory is bounded per type; activated before shooting.
// ============================================================

import { ALL_COLORS } from './levels.js';

export const POWERUP_TYPES = {
    bomb:      { id: 'bomb',      emoji: '💣', name: 'Bomb',      desc: 'Explodes on contact, clears nearby bubbles' },
    rainbow:   { id: 'rainbow',   emoji: '🌈', name: 'Rainbow',   desc: 'Matches any color on first contact' },
    lightning: { id: 'lightning', emoji: '⚡', name: 'Lightning', desc: 'Clears entire vertical column on contact' },
};

const MAX_PER_TYPE = 3;

class PowerupSystem {
    constructor() {
        this.inventory = { bomb: 0, rainbow: 0, lightning: 0 };
        this.activeType = null; // currently selected power-up to fire
    }

    reset() {
        this.inventory = { bomb: 0, rainbow: 0, lightning: 0 };
        this.activeType = null;
    }

    /**
     * Award a random power-up after a big match (4+ bubbles).
     * Returns the type awarded.
     */
    awardRandom() {
        const types = Object.keys(POWERUP_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];
        this.add(type);
        return type;
    }

    /**
     * Add one to inventory (capped at MAX_PER_TYPE).
     */
    add(type) {
        if (!this.inventory.hasOwnProperty(type)) return false;
        this.inventory[type] = Math.min(MAX_PER_TYPE, this.inventory[type] + 1);
        return true;
    }

    /**
     * Use (decrement) a power-up.
     */
    consume(type) {
        if (this.inventory[type] <= 0) return false;
        this.inventory[type]--;
        if (this.inventory[type] === 0 && this.activeType === type) {
            this.activeType = null;
        }
        return true;
    }

    /**
     * Toggle power-up as active for next shot.
     */
    setActive(type) {
        if (!this.inventory.hasOwnProperty(type)) return false;
        if (this.inventory[type] <= 0) return false;
        this.activeType = this.activeType === type ? null : type;
        return true;
    }

    /**
     * Get the currently active type (or null).
     */
    getActive() {
        return this.activeType;
    }

    /**
     * Has any power-ups available?
     */
    hasAny() {
        return this.inventory.bomb > 0 || this.inventory.rainbow > 0 || this.inventory.lightning > 0;
    }

    /**
     * Serialize for debug.
     */
    describe() {
        return { ...this.inventory, active: this.activeType };
    }
}

export const Powerups = new PowerupSystem();

/**
 * Apply power-up effect when a bubble attaches.
 * Returns { removeAt: [{x,y}], extraCheckColor: string|null, extraFalling: [bubble] }
 */
export function applyPowerupEffect(type, attachX, attachY, color, bubbles) {
    const result = { removeAt: [], extraCheckColor: null, falling: [], scoreBonus: 0 };

    switch (type) {
        case 'bomb':
            // Clear all bubbles within 75px radius
            const RADIUS = 75;
            bubbles.forEach((b) => {
                const dx = b.x - attachX;
                const dy = b.y - attachY;
                if (dx * dx + dy * dy <= RADIUS * RADIUS) {
                    result.removeAt.push(b);
                }
            });
            result.scoreBonus = result.removeAt.length * 15;
            break;

        case 'rainbow':
            // Find a same-color match for the first adjacent bubble, or pop all of one color (use 'nearest' strategy)
            let nearest = null;
            let minDist = Infinity;
            bubbles.forEach((b) => {
                const dx = b.x - attachX;
                const dy = b.y - attachY;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minDist && d < 60) {
                    minDist = d;
                    nearest = b;
                }
            });
            if (nearest) {
                result.extraCheckColor = nearest.color;
                result.scoreBonus = 50;
            }
            break;

        case 'lightning':
            // Clear entire column at attachX
            const colX = attachX;
            bubbles.forEach((b) => {
                if (Math.abs(b.x - colX) < 25) {
                    result.removeAt.push(b);
                }
            });
            result.scoreBonus = result.removeAt.length * 20;
            break;
    }

    return result;
}