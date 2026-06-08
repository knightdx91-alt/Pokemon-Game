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

    // Player sprite state
    let _playerImg    = null;   // HTMLImageElement for data/sprites/player.png

    // Actual Emerald frame layout (from object_event_anims.h):
    //   0=stand-south, 1=stand-north, 2=stand-west/east
    //   walk-south: 3,0,4,0  walk-north: 5,1,6,1  walk-west/east: 7,2,8,2
    const WALK_FRAMES = {
        down:  { stand: 0, step1: 3, step2: 4 },
        up:    { stand: 1, step1: 5, step2: 6 },
        left:  { stand: 2, step1: 7, step2: 8 },
        right: { stand: 2, step1: 7, step2: 8 },
    };

    // Fallback color definitions (used when tileset image not ready)
    const COLORS = {
        walkable:  '#4a7c4e',
        impassable:'#1a1a2e',
        player:    '#e53935',
        npc:       '#1565c0',
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

        // Build sign set for fallback overlay (only used when tileset not loaded)
        const signSet = new Set();
        if (_map.current && _map.current.signs) {
            _map.current.signs.forEach(s => signSet.add(`${s.x},${s.y}`));
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

                // Sign overlay only (warps are visually defined by tileset graphics)
                if (signSet.has(`${worldX},${worldY}`) && !drawnFromSheet) {
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
        if (_playerImg) {
            const dir = _player.direction || 'down';
            const wf  = _player.walkFrame || 0;  // 0=stand, 1=step1, 2=step2
            const wfs = WALK_FRAMES[dir] || WALK_FRAMES.down;
            const frameIdx = wf === 0 ? wfs.stand : wf === 1 ? wfs.step1 : wfs.step2;
            const srcX = frameIdx * 16;
            const isRight = (dir === 'right');
            if (isRight) {
                ctx.save();
                ctx.scale(-1, 1);
                // After scale(-1,1), x-coords are negated:
                // screen left-edge of sprite in flipped space = -(playerSX + TILE_PX)
                ctx.drawImage(_playerImg, srcX, 0, 16, 32,
                    -(playerSX + TILE_PX), playerSY - TILE_PX, TILE_PX, TILE_PX * 2);
                ctx.restore();
            } else {
                ctx.drawImage(_playerImg, srcX, 0, 16, 32,
                    playerSX, playerSY - TILE_PX, TILE_PX, TILE_PX * 2);
            }
        } else {
            // Fallback: red square
            const pad = 2;
            ctx.fillStyle = COLORS.player;
            ctx.fillRect(playerSX + pad, playerSY + pad, TILE_PX - pad * 2, TILE_PX - pad * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(playerSX + Math.floor(TILE_PX / 2) - 1, playerSY + pad + 1, 3, 3);
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

    function _loadPlayerImg() {
        const img = new Image();
        img.onload  = () => { _playerImg = img; };
        img.onerror = () => { console.warn('[Renderer] Failed to load player sprite'); };
        img.src = 'data/sprites/player.png';
    }

    function init(canvasEl) {
        canvas = canvasEl;
        ctx    = canvas.getContext('2d');
        // Disable image smoothing so pixel art stays crisp when CSS scales the canvas
        ctx.imageSmoothingEnabled = false;
        resizeCanvas();
        _loadNpcIndex();
        _loadPlayerImg();
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
