// Pokémon Crater clone — turn-based battle engine.
// Damage/type/catch math follows the repo's verified USUM decomp servers
// (decomp/src/pml/battle/): Gen-style damage formula, 18×18 type chart,
// Gen-3/4 catch formula. Exposes window.CraterBattle.
(function () {
    'use strict';
    const D = window.CraterData;
    const M = window.CraterMon;

    const B = {};
    window.CraterBattle = B;

    function rnd() { return Math.random(); }
    function rint(n) { return Math.floor(Math.random() * n); }

    const STAGE_KEYS = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];
    function freshStages() {
        const s = {};
        STAGE_KEYS.forEach(k => { s[k] = 0; });
        return s;
    }
    function stageMult(stage) {
        return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
    }

    // ------------------------------------------------------------ battle ----
    // party: player's mons (fainted allowed); enemies: opposing mons in order.
    B.begin = function (party, enemies, opts) {
        opts = opts || {};
        const bt = {
            party: party,
            partyIdx: party.findIndex(m => m.hp > 0),
            enemies: enemies,
            enemyIdx: 0,
            isTrainer: !!opts.isTrainer,
            trainerName: opts.trainerName || null,
            pStages: freshStages(), eStages: freshStages(),
            pVol: {}, eVol: {},            // volatile: confusion, sleepTurns
            runAttempts: 0,
            over: false, result: null,     // 'win'|'lose'|'run'|'caught'
        };
        return bt;
    };

    function pmon(bt) { return bt.party[bt.partyIdx]; }
    function emon(bt) { return bt.enemies[bt.enemyIdx]; }

    // Free switch after a faint — no enemy response turn.
    B.forceSwitch = function (bt, idx) {
        bt.partyIdx = idx;
        bt.pStages = freshStages();
        bt.pVol = {};
    };

    // -------------------------------------------------------------- turn ----
    // action: {type:'move',idx} {type:'switch',idx} {type:'ball',item}
    //         {type:'heal',item,targetIdx} {type:'run'}
    // Returns a flat list of events for the UI to play back in order.
    B.turn = function (bt, action) {
        const ev = [];
        if (bt.over) return ev;

        if (action.type === 'run') {
            bt.runAttempts++;
            if (!bt.isTrainer && tryRun(bt)) {
                ev.push({ t: 'msg', text: 'Got away safely!' });
                bt.over = true; bt.result = 'run';
                return ev;
            }
            ev.push({ t: 'msg', text: bt.isTrainer ? "You can't run from a trainer battle!" : "Can't escape!" });
            if (!bt.isTrainer) { enemyAct(bt, ev); endOfTurn(bt, ev); }
            return ev;
        }

        if (action.type === 'switch') {
            const target = bt.party[action.idx];
            ev.push({ t: 'msg', text: 'Come back! Go, ' + M.displayName(target) + '!' });
            bt.partyIdx = action.idx;
            bt.pStages = freshStages(); bt.pVol = {};
            ev.push({ t: 'switch', side: 'p' });
            enemyAct(bt, ev); endOfTurn(bt, ev);
            return ev;
        }

        if (action.type === 'heal') {
            const item = D.ITEMS[action.item];
            const target = bt.party[action.targetIdx];
            if (item.kind === 'heal') {
                const max = M.stats(target).hp;
                const before = target.hp;
                target.hp = Math.min(max, target.hp + item.heal);
                ev.push({ t: 'msg', text: M.displayName(target) + ' recovered ' + (target.hp - before) + ' HP!' });
            } else if (item.kind === 'cure') {
                target.status = null;
                ev.push({ t: 'msg', text: M.displayName(target) + ' was cured!' });
            } else if (item.kind === 'revive') {
                target.hp = Math.floor(M.stats(target).hp / 2);
                target.status = null;
                ev.push({ t: 'msg', text: M.displayName(target) + ' was revived!' });
            }
            ev.push({ t: 'hp', side: 'p' });
            enemyAct(bt, ev); endOfTurn(bt, ev);
            return ev;
        }

        if (action.type === 'ball') {
            return throwBall(bt, action.item, ev);
        }

        // --- both sides use a move; order by priority then speed ------------
        const p = pmon(bt), e = emon(bt);
        const pMove = p.moves[action.idx];
        const eMoveIdx = pickEnemyMove(bt);
        const pPrio = (D.moves[pMove.id].priority || 0);
        const ePrio = (D.moves[e.moves[eMoveIdx].id].priority || 0);
        const pSpe = effSpeed(p, bt.pStages);
        const eSpe = effSpeed(e, bt.eStages);
        const playerFirst = pPrio !== ePrio ? pPrio > ePrio
            : (pSpe === eSpe ? rnd() < 0.5 : pSpe > eSpe);

        if (playerFirst) {
            useMove(bt, 'p', action.idx, ev);
            if (!bt.over && emon(bt).hp > 0) useMove(bt, 'e', eMoveIdx, ev);
        } else {
            useMove(bt, 'e', eMoveIdx, ev);
            if (!bt.over && pmon(bt).hp > 0) useMove(bt, 'p', action.idx, ev);
        }
        endOfTurn(bt, ev);
        return ev;
    };

    function effSpeed(mon, stages) {
        let s = M.stats(mon).spe * stageMult(stages.spe);
        if (mon.status === 'paralysis') s = Math.floor(s / 2);
        return s;
    }

    function tryRun(bt) {
        const a = M.stats(pmon(bt)).spe;
        const b = Math.max(1, M.stats(emon(bt)).spe);
        if (a >= b) return true;
        const f = Math.floor(a * 128 / b) + 30 * bt.runAttempts;
        return rint(256) < f;
    }

    // -------------------------------------------------------- move logic ----
    function useMove(bt, side, moveIdx, ev) {
        const user = side === 'p' ? pmon(bt) : emon(bt);
        const targ = side === 'p' ? emon(bt) : pmon(bt);
        const uStages = side === 'p' ? bt.pStages : bt.eStages;
        const tStages = side === 'p' ? bt.eStages : bt.pStages;
        const uVol = side === 'p' ? bt.pVol : bt.eVol;
        const uName = M.displayName(user), tName = M.displayName(targ);

        // status blockers
        if (user.status === 'sleep') {
            uVol.sleepTurns = (uVol.sleepTurns || 1 + rint(3)) - 1;
            if (uVol.sleepTurns > 0) {
                ev.push({ t: 'msg', text: uName + ' is fast asleep.' });
                return;
            }
            user.status = null;
            ev.push({ t: 'msg', text: uName + ' woke up!' });
        }
        if (user.status === 'freeze') {
            if (rnd() < 0.2) {
                user.status = null;
                ev.push({ t: 'msg', text: uName + ' thawed out!' });
            } else {
                ev.push({ t: 'msg', text: uName + ' is frozen solid!' });
                return;
            }
        }
        if (user.status === 'paralysis' && rnd() < 0.25) {
            ev.push({ t: 'msg', text: uName + ' is paralyzed! It can\'t move!' });
            return;
        }
        if (uVol.confused) {
            uVol.confused--;
            if (uVol.confused <= 0) {
                ev.push({ t: 'msg', text: uName + ' snapped out of confusion!' });
            } else {
                ev.push({ t: 'msg', text: uName + ' is confused!' });
                if (rnd() < 0.33) {
                    const dmg = confusionDamage(user, uStages);
                    user.hp = Math.max(0, user.hp - dmg);
                    ev.push({ t: 'msg', text: 'It hurt itself in its confusion!' });
                    ev.push({ t: 'hp', side: side });
                    checkFaint(bt, side === 'p' ? 'p' : 'e', ev);
                    return;
                }
            }
        }

        const slot = user.moves[moveIdx];
        const mv = D.moves[slot.id];
        if (slot.pp <= 0) {
            ev.push({ t: 'msg', text: uName + ' has no PP left!' });
            return;
        }
        slot.pp--;
        ev.push({ t: 'msg', text: uName + ' used ' + mv.name + '!', anim: { kind: 'attack', side: side } });

        // accuracy (101 / 0 in the data = sure-hit)
        const acc = mv.accuracy;
        if (acc > 0 && acc <= 100) {
            const chance = acc * stageMult(uStages.acc) / stageMult(tStages.eva);
            if (rnd() * 100 >= chance) {
                ev.push({ t: 'msg', text: 'The attack missed!' });
                return;
            }
        }

        if (mv.category === 'status') {
            applyStatusMove(bt, side, mv, user, targ, uStages, tStages, ev);
            return;
        }

        // ---- damaging move --------------------------------------------------
        const eff = D.effectiveness(mv.type, D.species[targ.dex].types);
        if (eff === 0) {
            ev.push({ t: 'msg', text: "It doesn't affect " + tName + '...' });
            return;
        }
        const hits = multiHitCount(mv);
        let total = 0, lastCrit = false;
        for (let h = 0; h < hits && targ.hp > 0; h++) {
            const r = damage(user, targ, mv, uStages, tStages);
            targ.hp = Math.max(0, targ.hp - r.dmg);
            total += r.dmg;
            lastCrit = r.crit;
        }
        ev.push({ t: 'hp', side: side === 'p' ? 'e' : 'p', anim: { kind: 'hit', side: side === 'p' ? 'e' : 'p' } });
        if (hits > 1) ev.push({ t: 'msg', text: 'Hit ' + hits + ' time(s)!' });
        if (lastCrit) ev.push({ t: 'msg', text: 'A critical hit!' });
        if (eff > 1) ev.push({ t: 'msg', text: "It's super effective!" });
        else if (eff < 1) ev.push({ t: 'msg', text: "It's not very effective..." });

        // secondary effect
        if (targ.hp > 0 && (mv.status || mv.statChanges)) {
            const chance = mv.effectChance || 100;
            if (rnd() * 100 < chance) {
                if (mv.status) applyStatus(targ, mv.status, side === 'p' ? bt.eVol : bt.pVol, ev);
                if (mv.statChanges) applyStages(mv.statChanges, uStages, tStages, uName, tName, ev, true);
            }
        }
        // recoil-ish flavor skipped; drain moves heal
        if (mv.flags && mv.flags.indexOf('heal') >= 0 && total > 0) {
            const healAmt = Math.max(1, Math.floor(total / 2));
            user.hp = Math.min(M.stats(user).hp, user.hp + healAmt);
            ev.push({ t: 'hp', side: side });
        }
        checkFaint(bt, side === 'p' ? 'e' : 'p', ev);
    }

    function multiHitCount(mv) {
        // effectId 29/statChanges-free 2-5 hit family — approximate via flags:
        // usum data has no explicit hit count; use the classic ids
        const MULTI = { 29: true, 30: true, 77: true };   // 2-5 hits, double hit
        if (mv.effectId === 44) return 2;                  // double kick family
        if (MULTI[mv.effectId]) {
            const r = rnd();
            return r < 0.375 ? 2 : r < 0.75 ? 3 : r < 0.875 ? 4 : 5;
        }
        return 1;
    }

    function confusionDamage(mon, stages) {
        const st = M.stats(mon);
        const A = st.atk * stageMult(stages.atk);
        const Dd = st.def * stageMult(stages.def);
        const base = Math.floor(Math.floor((2 * mon.level / 5 + 2) * 40 * A / Dd) / 50) + 2;
        return Math.max(1, Math.floor(base * (0.85 + rnd() * 0.15)));
    }

    function damage(user, targ, mv, uStages, tStages) {
        const uSt = M.stats(user), tSt = M.stats(targ);
        const crit = rnd() < 1 / 16;
        const phys = mv.category === 'physical';
        let aStage = phys ? uStages.atk : uStages.spa;
        let dStage = phys ? tStages.def : tStages.spd;
        if (crit) { aStage = Math.max(0, aStage); dStage = Math.min(0, dStage); }
        let A = (phys ? uSt.atk : uSt.spa) * stageMult(aStage);
        const Dd = Math.max(1, (phys ? tSt.def : tSt.spd) * stageMult(dStage));
        if (phys && user.status === 'burn') A = Math.floor(A / 2);

        let dmg = Math.floor(Math.floor((2 * user.level / 5 + 2) * mv.power * A / Dd) / 50) + 2;
        if (crit) dmg = Math.floor(dmg * 1.5);
        if (D.species[user.dex].types.indexOf(mv.type) >= 0) dmg = Math.floor(dmg * 1.5); // STAB
        dmg = Math.floor(dmg * D.effectiveness(mv.type, D.species[targ.dex].types));
        dmg = Math.floor(dmg * (0.85 + rnd() * 0.15));
        return { dmg: Math.max(1, dmg), crit: crit };
    }

    function applyStatusMove(bt, side, mv, user, targ, uStages, tStages, ev) {
        const uName = M.displayName(user), tName = M.displayName(targ);
        let did = false;
        if (mv.status) {
            // immunities: Electric vs paralysis wave etc. kept minimal: type immunity
            if (mv.accuracy <= 100 && D.effectiveness(mv.type, D.species[targ.dex].types) === 0) {
                ev.push({ t: 'msg', text: "It doesn't affect " + tName + '...' });
                return;
            }
            did = applyStatus(targ, mv.status, side === 'p' ? bt.eVol : bt.pVol, ev) || did;
        }
        if (mv.statChanges) {
            did = applyStages(mv.statChanges, uStages, tStages, uName, tName, ev, false) || did;
        }
        if (!did) ev.push({ t: 'msg', text: 'But it failed!' });
    }

    const STATUS_TEXT = {
        paralysis: ' was paralyzed!', burn: ' was burned!', poison: ' was poisoned!',
        sleep: ' fell asleep!', freeze: ' was frozen solid!', confusion: ' became confused!',
    };

    function applyStatus(targ, status, targVol, ev) {
        const tName = M.displayName(targ);
        if (status === 'confusion') {
            if (targVol.confused) return false;
            targVol.confused = 2 + rint(4);
            ev.push({ t: 'msg', text: tName + STATUS_TEXT.confusion });
            return true;
        }
        if (targ.status) return false;
        // basic type immunities
        const types = D.species[targ.dex].types;
        if (status === 'burn' && types.indexOf('Fire') >= 0) return false;
        if (status === 'freeze' && types.indexOf('Ice') >= 0) return false;
        if (status === 'poison' && (types.indexOf('Poison') >= 0 || types.indexOf('Steel') >= 0)) return false;
        if (status === 'paralysis' && types.indexOf('Electric') >= 0) return false;
        targ.status = status;
        if (status === 'sleep') targVol.sleepTurns = 1 + rint(3);
        ev.push({ t: 'msg', text: tName + (STATUS_TEXT[status] || ' was afflicted!') });
        return true;
    }

    const STAT_NAMES = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness' };

    function applyStages(changes, uStages, tStages, uName, tName, ev, quiet) {
        let did = false;
        for (const c of changes) {
            if (typeof c.stat !== 'string' || !(c.stat in STAT_NAMES)) continue;
            const onSelf = c.target === 'self';
            const stages = onSelf ? uStages : tStages;
            const before = stages[c.stat];
            stages[c.stat] = Math.max(-6, Math.min(6, before + c.stages));
            if (stages[c.stat] === before) {
                if (!quiet) ev.push({ t: 'msg', text: (onSelf ? uName : tName) + "'s " + STAT_NAMES[c.stat] + " won't go any " + (c.stages > 0 ? 'higher!' : 'lower!') });
                continue;
            }
            did = true;
            const dir = c.stages >= 2 ? ' rose sharply!' : c.stages === 1 ? ' rose!' : c.stages <= -2 ? ' fell harshly!' : ' fell!';
            ev.push({ t: 'msg', text: (onSelf ? uName : tName) + "'s " + STAT_NAMES[c.stat] + dir });
        }
        return did;
    }

    function endOfTurn(bt, ev) {
        if (bt.over) return;
        for (const side of ['p', 'e']) {
            const mon = side === 'p' ? pmon(bt) : emon(bt);
            if (!mon || mon.hp <= 0) continue;
            const max = M.stats(mon).hp;
            if (mon.status === 'poison') {
                mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(max / 8)));
                ev.push({ t: 'msg', text: M.displayName(mon) + ' is hurt by poison!' });
                ev.push({ t: 'hp', side: side });
            } else if (mon.status === 'burn') {
                mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(max / 16)));
                ev.push({ t: 'msg', text: M.displayName(mon) + ' is hurt by its burn!' });
                ev.push({ t: 'hp', side: side });
            }
            checkFaint(bt, side, ev);
            if (bt.over) return;
        }
    }

    function checkFaint(bt, side, ev) {
        const mon = side === 'p' ? pmon(bt) : emon(bt);
        if (!mon || mon.hp > 0) return;
        ev.push({ t: 'msg', text: M.displayName(mon) + ' fainted!', anim: { kind: 'faint', side: side } });
        ev.push({ t: 'faint', side: side });

        if (side === 'e') {
            ev.push({ t: 'exp', foe: mon });          // UI applies exp/level/evo
            const next = bt.enemies.findIndex((m, i) => i > bt.enemyIdx && m.hp > 0);
            if (bt.isTrainer && next >= 0) {
                bt.enemyIdx = next;
                bt.eStages = freshStages(); bt.eVol = {};
                ev.push({ t: 'msg', text: bt.trainerName + ' sent out ' + M.displayName(emon(bt)) + '!' });
                ev.push({ t: 'switch', side: 'e' });
            } else {
                bt.over = true; bt.result = 'win';
            }
        } else {
            const alive = bt.party.some(m => m.hp > 0);
            if (!alive) {
                bt.over = true; bt.result = 'lose';
                ev.push({ t: 'msg', text: 'You have no more Pokémon that can fight!' });
            } else {
                ev.push({ t: 'forceSwitch' });        // UI must prompt a switch
            }
        }
    }

    // ----------------------------------------------------------- catching ---
    function throwBall(bt, itemId, ev) {
        const item = D.ITEMS[itemId];
        if (bt.isTrainer) {
            ev.push({ t: 'msg', text: "You can't catch a trainer's Pokémon!" });
            return ev;
        }
        const target = emon(bt);
        ev.push({ t: 'msg', text: 'You threw a ' + item.name + '!', anim: { kind: 'ball' } });

        const maxHp = M.stats(target).hp;
        const rate = D.species[target.dex].catchRate;
        let statusBonus = 1;
        if (target.status === 'sleep' || target.status === 'freeze') statusBonus = 2;
        else if (target.status) statusBonus = 1.5;
        const a = Math.min(255, ((3 * maxHp - 2 * target.hp) * rate * item.mult) / (3 * maxHp) * statusBonus);

        let shakes = 0;
        if (a >= 255 || item.mult >= 255) {
            shakes = 4;
        } else {
            const b = Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / a)));
            for (let i = 0; i < 4; i++) if (rint(65536) < b) shakes++; else break;
        }
        for (let i = 1; i <= Math.min(3, shakes); i++) ev.push({ t: 'shake', n: i });

        if (shakes === 4) {
            ev.push({ t: 'msg', text: 'Gotcha! ' + M.displayName(target) + ' was caught!', anim: { kind: 'caught' } });
            bt.over = true; bt.result = 'caught';
            ev.push({ t: 'caught', mon: target });
        } else {
            const texts = ['Oh no! The Pokémon broke free!', 'Aww! It appeared to be caught!',
                'Aargh! Almost had it!', 'Shoot! It was so close, too!'];
            ev.push({ t: 'msg', text: texts[Math.min(3, shakes)], anim: { kind: 'break' } });
            enemyAct(bt, ev); endOfTurn(bt, ev);
        }
        return ev;
    }

    // ------------------------------------------------------------ enemy AI --
    function pickEnemyMove(bt) {
        const e = emon(bt), p = pmon(bt);
        const usable = e.moves.map((m, i) => ({ m: m, i: i })).filter(x => x.pp !== 0 && x.m.pp > 0);
        if (!usable.length) return 0;
        if (rnd() < 0.2) return usable[rint(usable.length)].i;
        let best = usable[0], bestScore = -1;
        for (const x of usable) {
            const mv = D.moves[x.m.id];
            let score;
            if (mv.category === 'status') {
                score = (mv.status && !p.status) ? 45 : (mv.statChanges ? 30 : 5);
            } else {
                const eff = D.effectiveness(mv.type, D.species[p.dex].types);
                const stab = D.species[e.dex].types.indexOf(mv.type) >= 0 ? 1.5 : 1;
                const acc = (mv.accuracy > 0 && mv.accuracy <= 100) ? mv.accuracy / 100 : 1;
                score = mv.power * eff * stab * acc;
            }
            if (score > bestScore) { bestScore = score; best = x; }
        }
        return best.i;
    }

    function enemyAct(bt, ev) {
        if (bt.over || emon(bt).hp <= 0 || pmon(bt).hp <= 0) return;
        useMove(bt, 'e', pickEnemyMove(bt), ev);
    }
})();
