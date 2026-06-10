// GameControls — free-floating GBA buttons, individually draggable + resizable
// Layout persisted per-button in localStorage under 'pokemon_btn_layout_v1'
window.GameControls = (function () {
    'use strict';

    const STORAGE_KEY = 'pokemon_btn_layout_v1';
    let mode        = 'dpad';   // 'dpad' | 'joystick'
    let editMode    = false;
    let layer       = null;     // #controls-layer element
    let savedLayout = {};       // { btnId: { xPct, yPct, sizePx } }

    // -----------------------------------------------------------------------
    // Default layout — percentages of screen (left%, top%) + base size in px.
    // Positions assume portrait phone: game screen fills top ~60vh,
    // controls zone is the bottom ~40vh.
    // -----------------------------------------------------------------------
    const DEFAULTS = {
        dpad:        { xPct: 4,  yPct: 70, wPx: 120, hPx: 120 },
        joystick:    { xPct: 4,  yPct: 68, wPx: 120, hPx: 120 },
        'btn-a':     { xPct: 74, yPct: 68, wPx: 60,  hPx: 60  },
        'btn-b':     { xPct: 61, yPct: 79, wPx: 52,  hPx: 52  },
        'btn-l':     { xPct: 0,  yPct: 61, wPx: 90,  hPx: 38  },
        'btn-r':     { xPct: 73, yPct: 61, wPx: 90,  hPx: 38  },
        'btn-start': { xPct: 54, yPct: 90, wPx: 64,  hPx: 36  },
        'btn-select':{ xPct: 35, yPct: 90, wPx: 64,  hPx: 36  },
    };

    // -----------------------------------------------------------------------
    // Persistence
    // -----------------------------------------------------------------------
    function loadLayout() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) savedLayout = JSON.parse(raw);
        } catch(e) { savedLayout = {}; }
    }

    function saveLayout() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLayout));
    }

    function getLayout(id) {
        return savedLayout[id] || DEFAULTS[id] || { xPct: 50, yPct: 50, sizePx: 50 };
    }

    // -----------------------------------------------------------------------
    // Apply position + size to a widget element.
    // Reads --control-scale from CSS to scale the base sizePx.
    // -----------------------------------------------------------------------
    function _getScale() {
        const v = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--control-scale')
        );
        return isNaN(v) ? 1 : Math.max(0.4, Math.min(3, v));
    }

    function applyLayout(el, id) {
        const lay   = getLayout(id);
        const scale = _getScale();
        // Support legacy sizePx (square) and new wPx/hPx (non-square)
        const wPx = lay.wPx !== undefined ? lay.wPx : (lay.sizePx || 60);
        const hPx = lay.hPx !== undefined ? lay.hPx : (lay.sizePx || 60);
        el.style.left   = lay.xPct + '%';
        el.style.top    = lay.yPct + '%';
        el.style.width  = Math.round(wPx * scale) + 'px';
        el.style.height = Math.round(hPx * scale) + 'px';
    }

    // -----------------------------------------------------------------------
    // Make a widget draggable + resizable (edit mode only).
    // Uses touch+mouse (NOT pointer events) so there are zero competing
    // non-passive pointerdown listeners on the widget that could suppress
    // the button's own pointer/touch event handlers.
    // -----------------------------------------------------------------------
    function makeDraggable(widget, id) {
        let drag = false, startX, startY, startLeft, startTop;

        function cx(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
        function cy(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

        function onStart(e) {
            if (!editMode) return;
            if (e.target.classList.contains('ctrl-resize-handle')) return;
            drag = true;
            startX = cx(e); startY = cy(e);
            const rect  = widget.getBoundingClientRect();
            const lRect = layer.getBoundingClientRect();
            startLeft = rect.left - lRect.left;
            startTop  = rect.top  - lRect.top;
            e.preventDefault();
            e.stopPropagation();
        }
        function onMove(e) {
            if (!drag || !editMode) return;
            const lRect = layer.getBoundingClientRect();
            const newLeft = Math.max(0, Math.min(lRect.width  - widget.offsetWidth,  startLeft + cx(e) - startX));
            const newTop  = Math.max(0, Math.min(lRect.height - widget.offsetHeight, startTop  + cy(e) - startY));
            widget.style.left = newLeft + 'px';
            widget.style.top  = newTop  + 'px';
            if (!savedLayout[id]) savedLayout[id] = Object.assign({}, DEFAULTS[id] || {});
            savedLayout[id].xPct = (newLeft / lRect.width)  * 100;
            savedLayout[id].yPct = (newTop  / lRect.height) * 100;
            e.preventDefault();
        }
        function onEnd() { if (drag) { drag = false; saveLayout(); } }

        widget.addEventListener('touchstart', onStart, { passive: false });
        widget.addEventListener('mousedown',  onStart);
        window.addEventListener('touchmove',  onMove,  { passive: false });
        window.addEventListener('mousemove',  onMove);
        window.addEventListener('touchend',   onEnd);
        window.addEventListener('mouseup',    onEnd);
    }

    function makeResizable(widget, id, minSize, maxSize) {
        const handle = document.createElement('div');
        handle.className = 'ctrl-resize-handle';
        widget.appendChild(handle);

        let resizing = false, startX, startY, startW, startH;

        function cx(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
        function cy(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

        function onStart(e) {
            if (!editMode) return;
            resizing = true;
            startX = cx(e); startY = cy(e);
            startW = widget.offsetWidth;
            startH = widget.offsetHeight;
            e.preventDefault();
            e.stopPropagation();
        }
        function onMove(e) {
            if (!resizing || !editMode) return;
            const newW = Math.max(minSize, Math.min(maxSize, startW + cx(e) - startX));
            const newH = Math.max(minSize, Math.min(maxSize, startH + cy(e) - startY));
            widget.style.width  = newW + 'px';
            widget.style.height = newH + 'px';
            if (!savedLayout[id]) savedLayout[id] = Object.assign({}, DEFAULTS[id] || {});
            savedLayout[id].wPx = newW;
            savedLayout[id].hPx = newH;
            e.preventDefault();
        }
        function onEnd() { if (resizing) { resizing = false; saveLayout(); } }

        handle.addEventListener('touchstart', onStart, { passive: false });
        handle.addEventListener('mousedown',  onStart);
        window.addEventListener('touchmove',  onMove,  { passive: false });
        window.addEventListener('mousemove',  onMove);
        window.addEventListener('touchend',   onEnd);
        window.addEventListener('mouseup',    onEnd);
    }

    // -----------------------------------------------------------------------
    // Widget wrapper — positions absolutely, gets drag/resize in edit mode
    // -----------------------------------------------------------------------
    function makeWidget(id) {
        const w = document.createElement('div');
        w.className = 'ctrl-widget';
        w.dataset.ctrlId = id;
        w.style.position = 'absolute';
        w.style.touchAction = 'none';
        w.style.userSelect = 'none';
        applyLayout(w, id);
        return w;
    }

    // -----------------------------------------------------------------------
    // D-pad
    // -----------------------------------------------------------------------
    function buildDpad() {
        const w = makeWidget('dpad');
        w.classList.add('ctrl-dpad-widget');

        const dpad = document.createElement('div');
        dpad.className = 'gba-dpad';
        dpad.appendChild(mkDiv('gba-dpad-center'));

        [
            { cls: 'gba-dpad-up',    key: 'up',    label: '▲' },
            { cls: 'gba-dpad-down',  key: 'down',  label: '▼' },
            { cls: 'gba-dpad-left',  key: 'left',  label: '◄' },
            { cls: 'gba-dpad-right', key: 'right', label: '►' },
        ].forEach(function(d) {
            const btn = mkBtn(d.cls, d.label);
            GameInput.bindDpadButton(btn, d.key);
            dpad.appendChild(btn);
        });

        w.appendChild(dpad);
        makeDraggable(w, 'dpad');
        makeResizable(w, 'dpad', 70, 200);
        return w;
    }

    // -----------------------------------------------------------------------
    // Joystick
    // -----------------------------------------------------------------------
    function buildJoystick() {
        const w = makeWidget('joystick');
        w.classList.add('ctrl-joy-widget');

        const base  = mkDiv('joystick-base');  base.id = 'joystick-base';
        const thumb = mkDiv('joystick-thumb'); thumb.id = 'joystick-thumb';
        base.appendChild(thumb);
        w.appendChild(base);

        GameInput.bindJoystick(base, thumb);
        makeDraggable(w, 'joystick');
        makeResizable(w, 'joystick', 70, 200);
        return w;
    }

    // -----------------------------------------------------------------------
    // Circle buttons (A, B)
    // -----------------------------------------------------------------------
    function buildCircleBtn(id, key, label, colorClass) {
        const w = makeWidget(id);
        w.classList.add('ctrl-circle-widget');

        const btn = mkBtn('gba-btn-circle ' + colorClass, label);
        GameInput.bindDpadButton(btn, key);
        w.appendChild(btn);

        makeDraggable(w, id);
        makeResizable(w, id, 30, 120);
        return w;
    }

    // -----------------------------------------------------------------------
    // Shoulder buttons (L, R)
    // -----------------------------------------------------------------------
    function buildShoulderBtn(id, key, label) {
        const w = makeWidget(id);
        w.classList.add('ctrl-shoulder-widget');

        const btn = mkBtn('gba-shoulder-btn', label);
        GameInput.bindDpadButton(btn, key);
        w.appendChild(btn);

        makeDraggable(w, id);
        makeResizable(w, id, 40, 140);
        return w;
    }

    // -----------------------------------------------------------------------
    // System buttons (START, SELECT)
    // -----------------------------------------------------------------------
    function buildSysBtn(id, key, label) {
        const w = makeWidget(id);
        w.classList.add('ctrl-sys-widget');

        const btn = mkBtn('gba-sys-btn', label);
        GameInput.bindDpadButton(btn, key);
        w.appendChild(btn);

        makeDraggable(w, id);
        makeResizable(w, id, 30, 100);
        return w;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    function mkBtn(cls, label) {
        const b = document.createElement('button');
        b.className = cls;
        b.textContent = label;
        b.type = 'button';
        return b;
    }
    function mkDiv(cls) {
        const d = document.createElement('div');
        d.className = cls;
        return d;
    }

    // -----------------------------------------------------------------------
    // Build / rebuild all buttons
    // -----------------------------------------------------------------------
    function build() {
        layer.innerHTML = '';

        if (mode === 'dpad') {
            layer.appendChild(buildDpad());
        } else {
            layer.appendChild(buildJoystick());
        }

        layer.appendChild(buildCircleBtn('btn-a', 'a', 'A', 'gba-btn-a-color'));
        layer.appendChild(buildCircleBtn('btn-b', 'b', 'B', 'gba-btn-b-color'));
        layer.appendChild(buildShoulderBtn('btn-l', 'l', 'L'));
        layer.appendChild(buildShoulderBtn('btn-r', 'r', 'R'));
        layer.appendChild(buildSysBtn('btn-start',  'start',  'START'));
        layer.appendChild(buildSysBtn('btn-select', 'select', 'SEL'));

        _applyEditVisuals();
    }

    // -----------------------------------------------------------------------
    // Edit mode
    // -----------------------------------------------------------------------
    function _applyEditVisuals() {
        layer.querySelectorAll('.ctrl-widget').forEach(function(w) {
            if (editMode) {
                w.classList.add('ctrl-edit');
            } else {
                w.classList.remove('ctrl-edit');
            }
        });
        // Show/hide the edit overlay bar
        let bar = document.getElementById('ctrl-edit-bar');
        if (editMode && !bar) {
            bar = document.createElement('div');
            bar.id = 'ctrl-edit-bar';
            bar.innerHTML =
                '<span>Drag to move · corner to resize</span>'
              + '<button id="ctrl-reset-btn">Reset</button>'
              + '<button id="ctrl-done-btn">Done</button>';
            document.body.appendChild(bar);
            document.getElementById('ctrl-reset-btn').addEventListener('click', resetLayout);
            document.getElementById('ctrl-done-btn').addEventListener('click', function(){ setEditMode(false); });
        } else if (!editMode && bar) {
            bar.parentNode.removeChild(bar);
        }
    }

    function setEditMode(on) {
        editMode = on;
        _applyEditVisuals();
    }

    function toggleEditMode() {
        setEditMode(!editMode);
    }

    // -----------------------------------------------------------------------
    // Reset layout
    // -----------------------------------------------------------------------
    function resetLayout() {
        savedLayout = {};
        saveLayout();
        build();
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    function setMode(newMode) {
        mode = newMode;
        if (layer) build();
    }

    function init() {
        layer = document.getElementById('controls-layer');
        if (!layer) { console.warn('[Controls] #controls-layer not found'); return; }
        loadLayout();
        build();
    }

    function rebuild() {
        if (layer) build();
    }

    return { init, setMode, toggleEditMode, setEditMode, resetLayout, rebuild, get mode() { return mode; } };
})();
