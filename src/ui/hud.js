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

    const GAME_VERSION = 'v0.3.32';

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

        // Screenshot button — sits below #hud-info (top-left area)
        var ssBtn = document.createElement('button');
        ssBtn.id = 'screenshot-btn';
        ssBtn.textContent = '📷 Screenshot';
        ssBtn.title = 'Screenshot → GitHub Gist';
        ssBtn.style.cssText = 'position:absolute;top:36px;left:4px;z-index:100;background:#0a1830;color:#18b8c8;border:1px solid #18b8c8;border-radius:3px;padding:4px 8px;font-size:12px;cursor:pointer;pointer-events:all;touch-action:manipulation;';
        ssBtn.addEventListener('click', _takeScreenshot);
        overlay.appendChild(ssBtn);

        // Token input in settings panel
        var tokenInput = document.getElementById('screenshot-token-input');
        var tokenSave  = document.getElementById('screenshot-token-save');
        if (tokenInput) {
            var saved = localStorage.getItem('gh_debug_token');
            if (saved) tokenInput.value = saved;
        }
        if (tokenSave) {
            tokenSave.addEventListener('click', function() {
                var v = tokenInput ? tokenInput.value.trim() : '';
                if (v) {
                    localStorage.setItem('gh_debug_token', v);
                    tokenSave.textContent = '✓ Saved';
                    setTimeout(function(){ tokenSave.textContent = 'Save'; }, 1500);
                }
            });
        }

        initSettings();
        update();
    }

    // --- Screenshot → GitHub repo ---
    function _takeScreenshot() {
        var screen = document.getElementById('screen-primary');
        var canvas = screen ? screen.querySelector('canvas') : null;
        var subCanvas = document.querySelector('#start-menu-sub canvas');
        var target = subCanvas || canvas;
        if (!target) { alert('No canvas found to screenshot.'); return; }

        var dataUrl = target.toDataURL('image/jpeg', 0.85);
        var base64 = dataUrl.replace(/^data:image\/(jpeg|png);base64,/, '');
        var ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';

        var token = localStorage.getItem('gh_debug_token');
        if (!token) {
            alert('No GitHub token set.\nOpen Settings → paste your token → Save, then try again.');
            return;
        }

        var ts = new Date().toISOString().replace(/[:.]/g, '-');
        var fname = 'shot-' + ts + '.' + ext;
        var hdrs = { Authorization: 'token ' + token, 'Content-Type': 'application/json' };
        var files = {};
        files[fname] = { content: base64 };
        files['view.html'] = { content: '<!DOCTYPE html><html><body style="margin:0;background:#000"><img src="data:image/' + ext + ';base64,' + base64 + '" style="max-width:100%;image-rendering:pixelated"></body></html>' };

        var gistId = localStorage.getItem('gh_screenshot_gist');
        var req;
        if (gistId) {
            req = fetch('https://api.github.com/gists/' + gistId, {
                method: 'PATCH', headers: hdrs,
                body: JSON.stringify({ files: files })
            });
        } else {
            req = fetch('https://api.github.com/gists', {
                method: 'POST', headers: hdrs,
                body: JSON.stringify({ description: 'Pokemon screenshots', public: false, files: files })
            });
        }

        req.then(function(r) {
            if (!r.ok) return r.text().then(function(t){
                var msg = t; try { msg = JSON.parse(t).message || t; } catch(e){}
                throw new Error(r.status + ': ' + msg);
            });
            return r.json();
        })
        .then(function(gist) {
            localStorage.setItem('gh_screenshot_gist', gist.id);
            var btn = document.getElementById('screenshot-btn');
            if (btn) { btn.style.color = '#20d840'; setTimeout(function(){ btn.style.color = '#18b8c8'; }, 2000); }
        })
        .catch(function(e) { alert('Screenshot error:\n' + e.message); });
    }

    return { init, update, showAchievementToast };
})();
