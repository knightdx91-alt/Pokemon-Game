// Emulator screenshot — saves to a persistent gist (no SHA conflicts)
(function() {
    var btn = document.getElementById('screenshot-btn-emu');
    if (!btn) return;

    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', function() {
        var canvas = document.querySelector('#game canvas');
        if (!canvas) { alert('Emulator not loaded yet.'); return; }

        var token = localStorage.getItem('gh_debug_token');
        if (!token) {
            token = prompt('Enter your GitHub token (gist + public_repo scope):');
            if (!token) return;
            localStorage.setItem('gh_debug_token', token);
        }

        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        var ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
        var base64 = dataUrl.replace(/^data:image\/(jpeg|png);base64,/, '');
        var ts = new Date().toISOString().replace(/[:.]/g, '-');
        var fname = 'ee-shot-' + ts + '.' + ext;
        var hdrs = { Authorization: 'token ' + token, 'Content-Type': 'application/json' };

        var files = {};
        files[fname] = { content: base64 };
        files['view.html'] = { content: '<!DOCTYPE html><html><body style="margin:0;background:#000"><img src="data:image/' + ext + ';base64,' + base64 + '" style="max-width:100%;image-rendering:pixelated"></body></html>' };

        var gistId = localStorage.getItem('gh_screenshot_gist');

        var req;
        if (gistId) {
            // Update existing gist — no SHA needed
            req = fetch('https://api.github.com/gists/' + gistId, {
                method: 'PATCH',
                headers: hdrs,
                body: JSON.stringify({ files: files })
            });
        } else {
            // Create gist on first use
            req = fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ description: 'Pokemon screenshots', public: false, files: files })
            });
        }

        req.then(function(r) {
            if (!r.ok) return r.text().then(function(t) {
                var m = t; try { m = JSON.parse(t).message || t; } catch(e) {}
                throw new Error(r.status + ': ' + m);
            });
            return r.json();
        })
        .then(function(gist) {
            localStorage.setItem('gh_screenshot_gist', gist.id);
            newBtn.style.color = '#20d840';
            setTimeout(function() { newBtn.style.color = '#18b8c8'; }, 2000);
        })
        .catch(function(e) { alert('Screenshot error:\n' + e.message); });
    });
})();
