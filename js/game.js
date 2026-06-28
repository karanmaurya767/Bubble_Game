// ============================================================
// BUBBLE POP! — Core Game Engine (v2.0)
// ============================================================
// Canvas rendering, physics, matching, levels, power-ups, stats.
// Wires UI + audio + particles + achievements + leaderboard.
// ============================================================

import { Storage } from './storage.js';
import { Audio, Music, Voice, vibrate, hapticPop, hapticBigPop, hapticShoot, hapticBounce, hapticAchievement } from './audio.js';
import { Particles } from './particles.js';
import { LEVELS, getLevel, getPaletteForLevel, getStarsForScore } from './levels.js';
import { Powerups, POWERUP_TYPES, applyPowerupEffect } from './powerups.js';
import { Achievements } from './achievements.js';
import { Leaderboard } from './leaderboard.js';
import {
    Onboarding, ModalManager, Toaster, LevelSelect, AchievementsView, LeaderboardView,
    SettingsManager, TopBar, StatsBar, LevelBar, PowerupDock, shakeElement, LoadingScreen
} from './ui.js';

// ============================================================
// DOM References
// ============================================================
const dom = {
    canvas: document.getElementById('gameCanvas'),
    loadingScreen: document.getElementById('loadingScreen'),
    app: document.getElementById('app'),
    startScreen: document.getElementById('startScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    winScreen: document.getElementById('winScreen'),
    gameOverScreen: document.getElementById('gameOver'),
    pauseBtn: document.getElementById('pauseBtn'),
    startBtn: document.getElementById('startBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    quitBtn: document.getElementById('quitBtn'),
    winReplayBtn: document.getElementById('winReplayBtn'),
    winNextBtn: document.getElementById('winNextBtn'),
    winScoreEl: document.getElementById('winScore'),
    starsRow: document.getElementById('starsRow'),
    finalScoreEl: document.getElementById('finalScore'),
    gameOverHomeBtn: document.getElementById('gameOverHomeBtn'),
    gameOverRetryBtn: document.getElementById('gameOverRetryBtn'),
    // Dock buttons
    dockLevels: document.getElementById('dockLevels'),
    dockAchievements: document.getElementById('dockAchievements'),
    dockLeaderboard: document.getElementById('dockLeaderboard'),
    dockSettings: document.getElementById('dockSettings'),
    // v1.2 — Top strip + bottom dock
    topStrip: document.getElementById('gameTopStrip'),
    stripScore: document.getElementById('stripScore'),
    stripShots: document.getElementById('stripShots'),
    stripStreak: document.getElementById('stripStreak'),
    stripPauseBtn: document.getElementById('stripPauseBtn'),
    stripSettingsBtn: document.getElementById('stripSettingsBtn'),
    bottomDock: document.getElementById('gameBottomDock'),
    shooterPreviewCurrent: document.getElementById('shooterPreviewCurrent'),
    shooterPreviewNext: document.getElementById('shooterPreviewNext'),
};

// ============================================================
// Game Constants
// ============================================================
const BUBBLE_RADIUS = 20;
const ROWS = 11;
const COLS = 15;
const AIM_MIN_RAD = -Math.PI * 35 / 36;
const AIM_MAX_RAD = -Math.PI / 36;

const SETTINGS = Storage.getSettings();

// ============================================================
// Game State
// ============================================================
const state = {
    canvas: null,
    ctx: null,
    shooterX: 0,
    shooterY: 0,
    bubbles: [],
    currentBubble: null,
    nextBubble: null,
    shootingBubble: null,
    angle: -Math.PI / 2,
    gameRunning: false,
    paused: false,
    score: 0,
    highScore: Storage.getHighScore(),
    bubblesLeft: 50,
    mouseX: 0,
    mouseY: 0,
    fallingBubbles: [],
    lastBounceTime: 0,
    level: getLevel(1),
    palette: [],
    totalInitialBubbles: 0,
    matchesThisShot: 0,
    comboCount: 0,
    streak: 0, // daily streak counter
    recoilOffset: 0,
    settings: SETTINGS,
    // v1.1 — drag-aim state
    isAiming: false,
    lastTouchTime: 0,
    aimStartX: 0,
    aimStartY: 0,
};

// ============================================================
// UI Instances
// ============================================================
const loading = new LoadingScreen();
const modals = new ModalManager();
const toaster = new Toaster();
const onboarding = new Onboarding();
const topBar = new TopBar();
const statsBar = new StatsBar();
const levelBar = new LevelBar();
const powerupDock = new PowerupDock((type) => activatePowerup(type));
const achievementsView = new AchievementsView();
const leaderboardView = new LeaderboardView();
const settingsMgr = new SettingsManager(toaster, () => updateTopBar());
const levelSelect = new LevelSelect(modals, (id) => loadLevel(id));

// ============================================================
// Init
// ============================================================
async function init() {
    loading.set(10);
    state.canvas = dom.canvas;
    state.ctx = dom.canvas.getContext('2d');

    resizeCanvas();
    loading.set(30);

    // Particle overlay canvas
    setupParticleOverlay();
    loading.set(50);

    // Bind events
    bindEventHandlers();
    bindUIButtons();
    loading.set(70);

    // Initial state
    setShooterPos();
    updateTopBar();
    loadLevel(state.level.id);

    // Streak check (for first run of day)
    updateStreakOnLoad();
    loading.set(100);

    setTimeout(() => loading.hide(), 400);
    dom.app.hidden = false;

    // Show onboarding for first-time users
    if (!Storage.hasOnboarded()) {
        setTimeout(() => onboarding.show(), 300);
    } else {
        // Otherwise wait for user to click Start
        window.addEventListener('onboarding:done', () => { /* keep showing start screen */ });
    }

    // Run game loop continuously (renders even when not started, for ambient)
    requestAnimationFrame(gameLoop);
}

function setupParticleOverlay() {
    const frame = document.getElementById('gameFrame');
    let overlay = frame.querySelector('.particle-canvas');
    if (!overlay) {
        overlay = document.createElement('canvas');
        overlay.className = 'particle-canvas';
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '4';
        frame.appendChild(overlay);
    }
    Particles.init(overlay);
}

function resizeCanvas() {
    const frame = document.getElementById('gameFrame');
    if (!frame || !state.canvas) return;
    const rect = frame.getBoundingClientRect();
    state.canvas.width = rect.width;
    state.canvas.height = rect.height;
    state.canvas.style.width = `${rect.width}px`;
    state.canvas.style.height = `${rect.height}px`;
    setShooterPos();
}

function setShooterPos() {
    state.shooterX = state.canvas.width / 2;
    state.shooterY = state.canvas.height - 60;
}

// v1.2 — toggle full-view (top strip + bottom dock layout)
function setFullView(on) {
    if (!dom.app) return;
    dom.app.classList.toggle('in-game', !!on);
    if (dom.topStrip) dom.topStrip.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (dom.bottomDock) dom.bottomDock.setAttribute('aria-hidden', on ? 'false' : 'true');
    // Resize canvas after CSS settles so DPR/aspect updates correctly
    requestAnimationFrame(() => resizeCanvas());
    setTimeout(() => resizeCanvas(), 350);
}

// v1.2 — mirror current+next bubble colors into bottom-dock DOM preview
function updateShooterPreview() {
    if (dom.shooterPreviewCurrent && state.currentBubble) {
        dom.shooterPreviewCurrent.style.background = state.currentBubble.color;
    }
    if (dom.shooterPreviewNext && state.nextBubble) {
        dom.shooterPreviewNext.style.background = state.nextBubble.color;
    }
}

// ============================================================
// UI Update helpers
// ============================================================
function updateTopBar() {
    topBar.update();
}

function updateStatsBar() {
    statsBar.update({
        score: state.score,
        highScore: state.highScore,
        shotsLeft: state.bubblesLeft,
        streak: state.streak,
    });
}

function updateLevelBar() {
    const popped = state.totalInitialBubbles - state.bubbles.length - state.fallingBubbles.length;
    levelBar.update({
        level: state.level,
        popped: Math.max(0, popped),
        total: state.totalInitialBubbles,
    });
}

function updatePowerupDock() {
    powerupDock.update(Powerups.inventory, Powerups.activeType);
}

// ============================================================
// Level Loading
// ============================================================
function loadLevel(id) {
    const level = getLevel(id);
    state.level = level;
    state.palette = getPaletteForLevel(level);

    // Reset state
    state.bubbles = [];
    state.fallingBubbles = [];
    state.shootingBubble = null;
    state.score = 0;
    state.bubblesLeft = level.shots;
    state.angle = -Math.PI / 2;
    state.lastBounceTime = 0;
    state.comboCount = 0;
    Powerups.reset();
    state.matchesThisShot = 0;

    createBubbleGrid(level);
    state.totalInitialBubbles = state.bubbles.length;
    generateNextBubble();
    updateStatsBar();
    updateLevelBar();
    updatePowerupDock();
    updateShooterPreview(); // v1.2

    // Show game UI
    hideAllOverlays();
    dom.startScreen.classList.add('active');
    setFullView(false); // v1.2 — full HUD + start screen
}

function startLevel() {
    Audio.init();
    Audio.resume();
    // v1.2 — start music if enabled (safe no-op until first gesture)
    Music.tryStartOnGesture();
    state.gameRunning = true;
    state.paused = false;
    state.isAiming = false;
    hideAllOverlays();
    updateTopBar();
    updateShooterPreview();
    setFullView(true); // v1.2 — show top strip + bottom dock
}

function hideAllOverlays() {
    dom.startScreen.classList.remove('active');
    dom.pauseScreen.classList.remove('active');
    dom.winScreen.classList.remove('active');
    dom.gameOverScreen.classList.remove('active');
}

function createBubbleGrid(level) {
    state.bubbles = [];
    const rows = level.rows;
    const density = level.density;
    const palette = state.palette;
    const topMargin = 60;

    // Calculate column count that fits the canvas width
    const colCount = Math.floor(state.canvas.width / (BUBBLE_RADIUS * 2));

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < colCount; col++) {
            if (Math.random() < density) {
                const x = col * (BUBBLE_RADIUS * 2) + BUBBLE_RADIUS + (row % 2 === 1 ? BUBBLE_RADIUS : 0);
                const y = row * (BUBBLE_RADIUS * 1.8) + BUBBLE_RADIUS + topMargin;
                state.bubbles.push({
                    x, y,
                    color: palette[Math.floor(Math.random() * palette.length)],
                    row,
                    col,
                });
            }
        }
    }
}

