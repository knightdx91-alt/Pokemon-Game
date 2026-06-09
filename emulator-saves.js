// emulator-saves.js — cloud save sync for Emerald Enhanced
// Pushes/pulls the battery save (.srm) to/from GitHub on every manual save
// and auto-loads it whenever the emulator starts.
(function () {
    var REPO      = 'knightdx91-alt/pokemon-game';
    var SAVE_PATH = 'saves/emerald_ee.srm';

    // ── helpers ────────────────────────────────────────────────────────────────

    function token() { return localStorage.getItem('gh_debug_token'); }

    function ghHeaders() {
        return {
            Authorization: 'token ' + token(),
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json'
        };
    }

    function gm() {
        return window.EJS_emulator && window.EJS_emulator.gameManager;
    }

    function setBtn(el, txt, col) {
        if (!el) return;
        el.textContent = txt;
        el.style.color  = col || '#18b8c8';
    }

    // ── export save bytes from emulator FS ────────────────────────────────────

    function exportSave() {
        var g = gm();
        if (!g) return null;
        try {
            g.saveSaveFiles();                         // flush SRAM → FS
            var path = g.getSaveFilePath();
            if (!path) return null;
            return g.FS.readFile(path);                // Uint8Array
        } catch (e) {
            console.warn('[Save] export error:', e);
            return null;
        }
    }

    // ── inject save bytes into emulator FS ────────────────────────────────────

    function importSave(bytes) {
        var g = gm();
        if (!g) return false;
        try {
            var path = g.getSaveFilePath();
            if (!path) return false;
            // Ensure /data/saves exists (it normally does, but be safe)
            var dir = path.split('/').slice(0, -1).join('/');
            try { if (dir && !g.FS.analyzePath(dir).exists) g.FS.mkdir(dir); } catch (_) {}
            g.FS.writeFile(path, bytes);
            g.loadSaveFiles();                         // tell core to reload
            return true;
        } catch (e) {
            console.warn('[Save] import error:', e);
            return false;
        }
    }

    // ── GitHub: get current SHA of save file (needed for updates) ─────────────

    function getFileSha(cb) {
        fetch('https://api.github.com/repos/' + REPO + '/contents/' + SAVE_PATH,
            { headers: ghHeaders() })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { cb(d ? d.sha : null, d ? d.content : null); })
        .catch(function ()  { cb(null, null); });
    }

    // ── upload save to GitHub ──────────────────────────────────────────────────

    function uploadSave(btn) {
        if (!token()) {
            alert('No GitHub token stored.\nIn the main game: Settings → paste token → Save.');
            return;
        }
        var data = exportSave();
        if (!data || !data.length) {
            alert('No save data found.\nMake sure you\'ve saved in-game at least once (using the in-game save menu).');
            return;
        }

        setBtn(btn, '☁ Saving…', '#e8c000');

        // btoa on a Uint8Array
        var b64 = btoa(Array.prototype.reduce.call(data, function (s, b) {
            return s + String.fromCharCode(b);
        }, ''));

        getFileSha(function (sha) {
            var body = {
                message: 'Save game ' + new Date().toISOString(),
                content: b64,
                branch: 'main'
            };
            if (sha) body.sha = sha;

            fetch('https://api.github.com/repos/' + REPO + '/contents/' + SAVE_PATH, {
                method: 'PUT',
                headers: ghHeaders(),
                body: JSON.stringify(body)
            })
            .then(function (r) {
                if (!r.ok) return r.json().then(function (d) {
                    throw new Error(d.message || ('HTTP ' + r.status));
                });
                return r.json();
            })
            .then(function () {
                setBtn(btn, '✓ Saved!', '#20d840');
                setTimeout(function () { setBtn(btn, '☁ Save', '#18b8c8'); }, 2500);
                console.log('[Save] Uploaded to GitHub:', SAVE_PATH);
            })
            .catch(function (e) {
                setBtn(btn, '✗ Error', '#e82020');
                setTimeout(function () { setBtn(btn, '☁ Save', '#18b8c8'); }, 3000);
                alert('Upload error:\n' + e.message);
            });
        });
    }

    // ── download and inject save from GitHub ──────────────────────────────────

    function downloadAndLoad(btn) {
        if (!token()) return;  // no token = skip silently

        getFileSha(function (sha, content) {
            if (!content) {
                console.log('[Save] No cloud save found at', SAVE_PATH);
                return;
            }
            try {
                var b64    = content.replace(/\n/g, '');
                var binary = atob(b64);
                var bytes  = new Uint8Array(binary.length);
                for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

                if (importSave(bytes)) {
                    console.log('[Save] Cloud save loaded (' + bytes.length + ' bytes)');
                    setBtn(btn, '✓ Loaded', '#20d840');
                    setTimeout(function () { setBtn(btn, '☁ Save', '#18b8c8'); }, 2500);
                }
            } catch (e) {
                console.warn('[Save] Load error:', e);
            }
        });
    }

    // ── Add "☁ Save" button to top bar ────────────────────────────────────────

    function addSaveButton() {
        var topBar = document.getElementById('top-bar');
        if (!topBar || document.getElementById('cloud-save-btn')) return null;
        var btn = document.createElement('button');
        btn.id = 'cloud-save-btn';
        btn.textContent = '☁ Save';
        btn.style.cssText = [
            'background:#0a1830', 'color:#18b8c8', 'border:1px solid #18b8c8',
            'border-radius:3px', 'padding:4px 8px', 'font-size:12px',
            'cursor:pointer', 'font-family:"Courier New",Courier,monospace',
            'touch-action:manipulation'
        ].join(';');
        topBar.appendChild(btn);
        return btn;
    }

    // ── Chain onto EJS_onGameStart ─────────────────────────────────────────────
    // EmulatorJS calls window.EJS_onGameStart() directly, so overriding it here
    // (after all inline scripts have run) hooks into it safely.

    var _prev = window.EJS_onGameStart || function () {};
    window.EJS_onGameStart = function () {
        _prev();
        // Give the emulator ~1.5 s to finish mounting the IDBFS save directory
        var btn = document.getElementById('cloud-save-btn');
        setTimeout(function () { downloadAndLoad(btn); }, 1500);
    };

    // ── Wire up button on DOMContentLoaded ───────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        var btn = addSaveButton();
        if (btn) {
            btn.addEventListener('click', function () {
                if (!gm()) { alert('Emulator not running yet.'); return; }
                uploadSave(btn);
            });
        }
    });
})();
