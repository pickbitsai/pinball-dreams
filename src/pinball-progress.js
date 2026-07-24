// ============================================================
// PINBALL DREAMS — Career stats + achievements (local-first)
//
// Everything here works fully offline and signed out. PickBits is a mirror,
// never the source of truth: unlocks are written to localStorage first and
// only then forwarded to PickBitsClient (which is itself a no-op when the
// SDK is absent, the player is anonymous, or the network is down).
//
// Exposes two globals for the inline game script in index.html:
//   PinballCareer        — lifetime stats, persisted as pinballDreamsCareer_v1
//   PinballAchievements  — catalog + unlock seam, pinballDreamsAchievements_v1
//
// Both expose reload() so they can re-read after a cloud merge
// (`pickbits:cloud_hydrated`).
// ============================================================

// ---- Career stats ----------------------------------------------------------
const PinballCareer = (() => {
    const KEY = 'pinballDreamsCareer_v1';
    const LEGACY_HIGH_SCORE = 'pinballDreamsHighScore';
    const VERSION = 1;

    function blank() {
        return {
            version: VERSION,
            bestScore: 0,
            bestFloor: 0,
            bestMultiplier: 1,
            bestBallScore: 0,
            gamesPlayed: 0,
            totalScore: 0,
            banksCleared: 0,
            panelsBroken: 0,
            ballSaves: 0,
            elementsCollected: {},  // set-map: fire / ice / rock
            tablesPlayed: {},       // set-map: index into LEVELS
            customTableSaved: false
        };
    }

    function read() {
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
        const out = Object.assign(blank(), stored && stored.version === VERSION ? stored : null);
        out.elementsCollected = Object.assign({}, out.elementsCollected);
        out.tablesPlayed = Object.assign({}, out.tablesPlayed);
        // Adopt the pre-PickBits high score so existing players keep their best.
        let legacy = 0;
        try { legacy = parseInt(localStorage.getItem(LEGACY_HIGH_SCORE), 10) || 0; } catch (e) {}
        if (legacy > out.bestScore) out.bestScore = legacy;
        return out;
    }

    let data = read();

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(data));
            // Keep the legacy key in sync — the HUD still reads it directly.
            localStorage.setItem(LEGACY_HIGH_SCORE, String(data.bestScore | 0));
        } catch (e) {}
    }

    function get() { return data; }

    function bump(key, n) {
        data[key] = (data[key] | 0) + (n == null ? 1 : n);
        save();
        return data[key];
    }

    // High-water update. Returns true when a new best was actually set.
    function best(key, value) {
        const v = Number(value) || 0;
        if (v <= (data[key] || 0)) return false;
        data[key] = v;
        save();
        return true;
    }

    // Add an id to one of the set-maps (tablesPlayed / elementsCollected).
    function mark(setKey, id) {
        if (id == null) return false;
        const set = data[setKey] || (data[setKey] = {});
        if (set[id]) return false;
        set[id] = true;
        save();
        return true;
    }

    function setFlag(key, value) {
        if (data[key] === value) return false;
        data[key] = value;
        save();
        return true;
    }

    function count(setKey) { return Object.keys(data[setKey] || {}).length; }

    function reload() { data = read(); }

    return { KEY, get, bump, best, mark, setFlag, count, save, reload };
})();


