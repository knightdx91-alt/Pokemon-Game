// GameBag — FireRed BAG screen (pockets + item list + description), via GBAUI.
window.GameBag = (function () {
    'use strict';

    const POCKETS = ['ITEMS', 'KEY ITEMS', 'POKé BALLS', 'TMs & HMs'];
    // Placeholder contents until a real item/bag system exists.
    const CONTENTS = {
        'ITEMS':      [{ n: 'POTION', q: 3 }, { n: 'ANTIDOTE', q: 1 }, { n: 'REPEL', q: 2 }],
        'KEY ITEMS':  [{ n: 'TOWN MAP', q: 1 }, { n: 'BIKE VOUCHER', q: 1 }],
        'POKé BALLS': [{ n: 'POKé BALL', q: 5 }, { n: 'GREAT BALL', q: 2 }],
        'TMs & HMs':  [{ n: 'TM01', q: 1 }, { n: 'HM01', q: 1 }],
    };
    const DESC = {
        'POTION': 'Restores the HP of a\nPokémon by 20 points.',
        'ANTIDOTE': 'Heals a poisoned\nPokémon.',
        'REPEL': 'Keeps weak wild Pokémon\naway for 100 steps.',
        'TOWN MAP': "A map of the region.\nUse it to see where\nyou're going.",
        'BIKE VOUCHER': 'Redeem for a BICYCLE\nat the BIKE SHOP.',
        'POKé BALL': 'A device for catching\nwild Pokémon.',
        'GREAT BALL': 'Better than a POKé BALL,\nwith a higher catch rate.',
        'TM01': 'Teaches a move to a\ncompatible Pokémon.',
        'HM01': 'Teaches CUT. Can be\nused outside battle.',
    };

    const ROW_H = 16;
    let pocket = 0, row = 0, isOpen = false, onClose = null;

    function _list() { return CONTENTS[POCKETS[pocket]] || []; }

    function _render() {
        if (!isOpen || !GBAUI.ready) return;
        const W = GBAUI.W, H = GBAUI.H;
        GBAUI.clear();

        // Pocket name bar
        GBAUI.window9(0, 0, W, 24);
        const name = POCKETS[pocket];
        GBAUI.leftArrow(8, 10);                 // ◀ switch pocket
        GBAUI.cursor(W - 13, 10);               // ▶ switch pocket
        GBAUI.text(name, Math.floor((W - GBAUI.textWidth(name)) / 2), 5);

        // Item list window
        const listY = 24, listH = H - 24 - 48;
        GBAUI.window9(0, listY, W, listH);
        const items = _list();
        items.forEach((it, i) => {
            const y = listY + 8 + i * ROW_H;
            if (i === row) GBAUI.cursor(8, y + 5);
            GBAUI.text(it.n, 16, y);
            const qty = 'x' + String(it.q).padStart(2, ' ');
            GBAUI.text(qty, W - 16 - GBAUI.textWidth('x00'), y);
        });
        const cy = listY + 8 + items.length * ROW_H;
        if (row === items.length) GBAUI.cursor(8, cy + 5);
        GBAUI.text('CANCEL', 16, cy);

        // Description window
        const dY = H - 48;
        GBAUI.window9(0, dY, W, 48);
        const cur = items[row];
        const lines = (cur ? (DESC[cur.n] || '') : 'Close the BAG.').split('\n');
        lines.forEach((ln, i) => GBAUI.text(ln, 8, dY + 8 + i * ROW_H));
    }

    function open(cb) {
        if (!GBAUI.ready) return;
        pocket = 0; row = 0; isOpen = true; onClose = cb || null;
        if (window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show(); _render();
    }
    function close() {
        isOpen = false; GBAUI.clear(); GBAUI.hide();
        const cb = onClose; onClose = null; if (cb) cb();
    }

    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key, n = _list().length + 1;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); row = (row - 1 + n) % n; _render(); }
        else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); row = (row + 1) % n; _render(); }
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); pocket = (pocket - 1 + POCKETS.length) % POCKETS.length; row = 0; _render(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); pocket = (pocket + 1) % POCKETS.length; row = 0; _render(); }
        else if (k === 'Enter' || k === 'z' || k === 'Z') { e.preventDefault(); if (row === _list().length) close(); }
        else if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') { e.preventDefault(); close(); }
    }

    function init() { window.addEventListener('keydown', _onKey); }
    document.addEventListener('DOMContentLoaded', init);

    return { open, close, get isOpen() { return isOpen; } };
})();
