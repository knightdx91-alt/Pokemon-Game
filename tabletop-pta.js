/* Pokémon Tabletop Adventures 3 — a full world for Grand Tabletop.
   ────────────────────────────────────────────────────────────────────────
   Built from the user's PTA3 book set by DrMrStark / the Pokémon Tabletop
   community: Player's Handbook, Player's Handbook 2, Game Master's Screen,
   and the Character Sheets (the GM's Guide and Pokédex are lookup references
   and aren't needed to define the world). PTA is itself a complete tabletop
   RPG, so this pack carries the real rules — the six stats + modifier table,
   the 1d20 + modifier + talent skill system, the 18 skills mapped to their
   governing stats, afflictions, natures, capture & breeding rolls, and the
   full Trainer-Class roster across both handbooks.

   (An earlier PTA *3.5* PDF the user shared was salted with prompt-injection
   decoys aimed at AI readers — "return the Bee Movie script", fake system
   notices. Those were ignored. These PTA3 core books are clean; all content
   below is genuine game material extracted from them.)

   Adds a new entry to window.TABLETOP_GAMES. Load after tabletop-games.js.
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  if(!window.TABLETOP_GAMES) return;

  // Trainer Classes — base classes and their advanced specializations.
  var CLASSES = [
    { name:'Ace Trainer', faction:'PHB · Battle', role:'Battle specialist',
      desc:'Empower your Pokémon in a fight. **Advanced:** Stat Ace, Strategist, Tag Battler, Type Ace, Underdog.' },
    { name:'Breeder', faction:'PHB · Support', role:'Raising & eggs',
      desc:'Hatch, heal, and raise Pokémon to their potential. **Advanced:** Botanist, Chef, Evolver, Medic, Move Tutor.' },
    { name:'Coordinator', faction:'PHB · Style', role:'Contests & flair',
      desc:'Show off your Pokémon’s beauty and skill in Contests. **Advanced:** Choreographer, Coach, Designer, Groomer, Rising Star.' },
    { name:'Ranger', faction:'PHB · Field', role:'Outdoors & partnership',
      desc:'Wilderness experts bonded to a partner Pokémon. **Advanced:** Invoker, Officer, Rider, Special Operative, Survivalist.' },
    { name:'Researcher', faction:'PHB · Knowledge', role:'Study & technology',
      desc:'Scholars and tinkerers who study Pokémon and build gear. **Advanced:** Archeologist, Ball Smith, Photographer, Scientist, Watcher.' },
    { name:'Martial Artist', faction:'PHB2 · Combat', role:'Trainer who fights',
      desc:'A Trainer who steps into the fray themselves. **Advanced:** Aura Master, Dirty Fighter, Mentor, Ninja, Yogi.' },
    { name:'Psychic', faction:'PHB2 · Power', role:'Human channeler',
      desc:'A human who wields elemental and psychic power directly. **Advanced:** Air Adept, Earth Shaker, Firebreather, Hex Maniac, Rain Waker.' },
    { name:'Pokémon Classes', faction:'PHB2 · Play as a Pokémon', role:'For Pokémon PCs',
      desc:'Classes for playing AS a Pokémon rather than a Trainer: **Champion, Hunter, Support, Vanguard.**' }
  ];

  // The 18 skills, each governed by a stat (from the Character Sheet + GM Screen).
  var SKILLS = [
    ['Athletics','ATK'],
    ['Concentration','DEF'], ['Constitution','DEF'],
    ['Engineering / Operation','SpATK'], ['History','SpATK'], ['Investigate','SpATK'],
    ['Medicine','SpATK'], ['Nature','SpATK'], ['Programming','SpATK'],
    ['Bluff / Deception','SpDEF'], ['Diplomacy / Persuasion','SpDEF'], ['Insight','SpDEF'],
    ['Perception','SpDEF'], ['Perform','SpDEF'], ['Pokémon Handling','SpDEF'],
    ['Acrobatics','SPD'], ['Sleight of Hand','SPD'], ['Stealth','SPD']
  ];
  var skillList = SKILLS.map(function(s){return s[0]+' ('+s[1]+')';});

  var game = {
    id:'pta',
    title:'Pokémon Tabletop',
    tagline:'Gotta roll ’em all — Pokémon Tabletop Adventures.',
    author:'DrMrStark — Pokémon Tabletop Adventures 3',
    accent:'#ee1515', accent2:'#f0c000',
    bg:'radial-gradient(circle at 50% 15%, #2a0f12, #0a0607 70%)',
    emoji:'🔴',
    ready:true,
    dice:{
      mode:'expr',
      note:'PTA skill check: roll 1d20 + stat modifier + talent bonus vs the GM’s difficulty. A natural 20 explodes — roll again and add 20. Talent adds +2 (or +5 if taken twice). You always want to roll HIGH — except d100 rolls (capture, breeding, digging), where you roll LOW.',
      presets:[
        { label:'Skill Check',     expr:'1d20',    note:'+ stat modifier + talent bonus.' },
        { label:'Talented (+2)',   expr:'1d20+2',  note:'You have the talent for this skill.' },
        { label:'Expert (+5)',     expr:'1d20+5',  note:'Talent taken twice.' },
        { label:'Advantage',       expr:'2d20kh1', note:'Roll twice, keep the higher.' },
        { label:'d100 — roll LOW', expr:'1d100',   note:'Capture / breeding / digging — lower is better.' },
        { label:'Move — 2d6',      expr:'2d6',     note:'e.g. Tackle. Pokémon move damage.' },
        { label:'Move — 3d6',      expr:'3d6',     note:'A stronger move.' },
        { label:'Move — 5d12',     expr:'5d12',    note:'A powerful signature move (e.g. Burn Up).' }
      ]
    },
    tokens:[
      { label:'Trainer',    color:'#3a6ea5' },
      { label:'Pokémon',    color:'#f0c000' },
      { label:'Wild',       color:'#2e7d32' },
      { label:'NPC',        color:'#b0b0b0' },
      { label:'Rocket',     color:'#7a1f1f' },
      { label:'Gym Leader', color:'#8e44ad' },
      { label:'Objective',  color:'#ee1515' }
    ],
    maps:[],
    sheet:[
      { group:'Trainer', fields:[
        { key:'name',   label:'Character Name', type:'text', default:'' },
        { key:'class',  label:'Class', type:'select', default:'Ace Trainer',
          options:['Ace Trainer','Breeder','Coordinator','Ranger','Researcher','Martial Artist','Psychic','Pokémon (PC)'] },
        { key:'origin', label:'Origin', type:'text', default:'' },
        { key:'clvl',   label:'Class Level', type:'number', default:1 }
      ]},
      { group:'Stats (value → see modifier table in Rules)', fields:[
        { key:'hp',  label:'Hit Points',       type:'number', default:1 },
        { key:'atk', label:'Attack',           type:'number', default:1 },
        { key:'def', label:'Defense',          type:'number', default:1 },
        { key:'spa', label:'Special Attack',   type:'number', default:1 },
        { key:'spd', label:'Special Defense',  type:'number', default:1 },
        { key:'spe', label:'Speed',            type:'number', default:1 }
      ]},
      { group:'Resources', fields:[
        { key:'curhp',   label:'Current HP', type:'track', default:10, max:10 },
        { key:'honor',   label:'Honor', type:'number', default:0 },
        { key:'credits', label:'Credits (₽)', type:'number', default:1000 },
        { key:'talents', label:'Skill Talents (+2 / +5 skills)', type:'textarea', default:'' }
      ]},
      { group:'Party & Bag', fields:[
        { key:'party', label:'Pokémon party (6)', type:'textarea', default:'' },
        { key:'bag',   label:'Bag / Poké Balls / items', type:'textarea', default:'' },
        { key:'notes', label:'Notes', type:'textarea', default:'' }
      ]}
    ],
    codex: CLASSES.concat([
      { name:'The 18 Skills', faction:'Reference', role:'skill → governing stat',
        desc:skillList.join(' · ')+'. Each skill check is 1d20 + that stat’s modifier + any talent bonus.' },
      { name:'Afflictions', faction:'Reference', role:'status conditions',
        desc:'**Burned** — after acting, lose 1d10 HP; Attack −2 (Fire-types immune). **Poisoned/Toxin** — after acting, lose 1d10 HP; Sp. Atk −2. **Paralyzed** — Speed −2. **Confused** — roll 1d20, 18+ to act. **Asleep / Frozen** — make a save each turn to wake/thaw. **Infatuated** — make an infatuation check to act. **Stunned** — you can’t take turns.' },
      { name:'Natures', faction:'Reference', role:'stat personality',
        desc:'20 natures, each raising one stat and lowering another — e.g. **Adamant** (+Atk, −Sp.Atk), **Modest** (+Sp.Atk, −Atk), **Jolly** (+Spd, −Sp.Atk), **Bold** (+Def, −Atk), **Timid** (+Spd, −Atk), **Calm** (+Sp.Def, −Atk). Roll d20 on the Nature List or choose.' },
      { name:'Capturing', faction:'Reference', role:'catch rules',
        desc:'Base capture rate depends on evolution stage and rarity (● common / ◆ uncommon / ★ rare). Modifiers stack the BEST from each group: **HP** (at max −25, below half +0, under 10 HP +20, at 0 +75); **who started it** (you ambushed it −25, it attacked +0, you struck first knowingly +10); **afflictions** (Burn/Confuse/Infatuate/Poison +10; Freeze/Paralysis/Sleep +15). Roll d100 — roll LOW to catch.' },
      { name:'Breeding', faction:'Reference', role:'egg rules',
        desc:'Two opposite-sex Pokémon sharing an Egg Group, both ≥2 weeks old, who get along and have 4 hours of privacy. Once/day each trainer rolls a **Breeding Check on 1d100 — 15 or lower makes an egg** (+2 to the target per extra hour, up to 5 hours). The child takes its species from the mother and may inherit moves from the father and a nature from either.' }
    ]),
    lore:[
      { title:'How to Play', body:
        'You are a Pokémon **Trainer** (or, with the PHB2 rules, a Pokémon yourself). The GM narrates; you explore, catch and raise Pokémon, and battle. When an outcome is uncertain the GM sets a difficulty and you make a **skill check**. You need dice: **d4, d6, d8, two d10 (for d100), d12, d20**. Always roll **high** — except d100 rolls, where you roll **low**.' },
      { title:'Stats & the Modifier Table', body:
        'Six stats: **Hit Points, Attack, Defense, Special Attack, Special Defense, Speed**. Each stat **value** gives a **modifier**:\n\nValue **1** → **+0** · **2–3** → **+1** · **4–5** → **+2** · **6–7** → **+3** · **8–9** → **+4** · **10–11** → **+5** · **12–13** → **+6** · **14–15** → **+7**.\n\nRaising a stat above 10 is only ever temporary (features, items, or moves).' },
      { title:'Skill Checks & Talents', body:
        'Roll **1d20 + the governing stat’s modifier + any talent bonus**. A **natural 20** explodes: roll again and **add 20** (two nat-20s = **40** + mods). **Talents** are skills you’re good at — +2, or +5 if you can take the same talent twice. **Advantage** = roll twice, keep the higher.' },
      { title:'The 18 Skills (by stat)', body:
        '**Attack:** Athletics.\n**Defense:** Concentration, Constitution.\n**Sp. Attack:** Engineering/Operation, History, Investigate, Medicine, Nature, Programming.\n**Sp. Defense:** Bluff/Deception, Diplomacy/Persuasion, Insight, Perception, Perform, Pokémon Handling.\n**Speed:** Acrobatics, Sleight of Hand, Stealth.' },
      { title:'Trainer Classes', body:
        'Your **Class** is your specialty; each branches into advanced classes as you level.\n\n**Player’s Handbook:** Ace Trainer, Breeder, Coordinator, Ranger, Researcher.\n**Handbook 2:** Martial Artist and Psychic (Trainers who fight/channel directly), plus **Pokémon classes** (Champion, Hunter, Support, Vanguard) for playing as a Pokémon.\n\nSee the **Codex** tab for each class and its specializations.' },
      { title:'Combat & Type Effectiveness', body:
        'On your **Trainer Turn** you move and act; on a **Pokémon Turn** your Pokémon uses a **Move** (roll its damage dice; add the user’s Attack or Sp. Attack). **Type effectiveness adds or removes damage dice** rather than multiplying — super-effective adds dice, resisted removes them, and immune deals none. The standard 18-type chart applies. **Afflictions** (see Codex) and **terrain** modify the fight.' },
      { title:'Beyond the Basics (Handbook 2)', body:
        'Player’s Handbook 2 adds the battle transformations: **Mega Evolution, Z-Moves, Dynamax, Gigantamax, and Terastallization**, plus additional origins, passives, items, and the option to build a Pokémon as a player character.' }
    ]
  };

  window.TABLETOP_GAMES.push(game);
})();
