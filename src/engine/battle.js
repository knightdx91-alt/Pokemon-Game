// GameBattle — wild Pokemon battle system
// GBA-style turn-based battles rendered inside #screen-primary
window.GameBattle = (function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Legendary species — excluded from random encounters
    // -----------------------------------------------------------------------
    const LEGENDARIES = new Set([
        'articuno','zapdos','moltres','mewtwo','mew',
        'raikou','entei','suicune','lugia','ho_oh','celebi',
        'regirock','regice','registeel','latias','latios',
        'kyogre','groudon','rayquaza','jirachi','deoxys',
        'uxie','mesprit','azelf','dialga','palkia',
        'heatran','regigigas','giratina','cresselia',
        'phione','manaphy','darkrai','shaymin','arceus',
    ]);

    // -----------------------------------------------------------------------
    // Type effectiveness chart (Gen 4)
    // -----------------------------------------------------------------------
    const TYPE_CHART = {
        Normal:   { Rock:0.5, Ghost:0, Steel:0.5 },
        Fire:     { Fire:0.5, Water:0.5, Rock:0.5, Dragon:0.5, Grass:2, Ice:2, Bug:2, Steel:2 },
        Water:    { Water:0.5, Grass:0.5, Dragon:0.5, Fire:2, Ground:2, Rock:2 },
        Electric: { Electric:0.5, Grass:0.5, Dragon:0.5, Ground:0, Flying:2, Water:2 },
        Grass:    { Fire:0.5, Grass:0.5, Poison:0.5, Flying:0.5, Bug:0.5, Steel:0.5, Dragon:0.5, Water:2, Ground:2, Rock:2 },
        Ice:      { Water:0.5, Ice:0.5, Fire:0.5, Steel:0.5, Grass:2, Ground:2, Flying:2, Dragon:2 },
        Fighting: { Poison:0.5, Bug:0.5, Psychic:0.5, Flying:0.5, Ghost:0, Ice:2, Rock:2, Dark:2, Normal:2, Steel:2 },
        Poison:   { Poison:0.5, Ground:0.5, Rock:0.5, Ghost:0.5, Steel:0, Grass:2, Fairy:2 },
        Ground:   { Grass:0.5, Bug:0.5, Flying:0, Rock:2, Steel:2, Fire:2, Electric:2, Poison:2 },
        Flying:   { Electric:0.5, Rock:0.5, Steel:0.5, Grass:2, Fighting:2, Bug:2 },
        Psychic:  { Psychic:0.5, Steel:0.5, Dark:0, Fighting:2, Poison:2 },
        Bug:      { Fire:0.5, Fighting:0.5, Flying:0.5, Ghost:0.5, Steel:0.5, Fairy:0.5, Grass:2, Psychic:2, Dark:2 },
        Rock:     { Fighting:0.5, Ground:0.5, Steel:0.5, Fire:2, Flying:2, Bug:2, Ice:2 },
        Ghost:    { Dark:0.5, Normal:0, Ghost:2, Psychic:2 },
        Dragon:   { Steel:0.5, Dragon:2 },
        Dark:     { Fighting:0.5, Dark:0.5, Fairy:0.5, Ghost:2, Psychic:2 },
        Steel:    { Fire:0.5, Water:0.5, Electric:0.5, Steel:0.5, Rock:2, Ice:2, Fairy:2 },
        Fairy:    { Fire:0.5, Poison:0.5, Steel:0.5, Fighting:2, Dragon:2, Dark:2 },
    };

    // Nature modifiers { stat: multiplier }
    const NATURE_MODS = {
        hardy:{}, docile:{}, serious:{}, bashful:{}, quirky:{},
        lonely:{ atk:1.1, def:0.9 }, brave:{ atk:1.1, spe:0.9 },
        adamant:{ atk:1.1, spa:0.9 }, naughty:{ atk:1.1, spd:0.9 },
        bold:{ def:1.1, atk:0.9 }, relaxed:{ def:1.1, spe:0.9 },
        impish:{ def:1.1, spa:0.9 }, lax:{ def:1.1, spd:0.9 },
        timid:{ spe:1.1, atk:0.9 }, hasty:{ spe:1.1, def:0.9 },
        jolly:{ spe:1.1, spa:0.9 }, naive:{ spe:1.1, spd:0.9 },
        modest:{ spa:1.1, atk:0.9 }, mild:{ spa:1.1, def:0.9 },
        quiet:{ spa:1.1, spe:0.9 }, rash:{ spa:1.1, spd:0.9 },
        calm:{ spd:1.1, atk:0.9 }, gentle:{ spd:1.1, def:0.9 },
        sassy:{ spd:1.1, spe:0.9 }, careful:{ spd:1.1, spa:0.9 },
    };
    const NATURES = Object.keys(NATURE_MODS);

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let _active   = false;
    let _el       = null;   // battle overlay element inside #screen-primary
    let _enemy    = null;   // { species, name, level, types, stats, hp, maxHp, moves, statusCondition, isShiny, baseStats }
    let _player   = null;   // reference to save party slot
    let _playerStatCache = null;
    let _phase    = 'action'; // action | move_select | bag_select | anim | end
    let _onEnd    = null;
    let _movesDb  = null;
    let _pokedexDb = null;
    let _learnsetsDb = null;
    let _escaped  = false;
    let _escapeAttempts = 0;
    let _selectedAction = 0;
    let _selectedMove   = 0;
    let _selectedBag    = 0;
    let _messageQueue  = [];
    let _animBusy = false;
    let _bagItems = []; // [{label, count, useType}]

    // -----------------------------------------------------------------------
    // Data loading
    // -----------------------------------------------------------------------
    async function _ensureData() {
        if (!_movesDb) {
            try {
                const r = await fetch('data/pokemon/moves.json');
                _movesDb = r.ok ? await r.json() : {};
            } catch(e) { _movesDb = {}; }
        }
        if (!_pokedexDb) {
            try {
                const r = await fetch('data/pokemon/pokedex.json');
                _pokedexDb = r.ok ? await r.json() : {};
            } catch(e) { _pokedexDb = {}; }
        }
        if (!_learnsetsDb) {
            try {
                const r = await fetch('data/pokemon/learnsets.json');
                _learnsetsDb = r.ok ? await r.json() : {};
            } catch(e) { _learnsetsDb = {}; }
        }
    }

    // -----------------------------------------------------------------------
    // Stat calculation (Gen 4 formula)
    // -----------------------------------------------------------------------
    function calcHP(base, iv, ev, level) {
        return Math.floor(((2 * base + iv + Math.floor(ev/4)) * level) / 100) + level + 10;
    }
    function calcStat(base, iv, ev, level, natureMod) {
        return Math.floor((Math.floor(((2 * base + iv + Math.floor(ev/4)) * level) / 100) + 5) * (natureMod || 1));
    }
    function calcAllStats(speciesData, level, ivs, evs, nature) {
        const nm = NATURE_MODS[nature] || {};
        const b = speciesData.stats;
        return {
            hp:  calcHP(b.hp, ivs.hp, evs.hp, level),
            atk: calcStat(b.atk, ivs.atk, evs.atk, level, nm.atk || 1),
            def: calcStat(b.def, ivs.def, evs.def, level, nm.def || 1),
            spa: calcStat(b.spa, ivs.spa, evs.spa, level, nm.spa || 1),
            spd: calcStat(b.spd, ivs.spd, evs.spd, level, nm.spd || 1),
            spe: calcStat(b.spe, ivs.spe, evs.spe, level, nm.spe || 1),
        };
    }

    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randIVs() {
        return { hp:randInt(0,31), atk:randInt(0,31), def:randInt(0,31),
                 spa:randInt(0,31), spd:randInt(0,31), spe:randInt(0,31) };
    }

    // -----------------------------------------------------------------------
    // Generate a wild Pokemon from encounter entry
    // -----------------------------------------------------------------------
    function _generateWild(entry) {
        const level = (entry.level !== undefined) ? entry.level
                    : randInt(entry.min_level || 2, entry.max_level || 5);
        const rawName = entry.species.replace('SPECIES_', '').toLowerCase();
        if (!_pokedexDb[rawName]) return null;
        const dex = _pokedexDb[rawName];
        const ivs = randIVs();
        const evs = { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 };
        const nature = NATURES[randInt(0, NATURES.length-1)];
        const stats = calcAllStats(dex, level, ivs, evs, nature);
        const moves = _pickWildMoves(rawName, level);
        return {
            species: rawName,
            name: dex.name,
            level,
            types: dex.types,
            baseStats: dex.stats,
            ivs, evs, nature, stats,
            hp: stats.hp,
            maxHp: stats.hp,
            moves,
            statusCondition: null,
            isShiny: Math.random() < (1/8192),
            catchRate: dex.catch_rate || 45,
            baseExp: dex.base_exp || 50,
        };
    }

    function _pickWildMoves(speciesName, level) {
        const learnset = (_learnsetsDb && _learnsetsDb[speciesName]) || [];
        // Get all moves learnable up to this level
        const available = learnset.filter(([lv]) => lv <= level);
        // Take the last 4 (most recently learned)
        const selected = available.slice(-4).map(([, mv]) => mv);
        // Pad with Tackle/Struggle if needed
        while (selected.length < 1) selected.push('tackle');
        return selected.map(key => {
            const md = _movesDb[key] || { name: _formatMoveName(key), power:40, type:'Normal', accuracy:100, pp:35, category:'physical' };
            return { id: key, name: md.name || _formatMoveName(key), power: md.power||0, type: md.type||'Normal',
                     accuracy: md.accuracy||100, pp: md.pp||10, currentPP: md.pp||10, category: md.category||'physical' };
        });
    }

    function _formatMoveName(key) {
        return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // -----------------------------------------------------------------------
    // Random encounter from encounter data
    // -----------------------------------------------------------------------
    function rollEncounter(region) {
        const enc = GameMap.getEncounterData();
        if (!enc || !enc.land_mons) return null;
        const mons = enc.land_mons.mons || [];
        if (!mons.length) return null;
        // Weighted pick — standard 12-slot distribution
        const weights = [20,20,10,10,10,10,5,5,4,4,1,1];
        const pool = mons.map((m, i) => ({ ...m, w: weights[i] || 1 }));
        const total = pool.reduce((s, m) => s + m.w, 0);
        let r = Math.random() * total;
        for (const m of pool) {
            r -= m.w;
            if (r <= 0) {
                const key = m.species.replace('SPECIES_', '').toLowerCase();
                if (!LEGENDARIES.has(key) && _pokedexDb && _pokedexDb[key]) return m;
            }
        }
        return pool[0]; // fallback
    }

    // -----------------------------------------------------------------------
    // Damage calculation
    // -----------------------------------------------------------------------
    function calcDamage(attacker, atkStats, move, defender, defStats) {
        if (!move || move.power === 0) return 0;
        const isPhysical = move.category === 'physical';
        const atkStat = isPhysical ? atkStats.atk : atkStats.spa;
        const defStat = isPhysical ? defStats.def : defStats.spd;
        let dmg = Math.floor(((2 * attacker.level / 5 + 2) * move.power * atkStat / defStat) / 50) + 2;
        // STAB
        if (attacker.types && attacker.types.includes(move.type)) dmg = Math.floor(dmg * 1.5);
        // Type effectiveness
        const mult = _getTypeEffectiveness(move.type, defender.types || []);
        dmg = Math.floor(dmg * mult);
        // Random factor (85-100%)
        dmg = Math.floor(dmg * randInt(85, 100) / 100);
        return Math.max(1, dmg);
    }

    function _getTypeEffectiveness(moveType, defenderTypes) {
        let mult = 1;
        for (const dt of defenderTypes) {
            const row = TYPE_CHART[moveType] || {};
            if (row[dt] !== undefined) mult *= row[dt];
        }
        return mult;
    }

    // -----------------------------------------------------------------------
    // Catch calculation (simplified Gen 4 formula)
    // -----------------------------------------------------------------------
    function calcCatch(wildMon, ballBonus) {
        const a = Math.floor((wildMon.maxHp * 3 - wildMon.hp * 2) * wildMon.catchRate * ballBonus / (wildMon.maxHp * 3));
        const b = Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / a))))));
        let shakes = 0;
        for (let i = 0; i < 4; i++) {
            if (Math.random() * 65535 < b) shakes++;
            else break;
        }
        return shakes === 4;
    }

    // -----------------------------------------------------------------------
    // EXP gain
    // -----------------------------------------------------------------------
    function giveExp(mon, wildMon) {
        if (!mon || !wildMon) return false;
        const expGain = Math.floor((wildMon.baseExp * wildMon.level) / 7);
        mon.exp = (mon.exp || 0) + expGain;
        return expGain;
    }

    // -----------------------------------------------------------------------
    // Build bag item list from save state
    // -----------------------------------------------------------------------
    function _buildBagItems() {
        const items = [];
        const st = window.GameSave && GameSave.state;
        if (!st) return items;
        // Poké Balls
        const balls = [
            { key: 'poke_ball',   name: 'Poké Ball',   bonus: 1 },
            { key: 'great_ball',  name: 'Great Ball',  bonus: 1.5 },
            { key: 'ultra_ball',  name: 'Ultra Ball',  bonus: 2 },
            { key: 'master_ball', name: 'Master Ball', bonus: 255 },
        ];
        for (const b of balls) {
            const cnt = (st.inventory && st.inventory.pokeBalls && st.inventory.pokeBalls[b.key]) || 0;
            if (cnt > 0) items.push({ label: `${b.name} ×${cnt}`, useType: 'ball', ballBonus: b.bonus, key: b.key, count: cnt });
        }
        // Potions
        const potions = [
            { key: 'potion', name: 'Potion', heal: 20 },
            { key: 'super_potion', name: 'Super Potion', heal: 50 },
            { key: 'hyper_potion', name: 'Hyper Potion', heal: 200 },
            { key: 'max_potion', name: 'Max Potion', heal: 99999 },
        ];
        for (const p of potions) {
            const cnt = (st.inventory && st.inventory.items && st.inventory.items[p.key]) || 0;
            if (cnt > 0) items.push({ label: `${p.name} ×${cnt}`, useType: 'potion', heal: p.heal, key: p.key, count: cnt });
        }
        if (!items.length) items.push({ label: 'No usable items', useType: 'empty' });
        return items;
    }

    // -----------------------------------------------------------------------
    // Entry point
    // -----------------------------------------------------------------------
    async function start(entry, onEnd) {
        if (_active) return;
        await _ensureData();
        const wild = _generateWild(entry);
        if (!wild) { if (onEnd) onEnd('invalid'); return; }

        const st = window.GameSave && GameSave.state;
        if (!st || !st.party || !st.party[0]) { if (onEnd) onEnd('no_party'); return; }

        _active = true;
        _enemy = wild;
        _player = st.party[0];
        _playerStatCache = calcAllStats(
            _pokedexDb[_player.speciesId] || { stats: { hp:45,atk:49,def:49,spa:65,spd:65,spe:45 } },
            _player.level || 5,
            _player.ivs || randIVs(),
            _player.evs || { hp:0,atk:0,def:0,spa:0,spd:0,spe:0 },
            _player.nature || 'hardy'
        );
        _onEnd = onEnd || null;
        _phase = 'action';
        _escapeAttempts = 0;
        _escaped = false;
        _messageQueue = [];
        _animBusy = false;
        _selectedAction = 0;
        _selectedMove = 0;
        _selectedBag = 0;

        _buildUI();
        _showMessage(`A wild ${wild.name} appeared!`, () => _showActionMenu());
    }

    // -----------------------------------------------------------------------
    // UI building
    // -----------------------------------------------------------------------
    function _buildUI() {
        const screen = document.getElementById('screen-primary');
        if (!screen) return;

        _el = document.createElement('div');
        _el.id = 'battle-overlay';
        screen.appendChild(_el);

        _el.innerHTML = `
<div id="bt-field">
  <div id="bt-enemy-info">
    <div id="bt-enemy-name-row">
      <span id="bt-enemy-name">${_enemy.name}</span>
      <span id="bt-enemy-gender"></span>
    </div>
    <div class="bt-level-row">Lv <span id="bt-enemy-lv">${_enemy.level}</span></div>
    <div class="bt-hp-wrap"><div class="bt-hp-bar" id="bt-enemy-hp-bar"></div></div>
    <div id="bt-enemy-status"></div>
  </div>
  <div id="bt-enemy-sprite-wrap">
    <img id="bt-enemy-sprite" src="data/sprites/pokemon/front/${_enemy.species}.png"
         onerror="this.style.display='none'" alt="${_enemy.name}">
  </div>
  <div id="bt-player-sprite-wrap">
    <div id="bt-player-sprite-placeholder"></div>
  </div>
  <div id="bt-player-info">
    <div id="bt-player-name-row">
      <span id="bt-player-name">${_getPlayerName()}</span>
    </div>
    <div class="bt-level-row">Lv <span id="bt-player-lv">${_player.level || 1}</span></div>
    <div class="bt-hp-wrap"><div class="bt-hp-bar" id="bt-player-hp-bar"></div></div>
    <div class="bt-hp-text"><span id="bt-player-hp-cur">${_player.currentHp}</span> / <span id="bt-player-hp-max">${_playerStatCache.hp}</span></div>
    <div id="bt-player-status"></div>
  </div>
</div>
<div id="bt-bottom">
  <div id="bt-text-box"><div id="bt-text"></div></div>
  <div id="bt-action-box" style="display:none">
    <button class="bt-act" data-act="0">FIGHT</button>
    <button class="bt-act" data-act="1">BAG</button>
    <button class="bt-act" data-act="2">POKEMON</button>
    <button class="bt-act" data-act="3">RUN</button>
  </div>
  <div id="bt-move-box" style="display:none"></div>
  <div id="bt-bag-box" style="display:none"></div>
</div>`;

        _updateHP();

        // Wire action buttons
        _el.querySelectorAll('.bt-act').forEach(btn => {
            btn.addEventListener('click', () => _onActionSelect(parseInt(btn.dataset.act)));
        });

        // D-pad + A input
        document.addEventListener('keydown', _onKeyDown);
    }

    function _getPlayerName() {
        if (!_player || !_player.speciesId) return 'POKéMON';
        const dex = _pokedexDb && _pokedexDb[_player.speciesId];
        return _player.nickname || (dex && dex.name) || 'POKéMON';
    }

    function _updateHP() {
        const ePct = Math.max(0, _enemy.hp / _enemy.maxHp);
        const pPct = Math.max(0, (_player.currentHp || 0) / (_playerStatCache && _playerStatCache.hp || 1));

        const ebar = document.getElementById('bt-enemy-hp-bar');
        const pbar = document.getElementById('bt-player-hp-bar');
        if (ebar) { ebar.style.width = (ePct * 100) + '%'; ebar.className = 'bt-hp-bar ' + _hpColor(ePct); }
        if (pbar) { pbar.style.width = (pPct * 100) + '%'; pbar.className = 'bt-hp-bar ' + _hpColor(pPct); }

        const hpCur = document.getElementById('bt-player-hp-cur');
        const hpMax = document.getElementById('bt-player-hp-max');
        if (hpCur) hpCur.textContent = Math.max(0, _player.currentHp || 0);
        if (hpMax && _playerStatCache) hpMax.textContent = _playerStatCache.hp;
    }

    function _hpColor(pct) {
        if (pct > 0.5) return 'hp-green';
        if (pct > 0.2) return 'hp-yellow';
        return 'hp-red';
    }

    // -----------------------------------------------------------------------
    // Message system
    // -----------------------------------------------------------------------
    function _showMessage(text, callback) {
        _phase = 'anim';
        const textEl = document.getElementById('bt-text');
        const textBox = document.getElementById('bt-text-box');
        const actionBox = document.getElementById('bt-action-box');
        const moveBox = document.getElementById('bt-move-box');
        const bagBox = document.getElementById('bt-bag-box');
        if (textBox) textBox.style.display = 'block';
        if (actionBox) actionBox.style.display = 'none';
        if (moveBox) moveBox.style.display = 'none';
        if (bagBox) bagBox.style.display = 'none';
        if (!textEl) { if (callback) callback(); return; }

        // Typewriter
        textEl.textContent = '';
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                textEl.textContent += text[i++];
            } else {
                clearInterval(interval);
                // Wait for tap/A press
                textEl.dataset.waitCb = '1';
                textEl.dataset.cb = 'pending';
                _pendingCallback = callback;
            }
        }, 25);
    }

    let _pendingCallback = null;

    function _advanceMessage() {
        if (_pendingCallback) {
            const cb = _pendingCallback;
            _pendingCallback = null;
            cb();
        }
    }

    // -----------------------------------------------------------------------
    // Action menus
    // -----------------------------------------------------------------------
    function _showActionMenu() {
        _phase = 'action';
        const textBox = document.getElementById('bt-text-box');
        const actionBox = document.getElementById('bt-action-box');
        const moveBox = document.getElementById('bt-move-box');
        const bagBox = document.getElementById('bt-bag-box');
        if (textBox) textBox.style.display = 'none';
        if (actionBox) { actionBox.style.display = 'grid'; _highlightAction(0); }
        if (moveBox) moveBox.style.display = 'none';
        if (bagBox) bagBox.style.display = 'none';
    }

    function _highlightAction(idx) {
        _selectedAction = idx;
        _el.querySelectorAll('.bt-act').forEach((b, i) => b.classList.toggle('selected', i === idx));
    }

    function _onActionSelect(idx) {
        if (_phase !== 'action') return;
        switch (idx) {
            case 0: _showMoveSelect(); break;
            case 1: _showBagSelect(); break;
            case 2: _showMessage('You can\'t switch right now.', () => _showActionMenu()); break;
            case 3: _tryRun(); break;
        }
    }

    // -----------------------------------------------------------------------
    // Move selection
    // -----------------------------------------------------------------------
    function _showMoveSelect() {
        _phase = 'move_select';
        const textBox = document.getElementById('bt-text-box');
        const actionBox = document.getElementById('bt-action-box');
        const moveBox = document.getElementById('bt-move-box');
        if (textBox) textBox.style.display = 'none';
        if (actionBox) actionBox.style.display = 'none';
        if (!moveBox) return;
        moveBox.style.display = 'grid';
        moveBox.innerHTML = '';
        const moves = _player.moves || [];
        moves.forEach((mv, i) => {
            if (!mv) return;
            const md = _movesDb && _movesDb[mv] || { name: _formatMoveName(mv), type:'Normal', pp:10, currentPP:10 };
            const pp = mv.currentPP !== undefined ? mv.currentPP : (md.pp || 10);
            const btn = document.createElement('button');
            btn.className = 'bt-move-btn';
            btn.dataset.idx = i;
            btn.innerHTML = `<span class="bt-move-name">${md.name || _formatMoveName(mv)}</span><span class="bt-move-pp">${pp}/${md.pp||10}</span><span class="bt-move-type type-badge" data-type="${(md.type||'Normal').toLowerCase()}">${md.type||'Normal'}</span>`;
            btn.addEventListener('click', () => _useMove(i));
            moveBox.appendChild(btn);
        });
        if (!moves.filter(Boolean).length) {
            const btn = document.createElement('button');
            btn.className = 'bt-move-btn';
            btn.innerHTML = '<span class="bt-move-name">Struggle</span>';
            btn.addEventListener('click', () => _useStruggle());
            moveBox.appendChild(btn);
        }
        // Back button
        const back = document.createElement('button');
        back.className = 'bt-back-btn';
        back.textContent = '← Back';
        back.addEventListener('click', () => _showActionMenu());
        moveBox.appendChild(back);
        _selectedMove = 0;
        _highlightMove(0);
    }

    function _highlightMove(idx) {
        _selectedMove = idx;
        if (!_el) return;
        _el.querySelectorAll('.bt-move-btn').forEach((b, i) => b.classList.toggle('selected', i === idx));
    }

    // -----------------------------------------------------------------------
    // Bag selection
    // -----------------------------------------------------------------------
    function _showBagSelect() {
        _phase = 'bag_select';
        const textBox = document.getElementById('bt-text-box');
        const actionBox = document.getElementById('bt-action-box');
        const bagBox = document.getElementById('bt-bag-box');
        if (textBox) textBox.style.display = 'none';
        if (actionBox) actionBox.style.display = 'none';
        if (!bagBox) return;
        _bagItems = _buildBagItems();
        bagBox.style.display = 'grid';
        bagBox.innerHTML = '';
        _bagItems.forEach((item, i) => {
            const btn = document.createElement('button');
            btn.className = 'bt-bag-btn';
            btn.textContent = item.label;
            btn.addEventListener('click', () => _useBagItem(i));
            bagBox.appendChild(btn);
        });
        const back = document.createElement('button');
        back.className = 'bt-back-btn';
        back.textContent = '← Back';
        back.addEventListener('click', () => _showActionMenu());
        bagBox.appendChild(back);
        _selectedBag = 0;
        _highlightBag(0);
    }

    function _highlightBag(idx) {
        _selectedBag = idx;
        if (!_el) return;
        _el.querySelectorAll('.bt-bag-btn').forEach((b, i) => b.classList.toggle('selected', i === idx));
    }

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------
    function _useMove(moveIdx) {
        if (_phase !== 'move_select') return;
        const moves = _player.moves || [];
        const mv = moves[moveIdx];
        if (!mv) return;
        const md = _movesDb && _movesDb[mv] || { power:40, type:'Normal', accuracy:100, pp:10, category:'physical' };
        const moveObj = { id: mv, ...md };

        // Deduct PP
        if (_player.moves[moveIdx] && typeof _player.moves[moveIdx] === 'string') {
            // moves stored as string IDs — track PP separately? For now just proceed
        }

        _executeTurn(moveObj);
    }

    function _useStruggle() {
        _executeTurn({ id:'struggle', name:'Struggle', power:50, type:'Normal', accuracy:100, pp:99, category:'physical' });
    }

    function _useBagItem(idx) {
        if (_phase !== 'bag_select') return;
        const item = _bagItems[idx];
        if (!item || item.useType === 'empty') {
            _showMessage('No usable items!', () => _showActionMenu());
            return;
        }
        if (item.useType === 'ball') {
            _throwBall(item);
        } else if (item.useType === 'potion') {
            _usePotion(item);
        }
    }

    function _throwBall(item) {
        const st = GameSave.state;
        // Deduct ball
        if (st.inventory && st.inventory.pokeBalls) {
            st.inventory.pokeBalls[item.key] = Math.max(0, (st.inventory.pokeBalls[item.key] || 0) - 1);
        }
        GameSave.markDirty();

        const caught = (item.ballBonus >= 255) || calcCatch(_enemy, item.ballBonus);
        if (caught) {
            _showMessage(`${_enemy.name} was caught!`, () => {
                _catchPokemon();
                _endBattle('caught');
            });
        } else {
            _showMessage(`${_enemy.name} broke free!`, () => {
                // Enemy attacks back
                _enemyTurn(() => _showActionMenu());
            });
        }
    }

    function _usePotion(item) {
        const st = GameSave.state;
        if (st.inventory && st.inventory.items) {
            st.inventory.items[item.key] = Math.max(0, (st.inventory.items[item.key] || 0) - 1);
        }
        const maxHp = _playerStatCache ? _playerStatCache.hp : 100;
        const healed = Math.min(item.heal, maxHp - (_player.currentHp || 0));
        _player.currentHp = Math.min(maxHp, (_player.currentHp || 0) + item.heal);
        GameSave.markDirty();
        _updateHP();
        _showMessage(`${_getPlayerName()} recovered ${healed} HP!`, () => {
            _enemyTurn(() => _showActionMenu());
        });
    }

    function _catchPokemon() {
        const st = GameSave.state;
        if (!st || !st.party) return;
        const slot = st.party.indexOf(null);
        if (slot === -1 && st.party.length >= 6) return; // party full — TODO: send to PC
        const mon = {
            speciesId: _enemy.species,
            nickname: '',
            level: _enemy.level,
            moves: _enemy.moves.map(m => m.id),
            currentHp: _enemy.hp,
            maxHp: _enemy.maxHp,
            evs: _enemy.evs,
            ivs: _enemy.ivs,
            nature: _enemy.nature,
            ability: 0,
            heldItem: null,
            statusCondition: null,
            friendship: 70,
            isShiny: _enemy.isShiny,
            originalTrainer: 'Player',
            caughtMapName: GameMap.current && GameMap.current.name || '',
            caughtLevel: _enemy.level,
            exp: 0,
        };
        if (slot !== -1) {
            st.party[slot] = mon;
        } else {
            st.party.push(mon);
        }
        GameSave.markDirty();
    }

    function _tryRun() {
        _escapeAttempts++;
        const playerSpe = (_playerStatCache && _playerStatCache.spe) || 50;
        const enemySpe = (_enemy.stats && _enemy.stats.spe) || 50;
        const escapeVal = Math.floor((playerSpe * 128 / enemySpe) + 30 * _escapeAttempts) % 256;
        if (Math.random() * 256 < escapeVal || playerSpe > enemySpe) {
            _showMessage('Got away safely!', () => _endBattle('fled'));
        } else {
            _showMessage('Can\'t escape!', () => {
                _enemyTurn(() => _showActionMenu());
            });
        }
    }

    // -----------------------------------------------------------------------
    // Turn execution
    // -----------------------------------------------------------------------
    function _executeTurn(playerMove) {
        _phase = 'anim';

        const playerSpe = (_playerStatCache && _playerStatCache.spe) || 50;
        const enemySpe = (_enemy.stats && _enemy.stats.spe) || 50;
        const playerFirst = playerSpe >= enemySpe;

        if (playerFirst) {
            _doPlayerMove(playerMove, () => {
                if (_enemy.hp <= 0) { _onEnemyFaint(); return; }
                _enemyTurn(() => {
                    if (_player.currentHp <= 0) { _onPlayerFaint(); return; }
                    _showActionMenu();
                });
            });
        } else {
            _enemyTurn(() => {
                if (_player.currentHp <= 0) { _onPlayerFaint(); return; }
                _doPlayerMove(playerMove, () => {
                    if (_enemy.hp <= 0) { _onEnemyFaint(); return; }
                    _showActionMenu();
                });
            });
        }
    }

    function _doPlayerMove(move, cb) {
        const playerMon = { level: _player.level || 5, types: _pokedexDb && _pokedexDb[_player.speciesId] ? _pokedexDb[_player.speciesId].types : ['Normal'] };
        if (move.accuracy < 100 && Math.random() * 100 > move.accuracy) {
            _showMessage(`${_getPlayerName()}'s attack missed!`, cb);
            return;
        }
        if (move.power > 0) {
            const dmg = calcDamage(
                { level: _player.level || 5, types: playerMon.types },
                _playerStatCache || { atk:50, spa:50 },
                move,
                _enemy,
                _enemy.stats
            );
            _enemy.hp = Math.max(0, _enemy.hp - dmg);
            _updateHP();
            const eff = _getTypeEffectiveness(move.type, _enemy.types);
            const effMsg = eff >= 2 ? " It's super effective!" : eff <= 0.5 && eff > 0 ? " It's not very effective..." : eff === 0 ? " It had no effect!" : '';
            _showMessage(`${_getPlayerName()} used ${move.name}!${effMsg}`, cb);
        } else {
            _showMessage(`${_getPlayerName()} used ${move.name}!`, cb);
        }
    }

    function _enemyTurn(cb) {
        if (!_enemy.moves || !_enemy.moves.length) { cb(); return; }
        const move = _enemy.moves[randInt(0, _enemy.moves.length - 1)];
        if (!move || !move.power) { _showMessage(`${_enemy.name} used ${move ? move.name : 'an attack'}!`, cb); return; }
        if (move.accuracy < 100 && Math.random() * 100 > move.accuracy) {
            _showMessage(`${_enemy.name}'s attack missed!`, cb);
            return;
        }
        const dmg = calcDamage(
            _enemy, _enemy.stats, move,
            { types: _pokedexDb && _pokedexDb[_player.speciesId] ? _pokedexDb[_player.speciesId].types : ['Normal'] },
            _playerStatCache || { def:50, spd:50 }
        );
        _player.currentHp = Math.max(0, (_player.currentHp || 0) - dmg);
        _updateHP();
        _showMessage(`${_enemy.name} used ${move.name}!`, cb);
    }

    function _onEnemyFaint() {
        const expGain = giveExp(_player, _enemy);
        _showMessage(`${_enemy.name} fainted!`, () => {
            if (expGain) {
                _showMessage(`${_getPlayerName()} gained ${expGain} EXP. Points!`, () => _endBattle('won'));
            } else {
                _endBattle('won');
            }
        });
    }

    function _onPlayerFaint() {
        _showMessage(`${_getPlayerName()} fainted!`, () => _endBattle('lost'));
    }

    // -----------------------------------------------------------------------
    // Keyboard navigation
    // -----------------------------------------------------------------------
    function _onKeyDown(e) {
        if (!_active) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
            e.preventDefault();
            if (_pendingCallback) { _advanceMessage(); return; }
        }
        if (_phase === 'action') {
            const dirs = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-2, ArrowDown:2 };
            if (dirs[e.key] !== undefined) {
                _highlightAction(Math.max(0, Math.min(3, _selectedAction + dirs[e.key])));
            }
            if (e.key === 'Enter' || e.key === 'z') _onActionSelect(_selectedAction);
        } else if (_phase === 'move_select') {
            const moveBtns = _el ? _el.querySelectorAll('.bt-move-btn') : [];
            if (e.key === 'ArrowUp') _highlightMove(Math.max(0, _selectedMove - 1));
            if (e.key === 'ArrowDown') _highlightMove(Math.min(moveBtns.length - 1, _selectedMove + 1));
            if (e.key === 'Enter' || e.key === 'z') _useMove(_selectedMove);
            if (e.key === 'Escape' || e.key === 'x') _showActionMenu();
        } else if (_phase === 'bag_select') {
            const bagBtns = _el ? _el.querySelectorAll('.bt-bag-btn') : [];
            if (e.key === 'ArrowUp') _highlightBag(Math.max(0, _selectedBag - 1));
            if (e.key === 'ArrowDown') _highlightBag(Math.min(bagBtns.length - 1, _selectedBag + 1));
            if (e.key === 'Enter' || e.key === 'z') _useBagItem(_selectedBag);
            if (e.key === 'Escape' || e.key === 'x') _showActionMenu();
        }
    }

    // Handle justPressed from game loop (touch/mobile)
    function handleInput(jp) {
        if (!_active) return;
        if (jp.a) {
            if (_pendingCallback) { _advanceMessage(); return; }
            if (_phase === 'action') _onActionSelect(_selectedAction);
            if (_phase === 'move_select') _useMove(_selectedMove);
            if (_phase === 'bag_select') _useBagItem(_selectedBag);
        }
        if (jp.b) {
            if (_phase === 'move_select' || _phase === 'bag_select') _showActionMenu();
        }
        if (_phase === 'action') {
            if (jp.up) _highlightAction(Math.max(0, _selectedAction - 2));
            if (jp.down) _highlightAction(Math.min(3, _selectedAction + 2));
            if (jp.left) _highlightAction(_selectedAction % 2 === 1 ? _selectedAction - 1 : _selectedAction);
            if (jp.right) _highlightAction(_selectedAction % 2 === 0 ? _selectedAction + 1 : _selectedAction);
        }
        if (_phase === 'move_select') {
            const moveBtns = _el ? _el.querySelectorAll('.bt-move-btn') : [];
            if (jp.up)   _highlightMove(Math.max(0, _selectedMove - 1));
            if (jp.down) _highlightMove(Math.min(moveBtns.length - 1, _selectedMove + 1));
        }
        if (_phase === 'bag_select') {
            const bagBtns = _el ? _el.querySelectorAll('.bt-bag-btn') : [];
            if (jp.up)   _highlightBag(Math.max(0, _selectedBag - 1));
            if (jp.down) _highlightBag(Math.min(bagBtns.length - 1, _selectedBag + 1));
        }
    }

    // -----------------------------------------------------------------------
    // End battle
    // -----------------------------------------------------------------------
    function _endBattle(result) {
        _active = false;
        document.removeEventListener('keydown', _onKeyDown);
        if (_el && _el.parentNode) _el.parentNode.removeChild(_el);
        _el = null;
        GameSave.markDirty();
        if (_onEnd) _onEnd(result);
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    function isActive() { return _active; }

    // Called by main.js to check if battle intercepts input
    function consumeInput(jp) {
        if (!_active) return false;
        handleInput(jp);
        return true;
    }

    return { start, isActive, consumeInput, LEGENDARIES, rollEncounter };
})();
