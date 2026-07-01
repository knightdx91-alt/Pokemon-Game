// GameEncounters — wild encounter tables (Kanto) + weighted picking.
window.GameEncounters = (function () {
    'use strict';

    let _byMap = null;   // { MAP_ID: { rate, mons:[{min,max,species}] } }

    // Slot weights for the 12 land encounter slots (FireRed land rates).
    const LAND_WEIGHTS = [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1];

    async function init() {
        if (_byMap) return;
        _byMap = {};
        try {
            const resp = await fetch('data/encounters/kanto.json');
            const data = await resp.json();
            const group = (data.wild_encounter_groups || []).find(g => g.for_maps) || data.wild_encounter_groups[0];
            const encounters = (group && group.encounters) || [];
            for (const e of encounters) {
                if (!e.land_mons || !e.land_mons.mons) continue;
                _byMap[e.map] = {
                    rate: e.land_mons.encounter_rate || 20,
                    mons: e.land_mons.mons.map(m => ({
                        min: m.min_level, max: m.max_level, species: m.species
                    }))
                };
            }
            console.log('[Encounters] Loaded tables for', Object.keys(_byMap).length, 'maps');
        } catch (err) {
            console.warn('[Encounters] Failed to load kanto.json:', err);
        }
    }

    function hasEncounters(mapId) {
        return !!(_byMap && _byMap[mapId]);
    }

    /** Distinct species (SPECIES_* ids) that appear on the given map, or []. */
    function speciesFor(mapId) {
        const t = _byMap && _byMap[mapId];
        if (!t) return [];
        return Array.from(new Set(t.mons.map(m => m.species)));
    }

    /** Per-grass-step probability (0..1) that an encounter triggers. */
    function stepChance(mapId) {
        if (!_byMap || !_byMap[mapId]) return 0;
        // Scale the map's encounter_rate into a reasonable per-step chance.
        return Math.min(0.20, 0.06 + (_byMap[mapId].rate / 255) * 0.18);
    }

    /** Roll a wild Pokémon for the given map, or null. */
    function roll(mapId) {
        const table = _byMap && _byMap[mapId];
        if (!table || !table.mons.length) return null;
        // weighted slot selection
        let total = 0;
        const weights = table.mons.map((_, i) => LAND_WEIGHTS[i] || 1);
        weights.forEach(w => total += w);
        let r = Math.random() * total;
        let idx = 0;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) { idx = i; break; }
        }
        const slot = table.mons[idx];
        const level = slot.min + Math.floor(Math.random() * (slot.max - slot.min + 1));
        return GamePokedex.create(slot.species, level);
    }

    return { init, hasEncounters, speciesFor, stepChance, roll };
})();
