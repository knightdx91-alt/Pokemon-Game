// GameInput — keyboard, d-pad, and joystick input handler
window.GameInput = (function () {
    const state = {
        up: false,
        down: false,
        left: false,
        right: false,
        a: false,
        b: false,
        start: false,
        select: false,
        l: false,
        r: false
    };

    // justPressed: latches true on press, cleared by consumeJustPressed().
    // Guarantees a quick tap is seen by the game loop even if released before the next rAF.
    const justPressed = {
        up: false, down: false, left: false, right: false,
        a: false, b: false, start: false, select: false, l: false, r: false
    };

    function _setPressed(btn) {
        state[btn] = true;
        justPressed[btn] = true;
    }

    function _clearPressed(btn) {
        state[btn] = false;
    }

    // Call this from the game loop after reading justPressed to reset the latches
    function consumeJustPressed() {
        for (const k in justPressed) justPressed[k] = false;
    }

    // Key mappings
    const KEY_MAP = {
        ArrowUp:    'up',    w: 'up',    W: 'up',
        ArrowDown:  'down',  s: 'down',  S: 'down',
        ArrowLeft:  'left',  a: 'left',  A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right',
        z: 'a',    Z: 'a',    Enter: 'a',
        x: 'b',    X: 'b',    Backspace: 'b',
        ' ': 'start',
        Shift: 'select'
    };

    function onKeyDown(e) {
        const btn = KEY_MAP[e.key];
        if (btn) {
            _setPressed(btn);
            e.preventDefault();
        }
    }

    function onKeyUp(e) {
        const btn = KEY_MAP[e.key];
        if (btn) {
            _clearPressed(btn);
        }
    }

    // D-pad button press tracking — uses Pointer Events for unified mouse/touch/stylus handling
    function bindDpadButton(el, btn) {
        el.addEventListener('pointerdown', function(e) {
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            _setPressed(btn);
        }, { passive: false });
        el.addEventListener('pointerup', function(e) {
            _clearPressed(btn);
        });
        el.addEventListener('pointercancel', function(e) {
            _clearPressed(btn);
        });
        el.addEventListener('pointerleave', function(e) {
            _clearPressed(btn);
        });
    }

    // Joystick state
    let joystickActive = false;
    let joystickOriginX = 0;
    let joystickOriginY = 0;
    const DEADZONE = 20; // px

    function clearJoystickDirs() {
        _clearPressed('up');
        _clearPressed('down');
        _clearPressed('left');
        _clearPressed('right');
    }

    function updateJoystick(cx, cy, thumbEl) {
        const dx = cx - joystickOriginX;
        const dy = cy - joystickOriginY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Move thumb visually, clamped to base radius
        const radius = 40;
        const clampedDist = Math.min(dist, radius);
        const angle = Math.atan2(dy, dx);
        const tx = Math.cos(angle) * clampedDist;
        const ty = Math.sin(angle) * clampedDist;
        thumbEl.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;

        clearJoystickDirs();
        if (dist >= DEADZONE) {
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (absX >= absY) {
                if (dx > 0) _setPressed('right');
                else        _setPressed('left');
            } else {
                if (dy > 0) _setPressed('down');
                else        _setPressed('up');
            }
        }
    }

    function bindJoystick(baseEl, thumbEl) {
        let capturedId = null;

        baseEl.addEventListener('pointerdown', function(e) {
            e.preventDefault();
            baseEl.setPointerCapture(e.pointerId);
            capturedId = e.pointerId;
            joystickActive = true;
            const rect = baseEl.getBoundingClientRect();
            joystickOriginX = rect.left + rect.width / 2;
            joystickOriginY = rect.top + rect.height / 2;
            updateJoystick(e.clientX, e.clientY, thumbEl);
        }, { passive: false });

        baseEl.addEventListener('pointermove', function(e) {
            if (!joystickActive || e.pointerId !== capturedId) return;
            e.preventDefault();
            updateJoystick(e.clientX, e.clientY, thumbEl);
        }, { passive: false });

        baseEl.addEventListener('pointerup', function(e) {
            if (!joystickActive) return;
            joystickActive = false;
            capturedId = null;
            thumbEl.style.transform = 'translate(-50%, -50%)';
            clearJoystickDirs();
        });

        baseEl.addEventListener('pointercancel', function(e) {
            if (!joystickActive) return;
            joystickActive = false;
            capturedId = null;
            thumbEl.style.transform = 'translate(-50%, -50%)';
            clearJoystickDirs();
        });
    }

    function init() {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
    }

    return {
        state,
        justPressed,
        consumeJustPressed,
        init,
        bindDpadButton,
        bindJoystick
    };
})();
