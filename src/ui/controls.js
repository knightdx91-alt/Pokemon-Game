// GameControls — renders a GBA-style controller shell into #controls-layer
// and wires up GameInput for all buttons.
window.GameControls = (function () {
    let mode = 'dpad'; // 'dpad' | 'joystick'
    let layer = null;

    // -------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------
    function el(tag, cls, inner) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (inner !== undefined) e.innerHTML = inner;
        return e;
    }

    function makeBtn(cls, label) {
        const b = el('button', cls, label);
        b.setAttribute('aria-label', label);
        b.type = 'button';
        return b;
    }

    // -------------------------------------------------------------------
    // D-pad cross
    // -------------------------------------------------------------------
    function buildDpadSection() {
        const dpad = el('div', 'gba-dpad');
        dpad.setAttribute('aria-label', 'D-pad');

        // Center cosmetic circle
        dpad.appendChild(el('div', 'gba-dpad-center'));

        const dirs = [
            { cls: 'gba-dpad-up',    key: 'up',    label: '▲' },
            { cls: 'gba-dpad-down',  key: 'down',  label: '▼' },
            { cls: 'gba-dpad-left',  key: 'left',  label: '◄' },
            { cls: 'gba-dpad-right', key: 'right', label: '►' }
        ];

        dirs.forEach(function (d) {
            const btn = makeBtn(d.cls, d.label);
            GameInput.bindDpadButton(btn, d.key);
            dpad.appendChild(btn);
        });

        return dpad;
    }

    // -------------------------------------------------------------------
    // Joystick section (replaces d-pad)
    // -------------------------------------------------------------------
    function buildJoystickSection() {
        const wrap = el('div', 'gba-joystick-wrap');

        const base = el('div', 'joystick-base');
        base.id = 'joystick-base';

        const thumb = el('div', 'joystick-thumb');
        thumb.id = 'joystick-thumb';

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

        // Root shell
        const gba = el('div', 'gba-controller');

        // ---- Shoulder row ----
        const shoulderRow = el('div', 'gba-shoulder-row');

        const lBtn = makeBtn('gba-shoulder-l', 'L');
        GameInput.bindDpadButton(lBtn, 'l');

        const rBtn = makeBtn('gba-shoulder-r', 'R');
        GameInput.bindDpadButton(rBtn, 'r');

        shoulderRow.appendChild(lBtn);
        shoulderRow.appendChild(rBtn);

        // ---- Main row ----
        const mainRow = el('div', 'gba-main-row');

        // Left: d-pad or joystick
        const leftSection = el('div', 'gba-left');
        if (mode === 'joystick') {
            leftSection.appendChild(buildJoystickSection());
        } else {
            leftSection.appendChild(buildDpadSection());
        }

        // Center: SELECT + START (angled via CSS)
        const centerSection = el('div', 'gba-center');

        const selectBtn = makeBtn('gba-sys-btn', 'SELECT');
        GameInput.bindDpadButton(selectBtn, 'select');

        const startBtn = makeBtn('gba-sys-btn', 'START');
        GameInput.bindDpadButton(startBtn, 'start');

        centerSection.appendChild(selectBtn);
        centerSection.appendChild(startBtn);

        // Right: A + B
        const rightSection = el('div', 'gba-right');

        const aBtn = makeBtn('gba-btn-a', 'A');
        GameInput.bindDpadButton(aBtn, 'a');

        const bBtn = makeBtn('gba-btn-b', 'B');
        GameInput.bindDpadButton(bBtn, 'b');

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
