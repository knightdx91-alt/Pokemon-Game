// FlyMenu — SELECT button opens a town list on the right side
// Teleports player to in front of the Pokémon Center in each town
window.FlyMenu = (function () {
    'use strict';

    const FLY_DESTINATIONS = [
        { label: 'Viridian City',   map: 'ViridianCity',   x: 26, y: 27, region: 'kanto' },
        { label: 'Pewter City',     map: 'PewterCity',     x: 17, y: 26, region: 'kanto' },
        { label: 'Cerulean City',   map: 'CeruleanCity',   x: 22, y: 20, region: 'kanto' },
        { label: 'Vermilion City',  map: 'VermilionCity',  x: 15, y: 7,  region: 'kanto' },
        { label: 'Lavender Town',   map: 'LavenderTown',   x: 6,  y: 6,  region: 'kanto' },
        { label: 'Celadon City',    map: 'CeladonCity',    x: 48, y: 12, region: 'kanto' },
        { label: 'Fuchsia City',    map: 'FuchsiaCity',    x: 25, y: 32, region: 'kanto' },
        { label: 'Saffron City',    map: 'SaffronCity',    x: 24, y: 39, region: 'kanto' },
        { label: 'Cinnabar Island', map: 'CinnabarIsland', x: 14, y: 12, region: 'kanto' },
        { label: 'Pallet Town',     map: 'PalletTown',     x: 10, y: 10, region: 'kanto' },
    ];

    let _el = null;
    let _open = false;
    let _cursor = 0;
    let _onFly = null;   // callback(dest) set by main.js

    function _build() {
        if (_el) { _el.remove(); _el = null; }

        _el = document.createElement('div');
        _el.id = 'fly-menu';
        _el.style.cssText = [
            'position:absolute',
            'top:24px',
            'right:4px',
            'width:54%',
            'background:#060610',
            'border:1px solid #000',
            'box-shadow:0 0 0 3px #18b8c8,0 0 0 4px #000,inset 0 0 0 1px #002830',
            'z-index:80',
            'pointer-events:all',
            'overflow:hidden',
        ].join(';');

        // Title bar
        const title = document.createElement('div');
        title.textContent = 'FLY TO';
        title.style.cssText = [
            'background:#0a1830',
            'border-bottom:1px solid #18b8c8',
            'color:#80d0e8',
            'font-family:\'Press Start 2P\',monospace',
            'font-size:12px',
            'padding:3px 6px',
            'text-align:center',
            'letter-spacing:2px',
        ].join(';');
        _el.appendChild(title);

        // Destination rows
        FLY_DESTINATIONS.forEach(function (dest, i) {
            const row = document.createElement('div');
            row.dataset.idx = i;
            const isSel = i === _cursor;
            row.style.cssText = [
                'display:flex',
                'align-items:center',
                'padding:4px 6px',
                'font-family:\'Press Start 2P\',monospace',
                'font-size:11px',
                'color:#c8d8e8',
                'cursor:pointer',
                isSel ? 'background:rgba(24,184,200,0.18)' : '',
            ].join(';');

            const cursor = document.createElement('span');
            cursor.textContent = isSel ? '▶ ' : '  ';
            cursor.style.cssText = 'color:#18b8c8;min-width:14px;display:inline-block;';
            row.appendChild(cursor);

            const lbl = document.createElement('span');
            lbl.textContent = dest.label;
            row.appendChild(lbl);

            row.addEventListener('pointerdown', function (e) {
                e.stopPropagation();
                _cursor = i;
                _confirm();
            });
            row.addEventListener('pointerover', function () {
                _cursor = i;
                _build();
            });

            _el.appendChild(row);
        });

        // Close on tap outside
        document.addEventListener('pointerdown', _outsideClose, { once: true });

        const screen = document.getElementById('screen-primary');
        if (screen) screen.appendChild(_el);
    }

    function _outsideClose(e) {
        if (_el && !_el.contains(e.target)) {
            close();
        } else if (_open) {
            // re-arm if tap was inside
            document.addEventListener('pointerdown', _outsideClose, { once: true });
        }
    }

    function open(onFly) {
        if (_open) { close(); return; }
        _onFly = onFly;
        _open = true;
        _cursor = 0;
        _build();
    }

    function close() {
        _open = false;
        _onFly = null;
        if (_el) { _el.remove(); _el = null; }
    }

    function _confirm() {
        const dest = FLY_DESTINATIONS[_cursor];
        close();
        if (_onFly) _onFly(dest);
    }

    // D-pad navigation when open
    function moveUp()    { if (!_open) return; _cursor = (_cursor - 1 + FLY_DESTINATIONS.length) % FLY_DESTINATIONS.length; _build(); }
    function moveDown()  { if (!_open) return; _cursor = (_cursor + 1) % FLY_DESTINATIONS.length; _build(); }
    function confirm()   { if (!_open) return; _confirm(); }
    function cancel()    { close(); }

    Object.defineProperty(FlyMenu, 'isOpen', { get: function () { return _open; } });

    return { open, close, moveUp, moveDown, confirm, cancel, get isOpen() { return _open; } };
})();
