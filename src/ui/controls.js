// GameControls — wires static HTML gamepad buttons to GameInput.
// Buttons are declared in game.html; this file only adds event listeners.
window.GameControls = (function () {
    'use strict';

    var mode = 'dpad';

    // Wire a button element to an input key using Pointer Events.
    // pointerdown/up work on touch, mouse, and stylus with no passive issues.
    function _wire(id, key) {
        var el = document.getElementById(id);
        if (!el) return;

        // Force pointer-events on the element itself regardless of ancestors
        el.style.pointerEvents = 'auto';
        el.style.touchAction   = 'none';

        el.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            el.setPointerCapture(e.pointerId);
            GameInput.state[key]       = true;
            GameInput.justPressed[key] = true;
        });

        el.addEventListener('pointerup', function (e) {
            GameInput.state[key] = false;
        });

        el.addEventListener('pointercancel', function (e) {
            GameInput.state[key] = false;
        });
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
