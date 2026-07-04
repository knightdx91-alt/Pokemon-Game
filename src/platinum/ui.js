// Pokémon Unleashed — Platinum-faithful DS UI shell.
// Top screen 256x192 + bottom Pokétch screen; X opens the Start menu; each
// option routes to its Platinum screen. Nav via arrows/A/B/X (keyboard + touch).
// Screens are built from the exhaustive inventory in docs/PLATINUM_MENUS.md and
// use the ROM-decoded window frames (data/unleashed/platinum_ui/).
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  // integer-scale both 256x192 screens to fit the viewport
  function scale() {
    const stage = $('#stage'), pad = 24;
    const availH = (window.innerHeight - 90) / 2, availW = window.innerWidth - pad;
    const s = Math.max(1, Math.floor(Math.min(availW / 256, availH / 192) * 10) / 10);
    for (const id of ['#top', '#bot']) { const e = $(id); e.style.width = (256 * s) + 'px'; e.style.height = (192 * s) + 'px'; }
  }
  window.addEventListener('resize', scale);

  // ---- demo party (placeholder mons until wired to the save/engine) --------
  const PARTY = [
    { name: 'INFERNAPE', lv: 42, hp: 118, max: 132, color: '#e86838', g: 'm' },
    { name: 'STARAPTOR', lv: 40, hp: 96, max: 128, color: '#8a7060', g: 'm' },
    { name: 'LUXRAY', lv: 41, hp: 121, max: 121, color: '#2848a0', g: 'm' },
    { name: 'ROSERADE', lv: 39, hp: 74, max: 110, color: '#40a060', g: 'f' },
    { name: 'FLOATZEL', lv: 40, hp: 30, max: 124, color: '#48a0d0', g: 'f' },
    { name: 'BRONZONG', lv: 38, hp: 108, max: 118, color: '#3a6a70', g: '' },
  ];

  // ---- Start (X) menu -------------------------------------------------------
  // icons decoded from the ROM (menu_gra.narc) via tools/nds_gfx.py
  const IC = 'data/unleashed/platinum_ui/icons/';
  const MENU = [
    { key: 'dex', label: 'Pokédex', img: IC + 'icon_0.png' },   // red dex book
    { key: 'party', label: 'Pokémon', img: IC + 'icon_1.png' }, // poké ball
    { key: 'bag', label: 'Bag', img: IC + 'icon2_3.png' },      // pouch
    { key: 'card', label: 'Lucas', img: IC + 'icon_3.png' },    // trainer card
    { key: 'save', label: 'Save', img: IC + 'icon2_6.png' },    // save arrow
    { key: 'opt', label: 'Options', img: IC + 'icon_5.png' },   // DS console
    { key: 'exit', label: 'Exit', img: IC + 'icon2_5.png' },    // exit arrow
  ];
  let menuOpen = false, mi = 0, page = null, psel = 0, smtab = 0;

  function renderMenu() {
    const m = $('#startmenu'); m.innerHTML = '';
    MENU.forEach((it, i) => {
      const row = el('div', 'smi' + (i === mi ? ' sel' : ''));
      const icon = el('img', 'ic'); icon.src = it.img; icon.alt = '';
      row.appendChild(icon);
      row.appendChild(el('span', null, it.label));
      row.onclick = () => { mi = i; renderMenu(); choose(); };
      m.appendChild(row);
    });
    m.classList.toggle('open', menuOpen);
  }
  function openMenu() { menuOpen = true; mi = 0; renderMenu(); }
  function closeMenu() { menuOpen = false; renderMenu(); }

  function choose() {
    const k = MENU[mi].key;
    if (k === 'party') showParty();
    else if (k === 'exit') closeMenu();
    else if (k === 'card' || k === 'dex' || k === 'bag' || k === 'save' || k === 'opt') stub(MENU[mi].label);
  }
  function stub(name) {
    const p = $('#page'); p.classList.add('on');
    p.innerHTML = '';
    p.appendChild(el('div', 'pg-head', name.toUpperCase()));
    const w = el('div', 'win', `<div style="padding:10px;font-size:11px;line-height:1.5">
      <b>${name}</b> screen — next build unit.<br>Spec + ROM asset in
      docs/PLATINUM_MENUS.md.</div>`);
    w.style.cssText += 'position:absolute;left:20px;right:20px;top:40px;';
    p.appendChild(w);
    page = 'stub';
  }

  // ---- Party menu -----------------------------------------------------------
  function showParty() {
    closeMenu();
    const p = $('#page'); p.classList.add('on'); p.innerHTML = '';
    p.appendChild(el('div', 'pg-head', 'POKéMON'));
    const wrap = el('div'); wrap.id = 'party';
    PARTY.forEach((mon, i) => {
      const slot = el('div', 'pslot' + (i === psel ? ' sel' : '')); slot.id = 's' + i;
      const ball = el('div', 'pball');            // Poké Ball marker
      const ic = el('div', 'picon'); ic.style.background = mon.color;
      const pct = Math.round(mon.hp / mon.max * 100);
      const col = pct > 50 ? '#68d048' : pct > 20 ? '#f8c030' : '#f04040';
      const gsym = mon.g === 'm' ? '<span class="gm">♂</span>' : mon.g === 'f' ? '<span class="gf">♀</span>' : '';
      const info = el('div', 'pinfo', `<div class="pn">${mon.name}${gsym}</div><div class="pl">Lv${mon.lv}</div>
        <div class="hprow"><span class="hptag">HP</span><div class="hpbar"><div class="hpfill" style="width:${pct}%;background:${col}"></div></div></div>
        <div class="hptxt">${mon.hp}/${mon.max}</div>`);
      slot.appendChild(ball); slot.appendChild(ic); slot.appendChild(info);
      slot.onclick = () => { psel = i; showParty(); showSummary(); };
      wrap.appendChild(slot);
    });
    const cancel = el('div', null, 'CANCEL'); cancel.id = 'p-cancel';
    cancel.onclick = () => backToWorld();
    wrap.appendChild(cancel);
    p.appendChild(wrap);
    page = 'party';
  }

  // ---- Summary --------------------------------------------------------------
  const TABS = ['Info', 'Skills', 'Moves', 'Ribbons'];
  function showSummary() {
    const p = $('#page'); p.classList.add('on'); p.innerHTML = '';
    const mon = PARTY[psel];
    p.appendChild(el('div', 'pg-head', 'SUMMARY'));
    const s = el('div'); s.id = 'summary';
    const tabs = el('div', 'sm-tabs');
    TABS.forEach((t, i) => { const tb = el('div', 'sm-tab' + (i === smtab ? ' on' : ''), t); tb.onclick = () => { smtab = i; showSummary(); }; tabs.appendChild(tb); });
    s.appendChild(tabs);
    let body = '';
    if (smtab === 0) body = `<div class="sm-row"><b>Name</b><span>${mon.name}</span></div>
      <div class="sm-row"><b>Level</b><span>${mon.lv}</span></div>
      <div class="sm-row"><b>HP</b><span>${mon.hp}/${mon.max}</span></div>
      <div class="sm-row"><b>OT / ID</b><span>Lucas / 34827</span></div>
      <div class="sm-row"><b>Nature</b><span>Adamant</span></div>`;
    else if (smtab === 1) body = ['Attack 148', 'Defense 96', 'Sp. Atk 132', 'Sp. Def 90', 'Speed 140', 'Ability: Blaze']
      .map(r => `<div class="sm-row"><span>${r}</span></div>`).join('');
    else if (smtab === 2) body = ['Flare Blitz  15/15', 'Close Combat 5/5', 'Mach Punch  30/30', 'U-turn      20/20']
      .map(r => `<div class="sm-row"><span>${r}</span></div>`).join('');
    else body = `<div class="sm-row"><span>No ribbons yet.</span></div>`;
    s.appendChild(el('div', 'sm-body', body));
    p.appendChild(s);
    page = 'summary';
  }

  function backToWorld() { $('#page').classList.remove('on'); $('#page').innerHTML = ''; page = null; }

  // ---- input ----------------------------------------------------------------
  function press(k) {
    if (page === 'summary') {
      if (k === 'left') { smtab = (smtab + 3) % 4; showSummary(); }
      else if (k === 'right') { smtab = (smtab + 1) % 4; showSummary(); }
      else if (k === 'b') { showParty(); }
      return;
    }
    if (page === 'party') {
      if (k === 'up') { psel = (psel + 5) % 6; showParty(); }
      else if (k === 'down') { psel = (psel + 1) % 6; showParty(); }
      else if (k === 'a') { showSummary(); }
      else if (k === 'b') { backToWorld(); }
      return;
    }
    if (page === 'stub') { if (k === 'b') backToWorld(); return; }
    if (menuOpen) {
      if (k === 'up') { mi = (mi + MENU.length - 1) % MENU.length; renderMenu(); }
      else if (k === 'down') { mi = (mi + 1) % MENU.length; renderMenu(); }
      else if (k === 'a') choose();
      else if (k === 'b' || k === 'x') closeMenu();
      return;
    }
    if (k === 'x') openMenu();
  }

  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', x: 'x', z: 'a', Enter: 'a', X: 'x', Z: 'a', Backspace: 'b', Escape: 'b' };
  addEventListener('keydown', e => { const k = KEYMAP[e.key]; if (k) { e.preventDefault(); press(k); } });
  document.querySelectorAll('#ctrls .cbtn').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); });
  });

  // -------------------------------------------------------- Pokétch --------
  // Bottom-screen device: olive-green LCD, cycling apps (red button / Y / tap).
  const PK = { apps: ['Digital Watch', 'Analog Watch', 'Pedometer', 'Dot Artist'], app: 0, steps: 1287, dots: null };
  const G = {
    body: '#b8b0a0', bodyD: '#8f8676', screenF: '#6c7a3e', lcd: '#8fa35a',
    lcdD: '#7c9048', on: '#39471f', dim: '#66783c', red: '#d0402c', redD: '#8a2418',
  };
  function seg7(ctx, x, y, w, h, digit) {
    // 7-segment digit; digit is '0'-'9' or ':' handled by caller
    const S = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd',
                6: 'afgcde', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd' }[digit] || '';
    const t = Math.max(2, w * 0.16);
    const segs = {
      a: [x, y, w, t], g: [x, y + h / 2 - t / 2, w, t], d: [x, y + h - t, w, t],
      f: [x, y, t, h / 2], b: [x + w - t, y, t, h / 2],
      e: [x, y + h / 2, t, h / 2], c: [x + w - t, y + h / 2, t, h / 2],
    };
    for (const k in segs) {
      ctx.fillStyle = S.includes(k) ? G.on : G.dim;
      const s = segs[k]; ctx.fillRect(s[0], s[1], s[2], s[3]);
    }
  }
  function drawPoketch() {
    const cv = $('#poketch'); if (!cv) return; const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    // device body
    c.fillStyle = G.body; c.fillRect(0, 0, 256, 192);
    c.fillStyle = G.bodyD; c.fillRect(0, 176, 256, 16);
    // green screen frame
    c.fillStyle = G.screenF; c.fillRect(10, 12, 236, 156);
    c.fillStyle = G.lcd; c.fillRect(16, 18, 224, 144);
    // subtle LCD scanline tint
    c.fillStyle = G.lcdD; for (let y = 18; y < 162; y += 3) c.fillRect(16, y, 224, 1);
    // START / SELECT labels (top center)
    c.fillStyle = G.on; c.font = '9px Verdana'; c.textAlign = 'center';
    c.fillText('START', 96, 34); c.fillText('SELECT', 160, 34);
    // side L / R
    c.textAlign = 'left'; c.fillText('L', 22, 96); c.textAlign = 'right'; c.fillText('R', 234, 96);
    // red app button (right)
    c.fillStyle = G.redD; c.fillRect(198, 74, 40, 44);
    c.fillStyle = G.red; c.fillRect(200, 76, 36, 40);
    const app = PK.apps[PK.app];
    if (app === 'Digital Watch') {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
      const dig = hh + mm; let dx = 40;
      for (let i = 0; i < 4; i++) { seg7(c, dx, 74, 26, 44, dig[i]); dx += 34; if (i === 1) { c.fillStyle = G.on; c.fillRect(dx - 6, 84, 5, 5); c.fillRect(dx - 6, 104, 5, 5); dx += 6; } }
      // mon silhouette bottom-left
      c.fillStyle = G.dim; c.beginPath(); c.ellipse(48, 148, 20, 10, 0, 0, 7); c.fill();
    } else if (app === 'Analog Watch') {
      const d = new Date(), cx = 128, cy = 90, r = 46;
      c.strokeStyle = G.on; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * 7 - Math.PI / 2; c.fillStyle = G.on; c.fillRect(cx + Math.cos(a) * (r - 5) - 1, cy + Math.sin(a) * (r - 5) - 1, 3, 3); }
      const hand = (ang, len) => { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang - Math.PI / 2) * len, cy + Math.sin(ang - Math.PI / 2) * len); c.stroke(); };
      hand((d.getHours() % 12) / 12 * 7, 26); hand(d.getMinutes() / 60 * 7, 38);
    } else if (app === 'Pedometer') {
      c.fillStyle = G.on; c.font = '11px Verdana'; c.textAlign = 'center';
      c.fillText('STEPS', 128, 78); c.font = 'bold 30px Verdana';
      c.fillText(String(PK.steps).padStart(5, '0'), 128, 116);
    } else if (app === 'Dot Artist') {
      if (!PK.dots) PK.dots = Array.from({ length: 24 * 20 }, () => Math.random() < 0.12 ? 1 : 0);
      for (let y = 0; y < 20; y++) for (let x = 0; x < 24; x++) {
        c.fillStyle = PK.dots[y * 24 + x] ? G.on : G.lcdD; c.fillRect(40 + x * 7, 30 + y * 6, 6, 5);
      }
    }
    // app name footer
    c.fillStyle = G.on; c.font = '9px Verdana'; c.textAlign = 'center'; c.fillText(app, 128, 158);
  }
  function cyclePoketch(dir) { PK.app = (PK.app + PK.apps.length + (dir || 1)) % PK.apps.length; drawBottom(); }

  // ---- bottom-screen router: Pokétch in world/menu, ball grid in party -----
  let botMode = 'poketch';   // 'poketch' | 'party'
  function setBottom(m) { botMode = m; drawBottom(); }
  function drawBottom() { if (botMode === 'party') drawPartyBottom(); else drawPoketch(); }

  function drawPartyBottom() {
    const cv = $('#poketch'); if (!cv) return; const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    // blue striped background
    c.fillStyle = '#5b7bb0'; c.fillRect(0, 0, 256, 192);
    c.fillStyle = '#5273a8'; for (let y = 0; y < 192; y += 4) c.fillRect(0, y, 256, 2);
    // central big translucent Poké Ball watermark
    const cx = 128, cy = 96, r = 52;
    c.fillStyle = '#6f8fc4'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    c.fillStyle = '#8aa6d4'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI, true); c.fill();
    c.strokeStyle = '#4a6a9c'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.stroke();
    c.fillStyle = '#7f9fce'; c.beginPath(); c.arc(cx, cy, 15, 0, 7); c.fill();
    c.strokeStyle = '#4a6a9c'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 15, 0, 7); c.stroke();
    // 6 Poké Ball touch buttons (3 left, 3 right) — filled = has a mon
    const pos = [[52, 52], [52, 96], [52, 140], [204, 52], [204, 96], [204, 140]];
    pos.forEach((p, i) => {
      const has = i < PARTY.length; const rr = 18;
      c.fillStyle = has ? '#e24030' : '#6f8fc4'; c.beginPath(); c.arc(p[0], p[1], rr, 0, Math.PI, true); c.fill();
      c.fillStyle = has ? '#f4f4f4' : '#8aa6d4'; c.beginPath(); c.arc(p[0], p[1], rr, 0, Math.PI); c.fill();
      c.strokeStyle = '#33456a'; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], rr, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(p[0] - rr, p[1]); c.lineTo(p[0] + rr, p[1]); c.stroke();
      c.fillStyle = '#f4f4f4'; c.beginPath(); c.arc(p[0], p[1], 5, 0, 7); c.fill();
      c.strokeStyle = '#33456a'; c.beginPath(); c.arc(p[0], p[1], 5, 0, 7); c.stroke();
    });
  }

  // red button / bottom-screen tap: cycles Pokétch apps only in world/menu
  $('#poketch').addEventListener('pointerdown', () => { if (botMode === 'poketch') cyclePoketch(1); });

  // hook screen transitions to the bottom screen
  const _showParty = showParty, _backToWorld = backToWorld;
  showParty = function () { _showParty(); setBottom('party'); };
  backToWorld = function () { _backToWorld(); setBottom('poketch'); };

  scale(); renderMenu(); drawBottom();
  setInterval(drawBottom, 1000);
})();