// ============================================================
// Bubble Generation
// ============================================================
function generateNextBubble() {
    if (!state.currentBubble) {
        state.currentBubble = { x: state.shooterX, y: state.shooterY, color: randomColor(), vx: 0, vy: 0 };
    }
    if (!state.nextBubble) {
        state.nextBubble = { x: state.shooterX + 50, y: state.shooterY, color: randomColor() };
    }
    updateShooterPreview(); // v1.2
}

function randomColor() {
    return state.palette[Math.floor(Math.random() * state.palette.length)];
}

// ============================================================
// Power-up activation
// ============================================================
function activatePowerup(type) {
    if (Powerups.inventory[type] <= 0) {
        toaster.warning('No power-ups left!');
        return;
    }
    Powerups.setActive(type);
    updatePowerupDock();
    if (Powerups.activeType === type) {
        Audio.click();
        toaster.info(`${POWERUP_TYPES[type].emoji} ${POWERUP_TYPES[type].name.toUpperCase()} ARMED`, 1500, POWERUP_TYPES[type].emoji);
    } else {
        toaster.info('Power-up cancelled');
    }
}

// ============================================================
// Drawing
// ============================================================
function draw() {
    const ctx = state.ctx;
    if (!ctx) return;

    // Background sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, state.canvas.height);
    grad.addColorStop(0, '#B5E2FF');
    grad.addColorStop(0.6, '#E0F6FF');
    grad.addColorStop(1, '#FFE5F1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

    // Subtle dot pattern
    drawBgPattern(ctx);

    // Bubbles
    state.bubbles.forEach((b) => drawBubble(ctx, b.x, b.y, b.color));

    // Shooter
    drawShooter(ctx);

    // Current + next bubble
    if (state.currentBubble && !state.shootingBubble) {
        drawBubble(ctx, state.currentBubble.x, state.currentBubble.y, state.currentBubble.color);
        // 'Next' preview
        if (state.nextBubble) {
            ctx.save();
            ctx.globalAlpha = 0.6;
            drawBubble(ctx, state.nextBubble.x, state.nextBubble.y, state.nextBubble.color);
            ctx.restore();
        }
    }

    // Shooting bubble
    if (state.shootingBubble) {
        drawBubble(ctx, state.shootingBubble.x, state.shootingBubble.y, state.shootingBubble.color);
        if (Date.now() - state.lastBounceTime < 300) drawBounceArrow(ctx);
    }

    // Falling bubbles
    state.fallingBubbles.forEach((b) => drawBubble(ctx, b.x, b.y, b.color));

    // Aim line
    if (!state.shootingBubble && state.currentBubble && state.gameRunning && !state.paused) {
        drawAimLine(ctx);
    }
}

function drawBgPattern(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const spacing = 30;
    for (let y = 0; y < state.canvas.height; y += spacing) {
        for (let x = 0; x < state.canvas.width; x += spacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

function drawBubble(ctx, x, y, color, opts = {}) {
    const r = BUBBLE_RADIUS;

    // Outer glow if needed
    if (opts.glow) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    // Border (Neobrutalism — thick dark)
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Highlight (top-left)
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    // Small bright dot (extra shine)
    ctx.beginPath();
    ctx.arc(x - r * 0.5, y - r * 0.5, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
}

function drawShooter(ctx) {
    const x = state.shooterX;
    const y = state.shooterY + state.recoilOffset;

    // Base plate
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(x - 30, y + 8, 60, 14);

    // Body
    ctx.fillStyle = '#FFE15D';
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cannon barrel (rotates with aim)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state.angle + Math.PI / 2);
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(-6, -36, 12, 24);
    ctx.restore();

    // Eye dot on body
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.arc(x, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawAimLine(ctx) {
    const drawAngle = clampAimAngle(state.angle);
    const aiming = state.isAiming;
    const speed = aiming ? 14 : 10; // faster preview when actively aiming
    const now = performance.now();
    const pulse = aiming ? (0.85 + 0.15 * Math.sin(now * 0.012)) : 1.0;
    let vx = Math.cos(drawAngle) * speed;
    let vy = Math.sin(drawAngle) * speed;
    let x = state.shooterX;
    let y = state.shooterY;
    let bouncePoint = null;
    let hitPoint = null;
    let bounced = false;

    for (let i = 0; i < 200; i++) {
        x += vx; y += vy;
        if (!bounced && (x - BUBBLE_RADIUS <= 0 || x + BUBBLE_RADIUS >= state.canvas.width)) {
            x = Math.max(BUBBLE_RADIUS, Math.min(state.canvas.width - BUBBLE_RADIUS, x));
            vx = -vx;
            bouncePoint = { x, y };
            bounced = true;
        }
        if (y - BUBBLE_RADIUS <= 0) {
            hitPoint = { x, y: BUBBLE_RADIUS };
            break;
        }
        for (const b of state.bubbles) {
            const dx = x - b.x, dy = y - b.y;
            if (dx * dx + dy * dy < (BUBBLE_RADIUS * 2) ** 2) {
                hitPoint = { x: b.x, y: b.y };
                break;
            }
        }
        if (hitPoint) break;
    }
    if (!hitPoint) hitPoint = { x: x + vx * 10, y: y + vy * 10 };

    // v1.1 — colors & thickness shift based on aiming state
    const baseColor   = aiming ? '#FF6BB5' : '#1A1A1A';
    const accentColor = aiming ? '#FFFFFF' : '#FFE15D';
    const baseWidth   = aiming ? 7 : 4;
    const accentWidth = aiming ? 2.5 : 1.5;

    // Primary segment
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = baseWidth;
    ctx.setLineDash([10, 8]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(state.shooterX, state.shooterY);
    if (bouncePoint) ctx.lineTo(bouncePoint.x, bouncePoint.y);
    else ctx.lineTo(hitPoint.x, hitPoint.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner accent (yellow when idle, white when aiming)
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = accentWidth;
    ctx.beginPath();
    ctx.moveTo(state.shooterX, state.shooterY);
    if (bouncePoint) ctx.lineTo(bouncePoint.x, bouncePoint.y);
    else ctx.lineTo(hitPoint.x, hitPoint.y);
    ctx.stroke();
    ctx.restore();

    // Bounce point
    if (bouncePoint) {
        if (aiming) {
            // v1.1 — pulsing concentric rings when actively aiming
            const ringR = 14 + 4 * Math.sin(now * 0.008);
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#FF5757';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(bouncePoint.x, bouncePoint.y, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 87, 87, 0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bouncePoint.x, bouncePoint.y, ringR + 9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else {
            // idle: chunky X marker (legacy)
            ctx.save();
            ctx.strokeStyle = '#FF5757';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            const s = 12;
            ctx.beginPath();
            ctx.moveTo(bouncePoint.x - s, bouncePoint.y - s);
            ctx.lineTo(bouncePoint.x + s, bouncePoint.y + s);
            ctx.moveTo(bouncePoint.x + s, bouncePoint.y - s);
            ctx.lineTo(bouncePoint.x - s, bouncePoint.y + s);
            ctx.stroke();
            ctx.strokeStyle = '#1A1A1A';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bouncePoint.x, bouncePoint.y, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Reflected segment
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#FF5757';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bouncePoint.x, bouncePoint.y);
        ctx.lineTo(hitPoint.x, hitPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // v1.1 — breathing arrowhead at hit point
        const dirAngle = Math.atan2(hitPoint.y - bouncePoint.y, hitPoint.x - bouncePoint.x);
        const arrowPulse = aiming ? (16 + 4 * Math.sin(now * 0.01)) : 14;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.translate(hitPoint.x, hitPoint.y);
        ctx.rotate(dirAngle);
        ctx.fillStyle = aiming ? '#FF6BB5' : '#FF5757';
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowPulse, -arrowPulse * 0.6);
        ctx.lineTo(-arrowPulse * 0.7, 0);
        ctx.lineTo(-arrowPulse,  arrowPulse * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    // v1.1 — power-meter arc near shooter when aiming
    if (aiming) {
        const meterR = 36;
        const pullDist = Math.min(40, Math.hypot(state.mouseX - state.aimStartX, state.mouseY - state.aimStartY));
        const power = pullDist / 40;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(state.shooterX, state.shooterY, meterR, 0, Math.PI * 2);
        ctx.stroke();
        // Power fill arc
        ctx.strokeStyle = power > 0.8 ? '#FF5757' : power > 0.5 ? '#FF9F45' : '#7ED957';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(state.shooterX, state.shooterY, meterR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * power);
        ctx.stroke();
        ctx.restore();
    }

    // Target indicator on aimed bubble
    if (hitPoint && state.bubbles.some((b) => Math.abs(b.x - hitPoint.x) < 1 && Math.abs(b.y - hitPoint.y) < 1)) {
        const ringPulse = 1 + 0.15 * Math.sin(now * 0.008);
        ctx.save();
        ctx.strokeStyle = aiming ? '#FF6BB5' : '#FF6BB5';
        ctx.lineWidth = aiming ? 4 : 3;
        ctx.beginPath();
        ctx.arc(hitPoint.x, hitPoint.y, BUBBLE_RADIUS * ringPulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

function drawBounceArrow(ctx) {
    if (!state.shootingBubble) return;
    const arrowLength = 120;
    const a = Math.atan2(state.shootingBubble.vy, state.shootingBubble.vx);
    const sx = state.shootingBubble.x, sy = state.shootingBubble.y;
    const ex = sx + Math.cos(a) * arrowLength, ey = sy + Math.sin(a) * arrowLength;

    ctx.save();
    ctx.strokeStyle = '#FF5757';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    const asize = 12;
    ctx.fillStyle = '#FF5757';
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - asize * Math.cos(a - Math.PI / 6), ey - asize * Math.sin(a - Math.PI / 6));
    ctx.lineTo(ex - asize * Math.cos(a + Math.PI / 6), ey - asize * Math.sin(a + Math.PI / 6));
    ctx.closePath(); ctx.fill();
    ctx.restore();
}

// ============================================================
// Shooting
// ============================================================
function clampAimAngle(a) {
    if (a > Math.PI) a -= 2 * Math.PI;
    if (a < -Math.PI) a += 2 * Math.PI;
    if (a > AIM_MAX_RAD) return AIM_MAX_RAD;
    if (a < AIM_MIN_RAD) return AIM_MIN_RAD;
    return a;
}

function shootBubble() {
    if (!state.gameRunning || state.paused || state.shootingBubble || state.bubblesLeft <= 0 || !state.currentBubble) return;
    Audio.init();
    Audio.resume();

    const shootAngle = clampAimAngle(state.angle);
    const activePower = Powerups.activeType;

    // Build shooting bubble (may be power-up variant)
    const bubbleColor = activePower === 'rainbow' ? '#FFFFFF' : state.currentBubble.color;
    state.shootingBubble = {
        x: state.shooterX,
        y: state.shooterY,
        color: bubbleColor,
        originalColor: state.currentBubble.color,
        vx: Math.cos(shootAngle) * 11,
        vy: Math.sin(shootAngle) * 11,
        powerup: activePower,
    };

    // Advance queue
    state.currentBubble = { x: state.shooterX, y: state.shooterY, color: state.nextBubble.color, vx: 0, vy: 0 };
    state.nextBubble = { x: state.shooterX + 50, y: state.shooterY, color: randomColor() };
    updateShooterPreview(); // v1.2

    state.bubblesLeft--;
    state.matchesThisShot = 0;
    updateStatsBar();

    // Recoil
    state.recoilOffset = -6;
    setTimeout(() => { state.recoilOffset = 0; }, 100);

    // v1.2 — first user gesture: try to start background music
    Music.tryStartOnGesture();

    // Consume power-up if armed
    if (activePower) {
        Powerups.consume(activePower);
        Powerups.activeType = null;
        updatePowerupDock();
        Audio.powerup();
        Voice.powerup(activePower); // v1.1
    } else {
        Audio.shoot();
        hapticShoot();
    }
}

function updateShootingBubble() {
    if (!state.shootingBubble) return;
    const b = state.shootingBubble;
    b.x += b.vx; b.y += b.vy;

    // Wall bounce
    if (b.x - BUBBLE_RADIUS <= 0 || b.x + BUBBLE_RADIUS >= state.canvas.width) {
        b.vx = -b.vx;
        state.lastBounceTime = Date.now();
        Audio.bounce();
        hapticBounce();
    }

    // Top wall → attach
    if (b.y - BUBBLE_RADIUS <= 0) {
        attachBubble();
        return;
    }

    // Collision with existing bubble
    for (const other of state.bubbles) {
        const dx = b.x - other.x, dy = b.y - other.y;
        if (dx * dx + dy * dy < (BUBBLE_RADIUS * 2) ** 2) {
            attachBubble();
            return;
        }
    }
}

function attachBubble() {
    if (!state.shootingBubble) return;
    const b = state.shootingBubble;

    // Find nearest grid position
    let nearest = null, minDist = Infinity;
    for (const other of state.bubbles) {
        const dx = b.x - other.x, dy = b.y - other.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) { minDist = d; nearest = other; }
    }

    let newX, newY;
    if (nearest && minDist < BUBBLE_RADIUS * 3) {
        const dx = b.x - nearest.x, dy = b.y - nearest.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0) {
            newX = nearest.x + (dx / d) * (BUBBLE_RADIUS * 2);
            newY = nearest.y + (dy / d) * (BUBBLE_RADIUS * 2);
        } else {
            newX = nearest.x;
            newY = nearest.y - BUBBLE_RADIUS * 2;
        }
    } else {
        // Snap to grid
        const col = Math.round((b.x - BUBBLE_RADIUS) / (BUBBLE_RADIUS * 2));
        const row = Math.round((b.y - BUBBLE_RADIUS - 60) / (BUBBLE_RADIUS * 1.8));
        newX = col * (BUBBLE_RADIUS * 2) + BUBBLE_RADIUS + (row % 2 === 1 ? BUBBLE_RADIUS : 0);
        newY = Math.max(60 + BUBBLE_RADIUS, row * (BUBBLE_RADIUS * 1.8) + BUBBLE_RADIUS + 60);
    }

    // Determine match color (rainbow uses nearest)
    let matchColor = b.color;
    if (b.powerup === 'rainbow' && nearest) matchColor = nearest.color;

    const newBubble = {
        x: newX, y: newY, color: matchColor, row: 0, col: 0,
    };
    state.bubbles.push(newBubble);

    // Pop sound + small particle burst on attach (even if no match)
    Particles.pop(newX, newY, matchColor, 4);
    hapticPop();

    // Apply power-up effects
    if (b.powerup) {
        const effect = applyPowerupEffect(b.powerup, newX, newY, matchColor, state.bubbles);
        if (effect.removeAt.length > 0) {
            removeBubbles(effect.removeAt);
            state.score += effect.scoreBonus;
            Particles.shakeScreen(b.powerup === 'bomb' ? 10 : 5);
            shakeElement(document.getElementById('gameFrame'), b.powerup === 'bomb' ? 'heavy' : 'light');
            Audio.pop();
        }
        if (effect.extraCheckColor) {
            // Rainbow: find matching color cluster
            const matches = findConnectedMatches(newX, newY, effect.extraCheckColor);
            if (matches.length >= 2) {
                removeBubbles(matches);
                state.score += matches.length * 15;
            }
        }
    }

    // Regular match check
    const matches = findConnectedMatches(newX, newY, matchColor);
    if (matches.length >= 3) {
        removeBubbles(matches);
        state.score += matches.length * 10;
        state.matchesThisShot = matches.length;
        state.comboCount++;
        updateLevelBar();

        // v1.1 — Combo audio + voice callouts
        if (matches.length >= 5) {
            Audio.combo(2);
            Voice.combo(matches.length);
        } else if (matches.length >= 3) {
            Audio.combo(1);
            Voice.combo(matches.length);
        }

        // Combo bonus + power-up reward
        if (matches.length >= 4) {
            const awarded = Powerups.awardRandom();
            toaster.success(`+1 ${POWERUP_TYPES[awarded].name.toUpperCase()}!`, 2500, POWERUP_TYPES[awarded].emoji);
            updatePowerupDock();
            Achievements.unlock('powerup_first');
            Achievements.unlock('powerup_all');
        }

        // Big combo flash
        if (matches.length >= 5) {
            Particles.shakeScreen(4);
            hapticBigPop();
        }

        // Floating score popup
        Particles.scorePopup(newX, newY - 20, `+${matches.length * 10}`, matches.length >= 5 ? '#FF6BB5' : '#FFE15D');

        // Floating bubble fall
        setTimeout(() => checkFloatingBubbles(), 80);
    }

    // Recompute shots remaining
    updateStatsBar();
    updateLevelBar();
    checkAchievements();

    // Update high score
    if (state.score > state.highScore) {
        state.highScore = state.score;
        Storage.setHighScore(state.highScore);
    }

    state.shootingBubble = null;

    // Win condition: cleared all bubbles
    if (state.bubbles.length === 0) {
        state.score += 1000;
        state.bubblesLeft += 5; // bonus
        updateStatsBar();
        setTimeout(() => levelComplete(), 600);
        return;
    }

    // Lose: bubbles reached bottom
    const lowestY = Math.max(...state.bubbles.map((bb) => bb.y));
    if (lowestY > state.canvas.height - 80) {
        setTimeout(() => gameOver(), 200);
        return;
    }

    // Lose: out of shots
    if (state.bubblesLeft <= 0) {
        setTimeout(() => gameOver(), 400);
    }
}

function removeBubbles(bubbleList) {
    bubbleList.forEach((b) => {
        const i = state.bubbles.indexOf(b);
        if (i > -1) {
            Particles.pop(b.x, b.y, b.color, 8);
            state.bubbles.splice(i, 1);
        }
    });
    Audio.pop();
    hapticPop();
}

function findConnectedMatches(startX, startY, color) {
    const visited = new Set();
    const matches = [];
    const stack = [{ x: startX, y: startY }];

    while (stack.length > 0) {
        const { x, y } = stack.pop();
        const key = `${x.toFixed(1)},${y.toFixed(1)}`;
        if (visited.has(key)) continue;
        visited.add(key);

        for (const b of state.bubbles) {
            const dx = b.x - x, dy = b.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < BUBBLE_RADIUS * 2.5 && b.color === color) {
                if (!matches.includes(b)) {
                    matches.push(b);
                    stack.push({ x: b.x, y: b.y });
                }
            }
        }
    }
    return matches;
}

function checkFloatingBubbles() {
    if (state.bubbles.length === 0) return;

    const connected = new Set();
    const seed = state.bubbles.filter((b) => b.y <= 80);

    function mark(b) {
        const key = `${b.x.toFixed(1)},${b.y.toFixed(1)}`;
        if (connected.has(key)) return;
        connected.add(key);
        for (const other of state.bubbles) {
            const dx = other.x - b.x, dy = other.y - b.y;
            if (Math.sqrt(dx * dx + dy * dy) < BUBBLE_RADIUS * 2.5) {
                mark(other);
            }
        }
    }
    seed.forEach(mark);

    const toFall = state.bubbles.filter((b) => !connected.has(`${b.x.toFixed(1)},${b.y.toFixed(1)}`));
    toFall.forEach((b) => {
        const i = state.bubbles.indexOf(b);
        if (i > -1) {
            state.bubbles.splice(i, 1);
            state.fallingBubbles.push({
                x: b.x, y: b.y, color: b.color,
                vy: 4 + Math.random() * 2,
                vx: (Math.random() - 0.5) * 3,
            });
            state.score += 20;
        }
    });
    updateLevelBar();
}

function updateFallingBubbles() {
    for (let i = state.fallingBubbles.length - 1; i >= 0; i--) {
        const b = state.fallingBubbles[i];
        b.y += b.vy;
        b.x += b.vx;
        b.vy += 0.3;
        if (b.y > state.canvas.height + BUBBLE_RADIUS) {
            state.fallingBubbles.splice(i, 1);
        }
    }
}

function checkAchievements() {
    const progress = Storage.getProgress();
    Achievements.checkGameState({
        score: state.score,
        matchesThisShot: state.matchesThisShot,
        level: state.level.id,
        starsByLevel: progress.stars,
    });
    updateTopBar();
}

// ============================================================
// Level Complete / Game Over
// ============================================================
function levelComplete() {
    state.gameRunning = false;
    setFullView(false); // v1.1 — restore HUD for win screen
    Audio.win();
    Audio.levelUp();
    Voice.win();
    vibrate([100, 50, 100, 50, 200]);

    const stars = getStarsForScore(state.level, state.score);
    Particles.confetti(state.canvas.width, state.canvas.height, 100);

    // Save progress
    const progress = Storage.getProgress();
    const prevStars = progress.stars[state.level.id] || 0;
    progress.stars[state.level.id] = Math.max(prevStars, stars);
    // Unlock next level
    if (stars > 0 && state.level.id >= progress.unlocked) {
        progress.unlocked = Math.min(LEVELS.length, state.level.id + 1);
    }
    progress.currentLevel = Math.min(LEVELS.length, state.level.id + 1);
    Storage.saveProgress(progress);

    // Submit to leaderboard
    Leaderboard.submit({ score: state.score, level: state.level.id, name: 'PLAYER' });

    // XP
    const xpEarned = 50 + stars * 25;
    const newLevel = Achievements.addXP(xpEarned);
    Achievements.unlock(state.level.id === 5 ? 'level_5' :
                        state.level.id === 10 ? 'level_10' :
                        state.level.id === 15 ? 'level_15' :
                        state.level.id === 20 ? 'level_20' : null);
    if (stars === 3) Achievements.unlock('perfect_3');
    if (Object.values(progress.stars).filter((s) => s === 3).length >= 10) Achievements.unlock('perfect_10');

    // Win UI
    if (dom.winScoreEl) dom.winScoreEl.textContent = state.score.toLocaleString();
    renderStars(stars);

    if (newLevel > 1 && Achievements.getState().level === newLevel) {
        // Level-up toast
        setTimeout(() => toaster.success(`LEVEL UP! Now LVL ${newLevel}`, 3000, '🆙'), 800);
    }

    setTimeout(() => {
        dom.winScreen.classList.add('active');
        // Hide "Next" button if this was the last level
        if (dom.winNextBtn) dom.winNextBtn.style.display = state.level.id >= LEVELS.length ? 'none' : '';
    }, 200);

    updateTopBar();
}

function renderStars(n) {
    const stars = dom.starsRow?.querySelectorAll('.star-icon') || [];
    stars.forEach((s, i) => {
        s.classList.toggle('is-lit', i < n);
    });
}

function gameOver() {
    state.gameRunning = false;
    setFullView(false); // v1.1 — restore HUD for game-over screen
    Audio.lose();
    Voice.lose();
    vibrate(200);

    if (state.score > 0) {
        Leaderboard.submit({ score: state.score, level: state.level.id, name: 'PLAYER' });
        Achievements.addXP(20);
    }

    if (dom.finalScoreEl) dom.finalScoreEl.textContent = state.score.toLocaleString();
    dom.gameOverScreen.classList.add('active');
    updateTopBar();
}

// ============================================================
// Pause / Resume
// ============================================================
function togglePause(force) {
    if (!state.gameRunning && force !== true) return;
    state.paused = typeof force === 'boolean' ? force : !state.paused;
    if (state.paused) {
        dom.pauseScreen.classList.add('active');
        Particles.pause();
    } else {
        dom.pauseScreen.classList.remove('active');
        Particles.resume();
    }
}

// ============================================================
// Streak
// ============================================================
function updateStreakOnLoad() {
    const streak = Storage.getStreak();
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    if (streak.lastPlayed === 0) return;
    const daysSince = Math.floor((now - streak.lastPlayed) / DAY);
    state.streak = streak.count;
    if (daysSince === 0) {
        // same day
    } else if (daysSince === 1) {
        // next day — increment when next played
    } else if (daysSince > 1) {
        state.streak = 0;
        Storage.saveStreak({ count: 0, lastPlayed: 0 });
    }
}

function recordPlayToday() {
    const streak = Storage.getStreak();
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    if (streak.lastPlayed === 0 || Math.floor((now - streak.lastPlayed) / DAY) >= 1) {
        const newCount = streak.lastPlayed === 0 ? 1 : streak.count + 1;
        Storage.saveStreak({ count: newCount, lastPlayed: now });
        state.streak = newCount;
        if (newCount === 3) Achievements.unlock('streak_3');
        if (newCount === 7) Achievements.unlock('streak_7');
    }
}

// ============================================================
// Game Loop (60fps)
// ============================================================
let lastFrameTime = 0;
function gameLoop(time) {
    if (state.gameRunning && !state.paused) {
        const dt = Math.min(32, time - lastFrameTime);
        lastFrameTime = time;
        updateShootingBubble();
        updateFallingBubbles();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// ============================================================
// Event Handlers
// ============================================================
function bindEventHandlers() {
    // Mouse move
    state.canvas.addEventListener('mousemove', (e) => {
        if (!state.gameRunning || state.paused) return;
        const rect = state.canvas.getBoundingClientRect();
        state.mouseX = e.clientX - rect.left;
        state.mouseY = e.clientY - rect.top;
        if (state.currentBubble && !state.shootingBubble) {
            const dx = state.mouseX - state.shooterX;
            const dy = state.mouseY - state.shooterY;
            state.angle = clampAimAngle(Math.atan2(dy, dx));
        }
    });

    // Click — desktop aim+fire. On mobile this is skipped via lastTouchTime guard
    state.canvas.addEventListener('click', (e) => {
        // Suppress synthetic click that fires after touchend on mobile browsers
        if (Date.now() - state.lastTouchTime < 600) return;
        if (!state.gameRunning || state.paused || state.shootingBubble) return;
        const rect = state.canvas.getBoundingClientRect();
        state.mouseX = e.clientX - rect.left;
        state.mouseY = e.clientY - rect.top;
        const dx = state.mouseX - state.shooterX;
        const dy = state.mouseY - state.shooterY;
        state.angle = clampAimAngle(Math.atan2(dy, dx));
        shootBubble();
    });

    // v1.1 — Touch: drag-to-aim, release-to-fire (slingshot feel)
    const dragAim = () => Storage.getSettings().dragAim !== false;
    const tapShoot = () => Storage.getSettings().dragAim === false;

    state.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        state.lastTouchTime = Date.now();
        if (e.touches.length > 1) { state.isAiming = false; return; } // multi-touch cancel
        if (!state.gameRunning || state.paused || state.shootingBubble) return;

        const rect = state.canvas.getBoundingClientRect();
        const t = e.touches[0];
        state.mouseX = t.clientX - rect.left;
        state.mouseY = t.clientY - rect.top;
        state.aimStartX = state.mouseX;
        state.aimStartY = state.mouseY;

        // Compute initial aim (only if dragAim mode)
        const dx = state.mouseX - state.shooterX;
        const dy = state.mouseY - state.shooterY;
        if (dragAim()) {
            state.isAiming = true;
            if (Math.hypot(dx, dy) > BUBBLE_RADIUS * 0.5) {
                state.angle = clampAimAngle(Math.atan2(dy, dx));
            }
        } else {
            // Legacy tap-to-shoot mode
            state.angle = clampAimAngle(Math.atan2(dy, dx));
            shootBubble();
        }
    }, { passive: false });

    state.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length > 1) { state.isAiming = false; return; }
        if (!dragAim() || !state.isAiming || !state.currentBubble || state.shootingBubble) return;
        const rect = state.canvas.getBoundingClientRect();
        const t = e.touches[0];
        state.mouseX = t.clientX - rect.left;
        state.mouseY = t.clientY - rect.top;
        const dx = state.mouseX - state.shooterX;
        const dy = state.mouseY - state.shooterY;
        state.angle = clampAimAngle(Math.atan2(dy, dx));
    }, { passive: false });

    const releaseShot = (e) => {
        if (e.cancelable) e.preventDefault();
        const wasAiming = state.isAiming;
        state.isAiming = false;
        if (!dragAim()) return; // tap mode already fired on touchstart
        if (!wasAiming) return;
        if (!state.gameRunning || state.paused || state.shootingBubble) return;
        if (state.bubblesLeft <= 0 || !state.currentBubble) return;
        shootBubble();
    };
    state.canvas.addEventListener('touchend', releaseShot, { passive: false });
    state.canvas.addEventListener('touchcancel', releaseShot, { passive: false });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'Escape') {
            if (modals.openModal) modals.close();
            else if (state.gameRunning) togglePause();
        }
        if (e.key === ' ' && state.gameRunning && !state.paused) {
            e.preventDefault();
            shootBubble();
        }
        if (e.key === 'ArrowLeft')  state.angle = clampAimAngle(state.angle - 0.1);
        if (e.key === 'ArrowRight') state.angle = clampAimAngle(state.angle + 0.1);
    });

    // Resize
    window.addEventListener('resize', () => resizeCanvas());
}

function bindUIButtons() {
    dom.startBtn?.addEventListener('click', () => {
        recordPlayToday();
        Music.tryStartOnGesture(); // v1.2 — first gesture hook for music
        startLevel();
    });
    dom.pauseBtn?.addEventListener('click', () => togglePause());
    dom.resumeBtn?.addEventListener('click', () => togglePause(false));
    dom.quitBtn?.addEventListener('click', () => {
        togglePause(false);
        state.gameRunning = false;
        loadLevel(state.level.id);
    });
    dom.winReplayBtn?.addEventListener('click', () => {
        Audio.click(); hapticPop();
        dom.winScreen.classList.remove('active');
        loadLevel(state.level.id);
        startLevel();
    });
    dom.winNextBtn?.addEventListener('click', () => {
        Audio.click(); hapticPop();
        dom.winScreen.classList.remove('active');
        const nextId = Math.min(LEVELS.length, state.level.id + 1);
        loadLevel(nextId);
        startLevel();
    });
    dom.gameOverHomeBtn?.addEventListener('click', () => {
        Audio.click();
        dom.gameOverScreen.classList.remove('active');
        state.gameRunning = false;
        loadLevel(state.level.id);
    });
    dom.gameOverRetryBtn?.addEventListener('click', () => {
        Audio.click();
        dom.gameOverScreen.classList.remove('active');
        loadLevel(state.level.id);
        startLevel();
    });

    dom.dockLevels?.addEventListener('click', () => {
        levelSelect.render();
        modals.open('modalLevels');
    });
    dom.dockAchievements?.addEventListener('click', () => {
        achievementsView.render();
        modals.open('modalAchievements');
    });
    dom.dockLeaderboard?.addEventListener('click', () => {
        leaderboardView.render();
        modals.open('modalLeaderboard');
    });
    dom.dockSettings?.addEventListener('click', () => {
        modals.open('modalSettings');
    });

    // Listen for achievement unlocks
    Achievements.on((evt) => {
        if (evt.type === 'unlock') {
            hapticAchievement();
            Audio.achievement2();
            Voice.achievement(evt.badge.name); // v1.1
            toaster.success(`🏆 ${evt.badge.name} unlocked!`, 3500, evt.badge.icon);
        } else if (evt.type === 'levelup') {
            Audio.levelUp();
            Voice.levelUp(); // v1.1
            toaster.success(`LEVEL UP! LVL ${evt.level}`, 3000, '🆙');
        }
    });

    // v1.2 — Strip buttons (visible during play in full-view mode)
    dom.stripPauseBtn?.addEventListener('click', () => togglePause());
    dom.stripSettingsBtn?.addEventListener('click', () => {
        Music.tryStartOnGesture(); // opening settings is also a gesture
        modals.open('modalSettings');
    });
}

// PWA install banner removed in v1.2 — install via browser's "Add to Home Screen"

// ============================================================
// Boot
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}