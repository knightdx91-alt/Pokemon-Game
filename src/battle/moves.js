// GameMoves — move definitions, type chart, learnset generation, damage calc.
window.GameMoves = (function () {
    'use strict';

    // category: 'physical' | 'special' | 'status'
    // Each move: { name, type, power, accuracy, pp, category }
    const MOVES = {
        // Universal / Normal
        tackle:      { name: 'Tackle',       type: 'Normal',   power: 40,  accuracy: 100, pp: 35, category: 'physical' },
        scratch:     { name: 'Scratch',      type: 'Normal',   power: 40,  accuracy: 100, pp: 35, category: 'physical' },
        quickattack: { name: 'Quick Attack', type: 'Normal',   power: 40,  accuracy: 100, pp: 30, category: 'physical' },
        bodyslam:    { name: 'Body Slam',    type: 'Normal',   power: 85,  accuracy: 100, pp: 15, category: 'physical' },
        hyperbeam:   { name: 'Hyper Beam',   type: 'Normal',   power: 150, accuracy: 90,  pp: 5,  category: 'special'  },
        growl:       { name: 'Growl',        type: 'Normal',   power: 0,   accuracy: 100, pp: 40, category: 'status', effect: 'atkDown' },
        tailwhip:    { name: 'Tail Whip',    type: 'Normal',   power: 0,   accuracy: 100, pp: 30, category: 'status', effect: 'defDown' },
        // Fire
        ember:       { name: 'Ember',        type: 'Fire',     power: 40,  accuracy: 100, pp: 25, category: 'special'  },
        flamethrower:{ name: 'Flamethrower', type: 'Fire',     power: 90,  accuracy: 100, pp: 15, category: 'special'  },
        fireblast:   { name: 'Fire Blast',   type: 'Fire',     power: 110, accuracy: 85,  pp: 5,  category: 'special'  },
        // Water
        watergun:    { name: 'Water Gun',    type: 'Water',    power: 40,  accuracy: 100, pp: 25, category: 'special'  },
        bubblebeam:  { name: 'Bubble Beam',  type: 'Water',    power: 65,  accuracy: 100, pp: 20, category: 'special'  },
        surf:        { name: 'Surf',         type: 'Water',    power: 90,  accuracy: 100, pp: 15, category: 'special'  },
        // Grass
        vinewhip:    { name: 'Vine Whip',    type: 'Grass',    power: 45,  accuracy: 100, pp: 25, category: 'physical' },
        razorleaf:   { name: 'Razor Leaf',   type: 'Grass',    power: 55,  accuracy: 95,  pp: 25, category: 'physical' },
        solarbeam:   { name: 'Solar Beam',   type: 'Grass',    power: 120, accuracy: 100, pp: 10, category: 'special'  },
        // Electric
        thundershock:{ name: 'Thunder Shock',type: 'Electric', power: 40,  accuracy: 100, pp: 30, category: 'special'  },
        thunderbolt: { name: 'Thunderbolt',  type: 'Electric', power: 90,  accuracy: 100, pp: 15, category: 'special'  },
        thunder:     { name: 'Thunder',      type: 'Electric', power: 110, accuracy: 70,  pp: 10, category: 'special'  },
        // Ice
        icebeam:     { name: 'Ice Beam',     type: 'Ice',      power: 90,  accuracy: 100, pp: 10, category: 'special'  },
        aurorabeam:  { name: 'Aurora Beam',  type: 'Ice',      power: 65,  accuracy: 100, pp: 20, category: 'special'  },
        // Fighting
        karatechop:  { name: 'Karate Chop',  type: 'Fighting', power: 50,  accuracy: 100, pp: 25, category: 'physical' },
        submission:  { name: 'Submission',   type: 'Fighting', power: 80,  accuracy: 80,  pp: 20, category: 'physical' },
        // Poison
        poisonsting: { name: 'Poison Sting', type: 'Poison',   power: 15,  accuracy: 100, pp: 35, category: 'physical' },
        sludge:      { name: 'Sludge',       type: 'Poison',   power: 65,  accuracy: 100, pp: 20, category: 'special'  },
        // Ground
        mudslap:     { name: 'Mud-Slap',     type: 'Ground',   power: 20,  accuracy: 100, pp: 10, category: 'special'  },
        earthquake:  { name: 'Earthquake',   type: 'Ground',   power: 100, accuracy: 100, pp: 10, category: 'physical' },
        // Flying
        gust:        { name: 'Gust',         type: 'Flying',   power: 40,  accuracy: 100, pp: 35, category: 'special'  },
        wingattack:  { name: 'Wing Attack',  type: 'Flying',   power: 60,  accuracy: 100, pp: 35, category: 'physical' },
        drillpeck:   { name: 'Drill Peck',   type: 'Flying',   power: 80,  accuracy: 100, pp: 20, category: 'physical' },
        // Psychic
        confusion:   { name: 'Confusion',    type: 'Psychic',  power: 50,  accuracy: 100, pp: 25, category: 'special'  },
        psychic:     { name: 'Psychic',      type: 'Psychic',  power: 90,  accuracy: 100, pp: 10, category: 'special'  },
        // Bug
        struggbug:   { name: 'Struggle Bug', type: 'Bug',      power: 30,  accuracy: 100, pp: 20, category: 'special'  },
        megadrain:   { name: 'Mega Drain',   type: 'Grass',    power: 40,  accuracy: 100, pp: 15, category: 'special'  },
        pinmissile:  { name: 'Pin Missile',  type: 'Bug',      power: 25,  accuracy: 95,  pp: 20, category: 'physical' },
        // Rock
        rockthrow:   { name: 'Rock Throw',   type: 'Rock',     power: 50,  accuracy: 90,  pp: 15, category: 'physical' },
        rockslide:   { name: 'Rock Slide',   type: 'Rock',     power: 75,  accuracy: 90,  pp: 10, category: 'physical' },
        // Ghost
        lick:        { name: 'Lick',         type: 'Ghost',    power: 30,  accuracy: 100, pp: 30, category: 'physical' },
        shadowball:  { name: 'Shadow Ball',  type: 'Ghost',    power: 80,  accuracy: 100, pp: 15, category: 'special'  },
        // Dragon
        dragonrage:  { name: 'Dragon Rage',  type: 'Dragon',   power: 50,  accuracy: 100, pp: 10, category: 'special'  },
        // Fairy (unused by Gen1 mons but supported)
        fairywind:   { name: 'Fairy Wind',   type: 'Fairy',    power: 40,  accuracy: 100, pp: 30, category: 'special'  }
    };

    // Best STAB attacking move per type, keyed by tier (low/mid/high level).
    const TYPE_MOVES = {
        Normal:   ['tackle', 'bodyslam', 'hyperbeam'],
        Fire:     ['ember', 'flamethrower', 'fireblast'],
        Water:    ['watergun', 'bubblebeam', 'surf'],
        Grass:    ['vinewhip', 'razorleaf', 'solarbeam'],
        Electric: ['thundershock', 'thunderbolt', 'thunder'],
        Ice:      ['aurorabeam', 'icebeam', 'icebeam'],
        Fighting: ['karatechop', 'submission', 'submission'],
        Poison:   ['poisonsting', 'sludge', 'sludge'],
        Ground:   ['mudslap', 'earthquake', 'earthquake'],
        Flying:   ['gust', 'wingattack', 'drillpeck'],
        Psychic:  ['confusion', 'psychic', 'psychic'],
        Bug:      ['struggbug', 'pinmissile', 'megadrain'],
        Rock:     ['rockthrow', 'rockslide', 'rockslide'],
        Ghost:    ['lick', 'shadowball', 'shadowball'],
        Dragon:   ['dragonrage', 'dragonrage', 'dragonrage'],
        Fairy:    ['fairywind', 'fairywind', 'fairywind']
    };

    // Type effectiveness chart. chart[attacker][defender] = multiplier.
    const T = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Fairy'];
    // rows = attacking type. 0=0x,0.5=half,1=neutral,2=super.
    const CHART = {
        Normal:   { Rock:0.5, Ghost:0, Steel:0.5 },
        Fire:     { Fire:0.5, Water:0.5, Grass:2, Ice:2, Bug:2, Rock:0.5, Dragon:0.5 },
        Water:    { Fire:2, Water:0.5, Grass:0.5, Ground:2, Rock:2, Dragon:0.5 },
        Electric: { Water:2, Electric:0.5, Grass:0.5, Ground:0, Flying:2, Dragon:0.5 },
        Grass:    { Fire:0.5, Water:2, Grass:0.5, Poison:0.5, Ground:2, Flying:0.5, Bug:0.5, Rock:2, Dragon:0.5 },
        Ice:      { Fire:0.5, Water:0.5, Grass:2, Ice:0.5, Ground:2, Flying:2, Dragon:2 },
        Fighting: { Normal:2, Ice:2, Poison:0.5, Flying:0.5, Psychic:0.5, Bug:0.5, Rock:2, Ghost:0, Fairy:0.5, Dark:2 },
        Poison:   { Grass:2, Poison:0.5, Ground:0.5, Rock:0.5, Ghost:0.5, Fairy:2 },
        Ground:   { Fire:2, Electric:2, Grass:0.5, Poison:2, Flying:0, Bug:0.5, Rock:2 },
        Flying:   { Electric:0.5, Grass:2, Fighting:2, Bug:2, Rock:0.5 },
        Psychic:  { Fighting:2, Poison:2, Psychic:0.5, Dark:0 },
        Bug:      { Fire:0.5, Grass:2, Fighting:0.5, Poison:0.5, Flying:0.5, Psychic:2, Ghost:0.5, Fairy:0.5, Dark:2 },
        Rock:     { Fire:2, Ice:2, Fighting:0.5, Ground:0.5, Flying:2, Bug:2 },
        Ghost:    { Normal:0, Psychic:2, Ghost:2, Dark:0.5 },
        Dragon:   { Dragon:2, Fairy:0 },
        Fairy:    { Fire:0.5, Fighting:2, Poison:0.5, Dragon:2, Dark:2 }
    };

    function effectiveness(moveType, defenderTypes) {
        let mult = 1;
        const row = CHART[moveType] || {};
        for (const dt of defenderTypes) {
            if (row[dt] !== undefined) mult *= row[dt];
        }
        return mult;
    }

    /** Build a level-up learnset for a species given its types.
     *  Returns array of { level, move } sorted by level. */
    function buildLearnset(types) {
        const set = [];
        // Level 1 basics
        set.push({ level: 1, move: types[0] && TYPE_MOVES[types[0]] ? TYPE_MOVES[types[0]][0] : 'tackle' });
        set.push({ level: 1, move: 'tackle' });
        // Primary type progression
        const primary = types[0];
        if (TYPE_MOVES[primary]) {
            set.push({ level: 7,  move: TYPE_MOVES[primary][0] });
            set.push({ level: 20, move: TYPE_MOVES[primary][1] });
            set.push({ level: 38, move: TYPE_MOVES[primary][2] });
        }
        // Secondary type coverage
        const secondary = types[1];
        if (secondary && TYPE_MOVES[secondary]) {
            set.push({ level: 13, move: TYPE_MOVES[secondary][0] });
            set.push({ level: 30, move: TYPE_MOVES[secondary][1] });
        }
        set.push({ level: 15, move: 'quickattack' });
        // de-dup by move, keep earliest level
        const seen = {};
        const dedup = [];
        for (const e of set.sort((a, b) => a.level - b.level)) {
            if (seen[e.move]) continue;
            seen[e.move] = true;
            dedup.push(e);
        }
        return dedup.sort((a, b) => a.level - b.level);
    }

    /** Moves a species of these types knows at a given level (last 4 learned). */
    function movesAtLevel(types, level) {
        const learn = buildLearnset(types).filter(e => e.level <= level);
        const names = learn.map(e => e.move);
        // keep the last 4 unique
        const last4 = names.slice(-4);
        if (last4.length === 0) last4.push('tackle');
        return last4.map(m => ({ id: m, pp: MOVES[m].pp, maxPp: MOVES[m].pp }));
    }

    /** Damage calculation (simplified Gen-style). Returns {damage, effectiveness, crit}. */
    function calcDamage(attacker, defender, move) {
        const m = MOVES[move];
        if (!m || m.category === 'status' || m.power === 0) {
            return { damage: 0, effectiveness: 1, crit: false, status: m ? m.effect : null };
        }
        const eff = effectiveness(m.type, defender.types);
        if (eff === 0) return { damage: 0, effectiveness: 0, crit: false };

        const isPhysical = m.category === 'physical';
        const atk = isPhysical ? attacker.stats.attack : attacker.stats.spAttack;
        const def = isPhysical ? defender.stats.defense : defender.stats.spDefense;
        const level = attacker.level;
        const stab = attacker.types.includes(m.type) ? 1.5 : 1;
        const crit = Math.random() < 0.0625 ? 2 : 1;
        const rand = 0.85 + Math.random() * 0.15;

        let dmg = (((2 * level / 5 + 2) * m.power * (atk / Math.max(1, def))) / 50 + 2);
        dmg = dmg * stab * eff * crit * rand;
        return { damage: Math.max(1, Math.floor(dmg)), effectiveness: eff, crit: crit > 1 };
    }

    return {
        MOVES,
        TYPE_MOVES,
        effectiveness,
        buildLearnset,
        movesAtLevel,
        calcDamage,
        get: function (id) { return MOVES[id]; }
    };
})();
