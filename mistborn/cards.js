// Mistborn: The Deckbuilding Game — card data for the solo (vs. Lord Ruler) engine.
// Derived from docs/deckbuilding/cards.yaml + RULES.md. Effects are structured
// numeric approximations of the paraphrased card summaries (no official card
// text is published). Effect atoms: coin, damage, mission, heal, draw, train,
// refresh, seek (treated as coin-or-mission flex -> mission), eliminate.
//
// Metal keywords: Tin=SENSE Pewter=DEFENDER Bronze=SEEK Copper=CLOUD
//                 Zinc=RIOT Brass=SOOTHE Steel=PUSH Iron=PULL Atium=wild
window.MB_METALS = {
  Steel:  { pair: "Iron",   kw: "PUSH",     color: "#9fb3c8" },
  Iron:   { pair: "Steel",  kw: "PULL",     color: "#7d8894" },
  Pewter: { pair: "Tin",    kw: "DEFENDER", color: "#c9a06a" },
  Tin:    { pair: "Pewter", kw: "SENSE",    color: "#e6e2d3" },
  Bronze: { pair: "Copper", kw: "SEEK",     color: "#b87333" },
  Copper: { pair: "Bronze", kw: "CLOUD",    color: "#d98b5f" },
  Zinc:   { pair: "Brass",  kw: "RIOT",     color: "#b7c4cf" },
  Brass:  { pair: "Zinc",   kw: "SOOTHE",   color: "#d4af37" },
  Atium:  { pair: null,     kw: "WILD",     color: "#c9b3ff" },
};

window.MB_CHARACTERS = [
  { name: "Vin",     metal: "Pewter", sig: "Burn Pewter: +1 damage, +1 coin, +1 health.",
    signature: { damage:1, coin:1, heal:1 }, note: "Flexible & resilient. Top-tier." },
  { name: "Kelsier", metal: "Steel",  sig: "Burn Steel: deal 2 damage.",
    signature: { damage:2 }, note: "Strongest damage + utility metals." },
  { name: "Shan",    metal: "Zinc",   sig: "Burn Zinc: +2 coins.",
    signature: { coin:2 }, note: "Money engine." },
  { name: "Marsh",   metal: "Bronze", sig: "Burn Bronze: +1 mission point.",
    signature: { mission:1 }, note: "Mission / Seek focused." },
];

window.MB_MISSIONS = [
  { name: "Canton of Orthodoxy", tier: "S", desc: "Eliminate cards as you gain mission points." },
  { name: "Keep Venture",        tier: "S", desc: "Gold checkpoints; permanent +2 gold/turn on completion.", reward: { coinPerTurn: 2 } },
  { name: "Luthadel Garrison",   tier: "A", desc: "Damage rewards; permanent +2 damage/turn.", reward: { damagePerTurn: 2 } },
  { name: "Kredik Shaw",         tier: "A", desc: "Draw rewards; permanent +1 card draw/turn.", reward: { drawPerTurn: 1 } },
  { name: "Luthadel Rooftops",   tier: "B", desc: "Speeds reaching more metal burns/turn.", reward: { burnPerTurn: 1 } },
  { name: "Skaa Caverns",        tier: "B", desc: "Refresh metals; permanent extra metal burn.", reward: { burnPerTurn: 1 } },
  { name: "Crew Hideout",        tier: "C", desc: "Healing across the track.", reward: { healPerTurn: 2 } },
  { name: "Pits of Hathsin",     tier: "D", desc: "Grants Atium on completion.", reward: { atium: 2 } },
];

