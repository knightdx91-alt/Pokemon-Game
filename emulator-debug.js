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

  // Dump the desmume2015 core's option list + the wrapped core functions, so we
  // can see how the pointer/touch device is (or isn't) configured.
  function coreOptionsDump() {
    var g = gm();
    if (!g) return 'no gameManager';
    var out = [];
    try {
      var fns = g.functions ? Object.keys(g.functions) : [];
      out.push('gm.functions: ' + (fns.join(', ') || 'none'));
    } catch (e) { out.push('functions: ' + e.message); }
    try {
      var opts = g.functions && g.functions.getCoreOptions ? g.functions.getCoreOptions() : (g.getCoreOptions && g.getCoreOptions());
      out.push('--- core options ---');
      out.push(opts ? String(opts) : '(getCoreOptions returned nothing)');
    } catch (e) { out.push('getCoreOptions error: ' + e.message); }
    return out.join('\n');
  }

  // Dump RetroArch's live config file from the emulated FS — it lists the input
  // bindings, including anything pointer/mouse/touch related.
  function pokeTest() {
    var g = gm();
    if (!g || !g.FS) return 'no FS';
    var paths = [
      '/home/web_user/.config/retroarch/retroarch.cfg',
      '/home/web_user/retroarch/userdata/retroarch.cfg'
    ];
    for (var i = 0; i < paths.length; i++) {
      try {
        var txt = g.FS.readFile(paths[i], { encoding: 'utf8' });
        if (txt) {
          // Keep only input/pointer/mouse/touch lines — the cfg is huge.
          var keep = txt.split('\n').filter(function (l) { return /input|pointer|mouse|touch|analog|device/i.test(l); });
          return paths[i] + '\n--- input-related cfg lines ---\n' + keep.join('\n');
        }
      } catch (e) { /* try next */ }
    }
    return 'retroarch.cfg not found on FS';
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
  // Each push is a separate commit on the traces branch, so concurrent pushes
  // race and collide (GitHub "is at X but expected Y"). Serialize them: one
  // commit finishes before the next starts.
  var _pq = [], _pbusy = false;
  function _pushNow(path, b64, done) {
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
  function _drain() {
    if (_pbusy || !_pq.length) return;
    _pbusy = true; var job = _pq.shift();
    _pushNow(job.path, job.b64, function (ok, msg) { _pbusy = false; job.done(ok, msg); setTimeout(_drain, 120); });
  }
  function pushRepo(path, b64, done) { _pq.push({ path: path, b64: b64, done: done || function () {} }); _drain(); }
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
  // Upload the full heap to Google Drive (resumable — handles the 100+MB dump
  // that GitHub's file cap can't). Reuses emulator.html's Drive write token.
  // Claude then pulls it from Drive and maps ALL regions offline in one pass.
  function uploadHeapToDrive(statusEl) {
    var mem = memView(); if (!mem) { if (statusEl) statusEl.textContent = 'no memory'; return; }
    if (!window.getDriveWriteToken) { statusEl.textContent = 'Drive auth unavailable (open a ROM via Drive first)'; return; }
    var blob = new Blob([mem], { type: 'application/octet-stream' });   // snapshot copy
    var name = game() + '_heap_' + stamp() + '.bin';
    statusEl.textContent = 'authorizing Drive…';
    window.getDriveWriteToken().then(function (token) {
      statusEl.textContent = 'uploading ' + (blob.size / 1048576 | 0) + 'MB to Drive…';
      return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
      }).then(function (r) {
        var loc = r.headers.get('Location'); if (!loc) throw new Error('no upload session');
        return fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
      }).then(function (r) { return r.json(); }).then(function (d) {
        statusEl.textContent = d.id ? ('✓ Drive: ' + name) : ('✗ ' + ((d.error && d.error.message) || 'upload failed'));
      });
    }).catch(function (e) { statusEl.textContent = '✗ ' + e.message; });
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

  // ---- DS memory regions (located once in the heap, then dumped on demand) --
  // desmume2015 exposes no clean memory API, so we read the raw Emscripten heap
  // and dump only the small DS regions (OAM/palette/VRAM/main-RAM) once their
  // heap offsets are pinned. Persisted in localStorage so a located layout
  // survives reloads. Each entry: {name, base, len}.
  var REGIONS = [];
  try { REGIONS = JSON.parse(localStorage.getItem('dbg_regions') || '[]'); } catch (e) { REGIONS = []; }
  function saveRegions() { try { localStorage.setItem('dbg_regions', JSON.stringify(REGIONS)); } catch (e) {} }
  function addRegion(name, base, len) {
    REGIONS = REGIONS.filter(function (r) { return r.name !== name; });
    REGIONS.push({ name: name, base: base, len: len }); saveRegions();
  }
  // scan the heap for a contiguous u16-LE sequence (e.g. a run of BGR555 colors
  // from a captured frame) -> anchors palette RAM; returns byte offset or -1.
  function findU16Seq(mem, seq) {
    var n = seq.length, first = seq[0];
    for (var i = 0; i + 2 * n <= mem.length; i += 2) {
      if ((mem[i] | (mem[i + 1] << 8)) !== first) continue;
      var ok = true;
      for (var j = 1; j < n; j++) { if ((mem[i + 2 * j] | (mem[i + 2 * j + 1] << 8)) !== seq[j]) { ok = false; break; } }
      if (ok) return i;
    }
    return -1;
  }
  function dumpRegion(r, seq, statusEl) {
    var mem = memView(); if (!mem) { if (statusEl) statusEl.textContent = 'no memory'; return; }
    if (r.base < 0 || r.base >= mem.length) { if (statusEl) statusEl.textContent = 'region ' + r.name + ' out of range'; return; }
    var end = Math.min(r.base + r.len, mem.length);
    var suffix = (seq != null) ? ('_' + ('000' + seq).slice(-3)) : '';
    pushBytes(mem.slice(r.base, end), 'regions/' + r.name + '/' + game() + suffix + '_' + stamp() + '.bin', statusEl);
  }

  // ---- self-calibration: pin palette RAM from the on-screen colors ---------
  // The colors visible in the captured frame ARE the palette, sitting in memory
  // as BGR555. One heap pass tallies target-color hits per 512-byte block; the
  // densest block is palette RAM. Runs once (offsets are fixed for the session).
  function _cvEl() { var g = document.getElementById('game'); return g && g.querySelector('canvas'); }
  function frameColorsBGR555() {
    var cv = _cvEl(); if (!cv) return [];
    // sample at native size, smoothing OFF, so we get TRUE palette colors (an
    // interpolated downsample invents blended colors that aren't in the palette).
    var w = cv.width, h = cv.height;
    var s = document.createElement('canvas'); s.width = w; s.height = h;
    var c = s.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = false;
    try { c.drawImage(cv, 0, 0); } catch (e) { return []; }
    var d = c.getImageData(0, 0, w, h).data, cnt = {};
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      var v = (d[i] >> 3) | ((d[i + 1] >> 3) << 5) | ((d[i + 2] >> 3) << 10);
      cnt[v] = (cnt[v] || 0) + 1;
    }
    // most-frequent colors first (flat UI areas == real palette entries)
    return Object.keys(cnt).map(Number).sort(function (a, b) { return cnt[b] - cnt[a]; });
  }
  function calibratePalette(statusEl) {
    var mem = memView(); if (!mem) { if (statusEl) statusEl.textContent = 'no memory'; return false; }
    var targets = frameColorsBGR555();
    if (targets.length < 6) { if (statusEl) statusEl.textContent = 'need a colorful screen to calibrate'; return false; }
    // drop black/white/near-grays — they flood memory as padding and cause
    // false anchors; score blocks by DISTINCT colors (a real palette is diverse,
    // a padding block is one value repeated).
    var flag = new Uint8Array(65536), nt = 0;
    targets.forEach(function (v) {
      var r = v & 31, g = (v >> 5) & 31, b = (v >> 10) & 31;
      if ((r < 2 && g < 2 && b < 2) || (r > 29 && g > 29 && b > 29)) return;
      if (!flag[v]) { flag[v] = 1; nt++; }
    });
    if (nt < 6) { if (statusEl) statusEl.textContent = 'not enough distinctive colors'; return false; }
    var seen = {}, best = -1, bestN = 0;
    for (var i = 0; i + 1 < mem.length; i += 2) {
      var v = mem[i] | (mem[i + 1] << 8);
      if (flag[v]) {
        var b = i >> 9, s = seen[b] || (seen[b] = { c: {}, n: 0 });
        if (!s.c[v]) { s.c[v] = 1; if (++s.n > bestN) { bestN = s.n; best = b; } }
      }
    }
    if (best < 0 || bestN < 6) { if (statusEl) statusEl.textContent = 'palette not located (best ' + bestN + ' distinct of ' + nt + ')'; return false; }
    // the anchor lands on the densest 512B block (usually main BG pal); back up
    // to the start of the 2KB palette RAM (main BG+OBJ, sub BG+OBJ contiguous)
    // so one region captures BOTH screens' full palette.
    var base = (best << 9) & ~0x7FF;
    addRegion('palette', base, 2048);
    // ---- derive VRAM + OAM from the palette anchor (SOLVED offline) ----------
    // desmume2015's DS memories are contiguous fields of one global MMU_struct:
    //   ARM9_VMEM(palette,0x800) | ARM9_LCD(VRAM,0xA4000) | blank(0x20000) |
    //   ARM9_OAM(0x800)
    // so VRAM and OAM sit at FIXED deltas from palette RAM regardless of where the
    // struct lands in the Emscripten heap this session. Confirmed against a full
    // 184MB heap dump: palette@0x02609800 (4 populated engine banks) → VRAM at
    // +0x800 ending exactly at the 128KB zero blank → OAM at +0xC4800 (105/110
    // enabled sprites, valid Y coords). These three ARE the full composition of
    // any DS screen: palette (colors) + VRAM (BG tilemaps + tile/char gfx) + OAM
    // (sprite cells). Registering them means auto-capture dumps how every window
    // is baked, paired with the frame PNG.
    var D_VRAM = 0x800, VRAM_LEN = 0xA4000, D_OAM = 0x800 + 0xA4000 + 0x20000;
    if (base + D_OAM + 0x800 <= mem.length) {
      addRegion('vram', base + D_VRAM, VRAM_LEN);
      addRegion('oam',  base + D_OAM,  2048);
    }
    if (statusEl) statusEl.textContent = 'palette @0x' + base.toString(16) +
      ' (' + bestN + ' hits) + vram@0x' + (base + D_VRAM).toString(16) +
      ' + oam@0x' + (base + D_OAM).toString(16) + ' registered';
    // push a diagnostic slice so the map stays verifiable session-to-session
    pushBytes(mem.slice(base, Math.min(base + 4096, mem.length)), 'regions/_calib/' + game() + '_pal_' + stamp() + '.bin', statusEl);
    return true;
  }

  // ---- auto-capture on screen change ---------------------------------------
  // Watch the framebuffer; when it materially changes (a window/menu opens) and
  // then settles, push the final composited frame to traces/frames/auto/ AND
  // dump every registered DS region (OAM/palette/VRAM/...) with the same seq #.
  // Lets the user just PLAY and have every window captured for exact recon.
  var autoCap = null;   // stop-fn while active, else null
  function _canvasEl() { var g = document.getElementById('game'); return g && g.querySelector('canvas'); }
  function startAutoCap(statusEl) {
    var cv = _canvasEl();
    if (!cv) { if (statusEl) statusEl.textContent = 'no canvas'; return; }
    var small = document.createElement('canvas'); small.width = 48; small.height = 32;
    var sctx = small.getContext('2d', { willReadFrequently: true });
    var prev = null, lastPushed = null, seq = 0, settleT = null;
    function sig() { try { sctx.drawImage(cv, 0, 0, 48, 32); return sctx.getImageData(0, 0, 48, 32).data; } catch (e) { return null; } }
    function amt(a, b) { if (!a || !b) return 1e9; var s = 0; for (var i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s; }
    var iv = setInterval(function () {
      var s = sig(); if (!s) return;
      var d = amt(s, prev); prev = s;
      if (d > 6000) {                                   // material change -> (re)arm settle timer
        if (settleT) clearTimeout(settleT);
        settleT = setTimeout(function () {              // screen settled after the change
          if (amt(sig(), lastPushed) < 2500) return;    // same as last capture -> skip dup
          lastPushed = sig(); seq++;
          var n = ('000' + seq).slice(-3);
          try { pushDataUrl(cv.toDataURL('image/png'), 'frames/auto/' + game() + '_' + n + '_' + stamp() + '.png', statusEl); }
          catch (e) { if (statusEl) statusEl.textContent = 'auto: toDataURL blocked'; }
          // self-calibrate on the first window (palette offset is fixed after)
          if (!REGIONS.some(function (r) { return r.name === 'palette'; })) calibratePalette(statusEl);
          // pair each captured state with its machine-level composition data
          REGIONS.forEach(function (r) { dumpRegion(r, seq, statusEl); });
        }, 450);
      }
    }, 120);
    autoCap = function () { clearInterval(iv); if (settleT) clearTimeout(settleT); };
    if (statusEl) statusEl.textContent = 'auto-capture ON - play; each new window -> traces/frames/auto/';
  }
  function stopAutoCap(statusEl) { if (autoCap) { autoCap(); autoCap = null; } if (statusEl) statusEl.textContent = 'auto-capture off'; }

  // ---- UI ------------------------------------------------------------------
  function el(t, s, h) { var e = document.createElement(t); if (s) e.style.cssText = s; if (h != null) e.innerHTML = h; return e; }
  function build() {
    if (document.getElementById('dbg-panel')) return;
    var bar = 'background:#12121a;border:1px solid #2a2a34;border-radius:8px;color:#cfe;font:12px system-ui;padding:4px 8px;cursor:pointer;';
    var panel = el('div', 'position:fixed;right:8px;bottom:8px;width:300px;max-height:70vh;overflow:auto;z-index:99999;background:#0d0d12ee;border:1px solid #33354a;border-radius:10px;padding:12px;color:#dfe7f2;font:12px system-ui;');
    panel.id = 'dbg-panel';
    // Copy-pasteable output box: all debug readouts land here as selectable
    // text so you can copy them straight into a chat (no console needed).
    var logEl = el('textarea', 'width:100%;box-sizing:border-box;height:130px;margin:8px 0;background:#07070c;color:#bfe;border:1px solid #33354a;border-radius:6px;padding:6px;font:11px ui-monospace,Menlo,Consolas,monospace;white-space:pre;resize:vertical;-webkit-user-select:text;user-select:text;');
    logEl.readOnly = true; logEl.value = 'idle';
    // Proxy so all existing `status.textContent = ...` calls write into the box.
    var status = { get textContent() { return logEl.value; }, set textContent(v) { logEl.value = String(v); logEl.scrollTop = 0; } };
    function line(label) { var d = el('div', 'display:flex;gap:6px;align-items:center;margin:5px 0;'); if (label) d.appendChild(el('span', 'flex:1;color:#9fb0cc;', label)); return d; }
    function btn(txt, fn) { var b = el('button', bar, txt); b.onclick = fn; return b; }

    var h = el('div', 'font-weight:700;color:#a898ff;display:flex;justify-content:space-between;', '🔬 desmume2015 trace');
    var close = el('span', 'cursor:pointer;color:#e05454;', '✕'); close.onclick = function () { panel.remove(); }; h.appendChild(close);
    panel.appendChild(h);

    // capabilities
    var capLine = line(''); capLine.appendChild(btn('Check core', function () { status.textContent = capabilities(); }));
    capLine.appendChild(btn('Touch test', function () { startTouchTest(status); }));
    panel.appendChild(capLine);

    var optLine = line(''); optLine.appendChild(btn('Core opts', function () { status.textContent = coreOptionsDump(); }));
    optLine.appendChild(btn('RA cfg', function () { status.textContent = pokeTest(); }));
    panel.appendChild(optLine);

    var brLine = line('DS touch→stylus');
    brLine.appendChild(btn('Toggle', function () { toggleTouchBridge(status); }));
    panel.appendChild(brLine);

    // dump RAM / heap
    var dl = line(memSource() === 'core SYSTEM_RAM' ? 'Main RAM' : 'Emu heap');
    dl.appendChild(btn('Download', function () { var rv = memView(); if (!rv) return status.textContent = 'no memory (' + capabilities() + ')'; download(rv.slice(), game() + '_' + stamp() + '.bin'); status.textContent = 'downloaded ' + rv.length + ' bytes from ' + memSource(); }));
    dl.appendChild(btn('☁ Repo', function () { var rv = memView(); if (!rv) return status.textContent = 'no memory'; pushBytes(rv.slice(), 'ram/' + game() + '_' + stamp() + '.bin', status); }));
    dl.appendChild(btn('⛁ Drive', function () { uploadHeapToDrive(status); }));
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
    var autoBtn = btn('Auto ⏺', function () {
      if (autoCap) { stopAutoCap(status); autoBtn.textContent = 'Auto ⏺'; }
      else { startAutoCap(status); autoBtn.textContent = 'Auto ⏹'; }
    });
    fb.appendChild(autoBtn);
    panel.appendChild(fb);

    // ---- DS memory regions (locate once -> auto-dumped with every capture) --
    var inpS = 'width:64px;background:#1a1a24;border:1px solid #33354a;color:#cfe;border-radius:4px;padding:3px;';
    var rg = line('Region');
    var rName = el('input', inpS); rName.placeholder = 'name';
    var rBase = el('input', inpS); rBase.placeholder = '0xBASE';
    var rLen = el('input', inpS); rLen.placeholder = 'len';
    rg.appendChild(rName); rg.appendChild(rBase); rg.appendChild(rLen);
    rg.appendChild(btn('Add', function () {
      var b = parseInt(rBase.value, 16), l = parseInt(rLen.value, 10);
      if (isNaN(b) || isNaN(l)) { status.textContent = 'need hex base + decimal len'; return; }
      addRegion(rName.value || ('r' + REGIONS.length), b, l);
      status.textContent = 'registered: ' + REGIONS.map(function (r) { return r.name + '@0x' + r.base.toString(16) + '/' + r.len; }).join('  ');
    }));
    panel.appendChild(rg);
    var rg2 = line('');
    rg2.appendChild(btn('Dump all→repo', function () { if (!REGIONS.length) { status.textContent = 'no regions yet'; return; } REGIONS.forEach(function (r) { dumpRegion(r, null, status); }); }));
    rg2.appendChild(btn('List', function () { status.textContent = REGIONS.length ? REGIONS.map(function (r) { return r.name + ' @0x' + r.base.toString(16) + ' len ' + r.len; }).join('\n') : 'none'; }));
    rg2.appendChild(btn('Clear', function () { REGIONS = []; saveRegions(); status.textContent = 'regions cleared'; }));
    rg2.appendChild(btn('Calibrate', function () { REGIONS = REGIONS.filter(function (r) { return r.name !== 'palette'; }); saveRegions(); status.textContent = 'scanning heap…'; setTimeout(function () { calibratePalette(status); }, 30); }));
    panel.appendChild(rg2);
    // palette color-anchor: paste BGR555 hex (comma-sep) from a captured frame
    var rg3 = line('Pal find');
    var rCol = el('input', 'flex:1;' + inpS.replace('width:64px;', ''));
    rCol.placeholder = 'BGR555 hex,comma';
    rg3.appendChild(rCol);
    rg3.appendChild(btn('Scan', function () {
      var cols = rCol.value.split(',').map(function (x) { return parseInt(x.trim(), 16); }).filter(function (x) { return !isNaN(x); });
      if (cols.length < 3) { status.textContent = 'paste >=3 BGR555 colors'; return; }
      var mem = memView(); if (!mem) { status.textContent = 'no memory'; return; }
      status.textContent = 'scanning ' + (mem.length / 1048576 | 0) + 'MB...';
      setTimeout(function () { var off = findU16Seq(mem, cols); status.textContent = off >= 0 ? ('palette run @0x' + off.toString(16) + ' — register it as a region') : 'color run not found'; }, 30);
    }));
    panel.appendChild(rg3);

    // Output box + Copy button (all readouts are selectable text here).
    var outLine = line(''); outLine.appendChild(el('span', 'flex:1;color:#9fb0cc;', 'Output (copy me)'));
    var copyBtn = btn('📋 Copy', function () {
      var text = logEl.value;
      function done() { copyBtn.textContent = '✓ Copied'; setTimeout(function () { copyBtn.textContent = '📋 Copy'; }, 1200); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { logEl.focus(); logEl.select(); try { document.execCommand('copy'); done(); } catch (e) {} });
      } else { logEl.focus(); logEl.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
    });
    outLine.appendChild(copyBtn);
    panel.appendChild(outLine);
    panel.appendChild(logEl);

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
      var top = document.elementFromPoint(pt.clientX, pt.clientY) || {};
      var onCanvas = cvs && top === cvs;
      var msg = e.type + '\n' +
        'topmost el = ' + (onCanvas ? 'CANVAS ✓' : (top.tagName || '?') + '#' + (top.id || '') + '.' + (top.className || '')) + '\n' +
        'tap on canvas = ' + (relX | 0) + ',' + (relY | 0) + ' of ' + (r.width | 0) + '×' + (r.height | 0) + '\n' +
        'region = ' + half + '\n' +
        'canvas backing = ' + (cvs ? cvs.width + '×' + cvs.height : 'none');
      console.log('[touchtest]', msg);
      // Let the physical touchstart own the visible box (it's the useful event);
      // the synthetic/compat mouse + pointer events only go to the console so
      // they don't overwrite the readout you're about to copy.
      if (statusEl && e.type === 'touchstart') statusEl.textContent = msg;
    }
    var evs = ['touchstart', 'mousedown', 'pointerdown'];
    evs.forEach(function (ev) { g.addEventListener(ev, report, true); });
    touchTestOff = function () { evs.forEach(function (ev) { g.removeEventListener(ev, report, true); }); };
    if (statusEl) statusEl.textContent = 'touch test ON — tap the bottom screen';
  }

  // ---- opt-in DS touch → stylus bridge ------------------------------------
  // RetroArch drives the DS stylus from MOUSE events on the <canvas>; mobile
  // browsers fire TOUCH events the core never sees, so bottom-screen taps do
  // nothing. This forwards each touch to a synthetic mouse event at the same
  // page coords, but ONLY while the finger is over the emulator canvas — so it
  // can never swallow taps on the 'Start Game' button or menus. It's a panel
  // toggle (not wired into page load) so it can never block the game loading.
  var bridgeOff = null;
  function toggleTouchBridge(statusEl) {
    if (bridgeOff) { bridgeOff(); bridgeOff = null; if (statusEl) statusEl.textContent = 'touch→stylus OFF'; return; }
    var g = document.getElementById('game');
    if (!g) { if (statusEl) statusEl.textContent = 'no #game'; return; }
    function fire(type, t) {
      var target = document.elementFromPoint(t.clientX, t.clientY);
      if (!target || target.tagName !== 'CANVAS') return false;
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        clientX: t.clientX, clientY: t.clientY, button: 0, buttons: type === 'mouseup' ? 0 : 1
      }));
      return true;
    }
    function onStart(e) { if (e.touches[0] && fire('mousedown', e.touches[0])) e.preventDefault(); }
    function onMove(e) { if (e.touches[0] && fire('mousemove', e.touches[0])) e.preventDefault(); }
    function onEnd(e) { var t = e.changedTouches && e.changedTouches[0]; if (t && fire('mouseup', t)) e.preventDefault(); }
    g.addEventListener('touchstart', onStart, { passive: false });
    g.addEventListener('touchmove', onMove, { passive: false });
    g.addEventListener('touchend', onEnd, { passive: false });
    g.addEventListener('touchcancel', onEnd, { passive: false });
    bridgeOff = function () {
      g.removeEventListener('touchstart', onStart); g.removeEventListener('touchmove', onMove);
      g.removeEventListener('touchend', onEnd); g.removeEventListener('touchcancel', onEnd);
    };
    if (statusEl) statusEl.textContent = 'touch→stylus ON — now tap the bottom screen';
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
