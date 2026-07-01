// GamePokedex — species data, Pokémon instance creation, stat & exp math.
window.GamePokedex = (function () {
    'use strict';

    let _dex = null;         // { dexNum: speciesData }
    let _byId = null;        // { SPECIES_ID / ID : speciesData }

    async function init() {
        if (_dex) return;
        const resp = await fetch('data/pokedex.json');
        _dex = await resp.json();
        _byId = {};
        for (const k of Object.keys(_dex)) {
            const s = _dex[k];
            _byId[s.id] = s;
            _byId['SPECIES_' + s.id] = s;
        }
        console.log('[Pokedex] Loaded', Object.keys(_dex).length, 'species');
    }

    function species(ref) {
        if (typeof ref === 'number') return _dex[ref] || null;
        if (typeof ref === 'string') {
            if (_byId[ref]) return _byId[ref];
            const up = ref.toUpperCase();
            return _byId[up] || _byId['SPECIES_' + up] || null;
        }
        return null;
    }

    function spriteFront(dex) { return `data/sprites/pokemon/${dex}.png`; }
    function spriteBack(dex)  { return `data/sprites/pokemon/back/${dex}.png`; }

    // Medium-fast growth: exp needed to *reach* level L = L^3
    function expForLevel(level) { return level * level * level; }

    /** Compute a stat at a level (simplified: no IV/EV, flat). */
    function statAt(base, level, isHp) {
        if (isHp) return Math.floor((2 * base * level) / 100) + level + 10;
        return Math.floor((2 * base * level) / 100) + 5;
    }

    /** Create a fresh Pokémon instance from a species ref + level. */
    function create(ref, level) {
        const sp = species(ref);
        if (!sp) { console.warn('[Pokedex] Unknown species:', ref); return null; }
        level = Math.max(1, level | 0);
        const maxHp = statAt(sp.stats.hp, level, true);
        const moves = GameMoves.movesAtLevel(sp.types, level);
        return {
            dex: sp.dex,
            id: sp.id,
            name: sp.name,
            types: sp.types.slice(),
            level: level,
            exp: expForLevel(level),
            catchRate: sp.catchRate,
            baseExp: sp.baseExp,
            stats: {
                maxHp: maxHp,
                attack:    statAt(sp.stats.attack, level),
                defense:   statAt(sp.stats.defense, level),
                spAttack:  statAt(sp.stats.spAttack, level),
                spDefense: statAt(sp.stats.spDefense, level),
                speed:     statAt(sp.stats.speed, level)
            },
            hp: maxHp,
            moves: moves,
            status: null
        };
    }

    /** Recompute stats after a level change, preserving current HP ratio. */
    function recomputeStats(mon) {
        const sp = species(mon.dex);
        if (!sp) return;
        const ratio = mon.hp / mon.stats.maxHp;
        const newMax = statAt(sp.stats.hp, mon.level, true);
        mon.stats = {
            maxHp: newMax,
            attack:    statAt(sp.stats.attack, mon.level),
            defense:   statAt(sp.stats.defense, mon.level),
            spAttack:  statAt(sp.stats.spAttack, mon.level),
            spDefense: statAt(sp.stats.spDefense, mon.level),
            speed:     statAt(sp.stats.speed, mon.level)
        };
        mon.hp = Math.max(1, Math.round(newMax * ratio));
    }

    /** Add exp; returns array of levels gained (with any newly learned moves). */
    function gainExp(mon, amount) {
        const events = [];
        mon.exp += amount;
        while (mon.level < 100 && mon.exp >= expForLevel(mon.level + 1)) {
            mon.level++;
            recomputeStats(mon);
            // learn any new moves at this level
            const learn = GameMoves.buildLearnset(mon.types).filter(e => e.level === mon.level);
            const learned = [];
            for (const e of learn) {
                if (mon.moves.some(m => m.id === e.move)) continue;
                const mv = { id: e.move, pp: GameMoves.get(e.move).pp, maxPp: GameMoves.get(e.move).pp };
                if (mon.moves.length < 4) { mon.moves.push(mv); learned.push(e.move); }
                else { mon.moves.shift(); mon.moves.push(mv); learned.push(e.move); }
            }
            events.push({ level: mon.level, learned });
        }
        return events;
    }

    return {
        init, species, create, recomputeStats, gainExp,
        expForLevel, spriteFront, spriteBack,
        get all() { return _dex; }
    };
})();
