// GameStartMenu — FireRed-style start menu, drawn with GBAUI (real frame + font)
window.GameStartMenu = (function () {
    'use strict';

    // FireRed main menu entries (PLAYER row shows the player's name in-game).
    const ITEMS = ['POKéDEX', 'POKéMON', 'BAG', 'PLAYER', 'SAVE', 'OPTION', 'EXIT'];

    const ROW_H = 16;      // FireRed menu line height
    const PAD_X = 8;       // interior left padding before the cursor
    const ARROW_W = 8;     // space reserved for the selection arrow

    let selectedIdx = 0;
    let isOpen = false;
    let _saveMsg = false;
    let _saveMsgTimer = null;

    function _menuMetrics() {
        let maxText = 0;
        for (const label of ITEMS) maxText = Math.max(maxText, GBAUI.textWidth(label));
        const winW = _round8(PAD_X + ARROW_W + maxText + PAD_X);
        const winH = 16 + ITEMS.length * ROW_H;   // 8px frame top+bottom
        const winX = GBAUI.W - winW - 2;           // flush to top-right
        const winY = 0;
        return { winX, winY, winW, winH };
    }

    function _round8(n) { return Math.ceil(n / 8) * 8; }

    function _render() {
        if (!isOpen || !GBAUI.ready) return;
        GBAUI.clear();
        const { winX, winY, winW, winH } = _menuMetrics();
        GBAUI.window9(winX, winY, winW, winH);

        const textX = winX + PAD_X + ARROW_W;
        ITEMS.forEach((label, i) => {
            const rowY = winY + 8 + i * ROW_H;
            if (i === selectedIdx) GBAUI.cursor(winX + PAD_X, rowY + 5);
            GBAUI.text(label, textX, rowY);
        });

        if (_saveMsg) {
            const mw = 120, mh = 24;
            const mx = Math.floor((GBAUI.W - mw) / 2), my = GBAUI.H - mh - 4;
            GBAUI.window9(mx, my, mw, mh);
            GBAUI.text('Saved the game.', mx + 8, my + 8);
        }
    }

    function open() {
        if (!GBAUI.ready) return;
        selectedIdx = 0;
        isOpen = true;
        GBAUI.show();
        _render();
    }

    function close() {
        isOpen = false;
        GBAUI.clear();
        GBAUI.hide();
    }

    function toggle() { isOpen ? close() : open(); }

    function _confirmSelected() {
        const label = ITEMS[selectedIdx];
        // Map each entry to its screen; each reopens the start menu on exit.
        const screens = {
            'POKéDEX': window.GamePokedex,
            'POKéMON': window.GameParty,
            'BAG':     window.GameBag,
            'PLAYER':  window.GameTrainerCard,
            'OPTION':  window.GameOptions,
            'SAVE':    window.GameSaveScreen,
        };
        const scr = screens[label];
        if (scr && scr.open) {
            isOpen = false;
            GBAUI.clear();
            scr.open(function () { open(); });   // reopen menu on exit
            return;
        }
        close();   // EXIT (and any unmapped entry)
    }

    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') {
            e.preventDefault();
            selectedIdx = (selectedIdx - 1 + ITEMS.length) % ITEMS.length;
            _render();
        } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
            e.preventDefault();
            selectedIdx = (selectedIdx + 1) % ITEMS.length;
            _render();
        } else if (k === 'Enter' || k === 'z' || k === 'Z') {
            e.preventDefault();
            _confirmSelected();
        } else if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') {
            e.preventDefault();
            close();
        }
    }

    function init() {
        window.addEventListener('keydown', _onKey);
    }

    document.addEventListener('DOMContentLoaded', init);

    return { toggle, open, close, get isOpen() { return isOpen; } };
})();
