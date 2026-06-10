// GameControls — GBA-style on-screen controls
// D-pad: 4 completely independent position:fixed buttons (PPSSPP style).
window.GameControls = (function () {
    'use strict';

    let mode = 'dpad'; // 'dpad' | 'joystick'

    // ------------------------------------------------------------------
    // Input binding — Pointer Events with touchstart/touchend fallback
    // ------------------------------------------------------------------
    function _bind(el, key) {
        var held = false;

        function _press(e) {
            if (e && e.cancelable) e.preventDefault();
            if (!held) {
                held = true;
                GameInput.state[key]       = true;
                GameInput.justPressed[key] = true;
            }
        }
        function _release() {
            held = false;
            GameInput.state[key] = false;
        }

        // Pointer Events — primary path (Chrome, Firefox, Edge, Safari 13+)
        el.addEventListener('pointerdown', function (e) {
            try { el.setPointerCapture(e.pointerId); } catch (ex) {}
            _press(e);
        });
        el.addEventListener('pointerup',     _release);
        el.addEventListener('pointercancel', _release);

        // Touch fallback — catches older WebKit / iOS < 13 where Pointer Events fire unreliably
        el.addEventListener('touchstart', _press,   { passive: false });
        el.addEventListener('touchend',   _release, { passive: false });
        el.addEventListener('touchcancel',_release, { passive: false });
    }

    // ------------------------------------------------------------------
    // Style helper — applies an object of camelCase CSS properties
    // ------------------------------------------------------------------
    function _style(el, props) {
        for (var k in props) el.style[k] = props[k];
    }

    // ------------------------------------------------------------------
    // Common base for every control button
    // ------------------------------------------------------------------
    function _makeBtn(label) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        _style(b, {
            position:                'fixed',
            zIndex:                  '200',
            touchAction:             'none',
            userSelect:              'none',
            webkitUserSelect:        'none',
            webkitTapHighlightColor: 'transparent',
            boxSizing:               'border-box',
            cursor:                  'pointer',
            fontFamily:              '"Courier New",Courier,monospace',
            fontWeight:              'bold',
            color:                   'rgba(210,220,240,0.9)',
            border:                  '1.5px solid rgba(255,255,255,0.22)',
            display:                 'flex',
            alignItems:              'center',
            justifyContent:          'center',
            WebkitAppearance:        'none',
            appearance:              'none',
        });
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        return b;
    }

    // ------------------------------------------------------------------
    // PPSSPP-style D-pad
    //
    // Four completely independent position:fixed buttons.
    // No wrapper container — each arm sits directly on the body so
    // there is zero risk of a parent element's pointer-events interfering.
    //
    //      ┌─────┐
    //      │  ▲  │   ← up arm
    // ┌────┤     ├────┐
    // │ ◄  │     │ ►  │   ← left / right arms
    // └────┤     ├────┘
    //      │  ▼  │   ← down arm
    //      └─────┘
    //
    // Origin point (d-pad center) in viewport coordinates:
    //   left = DPAD_CX   bottom = DPAD_CY
    // Each arm is offset from that point.
    // ------------------------------------------------------------------
    var DPAD_CX  = 'calc(8% + 54px)';   // horizontal center of d-pad
    var DPAD_CY  = 'calc(20% + 54px)';  // vertical center from bottom
    var ARM_THICK = 40;   // px — thickness (short axis) of each arm
    var ARM_LONG  = 50;   // px — length    (long  axis) of each arm
    var ARM_GAP   = 2;    // px — gap between center and arm start (visual breathing room)

    function _dpadArm(key, label, dx, dy) {
        var btn = _makeBtn(label);

        // Determine arm orientation
        var isVert = (dy !== 0);
        var w = isVert ? ARM_THICK : ARM_LONG;
        var h = isVert ? ARM_LONG  : ARM_THICK;

        // Horizontal position: DPAD_CX ± offset
        var leftExpr;
        if (dx === 0) {
            // Centered: left = CX - w/2
            leftExpr = 'calc(' + DPAD_CX + ' - ' + (w / 2) + 'px)';
        } else if (dx < 0) {
            // Left arm: right edge at CX - GAP
            leftExpr = 'calc(' + DPAD_CX + ' - ' + (ARM_LONG + ARM_GAP) + 'px)';
        } else {
            // Right arm: left edge at CX + GAP
            leftExpr = 'calc(' + DPAD_CX + ' + ' + ARM_GAP + 'px)';
        }

        // Vertical position: DPAD_CY ± offset (from bottom)
        var bottomExpr;
        if (dy === 0) {
            // Centered vertically: bottom = CY - h/2
            bottomExpr = 'calc(' + DPAD_CY + ' - ' + (h / 2) + 'px)';
        } else if (dy > 0) {
            // Up arm: bottom edge starts at CY + GAP
            bottomExpr = 'calc(' + DPAD_CY + ' + ' + ARM_GAP + 'px)';
        } else {
            // Down arm: top edge at CY - GAP - h  →  bottom = CY - GAP - h
            bottomExpr = 'calc(' + DPAD_CY + ' - ' + (ARM_LONG + ARM_GAP) + 'px)';
        }

        // Border-radius: round the outer corners of each arm
        var br;
        if      (dy > 0) br = '8px 8px 4px 4px';   // up
        else if (dy < 0) br = '4px 4px 8px 8px';   // down
        else if (dx < 0) br = '8px 4px 4px 8px';   // left
        else             br = '4px 8px 8px 4px';   // right

        _style(btn, {
            left:         leftExpr,
            bottom:       bottomExpr,
            width:        w + 'px',
            height:       h + 'px',
            borderRadius: br,
            background:   '#252538',
            boxShadow:    '0 2px 7px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            fontSize:     '14px',
        });

        _bind(btn, key);
        document.body.appendChild(btn);
    }

    function _buildDpad() {
        _dpadArm('up',    '▲',  0,  1);
        _dpadArm('down',  '▼',  0, -1);
        _dpadArm('left',  '◄', -1,  0);
        _dpadArm('right', '►',  1,  0);

        // Cosmetic center circle (no pointer events, just looks nice)
        var center = document.createElement('div');
        _style(center, {
            position:     'fixed',
            left:         'calc(' + DPAD_CX + ' - 16px)',
            bottom:       'calc(' + DPAD_CY + ' - 16px)',
            width:        '32px',
            height:       '32px',
            borderRadius: '50%',
            background:   '#1a1a2c',
            border:       '1.5px solid rgba(255,255,255,0.12)',
            zIndex:       '199',
            pointerEvents:'none',
            touchAction:  'none',
        });
        document.body.appendChild(center);
    }

    // ------------------------------------------------------------------
    // Joystick
    // ------------------------------------------------------------------
    function _buildJoystick() {
        var wrap = _makeBtn('');
        _style(wrap, {
            left:        '4%',
            bottom:      '20%',
            width:       '110px',
            height:      '110px',
            borderRadius:'50%',
            background:  '#252535',
            boxShadow:   '0 2px 8px rgba(0,0,0,0.6)',
            border:      '1.5px solid rgba(255,255,255,0.15)',
        });
        wrap.id = 'joystick-base';

        var thumb = document.createElement('div');
        thumb.id = 'joystick-thumb';
        _style(thumb, {
            position:     'absolute',
            width:        '42%',
            height:       '42%',
            borderRadius: '50%',
            background:   '#3a3a58',
            border:       '1px solid rgba(255,255,255,0.25)',
            top:          '50%',
            left:         '50%',
            transform:    'translate(-50%,-50%)',
            pointerEvents:'none',
        });
        wrap.appendChild(thumb);
        document.body.appendChild(wrap);
        GameInput.bindJoystick(wrap, thumb);
    }

    // ------------------------------------------------------------------
    // Action buttons  A / B
    // ------------------------------------------------------------------
    function _actionBtn(key, label, right, bottom, size, bg) {
        var btn = _makeBtn(label);
        _style(btn, {
            right:        right + '%',
            bottom:       bottom + '%',
            width:        size + 'px',
            height:       size + 'px',
            borderRadius: '50%',
            background:   bg,
            boxShadow:    '0 3px 8px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.1)',
            fontSize:     Math.round(size * 0.32) + 'px',
        });
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Shoulder buttons  L / R
    // ------------------------------------------------------------------
    function _shoulderBtn(key, label, side, bottom) {
        var btn = _makeBtn(label);
        _style(btn, {
            bottom:       bottom + '%',
            width:        '78px',
            height:       '32px',
            borderRadius: side === 'left' ? '0 6px 6px 0' : '6px 0 0 6px',
            background:   '#2a2a3e',
            boxShadow:    '0 2px 6px rgba(0,0,0,0.5)',
            fontSize:     '12px',
        });
        if (side === 'left')  btn.style.left  = '0';
        else                  btn.style.right = '0';
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // System buttons  START / SELECT
    // ------------------------------------------------------------------
    function _sysBtn(key, label, right, bottom) {
        var btn = _makeBtn(label);
        _style(btn, {
            right:        right + '%',
            bottom:       bottom + '%',
            width:        '58px',
            height:       '26px',
            borderRadius: '13px',
            background:   '#2a2a3e',
            boxShadow:    '0 1px 5px rgba(0,0,0,0.5)',
            fontSize:     '8px',
            letterSpacing:'0.4px',
        });
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Build / rebuild everything
    // ------------------------------------------------------------------
    function _build() {
        // Remove previously built controls
        document.querySelectorAll('.ctrl-root').forEach(function (el) { el.remove(); });

        // Monkey-patch body.appendChild briefly to stamp .ctrl-root on every element we add
        var _orig = document.body.appendChild.bind(document.body);
        document.body.appendChild = function (el) {
            if (el.classList) el.classList.add('ctrl-root');
            return _orig(el);
        };
        try {
            if (mode === 'dpad') _buildDpad();
            else                 _buildJoystick();

            _actionBtn('a', 'A',  4, 22, 54, '#7a1a1a');
            _actionBtn('b', 'B', 16, 12, 46, '#1a3a6a');

            _shoulderBtn('l', 'L', 'left',  38);
            _shoulderBtn('r', 'R', 'right', 38);

            _sysBtn('start',  'START', 18, 3);
            _sysBtn('select', 'SEL',   33, 3);
        } finally {
            document.body.appendChild = _orig;
        }
    }

    function init()           { _build(); }
    function setMode(m)       { mode = m; _build(); }
    function rebuild()        { _build(); }
    function toggleEditMode() {}
    function setEditMode()    {}
    function resetLayout()    { _build(); }

    return { init, setMode, rebuild, toggleEditMode, setEditMode, resetLayout,
             get mode() { return mode; } };
})();
