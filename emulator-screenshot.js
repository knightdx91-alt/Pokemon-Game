// Emulator screenshot — creates a new gist and shows share link
(function() {
    var btn = document.getElementById('screenshot-btn-emu');
    if (!btn || btn.dataset.ssInit) return;
    var newBtn = btn.cloneNode(true);
    newBtn.dataset.ssInit = '1';
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', function() {
        var canvas = document.querySelector('#game canvas');
        if (!canvas) { alert('Emulator not loaded yet.'); return; }

        var token = localStorage.getItem('gh_debug_token');
        if (!token) {
            token = prompt('Enter your GitHub token (gist scope):');
            if (!token) return;
            localStorage.setItem('gh_debug_token', token);
        }

        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        var ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
        var base64 = dataUrl.replace(/^data:image\/(jpeg|png);base64,/, '');
        var ts = new Date().toISOString().replace(/[:.]/g, '-');
        var fname = 'ee-shot-' + ts + '.' + ext;
        var files = {};
        files[fname] = { content: base64 };
        files['view.html'] = { content: '<!DOCTYPE html><html><body style="margin:0;background:#000"><img src="data:image/' + ext + ';base64,' + base64 + '" style="max-width:100%;image-rendering:pixelated"></body></html>' };

        fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'EE screenshot ' + ts, public: false, files: files })
        })
        .then(function(r) {
            if (!r.ok) return r.text().then(function(t) {
                var m = t; try { m = JSON.parse(t).message || t; } catch(e) {}
                throw new Error(r.status + ': ' + m);
            });
            return r.json();
        })
        .then(function(gist) { _showSsUrl(gist.html_url); })
        .catch(function(e) { alert('Screenshot error:\n' + e.message); });
    });

    function _showSsUrl(url) {
        var existing = document.getElementById('ss-overlay');
        if (existing) existing.remove();
        var ov = document.createElement('div');
        ov.id = 'ss-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#0a1830;border:2px solid #18b8c8;border-radius:6px;padding:16px;width:88vw;max-width:360px;font-family:monospace;color:#c8d8e8;';
        var title = document.createElement('div');
        title.textContent = 'Screenshot saved!';
        title.style.cssText = 'font-size:14px;font-weight:bold;color:#20d840;margin-bottom:10px;';
        var inp = document.createElement('input');
        inp.type = 'text'; inp.value = url; inp.readOnly = true;
        inp.style.cssText = 'width:100%;box-sizing:border-box;background:#060610;color:#c8d8e8;border:1px solid #18b8c8;border-radius:3px;padding:6px;font-size:11px;margin-bottom:10px;';
        var copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy Link';
        copyBtn.style.cssText = 'background:#0a1830;color:#18b8c8;border:1px solid #18b8c8;border-radius:3px;padding:6px 14px;font-size:13px;cursor:pointer;margin-right:8px;touch-action:manipulation;';
        copyBtn.onclick = function() {
            inp.select();
            navigator.clipboard.writeText(url).catch(function() { document.execCommand('copy'); });
            copyBtn.textContent = '✓ Copied!';
            setTimeout(function() { copyBtn.textContent = 'Copy Link'; }, 2000);
        };
        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'background:#0a1830;color:#c8d8e8;border:1px solid #446;border-radius:3px;padding:6px 14px;font-size:13px;cursor:pointer;touch-action:manipulation;';
        closeBtn.onclick = function() { ov.remove(); };
        box.appendChild(title); box.appendChild(inp); box.appendChild(copyBtn); box.appendChild(closeBtn);
        ov.appendChild(box); document.body.appendChild(ov);
        setTimeout(function() { inp.select(); }, 100);
    }
})();