// ---- Achievements ----------------------------------------------------------
const PinballAchievements = (() => {
    const KEY = 'pinballDreamsAchievements_v1';
    const VERSION = 1;

    // The ids here are the PickBits slug suffixes — the bridge builds the
    // remote slug as 'pinball-' + id, so this list IS the contract with the
    // rows seeded in the PickBits `achievements` table (game_slug='pinball').
    // Adding one here without seeding it server-side makes it a silent no-op
    // for signed-in players (it still unlocks locally).
    const ACHIEVEMENTS = [
        { id: 'first-flip',    icon: '🕹️', title: 'FIRST FLIP',      desc: 'Play your first game.' },
        { id: 'high-roller',   icon: '🔥', title: 'HIGH ROLLER',     desc: 'Score 25,000 in a single game.' },
        { id: 'score-100k',    icon: '⭐', title: 'DREAM WEAVER',    desc: 'Score 100,000 in a single game.' },
        { id: 'score-250k',    icon: '👑', title: 'NEON LEGEND',     desc: 'Score 250,000 in a single game.' },
        { id: 'perfect-ball',  icon: '🏆', title: 'ONE BALL WONDER', desc: 'Score 50,000 on a single ball.' },
        { id: 'floor-5',       icon: '🪜', title: 'GROUND FLOOR',    desc: 'Reach floor 5 in Climb mode.' },
        { id: 'floor-10',      icon: '🏢', title: 'HALFWAY UP',      desc: 'Reach floor 10 in Climb mode.' },
        { id: 'floor-20',      icon: '🌃', title: 'ROOFTOP',         desc: 'Reach floor 20 in Climb mode.' },
        { id: 'max-combo',     icon: '⚡', title: 'COMBO KING',      desc: 'Hit the 5x score multiplier.' },
        { id: 'bank-clear',    icon: '🎯', title: 'TARGET PRACTICE', desc: 'Clear a full drop-target bank.' },
        { id: 'elementalist',  icon: '💧', title: 'ELEMENTALIST',    desc: 'Collect all three elemental balls in one run.' },
        { id: 'ball-saver',    icon: '🛡️', title: 'SECOND CHANCE',   desc: 'Rescue a ball with the ball-save gate.' },
        { id: 'demolition',    icon: '🔨', title: 'DEMOLITION',      desc: 'Break 50 floor panels.' },
        { id: 'table-tourist', icon: '🗺️', title: 'TABLE TOURIST',   desc: 'Play all five main tables.' },
        { id: 'architect',     icon: '📐', title: 'ARCHITECT',       desc: 'Build and save a custom table.' }
    ];

    const BY_ID = {};
    ACHIEVEMENTS.forEach(a => { BY_ID[a.id] = a; });

    function read() {
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
        const unlocked = (stored && stored.version === VERSION && stored.unlocked) || {};
        return { version: VERSION, unlocked: Object.assign({}, unlocked) };
    }

    let data = read();

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }

    function has(id) { return !!data.unlocked[id]; }

    function unlock(id) {
        if (!BY_ID[id] || data.unlocked[id]) return false;
        data.unlocked[id] = Date.now();
        save();
        showToast(BY_ID[id]);
        // Mirror to PickBits (no-op when inactive / anonymous / offline).
        try {
            if (typeof PickBitsClient !== 'undefined' && PickBitsClient.unlockAchievement) {
                PickBitsClient.unlockAchievement(id);
            }
        } catch (e) {}
        return true;
    }

    // Push every already-unlocked achievement to PickBits. Called once after
    // sign-in so anonymous progress lands on the account; the SDK's 409
    // "already unlocked" response makes repeats harmless.
    function syncAll() {
        try {
            if (typeof PickBitsClient === 'undefined' || !PickBitsClient.unlockAchievement) return;
            Object.keys(data.unlocked).forEach(id => {
                if (BY_ID[id]) PickBitsClient.unlockAchievement(id);
            });
        } catch (e) {}
    }

    // Evaluate everything derivable from career totals. Safe to call often —
    // unlock() dedupes. `ctx` carries per-run facts the career doesn't hold.
    function check(ctx) {
        ctx = ctx || {};
        const c = PinballCareer.get();

        if (c.gamesPlayed > 0) unlock('first-flip');
        if (c.bestScore >= 25000) unlock('high-roller');
        if (c.bestScore >= 100000) unlock('score-100k');
        if (c.bestScore >= 250000) unlock('score-250k');
        if (c.bestBallScore >= 50000) unlock('perfect-ball');
        if (c.bestFloor >= 5) unlock('floor-5');
        if (c.bestFloor >= 10) unlock('floor-10');
        if (c.bestFloor >= 20) unlock('floor-20');
        if (c.bestMultiplier >= 5) unlock('max-combo');
        if (c.banksCleared > 0) unlock('bank-clear');
        if (c.ballSaves > 0) unlock('ball-saver');
        if (c.panelsBroken >= 50) unlock('demolition');
        if (c.customTableSaved) unlock('architect');
        // Tables 0-4 are the five main boards (5 = editor, 6 = climb).
        if ([0, 1, 2, 3, 4].every(i => c.tablesPlayed[i])) unlock('table-tourist');
        // Per-run: all three elemental balls collected in a single game.
        if (ctx.runElements && ['fire', 'ice', 'rock'].every(e => ctx.runElements[e])) {
            unlock('elementalist');
        }
    }

    function list() {
        return ACHIEVEMENTS.map(a => Object.assign({ unlockedAt: data.unlocked[a.id] || 0 }, a));
    }

    function unlockedCount() { return Object.keys(data.unlocked).filter(id => BY_ID[id]).length; }

    function reload() { data = read(); }

    // ---- Toast ------------------------------------------------------------
    const queue = [];
    let toastBusy = false;

    function showToast(ach) {
        queue.push(ach);
        if (!toastBusy) drainToasts();
    }

    function drainToasts() {
        const ach = queue.shift();
        if (!ach) { toastBusy = false; return; }
        toastBusy = true;
        const el = document.getElementById('ach-toast');
        if (!el) { toastBusy = false; return; }
        el.innerHTML =
            '<span class="ach-toast-icon"></span>' +
            '<span class="ach-toast-copy">' +
            '<span class="ach-toast-kicker">ACHIEVEMENT UNLOCKED</span>' +
            '<span class="ach-toast-title"></span></span>';
        el.querySelector('.ach-toast-icon').textContent = ach.icon;
        el.querySelector('.ach-toast-title').textContent = ach.title;
        el.classList.add('show');
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(drainToasts, 320);
        }, 2600);
    }

    return {
        KEY, ACHIEVEMENTS, has, unlock, syncAll, check, list, unlockedCount,
        total: ACHIEVEMENTS.length, reload
    };
})();
