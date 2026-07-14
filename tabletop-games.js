/* Tabletop Simulator — game/setting registry.
   ────────────────────────────────────────────────────────────────────────
   Everything the app knows about a playable world lives here as one plain
   object in TABLETOP_GAMES. To add a new setting (Codex Alera, Mistborn,
   Lies of Locke Lamora, …) you just append another entry — no engine code
   changes required. The shell (tabletop.html) reads these fields:

     id        unique slug (used as the save-state key)
     title     display name
     tagline   one line under the title
     author    original author, shown on the picker card
     accent    CSS color — themes the whole table for this world
     accent2   secondary CSS color (gradients / highlights)
     bg        CSS background for the picker card + table backdrop
     emoji     glyph used for the card + generated app icon
     ready     true = fully playable; false = shown but flagged "preview"
     dice      { mode:'expr'|'pool', presets:[{label,expr|dice,note}] }
                 expr  = standard NdX+M roller (WoT d20, etc.)
                 pool  = roll a pool of dN, report sets (Mistborn AG style)
     tokens    [{label,color}]  quick-add tokens for the board
     maps      [{label,url}]    optional board backgrounds (data-URI or path)
     sheet     [{group, fields:[{key,label,type,default,options?}]}]
                 type: text | number | textarea | select | track(max)
     lore      [{title, body}]  reference / rules panels (markdown-lite)
   ──────────────────────────────────────────────────────────────────────── */