// Market action & ally cards. eff = effect when you burn the card's metal.
// vial = coin value when played sideways as fuel (approx). ally: persists.
window.MB_MARKET = [
  // TIN — SENSE
  { name:"Investigate", cost:3, metal:"Tin", eff:{coin:3}, vial:1 },
  { name:"Eavesdrop",   cost:4, metal:"Tin", eff:{mission:1, coin:1}, vial:1 },
  { name:"Lookout",     cost:4, metal:"Tin", eff:{draw:2}, vial:1 },
  { name:"Spy",         cost:5, metal:"Tin", eff:{draw:1, coin:1}, vial:1 },
  { name:"Hyperaware",  cost:6, metal:"Tin", eff:{mission:3, draw:1}, vial:2 },
  { name:"Houselord",   cost:3, metal:"Tin", ally:true, shield:2, eff:{coin:2} },
  { name:"Tineye",      cost:5, metal:"Tin", ally:true, shield:2, eff:{mission:1} },
  // PEWTER — DEFENDER
  { name:"Strike",      cost:2, metal:"Pewter", eff:{damage:2}, vial:1 },
  { name:"Survive",     cost:3, metal:"Pewter", eff:{heal:6}, vial:1 },
  { name:"Recover",     cost:2, metal:"Pewter", eff:{coin:2, heal:2}, vial:1 },
  { name:"Brawl",       cost:4, metal:"Pewter", eff:{damage:3, coin:1}, vial:2 },
  { name:"Crushing Blow",cost:6,metal:"Pewter", eff:{damage:6, heal:8}, vial:2 },
  { name:"Soldier",     cost:2, metal:"Pewter", ally:true, defender:true, shield:2, eff:{heal:2, damage:1} },
  { name:"Pewterarm",   cost:4, metal:"Pewter", ally:true, defender:true, shield:3, eff:{heal:3, damage:1} },
  // BRONZE — SEEK
  { name:"Hunt",        cost:2, metal:"Bronze", eff:{mission:2}, vial:1 },
  { name:"Unveil",      cost:5, metal:"Bronze", eff:{mission:3}, vial:1 },
  { name:"Pursue",      cost:3, metal:"Bronze", eff:{train:1, mission:1}, vial:1 },
  { name:"Infiltrate",  cost:3, metal:"Bronze", eff:{train:1, coin:1}, vial:1 },
  { name:"Pierce",      cost:6, metal:"Bronze", eff:{mission:3, damage:2}, vial:2 },
  { name:"Obligator",   cost:3, metal:"Bronze", ally:true, shield:2, eff:{coin:2} },
  { name:"Seeker",      cost:5, metal:"Bronze", ally:true, shield:2, eff:{mission:2} },
  // COPPER — CLOUD
  { name:"Coppercloud", cost:2, metal:"Copper", eff:{heal:3}, vial:1 },
  { name:"Hide",        cost:4, metal:"Copper", eff:{heal:3, damage:1}, vial:2 },
  { name:"Sneak",       cost:3, metal:"Copper", eff:{train:1, heal:2}, vial:1 },
  { name:"Train in Secret",cost:3,metal:"Copper", eff:{train:1, draw:1}, vial:1 },
  { name:"Strategize",  cost:6, metal:"Copper", eff:{train:1, heal:2, coin:2, damage:1}, vial:2 },
  { name:"Keeper",      cost:2, metal:"Copper", ally:true, shield:2, eff:{draw:1} },
  { name:"Smoker",      cost:5, metal:"Copper", ally:true, shield:2, eff:{heal:3} },
  // ZINC — RIOT
  { name:"Enrage",      cost:2, metal:"Zinc", eff:{train:1, coin:1}, vial:1 },
  { name:"Inspire",     cost:3, metal:"Zinc", eff:{coin:3}, vial:2 },
  { name:"Charm",       cost:2, metal:"Zinc", eff:{coin:2, draw:1}, vial:2 },
  { name:"Intimidate",  cost:3, metal:"Zinc", eff:{coin:3}, vial:2 },
  { name:"House War",   cost:4, metal:"Zinc", eff:{draw:2, mission:2}, vial:1 },
  { name:"Rebel",       cost:3, metal:"Zinc", ally:true, shield:2, eff:{coin:2} },
  { name:"Rioter",      cost:5, metal:"Zinc", ally:true, shield:2, eff:{coin:3} },
  // BRASS — SOOTHE
  { name:"Con",         cost:2, metal:"Brass", eff:{train:1, mission:1}, vial:1 },
  { name:"Deceive",     cost:4, metal:"Brass", eff:{coin:2, eliminate:2}, vial:1 },
  { name:"Subdue",      cost:3, metal:"Brass", eff:{eliminate:2, coin:1}, vial:1 },
  { name:"Pacify",      cost:4, metal:"Brass", eff:{train:1, mission:1}, vial:1 },
  { name:"Dominate",    cost:6, metal:"Brass", eff:{mission:3, damage:2}, vial:2 },
  { name:"Informant",   cost:3, metal:"Brass", ally:true, shield:2, eff:{eliminate:1, coin:1} },
  { name:"Soother",     cost:5, metal:"Brass", ally:true, shield:2, eff:{train:1, mission:1} },
  // STEEL — PUSH
  { name:"Soar",        cost:2, metal:"Steel", eff:{coin:2}, vial:1 },
  { name:"Steelpush",   cost:3, metal:"Steel", eff:{damage:3}, vial:1 },
  { name:"Assassinate", cost:3, metal:"Steel", eff:{damage:3, shieldbreak:1}, vial:1 },
  { name:"Precise Shot",cost:3, metal:"Steel", eff:{damage:3}, vial:1 },
  { name:"Maelstrom",   cost:6, metal:"Steel", eff:{damage:5, shieldbreakAll:true}, vial:2 },
  { name:"Mercenary",   cost:3, metal:"Steel", ally:true, shield:2, eff:{damage:2} },
  { name:"Coinshot",    cost:5, metal:"Steel", ally:true, shield:2, eff:{damage:2, shieldbreak:1} },
  // IRON — PULL
  { name:"Ironpull",    cost:2, metal:"Iron", eff:{damage:2, draw:1}, vial:1 },
  { name:"Crash",       cost:4, metal:"Iron", eff:{damage:2, draw:1}, vial:2 },
  { name:"Reposition",  cost:3, metal:"Iron", eff:{damage:2, coin:1}, vial:1 },
  { name:"Rescue",      cost:4, metal:"Iron", eff:{damage:3, coin:2, draw:1}, vial:1 },
  { name:"Ascendant",   cost:6, metal:"Iron", eff:{damage:4, draw:3}, vial:2 },
  { name:"Pickpocket",  cost:2, metal:"Iron", ally:true, shield:2, eff:{coin:2} },
  { name:"Lurcher",     cost:5, metal:"Iron", ally:true, shield:2, eff:{coin:2, damage:1} },
  // NEUTRAL ALLIES (no metal; effect on any burn)
  { name:"Hazekillers", cost:4, metal:null, ally:true, defender:true, shield:3, eff:{heal:2} },
  { name:"Kandra",      cost:6, metal:null, ally:true, shield:3, eff:{mission:3} },
  { name:"Inquisitor",  cost:6, metal:null, ally:true, shield:3, eff:{damage:3} },
  { name:"Noble",       cost:3, metal:null, ally:true, shield:2, eff:{draw:1} },
  { name:"Crewleader",  cost:6, metal:null, ally:true, shield:2, eff:{draw:1, coin:1} },
];

