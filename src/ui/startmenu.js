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

    // --- Bag state ---
    var _bagPocket  = 0;   // 0-7: which pocket tab is open
    var _bagBgImg   = null; // cached Image for bag_bg.png
    function _loadBagBg(cb) {
        if (_bagBgImg && _bagBgImg.complete) { cb(_bagBgImg); return; }
        _bagBgImg = new Image();
        _bagBgImg.onload = function() { cb(_bagBgImg); };
        _bagBgImg.onerror = function() { cb(null); };
        _bagBgImg.src = 'src/assets/bag/bag_bg.png';
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

        const titles = { journal:'Journal', trainer_card:'Trainer Card',
                         achievements:'Achievement Atlas', pokenav:'Pokénav',
                         save:'Save', options:'Options', bag:'Pack', pokemon:'Pokémon',
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
        else if (page === 'bag')           _buildBag(content);
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

    // --- Sub-page builders ---
    function _buildTrainerCard(el) {
        const ls = _lifeSkills();
        [
            { key:'Name',        val:_playerName()                               },
            { key:'Trainer ID',  val:_trainerId()                                },
            { key:'Money',       val:'₽'+_money().toLocaleString()              },
            { key:'Location',    val:_mapName()                                  },
            null,
            { key:'Badges',      val:_badges()+' / 8'                           },
            { key:'Ach Points',  val:_ap()+' AP  ('+_achList().length+' earned)'},
            { key:'Play Time',   val:_playtime()                                 },
            null,
            { key:'Botany',      val:'Lv '+(ls.botany||0)                       },
            { key:'Mining',      val:'Lv '+(ls.mining||0)                       },
            { key:'Alchemy',     val:'Lv '+(ls.alchemy||0)                      },
        ].forEach(function (r) {
            if (!r) { const s=document.createElement('div'); s.className='sm-sep'; el.appendChild(s); return; }
            const row = document.createElement('div');
            row.className = 'sm-kv-row';
            row.innerHTML='<span class="sm-kv-key">'+r.key+'</span><span class="sm-kv-val">'+r.val+'</span>';
            el.appendChild(row);
        });
    }

    // Journal page index (L/R to flip pages, like EE)
    var _journalPage = 0;
    var _achTier = 0;     // 0=all,1=plat,2=gold,3=silver,4=bronze for filter
    var _achOffset = 0;   // scroll offset in flat list

    // EE journal.c: 6 stat pages navigated with L/R buttons
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
        // EE journal.c layout: full-screen with page-name strip, stat table, trainer info at bottom
        // We fit this into the .sm-sub-content div which already has padding.
        // Remove default padding so we can control layout fully.
        el.style.padding = '0';
        el.style.gap = '0';

        // ── Page name bar (top) — tiles 1,4 → y=32px in 160px screen = 20%
        const pageBar = document.createElement('div');
        pageBar.className = 'jn-page-bar';
        const leftArrow = document.createElement('button');
        leftArrow.className = 'jn-page-btn';
        leftArrow.textContent = '◀ L';
        leftArrow.style.pointerEvents = 'all';
        leftArrow.addEventListener('click', function(e) {
            e.stopPropagation();
            _journalPage = (_journalPage - 1 + JOURNAL_PAGES.length) % JOURNAL_PAGES.length;
            _render();
        });
        const pageTitle = document.createElement('span');
        pageTitle.className = 'jn-page-title';
        pageTitle.textContent = JOURNAL_PAGES[_journalPage].name;
        const rightArrow = document.createElement('button');
        rightArrow.className = 'jn-page-btn';
        rightArrow.textContent = 'R ▶';
        rightArrow.style.pointerEvents = 'all';
        rightArrow.addEventListener('click', function(e) {
            e.stopPropagation();
            _journalPage = (_journalPage + 1) % JOURNAL_PAGES.length;
            _render();
        });
        pageBar.appendChild(leftArrow);
        pageBar.appendChild(pageTitle);
        pageBar.appendChild(rightArrow);
        el.appendChild(pageBar);

        // ── Stats table (middle) — tiles 1,6 → y=48px, 28×8 tiles = 224×64px
        // Name left-aligned, value right-aligned at LEFT_MIDDLE=112px (47% of 240)
        const stats = JOURNAL_PAGES[_journalPage].stats();
        const table = document.createElement('div');
        table.className = 'jn-stat-table';
        stats.forEach(function(row) {
            const r = document.createElement('div');
            r.className = 'jn-stat-row';
            const lbl = document.createElement('span');
            lbl.className = 'jn-stat-lbl';
            lbl.textContent = row[0];
            const val = document.createElement('span');
            val.className = 'jn-stat-val';
            val.textContent = row[1];
            r.appendChild(lbl);
            r.appendChild(val);
            table.appendChild(r);
        });
        el.appendChild(table);

        // ── Page indicator dots
        const dots = document.createElement('div');
        dots.className = 'jn-dots';
        JOURNAL_PAGES.forEach(function(_, i) {
            const d = document.createElement('span');
            d.className = 'jn-dot' + (i === _journalPage ? ' active' : '');
            d.textContent = i === _journalPage ? '◆' : '◇';
            d.style.pointerEvents = 'all';
            d.style.cursor = 'pointer';
            d.addEventListener('click', function(e) {
                e.stopPropagation();
                _journalPage = i;
                _render();
            });
            dots.appendChild(d);
        });
        el.appendChild(dots);

        // ── Trainer info strip at bottom — tiles 7,14 / 14,14 / 18,14 = y=112px
        const strip = document.createElement('div');
        strip.className = 'jn-trainer-strip';
        strip.innerHTML =
            '<span class="jn-strip-name">' + _playerName() + '</span>' +
            '<span class="jn-strip-id">ID: ' + _trainerId() + '</span>' +
            '<span class="jn-strip-money">₽' + _money().toLocaleString() + '</span>';
        el.appendChild(strip);
    }

    function _buildAchievements(el) {
        // EE ach_atlas.c layout:
        // Top: tier tabs (tiles 1,1=px8,8, 21 wide) + total AP (tiles 24,1=px192,8, 5 wide)
        // List: name col (tiles 1,6=px8,48, 16 wide) + AP col (tiles 19,6=px152,48, 10 wide), 6 rows visible
        // Bottom: description (tiles 1,15=px8,120, 28×4=224×32px)

        el.style.padding = '0';
        el.style.gap = '0';

        const all = window.GameAchievements ? GameAchievements.getAll() : [];
        const totalAP = all.reduce(function(s, a) { return s + (a.unlocked ? a.apReward : 0); }, 0);
        const maxAP   = all.reduce(function(s, a) { return s + a.apReward; }, 0);
        const unlockCount = all.filter(function(a) { return a.unlocked; }).length;

        // ── Tier tab bar + total AP
        const TIERS = ['All', 'Plat', 'Gold', 'Silv', 'Brnz'];
        const tabBar = document.createElement('div');
        tabBar.className = 'ach-tab-bar';
        TIERS.forEach(function(t, i) {
            const btn = document.createElement('button');
            btn.className = 'ach-tab-btn' + (_achTier === i ? ' active' : '');
            btn.textContent = t;
            btn.style.pointerEvents = 'all';
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                _achTier = i;
                _achOffset = 0;
                _subIdx = 0;
                _render();
            });
            tabBar.appendChild(btn);
        });
        const apBox = document.createElement('span');
        apBox.className = 'ach-total-ap';
        apBox.textContent = totalAP + ' AP';
        tabBar.appendChild(apBox);
        el.appendChild(tabBar);

        // ── Filter list by selected tier
        const tierKeys = [null, 'platinum', 'gold', 'silver', 'bronze'];
        const filtered = _achTier === 0
            ? all
            : all.filter(function(a) { return a.tier === tierKeys[_achTier]; });

        // ── Scrollable list: name (left ~65%) + AP reward (right ~35%)
        const LIST_ROWS = 6;
        // Clamp _achOffset so selected is always visible
        if (_subIdx < _achOffset) _achOffset = _subIdx;
        if (_subIdx >= _achOffset + LIST_ROWS) _achOffset = _subIdx - LIST_ROWS + 1;
        _achOffset = Math.max(0, Math.min(_achOffset, Math.max(0, filtered.length - LIST_ROWS)));

        const listWrap = document.createElement('div');
        listWrap.className = 'ach-list-wrap';

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'ach-empty';
            empty.textContent = 'No achievements in this tier.';
            listWrap.appendChild(empty);
        } else {
            const visible = filtered.slice(_achOffset, _achOffset + LIST_ROWS);
            visible.forEach(function(a, vi) {
                const absIdx = _achOffset + vi;
                const row = document.createElement('div');
                row.className = 'ach-list-row'
                    + (a.unlocked ? '' : ' locked')
                    + (absIdx === _subIdx ? ' selected' : '');
                row.style.pointerEvents = 'all';
                row.addEventListener('click', function(e) {
                    e.stopPropagation();
                    _subIdx = absIdx;
                    _render();
                });

                const icon = document.createElement('span');
                icon.className = 'ach-list-icon';
                icon.textContent = a.unlocked ? TIER_ICON[a.tier] : '✗';

                const name = document.createElement('span');
                name.className = 'ach-list-name';
                name.textContent = a.name;

                const ap = document.createElement('span');
                ap.className = 'ach-list-ap';
                ap.textContent = (a.unlocked ? '✓ ' : '') + a.apReward + 'AP';

                row.appendChild(icon);
                row.appendChild(name);
                row.appendChild(ap);
                listWrap.appendChild(row);
            });

            // scroll hint
            if (filtered.length > LIST_ROWS) {
                const hint = document.createElement('div');
                hint.className = 'ach-scroll-hint';
                hint.textContent = (_subIdx + 1) + ' / ' + filtered.length;
                listWrap.appendChild(hint);
            }
        }
        el.appendChild(listWrap);

        // ── Description box at bottom — tiles 1,15 = y≈75% of screen
        const selAch = filtered[_subIdx];
        const descBox = document.createElement('div');
        descBox.className = 'ach-desc-box';
        if (selAch) {
            const dTitle = document.createElement('div');
            dTitle.className = 'ach-desc-title';
            dTitle.textContent = selAch.name + (selAch.unlocked ? ' ✓' : '');
            const dText = document.createElement('div');
            dText.className = 'ach-desc-text';
            dText.textContent = selAch.desc || '';
            const dMeta = document.createElement('div');
            dMeta.className = 'ach-desc-meta';
            dMeta.textContent = (selAch.tier || '').toUpperCase() + '  ' + selAch.apReward + ' AP'
                + (selAch.unlocked ? '  [EARNED]' : '  [LOCKED]');
            descBox.appendChild(dTitle);
            descBox.appendChild(dText);
            descBox.appendChild(dMeta);
        } else {
            descBox.textContent = unlockCount + ' / ' + all.length + ' earned  ·  ' + totalAP + ' / ' + maxAP + ' AP';
        }
        el.appendChild(descBox);
    }

    // ── Bag pocket data helper ──────────────────────────────────────────────
    function _getBagPockets() {
        const inv = (window.GameSave && GameSave.state && GameSave.state.inventory)
            ? GameSave.state.inventory : {};
        return [
            { label: 'Items',      items: inv.items     || [] },
            { label: 'Medicine',   items: inv.medicine  || [] },
            { label: 'Valuables',  items: inv.valuables || [] },
            { label: 'Key Items',  items: inv.keyItems  || [] },
            { label: 'Poké Balls', items: inv.pokeBalls || [] },
            { label: 'TMs & HMs',  items: inv.tms       || [] },
            { label: 'Berries',    items: inv.berries   || [] },
            { label: 'Free Space', items: inv.free      || [] },
        ];
    }

    // ── Canvas bag renderer (GBA pixel-exact at 240×160) ───────────────────
    function _drawBagCanvas(ctx, bg) {
        var POCKETS = _getBagPockets();
        var pocket  = POCKETS[_bagPocket] || POCKETS[0];
        var items   = pocket.items;

        // ── 1. Background image (240×160 assembled from EE tileset+tilemap)
        ctx.clearRect(0, 0, 240, 160);
        if (bg) ctx.drawImage(bg, 0, 0, 240, 160);

        // EE dark palette colors (from bag_theme_dark.pal, bank1):
        // text = #ffffff (bank1[1]), shadow = #20abff (bank1[3])
        // pocket-indicator selected = #5aced6 (bank0[10]), unselected outline = #4a73c6 (bank0[6])
        var COL_TEXT   = '#ffffff';   // item names — EE bank1[1]
        var COL_SHADOW = '#20abff';   // text shadow  — EE bank1[3]
        var COL_DIM    = '#b4b4b4';   // dimmed text  — EE bank1[6]
        var COL_CYAN   = '#5aced6';   // pocket indicator selected — EE bank0[10]
        var COL_BLUE   = '#4a73c6';   // unselected indicator border — EE bank0[6]

        // ── 2. Pocket indicator squares
        // EE: InitPocketIndicatorIcons places 8 tiles at (i+3, 2) = px (24+i*8, 16)
        var POCKET_LABELS = ['ITM','MED','VAL','KEY','POK','TM♥','BRY','FRE'];
        for (var i = 0; i < 8; i++) {
            var ix = 24 + i * 8;
            if (i === _bagPocket) {
                ctx.fillStyle = COL_CYAN;
                ctx.fillRect(ix, 16, 7, 7);
            } else {
                ctx.strokeStyle = COL_BLUE;
                ctx.lineWidth = 0.5;
                ctx.strokeRect(ix + 0.5, 16.5, 6, 6);
            }
        }

        // ── 3. Pocket name (EE WIN[2]: tilemapLeft=3, tilemapTop=0 → px 24, 0)
        ctx.font = 'bold 7px "Courier New"';
        ctx.fillStyle = COL_TEXT;
        ctx.shadowColor = COL_SHADOW;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
        ctx.fillText(pocket.label, 26, 11);
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

        // ── 4. Item list (EE WIN[0]: x=112, y=8, w=120, h=144)
        var MAX_VIS = 9;
        var scroll  = Math.max(0, Math.min(_subIdx - Math.floor(MAX_VIS/2), items.length - MAX_VIS));
        if (scroll < 0) scroll = 0;

        ctx.font = '7px "Courier New"';
        for (var j = 0; j < MAX_VIS; j++) {
            var idx = scroll + j;
            if (idx >= items.length) break;
            var item = items[idx];
            var iy   = 8 + j * 16;
            var sel  = (idx === _subIdx);

            if (sel) {
                ctx.fillStyle = 'rgba(90,206,214,0.20)';
                ctx.fillRect(113, iy, 126, 14);
                ctx.fillStyle = COL_CYAN;
                ctx.fillRect(113, iy, 2, 14);
            }

            ctx.fillStyle = COL_TEXT;
            ctx.shadowColor = COL_SHADOW;
            ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
            var name = item.name || item.itemId || item.id || '?';
            ctx.fillText(name, 122, iy + 10);

            var qty = '\xd7' + (item.quantity || 1);
            var qw  = ctx.measureText(qty).width;
            ctx.fillText(qty, 238 - qw, iy + 10);
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        }

        // Scroll arrows
        if (scroll > 0) {
            ctx.fillStyle = COL_CYAN; ctx.fillText('▲', 231, 13);
        }
        if (scroll + MAX_VIS < items.length) {
            ctx.fillStyle = COL_CYAN; ctx.fillText('▼', 231, 153);
        }

        // CANCEL entry
        var cancelY = 8 + Math.min(MAX_VIS, items.length) * 16;
        if (cancelY < 152) {
            ctx.fillStyle = COL_DIM;
            ctx.font = '7px "Courier New"';
            ctx.fillText('CANCEL', 122, cancelY + 10);
        }

        // ── 5. Description (EE WIN[1]: tilemapLeft=0, tilemapTop=13 → px 0, 104)
        var selItem = items[_subIdx];
        var desc = selItem
            ? (selItem.desc || selItem.description || 'No description.')
            : pocket.label + ' pocket is empty.';
        ctx.fillStyle = COL_TEXT;
        ctx.shadowColor = COL_SHADOW;
        ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
        ctx.font = '7px "Courier New"';
        // Simple word-wrap in 108px width at x=4
        var words = desc.split(' ');
        var line = '', lx = 4, ly = 122;
        for (var w = 0; w < words.length; w++) {
            var test = line ? line + ' ' + words[w] : words[w];
            if (ctx.measureText(test).width > 104 && line) {
                ctx.fillText(line, lx, ly);
                line = words[w];
                ly += 11;
                if (ly > 154) break;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, lx, ly);
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    }

    function _buildBag(el) {
        el.style.cssText = 'padding:0;overflow:hidden;background:none;position:absolute;inset:0;';

        var canvas = document.createElement('canvas');
        canvas.width  = 240;
        canvas.height = 160;
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

        // Store redraw fn for when page re-renders
        el._redraw = function() { _loadBagBg(function(bg) { _drawBagCanvas(ctx, bg); }); };
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

    function _buildParty(el) {
        // EE party_menu.h sSinglePartyMenuWindowTemplate layout:
        // Slot 0 (left col, large): left=8px, top=24px, 80×56px
        // Slots 1-5 (right col, compact): left=96px, top=8/32/56/80/104px, 144×24px each
        // Cancel bar bottom: left=8px, top=120px, 224×32px
        const party = (window.GameSave && GameSave.state && GameSave.state.party) || [];
        const filled = party.filter(Boolean);

        const STATUS_COLOR = { PAR:'#e8c000', BRN:'#e85020', PSN:'#a820e8', FRZ:'#18c8e8', SLP:'#888', FNT:'#e83020' };

        el.style.padding = '0';
        el.style.overflow = 'hidden';

        if (!filled.length) {
            const empty = document.createElement('div');
            empty.className = 'pty-empty';
            empty.textContent = 'No Pokémon in party';
            el.appendChild(empty);
            // Cancel bar
            const bar = document.createElement('div');
            bar.className = 'pty-cancel-bar';
            bar.textContent = 'CANCEL';
            el.appendChild(bar);
            return;
        }

        // ── Two-column layout wrapper
        const cols = document.createElement('div');
        cols.className = 'pty-cols';

        // ── LEFT COLUMN: slot 0 large box
        const leftCol = document.createElement('div');
        leftCol.className = 'pty-left-col';

        const mon0 = filled[0];
        const slot0 = document.createElement('div');
        slot0.className = 'pty-slot0' + (0 === _subIdx ? ' selected' : '');
        slot0.style.pointerEvents = 'all';
        slot0.addEventListener('click', function(e) { e.stopPropagation(); _subIdx = 0; _render(); });

        const hp0pct = mon0.maxHp > 0 ? Math.max(0, Math.min(1, mon0.currentHp / mon0.maxHp)) : 0;
        const hp0col = hp0pct > 0.5 ? '#20d840' : hp0pct > 0.25 ? '#e8c000' : '#e82020';

        slot0.innerHTML =
            '<div class="pty-slot0-sprite">🟣</div>'
          + '<div class="pty-slot0-nick">' + (mon0.nickname || mon0.speciesId || '???') + (mon0.statusCondition ? ' <span style="background:' + (STATUS_COLOR[mon0.statusCondition]||'#666') + ';padding:0 2px;font-size:9px;color:#fff">' + mon0.statusCondition + '</span>' : '') + '</div>'
          + '<div class="pty-slot0-lv">Lv.' + (mon0.level||'?') + '</div>'
          + '<div class="pty-slot0-hp">'
          +   '<span class="pty-hp-label">HP</span>'
          +   '<div class="pty-hp-bar-wrap"><div class="pty-hp-bar-fill" style="width:' + Math.round(hp0pct*100) + '%;background:' + hp0col + '"></div></div>'
          + '</div>'
          + '<div class="pty-slot0-hpnum">' + (mon0.currentHp||0) + '/' + (mon0.maxHp||0) + '</div>';

        leftCol.appendChild(slot0);

        // Cancel button below slot 0 in left col
        const cancelBtn = document.createElement('div');
        cancelBtn.className = 'pty-cancel-btn';
        cancelBtn.style.pointerEvents = 'all';
        cancelBtn.textContent = 'CANCEL';
        cancelBtn.addEventListener('click', function(e) { e.stopPropagation(); _goBack(); });
        leftCol.appendChild(cancelBtn);

        cols.appendChild(leftCol);

        // ── RIGHT COLUMN: slots 1-5 compact boxes
        const rightCol = document.createElement('div');
        rightCol.className = 'pty-right-col';

        for (var i = 1; i < 6; i++) {
            const mon = filled[i];
            const slot = document.createElement('div');

            if (!mon) {
                slot.className = 'pty-slot-compact pty-slot-empty';
                slot.textContent = '—';
            } else {
                slot.className = 'pty-slot-compact' + (i === _subIdx ? ' selected' : '');
                slot.style.pointerEvents = 'all';
                (function(idx, m) {
                    slot.addEventListener('click', function(e) { e.stopPropagation(); _subIdx = idx; _render(); });
                })(i, mon);

                const hpPct = mon.maxHp > 0 ? Math.max(0, Math.min(1, mon.currentHp / mon.maxHp)) : 0;
                const hpCol = hpPct > 0.5 ? '#20d840' : hpPct > 0.25 ? '#e8c000' : '#e82020';

                // EE right box: nickname x=22,y=3; level x=30,y=12; HP x=92,y=12; HP bar x=88,y=10
                slot.innerHTML =
                    '<span class="pty-compact-nick">' + (mon.nickname || mon.speciesId || '???') + '</span>'
                  + '<span class="pty-compact-lv">Lv.' + (mon.level||'?') + '</span>'
                  + '<div class="pty-compact-hprow">'
                  +   '<span class="pty-hp-label">HP</span>'
                  +   '<div class="pty-hp-bar-wrap"><div class="pty-hp-bar-fill" style="width:' + Math.round(hpPct*100) + '%;background:' + hpCol + '"></div></div>'
                  +   '<span class="pty-compact-hpnum">' + (mon.currentHp||0) + '/' + (mon.maxHp||0) + '</span>'
                  + '</div>';

                if (mon.statusCondition) {
                    const badge = document.createElement('span');
                    badge.style.cssText = 'position:absolute;top:1px;right:2px;background:' + (STATUS_COLOR[mon.statusCondition]||'#666') + ';color:#fff;font-size:9px;padding:0 2px;';
                    badge.textContent = mon.statusCondition;
                    slot.style.position = 'relative';
                    slot.appendChild(badge);
                }
            }

            rightCol.appendChild(slot);
        }

        cols.appendChild(rightCol);
        el.appendChild(cols);

        // ── Detail panel for selected slot (below cols, if a mon is selected)
        const selMon = filled[_subIdx];
        if (selMon) {
            const detail = document.createElement('div');
            detail.className = 'pty-detail-bar';
            const moves = (selMon.moves || []).filter(Boolean).slice(0, 4);
            detail.innerHTML =
                '<span class="pty-detail-species">' + (selMon.speciesId || '???') + '</span>'
              + '<span class="pty-detail-item">' + (selMon.heldItem ? '♦ ' + selMon.heldItem : '') + '</span>'
              + (moves.length ? '<span class="pty-detail-moves">' + moves.join(' · ') + '</span>' : '');
            el.appendChild(detail);
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
            const msg = document.createElement('div');
            msg.className = 'sm-placeholder';
            msg.textContent = 'Loading Pokédex...';
            el.appendChild(msg);
            _loadDex(function(){ _render(); });
            return;
        }

        // Seen/caught from save
        const saved = window.GameSave && GameSave.state && GameSave.state.pokedex;
        const seen   = new Set((saved && saved.seen)   || []);
        const caught = new Set((saved && saved.caught) || []);

        // Show window of 20 entries around _subIdx
        const WIN = 20;
        const start = Math.max(0, _subIdx - Math.floor(WIN/2));
        const end   = Math.min(_dexList.length, start + WIN);

        _dexList.slice(start, end).forEach(function(entry, relI) {
            const absI = start + relI;
            const isSel = absI === _subIdx;
            const hasSeen   = seen.has(entry.num);
            const hasCaught = caught.has(entry.num);

            const row = document.createElement('div');
            row.className = 'sm-dex-row' + (isSel ? ' selected' : '');
            row.addEventListener('click', function(){ _subIdx = absI; _render(); });

            const cursor = document.createElement('span');
            cursor.className = 'sm-row-arrow';
            cursor.textContent = isSel ? '▶' : ' ';

            const numEl = document.createElement('span');
            numEl.className = 'sm-dex-num';
            numEl.textContent = String(entry.num).padStart(3,'0');

            // Icon
            const iconEl = document.createElement('img');
            iconEl.className = 'sm-dex-icon';
            if (hasSeen || hasCaught) {
                iconEl.src = 'data/sprites/pokemon/icons/' + (Object.keys(_dexDb).find(k => _dexDb[k]===entry) || entry.name.toLowerCase()) + '.png';
                iconEl.onerror = function(){ this.style.display='none'; };
            } else {
                iconEl.style.opacity = '0'; // not seen
            }

            const nameEl = document.createElement('span');
            nameEl.className = 'sm-dex-name';
            nameEl.textContent = hasSeen ? entry.name : '???';

            // Type badges
            const typesEl = document.createElement('span');
            typesEl.className = 'sm-dex-types';
            if (hasSeen) {
                entry.types.forEach(function(t){
                    const badge = document.createElement('span');
                    badge.className = 'sm-type-badge';
                    badge.textContent = t;
                    badge.style.background = TYPE_COLORS[t] || '#888';
                    typesEl.appendChild(badge);
                });
            }

            row.appendChild(cursor);
            row.appendChild(numEl);
            row.appendChild(iconEl);
            row.appendChild(nameEl);
            row.appendChild(typesEl);
            el.appendChild(row);
        });

        // Scroll hint
        const hint = document.createElement('div');
        hint.className = 'sm-dex-hint';
        hint.textContent = (_subIdx+1) + ' / ' + _dexList.length;
        el.appendChild(hint);
    }

    function _buildPokedexEntry(el) {
        const entry = _dexEntry;
        if (!entry) return;

        // Find the key name for sprite path
        const keyName = _dexDb ? (Object.keys(_dexDb).find(k => _dexDb[k] === entry) || entry.name.toLowerCase()) : entry.name.toLowerCase();

        // Header: sprite + name/number/types
        const header = document.createElement('div');
        header.className = 'sm-dex-entry-header';

        const sprite = document.createElement('img');
        sprite.className = 'sm-dex-entry-sprite';
        sprite.src = 'data/sprites/pokemon/front/' + keyName + '.png';
        sprite.onerror = function(){ this.style.visibility='hidden'; };

        const info = document.createElement('div');
        info.className = 'sm-dex-entry-info';
        info.innerHTML = '<div class="sm-dex-entry-num">#' + String(entry.num).padStart(3,'0') + '</div>'
            + '<div class="sm-dex-entry-name">' + entry.name + '</div>'
            + '<div class="sm-dex-entry-cat">' + entry.category + '</div>';

        const typesRow = document.createElement('div');
        typesRow.style.cssText = 'display:flex;gap:3px;margin-top:3px;';
        entry.types.forEach(function(t){
            const badge = document.createElement('span');
            badge.className = 'sm-type-badge';
            badge.textContent = t;
            badge.style.background = TYPE_COLORS[t] || '#888';
            typesRow.appendChild(badge);
        });
        info.appendChild(typesRow);

        header.appendChild(sprite);
        header.appendChild(info);
        el.appendChild(header);

        // Tab selector
        const TABS = ['Info','Stats','Moves'];
        const tabRow = document.createElement('div');
        tabRow.className = 'sm-dex-tabs';
        TABS.forEach(function(t, i){
            const tab = document.createElement('span');
            tab.className = 'sm-dex-tab' + (i === _subIdx ? ' active' : '');
            tab.textContent = t;
            tab.addEventListener('click', function(){ _subIdx = i; _render(); });
            tabRow.appendChild(tab);
        });
        el.appendChild(tabRow);

        const body = document.createElement('div');
        body.className = 'sm-dex-entry-body';

        if (_subIdx === 0) {
            // Info tab
            const h = entry.height_m, w = entry.weight_kg;
            const ft = Math.floor(h / 0.3048), inch = Math.round((h / 0.3048 - ft) * 12);
            const lbs = Math.round(w * 2.205 * 10) / 10;
            body.innerHTML =
                '<div class="sm-kv-row"><span class="sm-kv-key">Height</span><span class="sm-kv-val">' + h + 'm (' + ft + '\'' + inch + '")</span></div>'
              + '<div class="sm-kv-row"><span class="sm-kv-key">Weight</span><span class="sm-kv-val">' + w + 'kg (' + lbs + ' lbs)</span></div>'
              + '<div class="sm-kv-row"><span class="sm-kv-key">Catch Rate</span><span class="sm-kv-val">' + entry.catch_rate + '</span></div>'
              + '<div class="sm-kv-row"><span class="sm-kv-key">Exp Rate</span><span class="sm-kv-val">' + (entry.exp_rate||'').replace('EXP_RATE_','').toLowerCase().replace(/_/g,' ') + '</span></div>'
              + '<div class="sm-kv-row"><span class="sm-kv-key">Egg Groups</span><span class="sm-kv-val">' + entry.egg_groups.join(', ') + '</span></div>'
              + '<div class="sm-sep"></div>'
              + '<div class="sm-kv-row" style="flex-direction:column;align-items:flex-start;gap:3px;"><span class="sm-kv-key">Pokédex Entry</span><span style="color:#c8d8e8;line-height:1.5">' + entry.entry + '</span></div>';
        } else if (_subIdx === 1) {
            // Stats tab
            const stats = entry.stats;
            const STAT_NAMES = {hp:'HP',atk:'Attack',def:'Defense',spa:'Sp. Atk',spd:'Sp. Def',spe:'Speed'};
            const STAT_COLORS = {hp:'#f04040',atk:'#f08030',def:'#f8d030',spa:'#6890f0',spd:'#78c850',spe:'#f85888'};
            const maxStat = 255;
            let html = '';
            let total = 0;
            for (const [k, label] of Object.entries(STAT_NAMES)) {
                const val = stats[k] || 0;
                total += val;
                const pct = Math.round(val / maxStat * 100);
                html += '<div class="sm-stat-row">'
                    + '<span class="sm-stat-name">' + label + '</span>'
                    + '<span class="sm-stat-val">' + val + '</span>'
                    + '<div class="sm-stat-bar-wrap"><div class="sm-stat-bar" style="width:' + pct + '%;background:' + STAT_COLORS[k] + '"></div></div>'
                    + '</div>';
            }
            html += '<div class="sm-stat-row" style="margin-top:4px;border-top:1px solid rgba(24,184,200,0.2);padding-top:4px;">'
                  + '<span class="sm-stat-name" style="color:#80d0e8">Total</span>'
                  + '<span class="sm-stat-val" style="color:#80d0e8">' + total + '</span>'
                  + '<div class="sm-stat-bar-wrap"></div></div>';
            body.innerHTML = html;
        } else {
            // Moves tab — level-up learnset
            fetch('data/pokemon/pokedex.json')  // already cached
                .then(function(){ return null; })
                .catch(function(){});
            // Load from dexDb which we already have
            const fullEntry = _dexDb ? _dexDb[keyName] : null;
            const learnset = (fullEntry && fullEntry.learnset) ? fullEntry.learnset : null;

            if (!learnset) {
                // Load it from data.json directly
                fetch('source/pokeplatinum/res/pokemon/' + keyName + '/data.json')
                    .then(r => r.ok ? r.json() : null)
                    .then(d => {
                        if (!d || !d.learnset) return;
                        const lvl = d.learnset.level_up || [];
                        let html = '';
                        lvl.slice(0, 20).forEach(function(m){
                            html += '<div class="sm-kv-row"><span class="sm-kv-key">Lv.' + m[0] + '</span><span class="sm-kv-val">' + m[1].replace('MOVE_','').replace(/_/g,' ').toLowerCase().replace(/\b\w/g, c=>c.toUpperCase()) + '</span></div>';
                        });
                        if (body.parentNode) body.innerHTML = html || '<div class="sm-placeholder">No move data.</div>';
                    })
                    .catch(function(){});
                body.innerHTML = '<div class="sm-placeholder">Loading moves...</div>';
            } else {
                const lvl = learnset.level_up || [];
                let html = '';
                lvl.slice(0, 20).forEach(function(m){
                    html += '<div class="sm-kv-row"><span class="sm-kv-key">Lv.' + m[0] + '</span><span class="sm-kv-val">' + m[1].replace('MOVE_','').replace(/_/g,' ').toLowerCase().replace(/\b\w/g, c=>c.toUpperCase()) + '</span></div>';
                });
                body.innerHTML = html || '<div class="sm-placeholder">No move data.</div>';
            }
        }

        el.appendChild(body);

        // Evolution chain
        if (_subIdx === 0 && entry.evolutions && entry.evolutions.length) {
            const sep = document.createElement('div'); sep.className='sm-sep'; el.appendChild(sep);
            const evoLabel = document.createElement('div');
            evoLabel.className = 'sm-kv-row';
            evoLabel.innerHTML = '<span class="sm-kv-key" style="color:#80d0e8">Evolves into</span>';
            el.appendChild(evoLabel);
            entry.evolutions.forEach(function(evo){
                const r = document.createElement('div'); r.className='sm-kv-row';
                const method = evo.method.replace('EVO_','').replace(/_/g,' ').toLowerCase();
                r.innerHTML = '<span class="sm-kv-key" style="padding-left:8px">' + evo.into.toUpperCase() + '</span>'
                    + '<span class="sm-kv-val">' + method + (evo.param ? ' ' + evo.param : '') + '</span>';
                el.appendChild(r);
            });
        }
    }

    function _buildPokenav(el) {
        // EE pokenav_main_menu.c layout:
        // Left-side animated header (spinning Pokénav device)
        // 5 menu options as list: Map, Condition, Ribbons, Match Call, Close
        // Help bar: left=8px, top=176px, 128×16px — bottom hint
        el.style.padding = '0';

        // ── Animated header — left side Pokénav device graphic
        const hdr = document.createElement('div');
        hdr.className = 'pnav-header';
        const logo = document.createElement('div');
        logo.className = 'pnav-logo';
        logo.innerHTML = '<span class="pnav-logo-ring">◯</span><span class="pnav-logo-dot">◉</span>';
        const titleEl = document.createElement('span');
        titleEl.className = 'pnav-title';
        titleEl.textContent = 'POKÉNAV';
        hdr.appendChild(logo);
        hdr.appendChild(titleEl);
        el.appendChild(hdr);

        // ── Menu options list
        const OPTIONS = [
            { id:'map',        label:'Map',        hint:'View the region map' },
            { id:'condition',  label:'Condition',  hint:'Check Pokémon condition' },
            { id:'ribbons',    label:'Ribbons',    hint:'View collected ribbons' },
            { id:'match_call', label:'Match Call', hint:'Call registered trainers' },
            { id:'close',      label:'Close',      hint:'Close the Pokénav' },
        ];

        const list = document.createElement('div');
        list.className = 'pnav-list';
        OPTIONS.forEach(function(opt, i) {
            const row = document.createElement('div');
            row.className = 'pnav-row' + (i === _subIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            const arrow = document.createElement('span');
            arrow.className = 'sm-row-arrow';
            arrow.textContent = i === _subIdx ? '▶' : ' ';
            const lbl = document.createElement('span');
            lbl.className = 'pnav-row-label';
            lbl.textContent = opt.label;
            row.appendChild(arrow);
            row.appendChild(lbl);
            row.addEventListener('click', function(e) {
                e.stopPropagation();
                _subIdx = i;
                if (opt.id === 'close') _goBack();
                else _render();
            });
            list.appendChild(row);
        });
        el.appendChild(list);

        // ── Help bar at bottom — EE WIN_POKENAV_HELP_BAR
        const help = document.createElement('div');
        help.className = 'pnav-help-bar';
        const curOpt = OPTIONS[_subIdx] || OPTIONS[0];
        help.textContent = curOpt.hint;
        el.appendChild(help);
    }

    function _buildSave(el) {
        // EE save window: info box (location, name, badges, dex, time) above save/load rows
        el.style.padding = '0';
        el.style.gap = '0';

        // Info box — matches EE sSaveInfoWindowTemplate content
        const dexCount = (window.GameSave && GameSave.state && GameSave.state.pokedex)
            ? (GameSave.state.pokedex.caught || []).length : 0;

        const infoBox = document.createElement('div');
        infoBox.className = 'save-info-box';

        const rows = [
            { label: null,      val: _mapName(),                   cls: 'save-info-location' },
            { label: 'Player:',  val: _playerName(),                cls: 'save-info-row' },
            { label: 'Badges:',  val: String(_badges()),            cls: 'save-info-row' },
            { label: 'Pokédex:', val: String(dexCount),             cls: 'save-info-row' },
            { label: 'Time:',    val: _playtime(),                  cls: 'save-info-row' },
        ];
        rows.forEach(function(r) {
            const row = document.createElement('div');
            row.className = r.cls;
            if (r.label) {
                const lbl = document.createElement('span');
                lbl.className = 'save-info-lbl';
                lbl.textContent = r.label;
                const val = document.createElement('span');
                val.className = 'save-info-val';
                val.textContent = r.val;
                row.appendChild(lbl);
                row.appendChild(val);
            } else {
                row.textContent = r.val;
            }
            infoBox.appendChild(row);
        });
        el.appendChild(infoBox);

        // Separator
        const sep = document.createElement('div');
        sep.className = 'save-sep';
        el.appendChild(sep);

        // Save / Load rows
        const ACTIONS = [
            { id:'save', label:'Save Game' },
            { id:'load', label:'Load Game' },
        ];
        const actionList = document.createElement('div');
        actionList.className = 'save-action-list';
        ACTIONS.forEach(function(a, i) {
            const row = document.createElement('div');
            row.className = 'save-action-row' + (i === _subIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            const arrow = document.createElement('span');
            arrow.className = 'sm-row-arrow';
            arrow.textContent = i === _subIdx ? '▶' : ' ';
            const lbl = document.createElement('span');
            lbl.textContent = a.label;
            row.appendChild(arrow);
            row.appendChild(lbl);
            row.addEventListener('click', function() { _subIdx = i; _doSaveAction(a.id); });
            actionList.appendChild(row);
        });
        el.appendChild(actionList);

        if (_saveDone) {
            const msg = document.createElement('div');
            msg.className = 'sm-save-confirm';
            msg.textContent = '✓ Game saved!';
            el.appendChild(msg);
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
        // EE option_menu.c — exact 18 options, scrollable list, GPU-highlight bar
        // WIN_TEXT_OPTION: left=16px, top=8px, 208×16px — title already in sm-win-title
        // WIN_OPTIONS: left=16px, top=40px, 208×112px — 7 rows visible, Y_DIFF=16px
        const savedScale      = parseFloat(localStorage.getItem('pokemon_control_scale')||'1');
        const currentOrient   = window.GameLayout ? GameLayout.getOrientationPref() : 'auto';
        const savedTextSpeed  = localStorage.getItem('pokemon_text_speed')   || 'MED';
        const savedBScene     = localStorage.getItem('pokemon_battle_scene') || 'ON';
        const savedForceSet   = localStorage.getItem('pokemon_force_set')    || 'OFF';
        const savedDmgNums    = localStorage.getItem('pokemon_damage_nums')  || 'ON';
        const savedThemeUI    = localStorage.getItem('pokemon_theme_ui')     || 'MODERN';
        const savedTheme      = localStorage.getItem('pokemon_theme')        || 'DARK';
        const savedFrame      = parseInt(localStorage.getItem('pokemon_frame')    || '1');
        const savedThemeBall  = parseInt(localStorage.getItem('pokemon_theme_ball')|| '1');
        const savedRandMusic  = localStorage.getItem('pokemon_random_music') || 'OFF';
        const savedDisMusic   = localStorage.getItem('pokemon_disable_music')|| 'OFF';
        const savedBarSpeed   = parseInt(localStorage.getItem('pokemon_bar_speed') || '5');
        const savedTransition = localStorage.getItem('pokemon_transition')   || 'ON';
        const savedLvCap      = localStorage.getItem('pokemon_lv_cap')       || 'OFF';
        const savedAutoRun    = localStorage.getItem('pokemon_auto_run')     || 'OFF';
        const savedTrSlide    = localStorage.getItem('pokemon_trainer_slide')|| 'ON';
        const savedAutosave   = localStorage.getItem('pokemon_autosave_int') || '15s';
        const savedControls   = (window.GameControls && GameControls.getMode && GameControls.getMode()) || 'dpad';

        el.style.padding = '0';

        const list = document.createElement('div');
        list.className = 'opt-list';

        let rowIndex = 0;

        function makeToggleRow(label, opts, currentVal, onChange) {
            const myIdx = rowIndex++;
            const row = document.createElement('div');
            row.className = 'opt-row' + (_subIdx === myIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            const lbl = document.createElement('span');
            lbl.className = 'opt-label';
            lbl.textContent = label;
            const valWrap = document.createElement('span');
            valWrap.className = 'opt-val-wrap';
            opts.forEach(function(o) {
                const btn = document.createElement('button');
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

        function makeNumberRow(label, key, cur, min, max) {
            const myIdx = rowIndex++;
            const row = document.createElement('div');
            row.className = 'opt-row' + (_subIdx === myIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            const lbl = document.createElement('span');
            lbl.className = 'opt-label';
            lbl.textContent = label;
            const valWrap = document.createElement('span');
            valWrap.className = 'opt-val-wrap';
            const decBtn = document.createElement('button');
            decBtn.className = 'sm-opt-btn';
            decBtn.textContent = '◀';
            decBtn.style.pointerEvents = 'all';
            const numEl = document.createElement('span');
            numEl.className = 'opt-num-val';
            numEl.textContent = String(cur);
            const incBtn = document.createElement('button');
            incBtn.className = 'sm-opt-btn';
            incBtn.textContent = '▶';
            incBtn.style.pointerEvents = 'all';
            function updateNum(delta) {
                let v = parseInt(numEl.textContent) + delta;
                v = Math.max(min, Math.min(max, v));
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
        list.appendChild(makeToggleRow('Theme UI',        ['MODERN','CLASSIC','VANILLA'],savedThemeUI,   function(v){localStorage.setItem('pokemon_theme_ui',v);}));
        list.appendChild(makeToggleRow('Theme',           ['DARK','LIGHT','VANILLA','USER'],savedTheme,  function(v){localStorage.setItem('pokemon_theme',v);}));
        // Theme Presets — action row
        (function(){
            const myIdx = rowIndex++;
            const row = document.createElement('div');
            row.className = 'opt-row' + (_subIdx === myIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            const lbl = document.createElement('span'); lbl.className = 'opt-label'; lbl.textContent = 'Theme Presets';
            const val = document.createElement('span'); val.className = 'opt-val-wrap'; val.textContent = '▶ APPLY';
            row.appendChild(lbl); row.appendChild(val);
            row.addEventListener('click', function(){_subIdx=myIdx;_render();});
            list.appendChild(row);
        })();
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
            const myIdx = rowIndex++;
            const row = document.createElement('div');
            row.className = 'opt-row opt-save-row' + (_subIdx === myIdx ? ' selected' : '');
            row.style.pointerEvents = 'all';
            const lbl = document.createElement('span'); lbl.className = 'opt-label'; lbl.textContent = 'SAVE';
            row.appendChild(lbl);
            row.addEventListener('click', function(){_subIdx=myIdx;_render();});
            list.appendChild(row);
        })();

        el.appendChild(list);

        // ── Extra controls below the 18 EE options (engine-specific) ──
        const extraSep = document.createElement('div'); extraSep.className = 'sm-sep'; el.appendChild(extraSep);

        // Controls toggle
        const ctrlRow = makeToggleRow('Controls', ['D-PAD','STICK'],
            savedControls==='dpad'?'D-PAD':'STICK',
            function(v){if(window.GameControls)GameControls.setMode(v==='D-PAD'?'dpad':'joystick');});
        ctrlRow.style.padding = '4px 8px';
        el.appendChild(ctrlRow);

        // Button size slider
        const sizeIdx = rowIndex++;
        const sizeRow = document.createElement('div');
        sizeRow.className = 'opt-row' + (_subIdx === sizeIdx ? ' selected' : '');
        sizeRow.innerHTML = '<span class="opt-label">Button Size</span>'
            + '<span class="opt-val-wrap" style="pointer-events:all">'
            + '<input type="range" id="sm-size-slider" min="0.5" max="2" step="0.1" value="'+savedScale+'" style="pointer-events:all;width:60px;accent-color:#1dc0fe">'
            + '<span id="sm-size-val" style="font-size:12px;color:#7090a8;min-width:26px">'+savedScale.toFixed(1)+'×</span>'
            + '</span>';
        sizeRow.addEventListener('click', function(){_subIdx=sizeIdx;_render();});
        el.appendChild(sizeRow);

        // Orientation row
        const orientIdx = rowIndex++;
        const orientRow = document.createElement('div');
        orientRow.className = 'opt-row opt-row-col' + (_subIdx === orientIdx ? ' selected' : '');
        const orientLbl = document.createElement('span'); orientLbl.className = 'opt-label'; orientLbl.textContent = 'Orientation';
        const orientBtns = document.createElement('span');
        orientBtns.className = 'sm-opt-btns sm-orient-btns';
        orientBtns.style.pointerEvents = 'all';
        [
            { val:'auto',              label:'Auto'   },
            { val:'portrait',          label:'Port.'  },
            { val:'reverse-portrait',  label:'↕ Rev.' },
            { val:'landscape',         label:'Land.'  },
            { val:'reverse-landscape', label:'↔ Rev.' },
        ].forEach(function(o){
            const btn = document.createElement('button');
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
        el.appendChild(orientRow);

        // Wire size slider
        setTimeout(function(){
            const sl = document.getElementById('sm-size-slider');
            const sv = document.getElementById('sm-size-val');
            if(sl) sl.addEventListener('input', function(){
                const v = sl.value;
                document.documentElement.style.setProperty('--control-scale', v);
                if(sv) sv.textContent = parseFloat(v).toFixed(1)+'×';
                localStorage.setItem('pokemon_control_scale', v);
            });
        }, 0);
    }

    // --- Navigation ---
    function _goBack() {
        if (page==='pokedex_entry') { page='pokedex'; _render(); return; }
        page='main'; _subIdx=0; _render();
    }

    function _confirmSelected() {
        if (page!=='main') {
            if (page==='save') { const a=['save','load']; _doSaveAction(a[_subIdx]||'save'); }
            else if (page==='journal') { page='achievements'; _achTier=0; _achOffset=0; _subIdx=0; _render(); }
            else if (page==='pokedex' && _dexList && _dexList[_subIdx]) {
                _dexEntry = _dexList[_subIdx];
                page = 'pokedex_entry'; _subIdx = 0; _render();
            } else if (page==='pokemon') {
                // Open summary screen for selected party member
                const party = (window.GameSave && GameSave.state && GameSave.state.party) || [];
                const filled = party.filter(Boolean);
                if (filled[_subIdx] && window.GameSummary) {
                    close();
                    GameSummary.show(_subIdx);
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

    function moveLeft() {
        if (!isOpen) return;
        if (page==='main') { selectedIdx=(selectedIdx-1+ITEMS.length)%ITEMS.length; _render(); return; }
        if (page==='journal') { _journalPage=(_journalPage-1+JOURNAL_PAGES.length)%JOURNAL_PAGES.length; _render(); return; }
        if (page==='bag') { _bagPocket=(_bagPocket-1+8)%8; _subIdx=0; _render(); return; }
    }
    function moveRight() {
        if (!isOpen) return;
        if (page==='main') { selectedIdx=(selectedIdx+1)%ITEMS.length; _render(); return; }
        if (page==='journal') { _journalPage=(_journalPage+1)%JOURNAL_PAGES.length; _render(); return; }
        if (page==='bag') { _bagPocket=(_bagPocket+1)%8; _subIdx=0; _render(); return; }
    }
    function moveUp() {
        if (!isOpen||page==='main') return;
        const c=_subCount(); if(c>0){_subIdx=(_subIdx-1+c)%c;_render();}
    }
    function moveDown() {
        if (!isOpen||page==='main') return;
        const c=_subCount(); if(c>0){_subIdx=(_subIdx+1)%c;_render();}
    }
    function _subCount() {
        if (page==='journal') return 0;  // journal uses L/R page flip, not up/down
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
    function back()    { if(isOpen) { if(page==='main') close(); else _goBack(); } }

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