window.TABLETOP_GAMES = [

/* ══════════════════════════ WHEEL OF TIME ══════════════════════════ */
{
  id: 'wot',
  title: 'The Wheel of Time',
  tagline: 'The Wheel weaves as the Wheel wills.',
  author: 'Robert Jordan',
  accent: '#d9a441', accent2: '#8b1e1e',
  bg: 'radial-gradient(circle at 30% 20%, #2a2416, #100c06 70%)',
  emoji: '☸',
  ready: true,
  dice: {
    mode: 'expr',
    note: 'Wheel of Time RPG uses a d20 system: roll d20 + attribute + skill vs. a Difficulty.',
    presets: [
      { label: 'd20 Check',     expr: '1d20',      note: 'Add your attribute + skill, beat the DC.' },
      { label: 'Advantage',     expr: '2d20kh1',   note: 'Roll twice, keep the higher.' },
      { label: 'Weave (Power)', expr: '1d20+1d6',  note: 'Channeling test + Strength-in-the-Power die.' },
      { label: 'Damage d8',     expr: '1d8',        note: 'Heron-mark blade.' },
      { label: 'Ta’veren twist', expr: '1d100',    note: 'GM: let the Pattern decide.' }
    ]
  },
  tokens: [
    { label: 'Aes Sedai', color: '#ffffff' },
    { label: 'Warder',    color: '#4a7c59' },
    { label: 'Trolloc',   color: '#7a1f1f' },
    { label: 'Myrddraal', color: '#1a1a1a' },
    { label: 'Party',     color: '#d9a441' },
    { label: 'Objective', color: '#3a6ea5' }
  ],
  maps: [],
  sheet: [
    { group: 'Identity', fields: [
      { key: 'name',   label: 'Name',        type: 'text',   default: '' },
      { key: 'nation', label: 'Homeland',    type: 'select', default: 'Two Rivers',
        options: ['Two Rivers','Andor','Cairhien','Tear','Illian','Tar Valon','Shienar','Arad Doman','Saldaea','Aiel Waste','Seanchan','Ebou Dar','Far Madding'] },
      { key: 'class',  label: 'Background',  type: 'select', default: 'Wanderer',
        options: ['Aes Sedai','Wilder','Warder','Wisdom','Armsman','Wanderer','Noble','Thief-taker','Gleeman','Ogier','Aiel','Wolfbrother'] }
    ]},
    { group: 'Attributes', fields: [
      { key: 'str', label: 'Strength',     type: 'number', default: 10 },
      { key: 'dex', label: 'Dexterity',    type: 'number', default: 10 },
      { key: 'con', label: 'Constitution', type: 'number', default: 10 },
      { key: 'int', label: 'Intelligence', type: 'number', default: 10 },
      { key: 'wis', label: 'Wisdom',       type: 'number', default: 10 },
      { key: 'cha', label: 'Charisma',     type: 'number', default: 10 }
    ]},
    { group: 'Condition', fields: [
      { key: 'vitality', label: 'Vitality', type: 'track', default: 20, max: 20 },
      { key: 'power',    label: 'Strength in the Power', type: 'track', default: 0, max: 20 },
      { key: 'notes',    label: 'Notes',    type: 'textarea', default: '' }
    ]}
  ],
  lore: [
    { title: 'The One Power', body:
      'The True Source drives the Wheel. **Saidar** (the female half) is embraced and surrendered to; **saidin** (the male half) must be seized and wrestled — and is tainted by the Dark One. The Five Powers are **Air (Wind), Water, Earth, Fire, and Spirit**. Weaving combines threads of the Powers into effects.' },
    { title: 'The Seven Ajahs', body:
      '**Blue** — causes & justice. **Green** — the Battle Ajah. **Red** — hunt men who channel. **White** — logic & philosophy. **Yellow** — Healing. **Brown** — knowledge & lore. **Gray** — mediation & diplomacy. (And the hidden **Black Ajah**, sworn to the Shadow.)' },
    { title: 'The Forsaken', body:
      'Thirteen of the Age of Legends’ most powerful channelers who turned to the Shadow and were sealed at Shayol Ghul: Ishamael, Lanfear, Sammael, Rahvin, Be’lal, Asmodean, Graendal, Semirhage, Mesaana, Moghedien, Aginor, Balthamel, and Demandred.' }
    /* Rulebook mechanics (Making Checks, Classes, Channeling, Feats) are
       appended in tabletop-wot.js from the Wheel of Time RPG rulebook. */
  ]
},

/* ══════════════════════════ CODEX ALERA ══════════════════════════ */
{
  id: 'alera',
  title: 'Codex Alera',
  tagline: 'For Alera, and the First Lord!',
  author: 'Jim Butcher',
  accent: '#c0392b', accent2: '#c9a227',
  bg: 'radial-gradient(circle at 70% 20%, #2a1512, #0e0807 70%)',
  emoji: '🦅',
  ready: true,
  dice: {
    mode: 'expr',
    note: 'Furycrafting scales with your bond. Roll d20 + Craft rating vs. the task.',
    presets: [
      { label: 'Furycraft d20', expr: '1d20',     note: 'Add the relevant Craft (Wind/Earth/Fire/Water/Metal/Wood).' },
      { label: 'Contest',       expr: '1d20+1d20', note: 'Two crafters clash — higher total wins.' },
      { label: 'Legion volley', expr: '3d6',       note: 'Massed crafting / battle.' },
      { label: 'Sword damage',  expr: '1d10',      note: 'Legion-issue gladius.' }
    ]
  },
  tokens: [
    { label: 'Citizen',   color: '#c9a227' },
    { label: 'Legionare', color: '#b04a3a' },
    { label: 'Cursor',    color: '#3a6ea5' },
    { label: 'Cane',      color: '#6a4a2a' },
    { label: 'Fury',      color: '#8e44ad' },
    { label: 'Vord',      color: '#2e7d32' }
  ],
  maps: [],
  sheet: [
    { group: 'Identity', fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'rank', label: 'Standing', type: 'select', default: 'Freeman',
        options: ['Slave','Freeman','Citizen','Legionare','Cursor','Knight','High Lord','First Lord','Marat','Canim'] }
    ]},
    { group: 'The Six Crafts', fields: [
      { key: 'wind',  label: 'Wind (flight, sound)',   type: 'number', default: 0 },
      { key: 'earth', label: 'Earth (strength, sense)', type: 'number', default: 0 },
      { key: 'fire',  label: 'Fire (flame, emotion)',   type: 'number', default: 0 },
      { key: 'water', label: 'Water (healing, empathy)', type: 'number', default: 0 },
      { key: 'metal', label: 'Metal (steel, endurance)', type: 'number', default: 0 },
      { key: 'wood',  label: 'Wood (aim, growth)',      type: 'number', default: 0 }
    ]},
    { group: 'Condition', fields: [
      { key: 'health', label: 'Health', type: 'track', default: 20, max: 20 },
      { key: 'notes',  label: 'Notes',  type: 'textarea', default: '' }
    ]}
  ],
  lore: [
    { title: 'Furycrafting', body:
      'Every Aleran bonds elemental spirits called **furies**. The six disciplines: **Wind** (flight, windstreams), **Earth** (strength, tremorsense), **Fire** (flame, emotion), **Water** (healing, shapeshifting, empathy), **Metal** (combat prowess, pain suppression), **Wood** (aim, plant growth). Power ranges from a farmer’s single weak fury to a **High Lord’s** mastery of many.' },
    { title: 'Peoples of Carna', body:
      'The **Alerans** (Roman-inspired Realm), the horse-and-beast-bonded **Marat**, the wolf-like **Canim**, the giant **Icemen**, and the insectile hive-mind **Vord** — the great threat that consumes all.' },
    { title: 'The Realm', body:
      'Ruled by the **First Lord** from the First Lord’s citadel. **High Lords** govern the great cities; **Legions** hold the frontier. **Cursors** are the Crown’s spies and messengers.' }
  ]
},

