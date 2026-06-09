// GameStartMenu — Emerald Enhanced style: icon strip at top, info bar at bottom
window.GameStartMenu = (function () {
    'use strict';

    // Items match EE's BuildNormalStartMenu order
    const ITEMS = [
        { id: 'POKEDEX',  label: 'Pokédex',  icon: 'start_icon_pokedex.png'  },
        { id: 'POKEMON',  label: 'Pokémon',  icon: 'start_icon_pokemon.png'  },
        { id: 'BAG',      label: 'Pack',      icon: 'start_icon_bag.png'      },
        { id: 'POKENAV',  label: 'Pokénav',  icon: 'start_icon_pokenav.png'  },
        { id: 'JOURNAL',  label: 'Journal',  icon: 'start_icon_journal.png'  },
        { id: 'PLAYER',   label: '',         icon: 'start_icon_empty.png'    },
        { id: 'SAVE',     label: 'Save',      icon: 'start_icon_save.png'     },
        { id: 'OPTIONS',  label: 'Options',   icon: 'start_icon_options.png'  },
        { id: 'EXIT',     label: 'Exit',      icon: 'start_icon_empty.png'    },
    ];

    const ICON_PATH = 'src/assets/start_menu/';
    // Use RGBA versions (palette index 0 made transparent)
    function _iconFile(name) { return ICON_PATH + name.replace('.png', '_rgba.png'); }

    const TIER_ICON  = { platinum: '💎', gold: '🥇', silver: '🥈', bronze: '🥉' };
    const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

    let menuEl      = null;
    let subEl       = null;   // sub-page overlay element
    let isOpen      = false;
    let selectedIdx = 0;
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
        var img = new Image();
        img.onload  = function() { storeRef.val = img; cb(img); };
        img.onerror = function() { storeRef.val = null; cb(null); };
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
            return { bg:'#f0e8f8', text:'#000000', dim:'#808080', border:'#6860d0', hi:'#c0b8d8', titleBg:'#d8d0e8' };
        }
        // DARK (default) — from 1d.gbapal: fill=index1=#181818, hi=index14=#18c0f8, border=index13=#0070a8
        // From ryudarktheme.gbapal: text=index2=#d8d8f0, dim=index3=#787888
        return { bg:'#181818', text:'#d8d8f0', dim:'#787888', border:'#0070a8', hi:'#18c0f8', titleBg:'#0a1830' };
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
        var pending = 1 + 14 + 6; // bg + 7 unsel + 7 sel + 6 bag frames
        function done() { if (--pending === 0) { _bagAssets = assets; cb(assets); } }
        var bg = new Image();
        bg.onload = function() { assets.bg = bg; done(); };
        bg.onerror = function() { done(); };
        bg.src = _bagBgPath();
        for (var i = 0; i < 7; i++) {
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

    // --- Render main menu (top strip + middle transparent + bottom info) ---
    function _renderMain() {
        menuEl.innerHTML = '';

        // TOP STRIP
        const top = document.createElement('div');
        top.className = 'sm-top-strip';

        // Icon row
        const carousel = document.createElement('div');
        carousel.className = 'sm-carousel';
        ITEMS.forEach(function (itm, i) {
            const wrap = document.createElement('div');
            wrap.className = 'sm-icon-wrap' + (i === selectedIdx ? ' selected' : '');

            const sprite = document.createElement('div');
            sprite.className = 'sm-icon-sprite';
            sprite.style.backgroundImage = 'url("' + _iconFile(itm.icon) + '")';
            // top half = normal frame, bottom half = selected/cyan frame (set via CSS)

            wrap.appendChild(sprite);
            wrap.addEventListener('click', function () {
                selectedIdx = i;
                _confirmSelected();
            });
            carousel.appendChild(wrap);
        });
        top.appendChild(carousel);

        // Label below icons (EE shows item name at y=32 inside the top window)
        const label = document.createElement('div');
        label.className = 'sm-label-bar';
        const cur = ITEMS[selectedIdx];
        label.textContent = cur.id === 'PLAYER' ? _playerName() : cur.label;
        top.appendChild(label);

        menuEl.appendChild(top);

        // MIDDLE — transparent spacer (game world visible)
        const mid = document.createElement('div');
        mid.className = 'sm-middle';
        menuEl.appendChild(mid);

        // BOTTOM INFO BOX
        const tod = _timeOfDay();
        const info = document.createElement('div');
        info.className = 'sm-info-box';
        info.innerHTML =
            '<div class="sm-info-line1">'
          +   '<span>Played: ' + _playtime() + ' / Normal</span>'
          +   '<span class="sm-info-ver">' + _mapName() + '</span>'
          + '</div>'
          + '<div class="sm-info-line2">'
          +   '<span>' + _clockStr() + ' ◆ </span>'
          +   '<span class="sm-tod ' + tod.cls + '">' + tod.label + '</span>'
          +   '<span> · ' + _dayOfWeek() + ' · ' + _season() + '</span>'
          + '</div>';
        menuEl.appendChild(info);
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
            _renderMain();
            if (subEl) subEl.style.display = 'none';
        } else {
            _renderMain(); // keep top/bottom visible behind overlay
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

                ctx.font = 'bold '+(8*S)+'px monospace';
                ctx.fillStyle = COL_CYAN;
                ctx.fillText('TRAINER CARD', 16*S, 8*S);

                ctx.font = (7*S)+'px monospace';
                var y = 28*S;
                rows.forEach(function(r) {
                    if (!r) { y += 8*S; return; }
                    ctx.fillStyle = COL_DIM;
                    ctx.fillText(r.key, 16*S, y);
                    ctx.fillStyle = COL_TEXT;
                    ctx.fillText(r.val, 130*S, y);
                    y += 14*S;
                });
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
        var CYAN  = '#5aced6';
        var TEXT  = '#ffffff';
        var DIM   = '#888899';
        var BG    = '#000000';
        var TITLEBG = '#0a1830';

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, GBA_W, GBA_H);
        ctx.textBaseline = 'top';

        // ── 4 main tabs (y=0..17 GBA) ───────────────────────────────────────
        ctx.font = (7*S) + 'px monospace';
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

        ctx.font = (7*S) + 'px monospace';
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
            ctx.fillStyle = hasMon ? '#20d840' : '#442244';
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
        ctx.font = (7*S) + 'px monospace';
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
        ctx.font = (7*S) + 'px monospace';
        var ROW_H = 20, COL_MID = 120;
        for (var i = 0; i < stats.length; i++) {
            var col  = i % 2;
            var row  = Math.floor(i / 2);
            var ry   = (32 + row * ROW_H) * S;
            if (ry > 110*S) break;
            var colX = col * COL_MID * S;
            // Background stripe on even rows
            if (row % 2 === 0) {
                ctx.fillStyle = 'rgba(10,24,48,0.6)';
                ctx.fillRect(colX, ry - S, COL_MID*S, ROW_H*S);
            }
            ctx.fillStyle = DIM;
            ctx.fillText(String(stats[i][0]), colX + 4*S, ry);
            ctx.fillStyle = TEXT;
            var val = String(stats[i][1]);
            var vw = ctx.measureText(val).width;
            ctx.fillText(val, colX + (COL_MID - 4)*S - vw, ry);
            // Column divider
            ctx.fillStyle = 'rgba(90,206,214,0.2)';
            ctx.fillRect(COL_MID*S - S, 30*S, S, 82*S);
        }
    }

    function _drawJournalAchAtlas(ctx, S, CYAN, TEXT, DIM) {
        // AP counter top-right
        var ap = _ap();
        ctx.font = (7*S) + 'px monospace';
        ctx.textBaseline = 'top';
        var apStr = ap + ' / ' + _maxAP() + ' AP';
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

        // Achievement list
        var allAchs = _achList();
        var TIER_NAMES = [null,'platinum','gold','silver','bronze'];
        var filtered = _achTier === 0 ? allAchs : allAchs.filter(function(a){ return a.tier === TIER_NAMES[_achTier]; });
        var LIST_ROWS = 5;
        var listY = 31;
        for (var j = 0; j < LIST_ROWS; j++) {
            var idx = _achOffset + j;
            if (idx >= filtered.length) break;
            var ach = filtered[idx];
            var sel2 = (idx === _subIdx);
            var ry2 = (listY + j * 14) * S;
            if (sel2) { ctx.fillStyle = 'rgba(90,206,214,0.2)'; ctx.fillRect(0, ry2 - S, GBA_W, 14*S); }
            ctx.fillStyle = ach.unlocked ? TEXT : DIM;
            ctx.font = (7*S) + 'px monospace';
            ctx.fillText((ach.unlocked ? '[+]' : '[X]') + ' ' + (ach.name||''), 4*S, ry2);
            var apVal = (ach.apReward || 0) + 'AP';
            var avw = ctx.measureText(apVal).width;
            ctx.fillText(apVal, GBA_W - avw - 4*S, ry2);
        }

        // Selected ach description
        var selAch = filtered[_subIdx];
        if (selAch) {
            ctx.fillStyle = 'rgba(10,24,48,0.8)';
            ctx.fillRect(0, 102*S, GBA_W, 10*S);
            ctx.fillStyle = CYAN;
            ctx.fillRect(0, 102*S, GBA_W, S);
            ctx.fillStyle = selAch.unlocked ? TEXT : DIM;
            ctx.font = (7*S) + 'px monospace';
            ctx.fillText((selAch.name||'') + (selAch.unlocked ? ' [EARNED]' : ' [LOCKED]'), 4*S, 103*S);
            ctx.fillStyle = DIM;
            ctx.fillText((selAch.desc||''), 4*S, 103*S + 9*S);
        }
    }

    function _drawJournalPowers(ctx, S, CYAN, TEXT, DIM, BG, TITLEBG) {
        var TIERS = ['Platinum', 'Gold', 'Silver', 'Copper'];
        var ap = _ap();

        // Tier tabs + AP counter
        ctx.font = (7*S) + 'px monospace';
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
        ctx.font = (7*S) + 'px monospace';
        ctx.fillText('Select a power to view its description.', 4*S, 104*S);
    }

    function _drawJournalQuests(ctx, S, CYAN, TEXT, DIM) {
        ctx.font = (7*S) + 'px monospace';
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
            if (sel) { ctx.fillStyle='rgba(90,206,214,0.2)'; ctx.fillRect(0,ry-S,GBA_W,13*S); }
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
                btn.style.cssText = 'pointer-events:all;padding:2px 4px;font-size:10px;' + (_achTier === i ? 'color:#5aced6;' : '');
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
        ctx.font = 'bold '+(7*S)+'px monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('ACHIEVEMENT ATLAS', 8*S, 6*S);

        // Total AP right-aligned
        ctx.font = (6*S)+'px monospace';
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

        ctx.font = (6*S)+'px monospace';
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
                    ctx.fillStyle = 'rgba(90,206,214,0.20)';
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
        if (_achOffset > 0) { ctx.fillStyle = COL_CYAN; ctx.font=(7*S)+'px monospace'; ctx.fillText('▲', GBA_W/2 - 4, (listY - 1)*S); }
        if (_achOffset + LIST_ROWS < filtered.length) { ctx.fillStyle = COL_CYAN; ctx.font=(7*S)+'px monospace'; ctx.fillText('▼', GBA_W/2 - 4, (listY + LIST_ROWS*14)*S); }

        // Desc box at bottom (y=112)
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 112*S, GBA_W, 48*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 112*S, GBA_W, 2);

        ctx.font = (6*S)+'px monospace';
        var selAch = filtered[_subIdx];
        if (selAch) {
            ctx.fillStyle = COL_CYAN;
            var title = selAch.name + (selAch.unlocked ? ' [EARNED]' : ' [LOCKED]');
            ctx.fillText(title, 4*S, 115*S);
            ctx.fillStyle = COL_TEXT;
            var desc = selAch.desc || '';
            var words = desc.split(' '), line = '', ly = 126*S;
            ctx.font = (5*S)+'px monospace';
            for (var w = 0; w < words.length; w++) {
                var test = line ? line + ' ' + words[w] : words[w];
                if (ctx.measureText(test).width > (GBA_W - 8*S) && line) {
                    ctx.fillText(line, 4*S, ly); line = words[w]; ly += 11*S;
                    if (ly > 154*S) break;
                } else { line = test; }
            }
            if (line) ctx.fillText(line, 4*S, ly);
            ctx.fillStyle = COL_DIM;
            ctx.font = (5*S)+'px monospace';
            var meta = (selAch.tier||'').toUpperCase() + '  ' + selAch.apReward + ' AP';
            ctx.fillText(meta, 4*S, 148*S);
        } else {
            ctx.fillStyle = COL_DIM;
            ctx.fillText(unlockCount + ' / ' + all.length + ' earned  ·  ' + totalAP + ' / ' + maxAP + ' AP', 4*S, 120*S);
        }
    }

    // ── Bag pocket data helper ──────────────────────────────────────────────
    function _getBagPockets() {
        const inv = (window.GameSave && GameSave.state && GameSave.state.inventory)
            ? GameSave.state.inventory : {};
        const FB = {
            items:     [{ itemId:1, name:'Potion',           quantity:5,  desc:'Restores 20 HP.' }],
            medicine:  [{ itemId:2, name:'Antidote',         quantity:2,  desc:'Cures poison.' }],
            valuables: [{ itemId:3, name:'Nugget',           quantity:1,  desc:'A nugget of pure gold.' }],
            keyItems:  [{ itemId:4, name:'Bicycle',          quantity:1,  desc:'A folding bicycle.' }],
            pokeBalls: [{ itemId:5, name:'Poké Ball',        quantity:10, desc:'A device for catching Pokémon.' }],
            tms:       [{ itemId:6, name:'TM01 Focus Punch', quantity:1,  desc:'Teaches Focus Punch.' }],
            berries:   [{ itemId:7, name:'Oran Berry',       quantity:3,  desc:'Restores 10 HP if held.' }],
        };
        function pick(key) { var a = inv[key]; return (a && a.length) ? a : FB[key]; }
        return [
            { label: 'Items',      items: pick('items')     },
            { label: 'Medicine',   items: pick('medicine')  },
            { label: 'Valuables',  items: pick('valuables') },
            { label: 'Key Items',  items: pick('keyItems')  },
            { label: 'Poké Balls', items: pick('pokeBalls') },
            { label: 'TMs & HMs',  items: pick('tms')       },
            { label: 'Berries',    items: pick('berries')   },
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

        // EE dark palette
        var CYAN    = '#5aced6';
        var TEXT    = '#ffffff';
        var DIM     = '#888899';
        var BG      = '#000000';
        var SEL_BG  = 'rgba(90,206,214,0.25)';

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, BAG_W, BAG_H);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, BAG_W, BAG_H);

        // ── Pocket name row (y=0..9 GBA): ( ◄ label ► ) ─────────────────────
        ctx.font = 'bold ' + (8*S) + 'px monospace';
        ctx.textBaseline = 'top';
        ctx.fillStyle = CYAN;
        ctx.fillText('(', 2*S, 1*S);
        ctx.fillText('◄', 8*S, 1*S);
        ctx.fillStyle = TEXT;
        var labelW = ctx.measureText(pocket.label).width;
        ctx.fillText(pocket.label, (56*S) - labelW/2, 1*S);
        ctx.fillStyle = CYAN;
        ctx.fillText('►', (100*S) - ctx.measureText('►').width, 1*S);
        ctx.fillText(')', (108*S) - ctx.measureText(')').width, 1*S);

        // ── Pocket icon row (y=8..15 GBA) ────────────────────────────────────
        var iconRowY = 8*S;
        var iconStartX = Math.round((112 - 7*10) / 2) * S; // center 7 icons of 10px each
        for (var i = 0; i < 7; i++) {
            var ix = iconStartX + i * 10*S;
            var icon = assets && assets.icons && assets.icons[i];
            if (icon) {
                var img = (i === _bagPocket) ? icon.sel : icon.unsel;
                if (img) ctx.drawImage(img, ix, iconRowY, 8*S, 8*S);
            }
        }

        // ── Big bag sprite (y=16..79 GBA, 64×64) ─────────────────────────────
        var bagFrame = assets && assets.bagFrames && assets.bagFrames[Math.min(_bagPocket, 5)];
        if (bagFrame) {
            var bx = Math.round((112 - 64) / 2) * S;
            ctx.drawImage(bagFrame, bx, 16*S, 64*S, 64*S);
        }

        // ── Item icon box (x=2..33, y=84..111 GBA) with cyan border ──────────
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = S;
        ctx.strokeRect(2*S, 84*S, 32*S, 28*S);
        if (itemIcon) {
            ctx.drawImage(itemIcon, 4*S, 86*S, 24*S, 24*S);
        }

        // ── Description text (y=116..159 GBA) ────────────────────────────────
        var selItem = items[_subIdx];
        var desc = selItem ? (selItem.desc || selItem.description || '') : '';
        if (!desc) desc = pocket.label + ' is empty.';
        ctx.fillStyle = TEXT;
        ctx.font = (7*S) + 'px monospace';
        ctx.textBaseline = 'top';
        var words = desc.split(' '), line = '', lx = 2*S, ly = 116*S, maxW = 108*S, lineH = 9*S;
        for (var w = 0; w < words.length; w++) {
            var test = line ? line + ' ' + words[w] : words[w];
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, lx, ly); line = words[w]; ly += lineH;
                if (ly > 150*S) break;
            } else { line = test; }
        }
        if (line && ly <= 150*S) ctx.fillText(line, lx, ly);

        // ── Right panel: item list box ────────────────────────────────────────
        // Outer box border
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = S;
        ctx.strokeRect(113*S, 1*S, 126*S, 158*S);

        var MAX_VIS = 8;
        var scroll = Math.max(0, Math.min(_subIdx - Math.floor(MAX_VIS/2), items.length - MAX_VIS));
        if (scroll < 0) scroll = 0;

        ctx.font = (7*S) + 'px monospace';
        ctx.textBaseline = 'top';

        function drawCursor(cx, cy, h) {
            // Filled right-pointing triangle as cursor
            ctx.fillStyle = CYAN;
            ctx.beginPath();
            ctx.moveTo(cx,        cy + 1);
            ctx.lineTo(cx + 5*S,  cy + Math.floor(h/2));
            ctx.lineTo(cx,        cy + h - 1);
            ctx.closePath();
            ctx.fill();
        }

        for (var j = 0; j < MAX_VIS; j++) {
            var idx = scroll + j;
            if (idx >= items.length) break;
            var item = items[idx];
            var row_y = (4 + j * 16) * S;
            var sel = (idx === _subIdx);

            if (sel) {
                ctx.fillStyle = SEL_BG;
                ctx.fillRect(114*S, row_y - 1*S, 124*S, 15*S);
                drawCursor(115*S, row_y, 13*S);
            }

            ctx.fillStyle = TEXT;
            var name = item.name || item.itemId || '?';
            ctx.fillText(name, 124*S, row_y);

            // quantity: × N right-aligned
            var qty = '\xd7' + String(item.quantity || 1);
            var qw = ctx.measureText(qty).width;
            ctx.fillText(qty, 237*S - qw, row_y);
        }

        // "Close Pack" entry
        var closeY = (4 + Math.min(MAX_VIS, items.length) * 16) * S;
        if (closeY < 152*S) {
            var closeSel = (_subIdx >= items.length);
            if (closeSel) {
                ctx.fillStyle = SEL_BG;
                ctx.fillRect(114*S, closeY - 1*S, 124*S, 15*S);
                drawCursor(115*S, closeY, 13*S);
            }
            ctx.fillStyle = DIM;
            ctx.fillText('Close Pack', 124*S, closeY);
        }

        // Scroll arrows — drawn as triangles too
        if (scroll > 0) {
            ctx.fillStyle = CYAN;
            ctx.beginPath(); ctx.moveTo(232*S, 8*S); ctx.lineTo(236*S, 4*S); ctx.lineTo(240*S, 8*S); ctx.closePath(); ctx.fill();
        }
        if (scroll + MAX_VIS < items.length) {
            ctx.fillStyle = CYAN;
            ctx.beginPath(); ctx.moveTo(232*S, 150*S); ctx.lineTo(236*S, 154*S); ctx.lineTo(240*S, 150*S); ctx.closePath(); ctx.fill();
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

            // Pocket indicator squares: y=16..23, x=24..88 (8 squares of 8px)
            if (cy >= 16 && cy < 24 && cx >= 24 && cx < 88) {
                var p = Math.floor((cx - 24) / 8);
                if (p >= 0 && p < 8) { _bagPocket = p; _subIdx = 0; _render(); return; }
            }
            // Item list: x=113..239, y=8..152
            if (cx >= 113 && cy >= 8 && cy < 152) {
                var row = Math.floor((cy - 8) / 16);
                var POCKETS = _getBagPockets();
                var items = (POCKETS[_bagPocket] || POCKETS[0]).items;
                var MAX_VIS = 9;
                var scroll = Math.max(0, Math.min(_subIdx - Math.floor(MAX_VIS/2), items.length - MAX_VIS));
                if (scroll < 0) scroll = 0;
                var itemIdx = scroll + row;
                if (itemIdx >= 0 && itemIdx < items.length) {
                    _subIdx = itemIdx; _render();
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

    function _loadMonIcon(speciesId, cb) {
        _getPokedexNumMap(function(map) {
            var name = map[speciesId];
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

    function _getParty() {
        var party = (window.GameSave && GameSave.state && GameSave.state.party) || [];
        if (!party.some(Boolean) && window.GameSave && GameSave.DEFAULT_POKEMON) {
            party = [Object.assign(GameSave.DEFAULT_POKEMON(), {
                speciesId: 4, nickname: 'CHARMANDER', level: 5, gender: 'M',
                currentHp: 19, maxHp: 19, moves: ['Scratch', 'Growl', null, null],
                caughtLevel: 5, exp: 35
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

        function redraw() {
            _loadPartyBg(function(bg) {
                _drawPartyCanvas(ctx, bg, _iconImgs);
            });
        }

        function loadIconsAndDraw() {
            var filled = _getParty().filter(Boolean);
            _iconImgs = new Array(filled.length).fill(null);
            if (!filled.length) { redraw(); return; }
            var pending = filled.length;
            filled.forEach(function(mon, i) {
                _loadMonIcon(mon.speciesId, function(img) {
                    _iconImgs[i] = img;
                    if (--pending === 0) redraw();
                });
            });
        }

        el._redraw = loadIconsAndDraw;
        loadIconsAndDraw();

        canvas.addEventListener('click', function(e) {
            var rect = canvas.getBoundingClientRect();
            // Map to GBA coords: canvas is 480×320, drawn at S=2 → divide by S
            var gx = (e.clientX - rect.left) * (PARTY_W / rect.width)  / PARTY_S;
            var gy = (e.clientY - rect.top)  * (PARTY_H / rect.height) / PARTY_S;
                var filled = _getParty().filter(Boolean);

                // If action menu is open, handle its clicks
                if (_partyActionOpen) {
                    var opts = ['SUMMARY', 'SWITCH', 'CANCEL'];
                    var ax = 130, ay = 50, aw = 100, ah = 14;
                    for (var oi = 0; oi < opts.length; oi++) {
                        if (gx >= ax && gx < ax+aw && gy >= ay+oi*ah && gy < ay+(oi+1)*ah) {
                            if (opts[oi] === 'CANCEL') {
                                _partyActionOpen = false; redraw();
                            } else if (opts[oi] === 'SUMMARY') {
                                _partyActionOpen = false;
                                _openPartySummary(_partyActionMon, _partyActionIdx, filled, loadIconsAndDraw);
                            }
                            return;
                        }
                    }
                    _partyActionOpen = false; redraw(); return;
                }

                // Slot 0: GBA x=8..87, y=24..79
                if (gx >= 8 && gx < 88 && gy >= 24 && gy < 80 && filled[0]) {
                    _partyActionMon = filled[0]; _partyActionIdx = 0;
                    _partyActionOpen = true; redraw(); return;
                }
                // Slots 1-5: GBA x=96..239
                for (var si = 1; si < 6; si++) {
                    var sy = 8 + (si - 1) * 24;
                    if (gx >= 96 && gx < 240 && gy >= sy && gy < sy+24 && filled[si]) {
                        _partyActionMon = filled[si]; _partyActionIdx = si;
                        _partyActionOpen = true; redraw(); return;
                    }
                }
                // Cancel bar: GBA y=120..151
                if (gy >= 120 && gy < 152) { _goBack(); }
            });
    }

    function _openPartySummary(mon, idx, filled, returnCb) {
        var subEl = document.getElementById('start-menu-sub');
        if (!subEl) return;
        var overlay = subEl.querySelector('.sm-sub-overlay');
        if (!overlay) return;
        overlay.innerHTML = '';
        var win = document.createElement('div');
        win.className = 'sm-win';
        win.style.cssText = 'position:absolute;left:3.3%;top:5%;width:90%;height:90%;pointer-events:all;overflow:hidden;';
        overlay.appendChild(win);
        overlay.style.display = 'block';

        var S = 2;
        var canvas = document.createElement('canvas');
        canvas.width = GBA_W * S; canvas.height = GBA_H * S;
        canvas.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;display:block;';
        win.appendChild(canvas);
        var ctx = canvas.getContext('2d');

        var _tc = _getThemeColors();
        ctx.fillStyle = _tc.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = _tc.titleBg; ctx.fillRect(0,0,canvas.width,20*S);
        ctx.fillStyle = _tc.hi; ctx.fillRect(0,20*S,canvas.width,2);
        ctx.font = 'bold '+(7*S)+'px monospace'; ctx.fillStyle = _tc.hi; ctx.textBaseline='top';
        ctx.fillText('POKEMON INFO', 8*S, 4*S);

        ctx.font = (6*S)+'px monospace'; ctx.fillStyle = _tc.text;
        var lines = [
            (mon.nickname||'???') + (mon.gender==='M'?' ♂':mon.gender==='F'?' ♀':''),
            'No. ' + (mon.speciesId||'?') + '  Lv.' + (mon.level||1),
            'HP: ' + (mon.currentHp||0) + ' / ' + (mon.maxHp||0),
            'Exp: ' + (mon.exp||0),
            'Nature: ' + (mon.nature||'Hardy'),
            '',
            'Moves:',
        ];
        (mon.moves||[]).filter(Boolean).forEach(function(m){ lines.push('  ' + m); });
        lines.forEach(function(l,i){ ctx.fillText(l, 8*S, (28+i*14)*S); });

        // Load and draw icon
        _loadMonIcon(mon.speciesId, function(img) {
            if (img) { ctx.imageSmoothingEnabled=false; ctx.drawImage(img,180*S,28*S,32*S,32*S); }
        });

        var backBtn = document.createElement('button');
        backBtn.textContent = 'B BACK'; backBtn.className = 'sm-back-btn';
        backBtn.style.cssText = 'position:absolute;bottom:4px;right:4px;z-index:10;pointer-events:all;';
        backBtn.addEventListener('click', function() {
            overlay.innerHTML = ''; overlay.style.display = 'none';
            if (returnCb) returnCb();
        });
        win.appendChild(backBtn);
    }

    function _drawPartyCanvas(ctx, bg, iconImgs) {
        var S = PARTY_S; // 2
        var _tc = _getThemeColors();
        var COL_TEXT = _tc.text, COL_DIM = _tc.dim, COL_CYAN = _tc.hi;
        var COL_BOX  = '#0c1020', COL_SEL = 'rgba(24,184,200,0.22)';
        var STATUS_COLOR = { PAR:'#e8c000', BRN:'#e85020', PSN:'#a820e8', FRZ:'#18c8e8', SLP:'#888888', FNT:'#e83020' };

        // Clear to dark background
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, PARTY_W, PARTY_H);

        var party  = _getParty();
        var filled = party.filter(Boolean);
        ctx.textBaseline = 'top';
        ctx.imageSmoothingEnabled = false;

        // ── Helper: draw a GBA-style slot box (cyan border on dark bg)
        function drawBox(x, y, w, h, selected) {
            ctx.fillStyle = selected ? COL_SEL : COL_BOX;
            ctx.fillRect(x*S, y*S, w*S, h*S);
            // Outer border
            ctx.strokeStyle = selected ? COL_CYAN : '#1a3050';
            ctx.lineWidth = S;
            ctx.strokeRect(x*S + S/2, y*S + S/2, w*S - S, h*S - S);
            if (selected) {
                // Left accent bar
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
        function drawSlot(mon, iconImg, winX, winY, winW, winH, nickX, nickY, lvX, lvY, genX, genY, hpBarX, hpBarY, hpNumX, hpNumY, iconX, iconY, isLarge, isSel) {
            drawBox(winX, winY, winW, winH, isSel);

            if (!mon) {
                ctx.fillStyle = '#333355';
                ctx.font = (6*S)+'px monospace';
                ctx.fillText('—', (winX+4)*S, (winY+winH/2-3)*S);
                return;
            }

            var hpPct = mon.maxHp > 0 ? Math.max(0, Math.min(1, (mon.currentHp||0)/mon.maxHp)) : 0;

            // Nickname
            ctx.font = 'bold '+(isLarge ? 7 : 6)*S+'px monospace';
            ctx.fillStyle = COL_TEXT;
            ctx.fillText((mon.nickname||'???').slice(0, isLarge ? 8 : 10), nickX*S, nickY*S);

            // Level  ("Lv" prefix as in EE)
            ctx.font = (6*S)+'px monospace';
            ctx.fillStyle = COL_DIM;
            ctx.fillText('Lv', lvX*S, lvY*S);
            ctx.fillStyle = COL_TEXT;
            ctx.fillText(''+(mon.level||1), (lvX+10)*S, lvY*S);

            // Gender
            ctx.font = 'bold '+(6*S)+'px monospace';
            drawGender(mon.gender, genX, genY);

            // HP bar (EE: 48px wide, at hpBarX/Y)
            drawHpBar(hpBarX, hpBarY, 48, hpPct);

            // HP numbers: "NNN/NNN"  (EE draws current right-aligned, "/" , max right-aligned)
            ctx.font = (6*S)+'px monospace';
            ctx.fillStyle = COL_TEXT;
            var hpStr = (mon.currentHp||0)+'/\n'+(mon.maxHp||0);
            ctx.fillText((mon.currentHp||0)+'/'+(mon.maxHp||0), hpNumX*S, hpNumY*S);

            // Status badge
            if (mon.statusCondition) {
                ctx.fillStyle = STATUS_COLOR[mon.statusCondition] || '#888';
                ctx.font = (5*S)+'px monospace';
                ctx.fillText('['+mon.statusCondition+']', (winX+2)*S, (winY+winH-8)*S);
            }

            // Pokémon icon — drawn last (on top) per EE OBJ layer order
            if (iconImg) {
                ctx.drawImage(iconImg, iconX*S, iconY*S, 32*S, 32*S);
            }
        }

        // ── SLOT 0  (large left box)
        // Window:  GBA (8, 24, 80, 56)
        // Text fields from EE sPartyBoxInfoRects[LEFT_COLUMN] + window origin (8,24):
        //   Nickname abs (32, 35)  Level abs (40, 44)  Gender abs (72, 44)
        //   HP bar abs (32, 59) w=48  HP numbers abs (36, 61) / (56, 61)
        // Icon sprite: EE sPartyMenuSpriteCoords[0] = center (16, 40) → 32×32 top-left (0, 24)
        var mon0 = filled[0] || null;
        drawSlot(mon0, iconImgs && iconImgs[0],
            /*win*/  8, 24, 80, 56,
            /*nick*/ 32, 35,
            /*lv*/   40, 44,
            /*gen*/  72, 44,
            /*hpBar*/32, 59,
            /*hpNum*/36, 61,
            /*icon*/ 0, 24,   // top-left of 32×32 = center(16,40) − 16
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

        // ── Bottom message bar  GBA (8, 120, 224, 32)
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 120*S, 240*S, 40*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 120*S, 240*S, S);

        // ── CANCEL button  GBA (192, 136, 48, 16)
        var cancelSel = (_subIdx >= filled.length);
        ctx.fillStyle = cancelSel ? COL_CYAN : COL_DIM;
        ctx.strokeStyle = cancelSel ? COL_CYAN : '#304060';
        ctx.lineWidth = S;
        ctx.strokeRect(192*S, 136*S, 48*S, 16*S);
        ctx.font = 'bold '+(6*S)+'px monospace';
        ctx.fillStyle = cancelSel ? '#050510' : COL_TEXT;
        if (cancelSel) { ctx.fillStyle = COL_CYAN; ctx.fillRect(192*S, 136*S, 48*S, 16*S); ctx.fillStyle = '#050510'; }
        ctx.fillText('CANCEL', 196*S, 139*S);

        // ── Action sub-menu overlay  (GBA coords: x=130, y=50, w=100, rowH=14)
        if (_partyActionOpen && _partyActionMon) {
            var opts = ['SUMMARY', 'SWITCH', 'CANCEL'];
            var ax = 130, ay = 48, aw = 102, rowH = 14;
            ctx.fillStyle = _tc.bg;
            ctx.fillRect(ax*S, ay*S, aw*S, (opts.length*rowH+6)*S);
            ctx.strokeStyle = COL_CYAN; ctx.lineWidth = S;
            ctx.strokeRect(ax*S + S/2, ay*S + S/2, aw*S - S, (opts.length*rowH+6)*S - S);
            ctx.font = (6*S)+'px monospace';
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
                ctx.font = '16px monospace';
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
                        _subIdx = clickedIdx; _render();
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
        ctx.font = 'bold '+(7*S)+'px monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('POKEDEX', 8*S, 5*S);

        if (!_dexList || !_dexList.length) {
            ctx.fillStyle = COL_DIM;
            ctx.font = (6*S)+'px monospace';
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

        ctx.font = (6*S)+'px monospace';
        for (var relI = 0; relI < end - start; relI++) {
            var absI = start + relI;
            var entry = _dexList[absI];
            var y = (24 + relI * 14) * S;
            var isSel = absI === _subIdx;
            var hasSeen = seen.has(entry.num);
            var hasCaught = caught.has(entry.num);

            if (isSel) {
                ctx.fillStyle = 'rgba(90,206,214,0.20)';
                ctx.fillRect(0, y, GBA_W, 14*S);
                ctx.fillStyle = COL_CYAN;
                ctx.fillRect(0, y, 2*S, 14*S);
            }

            // Arrow
            ctx.fillStyle = isSel ? COL_CYAN : 'transparent';
            ctx.fillText(isSel ? '▶' : ' ', 2*S, y + 2*S);

            // Dex num
            ctx.fillStyle = COL_DIM;
            ctx.fillText(String(entry.num).padStart(3,'0'), 10*S, y + 2*S);

            // Caught dot
            if (hasCaught) {
                ctx.fillStyle = COL_CYAN;
                ctx.fillText('●', 218*S, y + 2*S);
            } else if (hasSeen) {
                ctx.fillStyle = '#555566';
                ctx.fillText('○', 218*S, y + 2*S);
            }

            // Name
            ctx.fillStyle = hasSeen ? COL_TEXT : '#444455';
            ctx.fillText(hasSeen ? entry.name : '???', 36*S, y + 2*S);

            // Type tags (abbreviated)
            if (hasSeen && entry.types) {
                var tx = 110*S;
                for (var ti = 0; ti < Math.min(2, entry.types.length); ti++) {
                    var tname = entry.types[ti];
                    var tcol = TYPE_COLORS[tname] || '#888888';
                    var tw = ctx.measureText(tname).width + 4*S;
                    ctx.fillStyle = tcol;
                    ctx.fillRect(tx, y + 1*S, tw, 10*S);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(tname, tx + 2*S, y + 2*S);
                    tx += tw + 2*S;
                }
            }
        }

        // Scroll hint
        ctx.fillStyle = _tc.titleBg;
        ctx.fillRect(0, 153*S, GBA_W, 7*S);
        ctx.fillStyle = COL_CYAN;
        ctx.fillRect(0, 153*S, GBA_W, 1);
        ctx.font = (5*S)+'px monospace';
        ctx.fillStyle = COL_DIM;
        ctx.fillText((_subIdx+1) + ' / ' + _dexList.length, 4*S, 154*S);
        if (start > 0) { ctx.fillStyle = COL_CYAN; ctx.font=(6*S)+'px monospace'; ctx.fillText('▲', GBA_W-12*S, 22*S); }
        if (end < _dexList.length) { ctx.fillStyle = COL_CYAN; ctx.font=(6*S)+'px monospace'; ctx.fillText('▼', GBA_W-12*S, 150*S); }
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
                btn.style.cssText = 'pointer-events:all;padding:2px 6px;font-size:10px;' + (_subIdx === i ? 'color:#5aced6;' : '');
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
        ctx.font = 'bold '+(7*S)+'px monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('POKEDEX', 8*S, 5*S);

        // Sprite area (left): 0..79, y=22..87 (GBA px: 0..79px, 22..87px)
        if (spriteImg) {
            ctx.drawImage(spriteImg, 0, 22*S, 80*S, 66*S);
        } else {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 22*S, 80*S, 66*S);
            ctx.fillStyle = COL_DIM;
            ctx.font = (5*S)+'px monospace';
            ctx.fillText('No sprite', 4*S, 50*S);
        }

        // Info right side: x=82..239, y=22
        ctx.font = 'bold '+(7*S)+'px monospace';
        ctx.fillStyle = COL_TEXT;
        ctx.fillText(entry.name, 84*S, 24*S);
        ctx.font = (6*S)+'px monospace';
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
                ctx.font = (5*S)+'px monospace';
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
            ctx.font = (6*S)+'px monospace';
            rows.forEach(function(r, i) {
                var ry = (bodyY + i * 12) * S;
                ctx.fillStyle = COL_DIM;  ctx.fillText(r[0], 4*S, ry);
                ctx.fillStyle = COL_TEXT; ctx.fillText(r[1], 80*S, ry);
            });
            // Dex entry text wrapped
            var desc = entry.entry || '';
            var words = desc.split(' '), line = '', ly = (bodyY + rows.length * 12 + 4) * S;
            ctx.font = (5*S)+'px monospace';
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
                ctx.font = (5*S)+'px monospace';
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
                ctx.font = (5*S)+'px monospace';
                ctx.fillStyle = COL_DIM;  ctx.fillText(label, 4*S, ry);
                ctx.fillStyle = COL_TEXT; ctx.fillText(String(val), 60*S, ry);
                // bar
                ctx.fillStyle = '#1a1a2e'; ctx.fillRect(80*S, ry, 150*S, 7*S);
                ctx.fillStyle = STAT_COLORS2[k]; ctx.fillRect(80*S, ry, Math.round(pct * 150)*S, 7*S);
            });
            ctx.fillStyle = COL_CYAN;
            ctx.font = (5*S)+'px monospace';
            ctx.fillText('Total: ' + total, 4*S, (bodyY + STAT_NAMES.length * 10 + 4)*S);

        } else {
            // Moves tab
            ctx.font = (5*S)+'px monospace';
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
        ctx.font = 'bold '+(10*S)+'px monospace';
        ctx.fillStyle = COL_CYAN;
        ctx.fillText('POKENAV', 8*S, 8*S);
        ctx.font = (6*S)+'px monospace';
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

        ctx.font = (7*S)+'px monospace';
        OPTIONS.forEach(function(opt, i) {
            var ry = (40 + i * 18) * S;
            var isSel = i === _subIdx;
            if (isSel) {
                ctx.fillStyle = 'rgba(90,206,214,0.20)';
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
        ctx.font = (5*S)+'px monospace';
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
        ctx.font = 'bold '+(7*S)+'px monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('SAVE', 8*S, 5*S);

        // Info box
        var dexCount = (window.GameSave && GameSave.state && GameSave.state.pokedex)
            ? (GameSave.state.pokedex.caught || []).length : 0;

        ctx.font = (7*S)+'px monospace';
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
                ctx.fillStyle = 'rgba(90,206,214,0.20)';
                ctx.fillRect(0, ry, GBA_W, 14*S);
                ctx.fillStyle = COL_CYAN;
                ctx.fillRect(0, ry, 2*S, 14*S);
            }
            ctx.font = (7*S)+'px monospace';
            ctx.fillStyle = isSel ? COL_CYAN : COL_TEXT;
            ctx.fillText((isSel ? '▶ ' : '  ') + label, 8*S, ry + 2*S);
        });

        if (_saveDone) {
            ctx.fillStyle = '#20d840';
            ctx.font = (7*S)+'px monospace';
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
        ctx.font = 'bold '+(7*S)+'px monospace';
        ctx.fillStyle = _tc.hi;
        ctx.fillText('OPTIONS', 8*S, 5*S);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // --- Navigation ---
    function _goBack() {
        if (page==='pokedex_entry') { page='pokedex'; _render(); return; }
        page='main'; _subIdx=0; _render();
    }

    function _confirmSelected() {
        if (page!=='main') {
            if (page==='save') { const a=['save','load']; _doSaveAction(a[_subIdx]||'save'); }
            else if (page==='journal') { /* A does nothing in journal — navigate with L/R and up/down */ }
            else if (page==='pokedex' && _dexList && _dexList[_subIdx]) {
                _dexEntry = _dexList[_subIdx];
                page = 'pokedex_entry'; _subIdx = 0; _render();
            } else if (page==='pokemon') {
                var _pFilled = _getParty().filter(Boolean);
                if (_partyActionOpen) {
                    var _pOpts = ['SUMMARY', 'SWITCH', 'CANCEL'];
                    var _pOpt  = _pOpts[_partyActionSel] || 'CANCEL';
                    if (_pOpt === 'CANCEL') {
                        _partyActionOpen = false; _render();
                    } else if (_pOpt === 'SUMMARY') {
                        _partyActionOpen = false;
                        _openPartySummary(_partyActionMon, _partyActionIdx, _pFilled, function(){ _render(); });
                    }
                } else if (_pFilled[_subIdx]) {
                    _partyActionMon  = _pFilled[_subIdx];
                    _partyActionIdx  = _subIdx;
                    _partyActionSel  = 0;
                    _partyActionOpen = true;
                    _render();
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
        if (subEl) subEl.style.display='none';
    }
    function toggle() { if(isOpen) close(); else open(); }

    function _redrawPageEl() {
        var el = subEl && subEl._pageEl;
        if (el && typeof el._redraw === 'function') { el._redraw(); return true; }
        return false;
    }
    function moveLeft() {
        if (!isOpen) return;
        if (page==='main') { selectedIdx=(selectedIdx-1+ITEMS.length)%ITEMS.length; _render(); return; }
        if (page==='journal') { _journalTab=(_journalTab-1+4)%4; _journalPage=0; _achTier=0; _powersPage=0; if(!_redrawPageEl()) _render(); return; }
        if (page==='bag') { _bagPocket=(_bagPocket-1+8)%8; _subIdx=0; if(!_redrawPageEl()) _render(); return; }
    }
    function moveRight() {
        if (!isOpen) return;
        if (page==='main') { selectedIdx=(selectedIdx+1)%ITEMS.length; _render(); return; }
        if (page==='journal') { _journalTab=(_journalTab+1)%4; _journalPage=0; _achTier=0; _powersPage=0; if(!_redrawPageEl()) _render(); return; }
        if (page==='bag') { _bagPocket=(_bagPocket+1)%8; _subIdx=0; if(!_redrawPageEl()) _render(); return; }
    }
    function moveUp() {
        if (!isOpen||page==='main') return;
        if (page==='pokemon' && _partyActionOpen) {
            _partyActionSel = (_partyActionSel - 1 + 3) % 3; _render(); return;
        }
        const c=_subCount(); if(c>0){_subIdx=(_subIdx-1+c)%c; if(page==='journal'){_redrawPageEl();}else{_render();}}
    }
    function moveDown() {
        if (!isOpen||page==='main') return;
        if (page==='pokemon' && _partyActionOpen) {
            _partyActionSel = (_partyActionSel + 1) % 3; _render(); return;
        }
        const c=_subCount(); if(c>0){_subIdx=(_subIdx+1)%c; if(page==='journal'){_redrawPageEl();}else{_render();}}
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
        if (page==='bag')     return _getBagPockets()[_bagPocket].items.length;
        if (page==='pokemon') {
            const party = window.GameSave && GameSave.state && GameSave.state.party;
            return party ? party.filter(Boolean).length || 1 : 1;
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
        if (page==='pokemon' && _partyActionOpen) { _partyActionOpen=false; _render(); return; }
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

    return { toggle, open, close, moveUp, moveDown, moveLeft, moveRight, confirm, back,
             get isOpen() { return isOpen; } };
})();
