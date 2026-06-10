// GameControls — wires static HTML gamepad buttons to GameInput.
window.GameControls = (function () {
    'use strict';

    var mode = 'dpad';

    function _set(key, val) {
        if (!window.GameInput) return;
        GameInput.state[key] = val;
        if (val) GameInput.justPressed[key] = true;
    }

    function _wire(id, key) {
        var el = document.getElementById(id);
        if (!el) return;

        el.style.pointerEvents = 'auto';
        el.style.touchAction   = 'none';
        el.style.userSelect    = 'none';

        // touchstart/touchend — most reliable on mobile
        el.addEventListener('touchstart', function (e) {
            e.preventDefault();
            _set(key, true);
        }, { passive: false });

        el.addEventListener('touchend', function (e) {
            e.preventDefault();
            _set(key, false);
        }, { passive: false });

        el.addEventListener('touchcancel', function () {
            _set(key, false);
        });

        // mousedown/mouseup — desktop fallback
        el.addEventListener('mousedown', function (e) {
            e.preventDefault();
            _set(key, true);
        });
        el.addEventListener('mouseup', function () { _set(key, false); });
        el.addEventListener('mouseleave', function () { _set(key, false); });
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

    function setMode(m)       { mode = m; }
    function rebuild()        {}
    function toggleEditMode() {}
    function setEditMode()    {}
    function resetLayout()    {}

    return { init, setMode, rebuild, toggleEditMode, setEditMode, resetLayout,
             get mode() { return mode; } };
})();
