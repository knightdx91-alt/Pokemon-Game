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

    function _buildBag(el) {
        const inv = (window.GameSave && GameSave.state && GameSave.state.inventory)
            ? GameSave.state.inventory
            : { items:[], keyItems:[], pokeBalls:[], tms:[], berries:[] };

        const pockets = [
            { label: 'Items',      items: inv.items     || [] },
            { label: 'Key Items',  items: inv.keyItems  || [] },
            { label: 'Poké Balls', items: inv.pokeBalls || [] },
            { label: 'TMs & HMs',  items: inv.tms       || [] },
            { label: 'Berries',    items: inv.berries   || [] },
        ];

        pockets.forEach(function (pocket, i) {
            const row = document.createElement('div');
            row.className = 'sm-row' + (i === _subIdx ? ' selected' : '');
            const arrow = document.createElement('span');
            arrow.className = 'sm-row-arrow';
            arrow.textContent = i === _subIdx ? '▶' : ' ';
            const name = document.createElement('span');
            name.textContent = pocket.label;
            const count = document.createElement('span');
            count.style.cssText = 'margin-left:auto;color:#6090a8;font-size:10px;';
            count.textContent = pocket.items.length ? pocket.items.length + ' item' + (pocket.items.length !== 1 ? 's' : '') : 'Empty';
            row.appendChild(arrow);
            row.appendChild(name);
            row.appendChild(count);
            row.addEventListener('click', function () { _subIdx = i; _render(); });
            el.appendChild(row);
        });

        // If the selected pocket has items, list them below
        const sel = pockets[_subIdx];
        if (sel && sel.items.length) {
            const sep = document.createElement('div'); sep.className = 'sm-sep'; el.appendChild(sep);
            sel.items.forEach(function (entry) {
                const kv = document.createElement('div'); kv.className = 'sm-kv-row';
                kv.innerHTML = '<span class="sm-kv-key">' + (entry.itemId || entry.id || '?') + '</span>'
                    + '<span class="sm-kv-val">×' + (entry.quantity || 1) + '</span>';
                el.appendChild(kv);
            });
        }
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
        const party = (window.GameSave && GameSave.state && GameSave.state.party) || [];
        const filled = party.filter(Boolean);

        if (!filled.length) {
            const empty = document.createElement('div');
            empty.className = 'sm-kv-row';
            empty.style.cssText = 'justify-content:center;color:#6090a8;padding:12px 0;';
            empty.textContent = 'No Pokémon in party';
            el.appendChild(empty);
            return;
        }

        const STATUS_COLOR = { PAR:'#e8c000', BRN:'#e85020', PSN:'#a820e8', FRZ:'#18c8e8', SLP:'#888', FNT:'#e83020' };

        filled.forEach(function(mon, i) {
            const row = document.createElement('div');
            row.className = 'sm-party-row' + (i === _subIdx ? ' selected' : '');
            row.addEventListener('click', function(){ _subIdx = i; _render(); });

            // Cursor
            const cursor = document.createElement('span');
            cursor.className = 'sm-row-arrow';
            cursor.textContent = i === _subIdx ? '▶' : ' ';

            // Species name + nickname
            const nameEl = document.createElement('div');
            nameEl.className = 'sm-party-name';
            const displayName = mon.nickname || mon.speciesId || '???';
            nameEl.textContent = displayName;

            // Level
            const lvEl = document.createElement('div');
            lvEl.className = 'sm-party-lv';
            lvEl.textContent = 'Lv.' + (mon.level || '?');

            // HP bar
            const hpWrap = document.createElement('div');
            hpWrap.className = 'sm-party-hp-wrap';
            const hpPct = mon.maxHp > 0 ? Math.max(0, Math.min(1, mon.currentHp / mon.maxHp)) : 0;
            const hpColor = hpPct > 0.5 ? '#20d840' : hpPct > 0.25 ? '#e8c000' : '#e82020';
            hpWrap.innerHTML =
                '<span class="sm-party-hp-label">HP</span>'
              + '<div class="sm-party-hp-bar"><div style="width:' + Math.round(hpPct*100) + '%;background:' + hpColor + ';height:100%;border-radius:2px;"></div></div>'
              + '<span class="sm-party-hp-num">' + (mon.currentHp||0) + '/' + (mon.maxHp||0) + '</span>';

            // Status badge
            if (mon.statusCondition) {
                const badge = document.createElement('span');
                badge.className = 'sm-party-status';
                badge.textContent = mon.statusCondition;
                badge.style.background = STATUS_COLOR[mon.statusCondition] || '#666';
                nameEl.appendChild(badge);
            }

            const info = document.createElement('div');
            info.className = 'sm-party-info';
            info.appendChild(nameEl);
            info.appendChild(hpWrap);

            row.appendChild(cursor);
            row.appendChild(info);
            row.appendChild(lvEl);
            el.appendChild(row);

            // Expanded detail for selected slot
            if (i === _subIdx) {
                const detail = document.createElement('div');
                detail.className = 'sm-party-detail';
                detail.innerHTML =
                    '<div class="sm-kv-row"><span class="sm-kv-key">Species</span><span class="sm-kv-val">' + (mon.speciesId||'???') + '</span></div>'
                  + '<div class="sm-kv-row"><span class="sm-kv-key">Nature</span><span class="sm-kv-val">' + (mon.nature||'Hardy') + '</span></div>'
                  + '<div class="sm-kv-row"><span class="sm-kv-key">EXP</span><span class="sm-kv-val">' + (mon.exp||0) + '</span></div>'
                  + '<div class="sm-kv-row"><span class="sm-kv-key">Item</span><span class="sm-kv-val">' + (mon.heldItem||'—') + '</span></div>';
                // Moves
                const moveList = (mon.moves||[]).filter(Boolean);
                if (moveList.length) {
                    const sep = document.createElement('div'); sep.className = 'sm-sep'; detail.appendChild(sep);
                    const ml = document.createElement('div'); ml.className='sm-kv-row'; ml.innerHTML='<span class="sm-kv-key" style="color:#80d0e8">Moves</span>'; detail.appendChild(ml);
                    moveList.forEach(function(mv){
                        const mr = document.createElement('div'); mr.className='sm-kv-row';
                        mr.innerHTML='<span class="sm-kv-key" style="padding-left:8px">'+mv+'</span>';
                        detail.appendChild(mr);
                    });
                }
                el.appendChild(detail);
            }
        });
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
        ['Map','Condition','Cancel'].forEach(function(label,i){
            const row=document.createElement('div');
            row.className='sm-row'+(i===_subIdx?' selected':'');
            row.innerHTML='<span class="sm-row-arrow">'+(i===_subIdx?'▶':' ')+'</span><span>'+label+'</span>';
            el.appendChild(row);
        });
        const msg=document.createElement('div'); msg.className='sm-placeholder'; msg.style.marginTop='16px'; msg.textContent='Pokénav features coming soon.'; el.appendChild(msg);
    }

    function _buildSave(el) {
        [{id:'save',label:'💾  Save Game'},{id:'load',label:'📂  Load Game'}].forEach(function(a,i){
            const row=document.createElement('div');
            row.className='sm-row'+(i===_subIdx?' selected':'');
            row.innerHTML='<span class="sm-row-arrow">'+(i===_subIdx?'▶':' ')+'</span><span>'+a.label+'</span>';
            row.addEventListener('click',function(){_subIdx=i;_doSaveAction(a.id);});
            el.appendChild(row);
        });
        if (_saveDone) {
            const msg=document.createElement('div'); msg.className='sm-save-confirm'; msg.textContent='✓ Game saved!'; el.appendChild(msg);
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
        const savedScale = parseFloat(localStorage.getItem('pokemon_control_scale')||'1');
        const currentOrient = window.GameLayout ? GameLayout.getOrientationPref() : 'auto';
        const savedTextSpeed = localStorage.getItem('pokemon_text_speed')||'MED';
        const savedBattleScene = localStorage.getItem('pokemon_battle_scene')||'ON';
        const savedBattleStyle = localStorage.getItem('pokemon_battle_style')||'SHIFT';
        const savedAutoRun = localStorage.getItem('pokemon_auto_run')||'OFF';
        const savedAutosave = localStorage.getItem('pokemon_autosave_int')||'15s';
        const savedControls = (window.GameControls && GameControls.getMode && GameControls.getMode()) || 'dpad';

        // EE-style: 18 options, 7 visible, scrollable, GPU highlight bar (no arrow cursor)
        const list = document.createElement('div');
        list.className = 'sm-opt-list';
        list.style.cssText = 'flex:1;overflow-y:auto;';
        el.style.padding = '0';  // remove inner padding — rows have their own

        function makeToggleRow(label, key, opts, currentVal, onChange) {
            const row = document.createElement('div');
            const myIdx = el._ri;
            row.className = 'sm-opt-row' + (_subIdx === myIdx ? ' selected' : '');
            el._ri = (el._ri || 0) + 1;
            const lbl = document.createElement('span');
            lbl.className = 'sm-opt-label';
            lbl.textContent = label;
            const val = document.createElement('span');
            val.className = 'sm-opt-val-wrap';
            opts.forEach(function(o) {
                const btn = document.createElement('button');
                btn.className = 'sm-opt-btn' + (o === currentVal ? ' active' : '');
                btn.textContent = o;
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    val.querySelectorAll('.sm-opt-btn').forEach(function(b){b.classList.remove('active');});
                    btn.classList.add('active');
                    onChange(o);
                });
                val.appendChild(btn);
            });
            row.appendChild(lbl);
            row.appendChild(val);
            row.addEventListener('click', function(){_subIdx=myIdx;_render();});
            return row;
        }

        el._ri = 0;
        // EE option order (18 total):
        list.appendChild(makeToggleRow('Text Speed',    'pokemon_text_speed',   ['SLOW','MED','FAST'],   savedTextSpeed,  function(v){localStorage.setItem('pokemon_text_speed',v);}));
        list.appendChild(makeToggleRow('Battle Scene',  'pokemon_battle_scene', ['ON','OFF'],             savedBattleScene,function(v){localStorage.setItem('pokemon_battle_scene',v);}));
        list.appendChild(makeToggleRow('Battle Style',  'pokemon_battle_style', ['SHIFT','SET'],          savedBattleStyle,function(v){localStorage.setItem('pokemon_battle_style',v);}));
        list.appendChild(makeToggleRow('Auto Run',       'pokemon_auto_run',     ['OFF','ON'],             savedAutoRun,    function(v){localStorage.setItem('pokemon_auto_run',v);}));
        list.appendChild(makeToggleRow('Autosave',       'pokemon_autosave_int', ['OFF','15s','30s','60s'],savedAutosave,   function(v){localStorage.setItem('pokemon_autosave_int',v);}));
        list.appendChild(makeToggleRow('Controls',       '_ctrl',                ['D-PAD','STICK'],        savedControls==='dpad'?'D-PAD':'STICK', function(v){if(window.GameControls)GameControls.setMode(v==='D-PAD'?'dpad':'joystick');}));

        // Button size row
        const sizeRow = document.createElement('div');
        const sizeIdx = el._ri;
        sizeRow.className = 'sm-opt-row' + (_subIdx === sizeIdx ? ' selected' : '');
        el._ri++;
        sizeRow.innerHTML = '<span class="sm-opt-label">Button Size</span><span class="sm-opt-val-wrap"><input type="range" id="sm-size-slider" min="0.5" max="2" step="0.1" value="'+savedScale+'" style="pointer-events:all"><span id="sm-size-val">'+savedScale.toFixed(1)+'×</span></span>';
        sizeRow.addEventListener('click', function(){_subIdx=sizeIdx;_render();});
        list.appendChild(sizeRow);

        // Orientation row
        const orientRow = document.createElement('div');
        const orientIdx = el._ri;
        orientRow.className = 'sm-opt-row sm-opt-row-col' + (_subIdx === orientIdx ? ' selected' : '');
        el._ri++;
        const orientLabel = document.createElement('span');
        orientLabel.className = 'sm-opt-label';
        orientLabel.textContent = 'Orientation';
        const orientBtns = document.createElement('span');
        orientBtns.className = 'sm-opt-btns sm-orient-btns';
        [
            { val:'auto',             label:'Auto'   },
            { val:'portrait',         label:'Port.'  },
            { val:'reverse-portrait', label:'↕ Rev.' },
            { val:'landscape',        label:'Land.'  },
            { val:'reverse-landscape',label:'↔ Rev.' },
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
        orientRow.appendChild(orientLabel);
        orientRow.appendChild(orientBtns);
        orientRow.addEventListener('click', function(){_subIdx=orientIdx;_render();});
        list.appendChild(orientRow);

        el.appendChild(list);

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
        if (page==='journal') { _journalPage=(_journalPage-1+JOURNAL_PAGES.length)%JOURNAL_PAGES.length; _render(); }
    }
    function moveRight() {
        if (!isOpen) return;
        if (page==='main') { selectedIdx=(selectedIdx+1)%ITEMS.length; _render(); return; }
        if (page==='journal') { _journalPage=(_journalPage+1)%JOURNAL_PAGES.length; _render(); }
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
        if (page==='pokenav') return 3;
        if (page==='options') return 8; // 6 toggles + size + orientation
        if (page==='bag')     return 5;
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
