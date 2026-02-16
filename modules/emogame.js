// EmoGame — Rocket 🚀 mini-game during ETL data loading
// Activates when database is being fetched; player shoots visible UI elements

let isActive = false;
let shipEl = null;
let gameContainer = null;
let animFrameId = null;

let x = 0, y = 0, angle = 0, vx = 0, vy = 0;
const thrust = 0.06;
const turnSpeed = 1;
const friction = 0.97;

const keys = {};
let ctrlPressed = false;
let bulletInFlight = false;
const fragments = [];
const holes = [];

// ── Settings ──
function isGameEnabled() {
    try {
        const vis = JSON.parse(localStorage.getItem('uiVisibility') || '{}');
        return !!vis.gameOnLoad;
    } catch { return false; }
}

function isLiteMode() {
    try {
        const vis = JSON.parse(localStorage.getItem('uiVisibility') || '{}');
        return !!vis.gameLiteMode;
    } catch { return false; }
}

// ── Public API ──
export function startGame() {
    if (isActive) return;
    if (!isGameEnabled()) return;
    isActive = true;
    createGameLayer();
    bindKeys();
    x = window.innerWidth / 2;
    y = window.innerHeight / 2;
    angle = -90;
    vx = 0;
    vy = 0;
    gameLoop();
    console.log('[EmoGame] 🚀 Gra uruchomiona');
}

export function stopGame() {
    if (!isActive) return;
    isActive = false;
    unbindKeys();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = null;
    cleanupGameLayer();
    console.log('[EmoGame] 🛑 Gra zakończona');
}

export function isGameActive() { return isActive; }

// Expose globally for api-handler-v2.js
window.startEmoGame = startGame;
window.stopEmoGame = stopGame;

// ── DOM: game layer ──
function createGameLayer() {
    if (gameContainer) return;

    gameContainer = document.createElement('div');
    gameContainer.id = 'emogame-container';
    document.body.appendChild(gameContainer);

    shipEl = document.createElement('div');
    shipEl.id = 'emogame-ship';
    shipEl.textContent = '🚀';
    gameContainer.appendChild(shipEl);

    // Hint overlay (auto-hide after 5s)
    const hint = document.createElement('div');
    hint.id = 'emogame-hint';
    hint.innerHTML = '🎮 <b>Strzałki</b> = sterowanie &nbsp; <b>Ctrl</b> = strzał &nbsp; <b>Tap/Klik</b> = celuj+strzelaj';
    gameContainer.appendChild(hint);
    setTimeout(() => { if (hint.parentNode) hint.style.opacity = '0'; }, 5000);
    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 6000);

    // Close button [x]
    const closeBtn = document.createElement('button');
    closeBtn.id = 'emogame-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); stopGame(); });
    closeBtn.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); stopGame(); });
    gameContainer.appendChild(closeBtn);

    // Touch/click to aim and shoot
    gameContainer.style.pointerEvents = 'auto';
    gameContainer.addEventListener('click', onTapShoot);
    gameContainer.addEventListener('touchend', onTapShoot);
}

function cleanupGameLayer() {
    // Remove all fragments
    fragments.length = 0;
    holes.length = 0;
    if (gameContainer) {
        gameContainer.remove();
        gameContainer = null;
    }
    shipEl = null;
}

// ── Input ──
function onKeyDown(e) {
    if (!isActive) return;
    // Block arrow keys from scrolling the page
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
    keys[e.key] = true;
    if (e.key === 'Control' && !ctrlPressed) {
        ctrlPressed = true;
        shoot();
    }
    if (e.key === 'Escape') {
        stopGame();
    }
}

function onKeyUp(e) {
    keys[e.key] = false;
    if (e.key === 'Control') ctrlPressed = false;
}

function bindKeys() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function unbindKeys() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
}

// ── Touch / Click to aim & shoot ──
function onTapShoot(e) {
    if (!isActive) return;
    // Ignore if tapped the close button
    if (e.target.id === 'emogame-close') return;
    e.preventDefault();

    // Get tap coordinates
    let tx, ty;
    if (e.changedTouches && e.changedTouches.length > 0) {
        tx = e.changedTouches[0].clientX;
        ty = e.changedTouches[0].clientY;
    } else {
        tx = e.clientX;
        ty = e.clientY;
    }

    // Rotate ship toward tap point
    const dx = tx - x;
    const dy = ty - y;
    angle = Math.atan2(dy, dx) * 180 / Math.PI;

    // Small thrust toward tap
    const rad = angle * Math.PI / 180;
    vx += Math.cos(rad) * thrust * 3;
    vy += Math.sin(rad) * thrust * 3;

    updateShip();
    shoot();
}

