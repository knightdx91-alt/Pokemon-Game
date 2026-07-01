// GameConfirm — reusable FireRed YES/NO box, rendered via GBAUI.
window.GameConfirm = (function () {
    'use strict';

    const ROW_H = 16;
    let isOpen = false, sel = 0, onYes = null, onNo = null, keepOverlay = false;

    function _render() {
        if (!isOpen || !GBAUI.ready) return;
        // Small window in the lower-right, like the field YES/NO prompt.
        const w = 56, h = 8 + ROW_H * 2 + 4;
        const x = GBAUI.W - w - 8, y = GBAUI.H - h - 56;
        GBAUI.window9(x, y, w, h);
        ['YES', 'NO'].forEach((label, i) => {
            const ry = y + 8 + i * ROW_H;
            if (i === sel) GBAUI.cursor(x + 8, ry + 5);
            GBAUI.text(label, x + 18, ry);
        });
    }

    /** open({ onYes, onNo, keepOverlay }) — keepOverlay leaves GBAUI shown for a caller. */
    function open(opts) {
        opts = opts || {};
        onYes = opts.onYes || null;
        onNo = opts.onNo || null;
        keepOverlay = !!opts.keepOverlay;
        sel = 0; isOpen = true;
        if (!keepOverlay && window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show(); _render();
    }

    function _finish(cb) {
        isOpen = false;
        if (!keepOverlay) { GBAUI.clear(); GBAUI.hide(); }
        if (cb) cb();
    }

    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key;
        if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'w' || k === 's' || k === 'W' || k === 'S') {
            e.preventDefault(); sel = sel ? 0 : 1; _render();
        } else if (k === 'Enter' || k === 'z' || k === 'Z') {
            e.preventDefault(); _finish(sel === 0 ? onYes : onNo);
        } else if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') {
            e.preventDefault(); _finish(onNo);
        }
    }

    function init() { window.addEventListener('keydown', _onKey); }
    document.addEventListener('DOMContentLoaded', init);

    return { open, get isOpen() { return isOpen; } };
})();
