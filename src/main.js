// main.js — entry point, game loop
(function () {
    'use strict';

    // --- Player state ---
    const player = {
        x: 7,
        y: 8,
        direction: 'down',
        walkFrame: 0   // 0=stand, 1=step1, 2=step2 — cycles on each move
    };

    // --- Region tracking ---
    let currentRegion = 'kanto';

    // --- Transition guard ---
    let _transitioning = false;
    let _warpCooldownUntil = 0;  // timestamp after which warps can fire again

    // --- Autosave interval (15 s) ---
    setInterval(function () {
        if (window.GameSave) GameSave.autosave();
    }, 15000);

    // --- Movement cooldown ---
    const MOVE_COOLDOWN_MS = 150;
    let lastMoveTime = 0;

    // --- Previous input state (for rising-edge detection) ---
    let prevStartState = false;

    // ---------------------------------------------------------------
    // Transition helpers
    // ---------------------------------------------------------------

    /** Transition via a warp tile. */
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

            // Remember source map id before we load the destination
            const sourceMapId = GameMap.current && GameMap.current.id;
            console.log(`[Warp] sourceMapId=${sourceMapId} dir=${player.direction}`);

            // Load destination map
            await GameMap.load(mapName, currentRegion);

            // Find return warp: prefer the warp that points back to our source map.
            const destWarps = (GameMap.current && GameMap.current.warps) || [];
            console.log('[Warp] destWarps:', JSON.stringify(destWarps));
            let returnWarp = destWarps.find(w => w.dest_map === sourceMapId) || null;
            if (!returnWarp) returnWarp = destWarps[warpIndex] || destWarps[0] || null;
            console.log('[Warp] returnWarp:', JSON.stringify(returnWarp));

            if (returnWarp) {
                // Spawn directly on the return warp tile, same direction the player
                // was already moving. The cooldown prevents immediately re-triggering.
                player.x = returnWarp.x;
                player.y = returnWarp.y;
                console.log(`[Warp] spawned at (${player.x},${player.y})`);
                player.walkFrame = 0;
            } else {
                // Centre of map
                player.x = Math.floor(GameMap.width  / 2);
                player.y = Math.floor(GameMap.height / 2);
            }

            // Clamp to map bounds
            player.x = Math.max(0, Math.min(player.x, GameMap.width  - 1));
            player.y = Math.max(0, Math.min(player.y, GameMap.height - 1));

            GameCamera.update(player.x, player.y, GameMap.width, GameMap.height);
            if (window.GameSave) GameSave.markDirty();
            // Block warp re-triggering for 600ms so player doesn't immediately warp back out
            _warpCooldownUntil = performance.now() + 600;
        } finally {
            _transitioning = false;
        }
    }

    /** Transition via a map-edge connection. */
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
                case 'north':
                    entryX = exitX - offset;
                    entryY = destH - 1;
                    break;
                case 'south':
                    entryX = exitX - offset;
                    entryY = 0;
                    break;
                case 'west':
                    entryX = destW - 1;
                    entryY = exitY - offset;
                    break;
                case 'east':
                    entryX = 0;
                    entryY = exitY - offset;
                    break;
                default:
                    entryX = Math.floor(destW / 2);
                    entryY = Math.floor(destH / 2);
            }

            // Clamp
            player.x = Math.max(0, Math.min(entryX, destW - 1));
            player.y = Math.max(0, Math.min(entryY, destH - 1));

            GameCamera.update(player.x, player.y, destW, destH);
            if (window.GameSave) GameSave.markDirty();
            _warpCooldownUntil = performance.now() + 600;
        } finally {
            _transitioning = false;
        }
    }

    // ---------------------------------------------------------------
    // Game loop
    // ---------------------------------------------------------------
    function gameLoop(timestamp) {
        // Process input — move one tile per keypress with cooldown
        const menuOpen = window.GameStartMenu && GameStartMenu.isOpen;

        // Route D-pad / buttons into the menu when it's open
        if (menuOpen) {
            const elapsed = timestamp - lastMoveTime;
            if (elapsed >= MOVE_COOLDOWN_MS) {
                const inp = GameInput.state;
                if      (inp.up)    { GameStartMenu.moveUp();    lastMoveTime = timestamp; }
                else if (inp.down)  { GameStartMenu.moveDown();  lastMoveTime = timestamp; }
                else if (inp.left)  { GameStartMenu.moveLeft();  lastMoveTime = timestamp; }
                else if (inp.right) { GameStartMenu.moveRight(); lastMoveTime = timestamp; }
                else if (inp.a)     { GameStartMenu.confirm();   lastMoveTime = timestamp; }
                else if (inp.b)     { GameStartMenu.back();      lastMoveTime = timestamp; }
            }
        }

        if (!_transitioning && !menuOpen) {
            const elapsed = timestamp - lastMoveTime;
            if (elapsed >= MOVE_COOLDOWN_MS) {
                const inp = GameInput.state;
                let dx = 0;
                let dy = 0;

                if      (inp.up)    { dy = -1; player.direction = 'up'; }
                else if (inp.down)  { dy =  1; player.direction = 'down'; }
                else if (inp.left)  { dx = -1; player.direction = 'left'; }
                else if (inp.right) { dx =  1; player.direction = 'right'; }

                if (dx !== 0 || dy !== 0) {
                    const nx = player.x + dx;
                    const ny = player.y + dy;

                    // Check for map-edge connection (out-of-bounds move)
                    const oob = nx < 0 || nx >= GameMap.width || ny < 0 || ny >= GameMap.height;
                    if (oob) {
                        const connInfo = GameMap.getConnectionAt(nx, ny);
                        if (connInfo) {
                            transitionToConnection(connInfo);
                        }
                        // Don't update player position for OOB moves
                    } else if (GameMap.isWalkable(nx, ny)) {
                        player.x = nx;
                        player.y = ny;
                        // Advance walk animation: 0→1→2→1→0... (step1, step2 alternating)
                        player.walkFrame = player.walkFrame === 0 ? 1 :
                                           player.walkFrame === 1 ? 2 : 1;
                        if (window.GameSave) GameSave.markDirty();

                        // Check for warp at new position (skip if in cooldown after a recent transition)
                        const warp = GameMap.getWarp(nx, ny);
                        if (warp && performance.now() >= _warpCooldownUntil) {
                            transitionToWarp(warp);
                        }
                    }
                    lastMoveTime = timestamp;
                } else {
                    // No direction held — return to standing frame
                    player.walkFrame = 0;
                }
            }
        }

        // START button — rising edge → toggle start menu
        const curStart = GameInput.state.start;
        if (curStart && !prevStartState) {
            if (window.GameStartMenu) GameStartMenu.toggle();
        }
        prevStartState = curStart;

        // Update camera
        GameCamera.update(player.x, player.y, GameMap.width, GameMap.height);

        // Update HUD display
        GameHUD.update();

        requestAnimationFrame(gameLoop);
    }

    // ---------------------------------------------------------------
    // Startup
    // ---------------------------------------------------------------
    async function init() {
        // Apply saved control scale before building controls
        const savedScale = localStorage.getItem('pokemon_control_scale');
        if (savedScale) {
            document.documentElement.style.setProperty('--control-scale', savedScale);
        }

        // Init input (keyboard listeners)
        GameInput.init();

        // Init layout (drag/resize/orientation)
        GameLayout.init();

        // Init controls (D-pad by default)
        GameControls.init();

        // Init HUD
        GameHUD.init(GameMap, player);

        // Init renderer
        const canvas = document.getElementById('canvas-primary');
        GameRenderer.init(canvas);

        // Init map index BEFORE loading any map
        await GameMap.init();

        // Load starting map
        await GameMap.load('PalletTown', currentRegion);

        // Set player start position
        player.x = 7;
        player.y = 8;
        player.direction = 'down';

        // Clamp to map bounds
        player.x = Math.min(player.x, GameMap.width  - 1);
        player.y = Math.min(player.y, GameMap.height - 1);

        // Give renderer the scene references
        GameRenderer.setScene(GameMap, GameCamera, player);

        // Initial camera update
        GameCamera.update(player.x, player.y, GameMap.width, GameMap.height);

        // Start game loop
        requestAnimationFrame(gameLoop);

        console.log('[Main] Game started. Map:', GameMap.current && GameMap.current.name);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
