// main.js — entry point, game loop
(function () {
    'use strict';

    // --- Player state ---
    const player = {
        x: 10,
        y: 10
    };

    // --- Movement cooldown ---
    const MOVE_COOLDOWN_MS = 150;
    let lastMoveTime = 0;

    // --- Game loop ---
    function gameLoop(timestamp) {
        // Process input — move one tile per keypress with cooldown
        const elapsed = timestamp - lastMoveTime;
        if (elapsed >= MOVE_COOLDOWN_MS) {
            const inp = GameInput.state;
            let dx = 0;
            let dy = 0;

            if      (inp.up)    dy = -1;
            else if (inp.down)  dy =  1;
            else if (inp.left)  dx = -1;
            else if (inp.right) dx =  1;

            if (dx !== 0 || dy !== 0) {
                const nx = player.x + dx;
                const ny = player.y + dy;
                if (GameMap.isWalkable(nx, ny)) {
                    player.x = nx;
                    player.y = ny;
                    const warp = GameMap.getWarp(nx, ny);
                    if (warp) {
                        console.log(`[Warp] -> ${warp.dest_map}`);
                    }
                }
                lastMoveTime = timestamp;
            }
        }

        // Update camera
        GameCamera.update(player.x, player.y, GameMap.width, GameMap.height);

        // Update HUD display
        GameHUD.update();

        requestAnimationFrame(gameLoop);
    }

    // --- Startup ---
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

        // Load map
        await GameMap.load('PalletTown');

        // Clamp player to map bounds after load
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
