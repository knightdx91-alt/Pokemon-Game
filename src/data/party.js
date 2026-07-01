// GameParty — player party, bag, money, and Pokédex progress. Self-persisting.
window.GameParty = (function () {
    'use strict';

    const KEY = 'pokemon_crater_save_v1';

    let state = null;

    function _default() {
        return {
            starterChosen: false,
            party: [],                 // array of Pokémon instances (max 6)
            box: [],                   // overflow storage
            bag: { pokeball: 5, greatball: 0, ultraball: 0, potion: 3, superpotion: 0 },
            money: 3000,
            seen: [],                  // dex numbers
            caught: []                 // dex numbers
        };
    }

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            state = raw ? Object.assign(_default(), JSON.parse(raw)) : _default();
        } catch (e) {
            state = _default();
        }
        return state;
    }

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(state)); }
        catch (e) { console.warn('[Party] save failed', e); }
    }

    function reset() { state = _default(); save(); }

    // --- Party ops ---
    function party() { return state.party; }
    function money() { return state.money; }
    function bag()   { return state.bag; }

    function addMoney(n) { state.money = Math.max(0, state.money + n); save(); }

    function markSeen(dex) {
        if (!state.seen.includes(dex)) { state.seen.push(dex); save(); }
    }
    function markCaught(dex) {
        markSeen(dex);
        if (!state.caught.includes(dex)) { state.caught.push(dex); save(); }
    }

    /** Add a Pokémon to party (or box if full). Returns 'party' | 'box'. */
    function addPokemon(mon) {
        markCaught(mon.dex);
        if (state.party.length < 6) { state.party.push(mon); save(); return 'party'; }
        state.box.push(mon); save(); return 'box';
    }

    function firstHealthyIndex() {
        return state.party.findIndex(p => p.hp > 0);
    }
    function allFainted() {
        return state.party.length === 0 || state.party.every(p => p.hp <= 0);
    }
    function healAll() {
        for (const p of state.party) {
            p.hp = p.stats.maxHp;
            p.status = null;
            for (const m of p.moves) m.pp = m.maxPp;
        }
        save();
    }

    function useItem(item, mon) {
        if ((state.bag[item] || 0) <= 0) return false;
        let ok = false;
        if (item === 'potion')      { mon.hp = Math.min(mon.stats.maxHp, mon.hp + 20); ok = true; }
        else if (item === 'superpotion') { mon.hp = Math.min(mon.stats.maxHp, mon.hp + 50); ok = true; }
        if (ok) { state.bag[item]--; save(); }
        return ok;
    }

    return {
        load, save, reset,
        get state() { return state; },
        party, money, bag, addMoney,
        markSeen, markCaught, addPokemon,
        firstHealthyIndex, allFainted, healAll, useItem
    };
})();
