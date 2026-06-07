// GameRenderer — renders game world to #screen-primary canvas
window.GameRenderer = (function () {
    let canvas = null;
    let ctx = null;
    let rafId = null;
    let _map = null;
    let _camera = null;
    let _player = null;

    // Tile size in pixels (recalculated each frame based on canvas size)
    function getTileSize() {
        if (!canvas) return 32;
        return Math.floor(Math.min(
            canvas.width  / GameCamera.viewportW,
            canvas.height / GameCamera.viewportH
        ));
    }

    // Color definitions
    const COLORS = {
        walkable:   '#4a7c4e',   // grass green
        border:     '#1a1a2e',   // dark navy for impassable border
        player:     '#e53935',   // red square
        npc:        '#1565c0',   // blue square
        warp:       '#f9a825',   // yellow for doors/warps
        sign:       '#8d6e63',   // brown for signs
        gridLine:   'rgba(0,0,0,0.12)',
        bg:         '#2d4a2d'
    };

    function resizeCanvas() {
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;
        canvas.width  = parent.clientWidth  || 480;
        canvas.height = parent.clientHeight || 416;
    }

    function drawTile(screenX, screenY, tileSize, color) {
        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, tileSize, tileSize);
    }

    function render() {
        if (!canvas || !ctx || !_map || !_camera || !_player) return;

        resizeCanvas();
        const ts = getTileSize();
        const camX = _camera.x;
        const camY = _camera.y;
        const vw = _camera.viewportW;
        const vh = _camera.viewportH;

        // Offset to center the viewport area within the canvas
        const offsetX = Math.floor((canvas.width  - ts * vw) / 2);
        const offsetY = Math.floor((canvas.height - ts * vh) / 2);

        // Background
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Build sets for quick lookup
        const warpSet  = new Set();
        const signSet  = new Set();
        const npcSet   = new Set();

        if (_map.current) {
            if (_map.current.warps)  _map.current.warps.forEach(w => warpSet.add(`${w.x},${w.y}`));
            if (_map.current.signs)  _map.current.signs.forEach(s => signSet.add(`${s.x},${s.y}`));
            if (_map.current.npcs)   _map.current.npcs.forEach(n => npcSet.add(`${n.x},${n.y}`));
        }

        // Draw tiles
        for (let ty = 0; ty < vh; ty++) {
            for (let tx = 0; tx < vw; tx++) {
                const worldX = camX + tx;
                const worldY = camY + ty;
                const sx = offsetX + tx * ts;
                const sy = offsetY + ty * ts;

                let color = COLORS.walkable;
                if (!_map.isWalkable(worldX, worldY)) {
                    color = COLORS.border;
                }
                if (warpSet.has(`${worldX},${worldY}`)) color = COLORS.warp;
                if (signSet.has(`${worldX},${worldY}`)) color = COLORS.sign;

                drawTile(sx, sy, ts, color);

                // Grid lines
                ctx.strokeStyle = COLORS.gridLine;
                ctx.lineWidth = 1;
                ctx.strokeRect(sx, sy, ts, ts);
            }
        }

        // Draw NPCs
        if (_map.current && _map.current.npcs) {
            for (const npc of _map.current.npcs) {
                const sx = offsetX + (npc.x - camX) * ts;
                const sy = offsetY + (npc.y - camY) * ts;
                // Only draw if within viewport
                if (npc.x >= camX && npc.x < camX + vw && npc.y >= camY && npc.y < camY + vh) {
                    const pad = Math.floor(ts * 0.1);
                    ctx.fillStyle = COLORS.npc;
                    ctx.fillRect(sx + pad, sy + pad, ts - pad * 2, ts - pad * 2);
                    // NPC face indicator (small white dot at top)
                    ctx.fillStyle = '#ffffff';
                    const dotSize = Math.max(3, Math.floor(ts * 0.15));
                    ctx.fillRect(sx + Math.floor(ts / 2) - Math.floor(dotSize / 2), sy + pad + 2, dotSize, dotSize);
                }
            }
        }

        // Draw player (always centered in viewport)
        const playerScreenX = offsetX + (_player.x - camX) * ts;
        const playerScreenY = offsetY + (_player.y - camY) * ts;
        const pad = Math.floor(ts * 0.1);
        ctx.fillStyle = COLORS.player;
        ctx.fillRect(playerScreenX + pad, playerScreenY + pad, ts - pad * 2, ts - pad * 2);
        // Player face indicator
        ctx.fillStyle = '#ffffff';
        const dotSize = Math.max(3, Math.floor(ts * 0.15));
        ctx.fillRect(playerScreenX + Math.floor(ts / 2) - Math.floor(dotSize / 2), playerScreenY + pad + 2, dotSize, dotSize);

        // Map name overlay (top-left)
        if (_map.current && _map.current.name) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(offsetX, offsetY, ts * vw, 20);
            ctx.fillStyle = '#ffffff';
            ctx.font = '13px monospace';
            ctx.textBaseline = 'middle';
            ctx.fillText(_map.current.name, offsetX + 8, offsetY + 10);
        }
    }

    function loop() {
        render();
        rafId = requestAnimationFrame(loop);
    }

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
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
