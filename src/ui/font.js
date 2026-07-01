// GameFont — shared GBA bitmap-font renderer.
//
// Draws pixel-exact text onto a canvas 2D context using the FireRed/Emerald
// font atlases bundled at src/assets/party/ (font_normal.png = 16x16 cells,
// font_small.png = 8x16 cells, 16 glyphs per row) + party_meta.json
// (per-glyph pixel widths + charmap). The atlas encodes each glyph with a red
// marker for the foreground and a blue marker for the shadow, so any screen can
// recolour the text to whatever palette it needs.
//
// Every menu/battle screen should render its text through this module so the
// look is identical everywhere.
window.GameFont = (function () {
    'use strict';

    var ASSET_DIR = 'src/assets/party/';
    var _img = { normal: null, small: null };
    var _meta = null;
    var _ready = false;
    var _queue = [];

    function load(cb) {
        if (_ready) { if (cb) cb(); return; }
        if (cb) _queue.push(cb);
        if (_img.normal || _img.small) return;   // already loading
        var pending = 3;
        function done() {
            if (--pending > 0) return;
            _ready = true;
            var q = _queue; _queue = [];
            q.forEach(function (f) { f(); });
        }
        _img.normal = new Image();
        _img.normal.onload = _img.normal.onerror = done;
        _img.normal.src = ASSET_DIR + 'font_normal.png';
        _img.small = new Image();
        _img.small.onload = _img.small.onerror = done;
        _img.small.src = ASSET_DIR + 'font_small.png';
        fetch(ASSET_DIR + 'party_meta.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { _meta = j; done(); })
            .catch(function () { _meta = { charmap: {}, normalWidths: [], smallWidths: [] }; done(); });
    }

    function isReady() { return _ready; }

    // --- Recolour cache: tint the red/blue markers to fg/shadow. -------------
    var _tintCache = {};
    function _hexToRgb(h) {
        h = ('' + h).replace('#', '');
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function _tint(kind, fg, shadow) {
        var src = _img[kind];
        if (!src || !src.width) return null;
        var key = kind + '|' + fg + '|' + shadow;
        if (_tintCache[key]) return _tintCache[key];
        var c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        var x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(src, 0, 0);
        var d = x.getImageData(0, 0, c.width, c.height);
        var fgc = _hexToRgb(fg), shc = shadow ? _hexToRgb(shadow) : null;
        for (var i = 0; i < d.data.length; i += 4) {
            if (d.data[i + 3] === 0) continue;
            var r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
            if (r > 200 && g < 80 && b < 80) {          // red marker -> fg
                d.data[i] = fgc[0]; d.data[i + 1] = fgc[1]; d.data[i + 2] = fgc[2];
            } else if (shc && b > 200 && r < 80 && g < 80) { // blue marker -> shadow
                d.data[i] = shc[0]; d.data[i + 1] = shc[1]; d.data[i + 2] = shc[2];
            } else {
                d.data[i + 3] = 0;                       // drop everything else
            }
        }
        x.putImageData(d, 0, 0);
        _tintCache[key] = c;
        return c;
    }

    function _cell(kind, gid) {
        if (kind === 'small') return { sx: (gid % 16) * 8, sy: ((gid / 16) | 0) * 16, w: 8 };
        return { sx: (gid % 16) * 16, sy: ((gid / 16) | 0) * 16, w: 16 };
    }
    function _widths(kind) { return kind === 'small' ? _meta.smallWidths : _meta.normalWidths; }

    // Measure a string's advance width in font pixels.
    function measure(text, kind) {
        if (!_meta) return 0;
        kind = kind || 'normal';
        var w = _widths(kind), cm = _meta.charmap, total = 0;
        for (var i = 0; i < text.length; i++) {
            var gid = cm[text[i]];
            total += (gid === undefined ? 6 : (w[gid] || 6));
        }
        return total;
    }

    // Draw text at native-pixel (gx,gy), scaled by S, into ctx.
    //   opts: { kind:'normal'|'small', color, shadow, scale, align:'left'|'right'|'center', maxWidth }
    // Returns the x pen position after the last glyph (in native pixels).
    function draw(ctx, text, gx, gy, opts) {
        opts = opts || {};
        if (!_ready || !_meta) return gx;
        var kind = opts.kind || 'normal';
        var S = opts.scale || 1;
        var sheet = _tint(kind, opts.color || '#404040', opts.shadow || null);
        if (!sheet) return gx;
        var w = _widths(kind), cm = _meta.charmap;
        if (opts.align === 'right') gx -= measure(text, kind);
        else if (opts.align === 'center') gx -= (measure(text, kind) / 2) | 0;
        ctx.imageSmoothingEnabled = false;
        for (var i = 0; i < text.length; i++) {
            var gid = cm[text[i]];
            if (gid === undefined) { gx += 6; continue; }
            var cell = _cell(kind, gid);
            ctx.drawImage(sheet, cell.sx, cell.sy, cell.w, 16,
                Math.round(gx * S), Math.round(gy * S), cell.w * S, 16 * S);
            gx += (w[gid] || 6);
        }
        return gx;
    }

    return { load: load, isReady: isReady, measure: measure, draw: draw };
})();
