// Pokémon Crater clone — boot & top navigation wiring.
(function () {
    'use strict';

    function $(sel) { return document.querySelector(sel); }

    function wireNav() {
        const G = window.CraterGame, UI = window.CraterUI;
        $('#nav-map').onclick = () => { if (guard()) UI.showMap(); };
        $('#nav-party').onclick = () => { if (guard()) UI.showParty(); };
        $('#nav-dex').onclick = () => { if (guard()) UI.showDex(); };
        $('#nav-mart').onclick = () => { if (guard()) UI.showMart(); };
        $('#nav-gyms').onclick = () => { if (guard()) UI.showGyms(); };
        $('#nav-heal').onclick = () => {
            if (!guard()) return;
            G.healTeam(); G.save();
            const b = $('#nav-heal');
            b.textContent = '✔ Healed';
            setTimeout(() => { b.textContent = '❤ Heal'; }, 900);
        };
        $('#nav-title').onclick = () => UI.showTitle();

        function guard() {
            if (window.CraterUI.busy) return false;     // mid battle animation
            if (window.CraterUI.battle && !window.CraterUI.battle.over) return false;
            return !!G.state;
        }
    }

    window.addEventListener('DOMContentLoaded', function () {
        const boot = $('#boot-msg');
        window.CraterData.ready.then(function () {
            boot.remove();
            wireNav();
            window.CraterUI.showTitle();
        }).catch(function (err) {
            console.error(err);
            boot.textContent = 'Failed to load game data: ' + err.message +
                ' — if you opened this as a local file, serve it over http instead.';
        });
    });
})();
