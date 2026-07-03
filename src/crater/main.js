// Pokémon Crater — boot & top navigation wiring (v2: walkable overworld).
(function () {
    'use strict';

    function $(sel) { return document.querySelector(sel); }

    function wireNav() {
        const G = window.CraterGame, UI = window.CraterUI;
        const on = (sel, fn) => { const b = $(sel); if (b) b.onclick = fn; };
        on('#nav-world', () => { if (guard()) UI.closeToWorld(); });
        on('#nav-map',   () => { if (guard()) UI.showMap(); });      // v1 fallback
        on('#nav-party', () => { if (guard()) UI.showParty(); });
        on('#nav-dex',   () => { if (guard()) UI.showDex(); });
        on('#nav-mart',  () => { if (guard()) UI.showMart(); });
        on('#nav-gyms',  () => { if (guard()) UI.showGyms(); });
        on('#nav-heal',  () => {
            if (!guard()) return;
            G.healTeam(); G.save();
            const b = $('#nav-heal');
            b.textContent = '✔ Healed';
            setTimeout(() => { b.textContent = '❤ Heal'; }, 900);
        });
        on('#nav-title', () => UI.showTitle());

        function guard() {
            if (window.CraterUI.busy) return false;     // mid battle animation
            if (window.CraterUI.battle && !window.CraterUI.battle.over) return false;
            return !!G.state;
        }
    }

    window.addEventListener('DOMContentLoaded', function () {
        const boot = $('#boot-msg');
        window.CraterData.ready.then(function () {
            if (boot) boot.remove();
            wireNav();
            window.CraterUI.showTitle();
        }).catch(function (err) {
            console.error(err);
            if (boot) boot.textContent = 'Failed to load game data: ' + err.message +
                ' — if you opened this as a local file, serve it over http instead.';
        });
    });
})();
