// Pokémon Crater clone — Pokémon instances: creation, stats, exp, evolution.
// Depends on data.js (window.CraterData). Exposes window.CraterMon.
(function () {
    'use strict';
    const D = window.CraterData;

    const M = {};
    window.CraterMon = M;

    // Crater's signature colored variants — spawn odds, stat boost, CSS filter.
    M.VARIANTS = {
        normal:   { w: 908, boost: 1.0,  exp: 1.0, label: '',         filter: '' },
        shiny:    { w: 30,  boost: 1.1,  exp: 1.2, label: 'Shiny',    filter: 'hue-rotate(65deg) saturate(1.7)' },
        dark:     { w: 22,  boost: 1.15, exp: 1.2, label: 'Dark',     filter: 'brightness(0.55) contrast(1.25) saturate(1.2)' },
        mystic:   { w: 18,  boost: 1.15, exp: 1.2, label: 'Mystic',   filter: 'hue-rotate(185deg) saturate(1.4) brightness(1.1)' },
        metallic: { w: 16,  boost: 1.15, exp: 1.2, label: 'Metallic', filter: 'grayscale(0.85) contrast(1.35) brightness(1.2)' },
        shadow:   { w: 6,   boost: 1.25, exp: 1.5, label: 'Shadow',   filter: 'brightness(0.3) sepia(1) hue-rotate(225deg) saturate(3)' },
    };

    function rint(n) { return Math.floor(Math.random() * n); }

    M.rollVariant = function () {
        let total = 0;
        for (const k in M.VARIANTS) total += M.VARIANTS[k].w;
        let r = rint(total);
        for (const k in M.VARIANTS) {
            r -= M.VARIANTS[k].w;
            if (r < 0) return k;
        }
        return 'normal';
    };

    // Level-up moves the species knows at `level` (last 4, deduped).
    M.movesAtLevel = function (dex, level) {
        const ls = D.learnsets[dex] || [];
        const seen = {};
        const out = [];
        for (let i = ls.length - 1; i >= 0 && out.length < 4; i--) {
            const m = ls[i];
            if (m.level <= level && !seen[m.move]) {
                seen[m.move] = 1;
                out.push(m.move);
            }
        }
        out.reverse();
        return out.length ? out : ['tackle'];
    };

    M.create = function (slug, level, opts) {
        opts = opts || {};
        const dex = D.dexBySlug[slug];
        const sp = D.species[dex];
        if (!sp) return null;
        const mon = {
            uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            slug: slug, dex: dex, level: level,
            variant: opts.variant || 'normal',
            natureIdx: rint(D.natures.length),
            ivs: { hp: rint(32), atk: rint(32), def: rint(32), spa: rint(32), spd: rint(32), spe: rint(32) },
            gender: genGender(sp.genderRatio),
            exp: D.expForLevel(sp.growthRate, level),
            status: null,           // 'paralysis'|'burn'|'poison'|'sleep'|'freeze'
            moves: M.movesAtLevel(dex, level).map(id => ({
                id: id, pp: D.moves[id].pp, maxPp: D.moves[id].pp,
            })),
        };
        mon.hp = M.stats(mon).hp;
        return mon;
    };

    function genGender(ratio) {
        if (ratio === 255) return null;                    // genderless
        if (ratio === 254) return 'F';
        if (ratio === 0) return 'M';
        return rint(254) < ratio ? 'F' : 'M';
    }

    // Gen-3+ stat formula (no EVs), nature from the decomp's verified table,
    // plus the Crater variant boost on non-HP stats.
    M.stats = function (mon) {
        const sp = D.species[mon.dex];
        const b = sp.baseStats;
        const nat = D.natures[mon.natureIdx].mults;
        const boost = M.VARIANTS[mon.variant].boost;
        const L = mon.level;
        const out = {};
        if (sp.dex === 292) out.hp = 1;                    // Shedinja
        else out.hp = Math.floor((2 * b.hp + mon.ivs.hp) * L / 100) + L + 10;
        for (const s of ['atk', 'def', 'spa', 'spd', 'spe']) {
            let v = Math.floor((2 * b[s] + mon.ivs[s]) * L / 100) + 5;
            v = Math.floor(v * (nat[s] || 1) * boost);
            out[s] = v;
        }
        return out;
    };

    M.displayName = function (mon) {
        const v = M.VARIANTS[mon.variant];
        const nm = D.species[mon.dex].name;
        return v.label ? v.label + ' ' + nm : nm;
    };

    M.heal = function (mon) {
        mon.hp = M.stats(mon).hp;
        mon.status = null;
        mon.moves.forEach(m => { m.pp = m.maxPp; });
    };

    // Exp payout for defeating `foe` (Gen 1–5 style flat formula).
    M.expGain = function (foe, isTrainer) {
        const sp = D.species[foe.dex];
        let exp = Math.floor(sp.baseExp * foe.level / 7);
        if (isTrainer) exp = Math.floor(exp * 1.5);
        exp = Math.floor(exp * M.VARIANTS[foe.variant].exp);
        return Math.max(1, exp);
    };

    // Add exp; returns events: [{type:'level', level}, {type:'learn', move},
    // {type:'evolve', intoSlug, name}] — UI decides what to prompt.
    M.gainExp = function (mon, amount) {
        const sp = D.species[mon.dex];
        const events = [];
        if (mon.level >= 100) return events;
        mon.exp += amount;
        let newLevel = D.levelFromExp(sp.growthRate, mon.exp);
        while (mon.level < newLevel) {
            const before = M.stats(mon).hp;
            mon.level++;
            const after = M.stats(mon).hp;
            mon.hp = Math.min(after, mon.hp + (after - before));  // keep damage taken
            events.push({ type: 'level', level: mon.level });
            const ls = D.learnsets[mon.dex] || [];
            for (const lm of ls) {
                if (lm.level === mon.level && !mon.moves.some(m => m.id === lm.move)) {
                    events.push({ type: 'learn', move: lm.move });
                }
            }
            const evo = M.evolutionAt(mon);
            if (evo) events.push({ type: 'evolve', intoSlug: evo.intoSlug, name: evo.name });
        }
        return events;
    };

    M.evolutionAt = function (mon) {
        const evos = D.evolutions[mon.dex];
        if (!evos) return null;
        const eligible = evos.filter(e => mon.level >= e.level);
        if (!eligible.length) return null;
        return eligible[rint(eligible.length)];
    };

    M.evolve = function (mon, intoSlug) {
        const dex = D.dexBySlug[intoSlug];
        if (!dex) return false;
        const hpBefore = M.stats(mon).hp;
        const dmg = hpBefore - mon.hp;
        mon.slug = intoSlug;
        mon.dex = dex;
        // exp curve may differ between stages; re-clamp so level is preserved
        const sp = D.species[dex];
        mon.exp = Math.max(mon.exp, D.expForLevel(sp.growthRate, mon.level));
        if (D.levelFromExp(sp.growthRate, mon.exp) > mon.level) {
            mon.exp = D.expForLevel(sp.growthRate, mon.level);
        }
        mon.hp = Math.max(1, M.stats(mon).hp - dmg);
        return true;
    };

    M.learnMove = function (mon, moveId, replaceIdx) {
        const mv = D.moves[moveId];
        if (!mv) return false;
        const entry = { id: moveId, pp: mv.pp, maxPp: mv.pp };
        if (mon.moves.length < 4) mon.moves.push(entry);
        else if (replaceIdx >= 0 && replaceIdx < 4) mon.moves[replaceIdx] = entry;
        else return false;
        return true;
    };
})();
