// GameStartMenu — Emerald Enhanced-style horizontal icon carousel
window.GameStartMenu = (function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Menu items — matches Emerald Enhanced BuildNormalStartMenu order
    // icon: sprite sheet path; both normal (top 32px) and selected (bottom 32px)
    // -----------------------------------------------------------------------
    const ITEMS = [
        { id: 'POKEDEX',  label: 'Pokédex',   icon: 'start_icon_pokedex.png'  },
        { id: 'POKEMON',  label: 'Pokémon',   icon: 'start_icon_pokemon.png'  },
        { id: 'BAG',      label: 'Pack',       icon: 'start_icon_bag.png'      },
        { id: 'POKENAV',  label: 'Pokénav',   icon: 'start_icon_pokenav.png'  },
        { id: 'JOURNAL',  label: 'Journal',   icon: 'start_icon_journal.png'  },
        { id: 'PLAYER',   label: '',          icon: 'start_icon_empty.png'    },
        { id: 'SAVE',     label: 'Save',       icon: 'start_icon_save.png'     },
        { id: 'OPTIONS',  label: 'Options',    icon: 'start_icon_options.png'  },
        { id: 'EXIT',     label: 'Exit',       icon: 'start_icon_empty.png'    },
    ];

    const ICON_PATH = 'src/assets/start_menu/';

    const TIER_ICON  = { platinum: '💎', gold: '🥇', silver: '🥈', bronze: '🥉' };
    const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    let menuEl      = null;
    let isOpen      = false;
    let selectedIdx = 0;
    let page        = 'main';   // 'main' | 'journal' | 'save' | 'options' | 'achievements' | 'pokenav'
    let _saveDone   = false;
    let _subIdx     = 0;        // cursor within sub-page lists

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

    function _achList() {
        return (window.GameSave && GameSave.state && GameSave.state.achievements)
            ? ((GameSave.state.achievements.unlocked || [])) : [];
    }

    function _trainerId() {
        return (window.GameSave && GameSave.state && GameSave.state.meta)
            ? String(GameSave.state.meta.trainerId || 0).padStart(6,'0') : '000000';
    }

    function _mapName() {
        return (window.GameMap && GameMap.current) ? (GameMap.current.name || '—') : '—';
    }

    function _timeOfDay() {
        const h = new Date().getHours();
        if (h >= 5  && h < 8)  return { label: 'Dawn',  cls: 'tod-dawn'  };
        if (h >= 8  && h < 18) return { label: 'Day',   cls: 'tod-day'   };
        if (h >= 18 && h < 21) return { label: 'Dusk',  cls: 'tod-dusk'  };
        return                         { label: 'Night', cls: 'tod-night' };
    }

    function _clockStr() {
        const d = new Date();
        const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
        const ampm = h >= 12 ? 'pm' : 'am';
        return (h % 12 || 12) + ':' + m + ' ' + ampm;
    }

    function _dayOfWeek() {
        return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    }

    function _season() {
        const mo = new Date().getMonth();
        if (mo <= 1 || mo === 11) return 'Winter';
        if (mo <= 4)  return 'Spring';
        if (mo <= 7)  return 'Summer';
        return 'Autumn';
    }

    function _lifeSkills() {
        return (window.GameSave && GameSave.state && GameSave.state.lifeSkills)
            ? GameSave.state.lifeSkills : { alchemy: 0, botany: 0, mining: 0 };
    }

    // -----------------------------------------------------------------------
    // Build full overlay
    // -----------------------------------------------------------------------
    function _render() {
        if (!menuEl) return;
        menuEl.innerHTML = '';

        if (page !== 'main') {
            _renderSubPage();
            return;
        }

        // --- Label bar at top ---
        const item = ITEMS[selectedIdx];
        const labelBar = document.createElement('div');
        labelBar.className = 'sm-label-bar';
        const labelText = item.id === 'PLAYER' ? _playerName() : item.label;
        labelBar.textContent = labelText;
        menuEl.appendChild(labelBar);

        // --- Spacer ---
        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        menuEl.appendChild(spacer);

        // --- Icon carousel ---
        const carousel = document.createElement('div');
        carousel.className = 'sm-carousel';

        ITEMS.forEach(function (itm, i) {
            const wrap = document.createElement('div');
            wrap.className = 'sm-icon-wrap' + (i === selectedIdx ? ' selected' : '');
            wrap.dataset.idx = i;

            const img = document.createElement('div');
            img.className = 'sm-icon-sprite';
            // Use background-image + background-position to show top (normal) or bottom (selected) half
            img.style.backgroundImage = 'url("' + ICON_PATH + itm.icon + '")';
            img.style.backgroundPositionY = i === selectedIdx ? '-32px' : '0px';
            img.title = itm.id === 'PLAYER' ? _playerName() : itm.label;

            wrap.appendChild(img);
            wrap.addEventListener('click', function () {
                selectedIdx = i;
                _confirmSelected();
            });
            carousel.appendChild(wrap);
        });

        menuEl.appendChild(carousel);

        // --- Info box at bottom (EE style) ---
        const tod = _timeOfDay();
        const infoBox = document.createElement('div');
        infoBox.className = 'sm-info-box';
        infoBox.innerHTML =
            '<div class="sm-info-line1">'
          +   '<span>Played: ' + _playtime() + ' / Normal</span>'
          +   '<span class="sm-info-ver">📍 ' + _mapName() + '</span>'
          + '</div>'
          + '<div class="sm-info-line2">'
          +   '<span>' + _clockStr() + ' ◆ </span>'
          +   '<span class="sm-tod ' + tod.cls + '">' + tod.label + '</span>'
          +   '<span> ' + _dayOfWeek() + ' · ' + _season() + '</span>'
          + '</div>';
        menuEl.appendChild(infoBox);
    }

    // -----------------------------------------------------------------------
    // Sub-pages (Journal, Trainer Card, Achievements, Pokénav, Save, Options)
    // -----------------------------------------------------------------------
    function _renderSubPage() {
        // Back bar at top
        const backBar = document.createElement('div');
        backBar.className = 'sm-sub-back-bar';

        const backBtn = document.createElement('button');
        backBtn.className = 'sm-back-btn';
        backBtn.textContent = '◀ BACK';
        backBtn.addEventListener('click', function () { _goBack(); });
        backBar.appendChild(backBtn);

        const titleEl = document.createElement('span');
        titleEl.className = 'sm-sub-title';
        const titles = { journal:'Journal', trainer_card:'Trainer Card',
                         achievements:'Achievement Atlas', pokenav:'Pokénav',
                         save:'Save', options:'Options' };
        titleEl.textContent = titles[page] || page;
        backBar.appendChild(titleEl);
        menuEl.appendChild(backBar);

        const content = document.createElement('div');
        content.className = 'sm-sub-content';

        if      (page === 'trainer_card')  _buildTrainerCard(content);
        else if (page === 'journal')       _buildJournal(content);
        else if (page === 'achievements')  _buildAchievements(content);
        else if (page === 'pokenav')       _buildPokenav(content);
        else if (page === 'save')          _buildSave(content);
        else if (page === 'options')       _buildOptions(content);

        menuEl.appendChild(content);

        // Scroll to selection
        setTimeout(function () {
            const sel = content.querySelector('.sm-row.selected');
            if (sel) sel.scrollIntoView({ block: 'nearest' });
        }, 0);
    }

    function _buildTrainerCard(el) {
        const ls = _lifeSkills();
        const rows = [
            { key: 'Name',        val: _playerName()                              },
            { key: 'Trainer ID',  val: _trainerId()                               },
            { key: 'Money',       val: '₽' + _money().toLocaleString()           },
            { key: 'Location',    val: _mapName()                                 },
            { sep: true },
            { key: 'Badges',      val: _badges() + ' / 8'                        },
            { key: 'Ach Points',  val: _ap() + ' AP  (' + _achList().length + ' unlocked)' },
            { key: 'Play Time',   val: _playtime()                                },
            { sep: true },
            { key: 'Life Skills', val: '' },
            { key: '  Botany',    val: 'Lv ' + (ls.botany  || 0)                },
            { key: '  Mining',    val: 'Lv ' + (ls.mining  || 0)                },
            { key: '  Alchemy',   val: 'Lv ' + (ls.alchemy || 0)               },
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

    function _buildJournal(el) {
        // EE Journal has 4 sections: Factions, Achievement Atlas, Powers, Quests
        const sections = [
            { id: 'achievements', label: '🏆  Achievement Atlas' },
            { id: 'factions',     label: '🏴  Factions'          },
            { id: 'skills',       label: '⚗   Life Skills'        },
            { id: 'stats',        label: '📊  Stats'              },
        ];
        sections.forEach(function (s, i) {
            const row = document.createElement('div');
            row.className = 'sm-row' + (i === _subIdx ? ' selected' : '');
            row.innerHTML = '<span class="sm-row-arrow">' + (i === _subIdx ? '▶' : ' ') + '</span>'
                          + '<span>' + s.label + '</span>';
            row.addEventListener('click', function () {
                _subIdx = i;
                if (s.id === 'achievements') { page = 'achievements'; _subIdx = 0; _render(); }
                else if (s.id === 'stats')   { _buildStatsInline(el); }
            });
            el.appendChild(row);
        });

        // Life skills summary
        const ls = _lifeSkills();
        const sep = document.createElement('div'); sep.className = 'sm-sep'; el.appendChild(sep);
        [['Botany', ls.botany||0], ['Mining', ls.mining||0], ['Alchemy', ls.alchemy||0]].forEach(function (r) {
            const kv = document.createElement('div');
            kv.className = 'sm-kv-row';
            kv.innerHTML = '<span class="sm-kv-key">  ' + r[0] + '</span>'
                         + '<span class="sm-kv-val">Lv ' + r[1] + '</span>';
            el.appendChild(kv);
        });
    }

    function _buildStatsInline(el) {
        // Clear and rebuild with stats
        el.innerHTML = '';
        const rows = [
            { key: 'Prestige Level', val: '0'  },
            { key: 'Achievements',   val: _achList().length },
            { key: 'Badges',         val: _badges() + ' / 8' },
            { sep: true },
            { key: 'Steps Taken',    val: '0'  },
            { key: 'Battles Won',    val: '0'  },
            { key: 'Battles Lost',   val: '0'  },
            { key: 'Pokémon Caught', val: '0'  },
        ];
        rows.forEach(function (r) {
            if (r.sep) { const s=document.createElement('div'); s.className='sm-sep'; el.appendChild(s); return; }
            const row = document.createElement('div');
            row.className = 'sm-kv-row';
            row.innerHTML = '<span class="sm-kv-key">' + r.key + '</span>'
                          + '<span class="sm-kv-val">' + r.val + '</span>';
            el.appendChild(row);
        });
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
                row.className = 'sm-ach-row' + (a.unlocked ? '' : ' locked') + (rowIdx === _subIdx ? ' selected' : '');
                row.innerHTML = '<span>' + TIER_ICON[a.tier] + '</span>'
                              + '<span class="sm-ach-name">' + a.name + '</span>'
                              + '<span class="sm-ach-ap">' + a.apReward + ' AP</span>';
                el.appendChild(row);
                rowIdx++;
            });
        });
    }

    function _buildPokenav(el) {
        const items = ['Map', 'Condition', 'Cancel'];
        items.forEach(function (label, i) {
            const row = document.createElement('div');
            row.className = 'sm-row' + (i === _subIdx ? ' selected' : '');
            row.innerHTML = '<span class="sm-row-arrow">' + (i === _subIdx ? '▶' : ' ') + '</span>'
                          + '<span>' + label + '</span>';
            el.appendChild(row);
        });
        const msg = document.createElement('div');
        msg.className = 'sm-placeholder';
        msg.style.marginTop = '16px';
        msg.textContent = 'Pokénav features coming soon.';
        el.appendChild(msg);
    }

    function _buildSave(el) {
        const actions = [
            { id: 'save', label: '💾  Save Game'  },
            { id: 'load', label: '📂  Load Game'  },
        ];
        actions.forEach(function (a, i) {
            const row = document.createElement('div');
            row.className = 'sm-row' + (i === _subIdx ? ' selected' : '');
            row.innerHTML = '<span class="sm-row-arrow">' + (i === _subIdx ? '▶' : ' ') + '</span>'
                          + '<span>' + a.label + '</span>';
            row.addEventListener('click', function () { _subIdx = i; _doSaveAction(a.id); });
            el.appendChild(row);
        });
        if (_saveDone) {
            const msg = document.createElement('div');
            msg.className = 'sm-save-confirm';
            msg.textContent = '✓ Game saved!';
            el.appendChild(msg);
        }
    }

    function _doSaveAction(id) {
        if (id === 'save') {
            _saveDone = false;
            if (window.GameSave) GameSave.save(GameSave.currentSlot || 0);
            setTimeout(function () { _saveDone = true; _render(); }, 500);
            _render();
        } else if (id === 'load') {
            if (window.GameSave) GameSave.load(GameSave.currentSlot || 0);
            close();
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
    // Navigation helpers
    // -----------------------------------------------------------------------
    function _goBack() {
        page = 'main';
        _subIdx = 0;
        _render();
    }

    function _confirmSelected() {
        if (page !== 'main') {
            // Sub-page confirm
            if (page === 'save') {
                const actions = ['save', 'load'];
                _doSaveAction(actions[_subIdx] || 'save');
            } else if (page === 'journal') {
                const sections = ['achievements', 'factions', 'skills', 'stats'];
                const id = sections[_subIdx];
                if (id === 'achievements') { page = 'achievements'; _subIdx = 0; _render(); }
            }
            return;
        }

        const item = ITEMS[selectedIdx];
        if (!item) return;

        switch (item.id) {
            case 'EXIT':    close(); break;
            case 'SAVE':    _saveDone = false; page = 'save';         _subIdx = 0; _render(); break;
            case 'OPTIONS': page = 'options';      _subIdx = 0; _render(); break;
            case 'JOURNAL': page = 'journal';      _subIdx = 0; _render(); break;
            case 'POKENAV': page = 'pokenav';      _subIdx = 0; _render(); break;
            case 'PLAYER':  page = 'trainer_card'; _subIdx = 0; _render(); break;
            default: close(); break;
        }
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    function open() {
        if (!menuEl) return;
        selectedIdx = 0;
        page = 'main';
        _subIdx = 0;
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

    function toggle() { if (isOpen) close(); else open(); }

    function moveLeft() {
        if (!isOpen) return;
        if (page === 'main') {
            selectedIdx = (selectedIdx - 1 + ITEMS.length) % ITEMS.length;
            _render();
        }
    }

    function moveRight() {
        if (!isOpen) return;
        if (page === 'main') {
            selectedIdx = (selectedIdx + 1) % ITEMS.length;
            _render();
        }
    }

    function moveUp() {
        if (!isOpen || page === 'main') return;
        // Sub-page: move cursor up
        const count = _subPageItemCount();
        if (count > 0) { _subIdx = (_subIdx - 1 + count) % count; _render(); }
    }

    function moveDown() {
        if (!isOpen || page === 'main') return;
        const count = _subPageItemCount();
        if (count > 0) { _subIdx = (_subIdx + 1) % count; _render(); }
    }

    function _subPageItemCount() {
        if (page === 'journal') return 4;
        if (page === 'save')    return 2;
        if (page === 'pokenav') return 3;
        if (page === 'achievements') {
            return window.GameAchievements ? GameAchievements.getAll().length : 0;
        }
        return 0;
    }

    function confirm() { if (!isOpen) return; _confirmSelected(); }
    function back()    { if (!isOpen) return; if (page === 'main') close(); else _goBack(); }

    // -----------------------------------------------------------------------
    // Keyboard handler
    // -----------------------------------------------------------------------
    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key;
        if (k === 'ArrowLeft'  || k === 'q') { e.preventDefault(); moveLeft();  return; }
        if (k === 'ArrowRight' || k === 'e') { e.preventDefault(); moveRight(); return; }
        if (k === 'ArrowUp'    || k === 'w') { e.preventDefault(); moveUp();    return; }
        if (k === 'ArrowDown'  || k === 's') { e.preventDefault(); moveDown();  return; }
        if (k === 'Enter' || k === 'z' || k === 'Z') { e.preventDefault(); confirm(); return; }
        if (k === 'Escape' || k === 'x' || k === 'X' || k === 'b' || k === 'B') {
            e.preventDefault(); back(); return;
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
