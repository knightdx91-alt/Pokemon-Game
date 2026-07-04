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
    { name: 'INFERNAPE', lv: 42, hp: 118, max: 132, color: '#e86838' },
    { name: 'STARAPTOR', lv: 40, hp: 96, max: 128, color: '#8a7060' },
    { name: 'LUXRAY', lv: 41, hp: 121, max: 121, color: '#2848a0' },
    { name: 'ROSERADE', lv: 39, hp: 74, max: 110, color: '#40a060' },
    { name: 'FLOATZEL', lv: 40, hp: 30, max: 124, color: '#48a0d0' },
    { name: 'BRONZONG', lv: 38, hp: 108, max: 118, color: '#3a6a70' },
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
      const ic = el('div', 'picon'); ic.style.background = mon.color;
      const pct = Math.round(mon.hp / mon.max * 100);
      const col = pct > 50 ? '#68d048' : pct > 20 ? '#f8c030' : '#f04040';
      const info = el('div', 'pinfo', `<div class="pn">${mon.name}</div><div class="pl">Lv${mon.lv}</div>
        <div class="hpbar"><div class="hpfill" style="width:${pct}%;background:${col}"></div></div>
        <div class="hptxt">${mon.hp}/${mon.max}</div>`);
      slot.appendChild(ic); slot.appendChild(info);
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

  scale(); renderMenu();
  // live Pokétch clock
  setInterval(() => { const d = new Date(); $('#pk-time').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }, 1000);
})();
