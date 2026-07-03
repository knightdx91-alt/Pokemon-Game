// Pokémon Crater clone — data layer.
// Loads the repo's real extracted game data (USUM decomp jsons + FireRed/HnS/
// Emerald/Platinum encounter zones from zones_gen.js) and exposes lookups.
// Plain globals, no build system — window.CraterData.
(function () {
    'use strict';

    const D = {
        ready: null,          // Promise resolved when all data is loaded
        species: {},          // dex -> {dex,name,slug,baseStats,types,catchRate,baseExp,growthRate,genderRatio}
        dexBySlug: {},        // slug -> dex
        moves: {},            // slug -> move record
        learnsets: {},        // dex -> [{level, move, name}]
        evolutions: {},       // dex -> [{intoSlug, name, level}]
        typeChart: null,      // [atk][def] -> 0/2/4/8 (÷4 = multiplier)
        typeIndex: {},        // 'Fire' -> row index
        natures: [],          // [{name, mults:{atk,def,spa,spd,spe}}]
        zones: null,          // from zones_gen.js
        MAX_DEX: 493,         // sprite-backed species (Gen 1–4)
    };
    window.CraterData = D;

    // ---- name -> sprite-slug (matches data/sprites/pokemon/*/<slug>.png) ----
    D.slugify = function (name) {
        return name.toLowerCase()
            .replace(/['’.]/g, '')
            .replace(/[:\s-]+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    };

    D.sprite = function (slug, kind) {   // kind: front|back|icons
        return 'data/sprites/pokemon/' + kind + '/' + slug + '.png';
    };

    // ------------------------------- exp growth curves (levels 1..100) ------
    function expMediumFast(n) { return n * n * n; }
    function expFast(n) { return Math.floor(4 * n * n * n / 5); }
    function expSlow(n) { return Math.floor(5 * n * n * n / 4); }
    function expMediumSlow(n) { return Math.max(0, Math.floor(6 / 5 * n * n * n) - 15 * n * n + 100 * n - 140); }
    function expErratic(n) {
        if (n <= 50) return Math.floor(n * n * n * (100 - n) / 50);
        if (n <= 68) return Math.floor(n * n * n * (150 - n) / 100);
        if (n <= 98) return Math.floor(n * n * n * Math.floor((1911 - 10 * n) / 3) / 500);
        return Math.floor(n * n * n * (160 - n) / 100);
    }
    function expFluctuating(n) {
        if (n <= 15) return Math.floor(n * n * n * (Math.floor((n + 1) / 3) + 24) / 50);
        if (n <= 36) return Math.floor(n * n * n * (n + 14) / 50);
        return Math.floor(n * n * n * (Math.floor(n / 2) + 32) / 50);
    }
    const CURVES = {
        MediumFast: expMediumFast, Fast: expFast, Slow: expSlow,
        MediumSlow: expMediumSlow, Erratic: expErratic, Fluctuating: expFluctuating,
    };
    D.expForLevel = function (rate, level) {
        if (level <= 1) return 0;
        return (CURVES[rate] || expMediumFast)(Math.min(100, level));
    };
    D.levelFromExp = function (rate, exp) {
        let lv = 1;
        while (lv < 100 && D.expForLevel(rate, lv + 1) <= exp) lv++;
        return lv;
    };

    // ------------------------------------------------ type effectiveness ----
    D.effectiveness = function (atkType, defTypes) {
        if (!D.typeChart) return 1;
        const ai = D.typeIndex[atkType];
        if (ai === undefined) return 1;
        let mult = 1;
        for (const t of defTypes) {
            const di = D.typeIndex[t];
            if (di !== undefined) mult *= D.typeChart[ai][di] / 4;
        }
        return mult;
    };

    // ------------------------------------------------------- evolutions -----
    // Crater-style: everything evolves by level. Non-level methods get preset
    // level thresholds so stone/trade/friendship lines stay obtainable.
    function evoLevel(ev) {
        if (ev.level) return ev.level;
        const m = ev.methodName || '';
        if (m.indexOf('Friendship') >= 0 || m.indexOf('Affection') >= 0) return 25;
        if (m.indexOf('Trade') >= 0) return 36;
        if (m.indexOf('UseItem') >= 0) return 30;
        return 32;
    }

    // ----------------------------------------------------------- loading ----
    function getJSON(url) {
        return fetch(url).then(r => {
            if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
            return r.json();
        });
    }

    D.ready = Promise.all([
        getJSON('data/pokemon/usum_base_stats.json'),
        getJSON('data/pokemon/usum_moves.json'),
        getJSON('data/pokemon/usum_learnsets.json'),
        getJSON('data/pokemon/usum_evolutions.json'),
        getJSON('decomp/data/type_chart.json'),
        getJSON('decomp/data/nature_table.json'),
    ]).then(function (res) {
        const [stats, moves, learnsets, evos, chart, natures] = res;

        for (const dexStr in stats) {
            const dex = parseInt(dexStr, 10);
            if (!dex || dex > D.MAX_DEX) continue;
            const s = stats[dexStr];
            let slug = D.slugify(s.name);
            if (dex === 29) slug = 'nidoran_f';
            if (dex === 32) slug = 'nidoran_m';
            D.species[dex] = {
                dex: dex, name: s.name, slug: slug,
                baseStats: s.baseStats, types: s.types,
                catchRate: s.catchRate, baseExp: s.baseExp,
                growthRate: s.growthRate, genderRatio: s.genderRatio,
            };
            D.dexBySlug[slug] = dex;
        }

        D.moves = moves;
        for (const dexStr in learnsets) {
            const dex = parseInt(dexStr, 10);
            if (!dex || dex > D.MAX_DEX) continue;
            D.learnsets[dex] = learnsets[dexStr].filter(m => moves[m.move]);
        }
        for (const dexStr in evos) {
            const dex = parseInt(dexStr, 10);
            if (!dex || dex > D.MAX_DEX) continue;
            const out = [];
            const seen = {};
            for (const ev of evos[dexStr]) {
                if (!D.dexBySlug[ev.into] || seen[ev.into]) continue; // sprite-backed only
                seen[ev.into] = 1;
                out.push({ intoSlug: ev.into, name: ev.name, level: evoLevel(ev) });
            }
            if (out.length) D.evolutions[dex] = out;
        }

        D.typeChart = chart.chart;
        chart.types.forEach((t, i) => { D.typeIndex[t] = i; });

        const cols = natures.columns.map(c => c.toLowerCase()); // atk,def,spa,spd,spe
        D.natures = natures.natures.map(function (name, i) {
            const mults = {};
            cols.forEach((c, j) => { mults[c] = 1 + 0.1 * natures.table[i][j]; });
            return { name: name, mults: mults };
        });

        D.zones = window.CRATER_ZONES;
        return D;
    });

    // ------------------------------------------------------ static defs -----
    D.STARTERS = [
        'bulbasaur', 'charmander', 'squirtle',
        'chikorita', 'cyndaquil', 'totodile',
        'treecko', 'torchic', 'mudkip',
        'turtwig', 'chimchar', 'piplup',
        'pikachu', 'eevee',
    ];

    D.ITEMS = {
        poke_ball:   { name: 'Poké Ball',    kind: 'ball',   price: 200,   mult: 1.0, icon: '◓' },
        great_ball:  { name: 'Great Ball',   kind: 'ball',   price: 600,   mult: 1.5, icon: '◓' },
        ultra_ball:  { name: 'Ultra Ball',   kind: 'ball',   price: 1200,  mult: 2.0, icon: '◓' },
        master_ball: { name: 'Master Ball',  kind: 'ball',   price: 50000, mult: 255, icon: '◓' },
        potion:       { name: 'Potion',       kind: 'heal',  price: 300,  heal: 20,  icon: '🧪' },
        super_potion: { name: 'Super Potion', kind: 'heal',  price: 700,  heal: 60,  icon: '🧪' },
        hyper_potion: { name: 'Hyper Potion', kind: 'heal',  price: 1500, heal: 120, icon: '🧪' },
        max_potion:   { name: 'Max Potion',   kind: 'heal',  price: 2500, heal: 9999, icon: '🧪' },
        full_heal:    { name: 'Full Heal',    kind: 'cure',  price: 600,  icon: '✚' },
        revive:       { name: 'Revive',       kind: 'revive', price: 1500, icon: '💎' },
    };

    D.GYMS = [
        { id: 'brock',    name: 'Brock',    title: 'Pewter Gym',    badge: 'Boulder Badge', type: 'Rock',
          team: [['geodude', 12], ['onix', 14]], reward: 1400 },
        { id: 'misty',    name: 'Misty',    title: 'Cerulean Gym',  badge: 'Cascade Badge', type: 'Water',
          team: [['staryu', 18], ['starmie', 21]], reward: 2100 },
        { id: 'surge',    name: 'Lt. Surge', title: 'Vermilion Gym', badge: 'Thunder Badge', type: 'Electric',
          team: [['voltorb', 21], ['pikachu', 18], ['raichu', 24]], reward: 2400 },
        { id: 'erika',    name: 'Erika',    title: 'Celadon Gym',   badge: 'Rainbow Badge', type: 'Grass',
          team: [['victreebel', 29], ['tangela', 24], ['vileplume', 29]], reward: 2900 },
        { id: 'koga',     name: 'Koga',     title: 'Fuchsia Gym',   badge: 'Soul Badge', type: 'Poison',
          team: [['koffing', 37], ['muk', 39], ['koffing', 37], ['weezing', 43]], reward: 4300 },
        { id: 'sabrina',  name: 'Sabrina',  title: 'Saffron Gym',   badge: 'Marsh Badge', type: 'Psychic',
          team: [['kadabra', 38], ['mr_mime', 37], ['venomoth', 38], ['alakazam', 43]], reward: 4300 },
        { id: 'blaine',   name: 'Blaine',   title: 'Cinnabar Gym',  badge: 'Volcano Badge', type: 'Fire',
          team: [['growlithe', 42], ['ponyta', 40], ['rapidash', 42], ['arcanine', 47]], reward: 4700 },
        { id: 'giovanni', name: 'Giovanni', title: 'Viridian Gym',  badge: 'Earth Badge', type: 'Ground',
          team: [['rhyhorn', 45], ['dugtrio', 42], ['nidoqueen', 44], ['nidoking', 45], ['rhydon', 50]], reward: 5000 },
        { id: 'lorelei',  name: 'Lorelei',  title: 'Elite Four',    badge: null, type: 'Ice', elite: true,
          team: [['dewgong', 52], ['cloyster', 51], ['slowbro', 52], ['jynx', 54], ['lapras', 54]], reward: 8000 },
        { id: 'bruno',    name: 'Bruno',    title: 'Elite Four',    badge: null, type: 'Fighting', elite: true,
          team: [['onix', 51], ['hitmonchan', 53], ['hitmonlee', 53], ['onix', 54], ['machamp', 56]], reward: 8400 },
        { id: 'agatha',   name: 'Agatha',   title: 'Elite Four',    badge: null, type: 'Ghost', elite: true,
          team: [['gengar', 54], ['golbat', 54], ['haunter', 53], ['arbok', 56], ['gengar', 58]], reward: 8800 },
        { id: 'lance',    name: 'Lance',    title: 'Elite Four',    badge: null, type: 'Dragon', elite: true,
          team: [['gyarados', 56], ['dragonair', 54], ['dragonair', 54], ['aerodactyl', 58], ['dragonite', 60]], reward: 9600 },
        { id: 'champion', name: 'Champion Blue', title: 'Pokémon League', badge: 'Champion', type: null, elite: true,
          team: [['pidgeot', 59], ['alakazam', 57], ['rhydon', 59], ['gyarados', 61], ['arcanine', 61], ['venusaur', 63]], reward: 20000 },
    ];
})();
