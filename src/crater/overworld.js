// Pokémon Crater v2 — overworld mode. Hosts the crater game systems
// (CraterGame/CraterBattle/CraterUI) inside the RPG engine's walkable world:
// wild Pokémon stand ON the real maps as sprites you walk up to and battle.
//
// Implements the window.GameMode hook surface that src/main.js and
// src/engine/renderer.js call into:
//   onMapChanged()          — respawn wild Pokémon for the new map
//   onStepInto(x, y) -> bool — battle when stepping onto a spawn
//   onInteract(tile) -> bool — battle when pressing A facing a spawn
//   onStart() -> bool        — START opens the crater menu
//   blocksInput() -> bool    — DOM overlay (title/menu/battle) owns input
//   suppressEncounters       — no random battles; spawns are visible instead
//   drawOverlay(ctx, camX, camY, tile) — draw the spawn sprites
(function () {
    'use strict';

    const SPAWN_COUNT = 6;
    const RESPAWN_MS  = 45000;    // spawns refresh after 45s on the same map

    const OW = {
        suppressEncounters: true,
        spawns: [],
        entered: false,          // player has passed the title/starter flow
    };
    window.CraterOverworld = OW;
    window.GameMode = OW;
    if (window.CraterUI) CraterUI.worldMode = true;

    // Boot the engine at the saved position (or Pallet Town) instead of the
    // RPG's default start map — main.js reads GameMode.startOverride in init().
    try {
        const raw = localStorage.getItem('crater_save_v1');
        const pos = raw ? (JSON.parse(raw) || {}).pos : null;
        OW.startOverride = (pos && pos.map)
            ? { map: pos.map, region: pos.region || 'kanto' }
            : { map: 'PalletTown', region: 'kanto' };
    } catch (e) {
        OW.startOverride = { map: 'PalletTown', region: 'kanto' };
    }

    const _sprites = new Map();   // url -> Image | 'loading' | 'error'
    let _lastSpawnTime = 0;
    let _saveTimer = null;

    function D() { return window.CraterData; }
    function G() { return window.CraterGame; }
    function M() { return window.CraterMon; }
    function UI() { return window.CraterUI; }

    // ------------------------------------------------------------- zones ----
    // Resolve the current map to a crater encounter zone. Zone ids were built
    // from the encounter data's map names: "<region>_<slug(display name)>"
    // e.g. kanto/Route1 ("Route 1") -> kanto_route_1.
    function slug(s) {
        return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function currentZone() {
        const zones = D().zones.zones;
        const map = window.GameMap && GameMap.current;
        if (!map) return null;
        const region = GameMap.region;
        const candidates = [];
        if (map.name) candidates.push(`${region}_${slug(map.name)}`);
        if (map.id) {
            candidates.push(`${region}_${slug(String(map.id).replace(/^MAP_(HEADER_)?/, ''))}`);
        }
        // johto zone data covers HnS Kanto maps too; also try the other regions
        // as a last resort so shared names (Route 1 exists in 2 regions) still
        // prefer the current region first.
        for (const c of candidates) {
            if (zones[c]) return { id: c, zone: zones[c] };
        }
        return null;
    }

    // ------------------------------------------------------------ spawns ----
    function rint(n) { return Math.floor(Math.random() * n); }

    /** Pick spawn tiles: prefer encounter grass/cave tiles, else open ground. */
    function pickTiles(count) {
        const w = GameMap.width, h = GameMap.height;
        const grass = [], open = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!GameMap.isWalkable(x, y) || GameMap.getWarp(x, y)) continue;
                const t = GameMap.getTileTerrainType(x, y);
                if (t === 'grass' || t === 'cave') grass.push([x, y]);
                else if (t === null) open.push([x, y]);
            }
        }
        const pool = grass.length >= count ? grass : grass.concat(open);
        const picked = [];
        const used = new Set();
        let guard = 0;
        while (picked.length < count && pool.length && guard++ < 400) {
            const [x, y] = pool[rint(pool.length)];
            const k = x + ',' + y;
            if (used.has(k)) continue;
            // keep the player's tile clear
            const p = window._player;
            if (p && p.x === x && p.y === y) continue;
            used.add(k);
            picked.push([x, y]);
        }
        return picked;
    }

    function rollPool(zone) {
        if (zone.rares && zone.rares.length && Math.random() < 0.02) {
            const r = zone.rares[rint(zone.rares.length)];
            return { slug: r[0], level: Math.max(1, r[1] + rint(5) - 2), rare: true };
        }
        let total = 0;
        for (const p of zone.pool) total += p[3];
        let roll = Math.random() * total;
        for (const p of zone.pool) {
            roll -= p[3];
            if (roll < 0) {
                const lv = p[1] + rint(p[2] - p[1] + 1);
                return { slug: p[0], level: Math.max(1, Math.min(100, lv)), rare: false };
            }
        }
        const p0 = zone.pool[0];
        return { slug: p0[0], level: p0[1], rare: false };
    }

    OW.respawn = function () {
        OW.spawns = [];
        _lastSpawnTime = performance.now();
        if (!G().state) return;
        const z = currentZone();
        if (!z) return;                       // no encounter data for this map
        if (z.zone.special && !G().zoneUnlocked(z.zone)) return;
        const tiles = pickTiles(z.zone.special ? 3 : SPAWN_COUNT);
        for (const [x, y] of tiles) {
            const roll = rollPool(z.zone);
            OW.spawns.push({
                x, y,
                slug: roll.slug,
                level: roll.level,
                variant: M().rollVariant(),
                rare: roll.rare,
                defeated: false,
                zoneId: z.id,
                bobSeed: Math.random() * Math.PI * 2,
            });
        }
    };

    function spawnAt(x, y) {
        return OW.spawns.find(s => !s.defeated && s.x === x && s.y === y) || null;
    }

    // --------------------------------------------------------- mode hooks ---
    OW.onMapChanged = function () {
        OW.respawn();
        OW.savePosition();
    };

    OW.onStepInto = function (x, y) {
        const s = spawnAt(x, y);
        if (!s) return false;
        OW.startBattle(s);
        return true;
    };

    OW.onInteract = function (tile) {
        const s = spawnAt(tile.x, tile.y);
        if (!s) return false;
        OW.startBattle(s);
        return true;
    };

    OW.onStart = function () {
        if (!G().state) return false;
        UI().showMenu();
        return true;
    };

    OW.blocksInput = function () {
        const scr = document.getElementById('screen');
        const overlayOpen = scr && scr.childElementCount > 0;
        const modalOpen = document.querySelector('#modal-layer .modal-overlay, #modal-layer .esm-overlay');
        return !!(overlayOpen || modalOpen);
    };

    // ------------------------------------------------------------ battles ---
    OW.startBattle = function (spawn) {
        // Face the spawn for a beat, then open the battle overlay.
        const idx = OW.spawns.indexOf(spawn);
        const terrain = GameMap.getTileTerrainType(spawn.x, spawn.y);
        const mapType = (GameMap.current && GameMap.current.map_type) || '';
        let env = 'grass';
        if (terrain === 'cave' || mapType === 'MAP_TYPE_UNDERGROUND') env = 'cave';
        else if (terrain === 'water') env = 'water';
        else if (/CITY|TOWN/.test(mapType)) env = 'grass';
        const zone = spawn.zoneId && D().zones.zones[spawn.zoneId];
        if (zone && zone.env) env = zone.env;
        UI().battleEnv = env;
        // endBattle() marks UI.spawns[idx].defeated — point it at our list so
        // the defeated wild sprite disappears from the map.
        UI().spawns = OW.spawns;
        UI().startWildBattle(spawn, idx);
    };

    /** Called by CraterUI after a battle ends / a screen closes in world mode. */
    OW.onScreenClosed = function () {
        // Mark defeated spawns handled by ui.js via OW.spawns references.
        OW.savePosition();
    };

    // ------------------------------------------------------------- saving ---
    OW.savePosition = function () {
        const g = G();
        if (!g.state || !OW.entered) return;
        const p = window._player;
        if (!p || !window.GameMap || !GameMap.currentFile) return;
        g.state.pos = {
            region: GameMap.region,
            map: GameMap.currentFile,
            x: p.x, y: p.y,
        };
        g.save();
    };

    // ---------------------------------------------------------- rendering ---
    function getSprite(slugName) {
        const url = D().sprite(slugName, 'front');
        const v = _sprites.get(url);
        if (v instanceof HTMLImageElement) return v;
        if (v) return null;
        _sprites.set(url, 'loading');
        const img = new Image();
        img.onload = () => _sprites.set(url, img);
        img.onerror = () => _sprites.set(url, 'error');
        img.src = url;
        return null;
    }

    OW.drawOverlay = function (ctx, camX, camY, TILE) {
        if (!OW.spawns.length) return;
        const now = performance.now();
        // periodic respawn so cleared maps repopulate
        if (now - _lastSpawnTime > RESPAWN_MS && OW.spawns.every(s => s.defeated)) {
            OW.respawn();
        }
        for (const s of OW.spawns) {
            if (s.defeated) continue;
            const img = getSprite(s.slug);
            const px = s.x * TILE - camX;
            const py = s.y * TILE - camY;
            if (px < -32 || py < -32 || px > ctx.canvas.width + 16 || py > ctx.canvas.height + 16) continue;
            const bob = Math.round(Math.sin(now / 400 + s.bobSeed) * 1.5);
            if (img) {
                // draw front sprite at 2x2 tiles anchored to the tile's bottom
                const size = TILE * 2;
                ctx.drawImage(img, px - TILE / 2, py - TILE + bob, size, size);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath();
                ctx.arc(px + TILE / 2, py + TILE / 2 + bob, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            if (s.rare || s.variant) {
                ctx.fillStyle = s.rare ? '#f8d030' : '#4ecdc4';
                ctx.fillRect(px + TILE - 3, py - TILE + 2 + bob, 3, 3);
            }
        }
    };

    // -------------------------------------------------------------- world ---
    /** Enter the walkable world (after title/starter). */
    OW.enterWorld = function () {
        OW.entered = true;
        const g = G();
        const pos = g.state && g.state.pos;
        const scr = document.getElementById('screen');
        if (scr) scr.innerHTML = '';
        UI().updateTopbar();
        if (pos && pos.map) {
            GameWorld.flyTo({ map: pos.map, region: pos.region, x: pos.x, y: pos.y });
        } else {
            GameWorld.flyTo({ map: 'PalletTown', region: 'kanto', x: 11, y: 10 });
        }
        if (!_saveTimer) {
            _saveTimer = setInterval(() => OW.savePosition(), 12000);
        }
    };
})();