// Atium cards — bought with coins; Confrontation is the alt win.
window.MB_ATIUM = [
  { name:"Confrontation", cost:9, metal:"Atium", eff:{}, confrontation:true },
  { name:"Ruin",          cost:8, metal:"Atium", eff:{damage:7} },
  { name:"Preserve",      cost:8, metal:"Atium", eff:{mission:4, heal:3} },
  { name:"Balance",       cost:8, metal:"Atium", eff:{damage:4, mission:2, heal:2} },
];

// Lord Ruler deck (36): adversaries (minions with shields dealing damage/turn)
// and edicts (dominance up / LR heal / market clear). Built from the three
// noted adversaries + rules-consistent generated entries.
window.MB_LORDRULER = {
  startHealth: 48,
  deckSize: 36,
  buildDeck() {
    const d = [];
    const A = (name, shields, dmg) => ({ type:"adversary", name, shields, maxShields:shields, dmg });
    // Noted brutal adversaries (X scales with Dominance at flip time -> handled in engine)
    d.push(A("Koloss", 5, 6));
    d.push({ type:"adversary", name:"Koloss", scaleShields:true, dmgScale:2 });
    d.push({ type:"adversary", name:"Inquisitor", shields:3, scaleExtra:true, dmgScale:2 });
    // More adversaries
    for (let i=0;i<9;i++) d.push(A(i%2? "Koloss":"Steel Inquisitor", 2+(i%4), 2+(i%3)));
    // Edicts
    for (let i=0;i<15;i++) d.push({ type:"edict", name:"Edict of the Lord Ruler" });
    // Mistwraith / filler adversaries
    for (let i=0;i<9;i++) d.push(A("Mistwraith", 1+(i%3), 1+(i%2)));
    return d;
  }
};
