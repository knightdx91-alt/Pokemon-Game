// GameControls — simple fixed-position GBA buttons
window.GameControls = (function () {
    'use strict';

    let mode = 'dpad'; // 'dpad' | 'joystick'
    let _built = false;

    // ------------------------------------------------------------------
    // Direct input binding — no wrapper, no debounce flags, no capture.
    // touchstart sets the key; touchend/cancel clears it.
    // mousedown/mouseup for desktop.
    // ------------------------------------------------------------------
    function _bind(el, key) {
        el.addEventListener('touchstart', function (e) {
            e.preventDefault();
            GameInput.state[key] = true;
            GameInput.justPressed[key] = true;
        }, { passive: false });

        el.addEventListener('touchend', function (e) {
            e.preventDefault();
            GameInput.state[key] = false;
        }, { passive: false });

        el.addEventListener('touchcancel', function () {
            GameInput.state[key] = false;
        }, { passive: false });

        el.addEventListener('mousedown', function (e) {
            e.preventDefault();
            GameInput.state[key] = true;
            GameInput.justPressed[key] = true;
        });

        el.addEventListener('mouseup', function () {
            GameInput.state[key] = false;
        });

        el.addEventListener('mouseleave', function () {
            GameInput.state[key] = false;
        });
    }

    // ------------------------------------------------------------------
    // Style helpers
    // ------------------------------------------------------------------
    function _pos(el, leftPct, topPct, w, h) {
        el.style.cssText = [
            'position:fixed',
            'left:'   + leftPct + '%',
            'top:'    + topPct  + '%',
            'width:'  + w + 'px',
            'height:' + h + 'px',
            'z-index:200',
            'touch-action:none',
            '-webkit-tap-highlight-color:transparent',
            'user-select:none',
            '-webkit-user-select:none',
            'box-sizing:border-box',
        ].join(';');
    }

    // ------------------------------------------------------------------
    // D-pad
    // ------------------------------------------------------------------
    function _buildDpad() {
        // Outer container — no listeners, just layout
        const wrap = document.createElement('div');
        _pos(wrap, 4, 68, 120, 120);
        wrap.style.position = 'fixed';

        // Cross bars via CSS — ::before/::after on a nested div
        const cross = document.createElement('div');
        cross.className = 'ctrl-dpad-cross';
        cross.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
        wrap.appendChild(cross);

        const dirs = [
            { key: 'up',    style: 'left:32%;top:0;width:36%;height:36%;border-radius:4px 4px 0 0' },
            { key: 'down',  style: 'left:32%;bottom:0;width:36%;height:36%;border-radius:0 0 4px 4px' },
            { key: 'left',  style: 'top:32%;left:0;width:36%;height:36%;border-radius:4px 0 0 4px' },
            { key: 'right', style: 'top:32%;right:0;width:36%;height:36%;border-radius:0 4px 4px 0' },
        ];

        dirs.forEach(function (d) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ctrl-dpad-btn';
            btn.style.cssText = 'position:absolute;' + d.style + ';background:#2a2a3e;border:1px solid rgba(255,255,255,0.2);cursor:pointer;touch-action:none;';
            _bind(btn, d.key);
            wrap.appendChild(btn);
        });

        document.body.appendChild(wrap);
    }

    // ------------------------------------------------------------------
    // Joystick
    // ------------------------------------------------------------------
    function _buildJoystick() {
        const wrap = document.createElement('div');
        _pos(wrap, 4, 66, 120, 120);
        wrap.style.borderRadius = '50%';

        const base  = document.createElement('div');
        base.id = 'joystick-base';
        base.style.cssText = 'position:absolute;inset:0;border-radius:50%;background:#252535;border:1px solid rgba(255,255,255,0.15);touch-action:none;';

        const thumb = document.createElement('div');
        thumb.id = 'joystick-thumb';
        thumb.style.cssText = 'position:absolute;width:40%;height:40%;border-radius:50%;background:#3a3a58;border:1px solid rgba(255,255,255,0.25);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;';

        base.appendChild(thumb);
        wrap.appendChild(base);
        document.body.appendChild(wrap);

        GameInput.bindJoystick(base, thumb);
    }

    // ------------------------------------------------------------------
    // Circle buttons  (A / B)
    // ------------------------------------------------------------------
    function _buildCircle(key, label, leftPct, topPct, size, bg) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        _pos(btn, leftPct, topPct, size, size);
        btn.style.borderRadius = '50%';
        btn.style.background   = bg;
        btn.style.border       = '2px solid rgba(255,255,255,0.25)';
        btn.style.color        = '#fff';
        btn.style.fontSize     = Math.round(size * 0.3) + 'px';
        btn.style.fontFamily   = 'Courier New,monospace';
        btn.style.fontWeight   = 'bold';
        btn.style.cursor       = 'pointer';
        btn.style.boxShadow    = '0 3px 8px rgba(0,0,0,0.6)';
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Shoulder buttons  (L / R)
    // ------------------------------------------------------------------
    function _buildShoulder(key, label, leftPct, topPct) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        _pos(btn, leftPct, topPct, 88, 36);
        btn.style.borderRadius = '6px';
        btn.style.background   = '#2a2a3e';
        btn.style.border       = '2px solid rgba(255,255,255,0.25)';
        btn.style.color        = '#ccc';
        btn.style.fontSize     = '13px';
        btn.style.fontFamily   = 'Courier New,monospace';
        btn.style.fontWeight   = 'bold';
        btn.style.cursor       = 'pointer';
        btn.style.boxShadow    = '0 2px 6px rgba(0,0,0,0.5)';
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // System buttons  (START / SELECT)
    // ------------------------------------------------------------------
    function _buildSys(key, label, leftPct, topPct) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        _pos(btn, leftPct, topPct, 62, 30);
        btn.style.borderRadius = '15px';
        btn.style.background   = '#2a2a3e';
        btn.style.border       = '2px solid rgba(255,255,255,0.2)';
        btn.style.color        = '#aaa';
        btn.style.fontSize     = '9px';
        btn.style.letterSpacing = '0.5px';
        btn.style.fontFamily   = 'Courier New,monospace';
        btn.style.fontWeight   = 'bold';
        btn.style.cursor       = 'pointer';
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Build all buttons
    // ------------------------------------------------------------------
    function _build() {
        // Remove any previously built controls
        document.querySelectorAll('.ctrl-root').forEach(function (el) { el.remove(); });

        // Tag every element we create so we can remove them on rebuild
        const _orig = document.body.appendChild.bind(document.body);
        const _added = [];
        document.body.appendChild = function (el) {
            el.classList && el.classList.add('ctrl-root');
            _added.push(el);
            return _orig(el);
        };

        if (mode === 'dpad') {
            _buildDpad();
        } else {
            _buildJoystick();
        }

        _buildCircle('a',      'A',    74, 66, 58, '#8b1a1a');
        _buildCircle('b',      'B',    61, 77, 50, '#1a3a6b');
        _buildShoulder('l',    'L',     0, 61);
        _buildShoulder('r',    'R',    73, 61);
        _buildSys('start',  'START',  55, 89);
        _buildSys('select', 'SEL',    36, 89);

        // Restore
        document.body.appendChild = _orig;
        _built = true;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    function init() {
        _build();
    }

    function setMode(newMode) {
        mode = newMode;
        _build();
    }

    function rebuild() {
        _build();
    }

    // Stubs kept so hud.js wiring doesn't error
    function toggleEditMode() {}
    function setEditMode() {}
    function resetLayout() { _build(); }

    return { init, setMode, rebuild, toggleEditMode, setEditMode, resetLayout, get mode() { return mode; } };
})();