// ── Collision: point in polygon ──
function pointInPolygon(px, py, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// ── Effects: smoke ──
function spawnSmoke(sx, sy, color) {
    if (!gameContainer) return;
    const s = document.createElement('div');
    s.className = 'emogame-smoke';
    s.style.background = color;
    s.style.left = sx + 'px';
    s.style.top = (sy - 4) + 'px';
    s.style.transform = 'scale(1)';
    gameContainer.appendChild(s);
    requestAnimationFrame(() => {
        s.style.transform = 'translateY(-10px) scale(3)';
        s.style.opacity = '0';
    });
    setTimeout(() => s.remove(), 1000);
}

// ── Effects: colored sparks ──
function spawnColoredSparks(sx, sy, color) {
    if (!gameContainer) return;
    for (let i = 0; i < 6; i++) {
        const s = document.createElement('div');
        s.className = 'emogame-spark';
        s.style.background = color;
        let cx = sx, cy = sy;
        s.style.left = cx + 'px';
        s.style.top = cy + 'px';
        gameContainer.appendChild(s);

        const a = Math.random() * Math.PI * 2;
        const spd = 1 + Math.random() * 2;
        let dvx = Math.cos(a) * spd;
        let dvy = Math.sin(a) * spd;
        let life = 15 + Math.random() * 10;

        const interval = setInterval(() => {
            cx += dvx; cy += dvy;
            s.style.left = cx + 'px';
            s.style.top = cy + 'px';
            life--;
            if (life < 8) s.style.opacity = (life / 8).toString();
            if (life <= 0) { s.remove(); clearInterval(interval); }
        }, 16);
    }
}

// ── Effects: fragments ──
function spawnFragments(fx, fy) {
    if (!gameContainer) return;
    const count = 3 + Math.floor(Math.random() * 3);
    let smokeAssigned = false;

    for (let i = 0; i < count; i++) {
        const hue = Math.floor(Math.random() * 360);
        const color = `hsl(${hue}, 80%, 70%)`;
        const radius = (4 + Math.random() * 6) * 0.7;
        const sides = 3 + Math.floor(Math.random() * 3);
        let poly = [];
        for (let j = 0; j < sides; j++) {
            const a = (Math.PI * 2 * j / sides) + (Math.random() * 0.6 - 0.3);
            const r = radius * (0.7 + Math.random() * 0.6);
            poly.push([r * Math.cos(a), r * Math.sin(a)]);
        }

        const f = document.createElement('div');
        f.className = 'emogame-fragment';
        f.style.width = radius * 2 + 'px';
        f.style.height = radius * 2 + 'px';
        f.style.background = color;
        f.style.clipPath =
            `polygon(${poly.map(p => (p[0] + radius) + 'px ' + (p[1] + radius) + 'px').join(',')})`;

        let px = fx + (Math.random() * 10 - 5);
        let py = fy + (Math.random() * 10 - 5);
        f.style.left = px + 'px';
        f.style.top = py + 'px';
        gameContainer.appendChild(f);

        const ang = Math.random() * Math.PI * 2;
        const speed = 0.4 + Math.random() * 0.6;
        const isSmoking = !smokeAssigned;
        if (isSmoking) smokeAssigned = true;

        fragments.push({
            el: f, fx: px, fy: py,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            radius,
            rot: Math.random() * 360,
            rotSpeed: (Math.random() * 2 - 1) * 2,
            color, isSmoking
        });
    }
}

// ── Effects: sparks on UI hit ──
function spawnSparks(sx, sy, count = 8) {
    if (!gameContainer) return;
    for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'emogame-spark';
        s.style.background = '#ffcc55';
        let cx = sx, cy = sy;
        s.style.left = cx + 'px';
        s.style.top = cy + 'px';
        gameContainer.appendChild(s);

        const a = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 2;
        let dvx = Math.cos(a) * spd;
        let dvy = Math.sin(a) * spd;
        let life = 20 + Math.random() * 10;

        const interval = setInterval(() => {
            cx += dvx; cy += dvy;
            s.style.left = cx + 'px';
            s.style.top = cy + 'px';
            life--;
            if (life < 10) s.style.opacity = (life / 10).toString();
            if (life <= 0) { s.remove(); clearInterval(interval); }
        }, 16);
    }
}

