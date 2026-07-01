// GameDialogueBox — FireRed-style overworld message box rendered on a
// native-resolution canvas with the extracted font.
window.GameDialogueBox = (function () {
    'use strict';

    const CW = 240, CH = 48;

    let box = null, canvas = null, ctx = null;
    let pages = [];
    let onDone = null;
    let rafId = null;
    let visible = false;
    let currentText = '';
    const prev = { a: false, b: false };

    const COL = {
        fill: '#f8f8f8', outer: '#385890', inner: '#88b0d8', cursor: '#e03030'
    };

    function show(messages, done) {
        pages = Array.isArray(messages) ? messages.slice() : [messages];
        onDone = done || null;
        if (!box) build();
        box.style.display = 'block';
        visible = true;
        prev.a = GameInput.state.a;
        prev.b = GameInput.state.b;
        next();
        rafId = requestAnimationFrame(loop);
    }

    function build() {
        box = document.createElement('div');
        box.id = 'dialogue-box';
        canvas = document.createElement('canvas');
        canvas.width = CW; canvas.height = CH;
        box.appendChild(canvas);
        document.body.appendChild(box);
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
    }

    function next() {
        if (pages.length === 0) { close(); return; }
        currentText = pages.shift();
    }

    function close() {
        visible = false;
        cancelAnimationFrame(rafId);
        if (box) box.style.display = 'none';
        const cb = onDone; onDone = null;
        if (cb) cb();
    }

    function redraw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, CW, CH);
        // frame
        roundRect(1, 1, CW - 2, CH - 2, 4);
        ctx.fillStyle = COL.fill; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = COL.outer; ctx.stroke();
        roundRect(4, 4, CW - 8, CH - 8, 3);
        ctx.lineWidth = 1; ctx.strokeStyle = COL.inner; ctx.stroke();
        // text (word-wrapped, 2 lines)
        if (GameFont.ready) drawWrapped(currentText, 10, 9, CW - 20);
        // blinking advance cursor
        if (pages.length >= 0 && Math.floor(Date.now() / 400) % 2 === 0) {
            ctx.fillStyle = COL.cursor;
            ctx.beginPath();
            ctx.moveTo(CW - 14, CH - 11); ctx.lineTo(CW - 8, CH - 11); ctx.lineTo(CW - 11, CH - 6);
            ctx.closePath(); ctx.fill();
        }
    }

    function drawWrapped(text, x, y, maxW) {
        const words = String(text).split(' ');
        let cur = '', line = 0;
        for (const wd of words) {
            const t = cur ? cur + ' ' + wd : wd;
            if (GameFont.measure(t) > maxW && cur) {
                GameFont.draw(ctx, cur, x, y + line * 15, 1); line++; cur = wd;
            } else cur = t;
        }
        if (cur) GameFont.draw(ctx, cur, x, y + line * 15, 1);
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function loop() {
        const s = GameInput.state;
        const edgeA = s.a && !prev.a, edgeB = s.b && !prev.b;
        prev.a = s.a; prev.b = s.b;
        if (edgeA || edgeB) next();
        redraw();
        if (visible) rafId = requestAnimationFrame(loop);
    }

    return { show, get visible() { return visible; } };
})();
