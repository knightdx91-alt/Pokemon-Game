// Pokémon Crater clone — trainer state, save/load, zone spawning, progression.
// Exposes window.CraterGame. Save lives in localStorage 'crater_save_v1'.
(function () {
    'use strict';
    const D = window.CraterData;
    const M = window.CraterMon;

    const SAVE_KEY = 'crater_save_v1';
    const G = { state: null };
    window.CraterGame = G;

    function rint(n) { return Math.floor(Math.random() * n); }

    G.newGame = function (name, starterSlug) {
        G.state = {
            v: 1,
            name: name || 'Trainer',
            money: 3000,
            party: [],
            box: [],
            items: { poke_ball: 10, potion: 5 },
            dex: { seen: {}, caught: {} },
            gymsBeaten: {},          // gymId -> true
            wins: 0, losses: 0, catches: 0,
            started: Date.now(),
        };
        const starter = M.create(starterSlug, 5);
        G.state.party.push(starter);
        G.markCaught(starterSlug);
        G.save();
        return starter;
    };

    G.save = function () {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); }
        catch (e) { console.warn('save failed', e); }
    };

    G.load = function () {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return false;
            G.state = JSON.parse(raw);
            return !!(G.state && G.state.party && G.state.party.length);
        } catch (e) { return false; }
    };

    G.clearSave = function () {
        localStorage.removeItem(SAVE_KEY);
        G.state = null;
    };

    G.markSeen = function (slug) {
        if (G.state) G.state.dex.seen[slug] = 1;
    };
    G.markCaught = function (slug) {
        if (G.state) { G.state.dex.seen[slug] = 1; G.state.dex.caught[slug] = 1; }
    };
    G.dexCounts = function () {
        return {
            seen: Object.keys(G.state.dex.seen).length,
            caught: Object.keys(G.state.dex.caught).length,
        };
    };

    // Party of 6, overflow to box.
    G.addMon = function (mon) {
        G.markCaught(mon.slug);
        G.state.catches++;
        if (G.state.party.length < 6) { G.state.party.push(mon); return 'party'; }
        G.state.box.push(mon); return 'box';
    };

    G.healTeam = function () {
        G.state.party.forEach(M.heal);
    };

    G.badgeCount = function () {
        let n = 0;
        for (const g of D.GYMS) if (g.badge && G.state.gymsBeaten[g.id]) n++;
        return n;
    };

    // Gyms unlock strictly in order.
    G.gymUnlocked = function (idx) {
        for (let i = 0; i < idx; i++) if (!G.state.gymsBeaten[D.GYMS[i].id]) return false;
        return true;
    };

    G.zoneUnlocked = function (zone) {
        if (zone.special) return G.badgeCount() >= 8;
        return true;
    };

    // ------------------------------------------------------------ spawning --
    // Roll one species from the zone's weighted pool (or rares at 2% a slot).
    function rollPool(zone) {
        if (zone.rares && zone.rares.length && Math.random() < 0.02) {
            const r = zone.rares[rint(zone.rares.length)];
            return { slug: r[0], level: r[1] + rint(5) - 2, rare: true };
        }
        let total = 0;
        for (const p of zone.pool) total += p[3];
        let roll = Math.random() * total;
        for (const p of zone.pool) {
            roll -= p[3];
            if (roll < 0) {
                const lv = p[1] + rint(p[2] - p[1] + 1);
                return { slug: p[0], level: Math.max(1, lv), rare: false };
            }
        }
        const p = zone.pool[0];
        return { slug: p[0], level: p[1], rare: false };
    }

    // 6 wild spawns with positions for the zone screen.
    G.spawnZone = function (zoneId) {
        const zone = D.zones.zones[zoneId];
        const count = zone.special ? 3 : 6;
        const spawns = [];
        for (let i = 0; i < count; i++) {
            const roll = rollPool(zone);
            spawns.push({
                slug: roll.slug,
                level: Math.min(100, Math.max(1, roll.level)),
                variant: M.rollVariant(),
                rare: roll.rare,
                x: 6 + (i % 3) * 31 + rint(8),          // % coords in the field
                y: 8 + Math.floor(i / 3) * 42 + rint(12),
            });
        }
        return spawns;
    };

    G.zoneLevelRange = function (zone) {
        let lo = 100, hi = 1;
        for (const p of zone.pool) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[2]); }
        return [lo, hi];
    };

    // ---------------------------------------------------------- economy -----
    G.wildPrize = function (foe) { return 12 * foe.level + rint(20); };

    G.canAfford = function (itemId, qty) {
        return G.state.money >= D.ITEMS[itemId].price * qty;
    };
    G.buy = function (itemId, qty) {
        const cost = D.ITEMS[itemId].price * qty;
        if (G.state.money < cost) return false;
        G.state.money -= cost;
        G.state.items[itemId] = (G.state.items[itemId] || 0) + qty;
        G.save();
        return true;
    };
    G.useItem = function (itemId) {
        if (!G.state.items[itemId] || G.state.items[itemId] <= 0) return false;
        G.state.items[itemId]--;
        return true;
    };

    // Build a gym leader's team as live mons (fresh each attempt).
    G.gymTeam = function (gym) {
        return gym.team.map(([slug, lv]) => M.create(slug, lv));
    };
})();
