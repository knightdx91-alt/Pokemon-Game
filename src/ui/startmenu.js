// GameStartMenu — Emerald Enhanced-style full-screen tab overlay
window.GameStartMenu = (function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Tab definitions
    // -----------------------------------------------------------------------
    const TABS = [
        { id: 'journal',      icon: '📋', label: 'Journal'      },
        { id: 'pokemon',      icon: '🔴', label: 'POKéMON'      },
        { id: 'bag',          icon: '🎒', label: 'Bag'           },
        { id: 'achievements', icon: '✅', label: 'Achievements'  },
        { id: 'save',         icon: '💾', label: 'Save'          },
        { id: 'options',      icon: '⚙',  label: 'Options'       },
        { id: 'exit',         icon: '✖',  label: 'Exit'          },
    ];

    const TIER_ICON  = { platinum: '💎', gold: '🥇', silver: '🥈', bronze: '🥉' };
    const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let menuEl      = null;
    let isOpen      = false;
    let tabIdx      = 0;       // which tab is active
    let selectedIdx = 0;       // cursor within tab content
    let _saveDone   = false;

    // -----------------------------------------------------------------------
    // Data helpers
    // -----------------------------------------------------------------------
    function _playtime() {
        const secs = (window.GameSave && GameSave.state && GameSave.state.meta)
            ? (GameSave.state.meta.playtimeSeconds || 0) : 0;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
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

    function _achCount() {
        return (window.GameSave && GameSave.state && GameSave.state.achievements)
            ? ((GameSave.state.achievements.unlocked || []).length) : 0;
    }

    function _trainerId() {
        return (window.GameSave && GameSave.state && GameSave.state.meta)
            ? String(GameSave.state.meta.trainerId || 0).padStart(6,'0') : '000000';
    }

    function _mapName() {
        return (window.GameMap && GameMap.current) ? (GameMap.current.name || '—') : '—';
    }

    function _timeLabel() {
        // Rough day/night based on real clock for now
        const h = new Date().getHours();
        if (h >= 5  && h < 8)  return { label: 'Dawn',  cls: 'time-dawn'  };
        if (h >= 8  && h < 18) return { label: 'Day',   cls: 'time-day'   };
        if (h >= 18 && h < 21) return { label: 'Dusk',  cls: 'time-dusk'  };
        return                         { label: 'Night', cls: 'time-night' };
    }

    function _clockStr() {
        const d = new Date();
        const h = d.getHours();
        const m = String(d.getMinutes()).padStart(2,'0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hh = h % 12 || 12;
        return hh + ':' + m + ' ' + ampm;
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    function _render() {
        if (!menuEl) return;
        menuEl.innerHTML = '';

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'sm-tab-bar';
        TABS.forEach(function (tab, i) {
            const btn = document.createElement('button');
            btn.className = 'sm-tab-btn' + (i === tabIdx ? ' active' : '');
            btn.innerHTML = '<span class="sm-tab-icon">' + tab.icon + '</span>';
            btn.title = tab.label;
            btn.addEventListener('click', function () {
                tabIdx = i;
                selectedIdx = 0;
                _render();
            });
            tabBar.appendChild(btn);
        });
        menuEl.appendChild(tabBar);

        // Section title
        const titleBar = document.createElement('div');
        titleBar.className = 'sm-title-bar';
        titleBar.textContent = TABS[tabIdx].label;
        menuEl.appendChild(titleBar);

        // Content area
        const content = document.createElement('div');
        content.className = 'sm-content';

        const tab = TABS[tabIdx];
        if      (tab.id === 'journal')      _buildJournal(content);
        else if (tab.id === 'pokemon')      _buildPokemon(content);
        else if (tab.id === 'bag')          _buildBag(content);
        else if (tab.id === 'achievements') _buildAchievements(content);
        else if (tab.id === 'save')         _buildSave(content);
        else if (tab.id === 'options')      _buildOptions(content);
        else if (tab.id === 'exit')         { close(); return; }

        menuEl.appendChild(content);

        // Status bar at bottom
        const statusBar = document.createElement('div');
        statusBar.className = 'sm-status-bar';

        const timeInfo = _timeLabel();
        statusBar.innerHTML =
            '<span class="sm-status-item">📍 ' + _mapName() + '</span>'
          + '<span class="sm-status-item sm-status-time ' + timeInfo.cls + '">'
          +   '🕐 ' + _clockStr() + ' <em>(' + timeInfo.label + ')</em>'
          + '</span>'
          + '<span class="sm-status-item">⏱ ' + _playtime() + '</span>'
          + '<span class="sm-status-pokeball">🔴</span>';

        menuEl.appendChild(statusBar);

        // Scroll selected item into view
        const sel = content.querySelector('.sm-row.selected');
        if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // -----------------------------------------------------------------------
    // Tab content builders
    // -----------------------------------------------------------------------

    function _buildJournal(el) {
        const rows = [
            { key: 'Name',       val: _playerName()                    },
            { key: 'Trainer ID', val: _trainerId()                     },
            { key: 'Money',      val: '₽' + _money().toLocaleString() },
            { key: 'Location',   val: _mapName()                       },
            { sep: true },
            { key: 'Badges',     val: _badges() + ' / 8'              },
            { key: 'Ach Points', val: _ap() + ' AP (' + _achCount() + ' unlocked)' },
            { sep: true },
            { key: 'Play Time',  val: _playtime()                      },
        ];

        rows.forEach(function (r) {
            if (r.sep) {
                const sep = document.createElement('div');
                sep.className = 'sm-sep';
                el.appendChild(sep);
                return;
            }
            const row = document.createElement('div');
            row.className = 'sm-kv-row';
            row.innerHTML = '<span class="sm-kv-key">' + r.key + '</span>'
                          + '<span class="sm-kv-val">' + r.val + '</span>';
            el.appendChild(row);
        });
    }

    function _buildPokemon(el) {
        const msg = document.createElement('div');
        msg.className = 'sm-placeholder';
        msg.textContent = 'No Pokémon in party.';
        el.appendChild(msg);
    }

    function _buildBag(el) {
        const msg = document.createElement('div');
        msg.className = 'sm-placeholder';
        msg.textContent = 'Bag is empty.';
        el.appendChild(msg);
    }

    function _buildAchievements(el) {
        const all = window.GameAchievements ? GameAchievements.getAll() : [];
        if (!all.length) {
            const msg = document.createElement('div');
            msg.className = 'sm-placeholder';
            msg.textContent = 'No achievements yet.';
            el.appendChild(msg);
            return;
        }

        let rowIdx = 0;
        TIER_ORDER.forEach(function (tier) {
            const tierAchs = all.filter(function (a) { return a.tier === tier; });
            if (!tierAchs.length) return;

            const hdr = document.createElement('div');
            hdr.className = 'sm-ach-tier-hdr';
            hdr.textContent = TIER_ICON[tier] + ' ' + tier.toUpperCase();
            el.appendChild(hdr);

            tierAchs.forEach(function (a) {
                const row = document.createElement('div');
                row.className = 'sm-row sm-ach-row'
                              + (a.unlocked ? '' : ' locked')
                              + (rowIdx === selectedIdx ? ' selected' : '');
                row.innerHTML = '<span class="sm-ach-icon">' + TIER_ICON[a.tier] + '</span>'
                              + '<span class="sm-ach-name">' + a.name + '</span>'
                              + '<span class="sm-ach-ap">' + a.apReward + ' AP</span>';
                el.appendChild(row);
                rowIdx++;
            });
        });
    }

    function _buildSave(el) {
        const items = [
            { id: 'save',       label: '💾  Save Game'     },
            { id: 'load',       label: '📂  Load Game'     },
            { id: 'newsave',    label: '🆕  New Game'      },
        ];

        items.forEach(function (item, i) {
            const row = document.createElement('div');
            row.className = 'sm-row sm-menu-row' + (i === selectedIdx ? ' selected' : '');
            row.innerHTML = '<span class="sm-row-arrow">' + (i === selectedIdx ? '▶' : ' ') + '</span>'
                          + '<span class="sm-row-label">' + item.label + '</span>';
            row.addEventListener('click', function () {
                selectedIdx = i;
                _confirmSelected();
            });
            el.appendChild(row);
        });

        if (_saveDone) {
            const msg = document.createElement('div');
            msg.className = 'sm-save-confirm';
            msg.textContent = '✓ Game saved!';
            el.appendChild(msg);
        }
    }

    function _buildOptions(el) {
        const savedScale = parseFloat(localStorage.getItem('pokemon_control_scale') || '1');

        const controlRow = document.createElement('div');
        controlRow.className = 'sm-opt-row';
        controlRow.innerHTML =
            '<span class="sm-opt-label">Controls</span>'
          + '<span class="sm-opt-btns">'
          + '<button class="sm-opt-btn" id="sm-dpad-btn">D-Pad</button>'
          + '<button class="sm-opt-btn" id="sm-joy-btn">Joystick</button>'
          + '</span>';
        el.appendChild(controlRow);

        const sizeRow = document.createElement('div');
        sizeRow.className = 'sm-opt-row';
        sizeRow.innerHTML =
            '<span class="sm-opt-label">Button Size</span>'
          + '<span class="sm-opt-btns">'
          + '<input type="range" id="sm-size-slider" min="0.5" max="2" step="0.1" value="' + savedScale + '">'
          + '<span id="sm-size-val">' + savedScale.toFixed(1) + '×</span>'
          + '</span>';
        el.appendChild(sizeRow);

        const dpadBtn = document.getElementById('sm-dpad-btn');
        const joyBtn  = document.getElementById('sm-joy-btn');
        const slider  = document.getElementById('sm-size-slider');
        const sizeVal = document.getElementById('sm-size-val');

        if (dpadBtn) dpadBtn.addEventListener('click', function () {
            if (window.GameControls) GameControls.setMode('dpad');
            dpadBtn.classList.add('active');
            if (joyBtn) joyBtn.classList.remove('active');
        });
        if (joyBtn) joyBtn.addEventListener('click', function () {
            if (window.GameControls) GameControls.setMode('joystick');
            joyBtn.classList.add('active');
            if (dpadBtn) dpadBtn.classList.remove('active');
        });
        if (slider) slider.addEventListener('input', function () {
            const v = slider.value;
            document.documentElement.style.setProperty('--control-scale', v);
            if (sizeVal) sizeVal.textContent = parseFloat(v).toFixed(1) + '×';
            localStorage.setItem('pokemon_control_scale', v);
        });
    }

    // -----------------------------------------------------------------------
    // Confirm action for current tab/selection
    // -----------------------------------------------------------------------
    function _confirmSelected() {
        const tab = TABS[tabIdx];
        if (tab.id === 'exit') { close(); return; }

        if (tab.id === 'save') {
            const items = ['save', 'load', 'newsave'];
            const action = items[selectedIdx];
            if (action === 'save') {
                _saveDone = false;
                if (window.GameSave) GameSave.save(GameSave.currentSlot || 0);
                setTimeout(function () { _saveDone = true; _render(); }, 600);
                _render();
            } else if (action === 'load') {
                if (window.GameSave) GameSave.load(GameSave.currentSlot || 0);
                close();
            }
        }
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    function open() {
        if (!menuEl) return;
        tabIdx = 0;
        selectedIdx = 0;
        _saveDone = false;
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
        if (isOpen) close(); else open();
    }

    function moveUp() {
        if (!isOpen) return;
        const tab = TABS[tabIdx];
        if (tab.id === 'achievements') {
            const all = window.GameAchievements ? GameAchievements.getAll() : [];
            const count = all.length;
            if (count > 0) { selectedIdx = (selectedIdx - 1 + count) % count; _render(); }
        } else if (tab.id === 'save') {
            selectedIdx = (selectedIdx - 1 + 3) % 3;
            _render();
        }
    }

    function moveDown() {
        if (!isOpen) return;
        const tab = TABS[tabIdx];
        if (tab.id === 'achievements') {
            const all = window.GameAchievements ? GameAchievements.getAll() : [];
            const count = all.length;
            if (count > 0) { selectedIdx = (selectedIdx + 1) % count; _render(); }
        } else if (tab.id === 'save') {
            selectedIdx = (selectedIdx + 1) % 3;
            _render();
        }
    }

    function moveLeft() {
        if (!isOpen) return;
        tabIdx = (tabIdx - 1 + TABS.length) % TABS.length;
        selectedIdx = 0;
        _saveDone = false;
        _render();
    }

    function moveRight() {
        if (!isOpen) return;
        tabIdx = (tabIdx + 1) % TABS.length;
        selectedIdx = 0;
        _saveDone = false;
        _render();
    }

    function confirm() {
        if (!isOpen) return;
        _confirmSelected();
    }

    function back() {
        if (!isOpen) return;
        close();
    }

    // -----------------------------------------------------------------------
    // Keyboard handler (desktop)
    // -----------------------------------------------------------------------
    function _onKey(e) {
        if (!isOpen) return;
        if (e.key === 'ArrowLeft'  || e.key === 'q') { e.preventDefault(); moveLeft();  return; }
        if (e.key === 'ArrowRight' || e.key === 'e') { e.preventDefault(); moveRight(); return; }
        if (e.key === 'ArrowUp'    || e.key === 'w') { e.preventDefault(); moveUp();    return; }
        if (e.key === 'ArrowDown'  || e.key === 's') { e.preventDefault(); moveDown();  return; }
        if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') { e.preventDefault(); confirm(); return; }
        if (e.key === 'Escape' || e.key === 'x' || e.key === 'X' || e.key === 'b' || e.key === 'B') {
            e.preventDefault(); close(); return;
        }
    }

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------
    function init() {
        const overlay = document.getElementById('ui-overlay');
        if (!overlay) { console.warn('[StartMenu] #ui-overlay not found'); return; }
        menuEl = document.createElement('div');
        menuEl.id = 'start-menu';
        overlay.appendChild(menuEl);
        window.addEventListener('keydown', _onKey);
    }

    document.addEventListener('DOMContentLoaded', init);

    return { toggle, open, close, moveUp, moveDown, moveLeft, moveRight, confirm, back,
             get isOpen() { return isOpen; } };
})();
