// GameMap — loads and manages map data, warps, and connections
window.GameMap = (function () {
    'use strict';

    const DEFAULT_SIZE = 20;

    const REGIONS = { kanto: 'kanto', johto: 'johto', hoenn: 'hoenn', sinnoh: 'sinnoh' };

    // Module state
    let current    = null;   // raw map JSON
    let layoutData = null;   // layout JSON (width, height, metatiles, collision, tileset)
    let mapWidth   = DEFAULT_SIZE;
    let mapHeight  = DEFAULT_SIZE;
    let _nameIndex = null;   // MAP_CONST -> filename for the CURRENT region
    let _region    = 'kanto';
    const _indexCache = {};  // region -> { MAP_CONST: filename }

    // Which regions ship a `<region>_index.json` (MAP id -> filename) lookup.
    const REGION_INDEX = {
        kanto:   'data/maps/kanto_index.json',
        sinnoh:  'data/maps/sinnoh_index.json',
    };

    // Load (and cache) the MAP-id → filename index for a region. Regions without
    // an index file resolve to an empty table (warps fall back gracefully).
    async function _ensureIndex(region) {
        if (_indexCache[region]) return _indexCache[region];
        const url = REGION_INDEX[region];
        if (!url) { _indexCache[region] = {}; return _indexCache[region]; }
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            _indexCache[region] = await resp.json();
            console.log(`[Map] Loaded ${region} index: ${Object.keys(_indexCache[region]).length} entries`);
        } catch (e) {
            console.error(`[Map] Failed to load index for ${region}:`, e);
            _indexCache[region] = {};
        }
        return _indexCache[region];
    }

    // ---------------------------------------------------------------
    // Index loading
    // ---------------------------------------------------------------
    async function init() {
        _nameIndex = await _ensureIndex('kanto');
    }

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------
    function _fallbackSize(data) {
        let maxX = DEFAULT_SIZE - 1;
        let maxY = DEFAULT_SIZE - 1;
        if (data.npcs)  data.npcs.forEach(n => { if (n.x > maxX) maxX = n.x; if (n.y > maxY) maxY = n.y; });
        if (data.warps) data.warps.forEach(w => { if (w.x > maxX) maxX = w.x; if (w.y > maxY) maxY = w.y; });
        if (data.signs) data.signs.forEach(s => { if (s.x > maxX) maxX = s.x; if (s.y > maxY) maxY = s.y; });
        mapWidth  = Math.max(DEFAULT_SIZE, maxX + 4);
        mapHeight = Math.max(DEFAULT_SIZE, maxY + 4);
    }

    async function _loadLayout(data) {
        const layoutId = data.layout;
        if (!layoutId) {
            layoutData = null;
            _fallbackSize(data);
            return;
        }
        try {
            const lresp = await fetch(`data/layouts/${layoutId}.json`);
            if (!lresp.ok) throw new Error(`HTTP ${lresp.status}`);
            layoutData = await lresp.json();
            mapWidth   = layoutData.width;
            mapHeight  = layoutData.height;
        } catch (e) {
            console.warn(`[Map] Layout not found: ${layoutId}`, e);
            layoutData = null;
            _fallbackSize(data);
        }
    }

    // ---------------------------------------------------------------
    // Loading
    // ---------------------------------------------------------------

    /** Load by filename (e.g. "PalletTown"). Region defaults to 'kanto'. */
    async function load(mapName, region) {
        region = region || 'kanto';
        _region = region;
        // Make the region's MAP-id → filename index the active one so warp and
        // connection resolution target the correct region.
        _nameIndex = await _ensureIndex(region);
        const url = `data/maps/${region}/${mapName}.json`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${url}`);
            current = await resp.json();
            await _loadLayout(current);
            console.log(`[Map] Loaded ${mapName} (${mapWidth}x${mapHeight}) tileset=${getTilesetName() || 'none'}`);
        } catch (err) {
            console.error('[Map] Failed to load map:', err);
            current = { id: mapName, name: mapName, npcs: [], warps: [], signs: [], connections: [], triggers: [] };
            layoutData = null;
            mapWidth   = DEFAULT_SIZE;
            mapHeight  = DEFAULT_SIZE;
        }
        return current;
    }

    /** Load by MAP_CONST id (e.g. "MAP_PALLET_TOWN"). Fetches index first if needed. */
    async function loadById(mapId, region) {
        // Skip special/invalid constants
        if (!mapId || mapId === 'MAP_DYNAMIC' || mapId === 'MAP_NONE') return null;
        if (!_nameIndex) await init();
        const mapName = _nameIndex[mapId];
        if (!mapName) {
            console.warn(`[Map] Unknown map id: ${mapId}`);
            return null;
        }
        return load(mapName, region || _region);
    }

    // ---------------------------------------------------------------
    // Warp resolution
    // ---------------------------------------------------------------

    /**
     * Given a warp object {dest_map, dest_warp_id}, return {mapName, warpIndex}.
     * Returns null for invalid/unresolvable warps.
     */
    function resolveWarp(warp) {
        if (!warp || !warp.dest_map) return null;
        if (warp.dest_map === 'MAP_DYNAMIC' || warp.dest_map === 'MAP_NONE') return null;
        if (!_nameIndex) { console.warn('[Map] Index not loaded yet'); return null; }
        const mapName = _nameIndex[warp.dest_map];
        if (!mapName) {
            console.warn(`[Map] resolveWarp: unknown dest_map ${warp.dest_map}`);
            return null;
        }
        const warpIndex = parseInt(warp.dest_warp_id, 10);
        return { mapName, warpIndex: isNaN(warpIndex) ? 0 : warpIndex };
    }

    // ---------------------------------------------------------------
    // Connection resolution
    // ---------------------------------------------------------------

    /**
     * Check if (x, y) is at a map edge that has a connection.
     * Returns { connection, entryX, entryY } or null.
     * Accepts out-of-bounds coords (one step past edge).
     */
    function getConnectionAt(x, y) {
        if (!current || !current.connections) return null;
        for (const conn of current.connections) {
            const dir = conn.direction || conn.dir;
            if (!dir) continue;
            // Normalise direction names (some jsons use "up"/"down", spec uses "north"/"south")
            const d = dir.toLowerCase();
            const north = d === 'north' || d === 'up';
            const south = d === 'south' || d === 'down';
            const west  = d === 'west'  || d === 'left';
            const east  = d === 'east'  || d === 'right';

            if (north && y < 0)          return _connectionEntry(conn, 'north', x, y);
            if (south && y >= mapHeight) return _connectionEntry(conn, 'south', x, y);
            if (west  && x < 0)          return _connectionEntry(conn, 'west',  x, y);
            if (east  && x >= mapWidth)  return _connectionEntry(conn, 'east',  x, y);
        }
        return null;
    }

    /** Build an entry position for a connection given current exit coords. */
    function _connectionEntry(conn, dir, exitX, exitY) {
        // dest_map field may be "map" in some JSONs
        const destMapId = conn.dest_map || conn.map;
        const offset    = conn.offset || 0;
        // We don't know destHeight/destWidth yet — caller must fill in after load
        // Return a descriptor; entryX/Y will be finalised by the caller
        return { connection: { ...conn, dest_map: destMapId }, dir, exitX, exitY, offset };
    }

    // ---------------------------------------------------------------
    // Tile queries
    // ---------------------------------------------------------------

    function getTile(x, y) {
        if (!layoutData) return null;
        if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return null;
        return layoutData.metatiles[y * mapWidth + x];
    }

    function isWalkable(x, y) {
        if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return false;
        if (current && current.npcs) {
            for (const npc of current.npcs) {
                if (npc.x === x && npc.y === y) return false;
            }
        }
        // Warp tiles are always walkable
        if (getWarp(x, y)) return true;
        if (layoutData && layoutData.collision) {
            return layoutData.collision[y * mapWidth + x] === 0;
        }
        return true;
    }

    function getWarp(x, y) {
        if (!current || !current.warps) return null;
        return current.warps.find(w => w.x === x && w.y === y) || null;
    }

    function getSign(x, y) {
        if (!current || !current.signs) return null;
        return current.signs.find(s => s.x === x && s.y === y) || null;
    }

    function getTilesetName() {
        return layoutData ? layoutData.tileset : null;
    }

    /** Path to the pre-rendered textured background image, or null. */
    function getBackground() {
        return layoutData && layoutData.background ? layoutData.background : null;
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------
    return {
        get current()  { return current; },
        get layout()   { return layoutData; },
        get width()    { return mapWidth; },
        get height()   { return mapHeight; },
        get region()   { return _region; },
        REGIONS,
        init,
        load,
        loadById,
        resolveWarp,
        getConnectionAt,
        getTile,
        isWalkable,
        getWarp,
        getSign,
        getTilesetName,
        getBackground,
    };
})();
