// GameMap — loads and manages map data
window.GameMap = (function () {
    const DEFAULT_SIZE = 20;

    let current = null;
    let mapWidth = DEFAULT_SIZE;
    let mapHeight = DEFAULT_SIZE;

    // Returns tile data at (x, y) — currently no tile layer, returns a generic object
    function getTile(x, y) {
        if (!current) return null;
        if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return null;
        return { x, y };
    }

    // Returns true if the tile is walkable
    function isWalkable(x, y) {
        if (!current) return false;
        // Map boundary is not walkable
        if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return false;
        // Warp tiles are walkable (player steps on them to trigger)
        // NPC tiles are NOT walkable (NPC occupies them)
        if (current.npcs) {
            for (const npc of current.npcs) {
                if (npc.x === x && npc.y === y) return false;
            }
        }
        return true;
    }

    // Returns any warp at (x, y), or null
    function getWarp(x, y) {
        if (!current || !current.warps) return null;
        return current.warps.find(w => w.x === x && w.y === y) || null;
    }

    // Returns any sign at (x, y), or null
    function getSign(x, y) {
        if (!current || !current.signs) return null;
        return current.signs.find(s => s.x === x && s.y === y) || null;
    }

    // Loads a map by name from data/maps/kanto/<mapName>.json
    async function load(mapName) {
        const url = `data/maps/kanto/${mapName}.json`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${url}`);
            const data = await resp.json();
            current = data;
            // Derive map size from NPC/warp positions to get a reasonable bound.
            // Real tile layout not available yet — use DEFAULT_SIZE or compute from data.
            let maxX = DEFAULT_SIZE - 1;
            let maxY = DEFAULT_SIZE - 1;
            if (data.npcs) {
                for (const n of data.npcs) {
                    if (n.x > maxX) maxX = n.x;
                    if (n.y > maxY) maxY = n.y;
                }
            }
            if (data.warps) {
                for (const w of data.warps) {
                    if (w.x > maxX) maxX = w.x;
                    if (w.y > maxY) maxY = w.y;
                }
            }
            if (data.signs) {
                for (const s of data.signs) {
                    if (s.x > maxX) maxX = s.x;
                    if (s.y > maxY) maxY = s.y;
                }
            }
            // Add padding and round up to at least DEFAULT_SIZE
            mapWidth  = Math.max(DEFAULT_SIZE, maxX + 4);
            mapHeight = Math.max(DEFAULT_SIZE, maxY + 4);
            console.log(`[Map] Loaded ${mapName} (${mapWidth}x${mapHeight})`);
            return data;
        } catch (err) {
            console.error('[Map] Failed to load map:', err);
            // Fallback empty map
            current = { id: mapName, name: mapName, npcs: [], warps: [], signs: [], connections: [], triggers: [] };
            mapWidth = DEFAULT_SIZE;
            mapHeight = DEFAULT_SIZE;
            return current;
        }
    }

    return {
        get current() { return current; },
        get width()   { return mapWidth; },
        get height()  { return mapHeight; },
        load,
        getTile,
        isWalkable,
        getWarp,
        getSign
    };
})();
