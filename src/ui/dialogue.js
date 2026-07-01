// GameDialogueBox — simple overworld message box. Shows pages of text,
// advances on A/B, resolves a callback when dismissed.
window.GameDialogueBox = (function () {
    'use strict';

    let box = null;
    let textEl = null;
    let pages = [];
    let onDone = null;
    let rafId = null;
    let visible = false;
    const prev = { a: false, b: false };

    function show(messages, done) {
        pages = Array.isArray(messages) ? messages.slice() : [messages];
        onDone = done || null;
        if (!box) build();
        box.classList.remove('hidden');
        visible = true;
        prev.a = GameInput.state.a;   // swallow the A press that opened this
        prev.b = GameInput.state.b;
        next();
        rafId = requestAnimationFrame(loop);
    }

    function build() {
        box = document.createElement('div');
        box.id = 'dialogue-box';
        box.className = 'hidden';
        box.innerHTML = `<div class="dialogue-text"></div><div class="dialogue-cursor">▼</div>`;
        document.body.appendChild(box);
        textEl = box.querySelector('.dialogue-text');
    }

    function next() {
        if (pages.length === 0) { close(); return; }
        textEl.textContent = pages.shift();
    }

    function close() {
        visible = false;
        cancelAnimationFrame(rafId);
        if (box) box.classList.add('hidden');
        const cb = onDone; onDone = null;
        if (cb) cb();
    }

    function loop() {
        const s = GameInput.state;
        const edgeA = s.a && !prev.a;
        const edgeB = s.b && !prev.b;
        prev.a = s.a; prev.b = s.b;
        if (edgeA || edgeB) next();
        if (visible) rafId = requestAnimationFrame(loop);
    }

    return { show, get visible() { return visible; } };
})();
