// GameRenderer — renders game world to #screen-primary canvas
window.GameRenderer = (function () {
    const TILE_PX          = 16;
    const METATILES_PER_ROW = 16;

    let canvas = null;
    let ctx    = null;
    let rafId  = null;
    let _map   = null;
    let _camera = null;
    let _player = null;

    // Tileset state
    let _tilesetName        = null;   // name of the CURRENTLY DISPLAYED tileset
    let _tilesetLoadingName = null;   // name being fetched (prevents duplicate loads)
    let _tilesetImg         = null;   // spritesheet for _tilesetName
    let _tilesetMeta        = null;

    // NPC sprite state
    let _npcIndex          = null;
    let _npcIndexPlatinum  = null;   // Sinnoh/Platinum sprites, preferred on sinnoh maps
    let _npcImgCache = new Map();

    // Player sprite state
    let _playerImg = null;

    // Pre-rendered textured map background (DS maps rendered from their 3D
    // models). When present it is drawn instead of the metatile grid.
    let _bgPath    = null;
    let _bgImg     = null;

    function loadBackground(path) {
        if (path === _bgPath) return;
        _bgPath = path;
        _bgImg  = null;
        if (!path) return;
        // Reuse a neighbour image if it's already loaded (avoids a reload flash
        // when the player crosses into a map that was showing as a neighbour).
        const cached = _neighborImgs.get(path);
        if (cached instanceof HTMLImageElement) { _bgImg = cached; return; }
        const img = new Image();
        img.onload  = () => { if (_bgPath === path) _bgImg = img; _neighborImgs.set(path, img); };
        img.onerror = () => { if (_bgPath === path) console.warn(`[Renderer] Failed to load background: ${path}`); };
        img.src = path;
    }

    // Cache of neighbouring-map background images for seamless overworld rendering.
    let _neighborImgs = new Map();   // path -> Image | 'loading' | 'error'
    function _getNeighborImg(path) {
        if (!path) return null;
        const v = _neighborImgs.get(path);
        if (v instanceof HTMLImageElement) return v;
        if (v === 'loading' || v === 'error') return null;
        _neighborImgs.set(path, 'loading');
        const img = new Image();
        img.onload  = () => _neighborImgs.set(path, img);
        img.onerror = () => _neighborImgs.set(path, 'error');
        img.src = path;
        return null;
    }

    // FPS tracking
    let _fpsFrameCount = 0;
    let _fpsLastTime   = 0;
    let _currentFps    = 0;

    const WALK_FRAMES = {
        down:  { stand: 0, step1: 3, step2: 4 },
        up:    { stand: 1, step1: 5, step2: 6 },
        left:  { stand: 2, step1: 7, step2: 8 },
        right: { stand: 2, step1: 7, step2: 8 },
    };

    const COLORS = {
        walkable:  '#4a7c4e',
        impassable:'#1a1a2e',
        player:    '#e53935',
        npc:       '#1565c0',
        warp:      '#f9a825',
        sign:      '#8d6e63',
        bg:        '#2d4a2d'
    };

    function resizeCanvas() {
        if (!canvas) return;
        if (canvas.width  !== 240) canvas.width  = 240;
        if (canvas.height !== 208) canvas.height = 208;
    }

    // Load a new tileset spritesheet. Keeps the old image visible until the new
    // one successfully loads (no green-box flash during transition). If loading
    // fails the name is cleared so the next render will retry.
    function loadTileset(name) {
        if (!name) return;
        if (name === _tilesetName) return;        // already displayed
        if (name === _tilesetLoadingName) return; // already in-flight

        _tilesetLoadingName = name;

        fetch(`data/tilesets/${name}.json`)
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(meta => {
                const img = new Image();
                img.onload = () => {
                    // Atomic swap: only update displayed tileset once fully ready
                    _tilesetImg         = img;
                    _tilesetMeta        = meta;
                    _tilesetName        = name;
                    _tilesetLoadingName = null;
                };
                img.onerror = () => {
                    console.warn(`[Renderer] Failed to load tileset image: ${name}`);
                    _tilesetLoadingName = null; // allow retry next render
                };
                // Cache-bust the PNG using metatile count so browsers reload
                // when tilesets are regenerated (JSON is always fetched fresh).
                const v = (meta.total_metatiles || 0) + '_' + (meta.primary_count || 0);
                img.src = `data/tilesets/${name}.png?v=${v}`;
            })
            .catch(e => {
                console.warn(`[Renderer] Failed to load tileset JSON for ${name}:`, e);
                _tilesetLoadingName = null; // allow retry next render
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

    function _getVisualPos() {
        if (!_player) return { vx: 0, vy: 0 };
        const elapsed = performance.now() - (_player.moveStartTime || 0);
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

        const { vx, vy } = _getVisualPos();

        let vcamX = vx - Math.floor(vw / 2);
        let vcamY = vy - Math.floor(vh / 2);
        if (_map.width  > vw) vcamX = Math.max(0, Math.min(vcamX, _map.width  - vw));
        else vcamX = 0;
        if (_map.height > vh) vcamY = Math.max(0, Math.min(vcamY, _map.height - vh));
        else vcamY = 0;

        const tileStartX = Math.floor(vcamX);
        const tileStartY = Math.floor(vcamY);
        const subX = -(vcamX - tileStartX) * TILE_PX;
        const subY = -(vcamY - tileStartY) * TILE_PX;

        // Kick off tileset load if needed (non-blocking; keeps old image until ready)
        const wantedTileset = _map.getTilesetName ? _map.getTilesetName() : null;
        if (wantedTileset && wantedTileset !== _tilesetName && wantedTileset !== _tilesetLoadingName) {
            loadTileset(wantedTileset);
        }

        // Kick off textured-background load if the map has one (DS maps)
        const wantedBg = _map.getBackground ? _map.getBackground() : null;
        if (wantedBg !== _bgPath) loadBackground(wantedBg);

        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Fast path: draw the pre-rendered textured map (16 px/tile, grid-aligned).
        // For seamless overworlds, adjacent maps are drawn first at their global
        // offsets so the world is continuous (no hard transition, Emerald-style);
        // the current map is drawn on top, its transparent edges letting the
        // neighbours show through.
        const useBg = _bgImg && wantedBg;
        if (useBg) {
            ctx.imageSmoothingEnabled = false;
            const neighbors = _map.getMatrixNeighbors ? _map.getMatrixNeighbors() : null;
            if (neighbors) {
                for (const nb of neighbors) {
                    const img = _getNeighborImg(nb.background);
                    if (!img) continue;
                    const dx = (nb.ox - vcamX) * TILE_PX;
                    const dy = (nb.oy - vcamY) * TILE_PX;
                    const dw = img.naturalWidth, dh = img.naturalHeight;
                    if (dx > canvas.width || dy > canvas.height || dx + dw < 0 || dy + dh < 0) continue;
                    ctx.drawImage(img, dx, dy, dw, dh);
                }
            }
            ctx.drawImage(
                _bgImg,
                -vcamX * TILE_PX, -vcamY * TILE_PX,
                _bgImg.naturalWidth, _bgImg.naturalHeight
            );
        }

        const warpSet = new Set();
        const signSet = new Set();
        if (_map.current) {
            if (_map.current.warps) _map.current.warps.forEach(w => warpSet.add(`${w.x},${w.y}`));
            if (_map.current.signs) _map.current.signs.forEach(s => signSet.add(`${s.x},${s.y}`));
        }

        if (!useBg) for (let ty = -1; ty <= vh; ty++) {
            for (let tx = -1; tx <= vw; tx++) {
                const worldX = tileStartX + tx;
                const worldY = tileStartY + ty;
                const sx = tx * TILE_PX + subX;
                const sy = ty * TILE_PX + subY;

                const metatileIdx = _map.getTile(worldX, worldY);
                let drawn = false;
                if (metatileIdx !== null && metatileIdx !== undefined && _tilesetImg) {
                    drawn = drawMetatile(metatileIdx, sx, sy);
                }
                if (!drawn) {
                    ctx.fillStyle = _map.isWalkable(worldX, worldY) ? COLORS.walkable : COLORS.impassable;
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

        // NPCs
        if (_map.current && _map.current.npcs) {
            for (const npc of _map.current.npcs) {
                if (npc.x < tileStartX - 1 || npc.x > tileStartX + vw + 1) continue;
                if (npc.y < tileStartY - 1 || npc.y > tileStartY + vh + 1) continue;
                const sx = (npc.x - tileStartX) * TILE_PX + subX;
                const sy = (npc.y - tileStartY) * TILE_PX + subY;
                const stem = _gfxToStem(npc.graphics_id);
                const img  = stem ? _getNpcImg(stem) : null;
                if (img) {
                    // 16x16 objects (items, props) draw at tile; 16x32 characters draw one tile up
                    const isTall = img.naturalHeight >= 32;
                    if (isTall) {
                        ctx.drawImage(img, 0, 0, 16, 32, sx, sy - TILE_PX, TILE_PX, TILE_PX * 2);
                    } else {
                        ctx.drawImage(img, 0, 0, 16, 16, sx, sy, TILE_PX, TILE_PX);
                    }
                }
                // Objects with no sprite (invisible interaction triggers, dynamic
                // VAR_* graphics, etc.) draw nothing — no placeholder square.
            }
        }

        // Player
        const playerSX = (vx - vcamX) * TILE_PX;
        const playerSY = (vy - vcamY) * TILE_PX;
        if (_playerImg) {
            const dir = _player.direction || 'down';
            const wf  = _player.walkFrame || 0;
            const wfs = WALK_FRAMES[dir] || WALK_FRAMES.down;
            const frameIdx = wf === 0 ? wfs.stand : wf === 1 ? wfs.step1 : wfs.step2;
            const srcX = frameIdx * 16;
            if (dir === 'right') {
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
        // Sinnoh (Platinum) sprites live in a separate index so they don't
        // clobber the Kanto sprites for shared stems (youngster, mom, …).
        fetch('data/sprites/npcs/platinum/index.json')
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(data => { _npcIndexPlatinum = data; })
            .catch(() => { _npcIndexPlatinum = {}; });
    }

    /** Resolve a sprite path for a stem, preferring Platinum art on Sinnoh maps. */
    function _npcPath(stem) {
        const region = _map && _map.region;
        if (region === 'sinnoh' && _npcIndexPlatinum && _npcIndexPlatinum[stem]) {
            return _npcIndexPlatinum[stem];
        }
        return _npcIndex && _npcIndex[stem] ? _npcIndex[stem] : null;
    }

    function _getNpcImg(stem) {
        const path = _npcPath(stem);
        if (!path) return null;
        if (_npcImgCache.has(path)) {
            const v = _npcImgCache.get(path);
            return (v instanceof HTMLImageElement) ? v : null;
        }
        _npcImgCache.set(path, 'loading');
        const img = new Image();
        img.onload  = () => { _npcImgCache.set(path, img); };
        img.onerror = () => { _npcImgCache.set(path, 'error'); };
        img.src = path;
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
