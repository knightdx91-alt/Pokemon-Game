// GameSummary — Pokémon summary screen
// Three tabs: INFO | SKILLS | MOVES
// Open with GameSummary.show(partyIndex, onClose)
window.GameSummary = (function () {
    'use strict';

    const TYPE_COLORS = {
        normal:'#A8A878',fire:'#F08030',water:'#6890F0',electric:'#F8D030',
        grass:'#78C850',ice:'#98D8D8',fighting:'#C03028',poison:'#A040A0',
        ground:'#E0C068',flying:'#A890F0',psychic:'#F85888',bug:'#A8B820',
        rock:'#B8A038',ghost:'#705898',dragon:'#7038F8',dark:'#705848',
        steel:'#B8B8D0',fairy:'#EE99AC',
    };

    const NATURES_DISPLAY = {
        hardy:'Hardy',docile:'Docile',serious:'Serious',bashful:'Bashful',quirky:'Quirky',
        lonely:'Lonely',brave:'Brave',adamant:'Adamant',naughty:'Naughty',
        bold:'Bold',relaxed:'Relaxed',impish:'Impish',lax:'Lax',
        timid:'Timid',hasty:'Hasty',jolly:'Jolly',naive:'Naive',
        modest:'Modest',mild:'Mild',quiet:'Quiet',rash:'Rash',
        calm:'Calm',gentle:'Gentle',sassy:'Sassy',careful:'Careful',
    };

    const STAT_NAMES = { hp:'HP', atk:'Attack', def:'Defense', spa:'Sp.Atk', spd:'Sp.Def', spe:'Speed' };
    const STAT_ORDER = ['hp','atk','def','spa','spd','spe'];

    let _el = null;
    let _tab = 'info';
    let _partyIdx = 0;
    let _onClose = null;
    let _dexDb = null;
    let _movesDb = null;

    async function _ensureData() {
        if (!_dexDb) {
            try { const r = await fetch('data/pokemon/pokedex.json'); _dexDb = r.ok ? await r.json() : {}; } catch(e) { _dexDb = {}; }
        }
        if (!_movesDb) {
            try { const r = await fetch('data/pokemon/moves.json'); _movesDb = r.ok ? await r.json() : {}; } catch(e) { _movesDb = {}; }
        }
    }

    async function show(partyIdx, onClose) {
        if (_el) close();
        await _ensureData();
        _partyIdx = partyIdx || 0;
        _onClose = onClose || null;
        _tab = 'info';
        _build();
    }

    function close() {
        if (_el && _el.parentNode) _el.parentNode.removeChild(_el);
        _el = null;
        if (_onClose) { const cb = _onClose; _onClose = null; cb(); }
    }

    function isOpen() { return !!_el; }

    function _getMon() {
        const st = window.GameSave && GameSave.state;
        return st && st.party && st.party[_partyIdx] || null;
    }

    function _getDex(mon) {
        if (!mon || !mon.speciesId) return null;
        return _dexDb && _dexDb[mon.speciesId] || null;
    }

    // Gen 4 stat calculation
    function _calcHP(base, iv, ev, level) {
        return Math.floor(((2*base + iv + Math.floor(ev/4)) * level) / 100) + level + 10;
    }
    function _calcStat(base, iv, ev, level, nm) {
        return Math.floor((Math.floor(((2*base + iv + Math.floor(ev/4)) * level) / 100) + 5) * (nm || 1));
    }

    const NATURE_MODS = {
        hardy:{},docile:{},serious:{},bashful:{},quirky:{},
        lonely:{atk:1.1,def:0.9},brave:{atk:1.1,spe:0.9},adamant:{atk:1.1,spa:0.9},naughty:{atk:1.1,spd:0.9},
        bold:{def:1.1,atk:0.9},relaxed:{def:1.1,spe:0.9},impish:{def:1.1,spa:0.9},lax:{def:1.1,spd:0.9},
        timid:{spe:1.1,atk:0.9},hasty:{spe:1.1,def:0.9},jolly:{spe:1.1,spa:0.9},naive:{spe:1.1,spd:0.9},
        modest:{spa:1.1,atk:0.9},mild:{spa:1.1,def:0.9},quiet:{spa:1.1,spe:0.9},rash:{spa:1.1,spd:0.9},
        calm:{spd:1.1,atk:0.9},gentle:{spd:1.1,def:0.9},sassy:{spd:1.1,spe:0.9},careful:{spd:1.1,spa:0.9},
    };

    function _calcStats(mon, dex) {
        if (!dex) return null;
        const nm = NATURE_MODS[mon.nature || 'hardy'] || {};
        const ivs = mon.ivs || {hp:15,atk:15,def:15,spa:15,spd:15,spe:15};
        const evs = mon.evs || {hp:0,atk:0,def:0,spa:0,spd:0,spe:0};
        const lv = mon.level || 5;
        const b = dex.stats;
        return {
            hp:  _calcHP(b.hp, ivs.hp, evs.hp, lv),
            atk: _calcStat(b.atk, ivs.atk, evs.atk, lv, nm.atk||1),
            def: _calcStat(b.def, ivs.def, evs.def, lv, nm.def||1),
            spa: _calcStat(b.spa, ivs.spa, evs.spa, lv, nm.spa||1),
            spd: _calcStat(b.spd, ivs.spd, evs.spd, lv, nm.spd||1),
            spe: _calcStat(b.spe, ivs.spe, evs.spe, lv, nm.spe||1),
        };
    }

    function _formatName(key) {
        return key ? key.split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ') : '';
    }

    // ------------------------------------------------------------------
    // Canvas summary screen — rendered with the shared GBA bitmap font so
    // it matches the battle/party screens. Native logical space 240x208
    // (the game screen aspect), supersampled x2.
    // ------------------------------------------------------------------
    const S = 2, VW = 240, VH = 208;
    let _canvas = null, _ctx = null;
    const _spriteCache = {};

    // Palette (FireRed dark-window theme).
    const C_BG = '#f0f0e0', C_HDR = '#3c6cb0', C_HDR2 = '#2a4c88',
          C_BORDER = '#404850', C_TXT = '#303038', C_TXT_SH = '#c8c8b8',
          C_WHITE = '#f8f8f8', C_WHITE_SH = '#405060', C_DIM = '#707078',
          C_PANEL = '#f8f8f0';

    function _R(x, y, w, h, fill) { _ctx.fillStyle = fill; _ctx.fillRect(x * S, y * S, w * S, h * S); }
    function _T(str, x, y, opts) {
        opts = opts || {};
        GameFont.draw(_ctx, String(str), x, y, {
            scale: S, kind: opts.kind || 'normal',
            color: opts.color || C_TXT, shadow: opts.shadow,
            align: opts.align,
        });
    }
    // Panel with 1px border.
    function _panel(x, y, w, h, fill) {
        _R(x, y, w, h, C_BORDER);
        _R(x + 1, y + 1, w - 2, h - 2, fill || C_PANEL);
    }
    function _typeBadge(type, x, y) {
        const col = TYPE_COLORS[(type || 'normal').toLowerCase()] || '#A8A878';
        const label = (type || 'NORMAL').toUpperCase();
        const w = GameFont.measure(label, 'small') + 8;
        _R(x, y, w, 11, '#00000030');
        _R(x, y, w, 10, col);
        _T(label, x + 4, y + 1, { kind: 'small', color: '#ffffff' });
        return w;
    }
    function _bar(x, y, w, pct, col) {
        _R(x, y, w, 4, '#00000040');
        _R(x, y, w, 3, '#586878');
        const fw = Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, pct))));
        _R(x + 1, y + 1, fw, 1, col);
    }
    function _hpCol(pct) { return pct > 0.5 ? '#58d048' : pct > 0.2 ? '#f8c000' : '#f83030'; }

    function _getSprite(mon, cb) {
        const url = `data/sprites/pokemon/front/${mon.speciesId}.png`;
        if (_spriteCache[url] !== undefined) { cb(_spriteCache[url]); return; }
        const img = new Image();
        img.onload = () => { _spriteCache[url] = _stripSprite(img); cb(_spriteCache[url]); };
        img.onerror = () => { _spriteCache[url] = null; cb(null); };
        img.src = url;
    }
    // Strip the top-left palette colour to transparent.
    function _stripSprite(img) {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(img, 0, 0);
        try {
            const d = x.getImageData(0, 0, c.width, c.height);
            const tr = d.data[0], tg = d.data[1], tb = d.data[2];
            if (d.data[3] > 0) {
                for (let i = 0; i < d.data.length; i += 4) {
                    if (d.data[i] === tr && d.data[i+1] === tg && d.data[i+2] === tb) d.data[i+3] = 0;
                }
                x.putImageData(d, 0, 0);
            }
        } catch (e) {}
        return c;
    }

    function _build() {
        const screen = document.getElementById('screen-primary');
        if (!screen) return;

        _el = document.createElement('div');
        _el.id = 'summary-overlay';
        _el.style.cssText = 'position:absolute;inset:0;z-index:90;background:#101018;';
        screen.appendChild(_el);

        _canvas = document.createElement('canvas');
        _canvas.width = VW * S; _canvas.height = VH * S;
        _canvas.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;';
        _el.appendChild(_canvas);
        _ctx = _canvas.getContext('2d');
        _ctx.imageSmoothingEnabled = false;

        // Tap zones: left third = prev tab, right third = next tab, but the
        // bottom-right corner closes. Keeps parity with the gamepad.
        _canvas.addEventListener('click', function (e) {
            const r = _canvas.getBoundingClientRect();
            const fx = (e.clientX - r.left) / r.width;   // 0..1
            const fy = (e.clientY - r.top) / r.height;
            if (fy < 0.14 && fx > 0.85) { close(); return; }
            if (fx < 0.5) _switchTab(-1); else _switchTab(1);
        });

        GameFont.load(function () { _render(); });
        document.addEventListener('keydown', _onKey);
    }

    function _render() {
        if (!_el || !_ctx) return;
        const mon = _getMon();
        if (!mon) { close(); return; }
        const dex = _getDex(mon);
        const stats = _calcStats(mon, dex);
        const name = mon.nickname || (dex && dex.name) || 'POKéMON';

        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
        _R(0, 0, VW, VH, C_BG);

        // Header strip.
        _R(0, 0, VW, 22, C_HDR2);
        _R(0, 0, VW, 21, C_HDR);
        const pageTitle = _tab === 'info' ? 'POKéMON INFO'
            : _tab === 'skills' ? 'POKéMON SKILLS' : 'POKéMON MOVES';
        _T(pageTitle, 6, 3, { color: C_WHITE, shadow: '#1a3050' });
        _T(name, VW - 6, 3, { color: C_WHITE, shadow: '#1a3050', align: 'right' });

        // Tab indicator row.
        const tabs = [['info', 'INFO'], ['skills', 'SKILLS'], ['moves', 'MOVES']];
        let tx = 6;
        _T('◀', 0, 25, { kind: 'small', color: C_DIM });
        tabs.forEach(([id, lbl]) => {
            const active = _tab === id;
            if (active) { const w = GameFont.measure(lbl) + 6; _R(tx - 2, 24, w, 12, C_HDR); }
            _T(lbl, tx, 25, { color: active ? C_WHITE : C_DIM });
            tx += GameFont.measure(lbl) + 14;
        });
        _T('▶', VW - 8, 25, { kind: 'small', color: C_DIM });
        _R(0, 38, VW, 1, C_BORDER);

        if (_tab === 'info') _renderInfo(mon, dex, stats, name);
        else if (_tab === 'skills') _renderSkills(mon, dex, stats);
        else _renderMoves(mon);
    }

    function _renderInfo(mon, dex, stats, name) {
        // Sprite panel (left).
        _panel(8, 44, 84, 72, C_PANEL);
        _getSprite(mon, function (spr) {
            if (!_ctx) return;
            if (spr) {
                const dw = 64, dh = 64;
                _ctx.drawImage(spr, 18 * S, 46 * S, dw * S, dh * S);
            }
        });
        // Name + Lv + types under sprite.
        _T(name, 50, 120, { color: C_TXT, shadow: C_TXT_SH, align: 'center' });
        _T('Lv' + (mon.level || 1), 50, 133, { color: C_TXT, align: 'center' });
        if (dex && dex.types) {
            const tw = (dex.types || []).reduce((a, t) => a + GameFont.measure(t.toUpperCase(), 'small') + 12, 0);
            let bx = Math.max(10, 50 - tw / 2);
            (dex.types || []).forEach(t => { bx += _typeBadge(t, bx, 148) + 4; });
        }

        // Info rows (right) — one line each: label (left) + value (right).
        const rows = [
            ['Dex No.', dex ? String(dex.num).padStart(3, '0') : '???'],
            ['Species', dex ? (dex.category || '—') : '—'],
            ['Nature',  NATURES_DISPLAY[mon.nature || 'hardy'] || 'Hardy'],
            ['OT',      mon.originalTrainer || 'Player'],
            ['ID No.',  mon.otId || '00000'],
        ];
        const rx = 104;
        _panel(rx, 44, VW - rx - 8, 72, C_PANEL);
        rows.forEach((r, i) => {
            const y = 50 + i * 13;
            _T(r[0], rx + 6, y, { kind: 'small', color: C_DIM });
            _T(r[1], VW - 14, y, { kind: 'small', color: C_TXT, align: 'right' });
        });

        // HP bar in the right column, below the info panel.
        const maxHp = stats ? stats.hp : (mon.maxHp || 1);
        const cur = mon.currentHp != null ? mon.currentHp : maxHp;
        const pct = cur / maxHp;
        _T('HP', rx, 124, { kind: 'small', color: '#d84040' });
        _bar(rx + 16, 126, 60, pct, _hpCol(pct));
        _T(cur + '/' + maxHp, VW - 8, 138, { kind: 'small', color: C_TXT, align: 'right' });

        // Dex entry (wrapped).
        if (dex && dex.entry) {
            _panel(8, 158, VW - 16, VH - 158 - 6, C_PANEL);
            _wrapDraw(dex.entry, 14, 164, VW - 28, 12, C_TXT, 3);
        }
    }

    function _renderSkills(mon, dex, stats) {
        const b = dex ? dex.stats : {};
        const nm = NATURE_MODS[mon.nature || 'hardy'] || {};
        // Sprite (small, top-left).
        _getSprite(mon, function (spr) {
            if (_ctx && spr) _ctx.drawImage(spr, 12 * S, 44 * S, 48 * S, 48 * S);
        });
        _panel(72, 44, VW - 72 - 8, 118, C_PANEL);
        _T('STATS', 78, 47, { kind: 'small', color: C_DIM });
        STAT_ORDER.forEach((stat, i) => {
            const y = 58 + i * 16;
            const val = stats ? stats[stat] : 0;
            const up = nm[stat] > 1, dn = nm[stat] < 1;
            const col = up ? '#d05028' : dn ? '#3868c0' : C_TXT;
            _T(STAT_NAMES[stat], 78, y, { kind: 'small', color: col });
            _T(String(val), 150, y - 1, { color: C_TXT, align: 'right' });
            _bar(156, y + 1, VW - 156 - 14, Math.min(1, val / 400), '#58c058');
        });
        const total = stats ? STAT_ORDER.reduce((a, s) => a + stats[s], 0) : 0;
        _panel(8, 168, VW - 16, VH - 168 - 6, C_PANEL);
        _T('Total  ' + total, 14, 174, { color: C_TXT, shadow: C_TXT_SH });
        _T('Nature: ' + (NATURES_DISPLAY[mon.nature || 'hardy'] || 'Hardy'), 120, 174, { kind: 'small', color: C_DIM });
    }

    function _renderMoves(mon) {
        const moves = (mon.moves || []).filter(Boolean);
        _panel(8, 44, VW - 16, VH - 44 - 6, C_PANEL);
        if (!moves.length) { _T('No moves learned', 16, 60, { color: C_DIM }); return; }
        moves.forEach((mv, i) => {
            const md = (_movesDb && _movesDb[mv]) || null;
            const nm = md ? md.name : _formatName(mv);
            const ty = md ? md.type : 'Normal';
            const pp = md ? md.pp : 10;
            const pow = md ? (md.power || '—') : '—';
            const acc = md ? (md.accuracy || '—') : '—';
            const y = 50 + i * 38;
            _R(14, y - 2, VW - 28, 1, '#d8d8c8');
            _typeBadge(ty, 16, y);
            _T(nm.toUpperCase(), 66, y, { color: C_TXT, shadow: C_TXT_SH });
            _T('PP ' + pp, 16, y + 16, { kind: 'small', color: C_DIM });
            _T('POWER ' + pow, 80, y + 16, { kind: 'small', color: C_DIM });
            _T('ACC ' + acc, 168, y + 16, { kind: 'small', color: C_DIM });
        });
    }

    // Word-wrap + draw up to maxLines lines.
    function _wrapDraw(text, x, y, maxW, lineH, color, maxLines) {
        const words = String(text).split(/\s+/);
        let line = '', ln = 0;
        for (let i = 0; i < words.length && ln < maxLines; i++) {
            const test = line ? line + ' ' + words[i] : words[i];
            if (GameFont.measure(test, 'small') > maxW && line) {
                _T(line, x, y + ln * lineH, { kind: 'small', color });
                line = words[i]; ln++;
            } else line = test;
        }
        if (line && ln < maxLines) _T(line, x, y + ln * lineH, { kind: 'small', color });
    }

    function _onKey(e) {
        if (!_el) return;
        if (e.key === 'Escape' || e.key === 'x') { close(); }
        if (e.key === 'ArrowLeft')  _switchTab(-1);
        if (e.key === 'ArrowRight') _switchTab(1);
    }

    function _switchTab(dir) {
        const tabs = ['info','skills','moves'];
        const i = tabs.indexOf(_tab);
        _tab = tabs[Math.max(0, Math.min(tabs.length-1, i+dir))];
        _render();
    }

    function handleInput(jp) {
        if (!_el) return false;
        if (jp.b) { close(); return true; }
        if (jp.left)  { _switchTab(-1); return true; }
        if (jp.right) { _switchTab(1);  return true; }
        return true;
    }

    return { show, close, isOpen, handleInput };
})();
