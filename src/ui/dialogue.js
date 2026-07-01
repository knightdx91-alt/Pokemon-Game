// GameDialogue — FireRed field message box with typewriter text + advance arrow.
// Draws through GBAUI so the frame and font match the real game.
window.GameDialogue = (function () {
    'use strict';

    const MARGIN = 8;          // side/bottom margin around the box
    const BOX_H = 48;          // 3-tile-tall message window
    const LINE_H = 16;         // FireRed text line spacing
    const TEXT_PAD = 8;        // interior padding
    const CPS = 40;            // characters per second (typewriter speed)

    let queue = [];            // remaining pages of text
    let full = '';             // full text of current page
    let shown = 0;             // chars revealed so far
    let isOpen = false;
    let done = false;          // current page fully revealed
    let onClose = null;
    let _raf = null, _last = 0, _acc = 0, _blink = 0;

    function _box() {
        const x = MARGIN, w = GBAUI.W - MARGIN * 2;
        const y = GBAUI.H - BOX_H - MARGIN, h = BOX_H;
        return { x, y, w, h };
    }

    // Word-wrap `text` to the box width, returning an array of lines.
    function _wrap(text) {
        const { w } = _box();
        const maxW = w - TEXT_PAD * 2;
        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (const word of words) {
            const trial = line ? line + ' ' + word : word;
            if (GBAUI.textWidth(trial) > maxW && line) {
                lines.push(line);
                line = word;
            } else {
                line = trial;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    // Split wrapped lines into pages of 2 lines each (FireRed shows 2 at a time).
    function _paginate(text) {
        const lines = _wrap(text);
        const pages = [];
        for (let i = 0; i < lines.length; i += 2) {
            pages.push(lines.slice(i, i + 2).join('\n'));
        }
        return pages.length ? pages : [''];
    }

    function _render() {
        if (!isOpen || !GBAUI.ready) return;
        GBAUI.clear();
        const { x, y, w, h } = _box();
        GBAUI.window9(x, y, w, h);
        const visible = full.slice(0, Math.floor(shown));
        const lines = visible.split('\n');
        lines.forEach((ln, i) => {
            GBAUI.text(ln, x + TEXT_PAD, y + TEXT_PAD + i * LINE_H);
        });
        // blinking advance arrow when the page is done
        if (done && (Math.floor(_blink / 30) % 2 === 0)) {
            GBAUI.downArrow(x + w - TEXT_PAD - 3, y + h - TEXT_PAD - 4);
        }
    }

    function _tick(ts) {
        if (!isOpen) return;
        const dt = _last ? ts - _last : 16;
        _last = ts;
        _blink++;
        if (!done) {
            _acc += dt;
            const step = 1000 / CPS;
            while (_acc >= step && shown < full.length) {
                shown++;
                _acc -= step;
            }
            if (shown >= full.length) done = true;
        }
        _render();
        _raf = requestAnimationFrame(_tick);
    }

    function _loadPage(text) {
        full = text;
        shown = 0;
        done = false;
        _acc = 0;
    }

    /** show(text) or show([textA, textB, ...], onDoneCallback). */
    function show(text, cb) {
        const pages = Array.isArray(text)
            ? text.reduce((a, t) => a.concat(_paginate(t)), [])
            : _paginate(text);
        queue = pages;
        onClose = cb || null;
        isOpen = true;
        if (window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show();
        _loadPage(queue.shift());
        _last = 0; _blink = 0;
        cancelAnimationFrame(_raf);
        _raf = requestAnimationFrame(_tick);
    }

    /** A/Enter: finish typing, then advance page, then close. */
    function advance() {
        if (!isOpen) return;
        if (!done) { shown = full.length; done = true; _render(); return; }
        if (queue.length) { _loadPage(queue.shift()); return; }
        close();
    }

    function close() {
        isOpen = false;
        cancelAnimationFrame(_raf);
        _raf = null;
        GBAUI.clear();
        GBAUI.hide();
        const cb = onClose; onClose = null;
        if (cb) cb();
    }

    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key;
        if (k === 'Enter' || k === 'z' || k === 'Z' || k === ' ') {
            e.preventDefault();
            advance();
        } else if (k === 'Escape' || k === 'x' || k === 'X') {
            e.preventDefault();
            // skip to end of current page like holding B
            advance();
        }
    }

    function init() { window.addEventListener('keydown', _onKey); }
    document.addEventListener('DOMContentLoaded', init);

    return { show, advance, close, get isOpen() { return isOpen; } };
})();
