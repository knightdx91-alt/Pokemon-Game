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
    let _tilesetName  = null;
    let _tilesetImg   = null;
    let _tilesetMeta  = null;
    let _tilesetLoading = false;

    // NPC sprite state
    let _npcIndex     = null;
    let _npcImgCache  = new Map();

    // Player sprite state
    let _playerImg    = null;

    // FPS tracking
    let _fpsFrameCount = 0;
    let _fpsLastTime   = 0;
    let _currentFps    = 0;

    // Actual Emerald frame layout:
    //   0=stand-south, 1=stand-north, 2=stand-west/east
    //   walk-south: 3,0,4,0  walk-north: 5,1,6,1  walk-west/east: 7,2,8,2
    const WALK_FRAMES = {
        down:  { stand: 0, step1: 3, step2: 4 },
        up:    { stand: 1, step1: 5, step2: 6 },
        left:  { stand: 2, step1: 7, step2: 8 },
        right: { stand: 2, step1: 7, step2: 8 },
    };

    // Fallback color definitions
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

    function resizeCanvas() {
        if (!canvas) return;
        if (canvas.width  !== 240) canvas.width  = 240;
        if (canvas.height !== 208) canvas.height = 208;
    }

    function loadTileset(name) {
        if (!name || name === _tilesetName) return;
        _tilesetName    = name;
        _tilesetImg     = null;
        _tilesetMeta    = null;
        _tilesetLoading = true;

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

    // Compute smoothly interpolated player position (fractional tile coords)
    function _getVisualPos() {
        if (!_player) return { vx: 0, vy: 0 };
        const now     = performance.now();
        const elapsed = now - (_player.moveStartTime || 0);
        const dur     = _player.moveDuration || 150;
        const t       = Math.min(1, elapsed / dur);
        const prevX   = (_player.prevX !== undefined) ? _player.prevX : _player.x;
        const prevY   = (_player.prevY !== undefined) ? _player.prevY : _player.y;
        return {
            vx: prevX + (_player.x - prevX) * t,
            vy: prevY + (_player.y - prevY) * t,
        };
    }

    function render() {
        if (!canvas || !ctx || !_map || !_camera || !_player) return;

        resizeCanvas();

        const vw = _camera.viewportW;
        const vh = _camera.viewportH;

        // Smooth player position
        const { vx, vy } = _getVisualPos();

        // Visual camera centered on interpolated player pos, clamped to map
        let vcamX = vx - Math.floor(vw / 2);
        let vcamY = vy - Math.floor(vh / 2);
        if (_map.width  > vw) vcamX = Math.max(0, Math.min(vcamX, _map.width  - vw));
        else vcamX = 0;
        if (_map.height > vh) vcamY = Math.max(0, Math.min(vcamY, _map.height - vh));
        else vcamY = 0;

        // Integer tile origin + sub-pixel offset for smooth scrolling
        const tileStartX = Math.floor(vcamX);
        const tileStartY = Math.floor(vcamY);
        const subX = -(vcamX - tileStartX) * TILE_PX;
        const subY = -(vcamY - tileStartY) * TILE_PX;

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
        if (_map.current) {
            if (_map.current.warps) _map.current.warps.forEach(w => warpSet.add(`${w.x},${w.y}`));
            if (_map.current.signs) _map.current.signs.forEach(s => signSet.add(`${s.x},${s.y}`));
        }

        // Draw tiles (one extra tile on each edge to fill sub-pixel gaps)
        for (let ty = -1; ty <= vh; ty++) {
            for (let tx = -1; tx <= vw; tx++) {
                const worldX = tileStartX + tx;
                const worldY = tileStartY + ty;
                const sx = tx * TILE_PX + subX;
                const sy = ty * TILE_PX + subY;

                const metatileIdx = _map.getTile(worldX, worldY);
                let drawnFromSheet = false;
                if (metatileIdx !== null && metatileIdx !== undefined && _tilesetImg) {
                    drawnFromSheet = drawMetatile(metatileIdx, sx, sy);
                }

                if (!drawnFromSheet) {
                    const walkable = _map.isWalkable(worldX, worldY);
                    ctx.fillStyle = walkable ? COLORS.walkable : COLORS.impassable;
                    ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
                }

                if (warpSet.has(`${worldX},${worldY}`)) {
                    ctx.fillStyle = 'rgba(249,168,37,0.45)';
                    ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
                } else if (signSet.has(`${worldX},${worldY}`)) {
                    ctx.fillStyle = 'rgba(141,110,99,0.45)';
                    ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
                }
            }
        }

        // Draw NPCs (position in screen space uses same sub-pixel offset)
        if (_map.current && _map.current.npcs) {
            for (const npc of _map.current.npcs) {
                // Cull: skip NPCs clearly outside the extended draw area
                if (npc.x < tileStartX - 1 || npc.x > tileStartX + vw + 1) continue;
                if (npc.y < tileStartY - 1 || npc.y > tileStartY + vh + 1) continue;

                const sx = (npc.x - tileStartX) * TILE_PX + subX;
                const sy = (npc.y - tileStartY) * TILE_PX + subY;

                const stem = _gfxToStem(npc.graphics_id);
                const img  = stem ? _getNpcImg(stem) : null;

                if (img) {
                    ctx.drawImage(img, 0, 0, 16, 32, sx, sy - TILE_PX, TILE_PX, TILE_PX * 2);
                } else {
                    const pad = 2;
                    ctx.fillStyle = COLORS.npc;
                    ctx.fillRect(sx + pad, sy + pad, TILE_PX - pad * 2, TILE_PX - pad * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(sx + Math.floor(TILE_PX / 2) - 1, sy + pad + 1, 3, 3);
                }
            }
        }

        // Draw player at smoothly interpolated screen position
        const playerSX = (vx - vcamX) * TILE_PX;
        const playerSY = (vy - vcamY) * TILE_PX;
        if (_playerImg) {
            const dir = _player.direction || 'down';
            const wf  = _player.walkFrame || 0;
            const wfs = WALK_FRAMES[dir] || WALK_FRAMES.down;
            const frameIdx = wf === 0 ? wfs.stand : wf === 1 ? wfs.step1 : wfs.step2;
            const srcX = frameIdx * 16;
            const isRight = (dir === 'right');
            if (isRight) {
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(_playerImg, srcX, 0, 16, 32,
                    -(playerSX + TILE_PX), playerSY - TILE_PX, TILE_PX, TILE_PX * 2);
                ctx.restore();
            } else {
                ctx.drawImage(_playerImg, srcX, 0, 16, 32,
                    playerSX, playerSY - TILE_PX, TILE_PX, TILE_PX * 2);
            }
        } else {
            const pad = 2;
            ctx.fillStyle = COLORS.player;
            ctx.fillRect(playerSX + pad, playerSY + pad, TILE_PX - pad * 2, TILE_PX - pad * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(playerSX + Math.floor(TILE_PX / 2) - 1, playerSY + pad + 1, 3, 3);
        }
    }

    function loop(timestamp) {
        // FPS counter — update every 500ms
        _fpsFrameCount++;
        if (_fpsLastTime === 0) _fpsLastTime = timestamp;
        const fpsDelta = timestamp - _fpsLastTime;
        if (fpsDelta >= 500) {
            _currentFps = Math.round(_fpsFrameCount / (fpsDelta / 1000));
            _fpsFrameCount = 0;
            _fpsLastTime = timestamp;
            if (window.GameHUD && GameHUD.setFps) GameHUD.setFps(_currentFps);
        }

        render();
        rafId = requestAnimationFrame(loop);
    }

    function _loadNpcIndex() {
        fetch('data/sprites/npcs/index.json')
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(data => { _npcIndex = data; })
            .catch(e => console.warn('[Renderer] Failed to load NPC sprite index:', e));
    }

    function _getNpcImg(stem) {
        if (!_npcIndex || !_npcIndex[stem]) return null;
        if (_npcImgCache.has(stem)) {
            const v = _npcImgCache.get(stem);
            return (v instanceof HTMLImageElement) ? v : null;
        }
        _npcImgCache.set(stem, 'loading');
        const img = new Image();
        img.onload  = () => { _npcImgCache.set(stem, img); };
        img.onerror = () => { _npcImgCache.set(stem, 'error'); };
        img.src = _npcIndex[stem];
        return null;
    }

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
        ctx.imageSmoothingEnabled = false;
        resizeCanvas();
        _loadNpcIndex();
        _loadPlayerImg();
        loop(0);
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
