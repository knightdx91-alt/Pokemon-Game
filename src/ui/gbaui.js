// GBAUI — pixel-accurate FireRed UI primitives (window frames + bitmap font)
// Renders to an overlay canvas sized identically to the game screen (240x208),
// integer-scaled with nearest-neighbour so menus match the real game.
window.GBAUI = (function () {
    'use strict';

    const W = 240, H = 208;      // logical size, matches #canvas-primary
    const TILE = 8;              // window-frame tile size (std.png is 3x3 tiles)
    const WIN_BG = '#f8f8f8';    // standard text-window interior

    let canvas = null, ctx = null;
    let frame = null;            // window/std.png Image
    let fontImg = null;          // font/normal.png Image
    let fontMeta = null;         // { glyphs:{ch:{x,y,w}}, lineHeight, cell }
    let ready = false;
    let _readyCbs = [];

    function _loadImage(src) {
        return new Promise((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = rej;
            im.src = src;
        });
    }

    async function init() {
        const screen = document.getElementById('screen-primary');
        if (!screen) { console.warn('[GBAUI] no #screen-primary'); return; }

        canvas = document.createElement('canvas');
        canvas.id = 'ui-canvas';
        canvas.width = W; canvas.height = H;
        Object.assign(canvas.style, {
            position: 'absolute', inset: '0', width: '100%', height: '100%',
            imageRendering: 'pixelated', pointerEvents: 'none', zIndex: '250',
            display: 'none'
        });
        screen.appendChild(canvas);
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        try {
            const bust = (window.__CACHE_BUST__ || Date.now());
            [frame, fontImg] = await Promise.all([
                _loadImage(`data/ui/window/std.png?v=${bust}`),
                _loadImage(`data/ui/font/normal.png?v=${bust}`)
            ]);
            const r = await fetch(`data/ui/font/normal.json?v=${bust}`);
            fontMeta = await r.json();
            ready = true;
            _readyCbs.forEach(cb => cb());
            _readyCbs = [];
            console.log('[GBAUI] ready');
        } catch (e) {
            console.error('[GBAUI] asset load failed', e);
        }
    }

    function onReady(cb) { if (ready) cb(); else _readyCbs.push(cb); }

    // ---- low-level drawing (all coords in logical px) ----
    function show() {
        if (canvas) canvas.style.display = 'block';
        if (window.GameHUD && GameHUD.hideInfo) GameHUD.hideInfo();
    }
    function hide() {
        if (canvas) canvas.style.display = 'none';
        if (window.GameHUD && GameHUD.showInfo) GameHUD.showInfo();
    }
    function clear() { if (ctx) ctx.clearRect(0, 0, W, H); }

    /** Draw a FireRed window frame. x,y,w,h in px; w/h should be multiples of 8. */
    function window9(x, y, w, h) {
        if (!ctx || !frame) return;
        // interior fill
        ctx.fillStyle = WIN_BG;
        ctx.fillRect(x + TILE, y + TILE, w - TILE * 2, h - TILE * 2);
        const s = TILE;
        const put = (sx, sy, dx, dy, dw, dh) =>
            ctx.drawImage(frame, sx, sy, s, s, dx, dy, dw, dh);
        // corners
        put(0, 0,      x,           y,            s, s);
        put(2 * s, 0,  x + w - s,   y,            s, s);
        put(0, 2 * s,  x,           y + h - s,    s, s);
        put(2 * s, 2 * s, x + w - s, y + h - s,   s, s);
        // edges (stretch the single edge tile — matches 8px repeat visually)
        put(s, 0,     x + s,       y,            w - 2 * s, s);       // top
        put(s, 2 * s, x + s,       y + h - s,    w - 2 * s, s);       // bottom
        put(0, s,     x,           y + s,        s, h - 2 * s);       // left
        put(2 * s, s, x + w - s,   y + s,        s, h - 2 * s);       // right
    }

    /** Draw a string with the FireRed variable-width font. Returns end x. */
    function text(str, x, y) {
        if (!ctx || !fontImg || !fontMeta) return x;
        const cell = fontMeta.cell || 16;
        let cx = x;
        for (const ch of String(str)) {
            const g = fontMeta.glyphs[ch] || fontMeta.glyphs['?'];
            if (g) {
                ctx.drawImage(fontImg, g.x, g.y, cell, cell, cx, y, cell, cell);
                cx += g.w;
            } else {
                cx += 6;
            }
        }
        return cx;
    }

    function textWidth(str) {
        if (!fontMeta) return 0;
        let w = 0;
        for (const ch of String(str)) {
            const g = fontMeta.glyphs[ch];
            w += g ? g.w : 6;
        }
        return w;
    }

    /** FireRed-style filled right-pointing selection arrow at (x,y) top-left. */
    function cursor(x, y) {
        if (!ctx) return;
        ctx.fillStyle = '#404040';
        // 5px tall triangle, matches the in-game menu cursor shape
        const rows = [1, 3, 5, 3, 1];
        for (let i = 0; i < rows.length; i++) {
            ctx.fillRect(x, y + i, rows[i], 1);
        }
    }

    /** Small left-pointing arrow with top-left at (x,y) (5px tall). */
    function leftArrow(x, y) {
        if (!ctx) return;
        ctx.fillStyle = '#404040';
        const rows = [1, 3, 5, 3, 1];
        for (let i = 0; i < rows.length; i++) {
            ctx.fillRect(x + (5 - rows[i]), y + i, rows[i], 1);
        }
    }

    /** FireRed-style blinking "more text" down arrow, centred on (x,y). */
    function downArrow(x, y) {
        if (!ctx) return;
        ctx.fillStyle = '#404040';
        const rows = [7, 5, 3, 1];   // downward triangle
        for (let i = 0; i < rows.length; i++) {
            ctx.fillRect(x - (rows[i] >> 1), y + i, rows[i], 1);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        onReady, show, hide, clear, window9, text, textWidth, cursor, leftArrow, downArrow,
        get W() { return W; }, get H() { return H; },
        get ready() { return ready; }
    };
})();
