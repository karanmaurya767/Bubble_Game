// ============================================================
// BUBBLE POP! — Canvas Particle System
// ============================================================
// Renders particles on a separate canvas overlay for pop effects,
// score popups, combo flashes, and confetti. Object-pooled for perf.
// ============================================================

import { Storage } from './storage.js';

class ParticleSystem {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.popups = [];
        this.shake = { x: 0, y: 0, intensity: 0 };
        this.settings = Storage.getSettings();
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.lastTime = 0;
        this.running = false;
    }

    /**
     * Attach to overlay canvas (positioned absolutely over game canvas).
     */
    init(targetCanvas) {
        this.canvas = targetCanvas;
        this.ctx = targetCanvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.running = true;
        this.loop();
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(this.dpr, this.dpr);
    }

    loop(time = 0) {
        if (!this.running) return;
        const dt = Math.min(32, time - this.lastTime);
        this.lastTime = time;
        this.update(dt / 16.67); // normalized to 60fps frame
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * Quality setting caps particle counts.
     */
    getQualityMul() {
        const q = this.settings.particles || 'med';
        return q === 'low' ? 0.4 : q === 'high' ? 1.2 : 0.8;
    }

    update(dt) {
        const mul = this.getQualityMul();

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
            p.rotation += p.rotSpeed * dt;
            p.vx *= p.friction;
            p.vy *= p.friction;
        }

        // Popups
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.popups.splice(i, 1);
                continue;
            }
            p.y += p.vy * dt;
            p.x += p.vx * dt;
            p.vy *= 0.96;
        }

        // Screen shake decay
        if (this.shake.intensity > 0) {
            this.shake.intensity *= 0.85;
            this.shake.x = (Math.random() - 0.5) * this.shake.intensity;
            this.shake.y = (Math.random() - 0.5) * this.shake.intensity;
            if (this.shake.intensity < 0.5) {
                this.shake.intensity = 0;
                this.shake.x = 0;
                this.shake.y = 0;
            }
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        ctx.clearRect(0, 0, w, h);

        ctx.save();
        ctx.translate(this.shake.x, this.shake.y);

        // Particles
        for (const p of this.particles) {
            const alpha = Math.min(1, p.life / p.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            if (p.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.shape === 'square') {
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            } else if (p.shape === 'star') {
                this.drawStar(ctx, 0, 0, 5, p.size, p.size / 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Popups (text)
        for (const p of this.popups) {
            const alpha = Math.min(1, p.life / p.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.scale(p.scale, p.scale);
            ctx.font = `900 ${p.fontSize}px ${p.font || "'Bungee', sans-serif"}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.color;
            ctx.strokeStyle = '#1A1A1A';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.strokeText(p.text, 0, 0);
            ctx.fillText(p.text, 0, 0);
            ctx.restore();
        }

        ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerR, innerR) {
        let rot = Math.PI / 2 * 3;
        let x = cx, y = cy;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerR);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerR;
            y = cy + Math.sin(rot) * outerR;
            ctx.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerR;
            y = cy + Math.sin(rot) * innerR;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.closePath();
    }

    /**
     * Spawn a burst of particles at (x, y) with the bubble's color.
     */
    pop(x, y, color, count = 10) {
        const mul = this.getQualityMul();
        const total = Math.max(3, Math.floor(count * mul));
        for (let i = 0; i < total; i++) {
            const angle = (Math.PI * 2 * i) / total + Math.random() * 0.4;
            const speed = 2 + Math.random() * 4;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                gravity: 0.3,
                friction: 0.98,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3,
                size: 4 + Math.random() * 6,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                color,
                shape: Math.random() > 0.5 ? 'circle' : 'square',
            });
        }
    }

    /**
     * Floating score popup (+10, +50, etc).
     */
    scorePopup(x, y, text, color = '#FFE15D') {
        this.popups.push({
            x, y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -2,
            life: 40,
            maxLife: 40,
            scale: 0.5,
            fontSize: 28,
            text,
            color,
        });
        // Animate scale up via life-based interpolation in draw
        const popup = this.popups[this.popups.length - 1];
        const targetScale = 1.2;
        const start = performance.now();
        const anim = () => {
            const t = Math.min(1, (performance.now() - start) / 200);
            popup.scale = 0.5 + (targetScale - 0.5) * (1 - Math.pow(1 - t, 3));
            if (t < 1) requestAnimationFrame(anim);
        };
        anim();
    }

    /**
     * Trigger screen shake.
     */
    shakeScreen(intensity = 6) {
        this.shake.intensity = intensity;
    }

    /**
     * Confetti burst for win screen.
     */
    confetti(width, height, count = 80) {
        const colors = ['#FFE15D', '#FF6BB5', '#4DA8FF', '#7ED957', '#FF9F45', '#B983FF'];
        const mul = this.getQualityMul();
        const total = Math.floor(count * mul);
        for (let i = 0; i < total; i++) {
            this.particles.push({
                x: Math.random() * width,
                y: -20 - Math.random() * 50,
                vx: (Math.random() - 0.5) * 4,
                vy: 2 + Math.random() * 3,
                gravity: 0.15,
                friction: 1,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.4,
                size: 8 + Math.random() * 8,
                life: 120 + Math.random() * 60,
                maxLife: 180,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: Math.random() > 0.5 ? 'square' : 'circle',
            });
        }
    }

    /**
     * Clear everything (used on restart).
     */
    clear() {
        this.particles.length = 0;
        this.popups.length = 0;
        this.shake.intensity = 0;
        this.shake.x = 0;
        this.shake.y = 0;
    }

    /**
     * Pause animation loop (for pause overlay).
     */
    pause() { this.running = false; }
    resume() {
        if (!this.running) {
            this.running = true;
            this.lastTime = 0;
            this.loop();
        }
    }
}

export const Particles = new ParticleSystem();