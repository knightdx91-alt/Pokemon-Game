// Emulator screenshot — commits directly to screenshots branch
(function() {
    var btn = document.getElementById('screenshot-btn-emu');
    if (!btn) return;

    // Remove any old listener by replacing the button
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', function() {
        var canvas = document.querySelector('#game canvas');
        if (!canvas) { alert('Emulator not loaded yet.'); return; }

        var token = localStorage.getItem('gh_debug_token');
        if (!token) {
            token = prompt('Enter your GitHub token (public_repo scope):');
            if (!token) return;
            localStorage.setItem('gh_debug_token', token);
        }

        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        var ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
        var base64 = dataUrl.replace(/^data:image\/(jpeg|png);base64,/, '');
        var ts = new Date().toISOString().replace(/[:.]/g, '-');
        var path = 'screenshots/ee-shot-' + ts + '.' + ext;

        fetch('https://api.github.com/repos/knightdx91-alt/pokemon-game/contents/' + path, {
            method: 'PUT',
            headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'ee screenshot ' + ts, content: base64, branch: 'main' })
        })
        .then(function(r) {
            if (!r.ok) return r.text().then(function(t) {
                var m = t; try { m = JSON.parse(t).message || t; } catch(e) {}
                throw new Error(r.status + ': ' + m);
            });
            newBtn.style.color = '#20d840';
            setTimeout(function() { newBtn.style.color = '#18b8c8'; }, 2000);
        })
        .catch(function(e) { alert('Screenshot error:\n' + e.message); });
    });
})();
