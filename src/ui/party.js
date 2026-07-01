// GameParty — FireRed POKéMON party screen (slots + HP bars), via GBAUI.
// Placeholder party until a real party data system exists.
window.GameParty = (function () {
    'use strict';

    const PARTY = [
        { name: 'CHARMANDER', lvl: 5, hp: 19, maxHp: 19 },
        { name: 'PIDGEY',     lvl: 4, hp: 13, maxHp: 15 },
        { name: 'RATTATA',    lvl: 3, hp: 0,  maxHp: 11 },
    ];

    let sel = 0, isOpen = false, onClose = null;

    function _hpColor(frac) {
        if (frac > 0.5) return '#48c020';   // green
        if (frac > 0.2) return '#f8b000';   // yellow
        return '#f83000';                   // red
    }

    function _slot(mon, x, y, w, h, active) {
        GBAUI.window9(x, y, w, h);
        if (active) GBAUI.cursor(x + 3, y + Math.floor(h / 2) - 2);
        GBAUI.text(mon.name, x + 12, y + 5);
        GBAUI.text('Lv' + mon.lvl, x + w - 36, y + 5);
        // HP label + bar + number, all on the lower line inside the slot
        const barY = y + 26, barH = 6;
        const barX = x + 26, barW = w - 26 - 70;
        GBAUI.text('HP', x + 12, barY - 4);
        _bar(barX, barY, barW, barH, mon.hp / mon.maxHp);
        GBAUI.text(mon.hp + '/' + mon.maxHp, barX + barW + 6, barY - 5);
    }

    // draw an HP bar directly onto the overlay canvas
    function _bar(x, y, w, h, frac) {
        const c = document.getElementById('ui-canvas');
        if (!c) return;
        const g = c.getContext('2d');
        g.fillStyle = '#202020'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
        g.fillStyle = '#585858'; g.fillRect(x, y, w, h);
        g.fillStyle = _hpColor(frac);
        g.fillRect(x, y, Math.max(0, Math.round(w * frac)), h);
    }

    function _render() {
        if (!isOpen || !GBAUI.ready) return;
        GBAUI.clear();
        const W = GBAUI.W, H = GBAUI.H;
        const slotH = 44, gap = 2, x = 4, w = W - 8;
        PARTY.forEach((mon, i) => {
            _slot(mon, x, 4 + i * (slotH + gap), w, slotH, i === sel);
        });
        // CANCEL button bottom-right
        const cy = H - 24;
        GBAUI.window9(W - 72, cy, 68, 20);
        if (sel === PARTY.length) GBAUI.cursor(W - 66, cy + 7);
        GBAUI.text('CANCEL', W - 56, cy + 4);
    }

    function open(cb) {
        if (!GBAUI.ready) return;
        sel = 0; isOpen = true; onClose = cb || null;
        if (window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show(); _render();
    }
    function close() {
        isOpen = false; GBAUI.clear(); GBAUI.hide();
        const cb = onClose; onClose = null; if (cb) cb();
    }

    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key, n = PARTY.length + 1;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); sel = (sel - 1 + n) % n; _render(); }
        else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); sel = (sel + 1) % n; _render(); }
        else if (k === 'Enter' || k === 'z' || k === 'Z') { e.preventDefault(); if (sel === PARTY.length) close(); }
        else if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') { e.preventDefault(); close(); }
    }

    function init() { window.addEventListener('keydown', _onKey); }
    document.addEventListener('DOMContentLoaded', init);

    return { open, close, get isOpen() { return isOpen; } };
})();