// ── Fragment physics tick ──
let fragmentInterval = null;

function startFragmentPhysics() {
    if (fragmentInterval) return;
    const lite = isLiteMode();
    fragmentInterval = setInterval(() => {
        if (!isActive) { clearInterval(fragmentInterval); fragmentInterval = null; return; }
        for (let i = fragments.length - 1; i >= 0; i--) {
            const a = fragments[i];
            a.vy += 0.01;
            a.fx += a.vx;
            a.fy += a.vy;
            a.rot += a.rotSpeed;

            // Lite mode: remove fragments that leave the screen
            if (lite) {
                if (a.fx < -a.radius || a.fx > window.innerWidth + a.radius ||
                    a.fy < -a.radius || a.fy > window.innerHeight + a.radius) {
                    a.el.remove();
                    fragments.splice(i, 1);
                    continue;
                }
            } else {
                // Normal mode: bounce off bottom
                if (a.fy > window.innerHeight - a.radius) {
                    a.fy = window.innerHeight - a.radius;
                    a.vy *= -0.4;
                    a.vx *= 0.7;
                    if (Math.abs(a.vy) < 0.1) a.vy = 0;
                }
            }

            if (!lite) {
                for (let j = i + 1; j < fragments.length; j++) {
                    const b = fragments[j];
                    const dx = b.fx - a.fx;
                    const dy = b.fy - a.fy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = a.radius + b.radius;
                    if (dist > 0 && dist < minDist) {
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const p = 2 * (a.vx * nx + a.vy * ny - b.vx * nx - b.vy * ny) / 2;
                        a.vx -= p * nx; a.vy -= p * ny;
                        b.vx += p * nx; b.vy += p * ny;
                        const overlap = minDist - dist;
                        a.fx -= nx * overlap / 2; a.fy -= ny * overlap / 2;
                        b.fx += nx * overlap / 2; b.fy += ny * overlap / 2;
                    }
                }
            }

            if (a.isSmoking && !lite) {
                if (Math.random() < 0.25) spawnSmoke(a.fx, a.fy, a.color);
                if (Math.random() < 0.05) spawnColoredSparks(a.fx, a.fy, a.color);
            }

            a.el.style.left = a.fx + 'px';
            a.el.style.top = a.fy + 'px';
            a.el.style.transform = `rotate(${a.rot}deg)`;
        }
    }, 16);
}

// ── Get shootable targets ──
// Targets: visible interactive elements (buttons, inputs, text, labels, nav items, etc.)
// Exclude: body, html, the game container itself, the gray .container background
function getTargets() {
    const selectors = [
        '#ui button', '#ui input', '#ui label', '#ui p',                         // original game UI
        '.floating-btn',                                                          // floating action buttons
        '.nav-item',                                                              // bottom nav items
        '.etl-btn', '.etl-checkbox-label', '.etl-select',                         // ETL panel controls
        '.console-style-header h3',                                               // settings panel headers
        '.settings-checkbox-label',                                               // settings checkboxes
        '#topInfoBar',                                                            // top info bar
        '.status-bar-section',                                                    // status bar sections
        '.status-bar-separator',                                                  // separators
        '.etl-detail-section-title',                                              // ETL detail titles
        '.toast',                                                                 // toast notifications
        '.app-header h1', '.app-header h2',                                       // headers
        '#floatingConsolePanel .floating-panel-header',                            // console header
        '.chat-send-btn', '.chat-input',                                          // AI chat controls
        '.prediction-card .prediction-title',                                     // predictions
        '.chart-card .chart-title',                                               // chart titles
    ];
    const all = document.querySelectorAll(selectors.join(','));
    const result = [];
    for (const el of all) {
        // Skip hidden elements and game elements
        if (!el.offsetParent && el.id !== 'topInfoBar' && !el.closest('#floatingStatusBar')) continue;
        if (el.closest('#emogame-container')) continue;
        result.push(el);
    }
    return result;
}

