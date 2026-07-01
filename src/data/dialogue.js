// GameDialogue — contextual dialogue & interaction data keyed on NPC graphics
// and script labels. Guarantees every NPC/sign says something sensible without
// needing the decomp script sources.
window.GameDialogue = (function () {
    'use strict';

    // Persona lines keyed by OBJ_EVENT_GFX_* graphics id. Each entry is a pool;
    // one line (array of message pages) is chosen per interaction.
    const PERSONAS = {
        YOUNGSTER: [["I like shorts! They're comfy and easy to wear!"], ["My POKéMON are getting stronger every day!"]],
        BUG_CATCHER: [["Hey! I caught a bunch of bugs in the grass!"], ["Do you like bug POKéMON? They're the best!"]],
        LASS: [["Ehehe, my POKéMON are so cute!"], ["I won't lose to a boy like you!"]],
        BEAUTY: [["A strong Trainer has a kind heart."], ["My POKéMON and I share a special bond."]],
        PICNICKER: [["Isn't the weather lovely for a POKéMON walk?"], ["I packed snacks for me and my POKéMON!"]],
        HIKER: [["I've been climbing mountains for years!"], ["Rock POKéMON are as tough as I am!"]],
        BIKER: [["Vroom! Outta my way, kid!"], ["My bike and my POKéMON never quit!"]],
        ROCKER: [["Rock and roll! Feel the beat of battle!"]],
        SAILOR: [["Ahoy! The sea makes a man strong!"], ["Water POKéMON respect a real sailor."]],
        GENTLEMAN: [["Ah, a young Trainer. How refreshing."], ["Money can't buy a well-raised POKéMON."]],
        SCIENTIST: [["I'm researching POKéMON evolution."], ["Data suggests your POKéMON has potential."]],
        BLACK_BELT: [["My fists and my POKéMON are as one!"], ["Train the body, train the spirit!"]],
        WORKER_M: [["Hard work builds strong POKéMON."]],
        CLERK: [["Welcome! Please browse our fine goods."]],
        OLD_MAN_1: [["When I was young, I was a great Trainer..."], ["Take care out there in the tall grass."]],
        BALDING_MAN: [["In my day, POKéMON respected their elders!"]],
        WOMAN_1: [["Oh my, be careful in the wild grass, dear."]],
        WOMAN_2: [["My husband is off training somewhere again."]],
        MAN: [["POKéMON battles are all about strategy."]],
        LITTLE_GIRL: [["Do you have a cute POKéMON? Can I see?"]],
        LITTLE_BOY: [["When I grow up, I'll be a POKéMON Master!"]],
        NURSE: [["Would you like me to heal your POKéMON?"]],
        COOLTRAINER_M: [["You look strong. Let's see what you've got!"]],
        COOLTRAINER_F: [["A real Trainer never backs down!"]],
        ROCKET_M: [["Team Rocket does as it pleases!"], ["Get lost, kid, before you get hurt!"]],
        ROCKET_F: [["Team Rocket will rule this town!"]],
        FISHERMAN: [["The big ones are always biting today."]],
        POKEFAN_M: [["I just love POKéMON so, so much!"]],
        GAMBLER: [["Feeling lucky? Battles are a gamble!"]],
        SUPER_NERD: [["Actually, the type chart clearly favors me."]],
        TAMER: [["My POKéMON obey my every command!"]],
        JUGGLER: [["Round and round my POKéMON go!"]],
        SWIMMER_M: [["The water's fine! Dive in!"]],
        SWIMMER_F: [["I swim faster than a Goldeen!"]]
    };

    const DEFAULT_LINES = [["Hello there, Trainer!"], ["Nice weather for a POKéMON journey."], ["Good luck on your adventure!"]];

    // Object-type NPCs that aren't people.
    const OBJECTS = {
        CUT_TREE: ["A small tree blocks the way.", "It looks like it could be CUT down."],
        PUSHABLE_BOULDER: ["A large boulder sits here.", "It won't budge... STRENGTH might move it."],
        ROCK_SMASH_ROCK: ["A cracked rock blocks the path.", "ROCK SMASH could break it."]
    };

    // Item balls give an item on pickup. Weighted-ish by simple pool.
    const ITEM_POOL = [
        { key: 'potion', name: 'a POTION' },
        { key: 'pokeball', name: 'a POKé BALL' },
        { key: 'superpotion', name: 'a SUPER POTION' },
        { key: 'greatball', name: 'a GREAT BALL' },
        { key: 'potion', name: 'a POTION' }
    ];

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function gfxKey(graphicsId) {
        return (graphicsId || '').replace(/^OBJ_EVENT_GFX_/, '');
    }

    /** True if this NPC is an interactable object rather than a person. */
    function objectType(graphicsId) {
        const k = gfxKey(graphicsId);
        return OBJECTS[k] ? k : null;
    }

    function isItemBall(graphicsId) { return gfxKey(graphicsId) === 'ITEM_BALL'; }

    /** Messages for talking to a regular NPC. */
    function forNpc(npc) {
        const k = gfxKey(npc.graphics_id);
        const obj = OBJECTS[k];
        if (obj) return obj;
        const pool = PERSONAS[k];
        return pool ? pick(pool) : pick(DEFAULT_LINES);
    }

    /** A themed one-line challenge shout for a trainer, by persona. */
    function trainerIntro(npc) {
        const k = gfxKey(npc.graphics_id);
        const pool = PERSONAS[k];
        const line = pool ? pick(pool)[0] : "Let's battle!";
        return line;
    }

    /** Humanise a sign's script label into readable text. */
    function forSign(sign) {
        const label = sign.script || '';
        // Strip map prefix + EventScript_ and split CamelCase.
        let name = label.replace(/^[A-Za-z0-9]+_EventScript_/, '').replace(/Sign$/, '');
        name = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
        if (/Gym/i.test(label)) return [`${name} GYM`, 'The path to victory starts here!'];
        if (/Mart/i.test(label)) return ['POKé MART', 'For all your journey needs.'];
        if (/Center/i.test(label)) return ['POKéMON CENTER', 'Heal your POKéMON here.'];
        if (/Route/i.test(label)) return [`${name}`.toUpperCase()];
        if (/Town|City/i.test(label)) return [`${name}`, 'A nice place to visit.'];
        if (!name) return ['It\'s a wooden sign.'];
        return [`"${name}"`];
    }

    function pickItem() { return pick(ITEM_POOL); }

    return { forNpc, forSign, trainerIntro, objectType, isItemBall, pickItem, gfxKey };
})();
