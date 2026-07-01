// GameBattle — renders the FireRed battle background scene: a per-terrain
// backdrop gradient with the real extracted terrain platforms composited on top.
window.GameBattle = (function () {
    'use strict';

    const TERRAINS = ['grass', 'longgrass', 'sand', 'water', 'pond',
                      'mountain', 'cave', 'building', 'underwater'];

    // Backdrop gradients approximating each terrain's shared battle-bg palette
    // (the terrain files only carry the platforms; the sky/ground is a gradient).
    const BACKDROP = {
        grass:      [[200, 224, 176], [240, 248, 236]],
        longgrass:  [[176, 208, 144], [224, 240, 208]],
        sand:       [[232, 216, 168], [248, 240, 212]],
        water:      [[120, 176, 224], [200, 224, 240]],
        pond:       [[136, 192, 200], [208, 232, 232]],
        mountain:   [[200, 176, 152], [236, 224, 208]],
        cave:       [[ 72,  64,  80], [128, 120, 136]],
        building:   [[192, 192, 208], [232, 232, 240]],
        underwater: [[ 24,  72, 128], [ 64, 128, 184]],
    };

    let images = {};      // terrain -> HTMLImageElement
    let current = null;
    let onClose = null;

    function preload() {
        const bust = (window.__CACHE_BUST__ || Date.now());
        TERRAINS.forEach(t => {
            const im = new Image();
            im.src = `data/ui/battle/${t}.png?v=${bust}`;
            images[t] = im;
        });
    }

    function _ctx() {
        const c = document.getElementById('ui-canvas');
        return c ? c.getContext('2d') : null;
    }

    function _drawBackdrop(ctx, terrain) {
        const [top, bot] = BACKDROP[terrain] || BACKDROP.grass;
        const H = GBAUI.H, W = GBAUI.W;
        for (let y = 0; y < H; y++) {
            const t = y / (H - 1);
            const r = Math.round(top[0] + (bot[0] - top[0]) * t);
            const g = Math.round(top[1] + (bot[1] - top[1]) * t);
            const b = Math.round(top[2] + (bot[2] - top[2]) * t);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(0, y, W, 1);
        }
    }

    function _render() {
        if (!current || !GBAUI.ready) return;
        const ctx = _ctx();
        if (!ctx) return;
        GBAUI.clear();
        _drawBackdrop(ctx, current);
        const img = images[current];
        if (img && img.complete && img.naturalWidth) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0);
        }
        // intro message box
        const y = GBAUI.H - 48;
        GBAUI.window9(8, y, GBAUI.W - 16, 48);
        GBAUI.text('Wild POKéMON appeared!', 16, y + 8);
    }

    /** start(terrain, onCloseCb) — show the battle scene for the given terrain. */
    function start(terrain, cb) {
        if (!GBAUI.ready) { GBAUI.onReady(() => start(terrain, cb)); return; }
        current = TERRAINS.indexOf(terrain) >= 0 ? terrain : 'grass';
        onClose = cb || null;
        if (window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show();
        _render();
    }

    function close() {
        current = null;
        GBAUI.clear();
        GBAUI.hide();
        const cb = onClose; onClose = null;
        if (cb) cb();
    }

    function _onKey(e) {
        if (!current) return;
        const k = e.key;
        if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Enter' || k === 'z' || k === 'Z') {
            e.preventDefault(); close();
        }
    }

    function init() {
        preload();
        window.addEventListener('keydown', _onKey);
        GBAUI.onReady(preload);
    }
    document.addEventListener('DOMContentLoaded', init);

    return { start, close, get terrains() { return TERRAINS.slice(); }, get active() { return !!current; } };
})();
