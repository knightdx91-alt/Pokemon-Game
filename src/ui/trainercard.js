// GameTrainerCard — FireRed PLAYER trainer card, via GBAUI.
// Placeholder trainer stats until a real trainer data system exists.
window.GameTrainerCard = (function () {
    'use strict';

    const ROW_H = 18;
    let isOpen = false, onClose = null;

    function _stats() {
        const s = (window.GameSave && GameSave.state) || {};
        const badges = (s.badges && s.badges.johto ? s.badges.johto : []);
        const t = s.playTime || 0;
        return {
            name: s.playerName || 'RED',
            id: String(s.trainerId || 24858).padStart(5, '0'),
            money: '$' + (s.money != null ? s.money : 3000).toLocaleString('en-US'),
            time: `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`,
            dex: String(s.pokedexSeen || 0),
            badges,
        };
    }

    function _render() {
        if (!isOpen || !GBAUI.ready) return;
        GBAUI.clear();
        const W = GBAUI.W, H = GBAUI.H;
        GBAUI.window9(4, 4, W - 8, H - 8);
        const s = _stats();
        const x = 16;
        let y = 16;
        GBAUI.text('TRAINER CARD', x, y); y += ROW_H + 4;
        const rows = [
            ['NAME', s.name],
            ['IDNo.', s.id],
            ['MONEY', s.money],
            ['POKéDEX', s.dex],
            ['TIME', s.time],
        ];
        rows.forEach(([k, v]) => {
            GBAUI.text(k, x, y);
            GBAUI.text(v, W - 16 - GBAUI.textWidth(v), y);
            y += ROW_H;
        });

        // Badge row (8 circles, filled if earned)
        y += 6;
        GBAUI.text('BADGES', x, y);
        const c = document.getElementById('ui-canvas');
        const g = c && c.getContext('2d');
        if (g) {
            const bx = x, by = y + ROW_H, r = 6;
            for (let i = 0; i < 8; i++) {
                const cx = bx + 6 + i * (r * 2 + 8);
                const cy = by + r;
                g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
                if (s.badges[i]) { g.fillStyle = '#e0a000'; g.fill(); }
                g.lineWidth = 1; g.strokeStyle = '#404040'; g.stroke();
            }
        }
    }

    function open(cb) {
        if (!GBAUI.ready) return;
        isOpen = true; onClose = cb || null;
        if (window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show(); _render();
    }
    function close() {
        isOpen = false; GBAUI.clear(); GBAUI.hide();
        const cb = onClose; onClose = null; if (cb) cb();
    }

    function _onKey(e) {
        if (!isOpen) return;
        const k = e.key;
        if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace' ||
            k === 'Enter' || k === 'z' || k === 'Z') { e.preventDefault(); close(); }
    }

    function init() { window.addEventListener('keydown', _onKey); }
    document.addEventListener('DOMContentLoaded', init);

    return { open, close, get isOpen() { return isOpen; } };
})();
