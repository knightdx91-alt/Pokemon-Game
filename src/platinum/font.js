// PlatFont — renders text in the real Pokémon Platinum system font, decoded
// from the ROM (graphic/pl_font.narc via tools/gen4_font.py). Glyphs are stored
// black-with-alpha; draw() tints them to any colour. window.PlatFont.
(function () {
  'use strict';
  const F = { ready: false, img: null, meta: null, _cb: [] };
  window.PlatFont = F;

  const BASE = 'data/unleashed/platinum_ui/font/';
  fetch(BASE + 'font_small.json').then(r => r.json()).then(meta => {
    F.meta = meta;
    const im = new Image();
    im.onload = () => { F.img = im; F.ready = true; F._cb.forEach(f => f()); F._cb = []; };
    im.src = BASE + 'font_small.png';
  });
  F.onReady = fn => { F.ready ? fn() : F._cb.push(fn); };

  function code(ch) {
    const m = F.meta.map;
    if (m[ch] != null) return m[ch];
    if (ch === ' ') return null;      // handled as advance only
    return m['?'] != null ? m['?'] : null;
  }
  // advance width of a char (proportional)
  function adv(ch) {
    if (ch === ' ') return Math.round(F.meta.widths[F.meta.space] || 5);
    const c = code(ch); return c == null ? 5 : (F.meta.widths[c] || F.meta.w);
  }
  F.measure = (str, scale) => { scale = scale || 1; let x = 0; for (const ch of str) x += (adv(ch) + 1) * scale; return x; };

  // draw string into ctx at (x,y) top-left, tinted `color`, integer `scale`.
  F.draw = function (ctx, str, x, y, color, scale) {
    scale = scale || 1; if (!F.ready) return 0;
    const { w, h, cols } = F.meta;
    // render glyphs to an offscreen buffer, then tint via source-in
    const buf = document.createElement('canvas');
    buf.width = Math.max(1, F.measure(str, 1)); buf.height = h;
    const b = buf.getContext('2d'); let cx = 0;
    for (const ch of str) {
      const c = code(ch);
      if (c != null) {
        const sx = (c % cols) * w, sy = ((c / cols) | 0) * h;
        b.drawImage(F.img, sx, sy, w, h, cx, 0, w, h);
      }
      cx += adv(ch) + 1;
    }
    b.globalCompositeOperation = 'source-in';
    b.fillStyle = color || '#000'; b.fillRect(0, 0, buf.width, buf.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, x, y, buf.width * scale, buf.height * scale);
    return buf.width * scale;
  };

  // return a standalone <canvas> for a string (for DOM insertion)
  F.toCanvas = function (str, color, scale) {
    scale = scale || 2;
    const cv = document.createElement('canvas');
    const wpx = Math.max(1, F.measure(str, 1));
    cv.width = wpx * scale; cv.height = (F.meta ? F.meta.h : 16) * scale;
    cv.style.imageRendering = 'pixelated';
    cv.style.height = (F.meta ? F.meta.h : 16) * scale + 'px';
    cv.style.width = wpx * scale + 'px';
    F.draw(cv.getContext('2d'), str, 0, 0, color, scale);
    cv.dataset.platText = str;
    return cv;
  };
})();
