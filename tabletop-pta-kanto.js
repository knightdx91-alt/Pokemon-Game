/* Pokémon Tabletop — "Kanto: The Indigo Road" (open-world region campaign).
   ────────────────────────────────────────────────────────────────────────
   A long, open-ended Kanto journey for the PTA world, run by tabletop-engine.js:
   pick where to go from a town hub, take the 8 Gyms in (mostly) your own order,
   clear a branching Team Rocket arc, then challenge the Elite Four once you hold
   all eight badges. Gym Leaders and the Elite Four field multi-Pokémon teams;
   your team auto-levels and heals at Centers.

   Uses the engine's battle scenes with `team:[{n,level}...]` + `foe` label for
   trainer teams, badge flags (badge_*), the {badges} text token, and choice
   gating via need:['flag',...]. Attaches to the 'pta' game as a campaign.
   Load after tabletop-pta.js (and tabletop-pta-dex.js).
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  var pta=(window.TABLETOP_GAMES||[]).filter(function(g){return g.id==='pta';})[0];
  if(!pta) return;

  var ALL_BADGES=['badge_boulder','badge_cascade','badge_thunder','badge_rainbow',
                  'badge_soul','badge_marsh','badge_volcano','badge_earth'];

  // helper: a gym as three scenes (intro → battle → win-sets-badge → hub)
  function gym(key, leader, type, town, badge, team){
    var o={};
    o[key+'_intro']={ type:'story', title:town+' Gym', text:
      '**'+town+' Gym** — Leader **'+leader+'**, master of **'+type+'**-types. “Show me the bond between you and your Pokémon!”',
      choices:[{label:'Battle '+leader+'!',to:key+'_fight'},{label:'Not yet — leave',to:'hub'}] };
    o[key+'_fight']={ type:'battle', title:leader+' — '+type+' Gym', foe:leader, team:team,
      win:key+'_win', lose:'whiteout' };
    o[key+'_win']={ type:'story', title:'Badge Won!', text:
      'You defeated **'+leader+'**! You receive a badge and your Pokémon feel stronger.',
      choices:[{label:'Take the badge and go',set:badge,to:'heal'}] };
    return o;
  }

  var scenes = {
    intro:{ type:'story', title:'Pallet Town',
      text:'The screen glows in **Professor Oak’s** lab. “The world of Pokémon awaits! Kanto has eight Gyms and a Pokémon League — but the road is yours to walk as you please. First: your partner.”',
      choices:[{label:'Choose your starter',to:'starter'}] },
    starter:{ type:'starter', title:'Choose Your Partner', text:'Three Poké Balls wait on the table.', to:'oak_gift',
      options:[{n:'Bulbasaur',level:5,note:'Grass/Poison'},{n:'Charmander',level:5,note:'Fire'},{n:'Squirtle',level:5,note:'Water'}] },
    oak_gift:{ type:'reward', title:'A Trainer’s Start', give:{balls:5,potions:3},
      text:'Oak hands you five **Poké Balls** and a few **Potions**. “Off you go. Come back a Champion.”', to:'hub', cont:'Set out' },

    // ── The open-world hub ──
    hub:{ type:'story', title:'The Road (Badges: {badges}/8)',
      text:'Kanto opens before you. Where to?\n\n*Wild routes let you catch and train. Gyms can be taken in your own order — mind the levels. The League opens when you hold all eight badges.*',
      choices:[
        {label:'🌿 Route grass — catch & train',to:'route_grass'},
        {label:'🌊 Route water — catch & train',to:'route_water'},
        {label:'🪨 Rock tunnel — catch & train',to:'route_cave'},
        {label:'🥊 Pewter Gym — Brock (Rock)',to:'pewter_intro'},
        {label:'💧 Cerulean Gym — Misty (Water)',to:'cerulean_intro'},
        {label:'⚡ Vermilion Gym — Lt. Surge (Electric)',to:'vermilion_intro'},
        {label:'🌸 Celadon Gym — Erika (Grass)',to:'celadon_intro'},
        {label:'🕵 Team Rocket — Game Corner',to:'rocket_hideout'},
        {label:'🔮 Saffron Gym — Sabrina (needs Rocket cleared)',need:['rocket_cleared'],needMsg:'Silph Co. is occupied — clear Team Rocket first',to:'saffron_intro'},
        {label:'☠ Fuchsia Gym — Koga (Poison)',to:'fuchsia_intro'},
        {label:'🔥 Cinnabar Gym — Blaine (Fire)',to:'cinnabar_intro'},
        {label:'🌍 Viridian Gym — Giovanni (Ground)',to:'viridian_intro'},
        {label:'🏆 Pokémon League — Victory Road',need:ALL_BADGES,needMsg:'Requires all 8 badges',to:'league_gate'},
        {label:'🏥 Rest at a Pokémon Center',to:'heal'}
      ] },
    heal:{ type:'reward', title:'Pokémon Center', give:{heal:true},
      text:'“Your Pokémon are fully healed! We hope to see you again.”', to:'hub', cont:'Back to the road' },

    // ── Wild routes (catchable) ──
    route_grass:{ type:'battle', title:'Tall Grass', enemy:{n:'Pidgey',level:6}, catchable:true, win:'hub', lose:'whiteout' },
    route_water:{ type:'battle', title:'Waterside', enemy:{n:'Poliwag',level:8}, catchable:true, win:'hub', lose:'whiteout' },
    route_cave:{ type:'battle', title:'Rock Tunnel', enemy:{n:'Zubat',level:10}, catchable:true, win:'hub', lose:'whiteout' },

    // ── Team Rocket arc (branching) ──
    rocket_hideout:{ type:'story', title:'The Rocket Hideout',
      text:'Beneath the Celadon Game Corner, **Team Rocket** runs its rackets. Two ways in.',
      choices:[
        {label:'Storm in and fight your way through',to:'rocket_grunts'},
        {label:'Slip in disguised as a grunt *(Stealth, DC 16)*',check:{stat:'dex',dc:16,success:'rocket_spy',fail:'rocket_grunts'}}
      ] },
    rocket_spy:{ type:'story', title:'In Plain Sight',
      text:'You pull a stolen uniform over your clothes and walk right past the guards. Whatever happens at the League, you’ll know Rocket’s secrets from the inside.',
      choices:[{label:'Find the Rocket Admin',set:'rocket_infiltrated',to:'rocket_admin'}] },
    rocket_grunts:{ type:'battle', title:'Rocket Grunts', foe:'Rocket Grunt',
      team:[{n:'Rattata',level:14},{n:'Zubat',level:14},{n:'Ekans',level:16}], win:'rocket_admin', lose:'whiteout' },
    rocket_admin:{ type:'battle', title:'Rocket Admin', foe:'Rocket Admin',
      team:[{n:'Golbat',level:18},{n:'Weezing',level:18},{n:'Arbok',level:20}], win:'rocket_clear', lose:'whiteout' },
    rocket_clear:{ type:'story', title:'Rocket Routed',
      text:'The hideout empties in a scramble of black uniforms. Silph Co. and Saffron City are free — and their leader’s face lingers in your mind. You’ll meet him again in Viridian.',
      choices:[{label:'Leave the hideout',set:'rocket_cleared',to:'heal'}] },

    // ── Elite Four (gated by 8 badges) ──
    league_gate:{ type:'story', title:'Victory Road',
      text:'Eight badges. Victory Road behind you. The **Indigo Plateau** rises ahead — the Elite Four, then the Champion. There is no healing between them. Ready your team.',
      choices:[{label:'Enter the Hall of the Elite',to:'e4_lorelei'},{label:'Step back and prepare',to:'heal'}] },
    e4_lorelei:{ type:'battle', title:'Elite Four — Lorelei (Ice)', foe:'Lorelei',
      team:[{n:'Dewgong',level:52},{n:'Vaporeon',level:52},{n:'Starmie',level:54}], win:'e4_bruno', lose:'whiteout' },
    e4_bruno:{ type:'battle', title:'Elite Four — Bruno (Fighting)', foe:'Bruno',
      team:[{n:'Onix',level:53},{n:'Hitmonlee',level:53},{n:'Hitmonchan',level:53},{n:'Machamp',level:56}], win:'e4_agatha', lose:'whiteout' },
    e4_agatha:{ type:'battle', title:'Elite Four — Agatha (Ghost)', foe:'Agatha',
      team:[{n:'Gengar',level:54},{n:'Golbat',level:54},{n:'Haunter',level:53},{n:'Arbok',level:56}], win:'e4_lance', lose:'whiteout' },
    e4_lance:{ type:'battle', title:'Elite Four — Lance (Dragon)', foe:'Lance',
      team:[{n:'Gyarados',level:56},{n:'Dragonair',level:54},{n:'Dragonair',level:54},{n:'Dragonite',level:60}], win:'champion_intro', lose:'whiteout' },
    champion_intro:{ type:'story', title:'The Champion',
      text:'The last doors open — and there stands your **rival**, who reached the top a step ahead of you. “Took you long enough. Let’s see who the strongest Trainer in Kanto really is!”',
      choices:[{label:'For the title — battle!',to:'champion_fight'}] },
    champion_fight:{ type:'battle', title:'Champion Battle', foe:'Champion',
      team:[{n:'Pidgeot',level:59},{n:'Alakazam',level:57},{n:'Rhydon',level:58},{n:'Arcanine',level:58},{n:'Gyarados',level:60}],
      win:'ending', lose:'whiteout' },
    ending:{ type:'end', title:'Champion of Kanto',
      text:'Your rival’s last Pokémon falls. The hall goes quiet, then roars. **You are the Champion of Kanto.**\n\nProfessor Oak walks in shaking his head and smiling. “Remember this day.” Your team, that started as one small partner in Pallet Town, stands beside you — every one of them yours, tracked and grown across the whole long road.\n\n**Campaign complete.** Johto, Hoenn and Sinnoh await when you’re ready for the next region.' },

    whiteout:{ type:'story', title:'Whited Out',
      text:'Your last Pokémon faints and the world goes white… You wake at the nearest Pokémon Center, your team healed. Your badges and everything you’ve caught are safe — the road is still there.',
      choices:[{label:'Heal and continue',to:'heal'}] }
  };

  // splice in the eight gyms
  [
    gym('pewter','Brock','Rock','Pewter','badge_boulder',[{n:'Geodude',level:10},{n:'Onix',level:12}]),
    gym('cerulean','Misty','Water','Cerulean','badge_cascade',[{n:'Staryu',level:16},{n:'Starmie',level:18}]),
    gym('vermilion','Lt. Surge','Electric','Vermilion','badge_thunder',[{n:'Voltorb',level:20},{n:'Pikachu',level:18},{n:'Raichu',level:22}]),
    gym('celadon','Erika','Grass','Celadon','badge_rainbow',[{n:'Victreebel',level:24},{n:'Tangela',level:24},{n:'Vileplume',level:26}]),
    gym('saffron','Sabrina','Psychic','Saffron','badge_marsh',[{n:'Kadabra',level:30},{n:'Venomoth',level:32},{n:'Alakazam',level:36}]),
    gym('fuchsia','Koga','Poison','Fuchsia','badge_soul',[{n:'Koffing',level:28},{n:'Muk',level:30},{n:'Weezing',level:32}]),
    gym('cinnabar','Blaine','Fire','Cinnabar','badge_volcano',[{n:'Growlithe',level:34},{n:'Ponyta',level:36},{n:'Rapidash',level:38},{n:'Arcanine',level:40}]),
    gym('viridian','Giovanni','Ground','Viridian','badge_earth',[{n:'Rhyhorn',level:40},{n:'Dugtrio',level:40},{n:'Nidoqueen',level:42},{n:'Nidoking',level:42},{n:'Rhydon',level:45}])
  ].forEach(function(g){ for(var k in g) scenes[k]=g[k]; });

  pta.campaigns = pta.campaigns || [];
  pta.campaigns.push({
    id:'kanto',
    title:'Kanto: The Indigo Road',
    blurb:'The full Kanto journey — travel where you like, take the eight Gyms in your own order, break Team Rocket, and challenge the Elite Four for the Champion’s title. A long road; your team grows the whole way.',
    start:'intro',
    scenes:scenes
  });
})();
