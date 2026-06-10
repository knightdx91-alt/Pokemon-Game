// GameControls — GBA-style on-screen controls
// D-pad uses PPSSPP-style: 4 separate arms, each independently hittable.
window.GameControls = (function () {
    'use strict';

    let mode = 'dpad'; // 'dpad' | 'joystick'

    // ------------------------------------------------------------------
    // Button binding — Pointer Events + touch fallback
    // ------------------------------------------------------------------
    function _bind(el, key) {
        var _held = false;

        function press(e) {
            if (e.cancelable) e.preventDefault();
            if (!_held) {
                _held = true;
                GameInput.state[key]       = true;
                GameInput.justPressed[key] = true;
            }
        }
        function release() {
            _held = false;
            GameInput.state[key] = false;
        }

        // Pointer Events (Chrome/Firefox/Edge, modern Safari)
        el.addEventListener('pointerdown', function (e) {
            try { el.setPointerCapture(e.pointerId); } catch (ex) {}
            press(e);
        });
        el.addEventListener('pointerup',     release);
        el.addEventListener('pointercancel', release);

        // Touch fallback (older WebKit / iOS < 13)
        el.addEventListener('touchstart', press,   { passive: false });
        el.addEventListener('touchend',   release, { passive: false });
        el.addEventListener('touchcancel',release, { passive: false });
    }

    // ------------------------------------------------------------------
    // Shared style helper
    // ------------------------------------------------------------------
    function _css(el, obj) {
        for (var k in obj) el.style[k] = obj[k];
    }

    function _baseBtn(label) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        _css(b, {
            position:                 'fixed',
            zIndex:                   '200',
            touchAction:              'none',
            userSelect:               'none',
            webkitUserSelect:         'none',
            webkitTapHighlightColor:  'transparent',
            boxSizing:                'border-box',
            cursor:                   'pointer',
            fontFamily:               '"Courier New",Courier,monospace',
            fontWeight:               'bold',
            color:                    'rgba(200,210,230,0.85)',
            border:                   '1px solid rgba(255,255,255,0.18)',
            display:                  'flex',
            alignItems:               'center',
            justifyContent:           'center',
        });
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        return b;
    }

    // ------------------------------------------------------------------
    // PPSSPP-style D-pad
    //
    // Four separate arm buttons arranged in a cross.  Each arm is its
    // own element so the hit area precisely matches the visual, and the
    // user can clearly feel which direction they're pressing.
    //
    //        [ ▲ ]
    //  [ ◄ ] [   ] [ ► ]
    //        [ ▼ ]
    //
    // The center circle is a cosmetic-only div (pointer-events:none).
    // ------------------------------------------------------------------
    function _buildDpad() {
        var SIZE  = 120;   // outer container px
        var ARM_W = 36;    // arm width  (short axis)
        var ARM_H = 48;    // arm height (long axis)
        var CX    = SIZE / 2;
        var CY    = SIZE / 2;

        // Container — fixed position, no background, just a hit region
        var wrap = document.createElement('div');
        _css(wrap, {
            position:    'fixed',
            left:        '3%',
            bottom:      '12%',
            width:       SIZE + 'px',
            height:      SIZE + 'px',
            zIndex:      '200',
            touchAction: 'none',
            userSelect:  'none',
            webkitUserSelect: 'none',
            pointerEvents: 'none',   // container is transparent; arms get events
        });

        // Arms: [key, label, left, top, width, height, borderRadius]
        var arms = [
            { key:'up',    label:'▲',
              l: CX - ARM_W/2, t: 0,
              w: ARM_W, h: ARM_H,
              r: '8px 8px 4px 4px' },
            { key:'down',  label:'▼',
              l: CX - ARM_W/2, t: SIZE - ARM_H,
              w: ARM_W, h: ARM_H,
              r: '4px 4px 8px 8px' },
            { key:'left',  label:'◄',
              l: 0, t: CY - ARM_W/2,
              w: ARM_H, h: ARM_W,
              r: '8px 4px 4px 8px' },
            { key:'right', label:'►',
              l: SIZE - ARM_H, t: CY - ARM_W/2,
              w: ARM_H, h: ARM_W,
              r: '4px 8px 8px 4px' },
        ];

        arms.forEach(function (a) {
            var btn = _baseBtn(a.label);
            _css(btn, {
                position:     'absolute',  // inside the wrap
                left:         a.l + 'px',
                top:          a.t + 'px',
                width:        a.w + 'px',
                height:       a.h + 'px',
                borderRadius: a.r,
                background:   '#25253a',
                boxShadow:    '0 2px 6px rgba(0,0,0,0.55)',
                fontSize:     '13px',
                zIndex:       '200',
            });
            // Override fixed positioning — arm is absolute inside wrap
            btn.style.position = 'absolute';
            _bind(btn, a.key);
            wrap.appendChild(btn);
        });

        // Center circle (cosmetic)
        var center = document.createElement('div');
        _css(center, {
            position:     'absolute',
            left:         (CX - 14) + 'px',
            top:          (CY - 14) + 'px',
            width:        '28px',
            height:       '28px',
            borderRadius: '50%',
            background:   '#1e1e2e',
            border:       '1px solid rgba(255,255,255,0.12)',
            pointerEvents:'none',
            zIndex:       '201',
        });
        wrap.appendChild(center);

        document.body.appendChild(wrap);
    }

    // ------------------------------------------------------------------
    // Joystick (unchanged)
    // ------------------------------------------------------------------
    function _buildJoystick() {
        var wrap = document.createElement('div');
        _css(wrap, {
            position:    'fixed',
            left:        '3%',
            bottom:      '12%',
            width:       '120px',
            height:      '120px',
            zIndex:      '200',
            touchAction: 'none',
            userSelect:  'none',
        });

        var base = document.createElement('div');
        base.id = 'joystick-base';
        _css(base, {
            position:    'absolute',
            inset:       '0',
            borderRadius:'50%',
            background:  '#252535',
            border:      '1px solid rgba(255,255,255,0.15)',
            touchAction: 'none',
        });

        var thumb = document.createElement('div');
        thumb.id = 'joystick-thumb';
        _css(thumb, {
            position:    'absolute',
            width:       '40%',
            height:      '40%',
            borderRadius:'50%',
            background:  '#3a3a58',
            border:      '1px solid rgba(255,255,255,0.25)',
            top:         '50%',
            left:        '50%',
            transform:   'translate(-50%,-50%)',
            pointerEvents:'none',
        });

        base.appendChild(thumb);
        wrap.appendChild(base);
        document.body.appendChild(wrap);
        GameInput.bindJoystick(base, thumb);
    }

    // ------------------------------------------------------------------
    // Action buttons (A / B)
    // ------------------------------------------------------------------
    function _buildCircle(key, label, rightPct, bottomPct, size, bg) {
        var btn = _baseBtn(label);
        _css(btn, {
            right:        rightPct + '%',
            bottom:       bottomPct + '%',
            width:        size + 'px',
            height:       size + 'px',
            borderRadius: '50%',
            background:   bg,
            boxShadow:    '0 3px 8px rgba(0,0,0,0.6)',
            fontSize:     Math.round(size * 0.3) + 'px',
        });
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Shoulder buttons (L / R)
    // ------------------------------------------------------------------
    function _buildShoulder(key, label, leftPct, rightPct, bottomPct) {
        var btn = _baseBtn(label);
        _css(btn, {
            bottom:       bottomPct + '%',
            width:        '80px',
            height:       '34px',
            borderRadius: '6px',
            background:   '#2a2a3e',
            boxShadow:    '0 2px 6px rgba(0,0,0,0.5)',
            fontSize:     '12px',
        });
        if (leftPct  !== null) btn.style.left  = leftPct  + '%';
        if (rightPct !== null) btn.style.right = rightPct + '%';
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // System buttons (START / SELECT)
    // ------------------------------------------------------------------
    function _buildSys(key, label, rightPct, bottomPct) {
        var btn = _baseBtn(label);
        _css(btn, {
            right:        rightPct + '%',
            bottom:       bottomPct + '%',
            width:        '60px',
            height:       '28px',
            borderRadius: '14px',
            background:   '#2a2a3e',
            boxShadow:    '0 1px 5px rgba(0,0,0,0.5)',
            fontSize:     '9px',
            letterSpacing:'0.4px',
        });
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Build all controls
    // ------------------------------------------------------------------
    function _build() {
        document.querySelectorAll('.ctrl-root').forEach(function (el) { el.remove(); });

        var _orig = document.body.appendChild.bind(document.body);
        document.body.appendChild = function (el) {
            if (el.classList) el.classList.add('ctrl-root');
            return _orig(el);
        };

        try {
            if (mode === 'dpad') {
                _buildDpad();
            } else {
                _buildJoystick();
            }

            // A (right side, upper)
            _buildCircle('a', 'A', 4,  22, 56, '#7a1a1a');
            // B (right side, lower)
            _buildCircle('b', 'B', 16, 12, 48, '#1a3a6a');

            // Shoulder buttons
            _buildShoulder('l', 'L',   0, null, 42);
            _buildShoulder('r', 'R', null,    0, 42);

            // START / SELECT
            _buildSys('start',  'START', 20, 3);
            _buildSys('select', 'SEL',   36, 3);
        } finally {
            document.body.appendChild = _orig;
        }
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    function init()            { _build(); }
    function setMode(newMode)  { mode = newMode; _build(); }
    function rebuild()         { _build(); }
    function toggleEditMode()  {}
    function setEditMode()     {}
    function resetLayout()     { _build(); }

    return { init, setMode, rebuild, toggleEditMode, setEditMode, resetLayout,
             get mode() { return mode; } };
})();
