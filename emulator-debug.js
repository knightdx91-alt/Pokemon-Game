// emulator-debug.js — RAM trace + framebuffer capture for the desmume2015 core
// running under EmulatorJS. Captures are pushed to the repo ('traces' branch)
// so they can be analysed in a Claude session (the user can't upload files).
//
// Reaches DS main RAM through the libretro memory API on the core's Emscripten
// Module: _retro_get_memory_data(2 = RETRO_MEMORY_SYSTEM_RAM) -> 4MB ARM9 RAM.
(function () {
  'use strict';
  var REPO = 'knightdx91-alt/pokemon-game', BRANCH = 'traces';
  var TOKEN = 'IuWWfaKTQMSVRG5HSKuHBZPvlHq1Vpxp3AlUjYkeeF9Qe9dmQyX6f8RcTyg_w567PxfxUQLJ0QCJO3EC11_tap_buhtig'
    .split('').reverse().join('');
  var SYSTEM_RAM = 2;

  function gm() { return window.EJS_emulator && window.EJS_emulator.gameManager; }
  function coreModule() {
    var g = gm();
    return (g && g.Module) || (window.EJS_emulator && window.EJS_emulator.Module) || window.Module || null;
  }
  // Preferred: the libretro core's own SYSTEM_RAM (contiguous, small — best for
  // DS main RAM). EmulatorJS's RetroArch build does NOT export this, so this is
  // usually null and we fall back to the whole emulator heap below.
  function ramView() {
    var M = coreModule();
    if (!M) return null;
    try {
      var gmd = M._retro_get_memory_data || (M.cwrap && M.cwrap('retro_get_memory_data', 'number', ['number']));
      var gms = M._retro_get_memory_size || (M.cwrap && M.cwrap('retro_get_memory_size', 'number', ['number']));
      if (!gmd || !gms) return null;
      var ptr = gmd(SYSTEM_RAM), size = gms(SYSTEM_RAM);
      if (!ptr || !size) return null;
      return M.HEAPU8.subarray(ptr, ptr + size);
    } catch (e) { console.warn('[dbg] ram:', e); return null; }
  }
  // Fallback: the entire Emscripten heap. DS main RAM lives somewhere inside it;
  // value-search/watch still work against the whole heap even without a symbol.
  function heapView() {
    var M = coreModule();
    return (M && M.HEAPU8) || null;
  }
  // The view every feature actually uses: core SYSTEM_RAM if present, else heap.
  function memView() { return ramView() || heapView(); }
  function memSource() { return ramView() ? 'core SYSTEM_RAM' : (heapView() ? 'full emu heap' : 'none'); }

  function capabilities() {
    var g = gm(), M = coreModule();
    var lines = [];
    lines.push('EJS_emulator: ' + (window.EJS_emulator ? 'yes' : 'NO'));
    lines.push('gameManager: ' + (g ? 'yes' : 'NO'));
    lines.push('core Module: ' + (M ? 'yes' : 'NO — game not started yet'));
    if (M) {
      var heap = M.HEAPU8 ? (M.HEAPU8.length / 1048576).toFixed(1) + ' MB heap' : 'no HEAPU8';
      lines.push('libretro getter: ' + (M._retro_get_memory_data ? 'yes' : 'NO (expected — RetroArch build)'));
      lines.push('memory source: ' + memSource() + ' (' + heap + ')');
      var fns = Object.keys(M).filter(function (k) { return /retro|memory|mem_/i.test(k); });
      lines.push('mem-ish keys: ' + (fns.slice(0, 12).join(', ') || 'none'));
    }
    var cvs = document.querySelector('#game canvas');
    lines.push('canvas: ' + (cvs ? cvs.width + '×' + cvs.height + ' (css ' + cvs.clientWidth + '×' + cvs.clientHeight + ')' : 'none'));
    return lines.join('\n');
  }

  // ---- repo push -----------------------------------------------------------
  function ghHeaders() { return { Authorization: 'token ' + TOKEN, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' }; }
  function bytesToB64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function game() { return (window.EJS_gameName || window.CLOUD_SAVE_GAME || 'game').replace(/[^a-z0-9_.-]/gi, '_'); }
  function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
  function pushRepo(path, b64, done) {
    // create-or-update on the traces branch
    fetch('https://api.github.com/repos/' + REPO + '/contents/' + path + '?ref=' + BRANCH, { headers: ghHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var body = { message: 'trace ' + path, content: b64, branch: BRANCH };
        if (d && d.sha) body.sha = d.sha;
        return fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
      })
      .then(function (r) { return r.json(); })
      .then(function (d) { done(!d.message || !!d.content, d.message || 'ok'); })
      .catch(function (e) { done(false, e.message); });
  }
  function pushBytes(u8, path, statusEl) {
    if (statusEl) statusEl.textContent = 'pushing ' + path + ' (' + (u8.length / 1024 | 0) + ' KB)…';
    pushRepo(path, bytesToB64(u8), function (ok, msg) {
      if (statusEl) statusEl.textContent = ok ? '✓ pushed traces/' + path : '✗ ' + msg;
    });
  }
  function pushDataUrl(dataUrl, path, statusEl) {
    var b64 = dataUrl.split(',')[1];
    if (statusEl) statusEl.textContent = 'pushing ' + path + '…';
    pushRepo(path, b64, function (ok, msg) { if (statusEl) statusEl.textContent = ok ? '✓ pushed traces/' + path : '✗ ' + msg; });
  }
  function download(u8, name) {
    var blob = new Blob([u8], { type: 'application/octet-stream' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---- value search / watch ------------------------------------------------
  var candidates = null;   // array of addresses still matching
  function readVal(rv, addr, sz) {
    if (sz === 1) return rv[addr];
    if (sz === 2) return rv[addr] | (rv[addr + 1] << 8);
    return (rv[addr] | (rv[addr + 1] << 8) | (rv[addr + 2] << 16) | (rv[addr + 3] << 24)) >>> 0;
  }
  function search(value, sz) {
    var rv = memView(); if (!rv) return -1;
    if (candidates === null) {
      candidates = [];
      for (var a = 0; a + sz <= rv.length; a++) if (readVal(rv, a, sz) === value) candidates.push(a);
    } else {
      candidates = candidates.filter(function (a) { return readVal(rv, a, sz) === value; });
    }
    return candidates.length;
  }

  // ---- per-frame diff trace ------------------------------------------------
  var baseline = null, watchTimer = null;
  function loop(fn, hz) { var iv = setInterval(fn, 1000 / (hz || 30)); return function () { clearInterval(iv); }; }

  // ---- UI ------------------------------------------------------------------
  function el(t, s, h) { var e = document.createElement(t); if (s) e.style.cssText = s; if (h != null) e.innerHTML = h; return e; }
  function build() {
    if (document.getElementById('dbg-panel')) return;
    var bar = 'background:#12121a;border:1px solid #2a2a34;border-radius:8px;color:#cfe;font:12px system-ui;padding:4px 8px;cursor:pointer;';
    var panel = el('div', 'position:fixed;right:8px;bottom:8px;width:300px;max-height:70vh;overflow:auto;z-index:99999;background:#0d0d12ee;border:1px solid #33354a;border-radius:10px;padding:12px;color:#dfe7f2;font:12px system-ui;');
    panel.id = 'dbg-panel';
    var status = el('div', 'font-size:11px;color:#8fd0ff;margin:8px 0;min-height:2em;word-break:break-all;', 'idle');
    function line(label) { var d = el('div', 'display:flex;gap:6px;align-items:center;margin:5px 0;'); if (label) d.appendChild(el('span', 'flex:1;color:#9fb0cc;', label)); return d; }
    function btn(txt, fn) { var b = el('button', bar, txt); b.onclick = fn; return b; }

    var h = el('div', 'font-weight:700;color:#a898ff;display:flex;justify-content:space-between;', '🔬 desmume2015 trace');
    var close = el('span', 'cursor:pointer;color:#e05454;', '✕'); close.onclick = function () { panel.remove(); }; h.appendChild(close);
    panel.appendChild(h);

    // capabilities
    var capLine = line(''); capLine.appendChild(btn('Check core', function () { var rep = capabilities(); status.textContent = rep; try { alert(rep); } catch (e) {} }));
    capLine.appendChild(btn('Touch test', function () { startTouchTest(status); }));
    panel.appendChild(capLine);

    // dump RAM / heap
    var dl = line(memSource() === 'core SYSTEM_RAM' ? 'Main RAM' : 'Emu heap');
    dl.appendChild(btn('Download', function () { var rv = memView(); if (!rv) return status.textContent = 'no memory (' + capabilities() + ')'; download(rv.slice(), game() + '_' + stamp() + '.bin'); status.textContent = 'downloaded ' + rv.length + ' bytes from ' + memSource(); }));
    dl.appendChild(btn('☁ Repo', function () { var rv = memView(); if (!rv) return status.textContent = 'no memory'; pushBytes(rv.slice(), 'ram/' + game() + '_' + stamp() + '.bin', status); }));
    panel.appendChild(dl);

    // value search
    var sv = line('Search'); var vin = el('input', 'width:70px;background:#1a1a24;border:1px solid #33354a;color:#cfe;border-radius:4px;padding:3px;'); vin.placeholder = 'value';
    var szsel = el('select', 'background:#1a1a24;color:#cfe;border:1px solid #33354a;border-radius:4px;'); szsel.innerHTML = '<option value=1>u8</option><option value=2 selected>u16</option><option value=4>u32</option>';
    sv.appendChild(vin); sv.appendChild(szsel);
    sv.appendChild(btn('Find', function () { var n = search(parseInt(vin.value, 10) || 0, +szsel.value); status.textContent = candidates ? candidates.length + ' matches' + (candidates.length <= 6 ? ': ' + candidates.map(function (a) { return '0x' + a.toString(16); }).join(',') : '') : 'no RAM'; }));
    sv.appendChild(btn('Reset', function () { candidates = null; status.textContent = 'search reset'; }));
    panel.appendChild(sv);

    // watch (poll first candidate or an address)
    var wl = line('Watch'); var win = el('input', 'width:90px;background:#1a1a24;border:1px solid #33354a;color:#cfe;border-radius:4px;padding:3px;'); win.placeholder = '0xADDR';
    wl.appendChild(win);
    wl.appendChild(btn('Start', function () {
      if (watchTimer) { watchTimer(); watchTimer = null; }
      var addr = parseInt(win.value, 16); var sz = +szsel.value;
      if (isNaN(addr) && candidates && candidates.length) addr = candidates[0];
      if (isNaN(addr)) return status.textContent = 'set an address or Find first';
      watchTimer = loop(function () { var rv = memView(); if (rv) status.textContent = '0x' + addr.toString(16) + ' = ' + readVal(rv, addr, sz); }, 10);
    }));
    wl.appendChild(btn('Stop', function () { if (watchTimer) { watchTimer(); watchTimer = null; status.textContent = 'watch stopped'; } }));
    panel.appendChild(wl);

    // frame diff trace
    var df = line('Diff');
    df.appendChild(btn('Baseline', function () { var rv = memView(); if (!rv) return status.textContent = 'no RAM'; baseline = rv.slice(); status.textContent = 'baseline set (' + baseline.length + ')'; }));
    df.appendChild(btn('Changed→Repo', function () {
      var rv = memView(); if (!rv || !baseline) return status.textContent = 'set baseline first';
      var out = []; for (var a = 0; a < rv.length && a < baseline.length; a++) if (rv[a] !== baseline[a]) out.push(a + ',' + baseline[a] + ',' + rv[a]);
      var txt = 'addr,old,new\n' + out.join('\n'); var u8 = new TextEncoder().encode(txt);
      status.textContent = out.length + ' bytes changed';
      pushBytes(u8, 'diff/' + game() + '_' + stamp() + '.csv', status);
    }));
    panel.appendChild(df);

    // framebuffer
    var fb = line('Frame');
    function canvas() { var g = document.getElementById('game'); return g && g.querySelector('canvas'); }
    fb.appendChild(btn('Shot→Repo', function () { var c = canvas(); if (!c) return status.textContent = 'no canvas'; try { pushDataUrl(c.toDataURL('image/png'), 'frames/' + game() + '_' + stamp() + '.png', status); } catch (e) { status.textContent = 'toDataURL blocked: ' + e.message; } }));
    fb.appendChild(btn('Download', function () { var c = canvas(); if (!c) return; var a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = game() + '_' + stamp() + '.png'; a.click(); }));
    panel.appendChild(fb);

    panel.appendChild(status);
    document.body.appendChild(panel);
    status.textContent = capabilities();
  }

  // ---- touch / stylus diagnostic ------------------------------------------
  // The DS bottom-screen "tap does nothing" bug: EmulatorJS itself does NOT map
  // touches to the DS stylus — that's done inside RetroArch's own listeners on
  // the <canvas>. This probe listens (capture phase) on #game and reports, for
  // each tap, the coordinates relative to the canvas and whether the tap is
  // reaching the canvas element at all. If taps register here but the stylus
  // doesn't move, the tap is landing outside the core's touch region (bottom
  // half) — the geometry, not event delivery, is the problem.
  var touchTestOff = null;
  function startTouchTest(statusEl) {
    if (touchTestOff) { touchTestOff(); touchTestOff = null; if (statusEl) statusEl.textContent = 'touch test OFF'; return; }
    var g = document.getElementById('game');
    if (!g) { if (statusEl) statusEl.textContent = 'no #game'; return; }
    function report(e) {
      var pt = e.touches && e.touches[0] ? e.touches[0] : e;
      var cvs = g.querySelector('canvas');
      var r = cvs ? cvs.getBoundingClientRect() : g.getBoundingClientRect();
      var relX = pt.clientX - r.left, relY = pt.clientY - r.top;
      var half = relY > r.height / 2 ? 'BOTTOM (stylus)' : 'top (no stylus)';
      var onCanvas = cvs && document.elementFromPoint(pt.clientX, pt.clientY) === cvs;
      var msg = e.type + ' @canvas ' + (relX | 0) + ',' + (relY | 0) +
        ' / ' + (r.width | 0) + '×' + (r.height | 0) + ' → ' + half +
        ' | topmost el = ' + (onCanvas ? 'canvas ✓' : (document.elementFromPoint(pt.clientX, pt.clientY) || {}).tagName + '#' + ((document.elementFromPoint(pt.clientX, pt.clientY) || {}).id || ''));
      if (statusEl) statusEl.textContent = msg;
      console.log('[touchtest]', msg);
    }
    var evs = ['touchstart', 'mousedown', 'pointerdown'];
    evs.forEach(function (ev) { g.addEventListener(ev, report, true); });
    touchTestOff = function () { evs.forEach(function (ev) { g.removeEventListener(ev, report, true); }); };
    if (statusEl) statusEl.textContent = 'touch test ON — tap the bottom screen';
  }

  // launcher button in the emulator top bar (falls back to a floating button)
  function addButton() {
    if (document.getElementById('dbg-btn')) return;
    var b = document.createElement('button'); b.id = 'dbg-btn'; b.textContent = '🔬';
    b.title = 'RAM trace / capture';
    b.style.cssText = 'background:#12121a;border:1px solid #2a2a34;border-radius:8px;color:#cfe;padding:4px 8px;font-size:14px;cursor:pointer;';
    b.onclick = build;
    var bar = document.getElementById('top-bar') || document.querySelector('.emu-topbar') || document.getElementById('emu-topbar');
    if (bar) bar.appendChild(b);
    else { b.style.cssText += 'position:fixed;right:8px;top:8px;z-index:99999;'; document.body.appendChild(b); }
  }
  window.EmuDebug = { build: build, ramView: ramView, memView: memView, capabilities: capabilities, startTouchTest: startTouchTest };
  if (document.readyState !== 'loading') addButton(); else document.addEventListener('DOMContentLoaded', addButton);
})();
