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
        // Overworld mode: menu screens float over the walkable world, so give
        // every non-battle screen a way back to it.
        if (UI.worldMode && window.CraterOverworld && CraterOverworld.entered && !UI.battle) {
            const bar = el('div', 'world-back-bar');
            const btn = el('button', 'world-back-btn', 'CLOSE');
            btn.onclick = () => UI.closeToWorld();
            bar.appendChild(btn);
            s.appendChild(bar);
        }
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

    /** Overworld mode: START-button menu. */
    UI.showMenu = function () {
        choose('MENU', [
            { label: 'POKéMON', sub: 'Party & PC box' },
            { label: 'POKéDEX' },
            { label: 'POKéMART' },
            { label: 'GYMS & LEAGUE' },
            { label: 'HEAL TEAM', sub: 'Free — like a Pokémon Center' },
        ], true).then(idx => {
            if (idx === 0) UI.showParty();
            else if (idx === 1) UI.showDex();
            else if (idx === 2) UI.showMart();
            else if (idx === 3) UI.showGyms();
            else if (idx === 4) { G.healTeam(); G.save(); alertModal('Your team was fully healed!'); }
        });
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
            build(win, val => { overlay.remove(); resolve(val); });
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
                const c = el('button', 'modal-cancel', 'Cancel');
                c.onclick = () => done(null);
                win.appendChild(c);
            }
        });
    }
    function alertModal(text) {
        return modal((win, done) => {
            win.appendChild(el('div', 'modal-title', esc(text)));
            const ok = el('button', 'modal-opt', '<b>OK</b>');
            ok.onclick = () => done(true);
            win.appendChild(ok);
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
        await sleep(700);
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
                    await sleep(650);
                    break;
                case 'hp':
                    refreshBoxes();
                    await sleep(350);
                    break;
                case 'switch':
                    refreshSprites(); refreshBoxes();
                    await sleep(400);
                    break;
                case 'shake':
                    setLog('...' + '❋'.repeat(ev.n));
                    await sleep(500);
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
        setLog(M.displayName(mon) + ' gained ' + exp + ' EXP!');
        if (!bt.isTrainer) {
            const prize = G.wildPrize(foe);
            G.state.money += prize;
            UI.updateTopbar();
        }
        await sleep(600);
        const events = M.gainExp(mon, exp);
        for (const e of events) {
            if (e.type === 'level') {
                refreshBoxes();
                setLog(M.displayName(mon) + ' grew to level ' + e.level + '!');
                await sleep(650);
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
    UI.showParty = function () {
        UI.updateTopbar();
        const s = screen();
        const wrap = el('div', 'party-screen');
        wrap.appendChild(el('h2', '', 'Party (' + G.state.party.length + '/6)'));
        G.state.party.forEach((mon, i) => {
            wrap.appendChild(partyRow(mon, i, false));
        });
        wrap.appendChild(el('h2', '', 'PC Box (' + G.state.box.length + ')'));
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
    };

    function partyRow(mon, i) {
        const st = M.stats(mon);
        const pct = hpPct(mon);
        const row = el('div', 'party-row');
        const vf = variantFilter(mon);
        row.innerHTML = '<img src="' + D.sprite(mon.slug, 'icons') + '"' + (vf ? ' style="filter:' + vf + '"' : '') + '>' +
            '<div class="pr-mid"><b>' + monLabel(mon) + (mon.gender ? ' <i class="g-' + mon.gender + '">' + (mon.gender === 'M' ? '♂' : '♀') + '</i>' : '') + '</b> Lv' + mon.level + ' ' + statusTag(mon) +
            '<div class="hp-outer"><div class="hp-inner" style="width:' + pct + '%;background:' + hpColor(pct) + '"></div></div>' +
            '<small>' + mon.hp + '/' + st.hp + ' HP</small></div>';
        const btns = el('div', 'pr-btns');
        const info = el('button', 'sm-btn', 'INFO');
        info.onclick = () => monDetails(mon);
        btns.appendChild(info);
        if (i > 0) {
            const up = el('button', 'sm-btn', 'UP');
            up.title = 'Make leader';
            up.onclick = () => {
                G.state.party.splice(i, 1);
                G.state.party.unshift(mon);
                G.save(); UI.showParty();
            };
            btns.appendChild(up);
        }
        if (G.state.party.length > 1) {
            const box = el('button', 'sm-btn', 'BOX');
            box.title = 'Send to box';
            box.onclick = () => {
                G.state.party.splice(i, 1);
                G.state.box.push(mon);
                G.save(); UI.showParty();
            };
            btns.appendChild(box);
        }
        row.appendChild(btns);
        return row;
    }

    async function boxActions(mon, i) {
        const idx = await choose(M.displayName(mon) + ' Lv' + mon.level, [
            { label: 'Add to party', disabled: G.state.party.length >= 6, sub: G.state.party.length >= 6 ? 'Party is full' : '' },
            { label: 'Details' },
            { label: 'Release', sub: 'Goodbye forever!' },
        ]);
        if (idx === 0) {
            G.state.box.splice(i, 1);
            G.state.party.push(mon);
            G.save(); UI.showParty();
        } else if (idx === 1) monDetails(mon);
        else if (idx === 2) {
            G.state.box.splice(i, 1);
            G.save(); UI.showParty();
        }
    }

    function monDetails(mon) {
        const sp = D.species[mon.dex];
        const st = M.stats(mon);
        modal((win, done) => {
            const vf = variantFilter(mon);
            win.appendChild(el('div', 'detail-head',
                '<img src="' + D.sprite(mon.slug, 'front') + '"' + (vf ? ' style="filter:' + vf + '"' : '') + '>' +
                '<div><b>' + monLabel(mon) + '</b> Lv' + mon.level +
                (mon.gender ? ' <i class="g-' + mon.gender + '">' + (mon.gender === 'M' ? '♂' : '♀') + '</i>' : '') +
                '<br>' + sp.types.map(typeChip).join('') +
                '<br><small>Nature: ' + D.natures[mon.natureIdx].name + ' · #' + mon.dex + '</small></div>'));
            const stats = el('div', 'detail-stats');
            stats.innerHTML = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(k =>
                '<span><em>' + k.toUpperCase() + '</em>' + st[k] + '<small>iv ' + mon.ivs[k] + '</small></span>').join('');
            win.appendChild(stats);
            const mv = el('div', 'detail-moves');
            mon.moves.forEach(m => {
                const mm = D.moves[m.id];
                mv.innerHTML += '<div>' + typeChip(mm.type) + ' <b>' + esc(mm.name) + '</b> <span>' + (mm.power || '—') + ' pow · ' + (mm.accuracy > 100 ? '—' : mm.accuracy) + '% · ' + m.pp + '/' + m.maxPp + ' PP</span></div>';
            });
            win.appendChild(mv);
            const ok = el('button', 'modal-cancel', 'Close');
            ok.onclick = () => done(null);
            win.appendChild(ok);
        });
    }

    // ================================================================== DEX ==
    UI.showDex = function () {
        UI.updateTopbar();
        const s = screen();
        const dc = G.dexCounts();
        s.appendChild(el('h2', 'dex-head', 'Pokédex — seen ' + dc.seen + ' · caught ' + dc.caught + ' / ' + D.MAX_DEX));
        const grid = el('div', 'dex-grid');
        for (let dex = 1; dex <= D.MAX_DEX; dex++) {
            const sp = D.species[dex];
            if (!sp) continue;
            const seen = G.state.dex.seen[sp.slug];
            const caught = G.state.dex.caught[sp.slug];
            const cell = el('div', 'dex-cell' + (seen ? '' : ' unseen'));
            cell.innerHTML = '<img loading="lazy" src="' + D.sprite(sp.slug, 'icons') + '">' +
                '<span>#' + dex + (caught ? ' ◓' : '') + '</span>' +
                (seen ? '<b>' + esc(sp.name) + '</b>' : '<b>???</b>');
            grid.appendChild(cell);
        }
        s.appendChild(grid);
    };

    // ================================================================= MART ==
    UI.showMart = function () {
        UI.updateTopbar();
        const s = screen();
        s.appendChild(el('h2', '', 'POKéMART'));
        const list = el('div', 'mart-list');
        for (const id in D.ITEMS) {
            const it = D.ITEMS[id];
            const row = el('div', 'mart-row');
            row.innerHTML = '<div class="mr-mid"><b>' + it.icon + ' ' + esc(it.name) + '</b>' +
                '<small>₽' + it.price.toLocaleString() + ' · owned ×' + (G.state.items[id] || 0) + '</small></div>';
            const btns = el('div', 'pr-btns');
            [[1, 'Buy 1'], [10, 'Buy 10']].forEach(([q, label]) => {
                const b = el('button', 'sm-btn primary', label);
                b.disabled = !G.canAfford(id, q);
                b.onclick = () => { G.buy(id, q); UI.showMart(); };
                btns.appendChild(b);
            });
            row.appendChild(btns);
            list.appendChild(row);
        }
        s.appendChild(list);
    };

    // ================================================================= GYMS ==
    UI.showGyms = function () {
        UI.updateTopbar();
        const s = screen();
        s.appendChild(el('h2', '', 'GYM LEADERS & ELITE FOUR'));
        const list = el('div', 'gym-list');
        D.GYMS.forEach((gym, idx) => {
            const beaten = !!G.state.gymsBeaten[gym.id];
            const unlocked = G.gymUnlocked(idx);
            const row = el('div', 'gym-row' + (beaten ? ' beaten' : '') + (unlocked ? '' : ' locked'));
            const teamHtml = gym.team.map(([slug, lv]) =>
                '<span class="gym-mon"><img src="' + D.sprite(slug, 'icons') + '"><i>' + lv + '</i></span>').join('');
            row.innerHTML = '<div class="gym-mid"><b>' + esc(gym.name) + '</b> <small>' + esc(gym.title) +
                (gym.type ? ' · ' + typeChip(gym.type) : '') + '</small>' +
                '<div class="gym-team">' + teamHtml + '</div>' +
                '<small>' + (gym.badge ? '🏅 ' + gym.badge + ' · ' : '') + '₽' + gym.reward.toLocaleString() + (beaten ? ' · ✔ DEFEATED' : '') + '</small></div>';
            const b = el('button', 'sm-btn primary', beaten ? 'REMATCH' : 'BATTLE');
            b.disabled = !unlocked;
            if (!unlocked) b.textContent = 'LOCKED';
            b.onclick = () => UI.startGymBattle(gym);
            row.appendChild(b);
            list.appendChild(row);
        });
        s.appendChild(list);
    };
})();
