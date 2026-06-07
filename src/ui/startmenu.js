// GameStartMenu — Pokemon-style start menu overlay
window.GameStartMenu = (function () {
    'use strict';

    const ITEMS = [
        'POKEDEX',
        'POKEMON',
        'BAG',
        'PLAYER',
        'SAVE',
        'OPTIONS',
        'EXIT'
    ];

    let menuEl = null;
    let selectedIdx = 0;
    let isOpen = false;
    let _saveMsg = null;
    let _saveMsgTimer = null;

    function _render() {
        if (!menuEl) return;
        menuEl.innerHTML = '';
        ITEMS.forEach(function (label, i) {
            const btn = document.createElement('button');
            btn.className = 'menu-item' + (i === selectedIdx ? ' selected' : '');
            btn.textContent = (i === selectedIdx ? '► ' : '  ') + label;
            btn.addEventListener('click', function () {
                selectedIdx = i;
                _render();
                _confirmSelected();
            });
            menuEl.appendChild(btn);
        });
        if (_saveMsg) {
            const msg = document.createElement('div');
            msg.className = 'menu-save-msg';
            msg.textContent = 'Game Saved!';
            menuEl.appendChild(msg);
        }
    }

    function _confirmSelected() {
        const label = ITEMS[selectedIdx];
        if (label === 'SAVE') {
            localStorage.setItem('pokemon_save_placeholder', Date.now());
            _saveMsg = true;
            _render();
            if (_saveMsgTimer) clearTimeout(_saveMsgTimer);
            _saveMsgTimer = setTimeout(function () {
                _saveMsg = false;
                _render();
            }, 2000);
            return;
        }
        // All others close the menu
        close();
    }

    function open() {
        if (!menuEl) return;
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

    function _onKey(e) {
        if (!isOpen) return;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            selectedIdx = (selectedIdx - 1 + ITEMS.length) % ITEMS.length;
            _render();
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            e.preventDefault();
            selectedIdx = (selectedIdx + 1) % ITEMS.length;
            _render();
        } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            _confirmSelected();
        } else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X' || e.key === 'Backspace') {
            e.preventDefault();
            close();
        }
    }

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

    return { toggle, open, close };
})();
