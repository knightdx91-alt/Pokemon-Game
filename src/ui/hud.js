// GameHUD — renders HUD info and settings button onto #ui-overlay
window.GameHUD = (function () {
    let overlay = null;
    let infoEl = null;
    let settingsBtn = null;
    let settingsPanel = null;
    let mapRef = null;
    let playerRef = null;

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
    }

    // --- Update display ---
    function update() {
        if (!infoEl) return;
        const mapName = (mapRef && mapRef.current) ? mapRef.current.name : '—';
        const px = playerRef ? playerRef.x : '?';
        const py = playerRef ? playerRef.y : '?';
        infoEl.textContent = '';
        const line1 = document.createElement('div');
        line1.textContent = mapName;
        const line2 = document.createElement('div');
        line2.textContent = `(${px}, ${py})`;
        infoEl.appendChild(line1);
        infoEl.appendChild(line2);
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

        // Settings button
        settingsBtn = document.createElement('button');
        settingsBtn.id = 'settings-btn';
        settingsBtn.textContent = '⚙ Settings';
        overlay.appendChild(settingsBtn);

        initSettings();
        update();
    }

    return { init, update };
})();
