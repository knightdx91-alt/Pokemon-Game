// GameFont — bitmap font renderer using the extracted FireRed Latin glyph atlas.
// Draws proportional pixel text to any 2D canvas context.
window.GameFont = (function () {
    'use strict';

    let atlas = null;   // HTMLImageElement (pre-coloured: dark fg + light shadow)
    let meta = null;    // { lineHeight, space, cell, glyphs: {ch:{x,y,w,adv}} }
    let ready = false;

    async function load() {
        if (ready) return;
        const r = await fetch('data/ui/font.json');
        meta = await r.json();
        atlas = new Image();
        await new Promise((res) => {
            atlas.onload = res;
            atlas.onerror = res;
            atlas.src = meta.atlas;
        });
        ready = true;
        console.log('[Font] Loaded', Object.keys(meta.glyphs).length, 'glyphs');
    }

    /** Pixel width of a string at scale 1. */
    function measure(text) {
        let w = 0;
        for (const ch of String(text)) {
            if (ch === ' ') { w += meta.space; continue; }
            const g = meta.glyphs[ch];
            w += g ? g.adv : meta.space;
        }
        return w;
    }

    /** Draw text with top-left origin (x,y). Integer scale. Returns advance width. */
    function draw(ctx, text, x, y, scale) {
        if (!ready) return 0;
        scale = scale || 1;
        let cx = Math.round(x);
        const cell = meta.cell;
        for (const ch of String(text)) {
            if (ch === ' ') { cx += meta.space * scale; continue; }
            const g = meta.glyphs[ch];
            if (!g) { cx += meta.space * scale; continue; }
            ctx.drawImage(atlas, g.x, g.y, g.w, cell, cx, Math.round(y), g.w * scale, cell * scale);
            cx += g.adv * scale;
        }
        return cx - Math.round(x);
    }

    return {
        load, measure, draw,
        get ready() { return ready; },
        get lineHeight() { return meta ? meta.lineHeight : 14; },
        get space() { return meta ? meta.space : 6; }
    };
})();