// ── Shooting ──
function shoot() {
    if (!isActive || !gameContainer || !shipEl || bulletInFlight) return;
    bulletInFlight = true;

    const bullet = document.createElement('div');
    bullet.className = 'emogame-bullet';
    bullet.textContent = '·';

    const rect = shipEl.getBoundingClientRect();
    let bx = rect.left + rect.width / 2;
    let by = rect.top + rect.height / 2 - 12;
    bullet.style.left = bx + 'px';
    bullet.style.top = by + 'px';
    gameContainer.appendChild(bullet);

    const rad = angle * Math.PI / 180;
    const speed = 6;
    const bvx = Math.cos(rad) * speed;
    const bvy = Math.sin(rad) * speed;

    let lastX = bx, lastY = by;
    const targets = getTargets();

    const interval = setInterval(() => {
        if (!isActive) { bullet.remove(); clearInterval(interval); bulletInFlight = false; return; }

        lastX = bx; lastY = by;
        bx += bvx; by += bvy;
        bullet.style.left = bx + 'px';
        bullet.style.top = by + 'px';

        const steps = 20;
        let inHole = false;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const rx = lastX + (bx - lastX) * t;
            const ry = lastY + (by - lastY) * t;

            for (const h of holes) {
                if (pointInPolygon(rx, ry, h.polygon)) { inHole = true; break; }
            }
            if (inHole) break;

            for (const tElem of targets) {
                const tr = tElem.getBoundingClientRect();
                if (rx >= tr.left && rx <= tr.right && ry >= tr.top && ry <= tr.bottom) {
                    bullet.remove();
                    clearInterval(interval);
                    bulletInFlight = false;

                    // Flash effect on hit element
                    tElem.classList.add('emogame-flash');
                    setTimeout(() => tElem.classList.remove('emogame-flash'), 200);

                    // Create hole
                    const hole = document.createElement('div');
                    hole.className = 'emogame-hole';
                    hole.style.left = (rx - 20) + 'px';
                    hole.style.top = (ry - 20) + 'px';
                    let poly = [];
                    for (let j = 0; j < 5; j++) {
                        const a = (Math.PI * 2 * j / 5) + (Math.random() * 0.6 - 0.3);
                        const r = 12 + Math.random() * 10;
                        poly.push([rx + Math.cos(a) * r, ry + Math.sin(a) * r]);
                    }
                    hole.style.clipPath =
                        `polygon(${poly.map(p => (p[0] - rx + 20) + 'px ' + (p[1] - ry + 20) + 'px').join(',')})`;
                    gameContainer.appendChild(hole);
                    holes.push({ element: hole, polygon: poly });

                    spawnFragments(rx, ry);
                    spawnSparks(rx, ry, 10);
                    startFragmentPhysics();
                    return;
                }
            }
        }

        if (inHole) return;
        if (bx < 0 || bx > window.innerWidth || by < 0 || by > window.innerHeight) {
            bullet.remove();
            clearInterval(interval);
            bulletInFlight = false;
        }
    }, 16);
}

// ── Ship update ──
function updateShip() {
    if (!shipEl) return;
    const visualAngle = angle + 45;
    shipEl.style.left = x + 'px';
    shipEl.style.top = y + 'px';
    shipEl.style.transform = `rotate(${visualAngle}deg)`;
}

// ── Game loop ──
function gameLoop() {
    if (!isActive) return;

    if (keys['ArrowLeft']) angle -= turnSpeed;
    if (keys['ArrowRight']) angle += turnSpeed;

    if (keys['ArrowUp']) {
        const rad = angle * Math.PI / 180;
        vx += Math.cos(rad) * thrust;
        vy += Math.sin(rad) * thrust;
    }

    x += vx; y += vy;
    vx *= friction; vy *= friction;

    // Wrap around screen
    if (x < 0) x = window.innerWidth;
    if (x > window.innerWidth) x = 0;
    if (y < 0) y = window.innerHeight;
    if (y > window.innerHeight) y = 0;

    updateShip();
    animFrameId = requestAnimationFrame(gameLoop);
}
