// GameHUD — renders HUD info and settings button onto #ui-overlay
window.GameHUD = (function () {
    let overlay = null;
    let infoEl = null;
    let coordsEl = null;
    let settingsBtn = null;
    let settingsPanel = null;
    let mapRef = null;
    let playerRef = null;
    let _lastMapName = null;
    let _bannerEl = null;
    let _bannerTimer = null;
    let _toastEl = null;
    let _toastTimer = null;

    const TIER_ICON = { platinum: '💎', gold: '🥇', silver: '🥈', bronze: '🥉' };

    // --- Achievement toast ---
    function showAchievementToast(ach) {
        if (!_toastEl) return;
        clearTimeout(_toastTimer);

        _toastEl.innerHTML =
            '<div class="ach-toast-title">Achievement Unlocked!</div>'
          + '<div class="ach-toast-name">'
          + (TIER_ICON[ach.tier] || '') + ' ' + (ach.name || '')
          + '</div>';

        _toastEl.classList.remove('ach-toast-hide');
        _toastEl.classList.add('ach-toast-show');

        _toastTimer = setTimeout(function () {
            _toastEl.classList.remove('ach-toast-show');
            _toastEl.classList.add('ach-toast-hide');
        }, 3000);
    }

    // --- Settings wiring ---
    function initSettings() {
        settingsPanel = document.getElementById('settings-panel');
        const closeBtn = document.getElementById('settings-close');
        const resetBtn = document.getElementById('reset-layout-btn');
        const sizeSlider = document.getElementById('btn-size-slider');
        const sizeValue = document.getElementById('btn-size-value');
        const toggleDpad = document.getElementById('toggle-dpad');
        const toggleJoystick = document.getElementById('toggle-joystick');

        // Open settings
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsPanel.classList.remove('hidden');
            });
        }

        // Close settings
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                settingsPanel.classList.add('hidden');
            });
        }

        // Close on overlay click outside panel
        document.addEventListener('mousedown', (e) => {
            if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
                if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
                    settingsPanel.classList.add('hidden');
                }
            }
        });

        // Reset layout
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (window.GameLayout) GameLayout.reset();
            });
        }

        // Customize button layout
        const customizeBtn = document.getElementById('customize-layout-btn');
        if (customizeBtn) {
            customizeBtn.addEventListener('click', () => {
                settingsPanel.classList.add('hidden');
                if (window.GameControls) GameControls.toggleEditMode();
            });
        }

        // Button size slider
        if (sizeSlider) {
            // Load saved scale
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
            });
        }

        // Control mode toggle
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

        // Controls opacity slider (only visible in landscape modes)
        const opacitySlider = document.getElementById('controls-opacity-slider');
        const opacityValue  = document.getElementById('controls-opacity-value');
        if (opacitySlider) {
            const savedOpacity = localStorage.getItem('pokemon_controls_opacity');
            if (savedOpacity) {
                opacitySlider.value = savedOpacity;
                document.documentElement.style.setProperty('--controls-opacity', savedOpacity);
                if (opacityValue) opacityValue.textContent = Math.round(parseFloat(savedOpacity) * 100) + '%';
            }
            opacitySlider.addEventListener('input', function () {
                const v = opacitySlider.value;
                document.documentElement.style.setProperty('--controls-opacity', v);
                if (opacityValue) opacityValue.textContent = Math.round(parseFloat(v) * 100) + '%';
                localStorage.setItem('pokemon_controls_opacity', v);
            });
        }

        // Orientation buttons
        const orientBtns = document.querySelectorAll('.orient-btn');
        if (orientBtns.length) {
            const savedOrient = window.GameLayout ? GameLayout.getOrientationPref() : 'auto';
            orientBtns.forEach(btn => {
                if (btn.dataset.orient === savedOrient) btn.classList.add('active');
                else btn.classList.remove('active');
                btn.addEventListener('click', () => {
                    orientBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (window.GameLayout) GameLayout.setOrientation(btn.dataset.orient);
                });
            });
        }
    }

    // --- Map name banner ---
    function _showBanner(name) {
        if (!_bannerEl || !overlay) return;
        _bannerEl.textContent = name;
        _bannerEl.style.opacity = '1';
        if (_bannerTimer) clearTimeout(_bannerTimer);
        // Fade out after 2s
        _bannerTimer = setTimeout(function () {
            _bannerEl.style.opacity = '0';
            _bannerTimer = setTimeout(function () {
                _bannerEl.style.display = 'none';
            }, 400);
        }, 2000);
        _bannerEl.style.display = 'block';
    }

    const GAME_VERSION = 'v0.2.9';

    // --- Update display ---
    function update() {
        if (!infoEl) return;
        const mapName = (mapRef && mapRef.current) ? mapRef.current.name : '—';
        infoEl.innerHTML = mapName + '<br><span id="hud-version">' + GAME_VERSION + '</span>';
        if (coordsEl && playerRef) {
            coordsEl.textContent = `x: ${playerRef.x}  y: ${playerRef.y}`;
        }

        // Show banner when map changes
        if (mapName !== _lastMapName && mapName !== '—') {
            _lastMapName = mapName;
            _showBanner(mapName);
            // Record as visited
            if (window.GameSave && GameSave.state) {
                if (GameSave.state.visitedMaps) {
                    GameSave.state.visitedMaps.add(mapName);
                }
                GameSave.markDirty();
            }
        }
    }

    function init(map, player) {
        mapRef = map;
        playerRef = player;

        overlay = document.getElementById('ui-overlay');
        if (!overlay) {
            console.warn('[HUD] #ui-overlay not found');
            return;
        }

        // Info box (map name + position)
        infoEl = document.createElement('div');
        infoEl.id = 'hud-info';
        overlay.appendChild(infoEl);

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

        // Coordinates display — always visible below the banner
        coordsEl = document.createElement('div');
        coordsEl.id = 'hud-coords';
        overlay.appendChild(coordsEl);

        // Achievement toast
        _toastEl = document.createElement('div');
        _toastEl.id = 'ach-toast';
        _toastEl.className = 'ach-toast ach-toast-hide';
        overlay.appendChild(_toastEl);

        initSettings();
        update();
    }

    return { init, update, showAchievementToast };
})();
