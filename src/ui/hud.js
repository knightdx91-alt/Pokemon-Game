// GameHUD — renders HUD info and settings button onto #ui-overlay
const GAME_VERSION = 'v0.3.9';

window.GameHUD = (function () {
    let overlay = null;
    let infoEl = null;
    let fpsEl = null;
    let settingsBtn = null;
    let settingsPanel = null;
    let mapRef = null;
    let playerRef = null;
    let _lastMapName = null;
    let _bannerEl = null;
    let _bannerTimer = null;

    // --- Settings wiring ---
    function initSettings() {
        settingsPanel = document.getElementById('settings-panel');
        const closeBtn = document.getElementById('settings-close');
        const resetBtn = document.getElementById('reset-layout-btn');
        const sizeSlider = document.getElementById('btn-size-slider');
        const sizeValue = document.getElementById('btn-size-value');
        const toggleDpad = document.getElementById('toggle-dpad');
        const toggleJoystick = document.getElementById('toggle-joystick');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.classList.remove('hidden');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                settingsPanel.classList.add('hidden');
            });
        }

        document.addEventListener('mousedown', (e) => {
            if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
                if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
                    settingsPanel.classList.add('hidden');
                }
            }
        });

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (window.GameControls) GameControls.resetLayout();
            });
        }

        const customizeBtn = document.getElementById('customize-layout-btn');
        if (customizeBtn) {
            customizeBtn.addEventListener('click', () => {
                settingsPanel.classList.add('hidden');
                if (window.GameControls) GameControls.toggleEditMode();
            });
        }

        document.querySelectorAll('.orient-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.orient;
                if (val && window.GameLayout) GameLayout.setOrientation(val);
                document.querySelectorAll('.orient-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        if (sizeSlider) {
            const saved = localStorage.getItem('pokemon_control_scale');
            if (saved) {
                sizeSlider.value = saved;
                document.documentElement.style.setProperty('--control-scale', saved);
                if (sizeValue) sizeValue.textContent = parseFloat(saved).toFixed(1) + '×';
            }

            sizeSlider.addEventListener('input', () => {
                const v = sizeSlider.value;
                document.documentElement.style.setProperty('--control-scale', v);
                if (sizeValue) sizeValue.textContent = parseFloat(v).toFixed(1) + '×';
                localStorage.setItem('pokemon_control_scale', v);
                if (window.GameControls) GameControls.rebuild();
            });
        }

        if (toggleDpad) {
            toggleDpad.addEventListener('click', () => {
                if (window.GameControls) GameControls.setMode('dpad');
                toggleDpad.classList.add('active');
                if (toggleJoystick) toggleJoystick.classList.remove('active');
            });
        }
        if (toggleJoystick) {
            toggleJoystick.addEventListener('click', () => {
                if (window.GameControls) GameControls.setMode('joystick');
                toggleJoystick.classList.add('active');
                if (toggleDpad) toggleDpad.classList.remove('active');
            });
        }
    }

    // --- Map name banner ---
    function _showBanner(name) {
        if (!_bannerEl || !overlay) return;
        _bannerEl.textContent = name;
        _bannerEl.style.opacity = '1';
        if (_bannerTimer) clearTimeout(_bannerTimer);
        _bannerTimer = setTimeout(function () {
            _bannerEl.style.opacity = '0';
            _bannerTimer = setTimeout(function () {
                _bannerEl.style.display = 'none';
            }, 400);
        }, 2000);
        _bannerEl.style.display = 'block';
    }

    let _mapLine   = null;
    let _coordLine = null;
    let _fpsLine   = null;

    // --- Update display ---
    function update() {
        if (!infoEl) return;
        const mapName = window._mapName || (mapRef && mapRef.current ? mapRef.current.name : '—');
        const coords  = playerRef ? playerRef.x + ', ' + playerRef.y : '—';
        const ji = window.GameInput && window.GameInput.justPressed;
        const inputDbg = ji ? [ji.up?'U':'',ji.down?'D':'',ji.left?'L':'',ji.right?'R':'',ji.a?'A':'',ji.start?'ST':''].filter(Boolean).join('') : '';
        if (_mapLine)   _mapLine.textContent   = mapName;
        if (_coordLine) _coordLine.textContent = coords + (inputDbg ? ' [' + inputDbg + ']' : '');

        if (mapName !== _lastMapName && mapName !== '—') {
            _lastMapName = mapName;
            _showBanner(mapName);
            if (window.GameSave && GameSave.state) {
                if (GameSave.state.visitedMaps) {
                    GameSave.state.visitedMaps.add(mapName);
                }
                GameSave.markDirty();
            }
        }
    }

    // Called by renderer every 500ms
    function setFps(fps) {
        if (_fpsLine) _fpsLine.textContent = fps + ' FPS';
    }

    function init(map, player) {
        mapRef    = map;
        playerRef = player;

        overlay = document.getElementById('ui-overlay');
        if (!overlay) {
            console.warn('[HUD] #ui-overlay not found');
            return;
        }

        // Single info block: map name / coords / fps stacked
        infoEl = document.createElement('div');
        infoEl.id = 'hud-info';

        const _verLine = document.createElement('div');
        _verLine.textContent = GAME_VERSION;

        _mapLine = document.createElement('div');
        _mapLine.textContent = '—';

        _coordLine = document.createElement('div');
        _coordLine.textContent = '—';

        _fpsLine = document.createElement('div');
        _fpsLine.textContent = '-- FPS';

        infoEl.appendChild(_verLine);
        infoEl.appendChild(_mapLine);
        infoEl.appendChild(_coordLine);
        infoEl.appendChild(_fpsLine);
        overlay.appendChild(infoEl);

        // Keep fpsEl reference non-null (CSS hides #hud-fps anyway)
        fpsEl = _fpsLine;

        // Settings button (bottom-left of overlay)
        settingsBtn = document.createElement('button');
        settingsBtn.id = 'settings-btn';
        settingsBtn.textContent = '⚙';
        overlay.appendChild(settingsBtn);

        // Map name banner (transition flash)
        _bannerEl = document.createElement('div');
        _bannerEl.id = 'map-name-banner';
        _bannerEl.style.display = 'none';
        overlay.appendChild(_bannerEl);

        initSettings();
        update();
    }

    return { init, update, setFps };
})();
