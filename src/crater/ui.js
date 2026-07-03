// Pokémon Crater clone — all screens & battle playback. window.CraterUI.
// Screens render into #screen; modals into #modal-layer.
(function () {
    'use strict';
    const D = window.CraterData;
    const M = window.CraterMon;
    const B = window.CraterBattle;
    const G = window.CraterGame;

    const UI = { zoneId: null, spawns: null, battle: null, busy: false };
    window.CraterUI = UI;

    const $ = sel => document.querySelector(sel);
    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function screen() {
        const s = $('#screen');
        s.innerHTML = '';
        navReset();
        // Re-sync topbar visibility once the caller has filled the screen in.
        setTimeout(() => UI.updateTopbar(), 0);
        return s;
    }

    /** Overworld mode: clear the overlay and hand control back to the map. */
    UI.closeToWorld = function () {
        const s = $('#screen');
        if (s) s.innerHTML = '';
        UI.updateTopbar();
        if (window.CraterOverworld && CraterOverworld.onScreenClosed) CraterOverworld.onScreenClosed();
    };

    // ---------------------------------------------------------- navigation --
    // Gamepad (D-pad/A/B/START) + keyboard control for every menu, exactly
    // like the GBA: a cursor moves over the current window's entries.
    const Nav = { items: [], idx: -1, cols: 1, onBack: null, stack: [] };
    function navReset() { navMark(-1); Nav.items = []; Nav.onBack = null; Nav.stack = []; }
    function navPush() {
        Nav.stack.push({ items: Nav.items, idx: Nav.idx, cols: Nav.cols, onBack: Nav.onBack });
        Nav.items = []; Nav.idx = -1; Nav.onBack = null;
    }
    function navPop() {
        const st = Nav.stack.pop();
        navMark(-1);
        if (st) { Nav.items = st.items; Nav.cols = st.cols; Nav.onBack = st.onBack; navMark(st.idx); }
        else { Nav.items = []; Nav.onBack = null; }
    }
    function navSet(items, opts) {
        opts = opts || {};
        navMark(-1);
        Nav.items = (items || []).filter(it => it && it.isConnected !== false);
        Nav.cols = opts.cols || 1;
        Nav.onBack = opts.onBack || null;
        if (Nav.items.length) navMark(opts.idx || 0);
    }
    function navMark(idx) {
        Nav.items.forEach(it => it.classList && it.classList.remove('nav-sel'));
        Nav.idx = idx;
        const it = Nav.items[idx];
        if (it) {
            it.classList.add('nav-sel');
            if (it.scrollIntoView) it.scrollIntoView({ block: 'nearest' });
            it.dispatchEvent(new Event('mouseenter'));   // sync PP box / desc boxes
        }
    }
    function navMove(dx, dy) {
        const n = Nav.items.length;
        if (!n) return false;
        let idx = (Nav.idx < 0 ? 0 : Nav.idx) + dx + dy * Nav.cols;
        idx = ((idx % n) + n) % n;
        navMark(idx);
        return true;
    }
    function navKey(k) {
        switch (k) {
            case 'up': return navMove(0, -1);
            case 'down': return navMove(0, 1);
            case 'left': return navMove(-1, 0);
            case 'right': return navMove(1, 0);
            case 'a': {
                const it = Nav.items[Nav.idx];
                if (it) { it.click(); return true; }
                return false;
            }
            case 'b': {
                if (Nav.onBack) { const f = Nav.onBack; f(); return true; }
                const scr = $('#screen');
                if (scr && scr.childElementCount > 0 && !UI.battle) { UI.closeToWorld(); return true; }
                return false;
            }
            case 'start': {
                const esm = $('#modal-layer .esm-overlay');
                if (esm) { esm.remove(); navPop(); return true; }
                return false;
            }
        }
        return false;
    }
    function uiNavActive() { return Nav.items.length > 0; }
    // On-screen gamepad: intercept before the engine when a menu is open.
    const GP_KEYS = { 'gp-up': 'up', 'gp-down': 'down', 'gp-left': 'left', 'gp-right': 'right', 'gp-a': 'a', 'gp-b': 'b', 'gp-start': 'start' };
    Object.keys(GP_KEYS).forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('pointerdown', ev => {
            const k = GP_KEYS[id];
            if (k === 'start') {
                if (!$('#modal-layer .esm-overlay')) return;   // let the engine open the menu
            } else if (!uiNavActive()) return;                 // world mode: engine input
            ev.preventDefault(); ev.stopPropagation();
            navKey(k);
        }, { capture: true });
    });
    document.addEventListener('keydown', e => {
        if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
        const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                      Enter: 'a', z: 'a', Z: 'a', x: 'b', X: 'b', Escape: 'b', Backspace: 'b' };
        const k = map[e.key];
        if (!k) return;
        if (!uiNavActive() && k !== 'b') return;
        if (navKey(k)) e.preventDefault();
    });

    // ------------------------------------------------ Emerald START menu ----
    // The real pokeemerald pause menu: a white window in the top-right corner
    // over the world, with the authentic entries + description box.
    const START_MENU = [
        { label: 'POKéDEX', desc: 'A device that records POKéMON secrets upon meeting or catching them.', go: () => UI.showDex() },
        { label: 'POKéMON', desc: 'Check and organize POKéMON that are traveling with you in your party.', go: () => UI.showParty() },
        { label: 'BAG', desc: 'Equipped with pockets for storing items you bought, received, or found.', go: () => UI.showBag() },
        { label: 'POKéNAV', desc: 'A device for navigating the region: GYM battles and the POKéMART.', go: () => UI.showPokenav() },
        { label: null, desc: 'Check your money and other game data.', go: () => UI.showTrainerCard() },  // player name
        { label: 'SAVE', desc: 'Save your game with a complete record of your progress to take a break.', go: () => UI.doSave() },
        { label: 'OPTION', desc: 'Adjust various game settings.', go: () => UI.showOptions() },
        { label: 'EXIT', desc: 'Close this MENU window.', go: null },
    ];

    UI.showMenu = function () {
        const layer = $('#modal-layer');
        // START toggles the menu closed if it is already open (like the game).
        const open = layer.querySelector('.esm-overlay');
        if (open) { open.remove(); return; }
        const overlay = el('div', 'esm-overlay');
        const win = el('div', 'esm-win');
        const desc = el('div', 'esm-desc');
        navPush();
        function close() { overlay.remove(); navPop(); }
        // Guard against the same tap that opened the menu (START button sits
        // under the new overlay, so its pointerup lands here and closed it).
        const openedAt = Date.now();
        overlay.onclick = e => { if (Date.now() - openedAt > 400 && e.target === overlay) close(); };
        START_MENU.forEach((item, i) => {
            const label = item.label || G.state.name.toUpperCase();
            const row = el('div', 'esm-row' + (i === 0 ? ' sel' : ''), esc(label));
            const select = () => {
                win.querySelectorAll('.esm-row').forEach(r => r.classList.remove('sel'));
                row.classList.add('sel');
                desc.textContent = item.desc;
            };
            row.onmouseenter = select;
            row.onclick = () => {
                select();
                close();
                if (item.go) item.go();
            };
            win.appendChild(row);
        });
        desc.textContent = START_MENU[0].desc;
        overlay.appendChild(win);
        overlay.appendChild(desc);
        layer.appendChild(overlay);
        navSet([...win.children], { onBack: close });
    };

    // ---------------------------------------------------------------- SAVE --
    UI.doSave = function () {
        choose('Would you like to save the game?', [{ label: 'YES' }, { label: 'NO' }], false).then(idx => {
            if (idx === 0) {
                G.save();
                alertModal(G.state.name.toUpperCase() + ' saved the game.');
            }
        });
    };

    // ------------------------------------------------------------- POKéNAV --
    UI.showPokenav = function () {
        choose('POKéNAV', [
            { label: 'MATCH CALL', sub: 'GYM leaders & the POKéMON LEAGUE' },
            { label: 'MART DELIVERY', sub: 'Buy items anywhere' },
            { label: 'HEAL TEAM', sub: 'Free — like a POKéMON CENTER' },
        ], true).then(idx => {
            if (idx === 0) UI.showGyms();
            else if (idx === 1) UI.showMart();
            else if (idx === 2) { G.healTeam(); G.save(); alertModal('Your team was fully healed!'); }
        });
    };

    // ------------------------------------------------------------ OPTIONS ---
    // Real Emerald options that actually do something: TEXT SPEED drives the
    // battle message pacing, BATTLE SCENE toggles attack animations.
    UI.opts = function () {
        if (!G.state.options) G.state.options = { textSpeed: 'MID', battleScene: true };
        return G.state.options;
    };
    UI.textDelay = function (ms) {
        const sp = UI.opts().textSpeed;
        return Math.round(ms * (sp === 'SLOW' ? 1.5 : sp === 'FAST' ? 0.55 : 1));
    };

    UI.showOptions = function () {
        const o = UI.opts();
        const s = screen();
        s.appendChild(el('h2', '', 'OPTION'));
        const win = el('div', 'ew opt-win');
        function row(label, valueHtml, onclick) {
            const r = el('div', 'opt-row', '<span>' + label + '</span><b>' + valueHtml + '</b>');
            if (onclick) r.onclick = onclick;
            return r;
        }
        function rebuild() {
            win.innerHTML = '';
            win.appendChild(row('TEXT SPEED',
                ['SLOW', 'MID', 'FAST'].map(v => v === o.textSpeed ? '<i class="opt-on">' + v + '</i>' : v).join(' '),
                () => { o.textSpeed = o.textSpeed === 'SLOW' ? 'MID' : o.textSpeed === 'MID' ? 'FAST' : 'SLOW'; G.save(); rebuild(); }));
            win.appendChild(row('BATTLE SCENE',
                ['ON', 'OFF'].map(v => (o.battleScene ? 'ON' : 'OFF') === v ? '<i class="opt-on">' + v + '</i>' : v).join(' '),
                () => { o.battleScene = !o.battleScene; G.save(); rebuild(); }));
        }
        rebuild();
        s.appendChild(win);
        s.appendChild(el('div', 'muted', 'Tap a row to change its setting.'));
    };

    // ------------------------------------------------------- TRAINER CARD ---
    UI.showTrainerCard = function () {
        const s = screen();
        const dc = G.dexCounts();
        const mins = Math.floor((Date.now() - (G.state.started || Date.now())) / 60000);
        const time = Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0');
        const card = el('div', 'ew tcard');
        card.innerHTML =
            '<div class="tc-title">TRAINER CARD</div>' +
            '<div class="tc-name">NAME: <b>' + esc(G.state.name.toUpperCase()) + '</b></div>' +
            '<div class="tc-row"><span>MONEY</span><b>$' + G.state.money.toLocaleString() + '</b></div>' +
            '<div class="tc-row"><span>POKéDEX</span><b>' + dc.caught + '</b></div>' +
            '<div class="tc-row"><span>TIME</span><b>' + time + '</b></div>' +
            '<div class="tc-row"><span>BATTLES</span><b>' + G.state.wins + ' won · ' + G.state.losses + ' lost</b></div>' +
            '<div class="tc-badges">BADGES<div>' +
            D.GYMS.filter(g => g.badge).map(g =>
                '<span class="tc-badge' + (G.state.gymsBeaten[g.id] ? ' got' : '') + '" title="' + esc(g.badge) + '"></span>').join('') +
            '</div></div>';
        s.appendChild(card);
    };

    const TYPE_COLORS = {
        Normal: '#9fa19f', Fighting: '#ff8000', Flying: '#81b9ef', Poison: '#9141cb',
        Ground: '#915121', Rock: '#afa981', Bug: '#91a119', Ghost: '#704170',
        Steel: '#60a1b8', Fire: '#e62829', Water: '#2980ef', Grass: '#3fa129',
        Electric: '#fac000', Psychic: '#ef4179', Ice: '#3fd8ff', Dragon: '#5060e1',
        Dark: '#50413f', Fairy: '#ef70ef',
    };
    function typeChip(t) {
        return '<span class="type-chip" style="background:' + (TYPE_COLORS[t] || '#666') + '">' + esc(t) + '</span>';
    }
    const ENV_ICON = { grass: '🌿', forest: '🌲', cave: '⛰️', water: '🌊', ice: '❄️', volcano: '🌋', building: '🏛️', sand: '🏜️' };

    // -------------------------------------------------------------- topbar --
    UI.updateTopbar = function () {
        const bar = $('#topbar');
        if (!bar) return;
        if (!G.state) { bar.style.display = 'none'; return; }
        // Overworld mode: the topbar belongs to the crater screens, not the
        // walkable world — hide it whenever the overlay is closed.
        if (UI.worldMode) {
            const scr = $('#screen');
            bar.style.display = (scr && scr.childElementCount > 0) ? '' : 'none';
        } else {
            bar.style.display = '';
        }
        const dc = G.dexCounts();
        $('#tb-name').textContent = G.state.name;
        $('#tb-money').textContent = '$' + G.state.money.toLocaleString();
        $('#tb-badges').textContent = 'BADGES ' + G.badgeCount();
        $('#tb-dex').textContent = 'DEX ' + dc.caught + '/' + D.MAX_DEX;
    };

    // --------------------------------------------------------------- modal --
    function modal(build) {
        return new Promise(resolve => {
            const layer = $('#modal-layer');
            const overlay = el('div', 'modal-overlay');
            const win = el('div', 'modal-win');
            overlay.appendChild(win);
            layer.appendChild(overlay);
            navPush();
            build(win, val => { overlay.remove(); navPop(); resolve(val); });
        });
    }
    // options: [{label, sub, disabled, img, filter}] -> resolves index or null
    function choose(title, options, allowCancel) {
        return modal((win, done) => {
            win.appendChild(el('div', 'modal-title', esc(title)));
            options.forEach((o, i) => {
                const row = el('button', 'modal-opt' + (o.disabled ? ' disabled' : ''));
                if (o.img) {
                    const img = el('img', 'opt-icon');
                    img.src = o.img;
                    if (o.filter) img.style.filter = o.filter;
                    row.appendChild(img);
                }
                const tx = el('span', '', '<b>' + esc(o.label) + '</b>' + (o.sub ? '<small>' + o.sub + '</small>' : ''));
                row.appendChild(tx);
                if (!o.disabled) row.onclick = () => done(i);
                win.appendChild(row);
            });
            if (allowCancel !== false) {
                const c = el('button', 'modal-cancel', 'CANCEL');
                c.onclick = () => done(null);
                win.appendChild(c);
            }
            navSet([...win.querySelectorAll('.modal-opt:not(.disabled), .modal-cancel')],
                { onBack: allowCancel !== false ? () => done(null) : null });
        });
    }
    function alertModal(text) {
        return modal((win, done) => {
            win.appendChild(el('div', 'modal-title', esc(text)));
            const ok = el('button', 'modal-opt', '<b>OK</b>');
            ok.onclick = () => done(true);
            win.appendChild(ok);
            navSet([ok], { onBack: () => done(true) });
        });
    }

    // ---------------------------------------------------------- mon helpers -
    function hpPct(mon) { return Math.max(0, Math.min(100, 100 * mon.hp / M.stats(mon).hp)); }
    // Authentic hpbar_anim.pal fill colours (green / yellow / red).
    function hpColor(pct) { return pct > 50 ? '#5ad583' : pct > 20 ? '#cdac08' : '#ff5a39'; }
    function statusTag(mon) {
        if (!mon.status) return '';
        const map = { paralysis: ['PAR', '#c8a000'], burn: ['BRN', '#e05020'], poison: ['PSN', '#a040a0'], sleep: ['SLP', '#8090a0'], freeze: ['FRZ', '#40a0d0'] };
        const m = map[mon.status];
        return '<span class="status-tag" style="background:' + m[1] + '">' + m[0] + '</span>';
    }
    function variantFilter(mon) { return M.VARIANTS[mon.variant].filter; }
    function monLabel(mon) {
        const v = M.VARIANTS[mon.variant];
        return (v.label ? '<span class="var-tag var-' + mon.variant + '">' + v.label + '</span> ' : '') + esc(D.species[mon.dex].name);
    }

    // ================================================================ TITLE ==
    UI.showTitle = function () {
        UI.updateTopbar();
        const s = screen();
        const wrap = el('div', 'title-screen');
        wrap.appendChild(el('div', 'title-logo', 'Pokémon<span>Crater</span>'));
        wrap.appendChild(el('div', 'title-sub', 'Classic click-to-battle remake · Kanto · Johto · Hoenn · Sinnoh'));
        const btns = el('div', 'title-btns');
        if (G.load()) {
            const cont = el('button', 'big-btn primary', 'Continue — ' + esc(G.state.name) +
                ' <small>' + G.state.party.length + ' Pokémon · 🏅' + G.badgeCount() + '</small>');
            cont.onclick = () => {
                UI.updateTopbar();
                if (UI.worldMode) CraterOverworld.enterWorld(); else UI.showMap();
            };
            btns.appendChild(cont);
        }
        const nw = el('button', 'big-btn', 'New Game');
        nw.onclick = async () => {
            if (G.state && !(await choose('Start over? Your current save will be erased!', [{ label: 'Yes, start fresh' }], true) === 0)) return;
            UI.showStarter();
        };
        btns.appendChild(nw);
        wrap.appendChild(btns);
        wrap.appendChild(el('div', 'title-credit', 'Built from this repo\'s real extracted game data — USUM stats/moves + FireRed/HnS/Emerald/Platinum encounter tables.'));
        s.appendChild(wrap);
    };

    // ============================================================== STARTER ==
    UI.showStarter = function () {
        const s = screen();
        const wrap = el('div', 'starter-screen');
        wrap.appendChild(el('h2', '', 'Choose your starter!'));
        const nameRow = el('div', 'name-row');
        const input = el('input', 'name-input');
        input.placeholder = 'Your trainer name';
        input.maxLength = 12;
        nameRow.appendChild(input);
        wrap.appendChild(nameRow);
        const grid = el('div', 'starter-grid');
        D.STARTERS.forEach(slug => {
            const dex = D.dexBySlug[slug];
            const sp = D.species[dex];
            const card = el('button', 'starter-card');
            card.innerHTML = '<img src="' + D.sprite(slug, 'front') + '" alt="">' +
                '<b>' + esc(sp.name) + '</b><span>' + sp.types.map(typeChip).join('') + '</span>';
            card.onclick = () => {
                const name = input.value.trim() || 'Trainer';
                G.clearSave();
                G.newGame(name, slug);
                UI.updateTopbar();
                alertModal('You received ' + sp.name + '! Your adventure begins!').then(() => {
                    if (UI.worldMode) CraterOverworld.enterWorld(); else UI.showMap();
                });
            };
            grid.appendChild(card);
        });
        wrap.appendChild(grid);
        s.appendChild(wrap);
    };

    // ================================================================== MAP ==
    let curRegion = 'kanto';
    UI.showMap = function () {
        UI.updateTopbar();
        const s = screen();
        const tabs = el('div', 'region-tabs');
        D.zones.regions.forEach(r => {
            const b = el('button', 'region-tab' + (r.id === curRegion ? ' active' : ''), esc(r.name));
            b.onclick = () => { curRegion = r.id; UI.showMap(); };
            tabs.appendChild(b);
        });
        s.appendChild(tabs);
        const region = D.zones.regions.find(r => r.id === curRegion);
        const grid = el('div', 'zone-grid');
        region.zones.forEach(zid => {
            const z = D.zones.zones[zid];
            const [lo, hi] = G.zoneLevelRange(z);
            const unlocked = G.zoneUnlocked(z);
            const b = el('button', 'zone-card env-' + z.env + (z.special ? ' special' : '') + (unlocked ? '' : ' locked'));
            b.innerHTML = '<span class="z-ico">' + (z.special ? '⭐' : ENV_ICON[z.env] || '🌿') + '</span>' +
                '<b>' + esc(z.name) + '</b>' +
                '<small>Lv ' + lo + '–' + hi + (z.rares ? ' <i class="rare-hint">✦</i>' : '') + '</small>' +
                (unlocked ? '' : '<span class="lock">🔒 8 badges</span>');
            if (unlocked) b.onclick = () => UI.showZone(zid);
            grid.appendChild(b);
        });
        s.appendChild(grid);
    };

    // ================================================================= ZONE ==
    UI.showZone = function (zoneId, keepSpawns) {
        UI.updateTopbar();
        const z = D.zones.zones[zoneId];
        UI.zoneId = zoneId;
        if (!keepSpawns || !UI.spawns) UI.spawns = G.spawnZone(zoneId);
        const s = screen();

        const head = el('div', 'zone-head');
        head.appendChild(el('div', 'zone-title', (ENV_ICON[z.env] || '') + ' <b>' + esc(z.name) + '</b> <small>' + esc(z.region.toUpperCase()) + '</small>'));
        const btns = el('div', 'zone-btns');
        const back = el('button', 'sm-btn', '← Map');
        back.onclick = UI.showMap;
        const again = el('button', 'sm-btn primary', 'SEARCH AGAIN');
        again.onclick = () => UI.showZone(zoneId);
        btns.appendChild(back); btns.appendChild(again);
        head.appendChild(btns);
        s.appendChild(head);

        const field = el('div', 'zone-field env-' + z.env);
        UI.spawns.forEach((sp, i) => {
            if (sp.defeated) return;
            const dex = D.dexBySlug[sp.slug];
            const spc = D.species[dex];
            const w = el('button', 'wild-spawn' + (sp.variant !== 'normal' ? ' v-' + sp.variant : '') + (sp.rare ? ' rare' : ''));
            w.style.left = sp.x + '%';
            w.style.top = sp.y + '%';
            const vf = M.VARIANTS[sp.variant].filter;
            w.innerHTML = '<img src="' + D.sprite(sp.slug, 'front') + '" alt=""' + (vf ? ' style="filter:' + vf + '"' : '') + '>' +
                '<span class="w-label">' + (M.VARIANTS[sp.variant].label ? M.VARIANTS[sp.variant].label + ' ' : '') + esc(spc.name) + ' <b>Lv' + sp.level + '</b></span>';
            w.onclick = () => UI.startWildBattle(sp, i);
            field.appendChild(w);
        });
        if (!UI.spawns.some(sp => !sp.defeated)) {
            field.appendChild(el('div', 'field-empty', 'No Pokémon around... Search again!'));
        }
        s.appendChild(field);
        s.appendChild(el('div', 'zone-tip', 'Tap a wild Pokémon to battle it. ✦-marked areas hide rare legends. Colored variants (Shiny/Dark/Mystic/Metallic/Shadow) are stronger & give bonus EXP!'));
    };

    // =============================================================== BATTLE ==
    UI.startWildBattle = function (spawn, spawnIdx) {
        const enemy = M.create(spawn.slug, spawn.level, { variant: spawn.variant });
        G.markSeen(spawn.slug);
        const alive = G.state.party.some(m => m.hp > 0);
        if (!alive) { alertModal('All your Pokémon have fainted! Heal your team first (❤ button).'); return; }
        UI.battle = B.begin(G.state.party, [enemy], { isTrainer: false });
        UI.battle._spawnIdx = spawnIdx;
        UI.battle._zoneEnv = UI.worldMode
            ? (UI.battleEnv || 'grass')
            : D.zones.zones[UI.zoneId].env;
        renderBattle();
        playIntro('A wild ' + M.displayName(enemy) + ' appeared!');
    };

    UI.startGymBattle = function (gym) {
        const team = G.gymTeam(gym);
        team.forEach(m => G.markSeen(m.slug));
        const alive = G.state.party.some(m => m.hp > 0);
        if (!alive) { alertModal('All your Pokémon have fainted! Heal your team first (❤ button).'); return; }
        UI.battle = B.begin(G.state.party, team, { isTrainer: true, trainerName: gym.name });
        UI.battle._gym = gym;
        UI.battle._zoneEnv = 'building';
        renderBattle();
        playIntro(gym.name + ' wants to battle! ' + gym.name + ' sent out ' + M.displayName(team[0]) + '!');
    };

    async function playIntro(text) {
        UI.busy = true;
        setLog(text);
        await sleep(UI.textDelay(700));
        UI.busy = false;
        renderActions();
    }

    // ---- pret-pokeemerald battle stage: 240×160 GBA px, scaled to fit ----
    function fitStage() {
        const wrap = $('.eb-stage-wrap');
        if (!wrap) return;
        const w = wrap.clientWidth;
        wrap.style.height = Math.round(w / 1.5) + 'px';
        const stage = wrap.querySelector('.eb-stage');
        if (stage) stage.style.transform = 'scale(' + (w / 240) + ')';
    }
    window.addEventListener('resize', fitStage);

    function renderBattle() {
        const s = screen();
        const bt = UI.battle;
        const e = bt.enemies[bt.enemyIdx];
        const p = bt.party[bt.partyIdx];
        const wrap = el('div', 'battle');
        wrap.innerHTML =
            '<div class="eb-outer"><div class="eb-stage-wrap">' +
            '<div class="eb-stage env-' + (bt._zoneEnv || 'grass') + '" id="bt-arena">' +
            '<div class="eb-field"><div class="eb-base enemy"></div><div class="eb-base player"></div></div>' +
            '<img id="bt-esprite" class="eb-esprite" src="' + D.sprite(e.slug, 'front') + '"' +
            (variantFilter(e) ? ' style="filter:' + variantFilter(e) + '"' : '') + '>' +
            '<img id="bt-psprite" class="eb-psprite" src="' + D.sprite(p.slug, 'back') + '"' +
            (variantFilter(p) ? ' style="filter:' + variantFilter(p) + '"' : '') + '>' +
            '<div class="eb-ebox" id="bt-ebox">' + infoBox(e, false) + '</div>' +
            '<div class="eb-pbox" id="bt-pbox">' + infoBox(p, true) + '</div>' +
            '<div class="eb-bottom" id="bt-panel"></div>' +
            '</div></div></div>';
        s.appendChild(wrap);
        fitStage();
        renderActions();
    }

    /** Inner HTML of an Emerald healthbox (name / Lv / HP track / status,
        plus HP numbers + EXP fill on the player box). */
    function infoBox(mon, isPlayer) {
        const st = M.stats(mon);
        const pct = hpPct(mon);
        const sp = D.species[mon.dex];
        const hpCls = pct > 50 ? '' : pct > 20 ? ' hp-yellow' : ' hp-red';
        let html = '<div class="eb-name">' + monLabel(mon) +
            (mon.gender ? '<i class="g-' + mon.gender + '">' + (mon.gender === 'M' ? '♂' : '♀') + '</i>' : '') + '</div>' +
            '<div class="eb-lv">Lv' + mon.level + '</div>' +
            '<div class="eb-hp"><img src="src/assets/emerald_ui/hp_label.png" alt="HP">' +
            '<div class="eb-track"><div class="eb-fill' + hpCls + '" style="width:' + pct + '%"></div></div></div>';
        if (mon.status) {
            const cls = { poison: 'st-psn', paralysis: 'st-par', sleep: 'st-slp', freeze: 'st-frz', burn: 'st-brn' }[mon.status];
            html += '<div class="eb-status ' + cls + '"></div>';
        }
        if (isPlayer) {
            html += '<div class="eb-hpnum">' + mon.hp + '/' + st.hp + '</div>';
            const cur = D.expForLevel(sp.growthRate, mon.level);
            const next = D.expForLevel(sp.growthRate, mon.level + 1);
            const ep = mon.level >= 100 ? 0 : Math.min(100, 100 * (mon.exp - cur) / Math.max(1, next - cur));
            html += '<div class="eb-exp"><div style="width:' + ep + '%"></div></div>';
        } else if (G.state && G.state.dex.caught[mon.slug]) {
            html += '<div class="eb-caught"></div>';
        }
        return html;
    }

    function refreshBoxes() {
        const bt = UI.battle;
        const ebox = $('#bt-ebox'), pbox = $('#bt-pbox');
        if (ebox) ebox.innerHTML = infoBox(bt.enemies[bt.enemyIdx], false);
        if (pbox) pbox.innerHTML = infoBox(bt.party[bt.partyIdx], true);
    }
    function refreshSprites() {
        const bt = UI.battle;
        const e = bt.enemies[bt.enemyIdx], p = bt.party[bt.partyIdx];
        const es = $('#bt-esprite'), ps = $('#bt-psprite');
        if (es) { es.src = D.sprite(e.slug, 'front'); es.style.filter = variantFilter(e); es.classList.remove('gone'); }
        if (ps) { ps.src = D.sprite(p.slug, 'back'); ps.style.filter = variantFilter(p); ps.classList.remove('gone'); }
    }
    function setLog(text) {
        navSet([]);   // no cursor while a message plays
        const bottom = $('#bt-panel');
        if (!bottom) return;
        bottom.innerHTML = '<div class="eb-msg" id="bt-msg"></div>';
        $('#bt-msg').textContent = text;
    }

    /** Emerald command phase: "What will X do?" + FIGHT/BAG/POKéMON/RUN. */
    function renderActions() {
        const bottom = $('#bt-panel');
        if (!bottom) return;
        const bt = UI.battle;
        if (!bt || bt.over) return;
        if (UI.busy) return;   // a message is playing; leave the textbox alone
        const p = bt.party[bt.partyIdx];
        bottom.innerHTML = '<div class="eb-msg half" id="bt-msg">What will<br>' +
            esc(M.displayName(p).toUpperCase()) + ' do?</div>';
        const cmd = el('div', 'eb-cmd');
        const mk = (label, fn, dis) => {
            const b = el('button', '', esc(label));
            b.disabled = !!dis;
            b.onclick = fn;
            cmd.appendChild(b);
            return b;
        };
        mk('FIGHT', renderMoves);
        mk('BAG', openBag);
        mk('POKéMON', () => openSwitch(false));
        mk('RUN', () => doTurn({ type: 'run' }));
        bottom.appendChild(cmd);
        navSet([...cmd.children], { cols: 2 });
    }

    /** Emerald move-select phase: 2×2 move grid + PP/TYPE box. */
    function renderMoves() {
        const bottom = $('#bt-panel');
        if (!bottom) return;
        const bt = UI.battle;
        const p = bt.party[bt.partyIdx];
        bottom.innerHTML = '';
        const grid = el('div', 'eb-moves');
        const pp = el('div', 'eb-ppbox');
        function showPP(m) {
            const mv = D.moves[m.id];
            pp.innerHTML = 'PP <span class="pp-num">' + m.pp + '/' + m.maxPp + '</span><br>' +
                'TYPE/' + esc(mv.type.toUpperCase()) + '<br><span class="pp-back">CANCEL</span>';
            pp.querySelector('.pp-back').onclick = renderActions;
        }
        for (let i = 0; i < 4; i++) {
            const m = p.moves[i];
            if (!m) { grid.appendChild(el('button', '', '-')); continue; }
            const mv = D.moves[m.id];
            const b = el('button', '', esc(mv.name.toUpperCase()));
            b.disabled = m.pp <= 0;
            b.onmouseenter = () => showPP(m);
            b.onclick = () => { showPP(m); doTurn({ type: 'move', idx: i }); };
            grid.appendChild(b);
        }
        bottom.appendChild(grid);
        bottom.appendChild(pp);
        showPP(p.moves[0]);
        navSet([...grid.children].filter(b => !b.disabled && b.textContent !== '-'),
            { cols: 2, onBack: renderActions });
    }

    async function openBag() {
        if (UI.busy) return;
        // Emerald keeps Poké Balls in the Bag — list balls first, then items.
        const ballIds = ['poke_ball', 'great_ball', 'ultra_ball', 'master_ball']
            .filter(id => (G.state.items[id] || 0) > 0 && !UI.battle.isTrainer);
        const ids = ballIds.concat(
            Object.keys(D.ITEMS).filter(id => D.ITEMS[id].kind !== 'ball' && (G.state.items[id] || 0) > 0));
        if (!ids.length) { alertModal('The BAG is empty! Buy items at the POKéMART.'); return; }
        {
            const idx = await choose('BAG', ids.map(id => ({
                label: D.ITEMS[id].name + ' ×' + G.state.items[id],
                sub: D.ITEMS[id].kind === 'ball' ? 'Throw at the wild Pokémon'
                    : D.ITEMS[id].kind === 'heal' ? 'Restores ' + D.ITEMS[id].heal + ' HP'
                    : D.ITEMS[id].kind === 'cure' ? 'Cures status' : 'Revives a fainted Pokémon',
            })));
            if (idx === null) return;
            const id = ids[idx];
            if (D.ITEMS[id].kind === 'ball') {
                G.useItem(id);
                doTurn({ type: 'ball', item: id });
                return;
            }
            return useHealItem(id);
        }
    }

    async function useHealItem(id) {
        const item = D.ITEMS[id];
        const bt = UI.battle;
        const targets = bt.party.map((m, i) => ({ mon: m, i: i })).filter(x =>
            item.kind === 'revive' ? x.mon.hp <= 0 : x.mon.hp > 0);
        if (!targets.length) { alertModal('No valid target.'); return; }
        const t = await choose('Use on which Pokémon?', targets.map(x => ({
            label: M.displayName(x.mon) + ' Lv' + x.mon.level,
            sub: x.mon.hp + '/' + M.stats(x.mon).hp + ' HP',
            img: D.sprite(x.mon.slug, 'icons'),
        })));
        if (t === null) return;
        G.useItem(id);
        doTurn({ type: 'heal', item: id, targetIdx: targets[t].i });
    }

    async function openSwitch(forced) {
        if (UI.busy && !forced) return;
        const bt = UI.battle;
        const opts = bt.party.map((m, i) => ({ mon: m, i: i }))
            .filter(x => x.i !== bt.partyIdx && x.mon.hp > 0);
        if (!opts.length) {
            if (!forced) alertModal('No other Pokémon able to battle!');
            return false;
        }
        const idx = await choose(forced ? 'Choose your next Pokémon!' : 'Switch to which Pokémon?',
            opts.map(x => ({
                label: M.displayName(x.mon) + ' Lv' + x.mon.level,
                sub: x.mon.hp + '/' + M.stats(x.mon).hp + ' HP',
                img: D.sprite(x.mon.slug, 'icons'),
            })), !forced);
        if (idx === null) { if (forced) return openSwitch(true); return false; }
        if (forced) {
            B.forceSwitch(bt, opts[idx].i);
            refreshSprites(); refreshBoxes(); renderActions();
            setLog('Go, ' + M.displayName(bt.party[bt.partyIdx]) + '!');
            return true;
        }
        doTurn({ type: 'switch', idx: opts[idx].i });
        return true;
    }

    async function doTurn(action) {
        if (UI.busy || !UI.battle || UI.battle.over) return;
        UI.busy = true;
        renderActions();
        const bt = UI.battle;
        const events = B.turn(bt, action);
        await playEvents(events);
        UI.busy = false;
        if (bt.over) return endBattle();
        refreshBoxes();
        renderActions();
    }

    async function playEvents(events) {
        const bt = UI.battle;
        for (const ev of events) {
            if (ev.anim) playAnim(ev.anim);
            switch (ev.t) {
                case 'msg':
                    setLog(ev.text);
                    await sleep(UI.textDelay(650));
                    break;
                case 'hp':
                    refreshBoxes();
                    await sleep(UI.textDelay(350));
                    break;
                case 'switch':
                    refreshSprites(); refreshBoxes();
                    await sleep(UI.textDelay(400));
                    break;
                case 'shake':
                    setLog('...' + '❋'.repeat(ev.n));
                    await sleep(UI.textDelay(500));
                    break;
                case 'faint': {
                    const spr = ev.side === 'e' ? $('#bt-esprite') : $('#bt-psprite');
                    if (spr) spr.classList.add('gone');
                    await sleep(400);
                    break;
                }
                case 'exp':
                    await handleExp(ev.foe);
                    break;
                case 'caught':
                    await handleCaught(ev.mon);
                    break;
                case 'forceSwitch':
                    if (!bt.over) {
                        await openSwitch(true);
                    }
                    break;
            }
        }
    }

    function playAnim(anim) {
        if (!UI.opts().battleScene) return;   // OPTION: BATTLE SCENE off
        if (anim.kind === 'attack') {
            const spr = anim.side === 'p' ? $('#bt-psprite') : $('#bt-esprite');
            if (spr) { spr.classList.remove('atk-p', 'atk-e'); void spr.offsetWidth; spr.classList.add(anim.side === 'p' ? 'atk-p' : 'atk-e'); }
        } else if (anim.kind === 'hit') {
            const spr = anim.side === 'p' ? $('#bt-psprite') : $('#bt-esprite');
            if (spr) { spr.classList.remove('hit'); void spr.offsetWidth; spr.classList.add('hit'); }
        }
    }

    async function handleExp(foe) {
        const bt = UI.battle;
        const mon = bt.party[bt.partyIdx];
        const exp = M.expGain(foe, bt.isTrainer);
        setLog(M.displayName(mon) + ' gained ' + exp + ' EXP. Points!');
        if (!bt.isTrainer) {
            const prize = G.wildPrize(foe);
            G.state.money += prize;
            UI.updateTopbar();
        }
        await sleep(UI.textDelay(600));
        const events = M.gainExp(mon, exp);
        for (const e of events) {
            if (e.type === 'level') {
                refreshBoxes();
                setLog(M.displayName(mon) + ' grew to LV. ' + e.level + '!');
                await sleep(UI.textDelay(650));
            } else if (e.type === 'learn') {
                await promptLearn(mon, e.move);
            } else if (e.type === 'evolve') {
                await promptEvolve(mon, e);
            }
        }
        G.state.wins++;
        G.save();
    }

    async function promptLearn(mon, moveId) {
        const mv = D.moves[moveId];
        if (mon.moves.length < 4) {
            M.learnMove(mon, moveId);
            await alertModal(M.displayName(mon) + ' learned ' + mv.name + '!');
            refreshBoxes();
            return;
        }
        const opts = mon.moves.map(m => {
            const om = D.moves[m.id];
            return { label: 'Forget ' + om.name, sub: om.type + ' · ' + (om.power || '—') + ' pow' };
        });
        opts.push({ label: 'Skip learning ' + mv.name, sub: mv.type + ' · ' + (mv.power || '—') + ' pow' });
        const idx = await choose(M.displayName(mon) + ' wants to learn ' + mv.name + ' (' + mv.type + ', ' + (mv.power || 'status') + ')!', opts, false);
        if (idx !== null && idx < 4) {
            M.learnMove(mon, moveId, idx);
            await alertModal(M.displayName(mon) + ' learned ' + mv.name + '!');
        }
        refreshBoxes();
    }

    async function promptEvolve(mon, evo) {
        const idx = await choose('What? ' + M.displayName(mon) + ' is evolving into ' + evo.name + '!',
            [{ label: 'Let it evolve!', img: D.sprite(evo.intoSlug, 'front'), filter: variantFilter(mon) }, { label: 'Stop evolution' }], false);
        if (idx === 0) {
            M.evolve(mon, evo.intoSlug);
            G.markCaught(mon.slug);
            await alertModal('Congratulations! It evolved into ' + evo.name + '!');
            refreshSprites(); refreshBoxes();
            UI.updateTopbar();
        }
    }

    async function handleCaught(mon) {
        const where = G.addMon(mon);
        UI.updateTopbar();
        await alertModal(M.displayName(mon) + ' was added to your ' + (where === 'party' ? 'party!' : 'PC box!'));
    }

    async function endBattle() {
        const bt = UI.battle;
        G.save();
        if (bt.result === 'lose') {
            const loss = Math.floor(G.state.money * 0.1);
            G.state.money -= loss;
            G.state.losses++;
            G.healTeam();
            G.save();
            await alertModal('You blacked out! You lost ₽' + loss.toLocaleString() + '. Your team was rushed to a Pokémon Center and healed.');
        } else if (bt.result === 'win' && bt._gym) {
            const gym = bt._gym;
            if (!G.state.gymsBeaten[gym.id]) {
                G.state.gymsBeaten[gym.id] = true;
                G.state.money += gym.reward;
                await alertModal('You defeated ' + gym.name + '! ' +
                    (gym.badge ? 'You received the ' + gym.badge + ' and ₽' + gym.reward.toLocaleString() + '!' : 'You won ₽' + gym.reward.toLocaleString() + '!'));
            } else {
                const re = Math.floor(gym.reward / 4);
                G.state.money += re;
                await alertModal('You defeated ' + gym.name + ' again! Won ₽' + re.toLocaleString() + '.');
            }
            G.save();
        } else if (bt.result === 'win' && bt._spawnIdx !== undefined && UI.spawns && UI.spawns[bt._spawnIdx]) {
            UI.spawns[bt._spawnIdx].defeated = true;
        } else if (bt.result === 'caught' && bt._spawnIdx !== undefined && UI.spawns && UI.spawns[bt._spawnIdx]) {
            UI.spawns[bt._spawnIdx].defeated = true;
        }
        UI.updateTopbar();
        UI.battle = null;
        if (UI.worldMode) {
            if (bt._gym) UI.showGyms();
            else UI.closeToWorld();
        } else if (bt._gym) {
            UI.showGyms();
        } else {
            UI.showZone(UI.zoneId, true);
        }
    }

    // ================================================================ PARTY ==
    // Emerald party menu: teal background, big lead slot + list slots, CANCEL.
    UI.showParty = function () {
        UI.updateTopbar();
        const s = screen();
        const wrap = el('div', 'em-party');
        wrap.appendChild(el('div', 'em-screen-head', 'Choose a POKéMON.'));
        const grid = el('div', 'pt-grid');
        const navRows = [];
        G.state.party.forEach((mon, i) => {
            const slot = partySlot(mon, i === 0);
            slot.onclick = () => partyActions(mon, i);
            navRows.push(slot);
            grid.appendChild(slot);
        });
        wrap.appendChild(grid);
        const cancel = el('div', 'pt-cancel', 'CANCEL');
        cancel.onclick = () => UI.closeToWorld();
        wrap.appendChild(cancel);
        navRows.push(cancel);

        wrap.appendChild(el('div', 'em-screen-head', 'PC BOX (' + G.state.box.length + ')'));
        if (!G.state.box.length) wrap.appendChild(el('div', 'muted', 'Nothing stored. Catches overflow here when your party is full.'));
        const boxGrid = el('div', 'box-grid');
        G.state.box.forEach((mon, i) => {
            const c = el('button', 'box-cell');
            const vf = variantFilter(mon);
            c.innerHTML = '<img src="' + D.sprite(mon.slug, 'icons') + '"' + (vf ? ' style="filter:' + vf + '"' : '') + '><span>' + monLabel(mon) + '<br>Lv' + mon.level + '</span>';
            c.onclick = () => boxActions(mon, i);
            boxGrid.appendChild(c);
        });
        wrap.appendChild(boxGrid);
        s.appendChild(wrap);
        navSet(navRows, { onBack: () => UI.closeToWorld() });
    };

    function partySlot(mon, big) {
        const st = M.stats(mon);
        const pct = hpPct(mon);
        const slot = el('div', 'pt-slot' + (big ? ' big' : '') + (mon.hp <= 0 ? ' fnt' : ''));
        const vf = variantFilter(mon);
        slot.innerHTML =
            '<img src="' + D.sprite(mon.slug, 'icons') + '"' + (vf ? ' style="filter:' + vf + '"' : '') + '>' +
            '<div class="pt-mid">' +
            '<div class="pt-name">' + monLabel(mon) +
            (mon.gender ? ' <i class="g-' + mon.gender + '">' + (mon.gender === 'M' ? '♂' : '♀') + '</i>' : '') +
            ' <span class="pt-lv">Lv' + mon.level + '</span> ' + statusTag(mon) + '</div>' +
            '<div class="pt-bar"><em>HP</em><div class="hp-outer"><div class="hp-inner" style="width:' + pct + '%;background:' + hpColor(pct) + '"></div></div></div>' +
            '<div class="pt-hp">' + mon.hp + '/' + st.hp + '</div>' +
            '</div>';
        return slot;
    }

    async function partyActions(mon, i) {
        const opts = [{ label: 'SUMMARY' }];
        if (i > 0) opts.push({ label: 'SWITCH', sub: 'Move to the front of the party' });
        if (G.state.party.length > 1) opts.push({ label: 'SEND TO BOX' });
        opts.push({ label: 'CANCEL' });
        const idx = await choose('Do what with ' + M.displayName(mon) + '?', opts, false);
        const lab = idx !== null && opts[idx] ? opts[idx].label : 'CANCEL';
        if (lab === 'SUMMARY') UI.showSummary(mon);
        else if (lab === 'SWITCH') {
            G.state.party.splice(i, 1);
            G.state.party.unshift(mon);
            G.save(); UI.showParty();
        } else if (lab === 'SEND TO BOX') {
            G.state.party.splice(i, 1);
            G.state.box.push(mon);
            G.save(); UI.showParty();
        }
    }

    async function boxActions(mon, i) {
        const idx = await choose(M.displayName(mon) + ' Lv' + mon.level, [
            { label: 'ADD TO PARTY', disabled: G.state.party.length >= 6, sub: G.state.party.length >= 6 ? 'Party is full' : '' },
            { label: 'SUMMARY' },
            { label: 'RELEASE', sub: 'Goodbye forever!' },
        ]);
        if (idx === 0) {
            G.state.box.splice(i, 1);
            G.state.party.push(mon);
            G.save(); UI.showParty();
        } else if (idx === 1) UI.showSummary(mon);
        else if (idx === 2) {
            G.state.box.splice(i, 1);
            G.save(); UI.showParty();
        }
    }

    // ============================================================== SUMMARY ==
    // Emerald Pokémon summary: INFO / SKILLS / MOVES pages.
    let sumPage = 0;
    UI.showSummary = function (mon) {
        const s = screen();
        const sp = D.species[mon.dex];
        const st = M.stats(mon);
        const vf = variantFilter(mon);
        const wrap = el('div', 'em-sum');

        const head = el('div', 'sum-head');
        head.innerHTML =
            '<img class="sum-sprite" src="' + D.sprite(mon.slug, 'front') + '"' + (vf ? ' style="filter:' + vf + '"' : '') + '>' +
            '<div class="sum-id"><b>' + monLabel(mon) + '</b>' +
            (mon.gender ? ' <i class="g-' + mon.gender + '">' + (mon.gender === 'M' ? '♂' : '♀') + '</i>' : '') +
            '<br>Lv' + mon.level + ' ' + statusTag(mon) +
            '<br>' + sp.types.map(typeChip).join('') + '</div>';
        wrap.appendChild(head);

        const tabs = el('div', 'sum-tabs');
        const pages = ['INFO', 'SKILLS', 'MOVES'];
        const tabEls = pages.map((name, i) => {
            const t = el('div', 'sum-tab' + (i === sumPage ? ' active' : ''), name);
            t.onclick = () => { sumPage = i; UI.showSummary(mon); };
            tabs.appendChild(t);
            return t;
        });
        wrap.appendChild(tabs);

        const body = el('div', 'ew sum-body');
        if (sumPage === 0) {
            const cur = D.expForLevel(sp.growthRate, mon.level);
            const next = D.expForLevel(sp.growthRate, mon.level + 1);
            body.innerHTML =
                srow('POKéDEX No.', String(mon.dex)) +
                srow('NAME', esc(sp.name.toUpperCase())) +
                srow('TYPE', sp.types.map(typeChip).join('')) +
                srow('NATURE', esc(D.natures[mon.natureIdx].name)) +
                srow('EXP. POINTS', String(mon.exp)) +
                srow('NEXT LV.', mon.level >= 100 ? '—' : String(Math.max(0, next - mon.exp))) +
                (mon.variant !== 'normal' ? srow('VARIANT', esc(M.VARIANTS[mon.variant].label)) : '');
        } else if (sumPage === 1) {
            body.innerHTML =
                srow('HP', mon.hp + '/' + st.hp) +
                srow('ATTACK', String(st.atk)) +
                srow('DEFENSE', String(st.def)) +
                srow('SP. ATK', String(st.spa)) +
                srow('SP. DEF', String(st.spd)) +
                srow('SPEED', String(st.spe));
        } else {
            mon.moves.forEach(m => {
                const mm = D.moves[m.id];
                body.innerHTML += '<div class="sum-move">' + typeChip(mm.type) + ' <b>' + esc(mm.name.toUpperCase()) + '</b>' +
                    '<span>PP ' + m.pp + '/' + m.maxPp + '</span>' +
                    '<small>POWER ' + (mm.power || '—') + ' · ACC. ' + (mm.accuracy > 100 ? '—' : mm.accuracy) + '</small></div>';
            });
        }
        wrap.appendChild(body);
        s.appendChild(wrap);
        navSet(tabEls, { cols: 3, idx: sumPage, onBack: () => UI.showParty() });
    };
    function srow(k, v) { return '<div class="sum-row"><span>' + k + '</span><b>' + v + '</b></div>'; }

    // ================================================================== DEX ==
    // Emerald Pokédex: dark list — No. / name / caught ball. Entries open a
    // dex page with the sprite, types and base stats.
    UI.showDex = function () {
        UI.updateTopbar();
        const s = screen();
        const dc = G.dexCounts();
        const wrap = el('div', 'em-dex');
        wrap.appendChild(el('div', 'dx-head', 'POKéDEX <span>SEEN ' + dc.seen + ' · OWNED ' + dc.caught + '</span>'));
        const list = el('div', 'dx-list');
        const navRows = [];
        for (let dex = 1; dex <= D.MAX_DEX; dex++) {
            const sp = D.species[dex];
            if (!sp) continue;
            const seen = G.state.dex.seen[sp.slug];
            const caught = G.state.dex.caught[sp.slug];
            const row = el('div', 'dx-row' + (seen ? '' : ' unseen'));
            row.innerHTML = '<span class="dx-no">No.' + String(dex).padStart(3, '0') + '</span>' +
                (seen ? '<img loading="lazy" src="' + D.sprite(sp.slug, 'icons') + '"><b>' + esc(sp.name.toUpperCase()) + '</b>' : '<i class="dx-blank"></i><b>——————</b>') +
                (caught ? '<img class="dx-ball" src="src/assets/emerald_ui/ball_caught.png">' : '');
            if (seen) {
                row.onclick = () => showDexEntry(dex);
                navRows.push(row);
            }
            list.appendChild(row);
        }
        wrap.appendChild(list);
        const cancel = el('div', 'dx-row dx-cancel', 'CANCEL');
        cancel.onclick = () => UI.closeToWorld();
        wrap.appendChild(cancel);
        navRows.push(cancel);
        s.appendChild(wrap);
        navSet(navRows, { onBack: () => UI.closeToWorld() });
    };

    function showDexEntry(dex) {
        const sp = D.species[dex];
        const s = screen();
        const wrap = el('div', 'em-dex');
        const caught = G.state.dex.caught[sp.slug];
        const e = el('div', 'dx-entry');
        e.innerHTML =
            '<div class="dx-etop"><img src="' + D.sprite(sp.slug, 'front') + '">' +
            '<div><span class="dx-no">No.' + String(dex).padStart(3, '0') + '</span><br><b>' + esc(sp.name.toUpperCase()) + '</b>' +
            (caught ? ' <img class="dx-ball" src="src/assets/emerald_ui/ball_caught.png">' : '') +
            '<br>' + sp.types.map(typeChip).join('') + '</div></div>' +
            (sp.stats ? '<div class="dx-stats">' + ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(k =>
                '<span><em>' + k.toUpperCase() + '</em>' + sp.stats[k] + '</span>').join('') + '</div>' : '') +
            '<div class="dx-note">' + (caught ? 'This POKéMON has been caught.' : 'This POKéMON has been seen, but not yet caught.') + '</div>';
        wrap.appendChild(e);
        const back = el('div', 'dx-row dx-cancel', 'BACK');
        back.onclick = () => UI.showDex();
        wrap.appendChild(back);
        s.appendChild(wrap);
        navSet([back], { onBack: () => UI.showDex() });
    }

    // ================================================================== BAG ==
    // Emerald bag: pocket tabs, item list with cursor, description box.
    const POCKETS = [
        ['ITEMS', id => D.ITEMS[id].kind !== 'ball'],
        ['POKé BALLS', id => D.ITEMS[id].kind === 'ball'],
    ];
    let curPocket = 0;
    function itemDesc(id) {
        const it = D.ITEMS[id];
        if (it.kind === 'ball') return it.name === 'Master Ball' ?
            'The best BALL. It catches a wild POKéMON without fail.' :
            'A device for catching wild POKéMON. It is thrown like a ball.';
        if (it.kind === 'heal') return it.heal >= 9999 ?
            'Fully restores the HP of a POKéMON.' :
            'Restores the HP of a POKéMON by ' + it.heal + ' points.';
        if (it.kind === 'cure') return 'Heals all the status problems of one POKéMON.';
        if (it.kind === 'revive') return 'Revives a fainted POKéMON with half its maximum HP.';
        return '';
    }

    UI.showBag = function () {
        UI.updateTopbar();
        const s = screen();
        const wrap = el('div', 'em-bag');
        const tabs = el('div', 'bag-tabs');
        POCKETS.forEach(([name], i) => {
            const t = el('button', 'bag-tab' + (i === curPocket ? ' active' : ''), esc(name));
            t.onclick = () => { curPocket = i; UI.showBag(); };
            tabs.appendChild(t);
        });
        wrap.appendChild(tabs);
        const list = el('div', 'ew bag-list');
        const desc = el('div', 'bag-desc');
        const navRows = [];
        const ids = Object.keys(D.ITEMS).filter(id => (G.state.items[id] || 0) > 0 && POCKETS[curPocket][1](id));
        if (!ids.length) list.appendChild(el('div', 'bag-empty', 'There are no items.'));
        ids.forEach(id => {
            const it = D.ITEMS[id];
            const row = el('div', 'bag-row', '<span>' + esc(it.name.toUpperCase()) + '</span><b>×' + G.state.items[id] + '</b>');
            row.onmouseenter = () => { desc.textContent = itemDesc(id); };
            row.onclick = () => bagItemActions(id);
            navRows.push(row);
            list.appendChild(row);
        });
        const close = el('div', 'bag-row', '<span>CLOSE BAG</span>');
        close.onmouseenter = () => { desc.textContent = 'Return to the field.'; };
        close.onclick = () => UI.closeToWorld();
        navRows.push(close);
        list.appendChild(close);
        wrap.appendChild(list);
        desc.textContent = ids.length ? itemDesc(ids[0]) : 'There are no items.';
        wrap.appendChild(desc);
        s.appendChild(wrap);
        navSet(navRows, { onBack: () => UI.closeToWorld() });
    };

    async function bagItemActions(id) {
        const it = D.ITEMS[id];
        const idx = await choose(it.name.toUpperCase() + ' is selected.', [{ label: 'USE' }, { label: 'TOSS' }, { label: 'CANCEL' }], false);
        if (idx === 1) {
            const c = await choose('Throw away one ' + it.name.toUpperCase() + '?', [{ label: 'YES' }, { label: 'NO' }], false);
            if (c === 0) { G.useItem(id); G.save(); await alertModal('Threw away one ' + it.name.toUpperCase() + '.'); }
            UI.showBag();
            return;
        }
        if (idx !== 0) return;
        if (it.kind === 'ball') { await alertModal("OAK: This isn't the time to use that!"); return; }
        const targets = G.state.party.map((m, i) => ({ mon: m, i: i })).filter(x =>
            it.kind === 'revive' ? x.mon.hp <= 0 : true);
        if (!targets.length) { await alertModal("It won't have any effect."); return; }
        const t = await choose('Use on which POKéMON?', targets.map(x => ({
            label: M.displayName(x.mon) + ' Lv' + x.mon.level,
            sub: x.mon.hp + '/' + M.stats(x.mon).hp + ' HP' + (x.mon.status ? ' · ' + x.mon.status : ''),
            img: D.sprite(x.mon.slug, 'icons'),
        })));
        if (t === null) return;
        const mon = targets[t].mon;
        const max = M.stats(mon).hp;
        let msg = null, used = false;
        if (it.kind === 'heal') {
            if (mon.hp <= 0 || mon.hp >= max) msg = "It won't have any effect.";
            else { const before = mon.hp; mon.hp = Math.min(max, mon.hp + it.heal); used = true; msg = M.displayName(mon) + "'s HP was restored by " + (mon.hp - before) + ' points.'; }
        } else if (it.kind === 'cure') {
            if (!mon.status) msg = "It won't have any effect.";
            else { mon.status = null; used = true; msg = M.displayName(mon) + ' became healthy!'; }
        } else if (it.kind === 'revive') {
            mon.hp = Math.max(1, Math.floor(max / 2));
            used = true; msg = M.displayName(mon) + ' was revived!';
        }
        if (used) G.useItem(id);
        G.save();
        await alertModal(msg || 'Nothing happened.');
        UI.showBag();
    }

    // ================================================================= MART ==
    // Emerald shop: money window, wares with prices, description box.
    UI.showMart = function () {
        UI.updateTopbar();
        const s = screen();
        const wrap = el('div', 'em-mart');
        const top = el('div', 'mart-top');
        top.innerHTML = '<div class="ew mart-hello">May I help you?</div>' +
            '<div class="ew mart-money">MONEY<br><b>$' + G.state.money.toLocaleString() + '</b></div>';
        wrap.appendChild(top);
        const list = el('div', 'ew bag-list');
        const desc = el('div', 'bag-desc');
        const navRows = [];
        for (const id in D.ITEMS) {
            const it = D.ITEMS[id];
            const row = el('div', 'bag-row',
                '<span>' + esc(it.name.toUpperCase()) + '</span><b>$' + it.price.toLocaleString() + '</b>');
            row.onmouseenter = () => { desc.textContent = itemDesc(id) + ' (Owned: ' + (G.state.items[id] || 0) + ')'; };
            row.onclick = () => martBuy(id);
            navRows.push(row);
            list.appendChild(row);
        }
        const bye = el('div', 'bag-row', '<span>CANCEL</span>');
        bye.onmouseenter = () => { desc.textContent = 'Leave the shop.'; };
        bye.onclick = () => UI.closeToWorld();
        navRows.push(bye);
        list.appendChild(bye);
        wrap.appendChild(list);
        desc.textContent = 'May I help you?';
        wrap.appendChild(desc);
        s.appendChild(wrap);
        navSet(navRows, { onBack: () => UI.closeToWorld() });
    };

    async function martBuy(id) {
        const it = D.ITEMS[id];
        const opts = [
            { label: '×1 — $' + it.price.toLocaleString(), disabled: !G.canAfford(id, 1) },
            { label: '×10 — $' + (it.price * 10).toLocaleString(), disabled: !G.canAfford(id, 10) },
        ];
        const idx = await choose(it.name.toUpperCase() + '? Certainly. How many would you like?', opts, true);
        if (idx === null) return;
        const qty = idx === 0 ? 1 : 10;
        G.buy(id, qty);
        UI.updateTopbar();
        await alertModal('Here you are! Thank you!');
        UI.showMart();
    }

    // ================================================================= GYMS ==
    UI.showGyms = function () {
        UI.updateTopbar();
        const s = screen();
        s.appendChild(el('h2', '', 'GYM LEADERS & ELITE FOUR'));
        const list = el('div', 'gym-list');
        const navRows = [];
        D.GYMS.forEach((gym, idx) => {
            const beaten = !!G.state.gymsBeaten[gym.id];
            const unlocked = G.gymUnlocked(idx);
            const row = el('div', 'gym-row' + (beaten ? ' beaten' : '') + (unlocked ? '' : ' locked'));
            const teamHtml = gym.team.map(([slug, lv]) =>
                '<span class="gym-mon"><img src="' + D.sprite(slug, 'icons') + '"><i>' + lv + '</i></span>').join('');
            row.innerHTML = '<div class="gym-mid"><b>' + esc(gym.name) + '</b> <small>' + esc(gym.title) +
                (gym.type ? ' · ' + typeChip(gym.type) : '') + '</small>' +
                '<div class="gym-team">' + teamHtml + '</div>' +
                '<small>' + (gym.badge ? gym.badge + ' · ' : '') + '$' + gym.reward.toLocaleString() + (beaten ? ' · DEFEATED' : '') + '</small></div>';
            const b = el('button', 'sm-btn primary', beaten ? 'REMATCH' : 'BATTLE');
            b.disabled = !unlocked;
            if (!unlocked) b.textContent = 'LOCKED';
            b.onclick = () => UI.startGymBattle(gym);
            if (unlocked) navRows.push(b);
            row.appendChild(b);
            list.appendChild(row);
        });
        s.appendChild(list);
        navSet(navRows, { onBack: () => UI.closeToWorld() });
    };
})();
