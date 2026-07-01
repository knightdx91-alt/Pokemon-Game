// GameStarter — first-time starter Pokémon selection overlay.
window.GameStarter = (function () {
    'use strict';

    const STARTERS = [
        { dex: 1, name: 'Bulbasaur', blurb: 'Grass/Poison · balanced' },
        { dex: 4, name: 'Charmander', blurb: 'Fire · glass cannon' },
        { dex: 7, name: 'Squirtle', blurb: 'Water · sturdy' }
    ];

    let overlay = null;
    let index = 0;
    let onDone = null;
    let rafId = null;
    const prev = { a: false, left: false, right: false };

    function show(cb) {
        onDone = cb;
        overlay = document.createElement('div');
        overlay.id = 'starter-overlay';
        overlay.innerHTML = `
          <div class="starter-box">
            <h2>Choose your first Pokémon!</h2>
            <div class="starter-grid"></div>
            <p class="starter-hint">◀ ▶ to choose · A / Enter to confirm</p>
          </div>`;
        document.body.appendChild(overlay);
        render();
        rafId = requestAnimationFrame(loop);
    }

    function render() {
        const grid = overlay.querySelector('.starter-grid');
        grid.innerHTML = STARTERS.map((s, i) => `
          <div class="starter-card ${i === index ? 'sel' : ''}">
            <img src="${GamePokedex.spriteFront(s.dex)}" alt="${s.name}"
                 onerror="this.style.visibility='hidden'">
            <div class="starter-name">${s.name}</div>
            <small>${s.blurb}</small>
          </div>`).join('');
    }

    function loop() {
        const s = GameInput.state;
        const edge = { a: s.a && !prev.a, left: s.left && !prev.left, right: s.right && !prev.right };
        prev.a = s.a; prev.left = s.left; prev.right = s.right;
        if (edge.left && index > 0) { index--; render(); }
        if (edge.right && index < STARTERS.length - 1) { index++; render(); }
        if (edge.a) { confirm(); return; }
        rafId = requestAnimationFrame(loop);
    }

    function confirm() {
        cancelAnimationFrame(rafId);
        const chosen = STARTERS[index];
        const mon = GamePokedex.create(chosen.dex, 5);
        GameParty.addPokemon(mon);
        GameParty.state.starterChosen = true;
        GameParty.save();
        overlay.remove();
        overlay = null;
        const cb = onDone; onDone = null;
        if (cb) cb(mon);
    }

    return { show };
})();
