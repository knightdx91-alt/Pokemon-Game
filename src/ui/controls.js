// GameControls — simple fixed-position GBA buttons
window.GameControls = (function () {
    'use strict';

    let mode = 'dpad'; // 'dpad' | 'joystick'

    // ------------------------------------------------------------------
    // Button binding — Pointer Events + setPointerCapture
    // setPointerCapture ensures pointerup fires on the element even if
    // the finger slides off, preventing stuck-pressed states.
    // ------------------------------------------------------------------
    function _bind(el, key) {
        el.addEventListener('pointerdown', function (e) {
            if (e.cancelable) e.preventDefault();
            el.setPointerCapture(e.pointerId);
            GameInput.state[key]       = true;
            GameInput.justPressed[key] = true;
        });
        el.addEventListener('pointerup',     function () { GameInput.state[key] = false; });
        el.addEventListener('pointercancel', function () { GameInput.state[key] = false; });
    }

    // ------------------------------------------------------------------
    // Style helper
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
    // D-pad — zone-based on a single container
    //
    // The whole cross is one hit area. Direction is determined from where
    // the pointer is relative to the center, so sliding gestures work
    // correctly without needing to hit individual small buttons.
    // ------------------------------------------------------------------
    function _buildDpad() {
        const wrap = document.createElement('div');
        _pos(wrap, 4, 68, 120, 120);
        wrap.style.cursor = 'pointer';

        // Cross background via CSS pseudo-elements on .ctrl-dpad-cross
        const cross = document.createElement('div');
        cross.className = 'ctrl-dpad-cross';
        cross.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
        wrap.appendChild(cross);

        // Cosmetic arrow labels — pointer-events:none, purely visual
        var cosmetic = [
            { label: '▲', css: 'left:32%;top:0;width:36%;height:36%;border-radius:4px 4px 0 0' },
            { label: '▼', css: 'left:32%;bottom:0;width:36%;height:36%;border-radius:0 0 4px 4px' },
            { label: '◄', css: 'top:32%;left:0;width:36%;height:36%;border-radius:4px 0 0 4px' },
            { label: '►', css: 'top:32%;right:0;width:36%;height:36%;border-radius:0 4px 4px 0' },
        ];
        cosmetic.forEach(function (d) {
            var div = document.createElement('div');
            div.style.cssText = 'position:absolute;pointer-events:none;background:#2a2a3e;' +
                'border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;' +
                'justify-content:center;color:rgba(200,200,220,0.5);font-size:11px;' + d.css;
            div.textContent = d.label;
            wrap.appendChild(div);
        });

        // Zone-based pointer input
        var active  = new Map(); // pointerId -> direction string | null
        var claimed = new Set(); // directions currently held by this dpad

        function dirFrom(e) {
            var r  = wrap.getBoundingClientRect();
            var dx = e.clientX - (r.left + r.width  * 0.5);
            var dy = e.clientY - (r.top  + r.height * 0.5);
            if (Math.hypot(dx, dy) < r.width * 0.12) return null; // dead-zone
            return Math.abs(dx) >= Math.abs(dy)
                ? (dx > 0 ? 'right' : 'left')
                : (dy > 0 ? 'down'  : 'up');
        }

        function flush() {
            // Only clear the directions this d-pad last claimed
            // (avoids clobbering keyboard-held directions)
            claimed.forEach(function (d) { GameInput.state[d] = false; });
            claimed.clear();
            active.forEach(function (dir) {
                if (dir) {
                    GameInput.state[dir]       = true;
                    GameInput.justPressed[dir] = true;
                    claimed.add(dir);
                }
            });
        }

        wrap.addEventListener('pointerdown', function (e) {
            if (e.cancelable) e.preventDefault();
            wrap.setPointerCapture(e.pointerId);
            active.set(e.pointerId, dirFrom(e));
            flush();
        });
        wrap.addEventListener('pointermove', function (e) {
            if (!active.has(e.pointerId)) return;
            if (e.cancelable) e.preventDefault();
            active.set(e.pointerId, dirFrom(e));
            flush();
        });
        wrap.addEventListener('pointerup',     function (e) { active.delete(e.pointerId); flush(); });
        wrap.addEventListener('pointercancel', function (e) { active.delete(e.pointerId); flush(); });

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
        base.style.cssText = 'position:absolute;inset:0;border-radius:50%;background:#252535;' +
            'border:1px solid rgba(255,255,255,0.15);touch-action:none;';

        const thumb = document.createElement('div');
        thumb.id = 'joystick-thumb';
        thumb.style.cssText = 'position:absolute;width:40%;height:40%;border-radius:50%;' +
            'background:#3a3a58;border:1px solid rgba(255,255,255,0.25);' +
            'top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;';

        base.appendChild(thumb);
        wrap.appendChild(base);
        document.body.appendChild(wrap);

        GameInput.bindJoystick(base, thumb);
    }

    // ------------------------------------------------------------------
    // Circle buttons (A / B)
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
        btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Shoulder buttons (L / R)
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
        btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // System buttons (START / SELECT)
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
        btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        _bind(btn, key);
        document.body.appendChild(btn);
    }

    // ------------------------------------------------------------------
    // Build all controls
    // ------------------------------------------------------------------
    function _build() {
        // Remove any previously built controls
        document.querySelectorAll('.ctrl-root').forEach(function (el) { el.remove(); });

        // Temporarily wrap appendChild to tag everything we create
        const _orig  = document.body.appendChild.bind(document.body);
        document.body.appendChild = function (el) {
            if (el.classList) el.classList.add('ctrl-root');
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

        document.body.appendChild = _orig;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    function init()             { _build(); }
    function setMode(newMode)   { mode = newMode; _build(); }
    function rebuild()          { _build(); }
    function toggleEditMode()   {}
    function setEditMode()      {}
    function resetLayout()      { _build(); }

    return { init, setMode, rebuild, toggleEditMode, setEditMode, resetLayout, get mode() { return mode; } };
})();
