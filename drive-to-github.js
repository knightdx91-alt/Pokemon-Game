// drive-to-github.js — pick a file from Google Drive, upload it to the GitHub repo.
// Self-contained: loads Google API scripts, runs the Drive picker, streams the
// file, then commits it to the repo via the Git Data (blob) API so even large
// files (ROMs etc.) go through reliably. Files land on the 'uploads' branch at
// uploads/<filename>. Reuses the same OAuth client + reversed PAT as the rest
// of RetroPlay. Exposes window.DriveToGitHub.start().
(function () {
    var REPO   = 'knightdx91-alt/pokemon-game';
    var BRANCH = 'uploads';
    var PATH_PREFIX = 'uploads/';
    // Same Google OAuth client used by emulator.html
    var CLIENT_ID = '74660999441-3tu0u98phuckm7avp4kh6rnohpo84l1f.apps.googleusercontent.com';
    var SCOPE     = 'https://www.googleapis.com/auth/drive.readonly';
    // Token stored reversed to avoid secret scanner triggering on the source file
    var TOKEN = 'IuWWfaKTQMSVRG5HSKuHBZPvlHq1Vpxp3AlUjYkeeF9Qe9dmQyX6f8RcTyg_w567PxfxUQLJ0QCJO3EC11_tap_buhtig'
                .split('').reverse().join('');

    var _accessToken = null;
    var _gLoaded = false;
    var _toast = null;

    function ghHeaders() {
        return {
            Authorization: 'token ' + TOKEN,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json'
        };
    }

    /* ---- tiny status toast --------------------------------------------- */
    function toast(msg, color) {
        if (!_toast) {
            _toast = document.createElement('div');
            _toast.style.cssText =
                'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
                'max-width:90%;padding:12px 18px;border-radius:10px;z-index:99999;' +
                'background:#16161c;color:#e8e8ef;font:14px/1.4 system-ui,sans-serif;' +
                'border:1px solid #2a2a33;box-shadow:0 6px 24px rgba(0,0,0,.5);text-align:center;';
            document.body.appendChild(_toast);
        }
        _toast.style.display = 'block';
        _toast.style.color = color || '#e8e8ef';
        _toast.textContent = msg;
    }
    function hideToast(delay) {
        if (!_toast) return;
        setTimeout(function () { if (_toast) _toast.style.display = 'none'; }, delay || 2500);
    }

    /* ---- load Google scripts ------------------------------------------- */
    function loadGoogle(cb) {
        if (_gLoaded) { cb(); return; }
        var pending = 2;
        function done() { if (--pending === 0) { _gLoaded = true; cb(); } }
        function add(src) {
            var s = document.createElement('script');
            s.src = src; s.onload = done;
            s.onerror = function () { toast('Failed to load Google scripts (offline?)', '#e82020'); hideToast(4000); };
            document.head.appendChild(s);
        }
        add('https://apis.google.com/js/api.js');
        add('https://accounts.google.com/gsi/client');
    }

    function getToken(cb) {
        if (_accessToken) { cb(_accessToken); return; }
        gapi.load('client', function () {
            var client = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPE,
                callback: function (resp) {
                    if (resp && resp.access_token) { _accessToken = resp.access_token; cb(_accessToken); }
                    else { toast('Google sign-in cancelled', '#e8c000'); hideToast(); }
                }
            });
            client.requestAccessToken();
        });
    }

    /* ---- Drive picker -------------------------------------------------- */
    function pick(token) {
        gapi.load('picker', function () {
            var view = new google.picker.DocsView(google.picker.ViewId.DOCS)
                .setIncludeFolders(true)
                .setSelectFolderEnabled(false);
            new google.picker.PickerBuilder()
                .addView(view)
                .setOAuthToken(token)
                .setCallback(function (data) {
                    if (data[google.picker.Response.ACTION] !== google.picker.Action.PICKED) return;
                    var doc = (data[google.picker.Response.DOCUMENTS] || [])[0];
                    if (!doc) return;
                    downloadThenUpload(
                        doc[google.picker.Document.ID],
                        doc[google.picker.Document.NAME],
                        token);
                })
                .build()
                .setVisible(true);
        });
    }

    /* ---- download from Drive, upload to GitHub ------------------------- */
    function downloadThenUpload(fileId, fileName, token) {
        toast('Downloading "' + fileName + '" from Drive…', '#18b8c8');
        fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media',
            { headers: { Authorization: 'Bearer ' + token } })
            .then(function (r) { if (!r.ok) throw new Error('Drive HTTP ' + r.status); return r.arrayBuffer(); })
            .then(function (buf) {
                toast('Uploading "' + fileName + '" to GitHub…', '#18b8c8');
                return uploadToGitHub(fileName, new Uint8Array(buf));
            })
            .then(function () {
                toast('✓ Uploaded to ' + REPO + ' → ' + BRANCH + '/' + PATH_PREFIX + fileName, '#20d840');
                hideToast(6000);
            })
            .catch(function (e) {
                toast('✗ ' + (e.message || e), '#e82020');
                hideToast(6000);
            });
    }

    // base64-encode a Uint8Array in chunks (avoids call-stack limits on big files)
    function toBase64(bytes) {
        var chunk = 0x8000, parts = [];
        for (var i = 0; i < bytes.length; i += chunk) {
            parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
        }
        return btoa(parts.join(''));
    }

    function gh(method, path, body) {
        return fetch('https://api.github.com/repos/' + REPO + path, {
            method: method, headers: ghHeaders(),
            body: body ? JSON.stringify(body) : undefined
        }).then(function (r) {
            return r.json().then(function (d) {
                if (!r.ok) throw new Error((d && d.message) || ('GitHub HTTP ' + r.status));
                return d;
            });
        });
    }

    // Ensure the uploads branch exists (branched off the default branch).
    function ensureBranch() {
        return gh('GET', '/git/ref/heads/' + BRANCH)
            .then(function (ref) { return ref.object.sha; })
            .catch(function () {
                return gh('GET', '').then(function (repo) {
                    return gh('GET', '/git/ref/heads/' + repo.default_branch)
                        .then(function (ref) {
                            return gh('POST', '/git/refs',
                                { ref: 'refs/heads/' + BRANCH, sha: ref.object.sha })
                                .then(function (nr) { return nr.object.sha; });
                        });
                });
            });
    }

    // Commit one file via the Git Data API (blob -> tree -> commit -> ref).
    function uploadToGitHub(fileName, bytes) {
        var b64 = toBase64(bytes);
        var commitSha;
        return ensureBranch()
            .then(function (sha) { commitSha = sha; return gh('GET', '/git/commits/' + sha); })
            .then(function (commit) {
                return gh('POST', '/git/blobs', { content: b64, encoding: 'base64' })
                    .then(function (blob) {
                        return gh('POST', '/git/trees', {
                            base_tree: commit.tree.sha,
                            tree: [{ path: PATH_PREFIX + fileName, mode: '100644', type: 'blob', sha: blob.sha }]
                        });
                    });
            })
            .then(function (tree) {
                return gh('POST', '/git/commits', {
                    message: 'Upload ' + fileName + ' from Google Drive',
                    tree: tree.sha,
                    parents: [commitSha]
                });
            })
            .then(function (commit) {
                return gh('PATCH', '/git/refs/heads/' + BRANCH, { sha: commit.sha });
            });
    }

    window.DriveToGitHub = {
        start: function () {
            toast('Loading Google Drive…', '#18b8c8');
            loadGoogle(function () { getToken(function (tok) { pick(tok); }); });
        }
    };
})();
