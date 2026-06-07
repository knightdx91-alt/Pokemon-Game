// GameRenderer — renders game world to #screen-primary canvas
window.GameRenderer = (function () {
    // Fixed tile size: 16x16 pixels per metatile, viewport 15x13 tiles → 240x208 px canvas
    const TILE_PX          = 16;
    const METATILES_PER_ROW = 16;  // spritesheet layout

    let canvas = null;
    let ctx    = null;
    let rafId  = null;
    let _map   = null;
    let _camera = null;
    let _player = null;

    // Tileset state
    let _tilesetName  = null;   // e.g. "pallet_town"
    let _tilesetImg   = null;   // HTMLImageElement — the metatile spritesheet
    let _tilesetMeta  = null;   // parsed JSON from data/tilesets/<name>.json
    let _tilesetLoading = false;

    // NPC sprite state
    let _npcIndex     = null;   // parsed index.json: { stem -> path }
    let _npcImgCache  = new Map(); // stem -> HTMLImageElement (or 'loading'/'error')

    // Fallback color definitions (used when tileset image not ready)
    const COLORS = {
        walkable:  '#4a7c4e',
        impassable:'#1a1a2e',
        player:    '#e53935',
        npc:       '#1565c0',
        warp:      '#f9a825',
        sign:      '#8d6e63',
        gridLine:  'rgba(0,0,0,0.12)',
        bg:        '#2d4a2d'
    };

    // Keep canvas at exactly 240x208 (CSS scales it up)
    function resizeCanvas() {
        if (!canvas) return;
        if (canvas.width  !== 240) canvas.width  = 240;
        if (canvas.height !== 208) canvas.height = 208;
    }

    // Load (or reload) the tileset spritesheet for the given tileset name
    function loadTileset(name) {
        if (!name || name === _tilesetName) return;
        _tilesetName    = name;
        _tilesetImg     = null;
        _tilesetMeta    = null;
        _tilesetLoading = true;

        // Load JSON metadata first, then image
        fetch(`data/tilesets/${name}.json`)
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(meta => {
                _tilesetMeta = meta;
                const img = new Image();
                img.onload  = () => { _tilesetImg = img; _tilesetLoading = false; };
                img.onerror = () => { console.warn(`[Renderer] Failed to load tileset image: ${name}`); _tilesetLoading = false; };
                img.src = `data/tilesets/${name}.png`;
            })
            .catch(e => {
                console.warn(`[Renderer] Failed to load tileset JSON for ${name}:`, e);
                _tilesetLoading = false;
            });
    }

    // Draw one metatile from the spritesheet at screen (sx, sy)
    function drawMetatile(metatileIdx, sx, sy) {
        if (!_tilesetImg) return false;
        const col = metatileIdx % METATILES_PER_ROW;
        const row = Math.floor(metatileIdx / METATILES_PER_ROW);
        ctx.drawImage(
            _tilesetImg,
            col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX,
            sx, sy, TILE_PX, TILE_PX
        );
        return true;
    }

    function render() {
        if (!canvas || !ctx || !_map || !_camera || !_player) return;

        resizeCanvas();

        const camX = _camera.x;
        const camY = _camera.y;
        const vw   = _camera.viewportW;
        const vh   = _camera.viewportH;

        // Check if tileset needs loading/switching
        const wantedTileset = _map.getTilesetName ? _map.getTilesetName() : null;
        if (wantedTileset && wantedTileset !== _tilesetName) {
            loadTileset(wantedTileset);
        }

        // Background
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Build sets for quick warp/sign/npc lookup
        const warpSet = new Set();
        const signSet = new Set();
        const npcSet  = new Set();
        if (_map.current) {
            if (_map.current.warps) _map.current.warps.forEach(w => warpSet.add(`${w.x},${w.y}`));
            if (_map.current.signs) _map.current.signs.forEach(s => signSet.add(`${s.x},${s.y}`));
            if (_map.current.npcs)  _map.current.npcs.forEach(n => npcSet.add(`${n.x},${n.y}`));
        }

        // Draw tiles
        for (let ty = 0; ty < vh; ty++) {
            for (let tx = 0; tx < vw; tx++) {
                const worldX = camX + tx;
                const worldY = camY + ty;
                const sx = tx * TILE_PX;
                const sy = ty * TILE_PX;

                // Try to draw from spritesheet
                const metatileIdx = _map.getTile(worldX, worldY);
                let drawnFromSheet = false;
                if (metatileIdx !== null && metatileIdx !== undefined && _tilesetImg) {
                    drawnFromSheet = drawMetatile(metatileIdx, sx, sy);
                }

                // Fallback: solid color tile
                if (!drawnFromSheet) {
                    const walkable = _map.isWalkable(worldX, worldY);
                    ctx.fillStyle = walkable ? COLORS.walkable : COLORS.impassable;
                    ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
                }

                // Warp/sign overlays (semi-transparent tint on top of tile graphics)
                if (warpSet.has(`${worldX},${worldY}`)) {
                    ctx.fillStyle = 'rgba(249,168,37,0.45)';
                    ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
                } else if (signSet.has(`${worldX},${worldY}`)) {
                    ctx.fillStyle = 'rgba(141,110,99,0.45)';
                    ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
                }
            }
        }

        // Draw NPCs
        if (_map.current && _map.current.npcs) {
            for (const npc of _map.current.npcs) {
                if (npc.x < camX || npc.x >= camX + vw || npc.y < camY || npc.y >= camY + vh) continue;
                const sx = (npc.x - camX) * TILE_PX;
                const sy = (npc.y - camY) * TILE_PX;

                const stem = _gfxToStem(npc.graphics_id);
                const img  = stem ? _getNpcImg(stem) : null;

                if (img) {
                    // Draw first frame (16x32) of spritesheet; feet on tile, body above
                    ctx.drawImage(img, 0, 0, 16, 32, sx, sy - TILE_PX, TILE_PX, TILE_PX * 2);
                } else {
                    // Fallback: blue square with face dot
                    const pad = 2;
                    ctx.fillStyle = COLORS.npc;
                    ctx.fillRect(sx + pad, sy + pad, TILE_PX - pad * 2, TILE_PX - pad * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(sx + Math.floor(TILE_PX / 2) - 1, sy + pad + 1, 3, 3);
                }
            }
        }

        // Draw player (always at camera center offset)
        const playerSX = (_player.x - camX) * TILE_PX;
        const playerSY = (_player.y - camY) * TILE_PX;
        const pad = 2;
        ctx.fillStyle = COLORS.player;
        ctx.fillRect(playerSX + pad, playerSY + pad, TILE_PX - pad * 2, TILE_PX - pad * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(playerSX + Math.floor(TILE_PX / 2) - 1, playerSY + pad + 1, 3, 3);

        // Map name overlay (top-left)
        if (_map.current && _map.current.name) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, canvas.width, 16);
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.textBaseline = 'middle';
            ctx.fillText(_map.current.name, 4, 8);
        }
    }

    function loop() {
        render();
        rafId = requestAnimationFrame(loop);
    }

    // Load NPC sprite index JSON
    function _loadNpcIndex() {
        fetch('data/sprites/npcs/index.json')
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(data => { _npcIndex = data; })
            .catch(e => console.warn('[Renderer] Failed to load NPC sprite index:', e));
    }

    // Get (or start loading) an NPC sprite image by stem key
    function _getNpcImg(stem) {
        if (!_npcIndex || !_npcIndex[stem]) return null;
        if (_npcImgCache.has(stem)) {
            const v = _npcImgCache.get(stem);
            return (v instanceof HTMLImageElement) ? v : null;
        }
        // Start loading
        _npcImgCache.set(stem, 'loading');
        const img = new Image();
        img.onload  = () => { _npcImgCache.set(stem, img); };
        img.onerror = () => { _npcImgCache.set(stem, 'error'); };
        img.src = _npcIndex[stem];
        return null;
    }

    // Convert OBJ_EVENT_GFX_WOMAN_1 -> woman_1
    function _gfxToStem(graphicsId) {
        if (!graphicsId) return null;
        return graphicsId.replace(/^OBJ_EVENT_GFX_/, '').toLowerCase();
    }

    function init(canvasEl) {
        canvas = canvasEl;
        ctx    = canvas.getContext('2d');
        // Disable image smoothing so pixel art stays crisp when CSS scales the canvas
        ctx.imageSmoothingEnabled = false;
        resizeCanvas();
        _loadNpcIndex();
        loop();
    }

    function setScene(map, camera, player) {
        _map    = map;
        _camera = camera;
        _player = player;
    }

    function stop() {
        if (rafId) cancelAnimationFrame(rafId);
    }

    return { init, setScene, stop, render };
})();
