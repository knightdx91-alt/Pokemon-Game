// GameSaveScreen — FireRed SAVE flow: info window + YES/NO + result message.
window.GameSaveScreen = (function () {
    'use strict';

    const ROW_H = 16;
    let isOpen = false, onClose = null;

    function _info() {
        const s = (window.GameSave && GameSave.state) || {};
        const badges = (s.badges && s.badges.johto ? s.badges.johto.filter(Boolean).length : 0);
        const seen = (s.pokedexSeen || 0);
        const t = s.playTime || 0;
        const hh = String(Math.floor(t / 3600)).padStart(1, '0');
        const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
        return {
            player: s.playerName || 'RED',
            badges: String(badges),
            dex: String(seen),
            time: `${hh}:${mm}`,
        };
    }

    function _drawInfoWindow() {
        const info = _info();
        const w = 128, h = 8 + ROW_H * 4 + 4;
        const x = 4, y = 4;
        GBAUI.window9(x, y, w, h);
        const rows = [
            ['PLAYER', info.player],
            ['BADGES', info.badges],
            ['POKéDEX', info.dex],
            ['TIME', info.time],
        ];
        rows.forEach(([k, v], i) => {
            const ry = y + 8 + i * ROW_H;
            GBAUI.text(k, x + 8, ry);
            GBAUI.text(v, x + w - 8 - GBAUI.textWidth(v), ry);
        });
    }

    function open(cb) {
        if (!GBAUI.ready) return;
        isOpen = true; onClose = cb || null;
        if (window.GameHUD && GameHUD.hideBanner) GameHUD.hideBanner();
        GBAUI.show();
        _renderPrompt();
    }

    function _renderPrompt() {
        GBAUI.clear();
        _drawInfoWindow();
        // message box asking to save
        const y = GBAUI.H - 48;
        GBAUI.window9(8, y, GBAUI.W - 16, 48);
        GBAUI.text('Would you like to save', 16, y + 8);
        GBAUI.text('the game?', 16, y + 8 + ROW_H);
        GameConfirm.open({
            keepOverlay: true,
            onYes: _doSave,
            onNo: _close,
        });
    }

    function _doSave() {
        if (window.GameSave && GameSave.save) { try { GameSave.save(); } catch (e) {} }
        localStorage.setItem('pokemon_save_placeholder', Date.now());
        GBAUI.clear();
        _drawInfoWindow();
        const y = GBAUI.H - 48;
        GBAUI.window9(8, y, GBAUI.W - 16, 48);
        GBAUI.text((( _info().player )) + ' saved the game.', 16, y + 8);
        setTimeout(_close, 1400);
    }

    function _close() {
        isOpen = false;
        GBAUI.clear(); GBAUI.hide();
        const cb = onClose; onClose = null;
        if (cb) cb();
    }

    return { open, get isOpen() { return isOpen; } };
})();
