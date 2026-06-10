// GameInput — keyboard, d-pad (zone-based), joystick, and button input
window.GameInput = (function () {

    // Separate tracking for keyboard vs on-screen controls
    const _kb  = { up:false, down:false, left:false, right:false, a:false, b:false, start:false, select:false, l:false, r:false };
    const _pad = { up:false, down:false, left:false, right:false, a:false, b:false, start:false, select:false, l:false, r:false };

    // Public state: OR of keyboard + pad (read-only getters)
    const state = {};
    ['up','down','left','right','a','b','start','select','l','r'].forEach(k => {
        Object.defineProperty(state, k, {
            get() { return _kb[k] || _pad[k]; },
            enumerable: true
        });
    });

    // --- Keyboard ---
    const KEY_MAP = {
        ArrowUp:'up',    w:'up',    W:'up',
        ArrowDown:'down', s:'down',  S:'down',
        ArrowLeft:'left', a:'left',  A:'left',
        ArrowRight:'right', d:'right', D:'right',
        z:'a', Z:'a', Enter:'a',
        x:'b', X:'b', Backspace:'b',
        ' ':'start',
        Shift:'select',
        q:'l', Q:'l',
        e:'r', E:'r'
    };

    function init() {
        window.addEventListener('keydown', function (e) {
            const b = KEY_MAP[e.key];
            if (b) { _kb[b] = true; e.preventDefault(); }
        });
        window.addEventListener('keyup', function (e) {
            const b = KEY_MAP[e.key];
            if (b) _kb[b] = false;
        });
    }

    // --- D-pad: zone-based on a single container element ---
    // Handles sliding gestures correctly via pointermove + setPointerCapture.
    function bindDpad(el) {
        const active = new Map(); // pointerId -> current direction string | null

        function dirFrom(e) {
            const r  = el.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width  * 0.5);
            const dy = e.clientY - (r.top  + r.height * 0.5);
            // Dead-zone: 12% of container width from center
            if (Math.hypot(dx, dy) < r.width * 0.12) return null;
            return Math.abs(dx) >= Math.abs(dy)
                ? (dx > 0 ? 'right' : 'left')
                : (dy > 0 ? 'down'  : 'up');
        }

        function flush() {
            _pad.up = _pad.down = _pad.left = _pad.right = false;
            for (const d of active.values()) if (d) _pad[d] = true;
        }

        el.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            active.set(e.pointerId, dirFrom(e));
            flush();
        });
        el.addEventListener('pointermove', function (e) {
            if (!active.has(e.pointerId)) return;
            e.preventDefault();
            active.set(e.pointerId, dirFrom(e));
            flush();
        });
        el.addEventListener('pointerup', function (e) {
            active.delete(e.pointerId);
            flush();
        });
        el.addEventListener('pointercancel', function (e) {
            active.delete(e.pointerId);
            flush();
        });
    }

    // --- Simple button: press / release with pointer capture ---
    function bindButton(el, btn) {
        el.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            _pad[btn] = true;
        });
        el.addEventListener('pointerup',     function () { _pad[btn] = false; });
        el.addEventListener('pointercancel', function () { _pad[btn] = false; });
    }

    // --- Joystick: analog stick mapped to 4 directions ---
    function bindJoystick(baseEl, thumbEl) {
        const active   = new Map(); // pointerId -> {x, y}
        const RADIUS   = 40;
        const DEADZONE = 18;
        let originX = 0, originY = 0;

        function flush() {
            _pad.up = _pad.down = _pad.left = _pad.right = false;
            if (active.size === 0) {
                thumbEl.style.transform = 'translate(-50%, -50%)';
                return;
            }
            const pt    = active.values().next().value; // first active pointer
            const dx    = pt.x - originX;
            const dy    = pt.y - originY;
            const dist  = Math.hypot(dx, dy);
            const clamp = Math.min(dist, RADIUS);
            const angle = Math.atan2(dy, dx);
            thumbEl.style.transform =
                'translate(calc(-50% + ' + (Math.cos(angle) * clamp) + 'px), ' +
                           'calc(-50% + ' + (Math.sin(angle) * clamp) + 'px))';
            if (dist >= DEADZONE) {
                if (Math.abs(dx) >= Math.abs(dy)) _pad[dx > 0 ? 'right' : 'left'] = true;
                else                               _pad[dy > 0 ? 'down'  : 'up']   = true;
            }
        }

        baseEl.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            baseEl.setPointerCapture(e.pointerId);
            const r = baseEl.getBoundingClientRect();
            originX = r.left + r.width  / 2;
            originY = r.top  + r.height / 2;
            active.set(e.pointerId, { x: e.clientX, y: e.clientY });
            flush();
        });
        baseEl.addEventListener('pointermove', function (e) {
            if (!active.has(e.pointerId)) return;
            e.preventDefault();
            active.set(e.pointerId, { x: e.clientX, y: e.clientY });
            flush();
        });
        baseEl.addEventListener('pointerup',     function (e) { active.delete(e.pointerId); flush(); });
        baseEl.addEventListener('pointercancel', function (e) { active.delete(e.pointerId); flush(); });
    }

    return { state, init, bindDpad, bindButton, bindJoystick };
})();
