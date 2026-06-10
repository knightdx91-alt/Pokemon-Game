// GameControls — wires static HTML gamepad buttons to GameInput.
// Buttons are declared in game.html; this file only adds event listeners.
window.GameControls = (function () {
    'use strict';

    var mode = 'dpad';

    // Wire a button element to an input key.
    // Uses touchstart/touchend as primary (works on all mobile browsers).
    // mousedown/mouseup as secondary (desktop testing).
    function _wire(id, key) {
        var el = document.getElementById(id);
        if (!el) return;

        function press(e) {
            e.preventDefault();
            GameInput.state[key]       = true;
            GameInput.justPressed[key] = true;
        }
        function release(e) {
            if (e && e.cancelable) e.preventDefault();
            GameInput.state[key] = false;
        }

        el.addEventListener('touchstart',  press,   { passive: false });
        el.addEventListener('touchend',    release, { passive: false });
        el.addEventListener('touchcancel', release, { passive: false });

        el.addEventListener('mousedown', press);
        el.addEventListener('mouseup',   release);
        el.addEventListener('mouseleave',release);
    }

    function init() {
        _wire('gp-up',     'up');
        _wire('gp-down',   'down');
        _wire('gp-left',   'left');
        _wire('gp-right',  'right');
        _wire('gp-a',      'a');
        _wire('gp-b',      'b');
        _wire('gp-l',      'l');
        _wire('gp-r',      'r');
        _wire('gp-start',  'start');
        _wire('gp-select', 'select');
    }

    // Stubs kept so hud.js / settings panel calls don't throw
    function setMode(m)       { mode = m; }
    function rebuild()        {}
    function toggleEditMode() {}
    function setEditMode()    {}
    function resetLayout()    {}

    return { init, setMode, rebuild, toggleEditMode, setEditMode, resetLayout,
             get mode() { return mode; } };
})();