/* ══════════════════════════ MISTBORN ══════════════════════════ */
{
  id: 'mistborn',
  title: 'Mistborn',
  tagline: 'There’s always another secret.',
  author: 'Brandon Sanderson',
  accent: '#9b59b6', accent2: '#c0c0c0',
  bg: 'radial-gradient(circle at 50% 10%, #1c1630, #08060c 70%)',
  emoji: '🌫',
  ready: true,
  dice: {
    mode: 'pool',
    note: 'Mistborn Adventure Game: build a pool of d6s (Trait + Standing + bonuses), roll, and read the largest matching SET. Nudges spend Nudge dice.',
    presets: [
      { label: 'Roll 4',  dice: 4, note: 'Modest effort.' },
      { label: 'Roll 6',  dice: 6, note: 'Skilled attempt.' },
      { label: 'Roll 8',  dice: 8, note: 'Burning a metal to push it.' },
      { label: 'Roll 10', dice: 10, note: 'All-out Allomantic surge.' }
    ]
  },
  tokens: [
    { label: 'Mistborn', color: '#c0c0c0' },
    { label: 'Misting',  color: '#9b59b6' },
    { label: 'Skaa',     color: '#7f6a52' },
    { label: 'Noble',    color: '#c9a227' },
    { label: 'Inquisitor', color: '#7a1f1f' },
    { label: 'Koloss',   color: '#2e7d32' }
  ],
  maps: [],
  sheet: [
    { group: 'Identity', fields: [
      { key: 'name', label: 'Name', type: 'text', default: '' },
      { key: 'type', label: 'Allomancer', type: 'select', default: 'Misting',
        options: ['Mistborn','Misting','Feruchemist','Feruchemist/Twinborn','Skaa (none)','Kandra','Inquisitor'] }
    ]},
    { group: 'Physical Metals', fields: [
      { key: 'iron',    label: 'Iron — pull metals',   type: 'number', default: 0 },
      { key: 'steel',   label: 'Steel — push metals',  type: 'number', default: 0 },
      { key: 'tin',     label: 'Tin — heighten senses', type: 'number', default: 0 },
      { key: 'pewter',  label: 'Pewter — enhance body', type: 'number', default: 0 }
    ]},
    { group: 'Mental Metals', fields: [
      { key: 'brass',   label: 'Brass — soothe emotion', type: 'number', default: 0 },
      { key: 'zinc',    label: 'Zinc — riot emotion',    type: 'number', default: 0 },
      { key: 'copper',  label: 'Copper — hide Allomancy', type: 'number', default: 0 },
      { key: 'bronze',  label: 'Bronze — sense Allomancy', type: 'number', default: 0 }
    ]},
    { group: 'Condition', fields: [
      { key: 'health', label: 'Health', type: 'track', default: 10, max: 10 },
      { key: 'notes',  label: 'Notes',  type: 'textarea', default: '' }
    ]}
  ],
  lore: [
    { title: 'The Sixteen Metals', body:
      '**Physical** — Iron (pull), Steel (push), Tin (senses), Pewter (body). **Mental** — Brass (soothe), Zinc (riot), Copper (hide), Bronze (seek). **Temporal** — Bendalloy (store food), Cadmium (slow time), Gold (past self), Electrum (future self). **Enhancement** — Chromium, Nicrosil, Aluminium, Duralumin. Burn a metal to fuel the power; **flare** it for a surge.' },
    { title: 'Mistborn vs. Misting', body:
      'A **Misting** burns exactly one metal (a Coinshot = steel, a Thug = pewter, a Soother = brass…). A **Mistborn** burns all sixteen — vanishingly rare. **Feruchemists** *store* attributes in metalminds instead of drawing from the metal itself.' },
    { title: 'The Final Empire', body:
      'A thousand years under the **Lord Ruler**. **Skaa** are enslaved; **nobility** hold Allomantic bloodlines. **Steel Inquisitors** — spikes through the eyes — hunt for the Ministry. Ash falls from the sky and the **mists** rise at night.' }
  ]
},

