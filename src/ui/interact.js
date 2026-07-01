// GameInteract — A-button overworld interactions: talk to NPCs, read signs,
// pick up items, trigger trainer battles.
window.GameInteract = (function () {
    'use strict';

    const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

    let _busy = false;   // true while a dialogue/battle chain is running

    function _party() { return GameParty.state; }
    function _key(x, y) {
        const id = (GameMap.current && GameMap.current.id) || '?';
        return `${id}:${x},${y}`;
    }

    function _npcAt(x, y) {
        const npcs = (GameMap.current && GameMap.current.npcs) || [];
        return npcs.find(n => n.x === x && n.y === y) || null;
    }
    function _signAt(x, y) {
        return GameMap.getSign ? GameMap.getSign(x, y) : null;
    }

    function isBusy() { return _busy; }

    /** Called on A-press in the overworld. Returns true if it handled something. */
    function tryInteract(player, onBattle) {
        if (_busy) return true;
        if (GameDialogueBox.visible) return true;
        const d = DIRV[player.direction] || DIRV.down;
        const fx = player.x + d[0];
        const fy = player.y + d[1];

        const npc = _npcAt(fx, fy);
        if (npc) { _handleNpc(npc, player, onBattle); return true; }

        const sign = _signAt(fx, fy);
        if (sign) { _talk(GameDialogue.forSign(sign)); return true; }

        return false;
    }

    function _talk(messages, after) {
        _busy = true;
        GameDialogueBox.show(messages, function () {
            _busy = false;
            if (after) after();
        });
    }

    function _handleNpc(npc, player, onBattle) {
        // Item ball pickup (once per position)
        if (GameDialogue.isItemBall(npc.graphics_id)) {
            const k = _key(npc.x, npc.y);
            if (!_party().collected) _party().collected = [];
            if (_party().collected.includes(k)) {
                _talk(['It\'s an empty item ball.']);
                return;
            }
            const item = GameDialogue.pickItem();
            _party().collected.push(k);
            GameParty.bag()[item.key] = (GameParty.bag()[item.key] || 0) + 1;
            GameParty.save();
            _talk([`You found ${item.name}!`]);
            return;
        }

        // Interactable object (tree/boulder/rock)
        if (GameDialogue.objectType(npc.graphics_id)) {
            _talk(GameDialogue.forNpc(npc));
            return;
        }

        // Trainer battle
        const tt = npc.trainer_type;
        const isTrainer = tt && tt === 'TRAINER_TYPE_NORMAL';
        if (isTrainer) {
            if (!_party().defeatedTrainers) _party().defeatedTrainers = [];
            const k = _key(npc.x, npc.y);
            if (_party().defeatedTrainers.includes(k)) {
                _talk(GameDialogue.forNpc(npc));   // already beaten → flavor line
                return;
            }
            if (GameParty.allFainted()) { _talk(['Your POKéMON are in no shape to battle!']); return; }
            const intro = GameDialogue.trainerIntro(npc);
            const trainer = _buildTrainer(npc, intro, k);
            _busy = true;
            GameDialogueBox.show([intro, `${trainer.name} wants to battle!`], function () {
                if (onBattle) onBattle(trainer, function (result) {
                    if (result && result.result === 'win') {
                        _party().defeatedTrainers.push(k);
                        GameParty.save();
                    }
                    _busy = false;
                });
                else _busy = false;
            });
            return;
        }

        // Regular NPC dialogue
        _talk(GameDialogue.forNpc(npc));
    }

    // Persona → nice trainer class name
    const CLASS_NAMES = {
        YOUNGSTER: 'Youngster', BUG_CATCHER: 'Bug Catcher', LASS: 'Lass', BEAUTY: 'Beauty',
        PICNICKER: 'Picnicker', HIKER: 'Hiker', BIKER: 'Biker', ROCKER: 'Rocker',
        SAILOR: 'Sailor', GENTLEMAN: 'Gentleman', SCIENTIST: 'Scientist', BLACK_BELT: 'Black Belt',
        COOLTRAINER_M: 'Cool Trainer', COOLTRAINER_F: 'Cool Trainer', ROCKET_M: 'Team Rocket',
        ROCKET_F: 'Team Rocket', FISHERMAN: 'Fisherman', GAMBLER: 'Gambler', SUPER_NERD: 'Super Nerd',
        TAMER: 'Tamer', JUGGLER: 'Juggler', SWIMMER_M: 'Swimmer', SWIMMER_F: 'Swimmer',
        POKEFAN_M: 'PokéFan', BURGLAR: 'Burglar'
    };

    /** Build a trainer object with a themed party derived from the current map. */
    function _buildTrainer(npc, intro, key) {
        const k = GameDialogue.gfxKey(npc.graphics_id);
        const className = CLASS_NAMES[k] || 'Trainer';
        // Determine level band from the strongest party member the player has.
        const party = GameParty.party();
        let lvl = 5;
        for (const p of party) lvl = Math.max(lvl, p.level);
        lvl = Math.max(3, lvl - 1 + Math.floor(Math.random() * 3));  // near player's level

        // Species: draw from this map's encounter table if present, else a default pool.
        const mapId = GameMap.current && GameMap.current.id;
        const speciesPool = _mapSpecies(mapId);
        const count = 1 + Math.floor(Math.random() * 3);  // 1-3 mons
        const mons = [];
        for (let i = 0; i < count; i++) {
            const sp = speciesPool[Math.floor(Math.random() * speciesPool.length)];
            const m = GamePokedex.create(sp, lvl + (i === count - 1 ? 1 : 0));
            if (m) mons.push(m);
        }
        if (mons.length === 0) mons.push(GamePokedex.create('SPECIES_RATTATA', lvl));
        return {
            name: className,
            party: mons,
            prize: lvl * count * 18,
            outro: `${className} was defeated!`
        };
    }

    const DEFAULT_POOL = ['SPECIES_RATTATA', 'SPECIES_PIDGEY', 'SPECIES_ZUBAT', 'SPECIES_SPEAROW', 'SPECIES_EKANS', 'SPECIES_SANDSHREW'];

    function _mapSpecies(mapId) {
        if (window.GameEncounters && GameEncounters.speciesFor) {
            const list = GameEncounters.speciesFor(mapId);
            if (list && list.length) return list;
        }
        return DEFAULT_POOL;
    }

    return { tryInteract, isBusy };
})();
