// GameBattle — turn-based wild battle: UI, input loop, catching, exp/leveling.
window.GameBattle = (function () {
    'use strict';

    let active = false;
    let overlay = null;
    let els = {};
    let onEndCb = null;

    let player = null;      // current player Pokémon
    let enemy = null;       // active opponent Pokémon

    // Trainer-battle state (null / false for wild battles)
    let isTrainer = false;
    let trainer = null;         // { name, party, prize, outro }
    let trainerIndex = 0;       // index of active enemy in trainer.party
    let phase = 'intro';    // intro|message|menu|fight|bag|switch|end
    let menuIndex = 0;
    let subIndex = 0;
    let messageQueue = [];
    let afterMessage = null;
    let busy = false;       // animating; ignore input
    let rafId = null;

    // rising-edge input tracking
    const prev = { a: false, b: false, up: false, down: false, left: false, right: false };

    // ---------------------------------------------------------------
    // Public entry
    // ---------------------------------------------------------------
    function start(wildMon, onEnd) {
        if (active) return;
        active = true;
        onEndCb = onEnd;
        isTrainer = false;
        trainer = null;
        trainerIndex = 0;
        enemy = wildMon;
        GameParty.markSeen(enemy.dex);
        const hi = GameParty.firstHealthyIndex();
        player = GameParty.party()[hi];
        if (!player) { active = false; if (onEnd) onEnd({ result: 'nomon' }); return; }
        buildUI();
        phase = 'intro';
        queue([`A wild ${enemy.name} appeared!`, `Go! ${player.name}!`], () => setPhase('menu'));
        rafId = requestAnimationFrame(loop);
    }

    /** Begin a trainer battle. trainer = { name, party:[mons], prize, outro }. */
    function startTrainer(t, onEnd) {
        if (active) return;
        active = true;
        onEndCb = onEnd;
        isTrainer = true;
        trainer = t;
        trainerIndex = 0;
        enemy = t.party[0];
        const hi = GameParty.firstHealthyIndex();
        player = GameParty.party()[hi];
        if (!player) { active = false; if (onEnd) onEnd({ result: 'nomon' }); return; }
        buildUI();
        phase = 'intro';
        queue([`${t.name} sent out ${enemy.name}!`, `Go! ${player.name}!`], () => setPhase('menu'));
        rafId = requestAnimationFrame(loop);
    }

    function finish(result) {
        active = false;
        cancelAnimationFrame(rafId);
        if (overlay) { overlay.remove(); overlay = null; }
        GameParty.save();
        const cb = onEndCb; onEndCb = null;
        if (cb) cb(result);
    }

    // ---------------------------------------------------------------
    // UI construction
    // ---------------------------------------------------------------
    function buildUI() {
        overlay = document.createElement('div');
        overlay.id = 'battle-overlay';
        overlay.innerHTML = `
          <div class="battle-scene">
            <div class="enemy-row">
              <div class="mon-info enemy-info">
                <div class="mon-name"></div>
                <div class="mon-lvl"></div>
                <div class="hpbar"><div class="hpbar-fill"></div></div>
              </div>
              <img class="mon-sprite enemy-sprite" alt="">
            </div>
            <div class="player-row">
              <img class="mon-sprite player-sprite" alt="">
              <div class="mon-info player-info">
                <div class="mon-name"></div>
                <div class="mon-lvl"></div>
                <div class="hpbar"><div class="hpbar-fill"></div></div>
                <div class="hp-text"></div>
              </div>
            </div>
          </div>
          <div class="battle-bottom">
            <div class="battle-message"></div>
            <div class="battle-menu hidden"></div>
          </div>`;
        document.body.appendChild(overlay);
        els = {
            enemyName: overlay.querySelector('.enemy-info .mon-name'),
            enemyLvl:  overlay.querySelector('.enemy-info .mon-lvl'),
            enemyHp:   overlay.querySelector('.enemy-info .hpbar-fill'),
            enemySprite: overlay.querySelector('.enemy-sprite'),
            playerName: overlay.querySelector('.player-info .mon-name'),
            playerLvl:  overlay.querySelector('.player-info .mon-lvl'),
            playerHp:   overlay.querySelector('.player-info .hpbar-fill'),
            playerHpText: overlay.querySelector('.player-info .hp-text'),
            playerSprite: overlay.querySelector('.player-sprite'),
            message: overlay.querySelector('.battle-message'),
            menu: overlay.querySelector('.battle-menu')
        };
        els.enemySprite.src = GamePokedex.spriteFront(enemy.dex);
        els.enemySprite.onerror = () => { els.enemySprite.style.visibility = 'hidden'; };
        refreshSprites();
        renderInfo();
    }

    function refreshSprites() {
        els.playerSprite.src = GamePokedex.spriteBack(player.dex);
        els.playerSprite.onerror = () => { els.playerSprite.style.visibility = 'hidden'; };
        els.playerSprite.style.visibility = 'visible';
        els.enemySprite.src = GamePokedex.spriteFront(enemy.dex);
        els.enemySprite.style.visibility = 'visible';
    }

    function hpPct(mon) { return Math.max(0, Math.round((mon.hp / mon.stats.maxHp) * 100)); }
    function hpColor(pct) { return pct > 50 ? '#4caf50' : pct > 20 ? '#ffb300' : '#e53935'; }

    function renderInfo() {
        els.enemyName.textContent = enemy.name;
        els.enemyLvl.textContent = 'Lv' + enemy.level;
        const ep = hpPct(enemy);
        els.enemyHp.style.width = ep + '%';
        els.enemyHp.style.background = hpColor(ep);
        els.playerName.textContent = player.name;
        els.playerLvl.textContent = 'Lv' + player.level;
        const pp = hpPct(player);
        els.playerHp.style.width = pp + '%';
        els.playerHp.style.background = hpColor(pp);
        els.playerHpText.textContent = `${Math.max(0, player.hp)}/${player.stats.maxHp}`;
    }

    // ---------------------------------------------------------------
    // Messaging
    // ---------------------------------------------------------------
    function queue(msgs, after) {
        messageQueue = Array.isArray(msgs) ? msgs.slice() : [msgs];
        afterMessage = after || null;
        setPhase('message');
        showNextMessage();
    }

    function showNextMessage() {
        if (messageQueue.length === 0) {
            const a = afterMessage; afterMessage = null;
            if (a) a();
            return;
        }
        els.message.textContent = messageQueue.shift();
        els.menu.classList.add('hidden');
    }

    // ---------------------------------------------------------------
    // Phases / menus
    // ---------------------------------------------------------------
    function setPhase(p) {
        phase = p;
        menuIndex = 0; subIndex = 0;
        if (p === 'menu') renderMainMenu();
        else if (p === 'fight') renderFightMenu();
        else if (p === 'bag') renderBagMenu();
        else if (p === 'switch') renderSwitchMenu();
    }

    function renderMainMenu() {
        els.message.textContent = `What will ${player.name} do?`;
        const opts = ['FIGHT', 'BAG', 'POKéMON', 'RUN'];
        els.menu.className = 'battle-menu grid2';
        els.menu.innerHTML = opts.map((o, i) =>
            `<div class="menu-item ${i === menuIndex ? 'sel' : ''}">${o}</div>`).join('');
    }

    function renderFightMenu() {
        els.message.textContent = 'Choose a move:';
        els.menu.className = 'battle-menu grid2';
        els.menu.innerHTML = player.moves.map((m, i) => {
            const def = GameMoves.get(m.id);
            return `<div class="menu-item ${i === menuIndex ? 'sel' : ''}">
                <span>${def.name}</span><small>${def.type} · ${m.pp}/${m.maxPp}</small></div>`;
        }).join('') + `<div class="menu-hint">B: back</div>`;
    }

    function renderBagMenu() {
        const bag = GameParty.bag();
        const items = [
            ['pokeball', 'Poké Ball'], ['greatball', 'Great Ball'],
            ['ultraball', 'Ultra Ball'], ['potion', 'Potion'], ['superpotion', 'Super Potion']
        ].filter(([k]) => (bag[k] || 0) > 0);
        if (items.length === 0) items.push(['none', 'No items']);
        bagItems = items;
        els.message.textContent = 'Use which item?';
        els.menu.className = 'battle-menu list';
        els.menu.innerHTML = items.map(([k, label], i) =>
            `<div class="menu-item ${i === menuIndex ? 'sel' : ''}">${label} <small>×${bag[k] || 0}</small></div>`
        ).join('') + `<div class="menu-hint">B: back</div>`;
    }
    let bagItems = [];

    function renderSwitchMenu() {
        const party = GameParty.party();
        els.message.textContent = 'Switch to which Pokémon?';
        els.menu.className = 'battle-menu list';
        els.menu.innerHTML = party.map((p, i) => {
            const dead = p.hp <= 0 ? ' fainted' : '';
            const cur = p === player ? ' (active)' : '';
            return `<div class="menu-item${dead} ${i === menuIndex ? 'sel' : ''}">
                ${p.name} Lv${p.level}${cur} <small>${Math.max(0, p.hp)}/${p.stats.maxHp}</small></div>`;
        }).join('') + `<div class="menu-hint">B: back</div>`;
    }

    function updateMenuSelection() {
        const items = els.menu.querySelectorAll('.menu-item');
        items.forEach((it, i) => it.classList.toggle('sel', i === menuIndex));
    }

    // ---------------------------------------------------------------
    // Turn resolution
    // ---------------------------------------------------------------
    function enemyChooseMove() {
        const m = enemy.moves[Math.floor(Math.random() * enemy.moves.length)];
        return m || { id: 'tackle' };
    }

    function doPlayerMove(moveIndex) {
        const pMove = player.moves[moveIndex];
        if (pMove.pp <= 0) { queue('No PP left for that move!', () => setPhase('fight')); return; }
        pMove.pp--;
        const eMove = enemyChooseMove();
        // order by speed (ties random)
        const playerFirst = player.stats.speed >= enemy.stats.speed;
        const seq = playerFirst
            ? [() => attack(player, enemy, pMove.id, true), () => attack(enemy, player, eMove.id, false)]
            : [() => attack(enemy, player, eMove.id, false), () => attack(player, enemy, pMove.id, true)];
        runSequence(seq);
    }

    /** Execute a sequence of attack thunks that each return {msgs, fainted}. */
    function runSequence(seq) {
        busy = true;
        const msgs = [];
        let ended = null;
        for (const step of seq) {
            const r = step();
            msgs.push(...r.msgs);
            renderInfo();
            if (r.enemyFainted) { ended = 'win'; break; }
            if (r.playerFainted) { ended = 'playerDown'; break; }
        }
        queue(msgs, () => {
            busy = false;
            if (ended === 'win') return onEnemyFaint();
            if (ended === 'playerDown') return onPlayerFaint();
            setPhase('menu');
        });
    }

    function attack(attacker, defender, moveId, isPlayer) {
        const def = GameMoves.get(moveId);
        const msgs = [`${attacker.name} used ${def.name}!`];
        const res = { msgs, enemyFainted: false, playerFainted: false };
        // accuracy
        if (Math.random() * 100 > def.accuracy) {
            msgs.push(`${attacker.name}'s attack missed!`);
            return res;
        }
        const calc = GameMoves.calcDamage(attacker, defender, moveId);
        if (calc.status === 'atkDown') { defender.stats.attack = Math.max(1, Math.floor(defender.stats.attack * 0.85)); msgs.push(`${defender.name}'s Attack fell!`); return res; }
        if (calc.status === 'defDown') { defender.stats.defense = Math.max(1, Math.floor(defender.stats.defense * 0.85)); msgs.push(`${defender.name}'s Defense fell!`); return res; }
        if (calc.effectiveness === 0) { msgs.push(`It doesn't affect ${defender.name}...`); return res; }
        defender.hp = Math.max(0, defender.hp - calc.damage);
        if (calc.crit) msgs.push('A critical hit!');
        if (calc.effectiveness > 1) msgs.push('It\'s super effective!');
        else if (calc.effectiveness < 1) msgs.push('It\'s not very effective...');
        if (defender.hp <= 0) {
            msgs.push(`${defender.name} fainted!`);
            if (defender === enemy) res.enemyFainted = true; else res.playerFainted = true;
        }
        return res;
    }

    // ---------------------------------------------------------------
    // Faint / win / lose
    // ---------------------------------------------------------------
    function onEnemyFaint() {
        const gain = Math.floor((enemy.baseExp * enemy.level) / 7) + 1;
        const events = GamePokedex.gainExp(player, gain);
        const faintName = enemy.name;
        const msgs = [
            isTrainer ? `${trainer.name}'s ${faintName} fainted!` : `${player.name} gained ${gain} EXP!`
        ];
        if (isTrainer) msgs.push(`${player.name} gained ${gain} EXP!`);
        for (const ev of events) {
            msgs.push(`${player.name} grew to Lv${ev.level}!`);
            for (const mv of ev.learned) msgs.push(`${player.name} learned ${GameMoves.get(mv).name}!`);
        }

        if (isTrainer) {
            // More Pokémon on the trainer's team?
            if (trainerIndex < trainer.party.length - 1) {
                trainerIndex++;
                enemy = trainer.party[trainerIndex];
                msgs.push(`${trainer.name} sent out ${enemy.name}!`);
                renderInfo();
                queue(msgs, () => { refreshSprites(); renderInfo(); setPhase('menu'); });
                return;
            }
            // Trainer defeated
            GameParty.addMoney(trainer.prize);
            msgs.push(trainer.outro || `${trainer.name} was defeated!`);
            msgs.push(`You got $${trainer.prize} for winning!`);
            renderInfo();
            queue(msgs, () => finish({ result: 'win', trainer: true }));
            return;
        }

        GameParty.addMoney(enemy.level * 12);
        renderInfo();
        queue(msgs, () => finish({ result: 'win' }));
    }

    function onPlayerFaint() {
        const idx = GameParty.firstHealthyIndex();
        if (idx === -1) {
            queue([`${player.name} fainted!`, 'You have no more Pokémon...', 'You scurry back to safety.'],
                () => { GameParty.healAll(); finish({ result: 'lose' }); });
        } else {
            queue(`${player.name} fainted!`, () => setPhase('switch'));
        }
    }

    // ---------------------------------------------------------------
    // Catching
    // ---------------------------------------------------------------
    function tryCatch(ballKey) {
        if (isTrainer) {
            queue(['You can\'t catch a Trainer\'s POKéMON!'], () => setPhase('menu'));
            return;
        }
        const bag = GameParty.bag();
        bag[ballKey]--;
        const ballBonus = ballKey === 'ultraball' ? 2 : ballKey === 'greatball' ? 1.5 : 1;
        const hpFactor = (3 * enemy.stats.maxHp - 2 * enemy.hp) / (3 * enemy.stats.maxHp);
        const a = hpFactor * enemy.catchRate * ballBonus;
        const chance = Math.min(1, a / 255 + 0.05);
        const ballName = ballKey === 'ultraball' ? 'Ultra Ball' : ballKey === 'greatball' ? 'Great Ball' : 'Poké Ball';
        const shakes = Math.random() < chance;
        busy = true;
        if (shakes) {
            queue([`You threw a ${ballName}!`, 'Wobble... wobble... click!', `Gotcha! ${enemy.name} was caught!`],
                () => {
                    const where = GameParty.addPokemon(enemy);
                    busy = false;
                    if (where === 'box') finish({ result: 'caught', boxed: true });
                    else finish({ result: 'caught' });
                });
        } else {
            const eMove = enemyChooseMove();
            queue([`You threw a ${ballName}!`, 'Oh no! It broke free!'], () => {
                const r = attack(enemy, player, eMove.id, false);
                renderInfo();
                queue(r.msgs, () => {
                    busy = false;
                    if (r.playerFainted) return onPlayerFaint();
                    setPhase('menu');
                });
            });
        }
    }

    // ---------------------------------------------------------------
    // Running
    // ---------------------------------------------------------------
    function tryRun() {
        if (isTrainer) {
            queue(['No! There\'s no running from a Trainer battle!'], () => setPhase('menu'));
            return;
        }
        const chance = player.stats.speed >= enemy.stats.speed ? 1 : 0.5 + Math.random() * 0.35;
        busy = true;
        if (Math.random() < chance) {
            queue(['Got away safely!'], () => finish({ result: 'run' }));
        } else {
            const eMove = enemyChooseMove();
            queue(["Can't escape!"], () => {
                const r = attack(enemy, player, eMove.id, false);
                renderInfo();
                queue(r.msgs, () => {
                    busy = false;
                    if (r.playerFainted) return onPlayerFaint();
                    setPhase('menu');
                });
            });
        }
    }

    // ---------------------------------------------------------------
    // Input handling
    // ---------------------------------------------------------------
    function loop() {
        const s = GameInput.state;
        const edge = {
            a: s.a && !prev.a, b: s.b && !prev.b,
            up: s.up && !prev.up, down: s.down && !prev.down,
            left: s.left && !prev.left, right: s.right && !prev.right
        };
        prev.a = s.a; prev.b = s.b; prev.up = s.up; prev.down = s.down; prev.left = s.left; prev.right = s.right;

        handleInput(edge);

        if (active) rafId = requestAnimationFrame(loop);
    }

    function menuCount() {
        if (phase === 'menu') return 4;
        if (phase === 'fight') return player.moves.length;
        if (phase === 'bag') return bagItems.length;
        if (phase === 'switch') return GameParty.party().length;
        return 0;
    }

    function handleInput(edge) {
        if (phase === 'message') {
            if (edge.a || edge.b) showNextMessage();
            return;
        }
        const n = menuCount();
        const grid = (phase === 'menu' || phase === 'fight');
        if (grid) {
            if (edge.left && menuIndex % 2 === 1) menuIndex--;
            else if (edge.right && menuIndex % 2 === 0 && menuIndex + 1 < n) menuIndex++;
            else if (edge.up && menuIndex - 2 >= 0) menuIndex -= 2;
            else if (edge.down && menuIndex + 2 < n) menuIndex += 2;
        } else {
            if (edge.up && menuIndex > 0) menuIndex--;
            else if (edge.down && menuIndex + 1 < n) menuIndex++;
        }
        if (edge.up || edge.down || edge.left || edge.right) updateMenuSelection();

        if (edge.a) selectCurrent();
        if (edge.b) backOut();
    }

    function selectCurrent() {
        if (phase === 'menu') {
            if (menuIndex === 0) setPhase('fight');
            else if (menuIndex === 1) setPhase('bag');
            else if (menuIndex === 2) setPhase('switch');
            else tryRun();
        } else if (phase === 'fight') {
            doPlayerMove(menuIndex);
        } else if (phase === 'bag') {
            const item = bagItems[menuIndex];
            if (!item || item[0] === 'none') return;
            const key = item[0];
            if (key === 'pokeball' || key === 'greatball' || key === 'ultraball') tryCatch(key);
            else { // potion
                if (player.hp >= player.stats.maxHp) { queue('HP is already full!', () => setPhase('bag')); return; }
                GameParty.useItem(key, player);
                renderInfo();
                const eMove = enemyChooseMove();
                busy = true;
                queue([`Used ${item[1]}. ${player.name} recovered HP!`], () => {
                    const r = attack(enemy, player, eMove.id, false);
                    renderInfo();
                    queue(r.msgs, () => { busy = false; if (r.playerFainted) return onPlayerFaint(); setPhase('menu'); });
                });
            }
        } else if (phase === 'switch') {
            const target = GameParty.party()[menuIndex];
            if (target.hp <= 0) { queue(`${target.name} has no energy left!`, () => setPhase('switch')); return; }
            if (target === player) { setPhase('menu'); return; }
            const wasFainted = player.hp <= 0;
            player = target;
            refreshSprites();
            renderInfo();
            if (wasFainted) {
                queue([`Go! ${player.name}!`], () => setPhase('menu'));
            } else {
                // switching costs a turn
                const eMove = enemyChooseMove();
                busy = true;
                queue([`Go! ${player.name}!`], () => {
                    const r = attack(enemy, player, eMove.id, false);
                    renderInfo();
                    queue(r.msgs, () => { busy = false; if (r.playerFainted) return onPlayerFaint(); setPhase('menu'); });
                });
            }
        }
    }

    function backOut() {
        if (phase === 'fight' || phase === 'bag') setPhase('menu');
        else if (phase === 'switch' && player.hp > 0) setPhase('menu');
    }

    return { start, startTrainer, get active() { return active; } };
})();
