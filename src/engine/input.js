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

    // D-pad button press tracking
    function bindDpadButton(el, btn) {
        function press(e) {
            e.preventDefault();
            _setPressed(btn);
        }
        function release(e) {
            e.preventDefault();
            _clearPressed(btn);
        }
        el.addEventListener('mousedown', press);
        el.addEventListener('touchstart', press, { passive: false });
        el.addEventListener('mouseup', release);
        el.addEventListener('mouseleave', release);
        el.addEventListener('touchend', release, { passive: false });
        el.addEventListener('touchcancel', release, { passive: false });
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
        function getCoords(e) {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        }

        function onStart(e) {
            e.preventDefault();
            joystickActive = true;
            const rect = baseEl.getBoundingClientRect();
            joystickOriginX = rect.left + rect.width / 2;
            joystickOriginY = rect.top + rect.height / 2;
            const c = getCoords(e);
            updateJoystick(c.x, c.y, thumbEl);
        }

        function onMove(e) {
            if (!joystickActive) return;
            e.preventDefault();
            const c = getCoords(e);
            updateJoystick(c.x, c.y, thumbEl);
        }

        function onEnd(e) {
            if (!joystickActive) return;
            e.preventDefault();
            joystickActive = false;
            thumbEl.style.transform = 'translate(-50%, -50%)';
            clearJoystickDirs();
        }

        baseEl.addEventListener('mousedown', onStart);
        baseEl.addEventListener('touchstart', onStart, { passive: false });
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd, { passive: false });
        window.addEventListener('touchcancel', onEnd, { passive: false });
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
