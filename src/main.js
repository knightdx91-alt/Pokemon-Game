// main.js — entry point, game loop
(function () {
    'use strict';

    // --- Player state ---
    const MOVE_COOLDOWN_MS = 150;

    // How long after a warp before another warp can fire.
    // Short enough that players don't feel trapped; long enough to prevent
    // immediately warping back through the same tile.
    const WARP_COOLDOWN_MS = 400;

    const player = {
        x: 7,
        y: 8,
        direction: 'down',
        walkFrame: 0,
        prevX: 7,
        prevY: 8,
        moveStartTime: 0,
        moveDuration: MOVE_COOLDOWN_MS
    };

    let currentRegion = 'kanto';
    let _transitioning = false;
    let _warpCooldownUntil = 0;

    setInterval(function () {
        if (window.GameSave) GameSave.autosave();
    }, 15000);

    const MOVE_COOLDOWN_MS_LOCAL = MOVE_COOLDOWN_MS;
    let lastMoveTime = 0;
    let prevStartState = false;

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function _snapPlayer() {
        player.prevX = player.x;
        player.prevY = player.y;
        player.moveStartTime = 0;
    }

    // ---------------------------------------------------------------
    // Transitions
    // ---------------------------------------------------------------

    async function transitionToWarp(warp) {
        if (_transitioning) return;
        _transitioning = true;
        try {
            const resolved = GameMap.resolveWarp(warp);
            if (!resolved) {
                console.warn('[Main] Could not resolve warp:', warp);
                return;
            }
            const { mapName, warpIndex } = resolved;
            console.log(`[Warp] -> ${mapName} (warp ${warpIndex})`);

            await GameMap.load(mapName, currentRegion);

            const destWarps = (GameMap.current && GameMap.current.warps) || [];
            let returnWarp  = destWarps[warpIndex] || null;
            if (!returnWarp && destWarps.length > 0) returnWarp = destWarps[0];

            if (returnWarp) {
                const rx = returnWarp.x, ry = returnWarp.y;
                const candidates = [];
                for (let dist = 1; dist <= 4; dist++) {
                    candidates.push([rx, ry - dist]);
                    candidates.push([rx, ry + dist]);
                    candidates.push([rx - dist, ry]);
                    candidates.push([rx + dist, ry]);
                }
                candidates.push([rx, ry]);
                let placed = false;
                for (const [cx, cy] of candidates) {
                    if (GameMap.isWalkable(cx, cy) && !GameMap.getWarp(cx, cy)) {
                        player.x = cx;
                        player.y = cy;
                        placed = true;
                        break;
                    }
                }
                if (!placed) { player.x = rx; player.y = ry; }
                player.direction = 'down';
                player.walkFrame = 0;
            } else {
                player.x = Math.floor(GameMap.width  / 2);
                player.y = Math.floor(GameMap.height / 2);
            }

            player.x = Math.max(0, Math.min(player.x, GameMap.width  - 1));
            player.y = Math.max(0, Math.min(player.y, GameMap.height - 1));
            _snapPlayer();

            GameCamera.update(player.x, player.y, GameMap.width, GameMap.height);
            if (window.GameSave) GameSave.markDirty();
            _warpCooldownUntil = performance.now() + WARP_COOLDOWN_MS;
        } finally {
            _transitioning = false;
        }
    }

    async function transitionToConnection(connInfo) {
        if (_transitioning) return;
        _transitioning = true;
        try {
            const { connection, dir, exitX, exitY, offset } = connInfo;
            const destMapId = connection.dest_map;
            if (!destMapId || destMapId === 'MAP_DYNAMIC' || destMapId === 'MAP_NONE') return;

            console.log(`[Connection] ${dir} -> ${destMapId}`);
            const result = await GameMap.loadById(destMapId, currentRegion);
            if (!result) return;

            const destW = GameMap.width;
            const destH = GameMap.height;
            let entryX, entryY;
            switch (dir) {
                case 'north': entryX = exitX - offset; entryY = destH - 1; break;
                case 'south': entryX = exitX - offset; entryY = 0;         break;
                case 'west':  entryX = destW - 1;       entryY = exitY - offset; break;
                case 'east':  entryX = 0;               entryY = exitY - offset; break;
                default:
                    entryX = Math.floor(destW / 2);
                    entryY = Math.floor(destH / 2);
            }

            player.x = Math.max(0, Math.min(entryX, destW - 1));
            player.y = Math.max(0, Math.min(entryY, destH - 1));
            _snapPlayer();

            GameCamera.update(player.x, player.y, destW, destH);
            if (window.GameSave) GameSave.markDirty();
            _warpCooldownUntil = performance.now() + WARP_COOLDOWN_MS;
        } finally {
            _transitioning = false;
        }
    }

    // ---------------------------------------------------------------
    // Game loop
    // ---------------------------------------------------------------
    function gameLoop(timestamp) {
        if (!_transitioning) {
            const elapsed = timestamp - lastMoveTime;
            if (elapsed >= MOVE_COOLDOWN_MS) {
                const inp = GameInput.state;
                let dx = 0, dy = 0;

                if      (inp.up)    { dy = -1; player.direction = 'up'; }
                else if (inp.down)  { dy =  1; player.direction = 'down'; }
                else if (inp.left)  { dx = -1; player.direction = 'left'; }
                else if (inp.right) { dx =  1; player.direction = 'right'; }

                if (dx !== 0 || dy !== 0) {
                    const nx = player.x + dx;
                    const ny = player.y + dy;
                    const oob = nx < 0 || nx >= GameMap.width || ny < 0 || ny >= GameMap.height;

                    if (oob) {
                        const connInfo = GameMap.getConnectionAt(nx, ny);
                        if (connInfo) transitionToConnection(connInfo);
                    } else if (GameMap.isWalkable(nx, ny)) {
                        player.prevX = player.x;
                        player.prevY = player.y;
                        player.x = nx;
                        player.y = ny;
                        player.moveStartTime = timestamp;
                        player.moveDuration  = MOVE_COOLDOWN_MS;

                        player.walkFrame = player.walkFrame === 0 ? 1 :
                                           player.walkFrame === 1 ? 2 : 1;
                        if (window.GameSave) GameSave.markDirty();

                        const warp = GameMap.getWarp(nx, ny);
                        if (warp && performance.now() >= _warpCooldownUntil) {
                            transitionToWarp(warp);
                        }
                    }
                    lastMoveTime = timestamp;
                } else {
                    player.walkFrame = 0;
                }
            }
        }

        const curStart = GameInput.state.start;
        if (curStart && !prevStartState) {
            if (window.GameStartMenu) GameStartMenu.toggle();
        }
        prevStartState = curStart;

        GameCamera.update(player.x, player.y, GameMap.width, GameMap.height);
        GameHUD.update();
        requestAnimationFrame(gameLoop);
    }

    // ---------------------------------------------------------------
    // Startup
    // ---------------------------------------------------------------
    async function init() {
        const savedScale = localStorage.getItem('pokemon_control_scale');
        if (savedScale) {
            document.documentElement.style.setProperty('--control-scale', savedScale);
        }

        GameInput.init();
        GameLayout.init();
        GameControls.init();
        GameHUD.init(GameMap, player);

        const canvas = document.getElementById('canvas-primary');
        GameRenderer.init(canvas);

        await GameMap.init();
        await GameMap.load('PalletTown', currentRegion);

        player.x    = 7;
        player.y    = 8;
        player.prevX = 7;
        player.prevY = 8;
        player.direction = 'down';
        player.moveStartTime = 0;
        player.x = Math.min(player.x, GameMap.width  - 1);
        player.y = Math.min(player.y, GameMap.height - 1);
        player.prevX = player.x;
        player.prevY = player.y;

        GameRenderer.setScene(GameMap, GameCamera, player);
        GameCamera.update(player.x, player.y, GameMap.width, GameMap.height);
        requestAnimationFrame(gameLoop);

        console.log('[Main] Game started. Map:', GameMap.current && GameMap.current.name);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
