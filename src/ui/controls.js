// GameControls — renders a GBA-style controller shell into #controls-layer
// and wires up GameInput for all buttons.
window.GameControls = (function () {
    let mode  = 'dpad'; // 'dpad' | 'joystick'
    let layer = null;

    // -------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------
    function el(tag, cls, inner) {
        const e = document.createElement(tag);
        if (cls)            e.className = cls;
        if (inner !== undefined) e.innerHTML = inner;
        return e;
    }

    function makeBtn(cls, label) {
        const b = el('button', cls, label);
        b.setAttribute('aria-label', label);
        b.type = 'button';
        // Prevent default browser long-press / context menus on touch
        b.addEventListener('contextmenu', e => e.preventDefault());
        return b;
    }

    // -------------------------------------------------------------------
    // D-pad cross
    // The whole container is the hit area (zone-based via GameInput.bindDpad).
    // The four arrow divs are purely cosmetic.
    // -------------------------------------------------------------------
    function buildDpadSection() {
        const dpad = el('div', 'gba-dpad');
        dpad.setAttribute('aria-label', 'D-pad');
        dpad.setAttribute('role', 'group');

        // Cosmetic pieces (pointer-events: none via CSS)
        dpad.appendChild(el('div', 'gba-dpad-center'));

        const dirs = [
            { cls: 'gba-dpad-up',    label: '▲' },
            { cls: 'gba-dpad-down',  label: '▼' },
            { cls: 'gba-dpad-left',  label: '◄' },
            { cls: 'gba-dpad-right', label: '►' }
        ];
        dirs.forEach(function (d) {
            dpad.appendChild(el('div', d.cls, d.label));
        });

        // Single zone-based input handler on the container
        GameInput.bindDpad(dpad);

        return dpad;
    }

    // -------------------------------------------------------------------
    // Joystick section (replaces d-pad)
    // -------------------------------------------------------------------
    function buildJoystickSection() {
        const wrap  = el('div', 'gba-joystick-wrap');
        const base  = el('div', 'joystick-base');
        base.id     = 'joystick-base';
        const thumb = el('div', 'joystick-thumb');
        thumb.id    = 'joystick-thumb';

        base.appendChild(thumb);
        wrap.appendChild(base);

        GameInput.bindJoystick(base, thumb);
        return wrap;
    }

    // -------------------------------------------------------------------
    // Build full GBA shell
    // -------------------------------------------------------------------
    function build() {
        layer.innerHTML = '';

        const gba = el('div', 'gba-controller');

        // ---- Shoulder row ----
        const shoulderRow = el('div', 'gba-shoulder-row');

        const lBtn = makeBtn('gba-shoulder-l', 'L');
        GameInput.bindButton(lBtn, 'l');

        const rBtn = makeBtn('gba-shoulder-r', 'R');
        GameInput.bindButton(rBtn, 'r');

        shoulderRow.appendChild(lBtn);
        shoulderRow.appendChild(rBtn);

        // ---- Main row ----
        const mainRow = el('div', 'gba-main-row');

        // Left: d-pad or joystick
        const leftSection = el('div', 'gba-left');
        leftSection.appendChild(mode === 'joystick' ? buildJoystickSection() : buildDpadSection());

        // Center: SELECT + START
        const centerSection = el('div', 'gba-center');

        const selectBtn = makeBtn('gba-sys-btn', 'SELECT');
        GameInput.bindButton(selectBtn, 'select');

        const startBtn = makeBtn('gba-sys-btn', 'START');
        GameInput.bindButton(startBtn, 'start');

        centerSection.appendChild(selectBtn);
        centerSection.appendChild(startBtn);

        // Right: A + B
        const rightSection = el('div', 'gba-right');

        const aBtn = makeBtn('gba-btn-a', 'A');
        GameInput.bindButton(aBtn, 'a');

        const bBtn = makeBtn('gba-btn-b', 'B');
        GameInput.bindButton(bBtn, 'b');

        rightSection.appendChild(aBtn);
        rightSection.appendChild(bBtn);

        mainRow.appendChild(leftSection);
        mainRow.appendChild(centerSection);
        mainRow.appendChild(rightSection);

        gba.appendChild(shoulderRow);
        gba.appendChild(mainRow);

        layer.appendChild(gba);
    }

    // -------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------
    function setMode(newMode) {
        mode = newMode;
        if (layer) build();
    }

    function init() {
        layer = document.getElementById('controls-layer');
        if (!layer) {
            console.warn('[Controls] #controls-layer not found');
            return;
        }
        build();
    }

    return {
        init,
        setMode,
        get mode() { return mode; }
    };
})();
