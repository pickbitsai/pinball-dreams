// ============================================================
// PINBALL DREAMS — PickBits integration
//
// Runtime-gated: activates ONLY on a *.pickbits.ai origin (or with ?pb=1 for
// local dev). The PickBits edge functions enforce a *.pickbits.ai CORS
// allowlist, so auth genuinely cannot work anywhere else — everywhere else
// every method here is a safe no-op and the external SDK is never fetched.
//
// Responsibilities when active:
//   - inject https://pickbits.ai/sdk/pickbits-sdk.js + PickBits.init()
//   - reflect auth state in a small DOM chip (+ data-testid="pb-auth-state")
//   - submit the run score to the PickBits leaderboard, and read back the
//     player's global rank for the game-over screen
//   - mirror achievement unlocks
//   - mirror the local persistence keys to cloud saves (login merge +
//     debounced write-through)
//
// Local testing: append ?pb=1 to force-activate. The SDK load + anonymous UI
// path works anywhere; the auth exchange still needs a real *.pickbits.ai
// origin.
// ============================================================

const PickBitsClient = (() => {
    const GAME_SLUG = 'pinball';
    const SDK_URL = 'https://pickbits.ai/sdk/pickbits-sdk.js';
    const SAVE_VERSION = 1;
    const WRITE_DEBOUNCE_MS = 2000;

    // Read-only leaderboard access for the in-game rank readout. `leaderboards`
    // is world-readable and the Supabase REST endpoint (unlike the edge
    // functions) allows any origin, so this needs no backend work. These two
    // constants are already public — they're baked into the hosted SDK.
    const SUPABASE_URL = 'https://vbfwzpztnvfktydozgir.supabase.co';
    const SUPABASE_ANON = 'sb_publishable_5Xq5SHTnGvhp6mkauFXBHA_B_MEU0FX';

    // Bundled into one save blob (raw JSON strings) so PickBits stores a
    // single per-user payload.
    const CLOUD_KEYS = [
        'pinballDreamsCareer_v1',
        'pinballDreamsAchievements_v1',
        'pinballDreamsCustomLevel',
        'pinballDreamsSettings_v1'
    ];

    let active = false;      // environment gate result
    let ready = false;       // SDK loaded + init() called
    let user = null;         // last known user object (or null when anon)
    let reconciled = false;  // login cloud-reconcile already done this session
    let writeTimer = null;
    let chipEl = null;
    let stateEl = null;
    let loginPending = false;

    // ---- Environment gate ---------------------------------------------------
    function onPickBitsOrigin() {
        try { return /(^|\.)pickbits\.ai$/.test(location.hostname); }
        catch (e) { return false; }
    }
    function forcedOn() {
        try { return new URLSearchParams(location.search).get('pb') === '1'; }
        catch (e) { return false; }
    }
    function detectActive() { return onPickBitsOrigin() || forcedOn(); }

    // ---- SDK loading --------------------------------------------------------
    function injectSdk(cb) {
        if (window.PickBits) return cb();
        const s = document.createElement('script');
        s.src = SDK_URL;
        s.async = true;
        s.onload = cb;
        s.onerror = () => console.warn('[pickbits] SDK failed to load — staying anonymous');
        document.head.appendChild(s);
    }

    function init() {
        active = detectActive();
        if (!active) return; // full no-op off-origin
        buildChip();
        injectSdk(() => {
            if (!window.PickBits) return;
            try {
                // No `economy` block: Pinball has no persistent spendable
                // wallet, and run-scoped score must not be synced as one.
                window.PickBits.init({ gameSlug: GAME_SLUG });
                if (window.PickBits.onAuthChange) window.PickBits.onAuthChange(onAuth);
                ready = true;
                installWriteIntercept();
                // An existing session may already be resolved.
                const u = window.PickBits.getUser ? window.PickBits.getUser() : null;
                if (u) onAuth(u); else renderChip();
            } catch (e) {
                console.warn('[pickbits] init failed', e);
            }
        });
    }

    // ---- Auth ---------------------------------------------------------------
    function onAuth(u) {
        user = u || null;
        loginPending = false;
        renderChip();
        if (user) {
            identify();
            if (!reconciled) {
                reconciled = true;
                reconcileCloud();
            }
        } else {
            reconciled = false; // allow a fresh reconcile if they log back in
        }
    }

    // PostHog is configured with person_profiles:'identified_only', so without
    // this call the game's events never attach to a person.
    function identify() {
        try {
            if (!user || !window.posthog || !window.posthog.identify) return;
            window.posthog.identify(user.id, {
                email: user.email,
                username: user.username || user.display_name
            });
        } catch (e) {}
    }

    function isActive() { return active; }
    function isReady()  { return ready; }
    function isAuthed() { return !!user; }
    function getUser()  { return user; }

    // Send the player to the lightweight dedicated login page. It mints the
    // relay token and bounces back here with ?pb_token=, which the SDK
    // exchanges and strips.
    function loginUrl() {
        const returnUrl = new URL(location.href);
        // Relay and automation parameters are one-shot state. Sending them
        // through another login round can create a redirect loop.
        returnUrl.searchParams.delete('pb_token');
        returnUrl.searchParams.delete('automation');
        return 'https://pickbits.ai/login?redirect=' + encodeURIComponent(returnUrl.href);
    }

    function promptLogin() {
        if (loginPending) return;
        loginPending = true;
        renderChip();
        trackEvent('pinball_sign_in_requested');
        try {
            window.location.assign(loginUrl());
        } catch (e) {
            loginPending = false;
            renderChip();
        }
    }

    function isSubscriber() {
        try {
            if (window.PickBits && typeof window.PickBits.isSubscriber === 'function') {
                return !!window.PickBits.isSubscriber();
            }
            if (user && user.subscription_tier && user.subscription_tier !== 'free') return true;
        } catch (e) {}
        return false;
    }

    function trackEvent(name, props) {
        try {
            if (ready && window.PickBits && window.PickBits.trackEvent) {
                window.PickBits.trackEvent(name, props || {});
            }
        } catch (e) {}
    }

    // ---- Leaderboard --------------------------------------------------------
    // Best-score submission (server keeps only-if-higher). Fire and forget.
    function submitScore(score) {
        if (!ready || !user || !window.PickBits || !window.PickBits.submitScore) return;
        const n = score | 0;
        if (n <= 0) return;
        try { Promise.resolve(window.PickBits.submitScore(n)).catch(() => {}); }
        catch (e) {}
    }

    // Count rows matching a PostgREST filter using an exact head count.
    function countRows(filter) {
        const url = SUPABASE_URL + '/rest/v1/leaderboards?select=user_id' +
            '&game_slug=eq.' + GAME_SLUG + '&period=eq.all_time' + filter;
        return fetch(url, {
            headers: {
                apikey: SUPABASE_ANON,
                Authorization: 'Bearer ' + SUPABASE_ANON,
                Prefer: 'count=exact',
                Range: '0-0'
            }
        }).then(res => {
            // content-range looks like "0-0/123" (or "*/0" when empty).
            const cr = res.headers.get('content-range') || '';
            const total = parseInt(cr.split('/')[1], 10);
            return isNaN(total) ? null : total;
        });
    }

    // Resolve the player's standing on the all-time board as
    // { rank, total }, or null if it can't be determined. The `profiles`
    // table is not world-readable, so names are deliberately not available —
    // this is a rank readout, not a named top-10.
    function getRank(score) {
        if (!active) return Promise.resolve(null);
        const n = score | 0;
        if (n <= 0) return Promise.resolve(null);
        try {
            return Promise.all([
                countRows('&score=gt.' + n),
                countRows('')
            ]).then(([higher, total]) => {
                if (higher == null || total == null) return null;
                // An empty board has nothing to rank against — show nothing
                // rather than a fabricated "#1 of 1".
                if (total === 0) return null;
                // The caller's own row may not have landed yet when this runs
                // right after submitScore, so keep total >= rank.
                return { rank: higher + 1, total: Math.max(total, higher + 1) };
            }).catch(() => null);
        } catch (e) { return Promise.resolve(null); }
    }

    // ---- Achievement mirror -------------------------------------------------
    // Local ids are already the slug suffix, so this is a plain prefix. The
    // result MUST match the rows seeded in the PickBits `achievements` table
    // for game_slug='pinball' — an unseeded slug silently no-ops server-side.
    function toSlug(id) { return GAME_SLUG + '-' + String(id); }

    function unlockAchievement(id) {
        if (!ready || !user || !window.PickBits || !window.PickBits.unlockAchievement) return;
        try { Promise.resolve(window.PickBits.unlockAchievement(toSlug(id))).catch(() => {}); }
        catch (e) {}
    }

    // ---- Cloud saves --------------------------------------------------------
    function safeParse(raw) { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

    // Denormalized stats read directly by the pickbits.ai dashboard's saves
    // card (it does not parse the nested raw-JSON key blobs). This shape is
    // the contract with saveDetail('pinball') in dashboard-redesign.js.
    function buildSummary() {
        try {
            const c = safeParse(localStorage.getItem('pinballDreamsCareer_v1')) || {};
            const a = safeParse(localStorage.getItem('pinballDreamsAchievements_v1')) || {};
            const total = (typeof PinballAchievements !== 'undefined')
                ? PinballAchievements.total : 15;
            return {
                bestScore: c.bestScore | 0,
                bestFloor: c.bestFloor | 0,
                gamesPlayed: c.gamesPlayed | 0,
                bestMultiplier: c.bestMultiplier || 1,
                tablesPlayed: Object.keys(c.tablesPlayed || {}).length,
                boardsMastered: Object.keys(c.boardsMastered || {}).length,
                achievementsUnlocked: Object.keys(a.unlocked || {}).length,
                achievementsTotal: total
            };
        } catch (e) { return null; }
    }

    function readBundle() {
        const keys = {};
        for (const k of CLOUD_KEYS) {
            const raw = localStorage.getItem(k);
            if (raw != null) keys[k] = raw; // store raw JSON strings
        }
        return { v: SAVE_VERSION, keys, summary: buildSummary() };
    }

    function pushCloud() {
        if (!ready || !user || !window.PickBits || !window.PickBits.saveProgress) return;
        try { Promise.resolve(window.PickBits.saveProgress(readBundle())).catch(() => {}); }
        catch (e) {}
    }

    function schedulePush() {
        if (!ready || !user) return;
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(() => { writeTimer = null; pushCloud(); }, WRITE_DEBOUNCE_MS);
    }

    // Mirror writes to the cloud-tracked keys, debounced, so no game code has
    // to remember to trigger a save.
    function installWriteIntercept() {
        if (typeof Storage === 'undefined') return;
        if (Storage.prototype.__pb_cloud_wrapped) return;
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
            const r = orig.call(this, key, value);
            if (this === window.localStorage && CLOUD_KEYS.indexOf(key) !== -1) schedulePush();
            return r;
        };
        Storage.prototype.__pb_cloud_wrapped = true;
    }

    // On first login this session: pull the cloud blob and MERGE it into local
    // (never clobber — the player may have earned progress anonymously), then
    // push the merged result back up. If there's no cloud save yet, seed it
    // from local. After merging we fire `pickbits:cloud_hydrated` so the
    // persistence modules re-read.
    function reconcileCloud() {
        if (!window.PickBits || !window.PickBits.loadProgress) return;
        let p;
        try { p = window.PickBits.loadProgress(); } catch (e) { return; }
        Promise.resolve(p).then(res => {
            // v1 resolves the DB row {save_data, …}; the flagged v2 path
            // resolves the bare payload. Unwrap either.
            const blob = (res && res.save_data) ? res.save_data : res;
            if (!blob || !blob.keys) { pushCloud(); syncAchievements(); return; }
            mergeIntoLocal(blob.keys);
            try { window.dispatchEvent(new CustomEvent('pickbits:cloud_hydrated')); } catch (e) {}
            pushCloud();
            syncAchievements();
        }).catch(() => {});
    }

    // Push anonymous-era unlocks up to the account once, after the merge.
    function syncAchievements() {
        try {
            if (typeof PinballAchievements !== 'undefined') PinballAchievements.syncAll();
        } catch (e) {}
    }

    function mergeIntoLocal(ck) {
        mergeCareer(ck['pinballDreamsCareer_v1']);
        mergeAchievements(ck['pinballDreamsAchievements_v1']);
        mergeCustomLevel(ck['pinballDreamsCustomLevel']);
        mergeSettings(ck['pinballDreamsSettings_v1']);
    }

    function mergeCareer(cloudRaw) {
        const cloud = safeParse(cloudRaw);
        if (!cloud || cloud.version !== 1) return; // unknown schema → keep local
        const local = safeParse(localStorage.getItem('pinballDreamsCareer_v1')) || {};
        const out = Object.assign({}, cloud, local); // local wins for scalars
        out.version = 1;
        // High-water values and lifetime counters → take the max. (Summing
        // would double-count everything the two copies already share.)
        ['bestScore', 'bestFloor', 'bestBallScore', 'gamesPlayed', 'totalScore',
         'banksCleared', 'panelsBroken', 'ballSaves'].forEach(k => {
            out[k] = Math.max(local[k] | 0, cloud[k] | 0);
        });
        out.bestMultiplier = Math.max(local.bestMultiplier || 1, cloud.bestMultiplier || 1);
        out.customTableSaved = !!(local.customTableSaved || cloud.customTableSaved);
        // Set-maps → union.
        ['elementsCollected', 'tablesPlayed', 'boardsMastered'].forEach(k => {
            const merged = {};
            const lu = local[k] || {}, cu = cloud[k] || {};
            for (const id in lu) if (lu[id]) merged[id] = true;
            for (const id in cu) if (cu[id]) merged[id] = true;
            out[k] = merged;
        });
        localStorage.setItem('pinballDreamsCareer_v1', JSON.stringify(out));
        // Keep the legacy HUD key in step with the merged best.
        try { localStorage.setItem('pinballDreamsHighScore', String(out.bestScore | 0)); } catch (e) {}
    }

    function mergeAchievements(cloudRaw) {
        const cloud = safeParse(cloudRaw);
        if (!cloud || cloud.version !== 1) return;
        const local = safeParse(localStorage.getItem('pinballDreamsAchievements_v1')) || {};
        // Unlocked set → union, keeping the earliest timestamp.
        const unlocked = {};
        const lu = local.unlocked || {}, cu = cloud.unlocked || {};
        for (const id in lu) unlocked[id] = lu[id];
        for (const id in cu) unlocked[id] = unlocked[id] ? Math.min(unlocked[id], cu[id]) : cu[id];
        localStorage.setItem('pinballDreamsAchievements_v1',
            JSON.stringify({ version: 1, unlocked: unlocked }));
    }

    // A saved custom table is a single hand-built artifact — merging two is
    // meaningless and overwriting would destroy the player's work, so only
    // adopt the cloud copy when this device has none.
    function mergeCustomLevel(cloudRaw) {
        if (localStorage.getItem('pinballDreamsCustomLevel') != null) return;
        if (cloudRaw != null) localStorage.setItem('pinballDreamsCustomLevel', cloudRaw);
    }

    // Settings are per-device preferences; same rule.
    function mergeSettings(cloudRaw) {
        if (localStorage.getItem('pinballDreamsSettings_v1') != null) return;
        if (cloudRaw != null) localStorage.setItem('pinballDreamsSettings_v1', cloudRaw);
    }

    // ---- Auth UI chip (+ Playwright test hook) ------------------------------
    function buildChip() {
        if (chipEl || typeof document === 'undefined') return;
        const wrap = document.createElement('div');
        wrap.id = 'pbAuth';

        const label = document.createElement('span');
        label.id = 'pbAuthLabel';

        const btn = document.createElement('button');
        btn.id = 'pbAuthBtn';
        btn.type = 'button';
        btn.textContent = 'SIGN IN';
        btn.addEventListener('click', promptLogin);

        // Required stable hook for automated testing. Text = username or "anon".
        const state = document.createElement('span');
        state.setAttribute('data-testid', 'pb-auth-state');
        state.textContent = 'anon';
        state.style.position = 'absolute';
        state.style.width = '1px';
        state.style.height = '1px';
        state.style.overflow = 'hidden';
        state.style.clip = 'rect(0 0 0 0)';

        wrap.appendChild(label);
        wrap.appendChild(btn);
        wrap.appendChild(state);
        (document.body || document.documentElement).appendChild(wrap);
        chipEl = wrap;
        stateEl = state;
        renderChip();
    }

    function renderChip() {
        if (!chipEl) return;
        const label = chipEl.querySelector('#pbAuthLabel');
        const btn = chipEl.querySelector('#pbAuthBtn');
        if (user) {
            const name = user.display_name || user.username || user.email || 'player';
            label.textContent = name;
            label.style.display = '';
            btn.disabled = false;
            btn.setAttribute('aria-busy', 'false');
            btn.style.display = 'none';
            if (stateEl) stateEl.textContent = user.username || name;
        } else {
            label.style.display = 'none';
            btn.style.display = '';
            btn.disabled = loginPending;
            btn.textContent = loginPending ? 'OPENING...' : 'SIGN IN';
            btn.setAttribute('aria-busy', String(loginPending));
            if (stateEl) stateEl.textContent = loginPending ? 'opening' : 'anon';
        }
    }

    init();

    return {
        isActive, isReady, isAuthed, isSubscriber, getUser,
        promptLogin, submitScore, getRank, unlockAchievement, trackEvent,
        flushCloud: pushCloud // exposed for a manual "force sync" debug hook
    };
})();
