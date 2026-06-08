// GameStartMenu — Emerald Enhanced-style start menu
window.GameStartMenu = (function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------
    const TIER_ICON = { platinum: '💎', gold: '🥇', silver: '🥈', bronze: '🥉' };
    const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

    // Main menu items — matches Emerald Enhanced layout
    // Player name replaces TRAINER CARD as its own item (as in the original)
    function _mainItems() {
        const name = _playerName();
        return [
            { id: 'POKEMON',      label: 'POKéMON'      },
            { id: 'BAG',          label: 'PACK'          },
            { id: 'TRAINER_CARD', label: name            },
            { id: 'POKENAV',      label: 'POKéNAV'      },
            { id: 'SAVE',         label: 'SAVE'          },
            { id: 'OPTIONS',      label: 'OPTIONS'       },
            { id: 'EXIT',         label: 'CLOSE'         },
        ];
    }
    // Keep a static reference for item count; items are built fresh each render
    const MAIN_ITEMS_STATIC = [
        'POKEMON','BAG','TRAINER_CARD','POKENAV','SAVE','OPTIONS','EXIT'
    ];

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let menuEl      = null;   // #start-menu
    let isOpen      = false;
    let page        = 'main'; // 'main' | 'trainer_card' | 'achievements' | 'factions' | 'save' | 'options'
    let selectedIdx = 0;
    let scrollTop   = 0;      // for scrollable sub-pages

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    function _playtime() {
        const secs = (window.GameSave && GameSave.state && GameSave.state.meta)
            ? (GameSave.state.meta.playtimeSeconds || 0)
            : 0;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function _playerName() {
        return (window.GameSave && GameSave.state && GameSave.state.player)
            ? (GameSave.state.player.name || 'TRAINER')
            : 'TRAINER';
    }

    function _money() {
        return (window.GameSave && GameSave.state && GameSave.state.player)
            ? (GameSave.state.player.money || 0)
            : 0;
    }

    function _badges() {
        return (window.GameSave && GameSave.state && GameSave.state.meta)
            ? (GameSave.state.meta.badgeCount || 0)
            : 0;
    }

    function _ap() {
        return (window.GameSave && GameSave.state && GameSave.state.achievements)
            ? (GameSave.state.achievements.totalAP || 0)
            : 0;
    }

    function _achCount() {
        return (window.GameSave && GameSave.state && GameSave.state.achievements)
            ? ((GameSave.state.achievements.unlocked || []).length)
            : 0;
    }

    function _trainerId() {
        return (window.GameSave && GameSave.state && GameSave.state.meta)
            ? String(GameSave.state.meta.trainerId || 0).padStart(6, '0')
            : '000000';
    }

    function _lifeSkills() {
        if (window.GameSave && GameSave.state && GameSave.state.lifeSkills) {
            return GameSave.state.lifeSkills;
        }
        return { alchemy: 0, botany: 0, mining: 0 };
    }

    function _topFaction() {
        if (!window.GameFactions) return null;
        let best = null, bestVal = -1;
        for (const id of Object.keys(GameFactions.FACTIONS)) {
            const val = GameFactions.getStanding(id);
            if (val > bestVal) { bestVal = val; best = id; }
        }
        if (!best) return null;
        return {
            name: GameFactions.FACTIONS[best].name,
            rank: GameFactions.getRank(best)
        };
    }

    // -----------------------------------------------------------------------
    // Render helpers — build DOM for each page
    // -----------------------------------------------------------------------

    /** Shared header row (name + play time) */
    function _makeHeader() {
        const hdr = document.createElement('div');
        hdr.className = 'sm-header';
        const nameEl = document.createElement('span');
        nameEl.className = 'sm-header-name';
        nameEl.textContent = _playerName();
        const timeEl = document.createElement('span');
        timeEl.className = 'sm-header-time';
        timeEl.textContent = _playtime();
        hdr.appendChild(nameEl);
        hdr.appendChild(timeEl);
        return hdr;
    }

    /** Back button item rendered as first item in sub-pages */
    function _makeBackRow() {
        const row = document.createElement('div');
        row.className = 'sm-item' + (selectedIdx === 0 ? ' selected' : '');
        row.innerHTML = '<span class="sm-arrow">' + (selectedIdx === 0 ? '►' : ' ') + '</span>'
                      + '<span class="sm-label">← BACK</span>';
        row.addEventListener('click', function () { _navBack(); });
        return row;
    }

    function _renderMain() {
        menuEl.innerHTML = '';
        menuEl.appendChild(_makeHeader());

        _mainItems().forEach(function (item, i) {
            const row = document.createElement('div');
            row.className = 'sm-item' + (i === selectedIdx ? ' selected' : '');
            row.innerHTML = '<span class="sm-arrow">' + (i === selectedIdx ? '►' : ' ') + '</span>'
                          + '<span class="sm-label">' + item.label + '</span>';
            row.addEventListener('click', function () {
                selectedIdx = i;
                _confirmSelected();
            });
            menuEl.appendChild(row);
        });
    }

    function _renderTrainerCard() {
        menuEl.innerHTML = '';
        menuEl.appendChild(_makeHeader());

        const body = document.createElement('div');
        body.className = 'sm-subpage';

        const topFaction = _topFaction();
        const ls = _lifeSkills();

        const rows = [
            ['← BACK', null],
            null, // separator
            ['NAME',       _playerName()],
            ['TRAINER ID', _trainerId()],
            ['MONEY',      '$' + _money().toLocaleString()],
            ['PLAY TIME',  _playtime()],
            ['BADGES',     _badges() + ' / 8'],
            ['ACH POINTS', _ap() + ' AP  (' + _achCount() + ' unlocked)'],
            ['TOP FACTION', topFaction ? topFaction.name + ' — ' + topFaction.rank : '—'],
            null,
            ['LIFE SKILLS', ''],
            ['  Alchemy',  'Lv ' + (ls.alchemy || 0)],
            ['  Botany',   'Lv ' + (ls.botany  || 0)],
            ['  Mining',   'Lv ' + (ls.mining  || 0)],
            null,
            ['ACHIEVEMENTS', '→']
        ];

        // Build flat items list (nulls = separators)
        let itemIdx = 0;
        rows.forEach(function (r) {
            if (r === null) {
                const sep = document.createElement('div');
                sep.className = 'sm-sep';
                body.appendChild(sep);
                return;
            }
            const [key, val] = r;
            const row = document.createElement('div');
            const isSelectable = (key === '← BACK' || key === 'ACHIEVEMENTS →' || key === 'ACHIEVEMENTS');
            const rowData = { key, val, selectable: isSelectable, idx: itemIdx };
            itemIdx++;

            row.className = 'sm-card-row' + (isSelectable ? ' sm-selectable' : '');
            if (isSelectable) {
                const myIdx = rowData.idx;
                row.addEventListener('click', function () {
                    if (key === '← BACK') { _navBack(); }
                    else { page = 'achievements'; selectedIdx = 0; scrollTop = 0; _render(); }
                });
            }
            const kEl = document.createElement('span');
            kEl.className = 'sm-card-key';
            kEl.textContent = key;
            row.appendChild(kEl);
            if (val !== '' && val !== null) {
                const vEl = document.createElement('span');
                vEl.className = 'sm-card-val';
                vEl.textContent = val;
                row.appendChild(vEl);
            }
            body.appendChild(row);
        });

        menuEl.appendChild(body);

        // Keyboard on trainer card: only BACK and ACHIEVEMENTS are "selectable"
        menuEl.dataset.page = 'trainer_card';
    }

    function _renderAchievements() {
        menuEl.innerHTML = '';
        menuEl.appendChild(_makeHeader());

        const body = document.createElement('div');
        body.className = 'sm-subpage sm-scroll';

        // Back row
        const backRow = document.createElement('div');
        backRow.className = 'sm-item' + (selectedIdx === 0 ? ' selected' : '');
        backRow.innerHTML = '<span class="sm-arrow">' + (selectedIdx === 0 ? '►' : ' ') + '</span>'
                          + '<span class="sm-label">← BACK</span>';
        backRow.addEventListener('click', function () { _navBack(); });
        body.appendChild(backRow);

        const all = window.GameAchievements ? GameAchievements.getAll() : [];
        let listIdx = 1;

        TIER_ORDER.forEach(function (tier) {
            const tierAchs = all.filter(function (a) { return a.tier === tier; });
            if (!tierAchs.length) return;

            const tierHdr = document.createElement('div');
            tierHdr.className = 'sm-ach-tier-hdr';
            tierHdr.textContent = TIER_ICON[tier] + ' ' + tier.toUpperCase();
            body.appendChild(tierHdr);

            tierAchs.forEach(function (a) {
                const row = document.createElement('div');
                row.className = 'sm-ach-row' + (a.unlocked ? '' : ' locked') + (listIdx === selectedIdx ? ' selected' : '');
                row.innerHTML = '<span class="sm-ach-icon">' + TIER_ICON[a.tier] + '</span>'
                              + '<span class="sm-ach-name">' + a.name + '</span>'
                              + '<span class="sm-ach-ap">' + a.apReward + ' AP</span>';
                listIdx++;
                body.appendChild(row);
            });
        });

        menuEl.appendChild(body);
        menuEl.dataset.page = 'achievements';
        // Scroll to keep selection visible
        _scrollToSelected(body);
    }

    function _renderFactions() {
        menuEl.innerHTML = '';
        menuEl.appendChild(_makeHeader());

        const body = document.createElement('div');
        body.className = 'sm-subpage sm-scroll';

        // Back row
        const backRow = document.createElement('div');
        backRow.className = 'sm-item' + (selectedIdx === 0 ? ' selected' : '');
        backRow.innerHTML = '<span class="sm-arrow">' + (selectedIdx === 0 ? '►' : ' ') + '</span>'
                          + '<span class="sm-label">← BACK</span>';
        backRow.addEventListener('click', function () { _navBack(); });
        body.appendChild(backRow);

        const factions = window.GameFactions ? Object.keys(GameFactions.FACTIONS) : [];
        factions.forEach(function (id) {
            const def = GameFactions.FACTIONS[id];
            const standing = GameFactions.getStanding(id);
            const rank = GameFactions.getRank(id);
            const pct = Math.round((standing / 200) * 100);

            const row = document.createElement('div');
            row.className = 'sm-faction-row';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'sm-faction-name';
            nameSpan.textContent = def.name;

            const rankSpan = document.createElement('span');
            rankSpan.className = 'sm-faction-rank';
            rankSpan.textContent = rank;

            const barWrap = document.createElement('div');
            barWrap.className = 'sm-faction-bar-wrap';
            const barFill = document.createElement('div');
            barFill.className = 'sm-faction-bar-fill';
            barFill.style.width = pct + '%';
            barWrap.appendChild(barFill);

            row.appendChild(nameSpan);
            row.appendChild(rankSpan);
            row.appendChild(barWrap);
            body.appendChild(row);
        });

        menuEl.appendChild(body);
        menuEl.dataset.page = 'factions';
    }

    function _renderSave() {
        menuEl.innerHTML = '';
        menuEl.appendChild(_makeHeader());

        const body = document.createElement('div');
        body.className = 'sm-subpage';

        const backRow = document.createElement('div');
        backRow.className = 'sm-item' + (selectedIdx === 0 ? ' selected' : '');
        backRow.innerHTML = '<span class="sm-arrow">' + (selectedIdx === 0 ? '►' : ' ') + '</span>'
                          + '<span class="sm-label">← BACK</span>';
        backRow.addEventListener('click', function () { _navBack(); });
        body.appendChild(backRow);

        const msgEl = document.createElement('div');
        msgEl.className = 'sm-save-msg';
        msgEl.textContent = 'Saving…';
        body.appendChild(msgEl);

        menuEl.appendChild(body);
        menuEl.dataset.page = 'save';

        // Perform save
        if (window.GameSave) {
            GameSave.save(GameSave.currentSlot || 0);
        }
        setTimeout(function () {
            msgEl.textContent = '✓ Saved!';
            msgEl.classList.add('done');
        }, 600);
    }

    function _renderOptions() {
        menuEl.innerHTML = '';
        menuEl.appendChild(_makeHeader());

        const body = document.createElement('div');
        body.className = 'sm-subpage';

        const backRow = document.createElement('div');
        backRow.className = 'sm-item' + (selectedIdx === 0 ? ' selected' : '');
        backRow.innerHTML = '<span class="sm-arrow">' + (selectedIdx === 0 ? '►' : ' ') + '</span>'
                          + '<span class="sm-label">← BACK</span>';
        backRow.addEventListener('click', function () { _navBack(); });
        body.appendChild(backRow);

        // Control mode toggle
        const modeRow = document.createElement('div');
        modeRow.className = 'sm-opt-row';
        modeRow.innerHTML = '<span class="sm-opt-label">Controls</span>'
                          + '<span class="sm-opt-btns">'
                          + '<button class="sm-opt-btn" id="sm-dpad-btn">D-Pad</button>'
                          + '<button class="sm-opt-btn" id="sm-joy-btn">Joystick</button>'
                          + '</span>';
        body.appendChild(modeRow);

        // Button size slider
        const sizeRow = document.createElement('div');
        sizeRow.className = 'sm-opt-row';
        const savedScale = parseFloat(localStorage.getItem('pokemon_control_scale') || '1');
        sizeRow.innerHTML = '<span class="sm-opt-label">Button Size</span>'
                          + '<span class="sm-opt-btns">'
                          + '<input type="range" id="sm-size-slider" min="0.5" max="2" step="0.1" value="' + savedScale + '">'
                          + '<span id="sm-size-val">' + savedScale.toFixed(1) + '×</span>'
                          + '</span>';
        body.appendChild(sizeRow);

        menuEl.appendChild(body);
        menuEl.dataset.page = 'options';

        // Wire controls
        const dpadBtn = document.getElementById('sm-dpad-btn');
        const joyBtn  = document.getElementById('sm-joy-btn');
        const slider  = document.getElementById('sm-size-slider');
        const sizeVal = document.getElementById('sm-size-val');

        if (dpadBtn) {
            dpadBtn.addEventListener('click', function () {
                if (window.GameControls) GameControls.setMode('dpad');
                dpadBtn.classList.add('active');
                if (joyBtn) joyBtn.classList.remove('active');
            });
        }
        if (joyBtn) {
            joyBtn.addEventListener('click', function () {
                if (window.GameControls) GameControls.setMode('joystick');
                joyBtn.classList.add('active');
                if (dpadBtn) dpadBtn.classList.remove('active');
            });
        }
        if (slider) {
            slider.addEventListener('input', function () {
                const v = slider.value;
                document.documentElement.style.setProperty('--control-scale', v);
                if (sizeVal) sizeVal.textContent = parseFloat(v).toFixed(1) + '×';
                localStorage.setItem('pokemon_control_scale', v);
            });
        }
    }

    // -----------------------------------------------------------------------
    // Scroll helper
    // -----------------------------------------------------------------------
    function _scrollToSelected(container) {
        const sel = container.querySelector('.selected');
        if (sel) {
            sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    // -----------------------------------------------------------------------
    // Number of selectable items per page (for cursor wrap)
    // -----------------------------------------------------------------------
    function _itemCount() {
        if (page === 'main') return MAIN_ITEMS_STATIC.length;
        if (page === 'achievements') {
            const all = window.GameAchievements ? GameAchievements.getAll() : [];
            return 1 + all.length; // back + each achievement
        }
        if (page === 'factions') return 1; // only back is keyboard-navigable
        if (page === 'trainer_card') return 1; // back + achievements link
        if (page === 'save') return 1;
        if (page === 'options') return 1;
        return 1;
    }

    // -----------------------------------------------------------------------
    // Render dispatcher
    // -----------------------------------------------------------------------
    function _render() {
        if (!menuEl) return;
        if (page === 'main')          _renderMain();
        else if (page === 'trainer_card') _renderTrainerCard();
        else if (page === 'achievements') _renderAchievements();
        else if (page === 'factions')     _renderFactions();
        else if (page === 'save')         _renderSave();
        else if (page === 'options')      _renderOptions();
    }

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------
    function _navBack() {
        // Achievements can be reached from trainer_card or pokenav
        if (page === 'achievements' && _prevPage === 'trainer_card') {
            page = 'trainer_card';
        } else {
            page = 'main';
        }
        selectedIdx = 0;
        _render();
    }

    let _prevPage = 'main';

    function _confirmSelected() {
        if (page === 'main') {
            const item = _mainItems()[selectedIdx];
            if (!item) return;
            if (item.id === 'EXIT') { close(); return; }
            if (item.id === 'SAVE') { _prevPage = 'main'; page = 'save'; selectedIdx = 0; _render(); return; }
            if (item.id === 'OPTIONS') { _prevPage = 'main'; page = 'options'; selectedIdx = 0; _render(); return; }
            if (item.id === 'TRAINER_CARD') { _prevPage = 'main'; page = 'trainer_card'; selectedIdx = 0; _render(); return; }
            if (item.id === 'POKENAV') { _prevPage = 'main'; page = 'factions'; selectedIdx = 0; _render(); return; }
            // Other items (POKEDEX, POKEMON, BAG) — close menu for now
            close();
            return;
        }
        // Sub-pages: only index 0 = BACK is cursor-navigable via keyboard
        if (selectedIdx === 0) { _navBack(); return; }
        // Achievements list items: nothing to "confirm" — just visual browsing
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    function open() {
        if (!menuEl) return;
        page = 'main';
        selectedIdx = 0;
        isOpen = true;
        menuEl.classList.add('open');
        _render();
    }

    function close() {
        if (!menuEl) return;
        isOpen = false;
        menuEl.classList.remove('open');
    }

    function toggle() {
        if (isOpen) close();
        else open();
    }

    // -----------------------------------------------------------------------
    // Keyboard handler
    // -----------------------------------------------------------------------
    function _onKey(e) {
        if (!isOpen) return;
        const count = _itemCount();
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            if (page === 'main' || page === 'achievements') {
                selectedIdx = (selectedIdx - 1 + count) % count;
                _render();
            }
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            e.preventDefault();
            if (page === 'main' || page === 'achievements') {
                selectedIdx = (selectedIdx + 1) % count;
                _render();
            }
        } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            _confirmSelected();
        } else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X' || e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            if (page === 'main') close();
            else _navBack();
        }
    }

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------
    function init() {
        const overlay = document.getElementById('ui-overlay');
        if (!overlay) {
            console.warn('[StartMenu] #ui-overlay not found');
            return;
        }
        menuEl = document.createElement('div');
        menuEl.id = 'start-menu';
        menuEl.className = 'pokemon-menu';
        overlay.appendChild(menuEl);

        window.addEventListener('keydown', _onKey);
    }

    document.addEventListener('DOMContentLoaded', init);

    function moveUp() {
        if (!isOpen) return;
        const count = _itemCount();
        if (page === 'main' || page === 'achievements') {
            selectedIdx = (selectedIdx - 1 + count) % count;
            _render();
        }
    }

    function moveDown() {
        if (!isOpen) return;
        const count = _itemCount();
        if (page === 'main' || page === 'achievements') {
            selectedIdx = (selectedIdx + 1) % count;
            _render();
        }
    }

    function confirm() {
        if (!isOpen) return;
        _confirmSelected();
    }

    function back() {
        if (!isOpen) return;
        if (page === 'main') close();
        else _navBack();
    }

    return { toggle, open, close, moveUp, moveDown, confirm, back, get isOpen() { return isOpen; } };
})();