/* ══════════════════════════ GENTLEMAN BASTARDS ══════════════════════════ */
{
  id: 'camorr',
  title: 'Gentleman Bastards',
  tagline: 'The Lies of Locke Lamora.',
  author: 'Scott Lynch',
  accent: '#2e8b57', accent2: '#c9a227',
  bg: 'radial-gradient(circle at 40% 30%, #10221a, #060a08 70%)',
  emoji: '🎭',
  ready: true,
  dice: {
    mode: 'pool',
    note: 'A con is a heist. Build a d6 pool for the crew’s edge; count 5s and 6s as successes. More successes = the scheme holds.',
    presets: [
      { label: 'Sneak (3)',   dice: 3, note: 'A quiet job.' },
      { label: 'Grift (5)',   dice: 5, note: 'A proper long con.' },
      { label: 'Chaos (7)',   dice: 7, note: 'When the plan goes sideways.' },
      { label: 'All in (10)', dice: 10, note: 'The whole crew, everything staked.' }
    ]
  },
  tokens: [
    { label: 'Bastard', color: '#2e8b57' },
    { label: 'Mark',    color: '#c9a227' },
    { label: 'Guard',   color: '#3a6ea5' },
    { label: 'Capa',    color: '#7a1f1f' },
    { label: 'Bondsmage', color: '#8e44ad' },
    { label: 'Contract', color: '#b0b0b0' }
  ],
  maps: [],
  sheet: [
    { group: 'Identity', fields: [
      { key: 'name',  label: 'Name / Alias', type: 'text', default: '' },
      { key: 'crew',  label: 'Crew role', type: 'select', default: 'Face',
        options: ['Face','Sneak','Muscle','Wheelman','Bondsmage','Fixer','Garrista','Pezon (initiate)'] }
    ]},
    { group: 'The Con', fields: [
      { key: 'guile',    label: 'Guile (deception)',   type: 'number', default: 2 },
      { key: 'nerve',    label: 'Nerve (composure)',   type: 'number', default: 2 },
      { key: 'finesse',  label: 'Finesse (theft)',     type: 'number', default: 2 },
      { key: 'prowess',  label: 'Prowess (violence)',  type: 'number', default: 2 }
    ]},
    { group: 'Standing', fields: [
      { key: 'coin',   label: 'Coin (crowns)', type: 'number', default: 0 },
      { key: 'heat',   label: 'Heat (attention)', type: 'track', default: 0, max: 10 },
      { key: 'health', label: 'Health', type: 'track', default: 10, max: 10 },
      { key: 'notes',  label: 'The Plan', type: 'textarea', default: '' }
    ]}
  ],
  lore: [
    { title: 'The Secret Peace', body:
      'Camorr’s underworld runs on a pact between the crime lord **Capa Barsavi** and the **Duke’s** court: thieves prey on commoners, never on nobility. The **Gentleman Bastards** quietly break that rule, robbing the aristocracy blind while pretending to be small-time.' },
    { title: 'The Crew', body:
      '**Locke Lamora** — the Thorn of Camorr, a genius grifter. **Jean Tannen** — muscle and loyal heart, master of the Wicked Sisters (hatchets). **The Sanza twins** (Calo & Galdo), and **Bug**, the young apprentice. Trained by the blind priest **Father Chains**.' },
    { title: 'Bondsmagi', body:
      'The sorcerers of **Karthain** — impossibly powerful, impossibly expensive, and murderously protective of their own. Knowing a Bondsmage’s true name gives power over them. The **Falconer** is the crew’s deadliest foe.' }
  ]
}

];
