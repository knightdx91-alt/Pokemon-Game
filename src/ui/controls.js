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
    // Default layout — percentages of controls-layer (left%, top%, sizePx)
    // -----------------------------------------------------------------------
    const DEFAULTS = {
        dpad:       { xPct: 8,   yPct: 52,  sizePx: 110 },
        joystick:   { xPct: 8,   yPct: 52,  sizePx: 110 },
        'btn-a':    { xPct: 76,  yPct: 56,  sizePx: 52  },
        'btn-b':    { xPct: 64,  yPct: 66,  sizePx: 52  },
        'btn-l':    { xPct: 2,   yPct: 30,  sizePx: 68  },
        'btn-r':    { xPct: 80,  yPct: 30,  sizePx: 68  },
        'btn-start':{ xPct: 57,  yPct: 80,  sizePx: 52  },
        'btn-select':{ xPct: 38, yPct: 80,  sizePx: 52  },
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
    // Apply position + size to a widget element
    // -----------------------------------------------------------------------
    function applyLayout(el, id) {
        const lay = getLayout(id);
        el.style.left    = lay.xPct + '%';
        el.style.top     = lay.yPct + '%';
        el.style.width   = lay.sizePx + 'px';
        el.style.height  = lay.sizePx + 'px';
    }

    // -----------------------------------------------------------------------
    // Make a widget draggable + resizable (edit mode only)
    // -----------------------------------------------------------------------
    function makeDraggable(widget, id) {
        let drag = false, startX, startY, startLeft, startTop;

        widget.addEventListener('pointerdown', function(e) {
            if (!editMode) return;
            if (e.target.classList.contains('ctrl-resize-handle')) return;
            drag = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = widget.getBoundingClientRect();
            const lRect = layer.getBoundingClientRect();
            startLeft = rect.left - lRect.left;
            startTop  = rect.top  - lRect.top;
            widget.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });

        widget.addEventListener('pointermove', function(e) {
            if (!drag || !editMode) return;
            const lRect = layer.getBoundingClientRect();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newLeft = Math.max(0, Math.min(lRect.width  - widget.offsetWidth,  startLeft + dx));
            const newTop  = Math.max(0, Math.min(lRect.height - widget.offsetHeight, startTop  + dy));
            widget.style.left = newLeft + 'px';
            widget.style.top  = newTop  + 'px';
            // Store as percentages
            if (!savedLayout[id]) savedLayout[id] = Object.assign({}, DEFAULTS[id] || {});
            savedLayout[id].xPct = (newLeft / lRect.width)  * 100;
            savedLayout[id].yPct = (newTop  / lRect.height) * 100;
            e.preventDefault();
        }, { passive: false });

        widget.addEventListener('pointerup', function(e) {
            if (!drag) return;
            drag = false;
            saveLayout();
        });
    }

    function makeResizable(widget, id, minSize, maxSize) {
        const handle = document.createElement('div');
        handle.className = 'ctrl-resize-handle';
        widget.appendChild(handle);

        let resizing = false, startX, startY, startSize;

        handle.addEventListener('pointerdown', function(e) {
            if (!editMode) return;
            resizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startSize = widget.offsetWidth;
            handle.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });

        handle.addEventListener('pointermove', function(e) {
            if (!resizing || !editMode) return;
            const delta = ((e.clientX - startX) + (e.clientY - startY)) / 2;
            const newSize = Math.max(minSize, Math.min(maxSize, startSize + delta));
            widget.style.width  = newSize + 'px';
            widget.style.height = newSize + 'px';
            if (!savedLayout[id]) savedLayout[id] = Object.assign({}, DEFAULTS[id] || {});
            savedLayout[id].sizePx = newSize;
            e.preventDefault();
        }, { passive: false });

        handle.addEventListener('pointerup', function() {
            resizing = false;
            saveLayout();
        });
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

    return { init, setMode, toggleEditMode, setEditMode, resetLayout, get mode() { return mode; } };
})();
