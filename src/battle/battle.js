// GameBattle — turn-based battle rendered on a native-resolution (240x160)
// canvas using the extracted FireRed font and palette, for a faithful look.
window.GameBattle = (function () {
    'use strict';

    const VW = 240, VH = 160;

    let active = false;
    let overlay = null;
    let canvas = null, ctx = null;
    let onEndCb = null;

    let player = null;      // current player Pokémon
    let enemy = null;       // active opponent Pokémon
    let enemyImg = null, playerImg = null;

    // Trainer-battle state
    let isTrainer = false;
    let trainer = null;
    let trainerIndex = 0;

    let phase = 'intro';    // intro|message|menu|fight|bag|switch
    let menuIndex = 0;
    let messageQueue = [];
    let afterMessage = null;
    let currentMessage = '';
    let bagItems = [];
    let rafId = null;

    const prev = { a: false, b: false, up: false, down: false, left: false, right: false };

    // FireRed-derived palette
    const COL = {
        boxFill: '#f8f8e8', boxLine: '#404850', boxShadow: '#a0a8a0',
        text: '#404040',
        barFrame: '#101018', barBg: '#485038',
        hpGreen: ['#78f8a8', '#58d080'], hpYellow: ['#f8e038', '#c8a808'], hpRed: ['#f85838', '#c05038'],
        expLight: '#58c0f8', expDark: '#3878b8',
        msgFill: '#f8f8f8', msgOuter: '#385890', msgInner: '#88b0d8',
        cursor: '#e03030'
    };

    // ---------------------------------------------------------------
    // Entry points
    // ---------------------------------------------------------------
    function start(wildMon, onEnd) {
        if (active) return;
        active = true; onEndCb = onEnd;
        isTrainer = false; trainer = null; trainerIndex = 0;
        enemy = wildMon;
        GameParty.markSeen(enemy.dex);
        player = GameParty.party()[GameParty.firstHealthyIndex()];
        if (!player) { active = false; if (onEnd) onEnd({ result: 'nomon' }); return; }
        buildUI();
        queue([`A wild ${enemy.name.toUpperCase()} appeared!`, `Go! ${player.name.toUpperCase()}!`], () => setPhase('menu'));
        rafId = requestAnimationFrame(loop);
    }

    function startTrainer(t, onEnd) {
        if (active) return;
        active = true; onEndCb = onEnd;
        isTrainer = true; trainer = t; trainerIndex = 0;
        enemy = t.party[0];
        player = GameParty.party()[GameParty.firstHealthyIndex()];
        if (!player) { active = false; if (onEnd) onEnd({ result: 'nomon' }); return; }
        buildUI();
        queue([`${t.name} sent out ${enemy.name.toUpperCase()}!`, `Go! ${player.name.toUpperCase()}!`], () => setPhase('menu'));
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
        canvas = document.createElement('canvas');
        canvas.width = VW; canvas.height = VH;
        canvas.id = 'battle-canvas';
        overlay.appendChild(canvas);
        document.body.appendChild(overlay);
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        loadSprites();
    }

    function loadSprites() {
        enemyImg = new Image();
        enemyImg.src = GamePokedex.spriteFront(enemy.dex);
        playerImg = new Image();
        playerImg.src = GamePokedex.spriteBack(player.dex);
    }
    function refreshSprites() { loadSprites(); }
    function renderInfo() { /* canvas redraw reads state directly */ }

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
        currentMessage = messageQueue.shift();
    }

    function setPhase(p) {
        phase = p;
        menuIndex = 0;
        if (p === 'bag') buildBagItems();
    }

    function buildBagItems() {
        const bag = GameParty.bag();
        const items = [
            ['pokeball', 'POKé BALL'], ['greatball', 'GREAT BALL'],
            ['ultraball', 'ULTRA BALL'], ['potion', 'POTION'], ['superpotion', 'SUPER POTION']
        ].filter(([k]) => (bag[k] || 0) > 0);
        if (items.length === 0) items.push(['none', 'NO ITEMS']);
        bagItems = items;
    }

    // ===============================================================
    // RENDERING
    // ===============================================================
    function redraw() {
        if (!ctx) return;
        drawScene();
        drawHealthbox(enemy, false, 8, 14);
        drawHealthbox(player, true, VW - 112, 68);
        drawBottom();
    }

    function drawScene() {
        // sky gradient
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, '#78c8f8'); g.addColorStop(0.55, '#b0e0b0'); g.addColorStop(1, '#88c878');
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        // platforms (ellipses)
        drawEllipse(178, 62, 46, 12, '#7cc060', '#5aa048');
        drawEllipse(60, 116, 54, 14, '#7cc060', '#5aa048');
        // sprites
        if (enemyImg && enemyImg.complete && enemyImg.naturalWidth)
            ctx.drawImage(enemyImg, 148, 8, 60, 60);
        if (playerImg && playerImg.complete && playerImg.naturalWidth)
            ctx.drawImage(playerImg, 26, 66, 64, 64);
    }

    function drawEllipse(cx, cy, rx, ry, fill, edge) {
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(rx, ry);
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore();
        ctx.fillStyle = edge; ctx.fill();
        ctx.save();
        ctx.translate(cx, cy - 1); ctx.scale(rx - 2, ry - 2);
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore();
        ctx.fillStyle = fill; ctx.fill();
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function hpColors(pct) {
        return pct > 0.5 ? COL.hpGreen : pct > 0.2 ? COL.hpYellow : COL.hpRed;
    }

    function drawHealthbox(mon, isPlayer, x, y) {
        const w = 104, h = isPlayer ? 42 : 26;
        // box
        ctx.fillStyle = COL.boxShadow; roundRect(x + 2, y + 3, w, h, 5); ctx.fill();
        ctx.fillStyle = COL.boxLine; roundRect(x, y, w, h, 5); ctx.fill();
        ctx.fillStyle = COL.boxFill; roundRect(x + 1, y + 1, w - 2, h - 2, 4); ctx.fill();

        const name = mon.name.toUpperCase();
        GameFont.draw(ctx, name, x + 6, y + 4, 1);
        const lvl = 'Lv' + mon.level;
        GameFont.draw(ctx, lvl, x + w - GameFont.measure(lvl) - 6, y + 4, 1);

        // HP bar
        const bx = x + 20, by = y + 17, bw = 74;
        GameFont.draw(ctx, 'HP', x + 6, y + 15, 1);
        ctx.fillStyle = COL.barFrame; roundRect(bx - 2, by - 2, bw + 4, 7, 2); ctx.fill();
        ctx.fillStyle = COL.barBg; ctx.fillRect(bx, by, bw, 3);
        const pct = Math.max(0, mon.hp) / mon.stats.maxHp;
        const c = hpColors(pct);
        const fw = Math.max(0, Math.round(bw * pct));
        ctx.fillStyle = c[1]; ctx.fillRect(bx, by, fw, 3);
        ctx.fillStyle = c[0]; ctx.fillRect(bx, by, fw, 1);

        if (isPlayer) {
            const hpText = Math.max(0, mon.hp) + '/' + mon.stats.maxHp;
            GameFont.draw(ctx, hpText, x + w - GameFont.measure(hpText) - 6, y + 24, 1);
            // EXP bar
            const ex = x + 6, ey = y + h - 5, ew = w - 12;
            ctx.fillStyle = COL.barFrame; ctx.fillRect(ex - 1, ey - 1, ew + 2, 4);
            ctx.fillStyle = '#204058'; ctx.fillRect(ex, ey, ew, 2);
            const need = GamePokedex.expForLevel(mon.level + 1) - GamePokedex.expForLevel(mon.level);
            const have = mon.exp - GamePokedex.expForLevel(mon.level);
            const ep = Math.max(0, Math.min(1, need > 0 ? have / need : 0));
            ctx.fillStyle = COL.expDark; ctx.fillRect(ex, ey, Math.round(ew * ep), 2);
            ctx.fillStyle = COL.expLight; ctx.fillRect(ex, ey, Math.round(ew * ep), 1);
        }
    }

    // Bottom panel: message box and/or menus
    function drawBottom() {
        const bx = 2, by = 112, bw = VW - 4, bh = VH - by - 2;
        if (phase === 'menu') {
            drawTextFrame(bx, by, bw - 116, bh);
            drawWrapped(`What will\n${player.name.toUpperCase()} do?`, bx + 8, by + 8, bw - 132);
            drawCommandGrid(VW - 114, by, 112, bh);
        } else if (phase === 'fight') {
            drawTextFrame(bx, by, bw - 70, bh);
            drawMoveList(bx + 6, by + 6);
            drawMoveInfo(VW - 72, by, 70, bh);
        } else if (phase === 'bag') {
            drawTextFrame(bx, by, bw, bh);
            drawList(bagItems.map((it, i) => it[1] + '  x' + (GameParty.bag()[it[0]] || 0)), bx + 12, by + 7);
        } else if (phase === 'switch') {
            drawTextFrame(bx, by, bw, bh);
            const party = GameParty.party();
            drawList(party.map(pk => `${pk.name.toUpperCase()} Lv${pk.level}  ${Math.max(0, pk.hp)}/${pk.stats.maxHp}`),
                bx + 12, by + 7, party.map(pk => pk.hp <= 0));
        } else {
            // message / intro
            drawTextFrame(bx, by, bw, bh);
            drawWrapped(currentMessage, bx + 8, by + 8, bw - 16);
            // blinking advance cursor
            if (Math.floor(Date.now() / 400) % 2 === 0) {
                ctx.fillStyle = COL.cursor;
                triangle(bx + bw - 12, by + bh - 10, 5, 'down');
            }
        }
    }

    function drawTextFrame(x, y, w, h) {
        ctx.fillStyle = COL.msgFill; roundRect(x, y, w, h, 4); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = COL.msgOuter; roundRect(x + 1, y + 1, w - 2, h - 2, 4); ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = COL.msgInner; roundRect(x + 3, y + 3, w - 6, h - 6, 3); ctx.stroke();
    }

    function drawCommandGrid(x, y, w, h) {
        drawTextFrame(x, y, w, h);
        const opts = ['FIGHT', 'BAG', 'POKéMON', 'RUN'];
        const colX = [x + 10, x + 62];
        const rowY = [y + 8, y + 26];
        for (let i = 0; i < 4; i++) {
            const cx = colX[i % 2];
            const cy = rowY[Math.floor(i / 2)];
            if (i === menuIndex) { ctx.fillStyle = COL.cursor; triangle(cx - 6, cy + 2, 4, 'right'); }
            GameFont.draw(ctx, opts[i], cx, cy, 1);
        }
    }

    function drawMoveList(x, y) {
        for (let i = 0; i < player.moves.length; i++) {
            const def = GameMoves.get(player.moves[i].id);
            const cx = x + (i % 2) * 82;
            const cy = y + Math.floor(i / 2) * 16;
            if (i === menuIndex) { ctx.fillStyle = COL.cursor; triangle(cx - 4, cy + 2, 4, 'right'); }
            GameFont.draw(ctx, def.name.toUpperCase(), cx + 2, cy, 1);
        }
    }

    function drawMoveInfo(x, y, w, h) {
        drawTextFrame(x, y, w, h);
        const m = player.moves[menuIndex];
        if (!m) return;
        const def = GameMoves.get(m.id);
        GameFont.draw(ctx, 'PP ' + m.pp + '/' + m.maxPp, x + 6, y + 6, 1);
        GameFont.draw(ctx, def.type.toUpperCase(), x + 6, y + 20, 1);
    }

    function drawList(lines, x, y, dimFlags) {
        for (let i = 0; i < lines.length; i++) {
            const cy = y + i * 12;
            if (i === menuIndex) { ctx.fillStyle = COL.cursor; triangle(x - 8, cy + 2, 4, 'right'); }
            GameFont.draw(ctx, lines[i], x, cy, 1);
        }
    }

    function drawWrapped(text, x, y, maxW) {
        const paras = String(text).split('\n');
        let line = 0;
        for (const para of paras) {
            const words = para.split(' ');
            let cur = '';
            for (const wd of words) {
                const t = cur ? cur + ' ' + wd : wd;
                if (GameFont.measure(t) > maxW && cur) {
                    GameFont.draw(ctx, cur, x, y + line * 14, 1); line++; cur = wd;
                } else cur = t;
            }
            if (cur) { GameFont.draw(ctx, cur, x, y + line * 14, 1); line++; }
        }
    }

    function triangle(x, y, s, dir) {
        ctx.beginPath();
        if (dir === 'right') { ctx.moveTo(x, y); ctx.lineTo(x + s, y + s / 2); ctx.lineTo(x, y + s); }
        else { ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s / 2, y + s); }
        ctx.closePath(); ctx.fill();
    }

    // ===============================================================
    // TURN LOGIC (unchanged)
    // ===============================================================
    function enemyChooseMove() {
        const m = enemy.moves[Math.floor(Math.random() * enemy.moves.length)];
        return m || { id: 'tackle' };
    }

    function doPlayerMove(moveIndex) {
        const pMove = player.moves[moveIndex];
        if (pMove.pp <= 0) { queue('No PP left for that move!', () => setPhase('fight')); return; }
        pMove.pp--;
        const eMove = enemyChooseMove();
        const playerFirst = player.stats.speed >= enemy.stats.speed;
        const seq = playerFirst
            ? [() => attack(player, enemy, pMove.id), () => attack(enemy, player, eMove.id)]
            : [() => attack(enemy, player, eMove.id), () => attack(player, enemy, pMove.id)];
        runSequence(seq);
    }

    function runSequence(seq) {
        const msgs = [];
        let ended = null;
        for (const step of seq) {
            const r = step();
            msgs.push(...r.msgs);
            if (r.enemyFainted) { ended = 'win'; break; }
            if (r.playerFainted) { ended = 'playerDown'; break; }
        }
        queue(msgs, () => {
            if (ended === 'win') return onEnemyFaint();
            if (ended === 'playerDown') return onPlayerFaint();
            setPhase('menu');
        });
    }

    function attack(attacker, defender, moveId) {
        const def = GameMoves.get(moveId);
        const msgs = [`${attacker.name.toUpperCase()} used ${def.name.toUpperCase()}!`];
        const res = { msgs, enemyFainted: false, playerFainted: false };
        if (Math.random() * 100 > def.accuracy) { msgs.push(`${attacker.name.toUpperCase()}'s attack missed!`); return res; }
        const calc = GameMoves.calcDamage(attacker, defender, moveId);
        if (calc.status === 'atkDown') { defender.stats.attack = Math.max(1, Math.floor(defender.stats.attack * 0.85)); msgs.push(`${defender.name.toUpperCase()}'s Attack fell!`); return res; }
        if (calc.status === 'defDown') { defender.stats.defense = Math.max(1, Math.floor(defender.stats.defense * 0.85)); msgs.push(`${defender.name.toUpperCase()}'s Defense fell!`); return res; }
        if (calc.effectiveness === 0) { msgs.push(`It doesn't affect ${defender.name.toUpperCase()}...`); return res; }
        defender.hp = Math.max(0, defender.hp - calc.damage);
        if (calc.crit) msgs.push('A critical hit!');
        if (calc.effectiveness > 1) msgs.push('It\'s super effective!');
        else if (calc.effectiveness < 1) msgs.push('It\'s not very effective...');
        if (defender.hp <= 0) {
            msgs.push(`${defender.name.toUpperCase()} fainted!`);
            if (defender === enemy) res.enemyFainted = true; else res.playerFainted = true;
        }
        return res;
    }

    function onEnemyFaint() {
        const gain = Math.floor((enemy.baseExp * enemy.level) / 7) + 1;
        const events = GamePokedex.gainExp(player, gain);
        const msgs = [ isTrainer ? `${trainer.name}'s ${enemy.name.toUpperCase()} fainted!` : `${player.name.toUpperCase()} gained ${gain} EXP!` ];
        if (isTrainer) msgs.push(`${player.name.toUpperCase()} gained ${gain} EXP!`);
        for (const ev of events) {
            msgs.push(`${player.name.toUpperCase()} grew to Lv${ev.level}!`);
            for (const mv of ev.learned) msgs.push(`${player.name.toUpperCase()} learned ${GameMoves.get(mv).name.toUpperCase()}!`);
        }
        if (isTrainer) {
            if (trainerIndex < trainer.party.length - 1) {
                trainerIndex++;
                enemy = trainer.party[trainerIndex];
                msgs.push(`${trainer.name} sent out ${enemy.name.toUpperCase()}!`);
                queue(msgs, () => { refreshSprites(); setPhase('menu'); });
                return;
            }
            GameParty.addMoney(trainer.prize);
            msgs.push(trainer.outro || `${trainer.name} was defeated!`);
            msgs.push(`You got ¥${trainer.prize} for winning!`);
            queue(msgs, () => finish({ result: 'win', trainer: true }));
            return;
        }
        GameParty.addMoney(enemy.level * 12);
        queue(msgs, () => finish({ result: 'win' }));
    }

    function onPlayerFaint() {
        const idx = GameParty.firstHealthyIndex();
        if (idx === -1) {
            queue([`${player.name.toUpperCase()} fainted!`, 'You have no more POKéMON...', 'You scurry back to safety.'],
                () => { GameParty.healAll(); finish({ result: 'lose' }); });
        } else {
            queue(`${player.name.toUpperCase()} fainted!`, () => setPhase('switch'));
        }
    }

    function tryCatch(ballKey) {
        if (isTrainer) { queue(["You can't catch a Trainer's POKéMON!"], () => setPhase('menu')); return; }
        const bag = GameParty.bag();
        bag[ballKey]--;
        const ballBonus = ballKey === 'ultraball' ? 2 : ballKey === 'greatball' ? 1.5 : 1;
        const hpFactor = (3 * enemy.stats.maxHp - 2 * enemy.hp) / (3 * enemy.stats.maxHp);
        const chance = Math.min(1, hpFactor * enemy.catchRate * ballBonus / 255 + 0.05);
        const ballName = ballKey === 'ultraball' ? 'ULTRA BALL' : ballKey === 'greatball' ? 'GREAT BALL' : 'POKé BALL';
        if (Math.random() < chance) {
            queue([`You threw a ${ballName}!`, 'Wobble... wobble... click!', `Gotcha! ${enemy.name.toUpperCase()} was caught!`], () => {
                const where = GameParty.addPokemon(enemy);
                finish({ result: 'caught', boxed: where === 'box' });
            });
        } else {
            const eMove = enemyChooseMove();
            queue([`You threw a ${ballName}!`, 'Oh no! It broke free!'], () => {
                const r = attack(enemy, player, eMove.id);
                queue(r.msgs, () => { if (r.playerFainted) return onPlayerFaint(); setPhase('menu'); });
            });
        }
    }

    function tryRun() {
        if (isTrainer) { queue(["No! There's no running from a Trainer battle!"], () => setPhase('menu')); return; }
        const chance = player.stats.speed >= enemy.stats.speed ? 1 : 0.5 + Math.random() * 0.35;
        if (Math.random() < chance) {
            queue(['Got away safely!'], () => finish({ result: 'run' }));
        } else {
            const eMove = enemyChooseMove();
            queue(["Can't escape!"], () => {
                const r = attack(enemy, player, eMove.id);
                queue(r.msgs, () => { if (r.playerFainted) return onPlayerFaint(); setPhase('menu'); });
            });
        }
    }

    // ===============================================================
    // INPUT
    // ===============================================================
    function loop() {
        const s = GameInput.state;
        const edge = {
            a: s.a && !prev.a, b: s.b && !prev.b,
            up: s.up && !prev.up, down: s.down && !prev.down,
            left: s.left && !prev.left, right: s.right && !prev.right
        };
        prev.a = s.a; prev.b = s.b; prev.up = s.up; prev.down = s.down; prev.left = s.left; prev.right = s.right;
        handleInput(edge);
        redraw();
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
        if (phase === 'message') { if (edge.a || edge.b) showNextMessage(); return; }
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
            else {
                if (player.hp >= player.stats.maxHp) { queue('HP is already full!', () => setPhase('bag')); return; }
                GameParty.useItem(key, player);
                const eMove = enemyChooseMove();
                queue([`Used ${item[1]}. ${player.name.toUpperCase()} recovered HP!`], () => {
                    const r = attack(enemy, player, eMove.id);
                    queue(r.msgs, () => { if (r.playerFainted) return onPlayerFaint(); setPhase('menu'); });
                });
            }
        } else if (phase === 'switch') {
            const target = GameParty.party()[menuIndex];
            if (target.hp <= 0) { queue(`${target.name.toUpperCase()} has no energy left!`, () => setPhase('switch')); return; }
            if (target === player) { setPhase('menu'); return; }
            const wasFainted = player.hp <= 0;
            player = target;
            refreshSprites();
            if (wasFainted) { queue([`Go! ${player.name.toUpperCase()}!`], () => setPhase('menu')); }
            else {
                const eMove = enemyChooseMove();
                queue([`Go! ${player.name.toUpperCase()}!`], () => {
                    const r = attack(enemy, player, eMove.id);
                    queue(r.msgs, () => { if (r.playerFainted) return onPlayerFaint(); setPhase('menu'); });
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
