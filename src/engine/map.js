// GameMap — loads and manages map data
window.GameMap = (function () {
    const DEFAULT_SIZE = 20;

    let current = null;       // raw map JSON (npcs, warps, signs, etc.)
    let layoutData = null;    // layout JSON (width, height, metatiles, collision, tileset)
    let mapWidth  = DEFAULT_SIZE;
    let mapHeight = DEFAULT_SIZE;

    // Returns the metatile index at (x, y)
    function getTile(x, y) {
        if (!layoutData) return null;
        if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return null;
        return layoutData.metatiles[y * mapWidth + x];
    }

    // Returns true if the tile is walkable
    function isWalkable(x, y) {
        if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return false;
        // NPC tiles are not walkable
        if (current && current.npcs) {
            for (const npc of current.npcs) {
                if (npc.x === x && npc.y === y) return false;
            }
        }
        // Use collision data from layout if available
        if (layoutData && layoutData.collision) {
            return layoutData.collision[y * mapWidth + x] === 0;
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

    // Returns the tileset name for the current map (e.g. "pallet_town")
    function getTilesetName() {
        return layoutData ? layoutData.tileset : null;
    }

    // Loads a map by name from data/maps/kanto/<mapName>.json
    // Also loads the corresponding layout JSON from data/layouts/<layout_id>.json
    async function load(mapName) {
        const url = `data/maps/kanto/${mapName}.json`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${url}`);
            const data = await resp.json();
            current = data;

            // Load layout data
            const layoutId = data.layout;
            if (layoutId) {
                try {
                    const lresp = await fetch(`data/layouts/${layoutId}.json`);
                    if (lresp.ok) {
                        layoutData = await lresp.json();
                        mapWidth  = layoutData.width;
                        mapHeight = layoutData.height;
                    } else {
                        console.warn(`[Map] Layout not found: ${layoutId}`);
                        layoutData = null;
                        _fallbackSize(data);
                    }
                } catch (e) {
                    console.warn('[Map] Failed to load layout:', e);
                    layoutData = null;
                    _fallbackSize(data);
                }
            } else {
                layoutData = null;
                _fallbackSize(data);
            }

            console.log(`[Map] Loaded ${mapName} (${mapWidth}x${mapHeight}) tileset=${getTilesetName() || 'none'}`);
            return data;
        } catch (err) {
            console.error('[Map] Failed to load map:', err);
            current    = { id: mapName, name: mapName, npcs: [], warps: [], signs: [], connections: [], triggers: [] };
            layoutData = null;
            mapWidth   = DEFAULT_SIZE;
            mapHeight  = DEFAULT_SIZE;
            return current;
        }
    }

    // Derive a rough map size from NPC/warp positions when no layout is available
    function _fallbackSize(data) {
        let maxX = DEFAULT_SIZE - 1;
        let maxY = DEFAULT_SIZE - 1;
        if (data.npcs)  data.npcs.forEach(n => { if (n.x > maxX) maxX = n.x; if (n.y > maxY) maxY = n.y; });
        if (data.warps) data.warps.forEach(w => { if (w.x > maxX) maxX = w.x; if (w.y > maxY) maxY = w.y; });
        if (data.signs) data.signs.forEach(s => { if (s.x > maxX) maxX = s.x; if (s.y > maxY) maxY = s.y; });
        mapWidth  = Math.max(DEFAULT_SIZE, maxX + 4);
        mapHeight = Math.max(DEFAULT_SIZE, maxY + 4);
    }

    return {
        get current()    { return current; },
        get layout()     { return layoutData; },
        get width()      { return mapWidth; },
        get height()     { return mapHeight; },
        load,
        getTile,
        isWalkable,
        getWarp,
        getSign,
        getTilesetName,
    };
})();
