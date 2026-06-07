// GameControls — renders D-pad or joystick into #controls-layer and wires up GameInput
window.GameControls = (function () {
    let mode = 'dpad'; // 'dpad' | 'joystick'
    let layer = null;

    function clearLayer() {
        if (layer) layer.innerHTML = '';
    }

    // Build a button element
    function makeBtn(label, cls, extraCls) {
        const btn = document.createElement('button');
        btn.className = `control-btn ${cls}${extraCls ? ' ' + extraCls : ''}`;
        btn.innerHTML = label;
        btn.setAttribute('aria-label', label);
        return btn;
    }

    function buildDpad() {
        clearLayer();

        // Directional pad container
        const dpad = document.createElement('div');
        dpad.className = 'dpad';

        const dirs = [
            { label: '▲', cls: 'btn-up',    btn: 'up' },
            { label: '◄', cls: 'btn-left',  btn: 'left' },
            { label: '▼', cls: 'btn-down',  btn: 'down' },
            { label: '►', cls: 'btn-right', btn: 'right' }
        ];

        dirs.forEach(({ label, cls, btn }) => {
            const el = makeBtn(label, 'dpad-dir', cls);
            GameInput.bindDpadButton(el, btn);
            dpad.appendChild(el);
        });

        // Face buttons container (A + B)
        const face = document.createElement('div');
        face.className = 'face-buttons';

        const faceMap = [
            { label: 'B', cls: 'btn-b', btn: 'b' },
            { label: 'A', cls: 'btn-a', btn: 'a' }
        ];
        faceMap.forEach(({ label, cls, btn }) => {
            const el = makeBtn(label, 'face-btn', cls);
            GameInput.bindDpadButton(el, btn);
            face.appendChild(el);
        });

        // System buttons (Start + Select)
        const sys = document.createElement('div');
        sys.className = 'sys-buttons';

        const sysMap = [
            { label: 'SEL', cls: 'btn-select', btn: 'select' },
            { label: 'STA', cls: 'btn-start',  btn: 'start' }
        ];
        sysMap.forEach(({ label, cls, btn }) => {
            const el = makeBtn(label, 'sys-btn', cls);
            GameInput.bindDpadButton(el, btn);
            sys.appendChild(el);
        });

        layer.appendChild(dpad);
        layer.appendChild(sys);
        layer.appendChild(face);

        // Allow dragging individual buttons via GameLayout (if already init'd)
        if (window.GameLayout) {
            layer.querySelectorAll('.control-btn').forEach(btn => {
                GameLayout.makeControlDraggable(btn);
            });
        }
    }

    function buildJoystick() {
        clearLayer();

        // Joystick
        const joystickWrap = document.createElement('div');
        joystickWrap.className = 'joystick-wrap';

        const base = document.createElement('div');
        base.className = 'joystick-base';
        base.id = 'joystick-base';

        const thumb = document.createElement('div');
        thumb.className = 'joystick-thumb';
        thumb.id = 'joystick-thumb';

        base.appendChild(thumb);
        joystickWrap.appendChild(base);

        // Face buttons
        const face = document.createElement('div');
        face.className = 'face-buttons';

        const faceMap = [
            { label: 'B', cls: 'btn-b', btn: 'b' },
            { label: 'A', cls: 'btn-a', btn: 'a' }
        ];
        faceMap.forEach(({ label, cls, btn }) => {
            const el = makeBtn(label, 'face-btn', cls);
            GameInput.bindDpadButton(el, btn);
            face.appendChild(el);
        });

        // System buttons
        const sys = document.createElement('div');
        sys.className = 'sys-buttons';

        const sysMap = [
            { label: 'SEL', cls: 'btn-select', btn: 'select' },
            { label: 'STA', cls: 'btn-start',  btn: 'start' }
        ];
        sysMap.forEach(({ label, cls, btn }) => {
            const el = makeBtn(label, 'sys-btn', cls);
            GameInput.bindDpadButton(el, btn);
            sys.appendChild(el);
        });

        layer.appendChild(joystickWrap);
        layer.appendChild(sys);
        layer.appendChild(face);

        GameInput.bindJoystick(base, thumb);

        if (window.GameLayout) {
            layer.querySelectorAll('.control-btn').forEach(btn => {
                GameLayout.makeControlDraggable(btn);
            });
        }
    }

    function setMode(newMode) {
        mode = newMode;
        if (mode === 'joystick') {
            buildJoystick();
        } else {
            buildDpad();
        }
    }

    function init() {
        layer = document.getElementById('controls-layer');
        if (!layer) {
            console.warn('[Controls] #controls-layer not found');
            return;
        }
        setMode(mode);
    }

    return { init, setMode, get mode() { return mode; } };
})();
