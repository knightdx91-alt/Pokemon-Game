// GamePokedex — FireRed POKéDEX list screen, via GBAUI.
// Placeholder seen/caught list until a real dex data system exists.
window.GamePokedex = (function () {
    'use strict';

    // status: 2 = caught, 1 = seen, 0 = unknown
    const ENTRIES = [
        { no: 1, name: 'BULBASAUR',  st: 2 },
        { no: 4, name: 'CHARMANDER', st: 2 },
        { no: 7, name: 'SQUIRTLE',   st: 1 },
        { no: 10, name: 'CATERPIE',  st: 1 },
        { no: 16, name: 'PIDGEY',    st: 2 },
        { no: 19, name: 'RATTATA',   st: 1 },
        { no: 25, name: 'PIKACHU',   st: 0 },
    ];
    const VISIBLE = 6;
    const ROW_H = 16;
    let top = 0, sel = 0, isOpen = false, onClose = null;

    function _counts() {
        let seen = 0, caught = 0;
        ENTRIES.forEach(e => { if (e.st >= 1) seen++; if (e.st === 2) caught++; });
        return { seen, caught };
    }

    function _render() {
        if (!isOpen || !GBAUI.ready) return;
        GBAUI.clear();
        const W = GBAUI.W, H = GBAUI.H;

        // Left summary panel
        GBAUI.window9(4, 4, 78, H - 8);
        GBAUI.text('POKéDEX', 12, 12);
        const c = _counts();
        GBAUI.text('SEEN', 12, 44);
        GBAUI.text(String(c.seen), 70 - GBAUI.textWidth(String(c.seen)), 44);
        GBAUI.text('OWN', 12, 68);
        GBAUI.text(String(c.caught), 70 - GBAUI.textWidth(String(c.caught)), 68);

        // Right list panel
        const lx = 86, lw = W - 86 - 4;
        GBAUI.window9(lx, 4, lw, H - 8);
        for (let i = 0; i < VISIBLE; i++) {
            const idx = top + i;
            if (idx >= ENTRIES.length) break;
            const e = ENTRIES[idx];
            const y = 12 + i * ROW_H;
            if (idx === sel) GBAUI.cursor(lx + 6, y + 5);
            const dot = e.st === 2 ? '●' : (e.st === 1 ? '◇' : ' ');
            const num = String(e.no).padStart(3, '0');
            GBAUI.text(num, lx + 14, y);
            GBAUI.text(e.st === 0 ? '----------' : e.name, lx + 40, y);
        }
    }

    function open(cb) {
        if (!GBAUI.ready) return;
        top = 0; sel = 0; isOpen = true; onClose = cb || null;
        if (window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show(); _render();
    }
    function close() {
        isOpen = false; GBAUI.clear(); GBAUI.hide();
        const cb = onClose; onClose = null; if (cb) cb();
    }

    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') {
            e.preventDefault(); sel = Math.max(0, sel - 1);
            if (sel < top) top = sel; _render();
        } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
            e.preventDefault(); sel = Math.min(ENTRIES.length - 1, sel + 1);
            if (sel >= top + VISIBLE) top = sel - VISIBLE + 1; _render();
        } else if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace' ||
                   k === 'Enter' || k === 'z' || k === 'Z') {
            e.preventDefault(); close();
        }
    }

    function init() { window.addEventListener('keydown', _onKey); }
    document.addEventListener('DOMContentLoaded', init);

    return { open, close, get isOpen() { return isOpen; } };
})();
