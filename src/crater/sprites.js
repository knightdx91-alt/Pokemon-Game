// Pokémon Crater clone — sprite transparency.
// The committed GBA sprite PNGs (data/sprites/pokemon/*) keep palette index 0
// as an opaque background colour. Same convention as the RPG's _stripBg
// (src/engine/battle.js): every pixel matching the top-left corner is
// background — chroma-key it out. A MutationObserver rewrites every <img>
// pointing at the sprite folders to a keyed data-URL, cached per file.
(function () {
    'use strict';

    const cache = {};          // original src -> Promise<dataURL>

    function keyed(src) {
        if (!cache[src]) {
            cache[src] = new Promise(function (resolve) {
                const im = new Image();
                im.onload = function () {
                    try {
                        const c = document.createElement('canvas');
                        c.width = im.naturalWidth; c.height = im.naturalHeight;
                        const ctx = c.getContext('2d');
                        ctx.drawImage(im, 0, 0);
                        const d = ctx.getImageData(0, 0, c.width, c.height);
                        const r = d.data[0], g = d.data[1], b = d.data[2];
                        for (let i = 0; i < d.data.length; i += 4) {
                            if (d.data[i] === r && d.data[i + 1] === g && d.data[i + 2] === b) d.data[i + 3] = 0;
                        }
                        ctx.putImageData(d, 0, 0);
                        resolve(c.toDataURL());
                    } catch (e) { resolve(src); }
                };
                im.onerror = function () { resolve(src); };
                im.src = src;
            });
        }
        return cache[src];
    }

    function fix(img) {
        const src = img.getAttribute('src') || '';
        if (img._craterKeyed || src.indexOf('data/sprites/pokemon/') !== 0) return;
        img._craterKeyed = true;
        keyed(src).then(function (url) {
            // only swap if the img still shows what we processed
            if ((img.getAttribute('src') || '') === src) img.src = url;
            else { img._craterKeyed = false; fix(img); }
        });
    }

    function scan(root) {
        if (root.tagName === 'IMG') fix(root);
        if (root.querySelectorAll) root.querySelectorAll('img').forEach(fix);
    }

    const mo = new MutationObserver(function (muts) {
        for (const m of muts) {
            if (m.type === 'attributes') { m.target._craterKeyed = false; fix(m.target); }
            else m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); });
        }
    });
    window.addEventListener('DOMContentLoaded', function () {
        scan(document.body);
        mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    });
})();
