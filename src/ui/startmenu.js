// GameStartMenu — Emerald Enhanced style: icon strip at top, info bar at bottom
window.GameStartMenu = (function () {
    'use strict';

    // Items match EE's BuildNormalStartMenu order
    const ITEMS = [
        { id: 'POKEMON',  label: 'POKéMON'  },
        { id: 'BAG',      label: 'BAG'      },
        { id: 'PLAYER',   label: ''         },
        { id: 'SAVE',     label: 'SAVE'     },
        { id: 'OPTIONS',  label: 'OPTION'   },
        { id: 'EXIT',     label: 'EXIT'     },
    ];

    const ICON_PATH = 'src/assets/start_menu/';
    // Use RGBA versions (palette index 0 made transparent)
    function _iconFile(name) { return ICON_PATH + name.replace('.png', '_rgba.png'); }

    const TIER_ICON  = { platinum: '💎', gold: '🥇', silver: '🥈', bronze: '🥉' };
    const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

    let menuEl      = null;
    let subEl       = null;   // sub-page overlay element
    let isOpen      = false;
    let selectedIdx = 1; // start on POKEMON
    let page        = 'main';
    let _saveDone   = false;
    let _subIdx     = 0;

    // --- Canvas bg image caches ---
    var _journalBg     = undefined; // null = tried + failed, undefined = not loaded yet
    var _apBg          = undefined;
    var _trainerCardBg = undefined;
    var _partyBg       = undefined;
    var _pokedexBg     = undefined;

    function _loadSimpleBg(src, storeRef, cb) {
        if (storeRef.val !== undefined) { cb(storeRef.val); return; }
        // Queue callback if already loading to prevent concurrent loads firing twice
        if (storeRef.loading) { (storeRef.queue = storeRef.queue || []).push(cb); return; }
        storeRef.loading = true;
        var img = new Image();
        var _done = function(v) {
            storeRef.val = v; storeRef.loading = false;
            cb(v);
            (storeRef.queue || []).forEach(function(f){ f(v); });
            storeRef.queue = [];
        };
        img.onload  = function() { _done(img); };
        img.onerror = function() { _done(null); };
        img.src = src;
    }
    // Wrapper objects so we can pass by reference
    var _jBgRef  = {};
    var _aBgRef  = {};
    var _tcBgRef = {};
    var _ptBgRef = {};
    var _pdBgRef = {};
    function _loadJournalBg(cb)     { _loadSimpleBg('src/assets/journal/journal_bg.png',      _jBgRef,  cb); }
    function _loadApBg(cb)          { _loadSimpleBg('src/assets/ap/ap_bg.png',                 _aBgRef,  cb); }
    function _loadTrainerCardBg(cb) { _loadSimpleBg('src/assets/trainer_card/trainer_card_bg.png', _tcBgRef, cb); }
    function _loadPartyBg(cb)       { _loadSimpleBg('src/assets/party/party_bg.png',           _ptBgRef, cb); }
    function _loadPokedexBg(cb)     { _loadSimpleBg('src/assets/pokedex/pokedex_bg.png',        _pdBgRef, cb); }

    // --- Theme helpers ---
    // Colors sourced from EE: 1d.gbapal (dark), 1.gbapal (light), ryudarktheme.gbapal, hatlighttheme.gbapal
    function _getThemeColors() {
        var theme   = localStorage.getItem('pokemon_theme')    || 'DARK';
        var preset  = localStorage.getItem('pokemon_theme_preset'); // BlueSteel|RoyalPurple|Synthwave|Mocha

        var PRESETS = {
            // [bg, text, dim, border, highlight, titleBg] — indices 1,2,3,13,14 from custom_interface.c × 8
            'BlueSteel':   { bg:'#181810', text:'#00a0f8', dim:'#000000', border:'#b0b0b0', hi:'#505050', titleBg:'#101018' },
            'RoyalPurple': { bg:'#181810', text:'#900098', dim:'#480060', border:'#780098', hi:'#500050', titleBg:'#101010' },
            'Synthwave':   { bg:'#300058', text:'#f8f8f8', dim:'#505060', border:'#600098', hi:'#d800f8', titleBg:'#180030' },
            'Mocha':       { bg:'#302800', text:'#f8e8c8', dim:'#707050', border:'#585840', hi:'#403838', titleBg:'#201800' },
        };

        if (preset && PRESETS[preset]) return PRESETS[preset];

        if (theme === 'LIGHT' || theme === 'VANILLA') {
            // From 1.gbapal: fill=index5=#f8f8f8, hi=index14=#c0b8d8, border=index13=#6860d0
            // From hatlighttheme.gbapal: text=index2=#000000, dim=index3=#b8b8b8
            return { bg:'#f0e8c8', text:'#181818', dim:'#484848', border:'#000000', hi:'#e83030', titleBg:'#e83030' };
        }
        // DARK (default) — from 1d.gbapal: fill=index1=#181818, hi=index14=#18c0f8, border=index13=#0070a8
        // From ryudarktheme.gbapal: text=index2=#d8d8f0, dim=index3=#787888
        return { bg:'#f8f8e0', text:'#181818', dim:'#484848', border:'#000000', hi:'#ee3100', titleBg:'#ee3100' };
    }

    function _applyThemeCSS() {
        var tc = _getThemeColors();
        var r = document.documentElement;
        r.style.setProperty('--theme-win-bg',   tc.bg);
        r.style.setProperty('--theme-title-bg', tc.titleBg);
        r.style.setProperty('--theme-text',     tc.text);
        r.style.setProperty('--theme-hi',       tc.hi);
        r.style.setProperty('--theme-border',   tc.border);
        // RGB breakdown for rgba() usage
        function hexRgb(h) { h=h.replace('#',''); return parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16); }
        r.style.setProperty('--theme-hi-rgb', hexRgb(tc.hi));
    }

    function _bagBgPath() {
        var ui    = (localStorage.getItem('pokemon_theme_ui')  || 'CLASSIC').toLowerCase();
        var theme = (localStorage.getItem('pokemon_theme')     || 'DARK').toLowerCase();
        // light/vanilla → light palette; anything else → dark
        var palKey = (theme === 'light' || theme === 'vanilla') ? 'light' : 'dark';
        // ui: modern|classic|vanilla
        if (ui !== 'modern' && ui !== 'vanilla') ui = 'classic';
        return 'src/assets/bag/bag_bg_' + ui + '_' + palKey + '.png';
    }

    // --- Bag state ---
    var _bagPocket   = 0;
    var _bagAssets   = null; // { bg, icons: [{unsel,sel}×8] }
    var _battleItemCallback  = null; // set when bag is opened from battle
    var _battleBagCancel     = null; // called when bag is closed without using an item
    var _battlePartyCallback = null; // set when party is opened from battle (switch)
    var _battlePartyCancel   = null; // called when party is closed without switching
    var _bagItemIconCache = {}; // name → Image|null

    function _itemIconPath(item) {
        if (!item) return null;
        var name = (item.name || '').toLowerCase()
            .replace(/[éè]/g,'e').replace(/[^a-z0-9]+/g,'_').replace(/_+$/,'');
        // Direct matches and common mappings
        var MAP = {
            'poke_ball':'poke_ball','pok_ball':'poke_ball',
            'great_ball':'great_ball','ultra_ball':'ultra_ball','master_ball':'master_ball',
            'potion':'potion','super_potion':'super_potion','hyper_potion':'hyper_potion',
            'max_potion':'max_potion','full_restore':'full_restore',
            'antidote':'antidote','burn_heal':'burn_heal','ice_heal':'ice_heal',
            'awakening':'awakening','parlyz_heal':'parlyz_heal','full_heal':'full_heal',
            'revive':'revive','max_revive':'max_revive',
            'nugget':'nugget','big_nugget':'big_nugget',
            'bicycle':'bicycle','old_rod':'old_rod','good_rod':'good_rod','super_rod':'super_rod',
            'oran_berry':'oran_berry','sitrus_berry':'sitrus_berry','lum_berry':'lum_berry',
            'leppa_berry':'leppa_berry','rawst_berry':'rawst_berry',
        };
        // TM/HM check
        if (/^tm\d/.test(name)) return 'src/assets/bag/item_icons/tm01_rgba.png';
        if (/^hm\d/.test(name)) return 'src/assets/bag/item_icons/tm01_rgba.png';
        var key = MAP[name] || name;
        return 'src/assets/bag/item_icons/' + key + '_rgba.png';
    }

    function _loadItemIcon(item, cb) {
        var path = _itemIconPath(item);
        if (!path) { cb(null); return; }
        if (_bagItemIconCache[path] !== undefined) { cb(_bagItemIconCache[path]); return; }
        var img = new Image();
        img.onload = function() { _bagItemIconCache[path] = img; cb(img); };
        img.onerror = function() { _bagItemIconCache[path] = null; cb(null); };
        img.src = path;
    }
    function _loadBagAssets(cb) {
        if (_bagAssets) { cb(_bagAssets); return; }
        var assets = { bg: null, icons: [], bagFrames: [] };
        var pending = 1 + 16 + 6; // bg + 8 unsel + 8 sel + 6 bag frames
        function done() { if (--pending === 0) { _bagAssets = assets; cb(assets); } }
        var bg = new Image();
        bg.onload = function() { assets.bg = bg; done(); };
        bg.onerror = function() { done(); };
        bg.src = 'src/assets/bag/bag_bg_ee.png'; // assembled from EE submodule tiles + male palette
        for (var i = 0; i < 8; i++) {
            (function(idx) {
                var icon = { unsel: null, sel: null };
                assets.icons.push(icon);
                var u = new Image();
                u.onload = function() { icon.unsel = u; done(); };
                u.onerror = function() { done(); };
                u.src = 'src/assets/bag/pocket_icon_' + idx + '_unsel.png';
                var s = new Image();
                s.onload = function() { icon.sel = s; done(); };
                s.onerror = function() { done(); };
                s.src = 'src/assets/bag/pocket_icon_' + idx + '_sel.png';
            })(i);
        }
        for (var f = 0; f < 6; f++) {
            (function(fi) {
                var bf = new Image();
                bf.onload = function() { assets.bagFrames[fi] = bf; done(); };
                bf.onerror = function() { assets.bagFrames[fi] = null; done(); };
                bf.src = 'src/assets/bag/bag_frame_' + fi + '_rgba.png';
            })(f);
        }
    }

    // --- Data helpers ---
    function _playtime() {
        const secs = (window.GameSave && GameSave.state && GameSave.state.meta)
            ? (GameSave.state.meta.playtimeSeconds || 0) : 0;
        const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
        return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    }
    function _playerName() {
        return (window.GameSave && GameSave.state && GameSave.state.player)
            ? (GameSave.state.player.name || 'TRAINER') : 'TRAINER';
    }
    function _money() {
        return (window.GameSave && GameSave.state && GameSave.state.player)
            ? (GameSave.state.player.money || 0) : 0;
    }
    function _badges() {
        return (window.GameSave && GameSave.state && GameSave.state.meta)
            ? (GameSave.state.meta.badgeCount || 0) : 0;
    }
    function _ap() {
        return (window.GameSave && GameSave.state && GameSave.state.achievements)
            ? (GameSave.state.achievements.totalAP || 0) : 0;
    }
    function _achList() {
        return (window.GameSave && GameSave.state && GameSave.state.achievements)
            ? (GameSave.state.achievements.unlocked || []) : [];
    }
    function _trainerId() {
        return (window.GameSave && GameSave.state && GameSave.state.meta)
            ? String(GameSave.state.meta.trainerId || 0).padStart(6,'0') : '000000';
    }
    function _mapName() {
        return (window.GameMap && GameMap.current) ? (GameMap.current.name || '—') : '—';
    }
    function _lifeSkills() {
        return (window.GameSave && GameSave.state && GameSave.state.lifeSkills)
            ? GameSave.state.lifeSkills : { alchemy:0, botany:0, mining:0 };
    }
    function _timeOfDay() {
        const h = new Date().getHours();
        if (h >= 5  && h < 8)  return { label:'Dawn',  cls:'tod-dawn'  };
        if (h >= 8  && h < 18) return { label:'Day',   cls:'tod-day'   };
        if (h >= 18 && h < 21) return { label:'Dusk',  cls:'tod-dusk'  };
        return                         { label:'Night', cls:'tod-night' };
    }
    function _clockStr() {
        const d = new Date(), h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
        return (h%12||12)+':'+m+' '+(h>=12?'pm':'am');
    }
    function _dayOfWeek() {
        return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
    }
    function _season() {
        const mo = new Date().getMonth();
        if (mo<=1||mo===11) return 'Winter';
        if (mo<=4) return 'Spring';
        if (mo<=7) return 'Summer';
        return 'Autumn';
    }

    // --- Render main menu — FireRed vertical list, right-side panel ---
    var ITEM_DESCS = {
        'POKEMON': 'Check the POKéMON\nyou are carrying.',
        'BAG':     'Open your BAG\nand use items.',
        'PLAYER':  'Check your Trainer\nCard and status.',
        'SAVE':    'Save your game with a complete record\nof your progress to take a break.',
        'OPTIONS': 'Adjust various settings\nfor your game.',
        'EXIT':    'Close the menu\nand return to the game.',
    };

    function _renderMain() {
        menuEl.innerHTML = '';

        // Top row: void on left + panel on right
        const topRow = document.createElement('div');
        topRow.className = 'sm-top-row';

        const voidEl = document.createElement('div');
        voidEl.className = 'sm-void';
        topRow.appendChild(voidEl);

        // Right panel — fully canvas-rendered so Chrome dark mode cannot touch it
        const PW = 108, ROW_H = 18, PAD_X = 6, FONT_PX = 8;
        const PH = ITEMS.length * ROW_H;
        const panelCanvas = document.createElement('canvas');
        panelCanvas.width  = PW;
        panelCanvas.height = PH;
        panelCanvas.style.cssText = 'display:block;flex:none;width:48%;min-width:88px;max-width:116px;height:auto;pointer-events:all;border-left:2px solid #101010;border-top:2px solid #101010;border-bottom:2px solid #101010;cursor:pointer;image-rendering:pixelated;';
        const pc = panelCanvas.getContext('2d');

        function _drawPanel() {
            pc.clearRect(0, 0, PW, PH);
            // White background
            pc.fillStyle = '#f8f8f0';
            pc.fillRect(0, 0, PW, PH);
            // Row highlight for selected
            pc.fillStyle = 'rgba(0,0,0,0.08)';
            pc.fillRect(0, selectedIdx * ROW_H, PW, ROW_H);
            // Text
            pc.font = 'bold ' + FONT_PX + 'px "Press Start 2P", monospace';
            pc.textBaseline = 'middle';
            ITEMS.forEach(function(itm, i) {
                const y = i * ROW_H + ROW_H / 2;
                pc.fillStyle = '#181818';
                if (i === selectedIdx) {
                    pc.fillText('▶', PAD_X, y);
                }
                const label = (itm.id === 'PLAYER') ? _playerName().toUpperCase() : itm.label.toUpperCase();
                pc.fillText(label, PAD_X + 12, y);
            });
        }
        _drawPanel();

        // Map canvas clicks to item selection
        panelCanvas.addEventListener('click', function(e) {
            const rect = panelCanvas.getBoundingClientRect();
            const scaleY = PH / rect.height;
            const iy = Math.floor((e.clientY - rect.top) * scaleY / ROW_H);
            if (iy >= 0 && iy < ITEMS.length) { selectedIdx = iy; _confirmSelected(); }
        });

        topRow.appendChild(panelCanvas);
        menuEl.appendChild(topRow);

        // Blue description bar at bottom — also canvas
        const DW = menuEl.offsetWidth || 240, DH = 34;
        const descCanvas = document.createElement('canvas');
        descCanvas.width  = DW || 240;
        descCanvas.height = DH;
        descCanvas.style.cssText = 'display:block;flex:none;width:100%;height:34px;pointer-events:none;';
        const dc = descCanvas.getContext('2d');
        dc.fillStyle = '#2870c0';
        dc.fillRect(0, 0, descCanvas.width, DH);
        dc.fillStyle = '#ffffff';
        dc.font = '7px "Press Start 2P", monospace';
        dc.textBaseline = 'top';
        const selItem = ITEMS[selectedIdx];
        const descText = selItem ? (ITEM_DESCS[selItem.id] || '') : '';
        // Word-wrap simple: split by space, draw lines
        const words = descText.split(' ');
        let line = '', lineY = 6, maxW = descCanvas.width - 12;
        words.forEach(function(w) {
            const test = line ? line + ' ' + w : w;
            if (dc.measureText(test).width > maxW && line) {
                dc.fillText(line, 6, lineY); lineY += 11; line = w;
            } else { line = test; }
        });
        if (line) dc.fillText(line, 6, lineY);
        menuEl.appendChild(descCanvas);
    }

    // --- Render sub-page overlay ---
    function _renderSub() {
        subEl.innerHTML = '';
        subEl._pageEl = null;

        // Canvas-based full-screen pages bypass the sm-win wrapper entirely
        var CANVAS_PAGES = ['bag','journal','achievements','trainer_card','options','pokemon','pokedex','pokedex_entry','pokenav','save'];
        if (CANVAS_PAGES.indexOf(page) !== -1) {
            var pageEl = document.createElement('div');
            pageEl.style.cssText = 'position:absolute;inset:0;pointer-events:all;';
            if      (page === 'bag')          _buildBag(pageEl);
            else if (page === 'journal')      _buildJournal(pageEl);
            else if (page === 'achievements') _buildAchievements(pageEl);
            else if (page === 'trainer_card') _buildTrainerCard(pageEl);
            else if (page === 'options')      _buildOptions(pageEl);
            else if (page === 'pokemon')      _buildParty(pageEl);
            else if (page === 'pokedex')      _buildPokedex(pageEl);
            else if (page === 'pokedex_entry')_buildPokedexEntry(pageEl);
            else if (page === 'pokenav')      _buildPokenav(pageEl);
            else if (page === 'save')         _buildSave(pageEl);
            subEl.appendChild(pageEl);
            subEl._pageEl = pageEl;
            subEl.style.display = 'block';
            return;
        }

        const titles = { journal:'Journal', trainer_card:'Trainer Card',
                         achievements:'Achievement Atlas', pokenav:'Pokénav',
                         save:'Save', options:'Options', pokemon:'Pokémon',
                         pokedex:'Pokédex', pokedex_entry:'Pokédex' };

        // GBA-style dialog window — positioned over the map, not full-screen
        const win = document.createElement('div');
        win.className = 'sm-win';
        win.dataset.page = page;

        // Title bar with B/Back button on the right
        const titleBar = document.createElement('div');
        titleBar.className = 'sm-win-title';
        const titleEl = document.createElement('span');
        titleEl.textContent = titles[page] || page;
        const backBtn = document.createElement('button');
        backBtn.className = 'sm-back-btn';
        backBtn.textContent = 'B BACK';
        backBtn.addEventListener('click', _goBack);
        titleBar.appendChild(titleEl);
        titleBar.appendChild(backBtn);
        win.appendChild(titleBar);

        const content = document.createElement('div');
        content.className = 'sm-sub-content';

        if      (page === 'trainer_card')  _buildTrainerCard(content);
        else if (page === 'journal')       _buildJournal(content);
        else if (page === 'achievements')  _buildAchievements(content);
        else if (page === 'pokenav')       _buildPokenav(content);
        else if (page === 'save')          _buildSave(content);
        else if (page === 'options')       _buildOptions(content);
        else if (page === 'pokemon')       _buildParty(content);
        else if (page === 'pokedex')       _buildPokedex(content);
        else if (page === 'pokedex_entry') _buildPokedexEntry(content);

        win.appendChild(content);
        subEl.appendChild(win);

        subEl.style.display = 'block';

        setTimeout(function () {
            const sel = content.querySelector('.sm-row.selected, .sm-ach-row.selected');
            if (sel) sel.scrollIntoView({ block: 'nearest' });
        }, 0);
    }

    function _render() {
        if (!menuEl) return;
        if (page === 'main') {
            menuEl.style.visibility = 'visible';
            _renderMain();
            if (subEl) subEl.style.display = 'none';
        } else {
            menuEl.style.visibility = 'hidden';
            _renderSub();
        }
    }

    // --- Sub-page builders (canvas-based) ---
    var GBA_W = 480, GBA_H = 320;

    function _makeCanvasShell(el, redrawFn) {
        el.style.cssText = 'padding:0;overflow:hidden;background:none;position:absolute;inset:0;';
        var backBtn = document.createElement('button');
        backBtn.textContent = 'B BACK';
        backBtn.className = 'sm-back-btn';
        backBtn.style.cssText = 'position:absolute;bottom:4px;right:4px;z-index:10;pointer-events:all;';
        backBtn.addEventListener('click', _goBack);
        el.appendChild(backBtn);
        var canvas = document.createElement('canvas');
        canvas.width  = GBA_W;
        canvas.height = GBA_H;
        canvas.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;';
        canvas.style.pointerEvents = 'all';
        el.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        redrawFn(ctx, canvas);
        return { ctx: ctx, canvas: canvas };
    }

    function _canvasBg(ctx, bg) {
        var _tc = _getThemeColors();
        ctx.fillStyle = _tc.bg;
        ctx.fillRect(0, 0, GBA_W, GBA_H);
        if (bg) { ctx.imageSmoothingEnabled = false; ctx.drawImage(bg, 0, 0, GBA_W, GBA_H); }
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    function _buildTrainerCard(el) {
        _makeCanvasShell(el, function(ctx) {
            _loadTrainerCardBg(function(bg) {
                _canvasBg(ctx, bg);
                var S = 2;
                var _tc = _getThemeColors(); var COL_TEXT = _tc.text; var COL_DIM = _tc.dim; var COL_CYAN = _tc.hi;
                ctx.textBaseline = 'top';

                var ls = _lifeSkills();
                var rows = [
                    { key:'Name',       val:_playerName() },
                    { key:'Trainer ID', val:_trainerId() },
                    { key:'Money',      val:'₱'+_money().toLocaleString() },
                    { key:'Location',   val:_mapName() },
                    null,
                    { key:'Badges',     val:_badges()+' / 8' },
                    { key:'Ach Points', val:_ap()+' AP  ('+_achList().length+' earned)' },
                    { key:'Play Time',  val:_playtime() },
                    null,
                    { key:'Botany',     val:'Lv '+(ls.botany||0) },
                    { key:'Mining',     val:'Lv '+(ls.mining||0) },
                    { key:'Alchemy',    val:'Lv '+(ls.alchemy||0) },
                ];

                ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
                ctx.fillStyle = COL_CYAN;
                ctx.fillText('TRAINER CARD', 16*S, 8*S);

                ctx.font = (7*S)+'px "Press Start 2P", monospace';
                var y = 28*S;
                rows.forEach(function(r) {
                    if (!r) { y += 8*S; return; }
                    ctx.fillStyle = COL_DIM;
                    ctx.fillText(r.key, 16*S, y);
                    ctx.fillStyle = COL_TEXT;
                    ctx.fillText(r.val, 130*S, y);
                    y += 14*S;
                });

                // Player avatar: standing-down frame from data/sprites/player.png
                var avatarImg = new Image();
                avatarImg.onload = function() {
                    // Frame 0 (standing down) is at srcX=0, 16×32 — scale up 4× for card
                    var aw = 16*4*S/2, ah = 32*4*S/2; // 64×128 at S=2 canvas → 64×128px
                    var ax = (240 - 16*4)*S - 8*S;    // right edge with margin
                    var ay = 20*S;
                    // Draw silhouette backdrop
                    ctx.fillStyle = 'rgba(230,8,8,0.07)';
                    ctx.fillRect(ax - 4*S, ay - 4*S, aw + 8*S, ah + 8*S);
                    ctx.strokeStyle = '#e60808';
                    ctx.lineWidth = S;
                    ctx.strokeRect(ax - 4*S, ay - 4*S, aw + 8*S, ah + 8*S);
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(avatarImg, 0, 0, 16, 32, ax, ay, aw, ah);
                };
                avatarImg.src = 'data/sprites/player.png';
            });
        });
    }

    // Journal state
    var _journalTab  = 0;  // 0=Factions, 1=Ach.Atlas, 2=Powers, 3=Quests
    var _journalPage = 0;  // sub-page within Factions (L/R)
    var _achTier = 0;      // 0=all,1=plat,2=gold,3=silver,4=bronze
    var _achOffset = 0;    // scroll offset in flat ach list
    var _powersPage = 0;   // 0=Platinum,1=Gold,2=Silver,3=Copper

    var JOURNAL_TABS = ['Factions', 'Ach. Atlas', 'Powers', 'Quests'];

    // EE journal.c: 6 stat sub-pages navigated with L/R buttons (within Factions tab)
    const JOURNAL_PAGES = [
        {
            name: 'General Stats',
            stats: function() {
                const st = window.GameSave && GameSave.state;
                const gs = st && st.gameStats || {};
                const dex = st && st.pokedex || {};
                const ach = st && st.achievements || {};
                return [
                    ['Prestige Level',     st && st.meta && st.meta.ngPlusCount || 0],
                    ['Achievements',       (ach.unlocked || []).length],
                    ['Dex Seen',           (dex.seen || []).length],
                    ['Dex Caught',         (dex.caught || []).length],
                    ['Legendaries Caught', gs.legendariesCaught || 0],
                    ['Steps Taken',        gs.steps || 0],
                    ['Healed Party',       gs.healed || 0],
                ];
            }
        },
        {
            name: 'Life Skills',
            stats: function() {
                const ls = _lifeSkills();
                return [
                    ['Botany Lv',    ls.botany || 0],
                    ['Botany EXP',   ls.botanyExp || 0],
                    ['Mining Lv',    ls.mining || 0],
                    ['Mining EXP',   ls.miningExp || 0],
                    ['Alchemy Lv',   ls.alchemy || 0],
                    ['Alchemy EXP',  ls.alchemyExp || 0],
                    ['Harvest Lv',   ls.harvest || 0],
                ];
            }
        },
        {
            name: 'Battle Stats',
            stats: function() {
                const gs = (window.GameSave && GameSave.state && GameSave.state.gameStats) || {};
                return [
                    ['Total Battles',    gs.totalBattles || 0],
                    ['Battles Won',      gs.battlesWon || 0],
                    ['Battles Lost',     gs.battlesLost || 0],
                    ['Total Captures',   gs.captures || 0],
                    ['Knockouts',        gs.knockouts || 0],
                    ['Gym Leaders Fought', gs.gymLeadersFought || 0],
                    ['Title Defense Wins', gs.titleDefenseWins || 0],
                ];
            }
        },
        {
            name: 'Training Stats',
            stats: function() {
                const gs = (window.GameSave && GameSave.state && GameSave.state.gameStats) || {};
                return [
                    ['EXP Earned',       gs.expEarned || 0],
                    ['Pokemon Evolved',  gs.evolved || 0],
                    ['Eggs Hatched',     gs.eggsHatched || 0],
                    ['Ribbons Received', gs.ribbons || 0],
                    ['Contests Entered', gs.contestsEntered || 0],
                    ['Contests Won',     gs.contestsWon || 0],
                ];
            }
        },
        {
            name: 'Financial Stats',
            stats: function() {
                const st = window.GameSave && GameSave.state;
                const gs = st && st.gameStats || {};
                return [
                    ['Money',            '₽' + (_money()).toLocaleString()],
                    ['Bank Balance',     '₽' + (gs.bankBalance || 0).toLocaleString()],
                    ['Net Worth',        '₽' + (gs.netWorth || 0).toLocaleString()],
                    ['Properties Owned', gs.propertiesOwned || 0],
                    ['Days Interest',    gs.daysInterest || 0],
                ];
            }
        },
        {
            name: 'Social Stats',
            stats: function() {
                const gs = (window.GameSave && GameSave.state && GameSave.state.gameStats) || {};
                return [
                    ['Pokeblocks Made',  gs.pokeblocksM || 0],
                    ['Pokeblocks Used',  gs.pokeblocksU || 0],
                    ['NPCs Talked To',   gs.npcsTalked || 0],
                    ['Signs Read',       gs.signsRead || 0],
                ];
            }
        },
    ];

    function _buildJournal(el) {
        var shell = _makeCanvasShell(el, function(ctx, canvas) {
            _loadJournalBg(function(bg) { _drawJournalCanvas(ctx, bg); });
        });
        var ctx = shell.ctx, canvas = shell.canvas;
        el._redraw = function() { _loadJournalBg(function(bg) { _drawJournalCanvas(ctx, bg); }); };

        // Tab clicks
        canvas.addEventListener('click', function(e) {
            var rect = canvas.getBoundingClientRect();
            var cx = (e.clientX - rect.left) / rect.width  * GBA_W;
            var cy = (e.clientY - rect.top)  / rect.height * GBA_H;
            // Tab row y=0..18 GBA, each tab ~60px wide
            if (cy < 18) {
                var t = Math.floor(cx / 60);
                if (t >= 0 && t < 4) { _journalTab = t; _journalPage = 0; _achTier = 0; _powersPage = 0; el._redraw(); }
                return;
            }
            // Factions sub-page: tap left/right halves of sub-nav row (y=18..30)
            if (_journalTab === 0 && cy >= 18 && cy < 30) {
                if (cx < 120) { _journalPage = (_journalPage - 1 + JOURNAL_PAGES.length) % JOURNAL_PAGES.length; el._redraw(); }
                else          { _journalPage = (_journalPage + 1) % JOURNAL_PAGES.length; el._redraw(); }
            }
        });
    }

    function _drawJournalCanvas(ctx, bg) {
        var S = 2;
        var CYAN    = '#e60808';
        var TEXT    = '#181818';
        var DIM     = '#484848';
        var BG      = '#d5d5bd';
        var TITLEBG = '#62737b';

        // Hard reset canvas state before every draw
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, GBA_W, GBA_H);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, GBA_W, GBA_H);
        ctx.textBaseline = 'top';

        // ── 4 main tabs (y=0..17 GBA) ───────────────────────────────────────
        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        var tabW = 60;
        JOURNAL_TABS.forEach(function(label, i) {
            var tx = i * tabW * S, tw = tabW * S, ty = 0, th = 17 * S;
            var sel = (i === _journalTab);
            if (sel) {
                ctx.fillStyle = TITLEBG;
                ctx.fillRect(tx, ty, tw, th);
                ctx.strokeStyle = CYAN;
                ctx.lineWidth = S;
                ctx.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);
                ctx.fillStyle = CYAN;
            } else {
                ctx.fillStyle = DIM;
            }
            var lw = ctx.measureText(label).width;
            ctx.fillText(label, tx + (tw - lw) / 2, ty + 5*S);
        });
        // separator line
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 17*S, GBA_W, S);

        // ── Tab content ──────────────────────────────────────────────────────
        if (_journalTab === 0) {
            _drawJournalFactions(ctx, S, CYAN, TEXT, DIM, BG, TITLEBG);
        } else if (_journalTab === 1) {
            _drawJournalAchAtlas(ctx, S, CYAN, TEXT, DIM);
        } else if (_journalTab === 2) {
            _drawJournalPowers(ctx, S, CYAN, TEXT, DIM, BG, TITLEBG);
        } else if (_journalTab === 3) {
            _drawJournalQuests(ctx, S, CYAN, TEXT, DIM);
        }

        // ── Bottom bar (y=112..159 GBA) ──────────────────────────────────────
        ctx.fillStyle = TITLEBG;
        ctx.fillRect(0, 112*S, GBA_W, 48*S);
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 112*S, GBA_W, S);

        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        ctx.textBaseline = 'top';
        // Row 1: Name  ID: XXXXX  Money
        ctx.fillStyle = TEXT;
        ctx.fillText(_playerName(), 4*S, 114*S);
        ctx.fillText('ID: ' + _trainerId(), 82*S, 114*S);
        var moneyStr = '₱' + _money().toLocaleString();
        var mw = ctx.measureText(moneyStr).width;
        ctx.fillText(moneyStr, GBA_W - mw - 4*S, 114*S);
        // Row 2: party dots left + Stamina right
        var st = window.GameSave && GameSave.state;
        var party = st && st.party || [];
        for (var pi = 0; pi < 6; pi++) {
            var px = (4 + pi * 10) * S;
            var hasMon = pi < party.length;
            ctx.fillStyle = hasMon ? '#2a7030' : '#888899';
            ctx.fillRect(px, 128*S, 8*S, 8*S);
        }
        ctx.fillStyle = TEXT;
        ctx.fillText('Stamina: 100', 82*S, 128*S);
    }

    function _drawJournalFactions(ctx, S, CYAN, TEXT, DIM, BG, TITLEBG) {
        var page = JOURNAL_PAGES[_journalPage];

        // Sub-page nav row (y=18..29 GBA)
        ctx.fillStyle = TITLEBG;
        ctx.fillRect(0, 18*S, GBA_W, 11*S);
        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        ctx.textBaseline = 'top';
        ctx.fillStyle = CYAN;
        ctx.fillText('< (L)', 4*S, 19*S);
        var nameW = ctx.measureText(page.name).width;
        ctx.fillStyle = TEXT;
        ctx.fillText(page.name, (GBA_W/2 - nameW/2), 19*S);
        ctx.fillStyle = CYAN;
        var rStr = '(R) >';
        ctx.fillText(rStr, GBA_W - ctx.measureText(rStr).width - 4*S, 19*S);
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 29*S, GBA_W, S);

        // Stats in 2-column layout (y=30..111 GBA, 4 rows visible)
        var stats = page.stats();
        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        var ROW_H = 20, COL_MID = 120;
        for (var i = 0; i < stats.length; i++) {
            var col  = i % 2;
            var row  = Math.floor(i / 2);
            var ry   = (32 + row * ROW_H) * S;
            if (ry > 110*S) break;
            var colX = col * COL_MID * S;
            // Background stripe on even rows
            if (row % 2 === 0) {
                ctx.fillStyle = 'rgba(98,115,123,0.18)';
                ctx.fillRect(colX, ry - S, COL_MID*S, ROW_H*S);
            }
            ctx.fillStyle = DIM;
            ctx.fillText(String(stats[i][0]), colX + 4*S, ry);
            ctx.fillStyle = TEXT;
            var val = String(stats[i][1]);
            var vw = ctx.measureText(val).width;
            ctx.fillText(val, colX + (COL_MID - 4)*S - vw, ry);
            // Column divider
            ctx.fillStyle = 'rgba(230,8,8,0.12)';
            ctx.fillRect(COL_MID*S - S, 30*S, S, 82*S);
        }
    }

    function _drawJournalAchAtlas(ctx, S, CYAN, TEXT, DIM) {
        // AP counter top-right
        var ap = _ap();
        var allForAP = window.GameAchievements ? GameAchievements.getAll() : [];
        var maxAP = allForAP.reduce(function(s,a){ return s + (a.apReward||0); }, 0);
        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        ctx.textBaseline = 'top';
        var apStr = ap + ' / ' + maxAP + ' AP';
        var apW = ctx.measureText(apStr).width;
        ctx.fillStyle = CYAN;
        ctx.fillText(apStr, GBA_W - apW - 4*S, 19*S);

        // Tier filter tabs
        var TIERS = ['All', 'Plat', 'Gold', 'Silv', 'Brnz'];
        var tw = 48 * S;
        TIERS.forEach(function(t, i) {
            var sel = i === _achTier;
            ctx.fillStyle = sel ? CYAN : DIM;
            var lw = ctx.measureText(t).width;
            ctx.fillText(t, 4*S + i * tw + (tw - lw)/2, 19*S);
        });
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 29*S, GBA_W, S);

        // Achievement list — use full objects from GameAchievements
        var allAchs = window.GameAchievements ? GameAchievements.getAll() : [];
        var TIER_NAMES = [null,'platinum','gold','silver','bronze'];
        var filtered = _achTier === 0 ? allAchs : allAchs.filter(function(a){ return a.tier === TIER_NAMES[_achTier]; });
        var LIST_ROWS = 5;
        // Keep _achOffset in sync with _subIdx
        if (_subIdx < _achOffset) _achOffset = _subIdx;
        if (_subIdx >= _achOffset + LIST_ROWS) _achOffset = _subIdx - LIST_ROWS + 1;
        _achOffset = Math.max(0, Math.min(_achOffset, Math.max(0, filtered.length - LIST_ROWS)));
        var listY = 31;
        for (var j = 0; j < LIST_ROWS; j++) {
            var idx = _achOffset + j;
            if (idx >= filtered.length) break;
            var ach = filtered[idx];
            var sel2 = (idx === _subIdx);
            var ry2 = (listY + j * 14) * S;
            if (sel2) { ctx.fillStyle = 'rgba(230,8,8,0.12)'; ctx.fillRect(0, ry2 - S, GBA_W, 14*S); }
            ctx.fillStyle = ach.unlocked ? TEXT : DIM;
            ctx.font = (7*S) + 'px "Press Start 2P", monospace';
            ctx.fillText((ach.unlocked ? '[+]' : '[X]') + ' ' + (ach.name||''), 4*S, ry2);
            var apVal = (ach.apReward || 0) + 'AP';
            var avw = ctx.measureText(apVal).width;
            ctx.fillText(apVal, GBA_W - avw - 4*S, ry2);
        }
        // Scroll indicators
        if (_achOffset > 0) { ctx.fillStyle = CYAN; ctx.font=(7*S)+'px "Press Start 2P", monospace'; ctx.fillText('▲', GBA_W/2-4, (listY-2)*S); }
        if (_achOffset + LIST_ROWS < filtered.length) { ctx.fillStyle = CYAN; ctx.font=(7*S)+'px "Press Start 2P", monospace'; ctx.fillText('▼', GBA_W/2-4, (listY+LIST_ROWS*14)*S); }

        // Selected ach description
        var selAch = filtered[_subIdx];
        if (selAch) {
            ctx.fillStyle = 'rgba(98,115,123,0.22)';
            ctx.fillRect(0, 102*S, GBA_W, 10*S);
            ctx.fillStyle = CYAN;
            ctx.fillRect(0, 102*S, GBA_W, S);
            ctx.fillStyle = selAch.unlocked ? TEXT : DIM;
            ctx.font = (7*S) + 'px "Press Start 2P", monospace';
            ctx.fillText((selAch.name||'') + (selAch.unlocked ? ' [EARNED]' : ' [LOCKED]'), 4*S, 103*S);
            ctx.fillStyle = DIM;
            ctx.fillText((selAch.desc||''), 4*S, 103*S + 9*S);
        }
    }

    function _drawJournalPowers(ctx, S, CYAN, TEXT, DIM, BG, TITLEBG) {
        var TIERS = ['Platinum', 'Gold', 'Silver', 'Copper'];
        var ap = _ap();

        // Tier tabs + AP counter
        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        ctx.textBaseline = 'top';
        var tw = 55 * S;
        TIERS.forEach(function(t, i) {
            var sel = (i === _powersPage);
            ctx.fillStyle = sel ? CYAN : DIM;
            var lw = ctx.measureText(t).width;
            ctx.fillText(t, 4*S + i * tw + (tw - lw)/2, 19*S);
        });
        var apStr = ap + ' AP';
        ctx.fillStyle = CYAN;
        ctx.fillText(apStr, GBA_W - ctx.measureText(apStr).width - 4*S, 19*S);
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 29*S, GBA_W, S);

        // Column headers
        ctx.fillStyle = DIM;
        ctx.fillText('Powers', 20*S, 32*S);
        ctx.fillText('Cost', GBA_W - ctx.measureText('Cost').width - 4*S, 32*S);
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 40*S, GBA_W, S);

        // Power list (placeholder)
        var TIER_COSTS = [51, 30, 15, 5];
        var TIER_POWERS = [
            ['Sprint Boost','Global Repel','Trainer Repel','Double EV Gain'],
            ['Exp Share All','Lucky Egg Boost','Pickup Up','Pickup Boost'],
            ['Repel Boost','Amulet Boost','Potion Boost','Berry Boost'],
            ['Map Reveal','Fast Text','Auto Run','Extended HMs'],
        ];
        var powers = TIER_POWERS[_powersPage] || [];
        var cost   = TIER_COSTS[_powersPage];
        powers.forEach(function(p, i) {
            var ry = (44 + i * 14) * S;
            // pink = locked (not enough AP), grey = available
            ctx.fillStyle = ap >= cost ? DIM : '#ff80b0';
            ctx.fillText(p, 8*S, ry);
            ctx.fillStyle = DIM;
            var cStr = cost + 'AP';
            ctx.fillText(cStr, GBA_W - ctx.measureText(cStr).width - 4*S, ry);
        });

        // Description placeholder
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 102*S, GBA_W, S);
        ctx.fillStyle = DIM;
        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        ctx.fillText('Select a power to view its description.', 4*S, 104*S);
    }

    function _drawJournalQuests(ctx, S, CYAN, TEXT, DIM) {
        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        ctx.textBaseline = 'top';

        // Header
        ctx.fillStyle = TEXT;
        ctx.fillText('Select a Quest', 4*S, 20*S);
        ctx.fillStyle = CYAN;
        ctx.fillText('Current', GBA_W - ctx.measureText('Current').width - 4*S, 20*S);
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 29*S, GBA_W, S);

        var st = window.GameSave && GameSave.state;
        var quests = (st && st.quests) || {};
        var QUEST_LIST = [
            { name: 'Corporate Life',    key: 'corporateLife'  },
            { name: 'Weather Theorem',   key: 'weatherTheorem' },
            { name: 'Fiery Enterprise',  key: 'fieryEnterprise'},
            { name: 'Sail the High Seas',key: 'highSeas'       },
            { name: 'Delivery System',   key: 'delivery'       },
            { name: 'Faction Daily Quest', key: 'factionDaily' },
        ];

        QUEST_LIST.forEach(function(q, i) {
            var ry = (32 + i * 13) * S;
            var val = quests[q.key] || 0;
            var sel = (i === _subIdx);
            if (sel) { ctx.fillStyle='rgba(230,8,8,0.12)'; ctx.fillRect(0,ry-S,GBA_W,13*S); }
            ctx.fillStyle = sel ? CYAN : TEXT;
            ctx.fillText(q.name, 8*S, ry);
            ctx.fillStyle = TEXT;
            var vs = String(val);
            ctx.fillText(vs, GBA_W - ctx.measureText(vs).width - 4*S, ry);
        });

        // Description box
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 102*S, GBA_W, S);
        ctx.fillStyle = DIM;
        ctx.fillText('Select a quest to view progress.', 4*S, 104*S);
    }

    function _buildAchievements(el) {
        var shell = _makeCanvasShell(el, function(ctx, canvas) {
            _loadApBg(function(bg) {
                _drawAchievementsCanvas(ctx, bg);
            });

            // Tier tab buttons overlaid on canvas
            var TIERS = ['All', 'Plat', 'Gold', 'Silv', 'Brnz'];
            var tabsEl = document.createElement('div');
            tabsEl.style.cssText = 'position:absolute;top:2px;left:2px;display:flex;gap:2px;z-index:10;pointer-events:all;';
            TIERS.forEach(function(t, i) {
                var btn = document.createElement('button');
                btn.className = 'sm-back-btn' + (_achTier === i ? ' active' : '');
                btn.textContent = t;
                btn.style.cssText = 'pointer-events:all;padding:2px 4px;font-size:10px;' + (_achTier === i ? 'color:#e60808;font-weight:bold;' : '');
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    _achTier = i; _achOffset = 0; _subIdx = 0; _render();
                });
                tabsEl.appendChild(btn);
            });
            el.appendChild(tabsEl);

            // Click on canvas list rows
            canvas.addEventListener('click', function(e) {
                var rect = canvas.getBoundingClientRect();
                var cy = (e.clientY - rect.top) * (160 / rect.height);
                // List rows start at y=26, each 14px tall, 6 visible
                if (cy >= 26 && cy < 26 + 6 * 14) {
                    var row = Math.floor((cy - 26) / 14);
                    var clickedIdx = _achOffset + row;
                    var all2 = window.GameAchievements ? GameAchievements.getAll() : [];
                    var tierKeys2 = [null, 'platinum', 'gold', 'silver', 'bronze'];
                    var filtered2 = _achTier === 0 ? all2 : all2.filter(function(a){return a.tier===tierKeys2[_achTier];});
                    if (clickedIdx >= 0 && clickedIdx < filtered2.length) {
                        _subIdx = clickedIdx; _render();
                    }
                }
            });
        });
    }

    function _drawAchievementsCanvas(ctx, bg) {
        _canvasBg(ctx, bg);
        var S = 2;
        var _tc = _getThemeColors(); var COL_TEXT = _tc.text; var COL_DIM = _tc.dim; var COL_CYAN = _tc.hi;

        var all = window.GameAchievements ? GameAchievements.getAll() : [];
        var totalAP = all.reduce(function(s, a) { return s + (a.unlocked ? a.apReward : 0); }, 0);
        var maxAP   = all.reduce(function(s, a) { return s + a.apReward; }, 0);
        var unlockCount = all.filter(function(a) { return a.unlocked; }).length;

        // Title bar
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 0, GBA_W, 20*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 20*S, GBA_W, 2);

        ctx.textBaseline = 'top';
        ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('ACHIEVEMENT ATLAS', 8*S, 6*S);

        // Total AP right-aligned
        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = COL_CYAN;
        var apStr = totalAP + ' / ' + maxAP + ' AP';
        var apW = ctx.measureText(apStr).width;
        ctx.fillText(apStr, GBA_W - apW - 4*S, 7*S);

        // Filter list
        var tierKeys = [null, 'platinum', 'gold', 'silver', 'bronze'];
        var filtered = _achTier === 0 ? all : all.filter(function(a){return a.tier===tierKeys[_achTier];});

        var LIST_ROWS = 6;
        if (_subIdx < _achOffset) _achOffset = _subIdx;
        if (_subIdx >= _achOffset + LIST_ROWS) _achOffset = _subIdx - LIST_ROWS + 1;
        _achOffset = Math.max(0, Math.min(_achOffset, Math.max(0, filtered.length - LIST_ROWS)));

        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        var listY = 26;
        if (!filtered.length) {
            ctx.fillStyle = COL_DIM;
            ctx.fillText('No achievements in this tier.', 8*S, listY*S);
        } else {
            var visible = filtered.slice(_achOffset, _achOffset + LIST_ROWS);
            visible.forEach(function(a, vi) {
                var absIdx = _achOffset + vi;
                var y = (listY + vi * 14) * S;
                if (absIdx === _subIdx) {
                    ctx.fillStyle = 'rgba(230,8,8,0.12)';
                    ctx.fillRect(0, y, GBA_W, 14*S);
                    ctx.fillStyle = COL_CYAN;
                    ctx.fillRect(0, y, 2*S, 14*S);
                }
                var icon = a.unlocked ? (a.tier === 'platinum' ? 'P' : a.tier === 'gold' ? 'G' : a.tier === 'silver' ? 'S' : 'B') : 'X';
                ctx.fillStyle = a.unlocked ? COL_CYAN : '#888888';
                ctx.fillText('[' + icon + ']', 4*S, y + 3*S);
                ctx.fillStyle = a.unlocked ? COL_TEXT : COL_DIM;
                var nameStr = a.name || '';
                if (nameStr.length > 22) nameStr = nameStr.slice(0, 21) + '…';
                ctx.fillText(nameStr, 24*S, y + 3*S);
                ctx.fillStyle = COL_DIM;
                var apVal = (a.unlocked ? '+' : '') + a.apReward + 'AP';
                var avw = ctx.measureText(apVal).width;
                ctx.fillText(apVal, GBA_W - avw - 4*S, y + 3*S);
            });
        }

        // Scroll indicators
        if (_achOffset > 0) { ctx.fillStyle = COL_CYAN; ctx.font=(7*S)+'px "Press Start 2P", monospace'; ctx.fillText('▲', GBA_W/2 - 4, (listY - 1)*S); }
        if (_achOffset + LIST_ROWS < filtered.length) { ctx.fillStyle = COL_CYAN; ctx.font=(7*S)+'px "Press Start 2P", monospace'; ctx.fillText('▼', GBA_W/2 - 4, (listY + LIST_ROWS*14)*S); }

        // Desc box at bottom (y=112)
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 112*S, GBA_W, 48*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 112*S, GBA_W, 2);

        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        var selAch = filtered[_subIdx];
        if (selAch) {
            ctx.fillStyle = COL_CYAN;
            var title = selAch.name + (selAch.unlocked ? ' [EARNED]' : ' [LOCKED]');
            ctx.fillText(title, 4*S, 115*S);
            ctx.fillStyle = COL_TEXT;
            var desc = selAch.desc || '';
            var words = desc.split(' '), line = '', ly = 126*S;
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            for (var w = 0; w < words.length; w++) {
                var test = line ? line + ' ' + words[w] : words[w];
                if (ctx.measureText(test).width > (GBA_W - 8*S) && line) {
                    ctx.fillText(line, 4*S, ly); line = words[w]; ly += 11*S;
                    if (ly > 154*S) break;
                } else { line = test; }
            }
            if (line) ctx.fillText(line, 4*S, ly);
            ctx.fillStyle = COL_DIM;
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            var meta = (selAch.tier||'').toUpperCase() + '  ' + selAch.apReward + ' AP';
            ctx.fillText(meta, 4*S, 148*S);
        } else {
            ctx.fillStyle = COL_DIM;
            ctx.fillText(unlockCount + ' / ' + all.length + ' earned  ·  ' + totalAP + ' / ' + maxAP + ' AP', 4*S, 120*S);
        }
    }

    // ── Bag pocket data helper ──────────────────────────────────────────────
    // Inventory is stored as {itemKey: quantity} dicts.
    // Item display names are derived from the key.
    var ITEM_NAMES = {
        potion:'Potion', super_potion:'Super Potion', hyper_potion:'Hyper Potion',
        max_potion:'Max Potion', full_restore:'Full Restore', antidote:'Antidote',
        burn_heal:'Burn Heal', awakening:'Awakening', parlyz_heal:'Parlyz Heal',
        ice_heal:'Ice Heal', full_heal:'Full Heal', revive:'Revive',
        poke_ball:'Poké Ball', great_ball:'Great Ball', ultra_ball:'Ultra Ball',
        master_ball:'Master Ball', safari_ball:'Safari Ball',
        nugget:'Nugget', big_nugget:'Big Nugget', pearl:'Pearl', big_pearl:'Big Pearl',
        bicycle:'Bicycle', town_map:'Town Map', super_rod:'Super Rod',
        oran_berry:'Oran Berry', sitrus_berry:'Sitrus Berry', lum_berry:'Lum Berry',
    };
    function _itemName(key) {
        return ITEM_NAMES[key] || key.split('_').map(function(w){return w[0].toUpperCase()+w.slice(1);}).join(' ');
    }
    function _dictToList(dict) {
        if (!dict || typeof dict !== 'object' || Array.isArray(dict)) return [];
        return Object.entries(dict)
            .filter(function(e){ return e[1] > 0; })
            .map(function(e){ return { itemId: e[0], name: _itemName(e[0]), quantity: e[1], desc: '' }; });
    }
    function _getBagPockets() {
        const inv = (window.GameSave && GameSave.state && GameSave.state.inventory)
            ? GameSave.state.inventory : {};
        function pick(key) {
            return _dictToList(inv[key]);
        }
        // EE pocket order — gPocketNamesStringsTable in source/emerald-enhanced/src/strings.c
        return [
            { label: 'Items',       items: pick('items')      },
            { label: 'Medicine',    items: pick('medicine')   },
            { label: 'Valuables',   items: pick('valuables')  },
            { label: 'Poké Balls',  items: pick('pokeBalls')  },
            { label: 'TMs & HMs',   items: pick('tms')        },
            { label: 'Berries',     items: pick('berries')    },
            { label: 'Key Items',   items: pick('keyItems')   },
            { label: 'Mega Stones', items: pick('megaStones') },
        ];
    }

    // ── Canvas bag renderer — 2× GBA resolution (480×320) ──────────────────────
    // EE bag layout (GBA 240×160):
    //   Left panel x=0..111: pocket name row (y=0..7), pocket icons (y=8..15),
    //     big bag sprite (y=16..79), item icon box (y=84..111), description (y=116..159)
    //   Right panel x=112..239: item list box with cyan border
    var BAG_W = 480, BAG_H = 320, BAG_S = 2;
    function _drawBagCanvas(ctx, assets, itemIcon) {
        var POCKETS = _getBagPockets();
        var pocket  = POCKETS[_bagPocket] || POCKETS[0];
        var items   = pocket.items;
        var S = BAG_S;
        var NP = POCKETS.length;

        // EE bag is a light screen — dark text like the original
        var TEXT   = '#383838';
        var DIM    = '#383838';
        var RED    = '#e04828';   // pill arrow red
        var SEL_BG = 'rgba(0,0,0,0.07)';

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, BAG_W, BAG_H);

        // ── EE bag background (assembled from submodule tiles + palette) ─────
        if (assets && assets.bg) {
            ctx.drawImage(assets.bg, 0, 0, BAG_W, BAG_H);
        } else {
            ctx.fillStyle = '#4880f8';
            ctx.fillRect(0, 0, BAG_W, BAG_H);
        }

        // ── Selected pocket icon in the gold circle at top-left ──────────────
        var selIcon = assets && assets.icons && assets.icons[_bagPocket];
        if (selIcon && selIcon.sel) {
            ctx.drawImage(selIcon.sel, 6*S, 11*S, 10*S, 10*S);
        }

        // ── Red ◄ ► arrows at the pill ends (like EE) ────────────────────────
        function pillArrow(x, dir) {
            ctx.fillStyle = RED;
            ctx.beginPath();
            if (dir < 0) {
                ctx.moveTo(x + 6*S, 11*S); ctx.lineTo(x, 15.5*S); ctx.lineTo(x + 6*S, 20*S);
            } else {
                ctx.moveTo(x, 11*S); ctx.lineTo(x + 6*S, 15.5*S); ctx.lineTo(x, 20*S);
            }
            ctx.closePath(); ctx.fill();
        }
        pillArrow(16*S, -1);
        pillArrow(98*S, +1);

        // ── Pocket name centered in the pill (pill interior x=22..98) ────────
        // Text sits directly on the cream pill baked into the EE background.
        // EE's font1 is a small proportional sans — use plain sans-serif.
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#484848';
        ctx.font = (8*S) + 'px Arial, "Helvetica Neue", sans-serif';
        var labelW = ctx.measureText(pocket.label).width;
        ctx.fillText(pocket.label, (60*S) - labelW/2, 12*S);

        // ── Pocket icon row directly under the pill ──────────────────────────
        var iconRowY = 25*S;
        var iconStartX = 24*S;
        for (var i = 0; i < NP; i++) {
            var ix = iconStartX + i * 9*S;
            var icon = assets && assets.icons && assets.icons[i];
            if (icon) {
                var img = (i === _bagPocket) ? icon.sel : icon.unsel;
                if (img) ctx.drawImage(img, ix, iconRowY, 8*S, 8*S);
            }
        }

        // ── Big bag sprite, center-left ──────────────────────────────────────
        var bagFrame = assets && assets.bagFrames && assets.bagFrames[Math.min(_bagPocket, 5)];
        if (bagFrame) {
            ctx.drawImage(bagFrame, 36*S, 38*S, 64*S, 64*S);
        }

        var selItem = items[_subIdx];
        var isClosePack = (!selItem || _subIdx >= items.length);

        // ── Item icon box (white box interior x=5..34, y=71..96) ─────────────
        if (isClosePack) {
            // EE shows a big grey return arrow for Close Pack
            ctx.fillStyle = '#a0a0a8';
            ctx.font = (18*S) + 'px sans-serif';
            ctx.textBaseline = 'top';
            ctx.fillText('↵', 11*S, 72*S);
        } else if (itemIcon) {
            ctx.drawImage(itemIcon, 9*S, 73*S, 22*S, 22*S);
        }

        // ── Description text in the white bottom-left box ────────────────────
        var desc = isClosePack ? 'Return to the field.' : (selItem.desc || selItem.description || '');
        ctx.fillStyle = TEXT;
        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        ctx.textBaseline = 'top';
        var words = desc.split(' '), line = '', lx = 7*S, ly = 107*S, maxW = 94*S, lineH = 10*S;
        for (var w = 0; w < words.length; w++) {
            var test = line ? line + ' ' + words[w] : words[w];
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, lx, ly); line = words[w]; ly += lineH;
                if (ly > 150*S) break;
            } else { line = test; }
        }
        if (line && ly <= 150*S) ctx.fillText(line, lx, ly);

        // ── Item list inside the bg's right panel (x≈108..236, y≈4..156) ─────
        var MAX_VIS = 9;
        var totalRows = items.length + 1; // +1 for Cancel
        var scroll = Math.max(0, Math.min(_subIdx - Math.floor(MAX_VIS/2), totalRows - MAX_VIS));
        if (scroll < 0) scroll = 0;

        ctx.font = (7*S) + 'px "Press Start 2P", monospace';
        ctx.textBaseline = 'top';

        function drawCursor(cx, cy, h) {
            ctx.fillStyle = TEXT; // EE cursor is dark
            ctx.beginPath();
            ctx.moveTo(cx,        cy + 1);
            ctx.lineTo(cx + 5*S,  cy + Math.floor(h/2));
            ctx.lineTo(cx,        cy + h - 1);
            ctx.closePath();
            ctx.fill();
        }

        for (var j = 0; j < MAX_VIS; j++) {
            var idx = scroll + j;
            if (idx > items.length) break;
            var row_y = (8 + j * 16) * S;
            var sel = (idx === _subIdx);

            if (sel) {
                ctx.fillStyle = SEL_BG;
                ctx.fillRect(112*S, row_y - 1*S, 122*S, 15*S);
                drawCursor(113*S, row_y, 13*S);
            }

            if (idx < items.length) {
                var item = items[idx];
                ctx.fillStyle = TEXT;
                ctx.fillText(item.name || item.itemId || '?', 122*S, row_y);
                // EE qty format: lowercase x, number right-aligned
                ctx.fillText('x', 204*S, row_y);
                var qn = String(item.quantity || 1);
                ctx.fillText(qn, 230*S - ctx.measureText(qn).width, row_y);
            } else {
                // EE's cancel entry
                ctx.fillStyle = TEXT;
                ctx.fillText('Close Pack', 122*S, row_y);
            }
        }

        // Scroll arrows
        if (scroll > 0) {
            ctx.fillStyle = RED;
            ctx.beginPath(); ctx.moveTo(168*S, 7*S); ctx.lineTo(172*S, 3*S); ctx.lineTo(176*S, 7*S); ctx.closePath(); ctx.fill();
        }
        if (scroll + MAX_VIS < totalRows) {
            ctx.fillStyle = RED;
            ctx.beginPath(); ctx.moveTo(168*S, 152*S); ctx.lineTo(172*S, 156*S); ctx.lineTo(176*S, 152*S); ctx.closePath(); ctx.fill();
        }
    }

    function _buildBag(el) {
        el.style.cssText = 'padding:0;overflow:hidden;background:none;position:absolute;inset:0;';

        var backBtn = document.createElement('button');
        backBtn.textContent = 'B BACK';
        backBtn.className = 'sm-back-btn';
        backBtn.style.cssText = 'position:absolute;bottom:4px;right:4px;z-index:10;pointer-events:all;';
        backBtn.addEventListener('click', _goBack);
        el.appendChild(backBtn);

        var canvas = document.createElement('canvas');
        canvas.width  = BAG_W;
        canvas.height = BAG_H;
        canvas.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;';
        canvas.style.pointerEvents = 'all';
        el.appendChild(canvas);

        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Touch/click: pocket tabs and item list
        canvas.addEventListener('click', function(e) {
            var rect = canvas.getBoundingClientRect();
            var cx = (e.clientX - rect.left) * (240 / rect.width);
            var cy = (e.clientY - rect.top)  * (160 / rect.height);

            var NP = _getBagPockets().length;

            // Red ◄ ► arrows at the pill ends (wrap like EE)
            if (cy >= 8 && cy < 24 && cx >= 14 && cx < 30) {
                _bagPocket = (_bagPocket - 1 + NP) % NP; _subIdx = 0; _render(); return;
            }
            if (cy >= 8 && cy < 24 && cx >= 92 && cx < 108) {
                _bagPocket = (_bagPocket + 1) % NP; _subIdx = 0; _render(); return;
            }
            // Pocket icon row under the pill: y=25..33, 9px spacing from x=24
            if (cy >= 24 && cy < 35 && cx >= 22 && cx < 22 + NP * 9) {
                var p = Math.floor((cx - 22) / 9);
                if (p >= 0 && p < NP) { _bagPocket = p; _subIdx = 0; _render(); return; }
            }
            // Item list: x=108..236, y=8..152
            if (cx >= 108 && cy >= 8 && cy < 152) {
                var row = Math.floor((cy - 8) / 16);
                var POCKETS = _getBagPockets();
                var items = (POCKETS[_bagPocket] || POCKETS[0]).items;
                var MAX_VIS = 9;
                var scroll = Math.max(0, Math.min(_subIdx - Math.floor(MAX_VIS/2), items.length + 1 - MAX_VIS));
                if (scroll < 0) scroll = 0;
                var itemIdx = scroll + row;
                if (itemIdx >= 0 && itemIdx < items.length) {
                    _subIdx = itemIdx; _render();
                } else if (itemIdx === items.length) {
                    // Tapped Close Pack row — confirm it
                    _subIdx = itemIdx; _confirmSelected();
                }
            }
        });

        el._redraw = function() {
            var POCKETS = _getBagPockets();
            var pocket = POCKETS[_bagPocket] || POCKETS[0];
            var selItem = pocket.items[_subIdx] || null;
            _loadBagAssets(function(a) {
                _loadItemIcon(selItem, function(iconImg) {
                    _drawBagCanvas(ctx, a, iconImg);
                });
            });
        };
        el._redraw();
    }

    // --- Party viewer ---
    var _speciesDb = null;
    function _getSpeciesDb(cb) {
        if (_speciesDb) { cb(_speciesDb); return; }
        fetch('data/pokemon/base_stats.json')
            .then(function(r){ return r.ok ? r.json() : null; })
            .then(function(d){ _speciesDb = d || {}; cb(_speciesDb); })
            .catch(function(){ _speciesDb = {}; cb({}); });
    }

    // num→name map from pokedex + icon image cache
    var _pokedexNumMap = null; // { 4: 'charmander', ... }
    var _monIconCache  = {};   // name → Image|null

    function _getPokedexNumMap(cb) {
        if (_pokedexNumMap) { cb(_pokedexNumMap); return; }
        fetch('data/pokemon/pokedex.json')
            .then(function(r){ return r.ok ? r.json() : {}; })
            .then(function(d){
                _pokedexNumMap = {};
                for (var key in d) {
                    var num = d[key].num;
                    if (num) _pokedexNumMap[num] = key.toLowerCase();
                }
                cb(_pokedexNumMap);
            })
            .catch(function(){ _pokedexNumMap = {}; cb({}); });
    }

    function _speciesName(speciesId, map) {
        if (!speciesId) return null;
        // String speciesId (new format) — use directly
        if (typeof speciesId === 'string') return speciesId.toLowerCase();
        // Numeric speciesId (legacy) — look up via num map
        return map[speciesId] || null;
    }

    function _loadMonIcon(speciesId, cb) {
        _getPokedexNumMap(function(map) {
            var name = _speciesName(speciesId, map);
            if (!name) { cb(null); return; }
            var path = 'data/sprites/pokemon/icons/' + name + '.png';
            if (_monIconCache[path] !== undefined) { cb(_monIconCache[path]); return; }
            var img = new Image();
            img.onload  = function() { _monIconCache[path] = img; cb(img); };
            img.onerror = function() { _monIconCache[path] = null; cb(null); };
            img.src = path;
        });
    }

    // Party action sub-menu state
    var _partyActionMon  = null; // mon object being actioned
    var _partyActionIdx  = -1;   // filled[] index
    var _partyActionSel  = 0;    // cursor row in action menu
    var _partyActionOpen = false;
    var _battlePartyCallback = null; // set when party is opened from battle
    var _battlePartyCancel   = null;

    function _getParty() {
        var party = (window.GameSave && GameSave.state && GameSave.state.party) || [];
        if (!party.some(Boolean)) {
            var base = (window.GameSave && GameSave.DEFAULT_POKEMON) ? GameSave.DEFAULT_POKEMON() : {};
            party = [Object.assign({}, base, {
                speciesId: 'charizard', nickname: 'CHARIZARD', level: 50,
                currentHp: 153, maxHp: 153, nature: 'adamant',
                moves: ['flamethrower', 'air_slash', 'dragon_claw', 'earthquake'],
                ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 },
                evs: { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 },
            }), null, null, null, null, null];
        }
        return party;
    }

    var PARTY_W = 480, PARTY_H = 320, PARTY_S = 2;

    function _buildParty(el) {
        _partyActionOpen = false;
        el.style.cssText = 'padding:0;overflow:hidden;background:none;position:absolute;inset:0;';

        var backBtn = document.createElement('button');
        backBtn.textContent = 'B BACK'; backBtn.className = 'sm-back-btn';
        backBtn.style.cssText = 'position:absolute;bottom:4px;right:4px;z-index:10;pointer-events:all;';
        backBtn.addEventListener('click', _goBack);
        el.appendChild(backBtn);

        var canvas = document.createElement('canvas');
        canvas.width  = PARTY_W; canvas.height = PARTY_H;
        canvas.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;';
        canvas.style.pointerEvents = 'all';
        el.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        var _iconImgs = [];
        var _frontImg = null; // front sprite for slot 0 (transparency-processed)

        // Strip the top-left corner colour (GBA transparent index) from a sprite image.
        // Returns a canvas element usable with drawImage.
        function _stripBg(img) {
            if (!img) return null;
            var oc = document.createElement('canvas');
            oc.width = img.width; oc.height = img.height;
            var ox = oc.getContext('2d');
            ox.imageSmoothingEnabled = false;
            ox.drawImage(img, 0, 0);
            var d = ox.getImageData(0, 0, oc.width, oc.height);
            // Sample top-left pixel as the transparent colour
            var tr = d.data[0], tg = d.data[1], tb = d.data[2];
            // Only strip if the corner is actually opaque (not already transparent)
            if (d.data[3] > 0) {
                for (var i = 0; i < d.data.length; i += 4) {
                    if (d.data[i] === tr && d.data[i+1] === tg && d.data[i+2] === tb) {
                        d.data[i+3] = 0;
                    }
                }
                ox.putImageData(d, 0, 0);
            }
            return oc;
        }

        // Fast redraw — reuses already-loaded images. _loadPartyBg is synchronous once cached.
        function redraw() {
            _loadPartyBg(function(bg) { _drawPartyCanvas(ctx, bg, _iconImgs, _frontImg); });
        }

        function _loadFrontSprite(speciesId, cb) {
            _getPokedexNumMap(function(map) {
                var name = _speciesName(speciesId, map);
                if (!name) { cb(null); return; }
                var path = 'data/sprites/pokemon/front/' + name + '.png';
                var img = new Image();
                img.onload = function() { cb(_stripBg(img)); };
                img.onerror = function() { cb(null); };
                img.src = path;
            });
        }

        function loadIconsAndDraw() {
            var party = _getParty();
            var filled = party.filter(Boolean);
            _iconImgs = new Array(filled.length).fill(null);
            _frontImg = null;
            if (!filled.length) { redraw(); return; }
            var pending = filled.length + 1; // +1 for front sprite
            function done() { if (--pending === 0) redraw(); }
            // Load front sprite for slot 0 (with transparency strip)
            _loadFrontSprite(filled[0].speciesId, function(img) { _frontImg = img; done(); });
            // Load icons — also strip background
            filled.forEach(function(mon, i) {
                _loadMonIcon(mon.speciesId, function(img) { _iconImgs[i] = _stripBg(img); done(); });
            });
        }

        el._redraw = loadIconsAndDraw;
        // Expose fast redraw for action-menu state changes (no image reload needed)
        el._redrawFast = redraw;
        loadIconsAndDraw();

        canvas.addEventListener('click', function(e) {
            var rect = canvas.getBoundingClientRect();
            // Map to GBA coords
            var gx = (e.clientX - rect.left) * (PARTY_W / rect.width)  / PARTY_S;
            var gy = (e.clientY - rect.top)  * (PARTY_H / rect.height) / PARTY_S;
            var filled = _getParty().filter(Boolean);

            // Action menu open — handle its clicks
            if (_partyActionOpen) {
                // Menu is drawn at ax=130, ay=48, rowH=14, rows with 3px top padding
                var ax = 130, ay = 51, aw = 102, rowH = 14;
                var opts = _battlePartyCallback ? ['Switch', 'Cancel'] : ['Details', 'Item', 'Cancel'];
                for (var oi = 0; oi < opts.length; oi++) {
                    var ry = ay + oi * rowH;
                    if (gx >= ax && gx < ax+aw && gy >= ry && gy < ry+rowH) {
                        if (opts[oi] === 'Cancel') {
                            _partyActionOpen = false; redraw();
                        } else if (opts[oi] === 'Switch') {
                            var _pCb2 = _battlePartyCallback;
                            var _pMon2 = _partyActionMon;
                            _battlePartyCallback = null; _battlePartyCancel = null;
                            close();
                            if (_pCb2) _pCb2(_pMon2);
                        } else if (opts[oi] === 'Details') {
                            _partyActionOpen = false;
                            _openPartySummary(_partyActionMon, _partyActionIdx, filled, loadIconsAndDraw);
                        }
                        return;
                    }
                }
                _partyActionOpen = false; redraw(); return;
            }

            // Slot 0 large box: GBA x=8..87, y=8..111
            if (gx >= 8 && gx < 88 && gy >= 8 && gy < 112 && filled[0]) {
                _partyActionMon = filled[0]; _partyActionIdx = 0;
                _partyActionOpen = true; redraw(); return;
            }
            // Slots 1-5 right column: GBA x=96..239
            for (var si = 1; si < 6; si++) {
                var sy = 8 + (si - 1) * 24;
                if (gx >= 96 && gx < 240 && gy >= sy && gy < sy+24 && filled[si]) {
                    _partyActionMon = filled[si]; _partyActionIdx = si;
                    _partyActionOpen = true; redraw(); return;
                }
            }
            // Cancel bar: GBA y=120..159
            if (gy >= 120) { _goBack(); }
        });
    }

    function _openPartySummary(mon, idx, filled, returnCb) {
        var subEl = document.getElementById('start-menu-sub');
        if (!subEl) return;
        // Canvas-full-screen pages replace .sm-sub-overlay, so overlay directly onto subEl
        var overlay = subEl.querySelector('.sm-sub-overlay') || subEl;
        // Remove any existing summary overlay
        var existing = subEl.querySelector('.party-summary-overlay');
        if (existing) existing.remove();
        var win = document.createElement('div');
        win.className = 'sm-win party-summary-overlay';
        win.style.cssText = 'position:absolute;left:3.3%;top:5%;width:90%;height:90%;pointer-events:all;overflow:hidden;z-index:20;';
        subEl.appendChild(win);

        var S = 2;
        var canvas = document.createElement('canvas');
        canvas.width = GBA_W * S; canvas.height = GBA_H * S;
        canvas.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;display:block;';
        win.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        var TABS = ['Profile', 'Skills', 'Battle Moves'];
        var _tab = 0;
        var _frontImg = null;

        // Load front sprite
        _getPokedexNumMap(function(map) {
            var name = _speciesName(mon.speciesId, map);
            if (!name) { drawSummary(); return; }
            var img = new Image();
            img.onload = function() { _frontImg = img; drawSummary(); };
            img.onerror = function() { drawSummary(); };
            img.src = 'data/sprites/pokemon/front/' + name + '.png';
        });

        function drawSummary() {
            var _tc = _getThemeColors();
            var BG = _tc.bg, TITLEBG = _tc.titleBg, CYAN = _tc.hi, TEXT = _tc.text, DIM = _tc.dim;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = BG; ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Title bar
            ctx.fillStyle = TITLEBG; ctx.fillRect(0, 0, canvas.width, 20*S);
            ctx.fillStyle = CYAN; ctx.fillRect(0, 20*S, canvas.width, S);
            ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = CYAN; ctx.textBaseline = 'top';
            ctx.fillText(TABS[_tab].toUpperCase(), 8*S, 4*S);

            // Tab strip (L/R hint)
            ctx.font = (7*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = DIM;
            ctx.fillText('◀ L', 2*S, 4*S);
            ctx.fillText('R ▶', (GBA_W-18)*S, 4*S);

            // Mon name + level bar (top section)
            var barH = 18;
            ctx.fillStyle = '#0a1820'; ctx.fillRect(0, 21*S, canvas.width, barH*S);
            ctx.fillStyle = CYAN; ctx.fillRect(0, (21+barH)*S, canvas.width, S);
            ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = TEXT; ctx.textBaseline = 'top';
            var gStr = mon.gender==='M' ? ' ♂' : mon.gender==='F' ? ' ♀' : '';
            ctx.fillText(_monDisplayName(mon)+gStr, 8*S, 23*S);
            ctx.font = (7*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = DIM;
            var _dexNum = (typeof mon.speciesId === 'number') ? mon.speciesId : ((_pokedexNumMap && Object.keys(_pokedexNumMap).find(function(k){ return _pokedexNumMap[k] === (mon.speciesId||'').toLowerCase(); })) || '?');
            ctx.fillText('No. '+_dexNum, (GBA_W-60)*S, 23*S);
            ctx.fillStyle = TEXT;
            ctx.fillText('Lv.'+(mon.level||1), (GBA_W-28)*S, 23*S);

            // Front sprite (right side all tabs)
            if (_frontImg) {
                ctx.drawImage(_frontImg, (GBA_W-72)*S, 42*S, 64*S, 64*S);
            }

            var lx = 8, ty = 42;
            if (_tab === 0) {
                // Profile: OT / ID / Type / Ability / Nature
                var rows = [
                    ['OT/',       (mon.otName || 'Player')],
                    ['ID No.',    String(mon.otId||'00000').padStart(5,'0')],
                    ['Type',      (mon.type||'Normal')],
                    ['Ability',   (mon.ability||'—')],
                    ['Nature',    (mon.nature||'Hardy')],
                    ['Item',      (mon.heldItem||'None')],
                ];
                ctx.font = (7*S)+'px "Press Start 2P", monospace'; ctx.textBaseline = 'top';
                rows.forEach(function(r, i) {
                    var ry = ty + i*14;
                    ctx.fillStyle = DIM; ctx.fillText(r[0], lx*S, ry*S);
                    ctx.fillStyle = TEXT; ctx.fillText(r[1], (lx+40)*S, ry*S);
                });
                // Caught level
                ctx.fillStyle = DIM; ctx.fillText('Met Lv.', lx*S, (ty+6*14)*S);
                ctx.fillStyle = TEXT; ctx.fillText(String(mon.caughtLevel||mon.level||1), (lx+40)*S, (ty+6*14)*S);
            } else if (_tab === 1) {
                // Skills: Stats + Item/Ribbon/Exp
                var stats = [
                    ['HP',    mon.maxHp||0],
                    ['Atk',   mon.atk||0],
                    ['Def',   mon.def||0],
                    ['Sp.Atk',mon.spAtk||0],
                    ['Sp.Def',mon.spDef||0],
                    ['Speed', mon.speed||0],
                ];
                ctx.font = (7*S)+'px "Press Start 2P", monospace'; ctx.textBaseline = 'top';
                stats.forEach(function(st, i) {
                    var ry = ty + i*13;
                    ctx.fillStyle = DIM; ctx.fillText(st[0], lx*S, ry*S);
                    ctx.fillStyle = TEXT; ctx.fillText(String(st[1]), (lx+36)*S, ry*S);
                    // Small stat bar
                    var barW = 48, barMax = 255;
                    var pct = Math.min(1, st[1]/barMax);
                    var col = st[1] >= 100 ? '#20c840' : st[1] >= 50 ? '#e8c000' : '#e82020';
                    ctx.fillStyle = '#111122'; ctx.fillRect((lx+52)*S, (ry+1)*S, barW*S, 4*S);
                    ctx.fillStyle = col; ctx.fillRect((lx+52)*S, (ry+1)*S, Math.round(pct*barW)*S, 4*S);
                });
                var ey = ty + 6*13 + 4;
                ctx.fillStyle = DIM; ctx.fillText('Exp.', lx*S, ey*S);
                ctx.fillStyle = TEXT; ctx.fillText(String(mon.exp||0), (lx+36)*S, ey*S);
                ctx.fillStyle = DIM; ctx.fillText('Item', lx*S, (ey+13)*S);
                ctx.fillStyle = TEXT; ctx.fillText(mon.heldItem||'None', (lx+36)*S, (ey+13)*S);
            } else {
                // Battle Moves
                ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace'; ctx.textBaseline = 'top';
                ctx.fillStyle = DIM; ctx.fillText('MOVES', lx*S, ty*S);
                var moves = (mon.moves||[]).slice(0,4);
                var moveColors = { Normal:'#a8a878',Fire:'#f08030',Water:'#6890f0',Electric:'#f8d030',
                    Grass:'#78c850',Ice:'#98d8d8',Fighting:'#c03028',Poison:'#a040a0',Psychic:'#f85888' };
                ctx.font = (7*S)+'px "Press Start 2P", monospace';
                moves.forEach(function(mv, i) {
                    var ry = ty + 12 + i*20;
                    if (!mv) {
                        ctx.fillStyle = '#223344';
                        ctx.fillRect(lx*S, ry*S, 110*S, 18*S);
                        ctx.fillStyle = DIM; ctx.fillText('—', (lx+4)*S, (ry+4)*S);
                        return;
                    }
                    var mCol = moveColors[mv.type||'Normal'] || '#a8a878';
                    ctx.fillStyle = '#101828'; ctx.fillRect(lx*S, ry*S, 110*S, 18*S);
                    ctx.strokeStyle = mCol; ctx.lineWidth = S;
                    ctx.strokeRect(lx*S+S/2, ry*S+S/2, 110*S-S, 18*S-S);
                    // Type badge
                    ctx.fillStyle = mCol; ctx.fillRect(lx*S, ry*S, 28*S, 18*S);
                    ctx.fillStyle = '#d5d5bd';
                    ctx.fillText(mv.type||'NRM', (lx+2)*S, (ry+4)*S);
                    // Move name
                    ctx.fillStyle = TEXT;
                    ctx.fillText(typeof mv==='string' ? mv : (mv.name||'???'), (lx+32)*S, (ry+4)*S);
                    // PP
                    var pp = typeof mv === 'object' ? ((mv.pp||'?')+'/'+( mv.maxPp||'?')) : '';
                    if (pp) { ctx.fillStyle = DIM; ctx.fillText('PP '+pp, (lx+32)*S, (ry+12)*S); }
                });
            }

            // Bottom hint bar
            ctx.fillStyle = TITLEBG; ctx.fillRect(0, (GBA_H-12)*S, canvas.width, 12*S);
            ctx.fillStyle = CYAN; ctx.fillRect(0, (GBA_H-12)*S, canvas.width, S);
            ctx.font = (7*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = DIM; ctx.textBaseline = 'top';
            ctx.fillText('B: Back   L/R: Tab', 8*S, (GBA_H-10)*S);
        }

        // Tab navigation via click
        canvas.addEventListener('click', function(e) {
            var rect = canvas.getBoundingClientRect();
            var gx = (e.clientX - rect.left) * (GBA_W / rect.width);
            if (gx < 30) { _tab = (_tab-1+3)%3; drawSummary(); }
            else if (gx > GBA_W-30) { _tab = (_tab+1)%3; drawSummary(); }
        });

        // Expose tab navigation so L/R can be wired if needed
        win._tabLeft  = function() { _tab = (_tab-1+3)%3; drawSummary(); };
        win._tabRight = function() { _tab = (_tab+1)%3; drawSummary(); };

        var backBtn = document.createElement('button');
        backBtn.textContent = 'B BACK'; backBtn.className = 'sm-back-btn';
        backBtn.style.cssText = 'position:absolute;bottom:4px;right:4px;z-index:10;pointer-events:all;';
        backBtn.addEventListener('click', function() {
            win.remove();
            if (returnCb) returnCb();
        });
        win.appendChild(backBtn);
    }

    function _drawPartyCanvas(ctx, bg, iconImgs, frontImg) {
        var S = PARTY_S; // 2
        var _tc = _getThemeColors();
        var COL_TEXT = _tc.text, COL_DIM = _tc.dim, COL_CYAN = _tc.hi;
        var COL_SLOT0  = '#1a3a1a'; // green card for lead Pokémon (EE style)
        var COL_SLOT0S = '#2a5a2a'; // selected lead
        var COL_BOX    = '#101828'; // grey-blue for slots 1-5
        var COL_BOXS   = '#182840'; // selected slot 1-5
        var COL_SEL    = 'rgba(24,184,200,0.15)'; // selection highlight
        var STATUS_COLOR = { PAR:'#e8c000', BRN:'#e85020', PSN:'#a820e8', FRZ:'#18c8e8', SLP:'#888888', FNT:'#e83020' };

        // Green-tinted background (EE party screen is outdoorsy/green)
        ctx.fillStyle = '#0a180a';
        ctx.fillRect(0, 0, PARTY_W, PARTY_H);
        // subtle green gradient overlay on left panel
        var grad = ctx.createLinearGradient(0, 0, 0, PARTY_H);
        grad.addColorStop(0, 'rgba(20,60,20,0.6)');
        grad.addColorStop(1, 'rgba(10,30,10,0.3)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 88*S, PARTY_H);

        var party  = _getParty();
        var filled = party.filter(Boolean);
        ctx.textBaseline = 'top';
        ctx.imageSmoothingEnabled = false;

        // ── Helper: draw a GBA-style slot box
        function drawBox(x, y, w, h, selected, isLead) {
            var bg = isLead ? (selected ? COL_SLOT0S : COL_SLOT0) : (selected ? COL_BOXS : COL_BOX);
            ctx.fillStyle = bg;
            ctx.fillRect(x*S, y*S, w*S, h*S);
            ctx.strokeStyle = selected ? COL_CYAN : '#62737b';
            ctx.lineWidth = S;
            ctx.strokeRect(x*S + S/2, y*S + S/2, w*S - S, h*S - S);
            if (selected) {
                ctx.fillStyle = COL_CYAN;
                ctx.fillRect(x*S, y*S, 2*S, h*S);
            }
        }


        // ── Helper: HP bar  (EE: 48px wide, 3px tall, trough + fill)
        function drawHpBar(x, y, w, pct) {
            var col = pct > 0.5 ? '#20c840' : pct > 0.25 ? '#e8c000' : '#e82020';
            ctx.fillStyle = '#111122';
            ctx.fillRect(x*S, y*S, w*S, 3*S);
            var fill = Math.max(0, Math.round(pct * w));
            ctx.fillStyle = col;
            ctx.fillRect(x*S, y*S, fill*S, 3*S);
            // thin highlight line
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(x*S, y*S, fill*S, S);
        }

        // ── Helper: gender symbol
        function drawGender(g, x, y) {
            if (!g) return;
            ctx.fillStyle = g === 'M' ? '#6890f0' : '#f86888';
            ctx.fillText(g === 'M' ? '♂' : '♀', x*S, y*S);
        }

        // ── Helper: draw one party slot (reused for all 6)
        function _monDisplayName(mon) {
            if (mon.nickname) return mon.nickname;
            if (typeof mon.speciesId === 'string') return mon.speciesId.toUpperCase();
            return '???';
        }

        function drawSlot(mon, iconImg, winX, winY, winW, winH, nickX, nickY, lvX, lvY, genX, genY, hpBarX, hpBarY, hpNumX, hpNumY, iconX, iconY, isLarge, isSel) {
            drawBox(winX, winY, winW, winH, isSel, isLarge);

            if (!mon) {
                ctx.fillStyle = '#223322';
                ctx.font = (7*S)+'px "Press Start 2P", monospace';
                ctx.fillText('Empty', (winX+4)*S, (winY+winH/2-3)*S);
                return;
            }

            var hpPct = mon.maxHp > 0 ? Math.max(0, Math.min(1, (mon.currentHp||0)/mon.maxHp)) : 0;

            // Nickname
            ctx.font = 'bold '+(isLarge ? 14 : 12)*S+'px "Press Start 2P", monospace';
            ctx.fillStyle = COL_TEXT;
            ctx.fillText(_monDisplayName(mon).slice(0, isLarge ? 8 : 10), nickX*S, nickY*S);

            // Level  ("Lv" prefix as in EE)
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillStyle = COL_DIM;
            ctx.fillText('Lv', lvX*S, lvY*S);
            ctx.fillStyle = COL_TEXT;
            ctx.fillText(''+(mon.level||1), (lvX+10)*S, lvY*S);

            // Gender
            ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
            drawGender(mon.gender, genX, genY);

            // HP bar (EE: 48px wide, at hpBarX/Y)
            drawHpBar(hpBarX, hpBarY, 48, hpPct);

            // HP numbers: "NNN/NNN"  (EE draws current right-aligned, "/" , max right-aligned)
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillStyle = COL_TEXT;
            var hpStr = (mon.currentHp||0)+'/\n'+(mon.maxHp||0);
            ctx.fillText((mon.currentHp||0)+'/'+(mon.maxHp||0), hpNumX*S, hpNumY*S);

            // Status badge
            if (mon.statusCondition) {
                ctx.fillStyle = STATUS_COLOR[mon.statusCondition] || '#888';
                ctx.font = (7*S)+'px "Press Start 2P", monospace';
                ctx.fillText('['+mon.statusCondition+']', (winX+2)*S, (winY+winH-8)*S);
            }

            // Pokémon sprite — front sprite for lead (larger), icon for others
            if (iconImg) {
                var sprSz = isLarge ? 40 : 32; // front sprite drawn larger in lead slot
                ctx.drawImage(iconImg, iconX*S, iconY*S, sprSz*S, sprSz*S);
            }
        }

        // ── SLOT 0  (large left box) — use front sprite
        var mon0 = filled[0] || null;
        drawSlot(mon0, frontImg || (iconImgs && iconImgs[0]),
            /*win*/  8, 8, 80, 104,
            /*nick*/ 14, 10,
            /*lv*/   14, 22,
            /*gen*/  60, 22,
            /*hpBar*/14, 34,
            /*hpNum*/14, 40,
            /*icon*/ 4, 52,   // front sprite in lower half of tall slot
            true, _subIdx === 0);

        // ── SLOTS 1–5  (right column strips)
        // Windows: GBA x=96, y=8/32/56/80/104, size 144×24 each
        // Text fields from EE sPartyBoxInfoRects[RIGHT_COLUMN] + window origin (96, slotY):
        //   Nickname rel(22,3)  Level rel(30,12)  Gender rel(62,12)
        //   HP bar rel(88,10) w=48  HP numbers rel(92,12) / rel(112,12)
        // Icon sprite: EE center (104, 18/42/66/90/114) → top-left (88, slotY+2) 32×32
        //   but clipped by the 24px-tall box so draw at y=slotY, h capped — use 20×20
        var slotYs = [8, 32, 56, 80, 104];
        var iconYOffsets = [18, 42, 66, 90, 114]; // EE icon centers for slots 1-5
        for (var i = 0; i < 5; i++) {
            var mon  = filled[i + 1] || null;
            var winY = slotYs[i];
            var icY  = iconYOffsets[i] - 16; // convert center → top-left
            drawSlot(mon, iconImgs && iconImgs[i + 1],
                /*win*/  96, winY, 144, 24,
                /*nick*/ 96+22, winY+3,
                /*lv*/   96+30, winY+12,
                /*gen*/  96+62, winY+12,
                /*hpBar*/96+88, winY+10,
                /*hpNum*/96+92, winY+12,
                /*icon*/ 88, icY,   // EE center x=104 → top-left x=88
                false, _subIdx === (i+1));
        }

        // ── CANCEL button  GBA (192, 136, 48, 16) — no background bar, just the button
        var cancelSel = (_subIdx >= filled.length);
        ctx.fillStyle = cancelSel ? COL_CYAN : _tc.bg;
        ctx.fillRect(192*S, 136*S, 48*S, 16*S);
        ctx.strokeStyle = cancelSel ? COL_CYAN : '#62737b';
        ctx.lineWidth = S;
        ctx.strokeRect(192*S + S/2, 136*S + S/2, 48*S - S, 16*S - S);
        ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = cancelSel ? '#d5d5bd' : COL_TEXT;
        ctx.textBaseline = 'top';
        ctx.fillText('CANCEL', 196*S, 139*S);

        // ── Action sub-menu overlay  (GBA coords: x=130, y=50, w=100, rowH=14)
        if (_partyActionOpen && _partyActionMon) {
            var opts = _battlePartyCallback ? ['Switch', 'Cancel'] : ['Details', 'Item', 'Cancel'];
            var ax = 130, ay = 48, aw = 102, rowH = 14;
            // "Do what with this [Name]?" bar in message area
            ctx.fillStyle = _tc.titleBg;
            ctx.fillRect(0, 120*S, 240*S, 40*S);
            ctx.fillStyle = COL_CYAN;
            ctx.fillRect(0, 120*S, 240*S, S);
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillStyle = COL_TEXT;
            ctx.textBaseline = 'top';
            ctx.fillText('Do what with this', 8*S, 124*S);
            ctx.fillText((_partyActionMon.nickname || (typeof _partyActionMon.speciesId==='string' ? _partyActionMon.speciesId.toUpperCase() : '???')) + '?', 8*S, 134*S);

            ctx.fillStyle = _tc.bg;
            ctx.fillRect(ax*S, ay*S, aw*S, (opts.length*rowH+6)*S);
            ctx.strokeStyle = COL_CYAN; ctx.lineWidth = S;
            ctx.strokeRect(ax*S + S/2, ay*S + S/2, aw*S - S, (opts.length*rowH+6)*S - S);
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            opts.forEach(function(opt, oi) {
                var oy = ay + 3 + oi * rowH;
                if (oi === _partyActionSel) {
                    ctx.fillStyle = COL_SEL;
                    ctx.fillRect(ax*S, oy*S, aw*S, rowH*S);
                    ctx.fillStyle = COL_CYAN;
                    ctx.fillText('▶', (ax+2)*S, oy*S);
                }
                ctx.fillStyle = oi === _partyActionSel ? COL_CYAN : COL_TEXT;
                ctx.fillText(opt, (ax+12)*S, oy*S);
            });
        }
    }

    // --- Pokédex ---
    var _dexDb   = null;   // full pokedex.json
    var _dexList = null;   // array of entries sorted by num
    var _dexEntry = null;  // currently viewed entry

    var TYPE_COLORS = {
        Normal:'#a8a878',Fire:'#f08030',Water:'#6890f0',Electric:'#f8d030',
        Grass:'#78c850',Ice:'#98d8d8',Fighting:'#c03028',Poison:'#a040a0',
        Ground:'#e0c068',Flying:'#a890f0',Psychic:'#f85888',Bug:'#a8b820',
        Rock:'#b8a038',Ghost:'#705898',Dragon:'#7038f8',Dark:'#705848',
        Steel:'#b8b8d0',
    };

    function _loadDex(cb) {
        if (_dexDb) { cb(_dexDb); return; }
        fetch('data/pokemon/pokedex.json')
            .then(function(r){ return r.ok ? r.json() : {}; })
            .then(function(d){
                _dexDb = d;
                _dexList = Object.values(d).sort(function(a,b){ return a.num - b.num; });
                cb(_dexDb);
            })
            .catch(function(){ _dexDb = {}; _dexList = []; cb({}); });
    }

    function _buildPokedex(el) {
        if (!_dexList) {
            _makeCanvasShell(el, function(ctx) {
                _canvasBg(ctx, null);
                ctx.textBaseline = 'top';
                ctx.font = '16px "Press Start 2P", monospace';
                ctx.fillStyle = '#b4b4b4';
                ctx.fillText('Loading Pokedex...', 20, 60);
            });
            _loadDex(function(){ _render(); });
            return;
        }

        var shell = _makeCanvasShell(el, function(ctx, canvas) {
            _loadPokedexBg(function(bg) {
                _drawPokedexCanvas(ctx, bg);
            });
            canvas.addEventListener('click', function(e) {
                var rect = canvas.getBoundingClientRect();
                var cy = (e.clientY - rect.top) * (160 / rect.height);
                // rows start at y=24, 14px each, 9 visible
                if (cy >= 24 && cy < 24 + 9*14 && _dexList) {
                    var WIN = 9;
                    var start = Math.max(0, _subIdx - Math.floor(WIN/2));
                    var row = Math.floor((cy - 24) / 14);
                    var clickedIdx = start + row;
                    if (clickedIdx >= 0 && clickedIdx < _dexList.length) {
                        _subIdx = clickedIdx;
                        var _clkSaved = window.GameSave && GameSave.state && GameSave.state.pokedex;
                        var _clkSeen  = new Set((_clkSaved && _clkSaved.seen) || []);
                        if (_clkSeen.has(_dexList[clickedIdx].num)) {
                            _dexEntry = _dexList[clickedIdx];
                            page = 'pokedex_entry'; _subIdx = 0;
                        }
                        _render();
                    }
                }
            });
        });
    }

    function _drawPokedexCanvas(ctx, bg) {
        _canvasBg(ctx, bg);
        var S = 2;
        var _tc = _getThemeColors(); var COL_TEXT = _tc.text; var COL_DIM = _tc.dim; var COL_CYAN = _tc.hi;

        // Title bar
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 0, GBA_W, 20*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 20*S, GBA_W, 2);
        ctx.textBaseline = 'top';
        ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('POKEDEX', 8*S, 5*S);

        if (!_dexList || !_dexList.length) {
            ctx.fillStyle = COL_DIM;
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillText('No data loaded.', 8*S, 40*S);
            return;
        }

        var saved = window.GameSave && GameSave.state && GameSave.state.pokedex;
        var seen   = new Set((saved && saved.seen)   || []);
        var caught = new Set((saved && saved.caught) || []);

        var WIN = 9;
        var start = Math.max(0, _subIdx - Math.floor(WIN/2));
        if (start + WIN > _dexList.length) start = Math.max(0, _dexList.length - WIN);
        var end = Math.min(_dexList.length, start + WIN);

        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        ctx.textBaseline = 'middle';
        for (var relI = 0; relI < end - start; relI++) {
            var absI = start + relI;
            var entry = _dexList[absI];
            var rowTop = (24 + relI * 14) * S;
            var rowMid = rowTop + 7*S;
            var isSel = absI === _subIdx;
            var hasSeen = seen.has(entry.num);
            var hasCaught = caught.has(entry.num);

            if (isSel) {
                ctx.fillStyle = 'rgba(230,8,8,0.12)';
                ctx.fillRect(0, rowTop, GBA_W, 14*S);
                ctx.fillStyle = COL_CYAN;
                ctx.fillRect(0, rowTop, 2*S, 14*S);
            }

            // Arrow
            ctx.fillStyle = isSel ? COL_CYAN : 'transparent';
            ctx.fillText('▶', 2*S, rowMid);

            // Dex num
            ctx.fillStyle = '#ffffff';
            ctx.fillText(String(entry.num).padStart(3,'0'), 10*S, rowMid);

            // Caught dot
            if (hasCaught) {
                ctx.fillStyle = COL_CYAN;
                ctx.fillText('●', 218*S, rowMid);
            } else if (hasSeen) {
                ctx.fillStyle = '#888899';
                ctx.fillText('○', 218*S, rowMid);
            }

            // Name — white if seen, ??? if not
            ctx.fillStyle = '#ffffff';
            ctx.fillText(hasSeen ? entry.name : '???', 36*S, rowMid);

            // Type tags (seen only)
            if (hasSeen && entry.types) {
                var tx = 110*S;
                for (var ti = 0; ti < Math.min(2, entry.types.length); ti++) {
                    var tname = entry.types[ti];
                    var tcol = TYPE_COLORS[tname] || '#888888';
                    var tw = ctx.measureText(tname).width + 4*S;
                    ctx.fillStyle = tcol;
                    ctx.fillRect(tx, rowTop + 2*S, tw, 10*S);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(tname, tx + 2*S, rowMid);
                    tx += tw + 2*S;
                }
            }
        }

        // Scroll hint
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 153*S, GBA_W, 7*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 153*S, GBA_W, 1);
        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = COL_DIM;
        ctx.fillText((_subIdx+1) + ' / ' + _dexList.length, 4*S, 154*S);
        if (start > 0) { ctx.fillStyle = COL_CYAN; ctx.font=(7*S)+'px "Press Start 2P", monospace'; ctx.fillText('▲', GBA_W-12*S, 22*S); }
        if (end < _dexList.length) { ctx.fillStyle = COL_CYAN; ctx.font=(7*S)+'px "Press Start 2P", monospace'; ctx.fillText('▼', GBA_W-12*S, 150*S); }
    }

    function _buildPokedexEntry(el) {
        var entry = _dexEntry;
        if (!entry) return;

        var keyName = _dexDb ? (Object.keys(_dexDb).find(function(k){ return _dexDb[k] === entry; }) || entry.name.toLowerCase()) : entry.name.toLowerCase();

        var shell = _makeCanvasShell(el, function(ctx, canvas) {
            _drawPokedexEntryCanvas(ctx, entry, keyName, null);

            // Load front sprite as image for drawing
            var spriteImg = new Image();
            spriteImg.onload = function() { _drawPokedexEntryCanvas(ctx, entry, keyName, spriteImg); };
            spriteImg.onerror = function() { /* no sprite */ };
            spriteImg.src = 'data/sprites/pokemon/front/' + keyName + '.png';

            // Tab buttons
            var tabsEl = document.createElement('div');
            tabsEl.style.cssText = 'position:absolute;top:72px;left:96px;display:flex;gap:2px;z-index:10;pointer-events:all;';
            ['Info','Stats','Moves'].forEach(function(t, i) {
                var btn = document.createElement('button');
                btn.className = 'sm-back-btn' + (_subIdx === i ? ' active' : '');
                btn.textContent = t;
                btn.style.cssText = 'pointer-events:all;padding:2px 6px;font-size:10px;' + (_subIdx === i ? 'color:#e60808;font-weight:bold;' : '');
                btn.addEventListener('click', function(e) { e.stopPropagation(); _subIdx = i; _render(); });
                tabsEl.appendChild(btn);
            });
            el.appendChild(tabsEl);
        });
    }

    function _drawPokedexEntryCanvas(ctx, entry, keyName, spriteImg) {
        _canvasBg(ctx, null);
        var S = 2;
        var _tc = _getThemeColors(); var COL_TEXT = _tc.text; var COL_DIM = _tc.dim; var COL_CYAN = _tc.hi;

        ctx.textBaseline = 'top';

        // Title bar
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 0, GBA_W, 20*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 20*S, GBA_W, 2);
        ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('POKEDEX', 8*S, 5*S);

        // Sprite area (left): 0..79, y=22..87 (GBA px: 0..79px, 22..87px)
        if (spriteImg) {
            ctx.drawImage(spriteImg, 0, 22*S, 80*S, 66*S);
        } else {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 22*S, 80*S, 66*S);
            ctx.fillStyle = COL_DIM;
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillText('No sprite', 4*S, 50*S);
        }

        // Info right side: x=82..239, y=22
        ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = COL_TEXT;
        ctx.fillText(entry.name, 84*S, 24*S);
        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = COL_DIM;
        ctx.fillText('#' + String(entry.num).padStart(3,'0'), 84*S, 34*S);
        ctx.fillText(entry.category || '', 84*S, 44*S);

        // Types
        if (entry.types) {
            var tx = 84*S;
            entry.types.forEach(function(t) {
                var tcol = TYPE_COLORS[t] || '#888888';
                var tw = ctx.measureText(t).width + 4*S;
                ctx.fillStyle = tcol;
                ctx.fillRect(tx, 55*S, tw, 10*S);
                ctx.fillStyle = '#ffffff';
                ctx.font = (7*S)+'px "Press Start 2P", monospace';
                ctx.fillText(t, tx + 2*S, 56*S);
                tx += tw + 2*S;
            });
        }

        // Tabs row area at y=74 (buttons overlaid via HTML, just draw separator)
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(80*S, 68*S, GBA_W - 80*S, 22*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(80*S, 90*S, GBA_W - 80*S, 2);

        // Body below y=92
        var bodyY = 92;

        if (_subIdx === 0) {
            // Info tab
            var h = entry.height_m || 0, w = entry.weight_kg || 0;
            var ft = Math.floor(h / 0.3048), inch = Math.round((h / 0.3048 - ft) * 12);
            var lbs = Math.round(w * 2.205 * 10) / 10;
            var rows = [
                ['Height',     h + 'm (' + ft + '\'' + inch + '")'],
                ['Weight',     w + 'kg (' + lbs + ' lbs)'],
                ['Catch Rate', String(entry.catch_rate || 0)],
                ['Exp Rate',   (entry.exp_rate||'').replace('EXP_RATE_','').toLowerCase().replace(/_/g,' ')],
                ['Egg Groups', (entry.egg_groups||[]).join(', ')],
            ];
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            rows.forEach(function(r, i) {
                var ry = (bodyY + i * 12) * S;
                ctx.fillStyle = COL_DIM;  ctx.fillText(r[0], 4*S, ry);
                ctx.fillStyle = COL_TEXT; ctx.fillText(r[1], 80*S, ry);
            });
            // Dex entry text wrapped
            var desc = entry.entry || '';
            var words = desc.split(' '), line = '', ly = (bodyY + rows.length * 12 + 4) * S;
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillStyle = COL_DIM;
            for (var wi = 0; wi < words.length; wi++) {
                var test2 = line ? line + ' ' + words[wi] : words[wi];
                if (ctx.measureText(test2).width > (GBA_W - 8*S) && line) {
                    ctx.fillText(line, 4*S, ly); line = words[wi]; ly += 10*S;
                    if (ly > 154*S) break;
                } else { line = test2; }
            }
            if (line && ly <= 154*S) ctx.fillText(line, 4*S, ly);

            // Evolutions
            if (entry.evolutions && entry.evolutions.length) {
                var evoY = Math.min(ly + 14*S, 138*S);
                ctx.fillStyle = COL_CYAN;
                ctx.font = (7*S)+'px "Press Start 2P", monospace';
                ctx.fillText('Evolves into:', 4*S, evoY);
                entry.evolutions.slice(0, 2).forEach(function(evo, ei) {
                    var method = (evo.method||'').replace('EVO_','').replace(/_/g,' ').toLowerCase();
                    ctx.fillStyle = COL_TEXT;
                    ctx.fillText(evo.into.toUpperCase() + ' — ' + method + (evo.param ? ' '+evo.param : ''), 4*S, evoY + (ei+1)*10*S);
                });
            }

        } else if (_subIdx === 1) {
            // Stats tab
            var stats = entry.stats || {};
            var STAT_NAMES = [['hp','HP'],['atk','Attack'],['def','Defense'],['spa','Sp.Atk'],['spd','Sp.Def'],['spe','Speed']];
            var STAT_COLORS2 = {hp:'#f04040',atk:'#f08030',def:'#f8d030',spa:'#6890f0',spd:'#78c850',spe:'#f85888'};
            var total = 0;
            STAT_NAMES.forEach(function(kv, i) {
                var k = kv[0], label = kv[1];
                var val = stats[k] || 0;
                total += val;
                var ry = (bodyY + i * 10) * S;
                var pct = Math.min(1, val / 255);
                ctx.font = (7*S)+'px "Press Start 2P", monospace';
                ctx.fillStyle = COL_DIM;  ctx.fillText(label, 4*S, ry);
                ctx.fillStyle = COL_TEXT; ctx.fillText(String(val), 60*S, ry);
                // bar
                ctx.fillStyle = '#1a1a2e'; ctx.fillRect(80*S, ry, 150*S, 7*S);
                ctx.fillStyle = STAT_COLORS2[k]; ctx.fillRect(80*S, ry, Math.round(pct * 150)*S, 7*S);
            });
            ctx.fillStyle = COL_CYAN;
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillText('Total: ' + total, 4*S, (bodyY + STAT_NAMES.length * 10 + 4)*S);

        } else {
            // Moves tab
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillStyle = COL_DIM;
            ctx.fillText('Loading moves...', 4*S, bodyY*S);
            var fullEntry2 = _dexDb ? _dexDb[keyName] : null;
            var learnset2 = fullEntry2 && fullEntry2.learnset;
            if (learnset2) {
                ctx.clearRect(0, bodyY*S, GBA_W, (160 - bodyY)*S);
                ctx.fillStyle = _tc.bg; ctx.fillRect(0, bodyY*S, GBA_W, (160 - bodyY)*S);
                var lvl2 = learnset2.level_up || [];
                lvl2.slice(0, 10).forEach(function(m, i) {
                    var ry = (bodyY + i * 10) * S;
                    ctx.fillStyle = COL_DIM;  ctx.fillText('Lv.'+m[0], 4*S, ry);
                    ctx.fillStyle = COL_TEXT;
                    var mname = m[1].replace('MOVE_','').replace(/_/g,' ').toLowerCase().replace(/\b\w/g, function(c){return c.toUpperCase();});
                    ctx.fillText(mname, 40*S, ry);
                });
            }
        }
    }

    // --- Pokénav Map tab ---
    var _pokenavMapWin = null;

    function _openPokenavMap() {
        if (_pokenavMapWin) return;
        var screen = document.getElementById('screen-primary');
        if (!screen) return;

        var win = document.createElement('div');
        win.style.cssText = 'position:absolute;inset:0;z-index:200;background:#f8f8e0;display:flex;flex-direction:column;font-family:monospace;';
        _pokenavMapWin = win;
        screen.appendChild(win);

        var canvas = document.createElement('canvas');
        canvas.width  = 480; canvas.height = 320;
        canvas.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated;';
        win.appendChild(canvas);

        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        function draw() {
            var S = 2;
            var st   = window.GameSave && GameSave.state;
            var region  = (window.GameMap && GameMap.region) || (st && st.currentLocation && st.currentLocation.region) || 'kanto';
            var mapName = (window.GameMap && GameMap.current && GameMap.current.name) || '—';

            // Background gradient
            var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, '#060c14');
            grad.addColorStop(1, '#0a1820');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Title bar
            ctx.fillStyle = '#ee3100';
            ctx.fillRect(0, 0, canvas.width, 20*S);
            ctx.fillStyle = '#ee3100';
            ctx.fillRect(0, 20*S, canvas.width, 2);
            ctx.textBaseline = 'top'; ctx.fillStyle = '#ee3100';
            ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
            ctx.fillText('POKENAV — MAP', 8*S, 5*S);

            // Region name
            ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = '#ffffff';
            ctx.fillText(region.charAt(0).toUpperCase()+region.slice(1)+' Region', 8*S, 30*S);

            // Map area visualization — draw a simple schematic grid
            var REGIONS_INFO = {
                kanto:     { color:'#3a6a3a', label:'KANTO' },
                hoenn:     { color:'#2a4a6a', label:'HOENN' },
                johto:     { color:'#5a3a2a', label:'JOHTO' },
                heartgold: { color:'#5a3a2a', label:'JOHTO' },
                sinnoh:    { color:'#2a2a5a', label:'SINNOH' },
            };
            var ri = REGIONS_INFO[region] || REGIONS_INFO.kanto;

            // Draw region box
            var bx=8, by=50, bw=140, bh=80;
            ctx.fillStyle = ri.color+'44';
            ctx.fillRect(bx*S, by*S, bw*S, bh*S);
            ctx.strokeStyle = '#e60808'; ctx.lineWidth = 2;
            ctx.strokeRect(bx*S, by*S, bw*S, bh*S);

            // Region label
            ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = '#ee3100';
            ctx.fillText(ri.label, (bx+4)*S, (by+4)*S);

            // Player position indicator — pulsing dot in center
            var px = (bx + bw/2), py = (by + bh/2);
            ctx.fillStyle = '#ffff40';
            ctx.beginPath();
            ctx.arc(px*S, py*S, 5*S, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = S;
            ctx.stroke();

            // Current map name below dot
            ctx.font = (7*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(mapName, px*S, (py+8)*S);
            ctx.textAlign = 'left';

            // Visited maps count
            var visited = st && st.visitedMaps ? (st.visitedMaps instanceof Set ? st.visitedMaps.size : st.visitedMaps.length) : 0;
            ctx.font = (7*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = '#181818';
            ctx.fillText('Maps visited: '+visited, 8*S, 140*S);

            // Coordinates
            if (window.GameMap) {
                // We don't store player coords in save, but we can read from the game
                var cLoc = st && st.currentLocation;
                if (cLoc) ctx.fillText('Area: '+cLoc.region+'  '+cLoc.mapName, 8*S, 152*S);
            }

            // Bottom bar
            ctx.fillStyle = '#ee3100'; ctx.fillRect(0, 148*S, canvas.width, 12*S);
            ctx.fillStyle = '#ee3100'; ctx.fillRect(0, 148*S, canvas.width, 1);
            ctx.font = (7*S)+'px "Press Start 2P", monospace'; ctx.fillStyle = '#6090a8';
            ctx.fillText('B: Back', 8*S, 150*S);
        }

        draw();

        var backBtn = document.createElement('button');
        backBtn.className = 'sm-back-btn';
        backBtn.textContent = 'B BACK';
        backBtn.style.cssText = 'position:absolute;bottom:4px;right:4px;z-index:10;pointer-events:all;';
        backBtn.addEventListener('click', function() {
            win.remove();
            _pokenavMapWin = null;
        });
        win.appendChild(backBtn);

        // B key to close
        function _onKey(e) {
            if (e.key === 'Escape' || e.key === 'x' || e.key === 'X' || e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                win.remove(); _pokenavMapWin = null;
                document.removeEventListener('keydown', _onKey);
            }
        }
        document.addEventListener('keydown', _onKey);
    }

    function _buildPokenav(el) {
        var shell = _makeCanvasShell(el, function(ctx, canvas) {
            _drawPokenavCanvas(ctx);
            canvas.addEventListener('click', function(e) {
                var rect = canvas.getBoundingClientRect();
                var cy = (e.clientY - rect.top) * (160 / rect.height);
                var OPTIONS = ['Map','Condition','Ribbons','Match Call','Close'];
                // rows at y=40+i*18, height 16px
                for (var i = 0; i < OPTIONS.length; i++) {
                    var ry = 40 + i * 18;
                    if (cy >= ry && cy < ry + 16) {
                        _subIdx = i;
                        if (i === 4) _goBack();
                        else _render();
                        return;
                    }
                }
            });
        });
    }

    function _drawPokenavCanvas(ctx) {
        _canvasBg(ctx, null);
        var S = 2;
        var _tc = _getThemeColors(); var COL_TEXT = _tc.text; var COL_DIM = _tc.dim; var COL_CYAN = _tc.hi;

        // Title bar
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 0, GBA_W, 36*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 36*S, GBA_W, 2);

        ctx.textBaseline = 'top';
        ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = COL_CYAN;
        ctx.fillText('POKENAV', 8*S, 8*S);
        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('Navigation System', 8*S, 24*S);

        // Menu options
        var OPTIONS = [
            { label:'Map',        hint:'View the region map' },
            { label:'Condition',  hint:'Check Pokemon condition' },
            { label:'Ribbons',    hint:'View collected ribbons' },
            { label:'Match Call', hint:'Call registered trainers' },
            { label:'Close',      hint:'Close the Pokenav' },
        ];

        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        OPTIONS.forEach(function(opt, i) {
            var ry = (40 + i * 18) * S;
            var isSel = i === _subIdx;
            if (isSel) {
                ctx.fillStyle = 'rgba(230,8,8,0.12)';
                ctx.fillRect(0, ry, GBA_W, 16*S);
                ctx.fillStyle = COL_CYAN;
                ctx.fillRect(0, ry, 2*S, 16*S);
            }
            ctx.fillStyle = isSel ? COL_CYAN : COL_TEXT;
            ctx.fillText((isSel ? '▶ ' : '  ') + opt.label, 4*S, ry + 3*S);
        });

        // Help bar at bottom
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 148*S, GBA_W, 12*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 148*S, GBA_W, 1);
        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = COL_DIM;
        var curHint = OPTIONS[_subIdx] ? OPTIONS[_subIdx].hint : '';
        ctx.fillText(curHint, 4*S, 150*S);
    }

    function _buildSave(el) {
        var shell = _makeCanvasShell(el, function(ctx, canvas) {
            _drawSaveCanvas(ctx);
            canvas.addEventListener('click', function(e) {
                var rect = canvas.getBoundingClientRect();
                var cy = (e.clientY - rect.top) * (160 / rect.height);
                // Save row at y=100..115, Load row at y=118..133
                if (cy >= 100 && cy < 116) { _subIdx = 0; _doSaveAction('save'); }
                else if (cy >= 118 && cy < 134) { _subIdx = 1; _doSaveAction('load'); }
            });
        });
    }

    function _drawSaveCanvas(ctx) {
        _canvasBg(ctx, null);
        var S = 2;
        var _tc = _getThemeColors(); var COL_TEXT = _tc.text; var COL_DIM = _tc.dim; var COL_CYAN = _tc.hi;

        // Title bar
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 0, GBA_W, 20*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 20*S, GBA_W, 2);
        ctx.textBaseline = 'top';
        ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('SAVE', 8*S, 5*S);

        // Info box
        var dexCount = (window.GameSave && GameSave.state && GameSave.state.pokedex)
            ? (GameSave.state.pokedex.caught || []).length : 0;

        ctx.font = (7*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = COL_CYAN;
        ctx.fillText(_mapName(), 8*S, 28*S);

        var infoRows = [
            ['Player:', _playerName()],
            ['Badges:', String(_badges())],
            ['Pokedex:', String(dexCount)],
            ['Time:', _playtime()],
        ];
        infoRows.forEach(function(r, i) {
            var ry = (42 + i * 14) * S;
            ctx.fillStyle = COL_DIM;  ctx.fillText(r[0], 8*S, ry);
            ctx.fillStyle = COL_TEXT; ctx.fillText(r[1], 80*S, ry);
        });

        // Divider
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(8*S, 100*S, (GBA_W - 16*S), 1);

        // Action rows
        var ACTIONS = [['Save Game', 0], ['Load Game', 1]];
        ACTIONS.forEach(function(a) {
            var label = a[0], idx = a[1];
            var ry = (104 + idx * 18) * S;
            var isSel = idx === _subIdx;
            if (isSel) {
                ctx.fillStyle = 'rgba(230,8,8,0.12)';
                ctx.fillRect(0, ry, GBA_W, 14*S);
                ctx.fillStyle = COL_CYAN;
                ctx.fillRect(0, ry, 2*S, 14*S);
            }
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillStyle = isSel ? COL_CYAN : COL_TEXT;
            ctx.fillText((isSel ? '▶ ' : '  ') + label, 8*S, ry + 2*S);
        });

        if (_saveDone) {
            ctx.fillStyle = '#20d840';
            ctx.font = (7*S)+'px "Press Start 2P", monospace';
            ctx.fillText('Game saved!', 8*S, 142*S);
        }
    }

    function _doSaveAction(id) {
        if (id==='save') {
            _saveDone=false;
            if (window.GameSave) GameSave.save(GameSave.currentSlot||0);
            setTimeout(function(){_saveDone=true;_render();},500);
            _render();
        } else if (id==='load') {
            if (window.GameSave) GameSave.load(GameSave.currentSlot||0);
            close();
        }
    }

    function _buildOptions(el) {
        // Options uses a canvas background with HTML interactive rows overlaid
        el.style.cssText = 'padding:0;overflow:hidden;background:none;position:absolute;inset:0;';

        var backBtn = document.createElement('button');
        backBtn.textContent = 'B BACK';
        backBtn.className = 'sm-back-btn';
        backBtn.style.cssText = 'position:absolute;bottom:4px;right:4px;z-index:10;pointer-events:all;';
        backBtn.addEventListener('click', _goBack);
        el.appendChild(backBtn);

        // Canvas background
        var canvas = document.createElement('canvas');
        canvas.width = GBA_W; canvas.height = GBA_H;
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;pointer-events:none;';
        el.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        _drawOptionsCanvasBg(ctx);

        // Scrollable options HTML overlay on top
        var scrollDiv = document.createElement('div');
        scrollDiv.style.cssText = 'position:absolute;top:20px;left:0;right:0;bottom:24px;overflow-y:auto;pointer-events:all;';
        el.appendChild(scrollDiv);

        var savedScale      = parseFloat(localStorage.getItem('pokemon_control_scale')||'1');
        var currentOrient   = window.GameLayout ? GameLayout.getOrientationPref() : 'auto';
        var savedTextSpeed  = localStorage.getItem('pokemon_text_speed')   || 'MED';
        var savedBScene     = localStorage.getItem('pokemon_battle_scene') || 'ON';
        var savedForceSet   = localStorage.getItem('pokemon_force_set')    || 'OFF';
        var savedDmgNums    = localStorage.getItem('pokemon_damage_nums')  || 'ON';
        var savedThemeUI    = localStorage.getItem('pokemon_theme_ui')     || 'MODERN';
        var savedTheme      = localStorage.getItem('pokemon_theme')        || 'DARK';
        var savedFrame      = parseInt(localStorage.getItem('pokemon_frame')    || '1');
        var savedThemeBall  = parseInt(localStorage.getItem('pokemon_theme_ball')|| '1');
        var savedRandMusic  = localStorage.getItem('pokemon_random_music') || 'OFF';
        var savedDisMusic   = localStorage.getItem('pokemon_disable_music')|| 'OFF';
        var savedBarSpeed   = parseInt(localStorage.getItem('pokemon_bar_speed') || '5');
        var savedTransition = localStorage.getItem('pokemon_transition')   || 'ON';
        var savedLvCap      = localStorage.getItem('pokemon_lv_cap')       || 'OFF';
        var savedAutoRun    = localStorage.getItem('pokemon_auto_run')     || 'OFF';
        var savedTrSlide    = localStorage.getItem('pokemon_trainer_slide')|| 'ON';
        var savedAutosave   = localStorage.getItem('pokemon_autosave_int') || '15s';
        var savedControls   = (window.GameControls && GameControls.getMode && GameControls.getMode()) || 'dpad';

        var list = document.createElement('div');
        list.className = 'opt-list';
        list.style.cssText = 'background:transparent;';
        scrollDiv.appendChild(list);

        var rowIndex = 0;

        function makeToggleRow(label, opts, currentVal, onChange) {
            var myIdx = rowIndex++;
            var row = document.createElement('div');
            row.className = 'opt-row' + (_subIdx === myIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            var lbl = document.createElement('span');
            lbl.className = 'opt-label';
            lbl.textContent = label;
            var valWrap = document.createElement('span');
            valWrap.className = 'opt-val-wrap';
            opts.forEach(function(o) {
                var btn = document.createElement('button');
                btn.className = 'sm-opt-btn' + (o === currentVal ? ' active' : '');
                btn.textContent = o;
                btn.style.pointerEvents = 'all';
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    valWrap.querySelectorAll('.sm-opt-btn').forEach(function(b){b.classList.remove('active');});
                    btn.classList.add('active');
                    onChange(o);
                });
                valWrap.appendChild(btn);
            });
            row.appendChild(lbl);
            row.appendChild(valWrap);
            row.addEventListener('click', function(){_subIdx=myIdx;_render();});
            return row;
        }

        function makeNumberRow(label, key, cur, min2, max2) {
            var myIdx = rowIndex++;
            var row = document.createElement('div');
            row.className = 'opt-row' + (_subIdx === myIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            var lbl = document.createElement('span');
            lbl.className = 'opt-label';
            lbl.textContent = label;
            var valWrap = document.createElement('span');
            valWrap.className = 'opt-val-wrap';
            var decBtn = document.createElement('button');
            decBtn.className = 'sm-opt-btn';
            decBtn.textContent = '◀';
            decBtn.style.pointerEvents = 'all';
            var numEl = document.createElement('span');
            numEl.className = 'opt-num-val';
            numEl.textContent = String(cur);
            var incBtn = document.createElement('button');
            incBtn.className = 'sm-opt-btn';
            incBtn.textContent = '▶';
            incBtn.style.pointerEvents = 'all';
            function updateNum(delta) {
                var v = parseInt(numEl.textContent) + delta;
                v = Math.max(min2, Math.min(max2, v));
                numEl.textContent = String(v);
                localStorage.setItem(key, String(v));
            }
            decBtn.addEventListener('click', function(e){e.stopPropagation();updateNum(-1);});
            incBtn.addEventListener('click', function(e){e.stopPropagation();updateNum(1);});
            valWrap.appendChild(decBtn);
            valWrap.appendChild(numEl);
            valWrap.appendChild(incBtn);
            row.appendChild(lbl);
            row.appendChild(valWrap);
            row.addEventListener('click', function(){_subIdx=myIdx;_render();});
            return row;
        }

        // EE option_menu.c: 18 items in order
        list.appendChild(makeToggleRow('Text Speed',      ['SLOW','MED','FAST'],         savedTextSpeed, function(v){localStorage.setItem('pokemon_text_speed',v);}));
        list.appendChild(makeToggleRow('Battle Scene',    ['ON','OFF'],                  savedBScene,    function(v){localStorage.setItem('pokemon_battle_scene',v);}));
        list.appendChild(makeToggleRow('Force Set Battle',['ON','OFF'],                  savedForceSet,  function(v){localStorage.setItem('pokemon_force_set',v);}));
        list.appendChild(makeToggleRow('Damage Numbers',  ['ON','OFF'],                  savedDmgNums,   function(v){localStorage.setItem('pokemon_damage_nums',v);}));
        list.appendChild(makeToggleRow('Theme UI',        ['MODERN','CLASSIC','VANILLA'],savedThemeUI,   function(v){localStorage.setItem('pokemon_theme_ui',v); _bagAssets=null; _applyThemeCSS(); _render();}));
        list.appendChild(makeToggleRow('Theme',           ['DARK','LIGHT','VANILLA','USER'],savedTheme,  function(v){localStorage.setItem('pokemon_theme',v); localStorage.removeItem('pokemon_theme_preset'); _bagAssets=null; _applyThemeCSS(); _render();}));
        // Theme Presets — matches EE's PRESETTHEME_* values from custom_interface.c
        list.appendChild(makeToggleRow('Preset',
            ['None','BlueSteel','RoyalPurple','Synthwave','Mocha'],
            localStorage.getItem('pokemon_theme_preset') || 'None',
            function(v) {
                if (v === 'None') localStorage.removeItem('pokemon_theme_preset');
                else localStorage.setItem('pokemon_theme_preset', v);
                // Presets force USER theme mode like EE's ApplyPresetRGBUserTheme
                localStorage.setItem('pokemon_theme', 'USER');
                _bagAssets = null; _applyThemeCSS(); _render();
            }
        ));
        list.appendChild(makeNumberRow('Frame',       'pokemon_frame',      savedFrame,    1, 20));
        list.appendChild(makeNumberRow('Theme Ball',  'pokemon_theme_ball', savedThemeBall,1, 31));
        list.appendChild(makeToggleRow('Random Music', ['ON','OFF'],                  savedRandMusic, function(v){localStorage.setItem('pokemon_random_music',v);}));
        list.appendChild(makeToggleRow('Disable Music',['ON','OFF'],                  savedDisMusic,  function(v){localStorage.setItem('pokemon_disable_music',v);}));
        list.appendChild(makeNumberRow('Bar Speed',   'pokemon_bar_speed',  savedBarSpeed, 1, 11));
        list.appendChild(makeToggleRow('Transition',   ['ON','OFF'],                  savedTransition,function(v){localStorage.setItem('pokemon_transition',v);}));
        list.appendChild(makeToggleRow('Lv Cap 100',   ['ON','OFF'],                  savedLvCap,     function(v){localStorage.setItem('pokemon_lv_cap',v);}));
        list.appendChild(makeToggleRow('Auto Run',     ['OFF','ON'],                  savedAutoRun,   function(v){localStorage.setItem('pokemon_auto_run',v);}));
        list.appendChild(makeToggleRow('Trainer Slide',['ON','OFF'],                  savedTrSlide,   function(v){localStorage.setItem('pokemon_trainer_slide',v);}));
        list.appendChild(makeToggleRow('Autosave',     ['OFF','15s','30s','1m','2m','5m','10m'],savedAutosave, function(v){localStorage.setItem('pokemon_autosave_int',v);}));
        // SAVE row (last)
        (function(){
            var myIdx = rowIndex++;
            var row = document.createElement('div');
            row.className = 'opt-row opt-save-row' + (_subIdx === myIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            var lbl = document.createElement('span'); lbl.className = 'opt-label'; lbl.textContent = 'SAVE';
            row.appendChild(lbl);
            row.addEventListener('click', function(){_subIdx=myIdx;_render();});
            list.appendChild(row);
        })();

        // ── Extra controls below the 18 EE options (engine-specific) ──
        var extraSep = document.createElement('div'); extraSep.className = 'sm-sep'; list.appendChild(extraSep);

        // Controls toggle
        var ctrlRow = makeToggleRow('Controls', ['D-PAD','STICK'],
            savedControls==='dpad'?'D-PAD':'STICK',
            function(v){if(window.GameControls)GameControls.setMode(v==='D-PAD'?'dpad':'joystick');});
        ctrlRow.style.padding = '4px 8px';
        list.appendChild(ctrlRow);

        // Button size slider
        var sizeIdx = rowIndex++;
        var sizeRow = document.createElement('div');
        sizeRow.className = 'opt-row' + (_subIdx === sizeIdx ? ' selected' : '');
        sizeRow.innerHTML = '<span class="opt-label">Button Size</span>'
            + '<span class="opt-val-wrap" style="pointer-events:all">'
            + '<input type="range" id="sm-size-slider" min="0.5" max="2" step="0.1" value="'+savedScale+'" style="pointer-events:all;width:60px;accent-color:#1dc0fe">'
            + '<span id="sm-size-val" style="font-size:12px;color:#7090a8;min-width:26px">'+savedScale.toFixed(1)+'×</span>'
            + '</span>';
        sizeRow.addEventListener('click', function(){_subIdx=sizeIdx;_render();});
        list.appendChild(sizeRow);

        // Orientation row
        var orientIdx = rowIndex++;
        var orientRow = document.createElement('div');
        orientRow.className = 'opt-row opt-row-col' + (_subIdx === orientIdx ? ' selected' : '');
        var orientLbl = document.createElement('span'); orientLbl.className = 'opt-label'; orientLbl.textContent = 'Orientation';
        var orientBtns = document.createElement('span');
        orientBtns.className = 'sm-opt-btns sm-orient-btns';
        orientBtns.style.pointerEvents = 'all';
        [
            { val:'auto',              label:'Auto'   },
            { val:'portrait',          label:'Port.'  },
            { val:'reverse-portrait',  label:'↕ Rev.' },
            { val:'landscape',         label:'Land.'  },
            { val:'reverse-landscape', label:'↔ Rev.' },
        ].forEach(function(o){
            var btn = document.createElement('button');
            btn.className = 'sm-opt-btn sm-orient-btn' + (currentOrient===o.val?' active':'');
            btn.textContent = o.label;
            btn.style.pointerEvents = 'all';
            btn.addEventListener('click', function(e){
                e.stopPropagation();
                orientBtns.querySelectorAll('.sm-orient-btn').forEach(function(b){b.classList.remove('active');});
                btn.classList.add('active');
                if(window.GameLayout) GameLayout.setOrientation(o.val);
            });
            orientBtns.appendChild(btn);
        });
        orientRow.appendChild(orientLbl);
        orientRow.appendChild(orientBtns);
        orientRow.addEventListener('click', function(){_subIdx=orientIdx;_render();});
        list.appendChild(orientRow);

        // Wire size slider
        setTimeout(function(){
            var sl = document.getElementById('sm-size-slider');
            var sv = document.getElementById('sm-size-val');
            if(sl) sl.addEventListener('input', function(){
                var v = sl.value;
                document.documentElement.style.setProperty('--control-scale', v);
                if(sv) sv.textContent = parseFloat(v).toFixed(1)+'×';
                localStorage.setItem('pokemon_control_scale', v);
            });
        }, 0);
    }

    function _drawOptionsCanvasBg(ctx) {
        var _tc = _getThemeColors();
        ctx.fillStyle = _tc.bg;
        ctx.fillRect(0, 0, GBA_W, GBA_H);
        var S = 2;
        // Title bar
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 0, GBA_W, 20*S);
        ctx.fillStyle = _tc.hi;
        ctx.fillRect(0, 20*S, GBA_W, 2);
        ctx.textBaseline = 'top';
        ctx.font = 'bold '+(11*S)+'px "Press Start 2P", monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('OPTIONS', 8*S, 5*S);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // --- Navigation ---
    function _goBack() {
        if (page==='pokedex_entry') { page='pokedex'; _render(); return; }
        // In battle bag mode, B/back closes entirely and returns to battle
        if (_battleBagCancel) { close(); return; }
        if (_battlePartyCancel) { close(); return; }
        page='main'; _subIdx=0; _render();
    }

    function _confirmSelected() {
        if (page!=='main') {
            if (page==='save') { const a=['save','load']; _doSaveAction(a[_subIdx]||'save'); }
            else if (page==='journal') { /* A does nothing in journal — navigate with L/R and up/down */ }
            else if (page==='pokenav') {
                if (_subIdx === 4) { _goBack(); }
                else if (_subIdx === 0) { _openPokenavMap(); }
            }
            else if (page==='pokedex' && _dexList && _dexList[_subIdx]) {
                var _deSaved = window.GameSave && GameSave.state && GameSave.state.pokedex;
                var _deSeen  = new Set((_deSaved && _deSaved.seen) || []);
                if (!_deSeen.has(_dexList[_subIdx].num)) return; // unseen — block entry
                _dexEntry = _dexList[_subIdx];
                page = 'pokedex_entry'; _subIdx = 0; _render();
            } else if (page==='bag') {
                var _bPockets = _getBagPockets();
                var _bPocket  = _bPockets[_bagPocket] || _bPockets[0];
                var _bItem    = _bPocket && _bPocket.items[_subIdx];
                // Close Pack selected (index past last item), or no item at index
                if (!_bItem || _subIdx >= _bPocket.items.length) {
                    if (_battleBagCancel) close(); else _goBack();
                    return;
                }
                if (_battleItemCallback && _bItem.quantity > 0) {
                    var _bCb = _battleItemCallback;
                    _battleItemCallback = null; _battleBagCancel = null;
                    close();
                    _bCb(_bItem);
                }
                return;
            } else if (page==='pokemon') {
                var _pFilled = _getParty().filter(Boolean);
                if (_partyActionOpen) {
                    var opts = _battlePartyCallback ? ['Switch', 'Cancel'] : ['Details', 'Item', 'Cancel'];
                    var _pOpt  = opts[_partyActionSel] || 'Cancel';
                    if (_pOpt === 'Cancel') {
                        _partyActionOpen = false; _redrawPageEl(true);
                    } else if (_pOpt === 'Switch') {
                        var _pCb = _battlePartyCallback;
                        var _pMon = _partyActionMon;
                        _battlePartyCallback = null; _battlePartyCancel = null;
                        close();
                        if (_pCb) _pCb(_pMon);
                    } else if (_pOpt === 'Details') {
                        _partyActionOpen = false;
                        _openPartySummary(_partyActionMon, _partyActionIdx, _pFilled, function(){ _redrawPageEl(); });
                    }
                } else if (_subIdx >= _pFilled.length) {
                    // CANCEL row selected
                    _goBack();
                } else if (_pFilled[_subIdx]) {
                    _partyActionMon  = _pFilled[_subIdx];
                    _partyActionIdx  = _subIdx;
                    _partyActionSel  = 0;
                    _partyActionOpen = true;
                    _redrawPageEl(true);
                }
            }
            return;
        }
        const item=ITEMS[selectedIdx]; if(!item) return;
        switch(item.id) {
            case 'EXIT':    close(); break;
            case 'SAVE':    _saveDone=false; page='save';         _subIdx=0; _render(); break;
            case 'OPTIONS': page='options';      _subIdx=0; _render(); break;
            case 'JOURNAL': page='journal'; _journalPage=0; _subIdx=0; _render(); break;
            case 'POKENAV': page='pokenav';      _subIdx=0; _render(); break;
            case 'PLAYER':  page='trainer_card'; _subIdx=0; _render(); break;
            case 'BAG':     page='bag';           _subIdx=0; _render(); break;
            case 'POKEMON': page='pokemon';       _subIdx=0; _render(); break;
            case 'POKEDEX': page='pokedex';       _subIdx=0; _render(); break;
            default: close(); break;
        }
    }

    // --- Public API ---
    function open() {
        if (!menuEl) return;
        selectedIdx=0; page='main'; _subIdx=0; _saveDone=false; isOpen=true;
        menuEl.classList.add('open'); _render();
    }
    function close() {
        if (!menuEl) return;
        isOpen=false; menuEl.classList.remove('open');
        menuEl.style.visibility = 'visible';
        // Restore z-index after battle bag use
        menuEl.style.zIndex = '';
        if (subEl) { subEl.style.display='none'; subEl.style.zIndex = ''; }
        // If closed without using a battle item, fire cancel callback
        if (_battleBagCancel) { var cb = _battleBagCancel; _battleItemCallback = null; _battleBagCancel = null; cb(); }
        if (_battlePartyCancel) { var pcb = _battlePartyCancel; _battlePartyCallback = null; _battlePartyCancel = null; pcb(); }
    }

    function openBagForBattle(onUse, onCancel) {
        if (!menuEl) { if (onCancel) onCancel(); return; }
        _battleItemCallback = onUse;
        _battleBagCancel    = onCancel || null;
        selectedIdx = 0; page = 'bag'; _bagPocket = 0; _subIdx = 0; isOpen = true;
        // Lift above battle overlay (z-index 80) so it's visible
        menuEl.style.zIndex = '90';
        if (subEl) subEl.style.zIndex = '90';
        menuEl.classList.add('open'); _render();
    }
    function openPartyForBattle(onSwitch, onCancel) {
        if (!menuEl) { if (onCancel) onCancel(); return; }
        _battlePartyCallback = onSwitch  || null;
        _battlePartyCancel   = onCancel  || null;
        selectedIdx = 0; page = 'pokemon'; _subIdx = 0; _partyActionOpen = false; isOpen = true;
        menuEl.style.zIndex = '90';
        if (subEl) subEl.style.zIndex = '90';
        menuEl.classList.add('open'); _render();
    }
    function toggle() { if(isOpen) close(); else open(); }

    function _redrawPageEl(fast) {
        var el = subEl && subEl._pageEl;
        if (!el) return false;
        if (fast && typeof el._redrawFast === 'function') { el._redrawFast(); return true; }
        if (typeof el._redraw === 'function') { el._redraw(); return true; }
        return false;
    }
    var _carouselDir      = 0;  // -1 left, +1 right, 0 no scroll
    var _carouselScroll   = 0;  // persisted scroll position across renders

    function moveLeft() {
        if (!isOpen) return;
        if (page==='main') { return; } // no horizontal nav on vertical list
        if (page==='journal') { _journalTab=(_journalTab-1+4)%4; _journalPage=0; _achTier=0; _powersPage=0; if(!_redrawPageEl()) _render(); return; }
        if (page==='bag') { _bagPocket=(_bagPocket-1+8)%8; _subIdx=0; if(!_redrawPageEl()) _render(); return; }
    }
    function moveRight() {
        if (!isOpen) return;
        if (page==='main') { return; } // no horizontal nav on vertical list
        if (page==='journal') { _journalTab=(_journalTab+1)%4; _journalPage=0; _achTier=0; _powersPage=0; if(!_redrawPageEl()) _render(); return; }
        if (page==='bag') { _bagPocket=(_bagPocket+1)%8; _subIdx=0; if(!_redrawPageEl()) _render(); return; }
    }
    function moveUp() {
        if (!isOpen) return;
        if (page==='main') { if(selectedIdx>0){selectedIdx--;_render();} return; }
        if (page==='pokemon' && _partyActionOpen) {
            var _pOptLen = _battlePartyCallback ? 2 : 3;
            _partyActionSel = (_partyActionSel - 1 + _pOptLen) % _pOptLen; _redrawPageEl(true); return;
        }
        const c=_subCount(); if(c>0){_subIdx=(_subIdx-1+c)%c; if(page==='journal'||page==='pokemon'){_redrawPageEl(true);}else{_render();}}
    }
    function moveDown() {
        if (!isOpen) return;
        if (page==='main') { if(selectedIdx<ITEMS.length-1){selectedIdx++;_render();} return; }
        if (page==='pokemon' && _partyActionOpen) {
            var _pOptLen2 = _battlePartyCallback ? 2 : 3;
            _partyActionSel = (_partyActionSel + 1) % _pOptLen2; _redrawPageEl(true); return;
        }
        const c=_subCount(); if(c>0){_subIdx=(_subIdx+1)%c; if(page==='journal'||page==='pokemon'){_redrawPageEl(true);}else{_render();}}
    }
    function _subCount() {
        if (page==='journal') {
            if (_journalTab === 1) { // Ach. Atlas — scroll list
                var all = window.GameAchievements ? GameAchievements.getAll() : [];
                var tierKeys = [null,'platinum','gold','silver','bronze'];
                return _achTier === 0 ? all.length : all.filter(function(a){return a.tier===tierKeys[_achTier];}).length;
            }
            if (_journalTab === 2) { // Powers — scroll list
                if (!window.GameAchievements) return 0;
                var tierName = ['platinum','gold','silver','copper'][_powersPage] || 'platinum';
                return GameAchievements.getAll().filter(function(a){return a.tier===tierName;}).length;
            }
            if (_journalTab === 3) return 0; // Quests (no scroll yet)
            return 0; // Factions uses L/R
        }
        if (page==='save')    return 2;
        if (page==='pokenav') return 5;  // Map, Condition, Ribbons, Match Call, Close
        if (page==='options') return 21; // 18 EE options + 3 engine extras
        if (page==='bag')     return _getBagPockets()[_bagPocket].items.length + 1; // +1 for Close Pack
        if (page==='pokemon') {
            const party = window.GameSave && GameSave.state && GameSave.state.party;
            return (party ? party.filter(Boolean).length || 1 : 1) + 1; // +1 for CANCEL
        }
        if (page==='pokedex') return _dexList ? _dexList.length : 0;
        if (page==='pokedex_entry') return 3; // tabs: Info / Stats / Moves
        if (page==='achievements') {
            const all = window.GameAchievements ? GameAchievements.getAll() : [];
            const tierKeys = [null, 'platinum', 'gold', 'silver', 'bronze'];
            return _achTier === 0 ? all.length : all.filter(function(a){return a.tier===tierKeys[_achTier];}).length;
        }
        return 0;
    }
    function confirm() { if(isOpen) _confirmSelected(); }
    function back()    {
        if (!isOpen) return;
        if (page==='pokemon' && _partyActionOpen) { _partyActionOpen=false; _redrawPageEl(true); return; }
        if (page==='main') close(); else _goBack();
    }

    function _onKey(e) {
        if (!isOpen) return;
        if (e.key==='ArrowLeft' ||e.key==='q'){e.preventDefault();moveLeft(); return;}
        if (e.key==='ArrowRight'||e.key==='e'){e.preventDefault();moveRight();return;}
        if (e.key==='ArrowUp'   ||e.key==='w'){e.preventDefault();moveUp();   return;}
        if (e.key==='ArrowDown' ||e.key==='s'){e.preventDefault();moveDown(); return;}
        if (e.key==='Enter'||e.key==='z'||e.key==='Z'){e.preventDefault();confirm();return;}
        if (e.key==='Escape'||e.key==='x'||e.key==='X'||e.key==='b'||e.key==='B'){e.preventDefault();back();return;}
    }

    function init() {
        _applyThemeCSS(); // apply saved theme to CSS variables on startup
        // Attach inside #screen-primary so the menu is clipped to the game
        // screen and never covers the control buttons below it.
        const screen = document.getElementById('screen-primary');
        if (!screen) { console.warn('[StartMenu] #screen-primary not found'); return; }

        menuEl = document.createElement('div');
        menuEl.id = 'start-menu';
        screen.appendChild(menuEl);

        subEl = document.createElement('div');
        subEl.id = 'start-menu-sub';
        subEl.className = 'sm-sub-overlay';
        subEl.style.display = 'none';
        screen.appendChild(subEl);

        window.addEventListener('keydown', _onKey);
    }

    document.addEventListener('DOMContentLoaded',init);

    return { toggle, open, close, openBagForBattle, openPartyForBattle, moveUp, moveDown, moveLeft, moveRight, confirm, back,
             get isOpen() { return isOpen; } };
})();
