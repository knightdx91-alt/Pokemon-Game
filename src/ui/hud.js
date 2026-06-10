// GameHUD — renders HUD info and settings button onto #ui-overlay
const GAME_VERSION = 'v0.1.8';

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

    // --- Update display ---
    function update() {
        if (!infoEl) return;
        const mapName = (mapRef && mapRef.current) ? mapRef.current.name : '—';
        infoEl.textContent = mapName;

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
        if (fpsEl) fpsEl.textContent = fps + ' FPS · ' + GAME_VERSION;
    }

    function init(map, player) {
        mapRef = map;
        playerRef = player;

        overlay = document.getElementById('ui-overlay');
        if (!overlay) {
            console.warn('[HUD] #ui-overlay not found');
            return;
        }

        // Info box (map name)
        infoEl = document.createElement('div');
        infoEl.id = 'hud-info';
        overlay.appendChild(infoEl);

        // FPS counter (top-right) — also shows version
        fpsEl = document.createElement('div');
        fpsEl.id = 'hud-fps';
        fpsEl.textContent = '-- FPS · ' + GAME_VERSION;
        overlay.appendChild(fpsEl);

        // Settings button (bottom-left)
        settingsBtn = document.createElement('button');
        settingsBtn.id = 'settings-btn';
        settingsBtn.textContent = '⚙ Settings';
        overlay.appendChild(settingsBtn);

        // Map name banner
        _bannerEl = document.createElement('div');
        _bannerEl.id = 'map-name-banner';
        _bannerEl.style.display = 'none';
        overlay.appendChild(_bannerEl);

        initSettings();
        update();
    }

    return { init, update, setFps };
})();
