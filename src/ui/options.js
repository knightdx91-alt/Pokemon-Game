// GameOptions — FireRed OPTION screen, rendered via GBAUI.
window.GameOptions = (function () {
    'use strict';

    // Each option: label + selectable values. Mirrors FireRed's OPTION menu.
    const OPTS = [
        { key: 'textSpeed',   label: 'TEXT SPEED',   values: ['SLOW', 'MID', 'FAST'] },
        { key: 'battleScene', label: 'BATTLE SCENE', values: ['ON', 'OFF'] },
        { key: 'battleStyle', label: 'BATTLE STYLE', values: ['SHIFT', 'SET'] },
        { key: 'sound',       label: 'SOUND',        values: ['MONO', 'STEREO'] },
        { key: 'buttonMode',  label: 'BUTTON MODE',  values: ['NORMAL', 'LR', 'L=A'] },
        { key: 'frame',       label: 'FRAME',        values: ['TYPE 1'] },
    ];
    const HELP = {
        textSpeed: 'Choose how fast text appears.',
        battleScene: 'See Pokémon battle animations.',
        battleStyle: 'Change Pokémon during battle?',
        sound: 'Change the sound output.',
        buttonMode: 'Change how buttons work.',
        frame: 'Choose a window frame.',
        cancel: 'Close this menu.',
    };

    const ROW_H = 18;
    let sel = {};              // key -> chosen index
    let row = 0;               // 0..OPTS.length (last = CANCEL)
    let isOpen = false;
    let onClose = null;

    function _initSel() {
        const saved = (window.GameSave && GameSave.state && GameSave.state.options) || {};
        OPTS.forEach(o => {
            const v = saved[o.key];
            const i = o.values.indexOf(v);
            sel[o.key] = i >= 0 ? i : 0;
        });
    }

    function _persist() {
        if (!(window.GameSave && GameSave.state)) return;
        GameSave.state.options = GameSave.state.options || {};
        OPTS.forEach(o => { GameSave.state.options[o.key] = o.values[sel[o.key]]; });
    }

    function _render() {
        if (!isOpen || !GBAUI.ready) return;
        const W = GBAUI.W, H = GBAUI.H;
        GBAUI.clear();

        // Title bar
        GBAUI.window9(0, 0, W, 24);
        GBAUI.text('OPTION', 8, 5);

        // Main options window
        const mainY = 24, mainH = H - 24 - 40;
        GBAUI.window9(0, mainY, W, mainH);
        OPTS.forEach((o, i) => {
            const y = mainY + 8 + i * ROW_H;
            if (i === row) GBAUI.cursor(6, y + 5);
            GBAUI.text(o.label, 14, y);
            // values laid out to the right; current one gets bracket arrows
            let vx = 132;
            o.values.forEach((val, vi) => {
                const chosen = vi === sel[o.key];
                if (chosen && i === row) GBAUI.leftArrow(vx - 8, y + 5);
                vx = GBAUI.text(val, vx, y);
                if (chosen && i === row) { GBAUI.cursor(vx + 2, y + 5); vx += 8; }
                vx += 8;
            });
        });
        // CANCEL row
        const cy = mainY + 8 + OPTS.length * ROW_H;
        if (row === OPTS.length) GBAUI.cursor(6, cy + 5);
        GBAUI.text('CANCEL', 14, cy);

        // Help/description window
        const helpY = H - 40;
        GBAUI.window9(0, helpY, W, 40);
        const key = row < OPTS.length ? OPTS[row].key : 'cancel';
        GBAUI.text(HELP[key] || '', 8, helpY + 8);
    }

    function open(cb) {
        if (!GBAUI.ready) return;
        _initSel();
        row = 0;
        isOpen = true;
        onClose = cb || null;
        if (window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show();
        _render();
    }

    function close() {
        _persist();
        isOpen = false;
        GBAUI.clear();
        GBAUI.hide();
        const cb = onClose; onClose = null;
        if (cb) cb();
    }

    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key;
        const n = OPTS.length + 1;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') {
            e.preventDefault(); row = (row - 1 + n) % n; _render();
        } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
            e.preventDefault(); row = (row + 1) % n; _render();
        } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
            e.preventDefault(); _cycle(-1); _render();
        } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
            e.preventDefault(); _cycle(1); _render();
        } else if (k === 'Enter' || k === 'z' || k === 'Z') {
            e.preventDefault(); if (row === OPTS.length) close();
        } else if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') {
            e.preventDefault(); close();
        }
    }

    function _cycle(dir) {
        if (row >= OPTS.length) return;
        const o = OPTS[row];
        sel[o.key] = (sel[o.key] + dir + o.values.length) % o.values.length;
    }

    function init() { window.addEventListener('keydown', _onKey); }
    document.addEventListener('DOMContentLoaded', init);

    return { open, close, get isOpen() { return isOpen; } };
})();
