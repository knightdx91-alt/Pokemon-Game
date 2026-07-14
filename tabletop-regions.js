/* Pokémon Tabletop — Johto, Hoenn & Sinnoh region campaigns.
   ────────────────────────────────────────────────────────────────────────
   Each is a full open-world region journey (like Kanto): a town hub you travel
   from, 8 Gyms with multi-Pokémon leaders in your own order, a BRANCHING
   villain-team arc (storm in vs. infiltrate) whose choice changes the ENDING,
   an Elite Four + Champion gauntlet gated behind all 8 badges, and a team that
   auto-levels/heals across the whole run.

   Built with buildRegion(spec) to keep every region consistent. All rosters use
   species confirmed present in the PTA3 Dex. Attaches campaigns to the 'pta'
   game. Load after tabletop-pta.js (+ dex).
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  var pta=(window.TABLETOP_GAMES||[]).filter(function(g){return g.id==='pta';})[0];
  if(!pta) return;

  function buildRegion(spec){
    var scenes={};
    var badges=spec.gyms.map(function(g){return g.badge;});

    scenes.intro={ type:'story', title:spec.startTown,
      text:spec.intro, choices:[{label:'Choose your starter',to:'starter'}] };
    scenes.starter={ type:'starter', title:'Choose Your Partner', text:'Three Poké Balls await.', to:'gift',
      options:spec.starters };
    scenes.gift={ type:'reward', title:'A Trainer’s Start', give:{balls:5,potions:3},
      text:spec.profName+' hands you five **Poké Balls** and some **Potions**. “The road is yours — good luck!”',
      to:'hub', cont:'Set out' };

    // hub
    var hubChoices=[
      {label:'🌿 '+spec.route1.name+' — catch & train',to:'route1'},
      {label:'🌊 '+spec.route2.name+' — catch & train',to:'route2'}
    ];
    spec.gyms.forEach(function(g){
      var ch={label:g.icon+' '+g.town+' Gym — '+g.leader+' ('+g.type+')',to:g.key+'_intro'};
      if(g.blockedByVillain){ ch.need=['villain_cleared']; ch.needMsg=spec.villain.blockMsg; }
      hubChoices.push(ch);
    });
    hubChoices.push({label:'🕵 '+spec.villain.name+' — '+spec.villain.place,to:'villain_hideout'});
    hubChoices.push({label:'🏆 Pokémon League',need:badges,needMsg:'Requires all 8 badges',to:'league_gate'});
    hubChoices.push({label:'🏥 Rest at a Pokémon Center',to:'heal'});
    scenes.hub={ type:'story', title:spec.region+' (Badges: {badges}/8)',
      text:'The region opens before you. Where to?\n\n*Travel as you like — Gyms can be taken in your own order (mind the levels). The League opens at eight badges.*',
      choices:hubChoices };
    scenes.heal={ type:'reward', title:'Pokémon Center', give:{heal:true},
      text:'“Your Pokémon are fully healed!”', to:'hub', cont:'Back to the road' };

    scenes.route1={ type:'battle', title:spec.route1.name, enemy:{n:spec.route1.mon,level:spec.route1.level}, catchable:true, win:'hub', lose:'whiteout' };
    scenes.route2={ type:'battle', title:spec.route2.name, enemy:{n:spec.route2.mon,level:spec.route2.level}, catchable:true, win:'hub', lose:'whiteout' };

    // gyms
    spec.gyms.forEach(function(g){
      scenes[g.key+'_intro']={ type:'story', title:g.town+' Gym',
        text:'**'+g.town+' Gym** — Leader **'+g.leader+'**, master of **'+g.type+'**-types. “'+(g.quote||'Show me your bond with your Pokémon!')+'”',
        choices:[{label:'Battle '+g.leader+'!',to:g.key+'_fight'},{label:'Not yet — leave',to:'hub'}] };
      scenes[g.key+'_fight']={ type:'battle', title:g.leader+' — '+g.type+' Gym', foe:g.leader, team:g.team, win:g.key+'_win', lose:'whiteout' };
      scenes[g.key+'_win']={ type:'story', title:'Badge Won!',
        text:'You defeated **'+g.leader+'**! You receive the **'+g.badgeName+' Badge**.',
        choices:[{label:'Take the badge',set:g.badge,to:'heal'}] };
    });

    // villain arc (branching)
    var v=spec.villain;
    scenes.villain_hideout={ type:'story', title:v.name,
      text:v.hideoutText, choices:[
        {label:'Storm in and fight through',to:'villain_grunts'},
        {label:'Slip in disguised *(Stealth, DC 16)*',check:{stat:'dex',dc:16,success:'villain_spy',fail:'villain_grunts'}}
      ] };
    scenes.villain_spy={ type:'story', title:'In Plain Sight',
      text:'You pull on a stolen uniform and walk in unchallenged. You’ll learn '+v.name+'’s secrets from the inside — knowledge that will matter at the very end.',
      choices:[{label:'Find the leader',set:'infiltrated',to:'villain_boss'}] };
    scenes.villain_grunts={ type:'battle', title:v.name+' Grunts', foe:v.name+' Grunt', team:v.grunts, win:'villain_boss', lose:'whiteout' };
    scenes.villain_boss={ type:'battle', title:v.bossName, foe:v.bossName, team:v.boss, win:'villain_clear', lose:'whiteout' };
    scenes.villain_clear={ type:'story', title:v.name+' Routed',
      text:v.clearText, choices:[{label:'Leave',set:'villain_cleared',to:'heal'}] };

    // league
    scenes.league_gate={ type:'story', title:'The Pokémon League',
      text:'Eight badges. The **'+spec.leaguePlace+'** rises ahead — the Elite Four, then the Champion. No healing between them. Ready your team.',
      choices:[{label:'Enter the Hall of the Elite',to:'e4_0'},{label:'Step back and prepare',to:'heal'}] };
    spec.e4.forEach(function(m,i){
      scenes['e4_'+i]={ type:'battle', title:'Elite Four — '+m.name+' ('+m.type+')', foe:m.name, team:m.team,
        win: i+1<spec.e4.length?'e4_'+(i+1):'champion_intro', lose:'whiteout' };
    });
    scenes.champion_intro={ type:'story', title:'The Champion',
      text:spec.championIntro, choices:[{label:'For the title — battle!',to:'champion_fight'}] };
    scenes.champion_fight={ type:'battle', title:'Champion '+spec.champion.name, foe:spec.champion.name, team:spec.champion.team,
      win:'ending_route', lose:'whiteout' };
    scenes.ending_route={ type:'branch', on:{ infiltrated:'ending_spy' }, else:'ending_win' };
    scenes.ending_win={ type:'end', title:'Champion of '+spec.region, text:spec.endWin };
    scenes.ending_spy={ type:'end', title:'Champion of '+spec.region, text:spec.endSpy };

    scenes.whiteout={ type:'story', title:'Whited Out',
      text:'Your last Pokémon faints and the world goes white… You wake at a Pokémon Center, your team healed. Your badges and everything you’ve caught are safe.',
      choices:[{label:'Heal and continue',to:'heal'}] };

    pta.campaigns.push({ id:spec.id, title:spec.title, blurb:spec.blurb, start:'intro', scenes:scenes });
  }

  pta.campaigns = pta.campaigns || [];

  /* ═══════════════ JOHTO ═══════════════ */
  buildRegion({
    id:'johto', region:'Johto', title:'Johto: The Gold & Silver Road',
    blurb:'The Johto journey — eight Gyms from Violet to Blackthorn, a resurgent Team Rocket to break, and the Elite Four with Champion Lance. Travel where you like; your team grows the whole way.',
    startTown:'New Bark Town', profName:'Professor Elm', leaguePlace:'Indigo Plateau',
    intro:'**Professor Elm’s** lab in New Bark Town hums with machines. “Johto’s eight Gyms and the League await — and there are whispers Team Rocket is stirring again. But first, choose a partner for the road.”',
    starters:[{n:'Chikorita',level:5,note:'Grass'},{n:'Cyndaquil',level:5,note:'Fire'},{n:'Totodile',level:5,note:'Water'}],
    route1:{name:'Route 30 grass',mon:'Pidgey',level:6}, route2:{name:'Ilex Forest',mon:'Caterpie',level:8},
    gyms:[
      {key:'g1',leader:'Falkner',type:'Flying',town:'Violet',badge:'badge_zephyr',badgeName:'Zephyr',icon:'🕊',team:[{n:'Pidgey',level:9},{n:'Pidgeotto',level:11}]},
      {key:'g2',leader:'Bugsy',type:'Bug',town:'Azalea',badge:'badge_hive',badgeName:'Hive',icon:'🐛',team:[{n:'Metapod',level:14},{n:'Kakuna',level:14},{n:'Scyther',level:16}]},
      {key:'g3',leader:'Whitney',type:'Normal',town:'Goldenrod',badge:'badge_plain',badgeName:'Plain',icon:'🐄',team:[{n:'Clefairy',level:18},{n:'Snorlax',level:20}]},
      {key:'g4',leader:'Morty',type:'Ghost',town:'Ecruteak',badge:'badge_fog',badgeName:'Fog',icon:'👻',team:[{n:'Gastly',level:21},{n:'Haunter',level:21},{n:'Haunter',level:23},{n:'Gengar',level:25}]},
      {key:'g5',leader:'Chuck',type:'Fighting',town:'Cianwood',badge:'badge_storm',badgeName:'Storm',icon:'🥊',team:[{n:'Primeape',level:29},{n:'Poliwrath',level:31}]},
      {key:'g6',leader:'Jasmine',type:'Steel',town:'Olivine',badge:'badge_mineral',badgeName:'Mineral',icon:'⚙',team:[{n:'Magnemite',level:30},{n:'Magnemite',level:30},{n:'Steelix',level:35}]},
      {key:'g7',leader:'Pryce',type:'Ice',town:'Mahogany',badge:'badge_glacier',badgeName:'Glacier',icon:'❄',blockedByVillain:true,team:[{n:'Seel',level:27},{n:'Dewgong',level:29},{n:'Piloswine',level:31}]},
      {key:'g8',leader:'Clair',type:'Dragon',town:'Blackthorn',badge:'badge_rising',badgeName:'Rising',icon:'🐉',team:[{n:'Dragonair',level:37},{n:'Dragonair',level:37},{n:'Dragonair',level:37},{n:'Kingdra',level:40}]}
    ],
    villain:{ name:'Team Rocket', place:'Mahogany Hideout', blockMsg:'Mahogany is locked down — break Team Rocket first',
      hideoutText:'Beneath a Mahogany souvenir shop, **Team Rocket** has regrouped without Giovanni, running a signal to call him back. Two ways in.',
      grunts:[{n:'Rattata',level:24},{n:'Zubat',level:24},{n:'Koffing',level:26}],
      bossName:'Rocket Executive', boss:[{n:'Golbat',level:28},{n:'Weezing',level:28},{n:'Houndoom',level:32}],
      clearText:'The Rocket signal dies and the grunts scatter. Mahogany is free — and you’ve seen how deep the rot goes.' },
    e4:[
      {name:'Will',type:'Psychic',team:[{n:'Xatu',level:40},{n:'Exeggutor',level:42},{n:'Slowbro',level:41},{n:'Jynx',level:41},{n:'Xatu',level:44}]},
      {name:'Koga',type:'Poison',team:[{n:'Muk',level:42},{n:'Weezing',level:43},{n:'Golbat',level:44},{n:'Ariados',level:44}]},
      {name:'Bruno',type:'Fighting',team:[{n:'Onix',level:44},{n:'Hitmonlee',level:46},{n:'Hitmonchan',level:46},{n:'Machamp',level:48}]},
      {name:'Karen',type:'Dark',team:[{n:'Murkrow',level:47},{n:'Gengar',level:47},{n:'Houndoom',level:49},{n:'Umbreon',level:50}]}
    ],
    championIntro:'At the summit waits **Lance**, the Dragon Master, now Champion. “I’ve been waiting for a Trainer strong enough. Show me the bond you’ve forged — come!”',
    champion:{name:'Lance',team:[{n:'Gyarados',level:52},{n:'Dragonair',level:52},{n:'Charizard',level:54},{n:'Dragonite',level:52},{n:'Dragonite',level:56}]},
    endWin:'Lance’s last Dragonite crashes down. **You are the Champion of Johto.** Elm, your rival, and every Pokémon you raised from New Bark stand with you.\n\n**Campaign complete.** Kanto’s Gyms are said to still stand across the sea…',
    endSpy:'Lance falls — and because you walked Team Rocket’s halls from the inside, you hand Lance the names and the frequency Rocket used to call Giovanni home. The organization is gutted for good. **You are the Champion of Johto**, and the one who ended Rocket for real.\n\n**Campaign complete.**'
  });

  /* ═══════════════ HOENN ═══════════════ */
  buildRegion({
    id:'hoenn', region:'Hoenn', title:'Hoenn: The Land & Sea Road',
    blurb:'The Hoenn journey — eight Gyms from Rustboro to Sootopolis, a doomsday team bent on waking a legendary titan, and the Elite Four with Champion Steven. Sea, volcano, and sky.',
    startTown:'Littleroot Town', profName:'Professor Birch', leaguePlace:'Ever Grande City',
    intro:'**Professor Birch** waves you over in Littleroot. “Hoenn is half ocean and full of secrets — eight Gyms, a League, and a team that means to wake something that should stay sleeping. Pick a partner and let’s begin!”',
    starters:[{n:'Treecko',level:5,note:'Grass'},{n:'Torchic',level:5,note:'Fire'},{n:'Mudkip',level:5,note:'Water'}],
    route1:{name:'Route 101 grass',mon:'Poochyena',level:6}, route2:{name:'Petalburg Woods',mon:'Zubat',level:8},
    gyms:[
      {key:'g1',leader:'Roxanne',type:'Rock',town:'Rustboro',badge:'badge_stone',badgeName:'Stone',icon:'🪨',team:[{n:'Geodude',level:14},{n:'Nosepass',level:15}]},
      {key:'g2',leader:'Brawly',type:'Fighting',town:'Dewford',badge:'badge_knuckle',badgeName:'Knuckle',icon:'🥊',team:[{n:'Machop',level:17},{n:'Makuhita',level:18}]},
      {key:'g3',leader:'Wattson',type:'Electric',town:'Mauville',badge:'badge_dynamo',badgeName:'Dynamo',icon:'⚡',team:[{n:'Magnemite',level:20},{n:'Voltorb',level:20},{n:'Magneton',level:23}]},
      {key:'g4',leader:'Flannery',type:'Fire',town:'Lavaridge',badge:'badge_heat',badgeName:'Heat',icon:'🔥',team:[{n:'Slugma',level:24},{n:'Numel',level:24},{n:'Camerupt',level:26}]},
      {key:'g5',leader:'Norman',type:'Normal',town:'Petalburg',badge:'badge_balance',badgeName:'Balance',icon:'⚖',team:[{n:'Vigoroth',level:28},{n:'Slaking',level:31}]},
      {key:'g6',leader:'Winona',type:'Flying',town:'Fortree',badge:'badge_feather',badgeName:'Feather',icon:'🪶',team:[{n:'Swellow',level:31},{n:'Pelipper',level:30},{n:'Altaria',level:33}]},
      {key:'g7',leader:'Tate & Liza',type:'Psychic',town:'Mossdeep',badge:'badge_mind',badgeName:'Mind',icon:'🔮',team:[{n:'Slowbro',level:41},{n:'Xatu',level:41},{n:'Exeggutor',level:42}]},
      {key:'g8',leader:'Juan',type:'Water',town:'Sootopolis',badge:'badge_rain',badgeName:'Rain',icon:'💧',blockedByVillain:true,team:[{n:'Gyarados',level:44},{n:'Kingdra',level:46},{n:'Milotic',level:46}]}
    ],
    villain:{ name:'Team Aqua', place:'Seafloor Cavern', blockMsg:'Sootopolis is sealed by the storm — stop Team Aqua first',
      hideoutText:'In the **Seafloor Cavern**, **Team Aqua** means to wake an ancient titan of the sea and drown the world to make it “pure.” Two ways in.',
      grunts:[{n:'Carvanha',level:30},{n:'Zubat',level:30},{n:'Mightyena',level:32}],
      bossName:'Aqua Leader Archie', boss:[{n:'Mightyena',level:34},{n:'Crobat',level:34},{n:'Sharpedo',level:38}],
      clearText:'You break the awakening ritual and the sea calms. The titan sinks back into legend — for now — and the storm over Sootopolis lifts.' },
    e4:[
      {name:'Sidney',type:'Dark',team:[{n:'Mightyena',level:46},{n:'Sharpedo',level:46},{n:'Cacturne',level:48},{n:'Houndoom',level:49}]},
      {name:'Phoebe',type:'Ghost',team:[{n:'Haunter',level:48},{n:'Gengar',level:51},{n:'Haunter',level:49},{n:'Gengar',level:51}]},
      {name:'Glacia',type:'Ice',team:[{n:'Dewgong',level:50},{n:'Piloswine',level:50},{n:'Abomasnow',level:52},{n:'Walrein',level:53}]},
      {name:'Drake',type:'Dragon',team:[{n:'Altaria',level:52},{n:'Flygon',level:53},{n:'Kingdra',level:53},{n:'Salamence',level:55}]}
    ],
    championIntro:'The final hall belongs to **Steven Stone**, Champion and steel-hearted collector of rare stones. “I’ve wanted to battle a Trainer like you. Let’s give it everything!”',
    champion:{name:'Steven',team:[{n:'Steelix',level:57},{n:'Aggron',level:56},{n:'Claydol',level:55},{n:'Salamence',level:58},{n:'Metagross',level:58}]},
    endWin:'Metagross falls and Steven laughs, delighted. **You are the Champion of Hoenn.** From Littleroot to the top of Ever Grande, your whole team stands beside you.\n\n**Campaign complete.**',
    endSpy:'Steven falls — and from your time inside Team Aqua you hand Hoenn’s authorities the cavern maps and the titan’s waking-ritual so it can never be attempted again. **You are the Champion of Hoenn**, and the reason the sea will stay asleep.\n\n**Campaign complete.**'
  });

  /* ═══════════════ SINNOH ═══════════════ */
  buildRegion({
    id:'sinnoh', region:'Sinnoh', title:'Sinnoh: The Diamond & Pearl Road',
    blurb:'The Sinnoh journey — eight Gyms from Oreburgh to Sunyshore, a cult that would remake reality itself, and the Elite Four with Champion Cynthia. The coldest, highest road of all.',
    startTown:'Twinleaf Town', profName:'Professor Rowan', leaguePlace:'Pokémon League',
    intro:'**Professor Rowan** studies you gravely in Twinleaf. “Sinnoh’s myths are older than most — and Team Galactic would tear the world apart to rebuild it. Eight Gyms, a League, and a great deal at stake. Choose your partner.”',
    starters:[{n:'Turtwig',level:5,note:'Grass'},{n:'Chimchar',level:5,note:'Fire'},{n:'Piplup',level:5,note:'Water'}],
    route1:{name:'Route 201 grass',mon:'Starly',level:6}, route2:{name:'Ravaged Path',mon:'Zubat',level:8},
    gyms:[
      {key:'g1',leader:'Roark',type:'Rock',town:'Oreburgh',badge:'badge_coal',badgeName:'Coal',icon:'⛏',team:[{n:'Geodude',level:12},{n:'Onix',level:12},{n:'Cranidos',level:14}]},
      {key:'g2',leader:'Gardenia',type:'Grass',town:'Eterna',badge:'badge_forest',badgeName:'Forest',icon:'🌿',team:[{n:'Cherrim',level:20},{n:'Turtwig',level:19},{n:'Roserade',level:22}]},
      {key:'g3',leader:'Maylene',type:'Fighting',town:'Veilstone',badge:'badge_cobble',badgeName:'Cobble',icon:'🥋',team:[{n:'Meditite',level:27},{n:'Machoke',level:27},{n:'Lucario',level:30}]},
      {key:'g4',leader:'Crasher Wake',type:'Water',town:'Pastoria',badge:'badge_fen',badgeName:'Fen',icon:'🌊',team:[{n:'Gyarados',level:27},{n:'Quagsire',level:27},{n:'Poliwrath',level:30}]},
      {key:'g5',leader:'Fantina',type:'Ghost',town:'Hearthome',badge:'badge_relic',badgeName:'Relic',icon:'👻',team:[{n:'Duskull',level:32},{n:'Haunter',level:34},{n:'Mismagius',level:36}]},
      {key:'g6',leader:'Byron',type:'Steel',town:'Canalave',badge:'badge_mine',badgeName:'Mine',icon:'⚙',team:[{n:'Magneton',level:37},{n:'Steelix',level:38},{n:'Bastiodon',level:41}]},
      {key:'g7',leader:'Candice',type:'Ice',town:'Snowpoint',badge:'badge_icicle',badgeName:'Icicle',icon:'❄',blockedByVillain:true,team:[{n:'Sneasel',level:40},{n:'Piloswine',level:40},{n:'Abomasnow',level:42},{n:'Weavile',level:44}]},
      {key:'g8',leader:'Volkner',type:'Electric',town:'Sunyshore',badge:'badge_beacon',badgeName:'Beacon',icon:'⚡',team:[{n:'Raichu',level:46},{n:'Magneton',level:47},{n:'Luxray',level:49}]}
    ],
    villain:{ name:'Team Galactic', place:'Galactic HQ', blockMsg:'Snowpoint is cut off — stop Team Galactic first',
      hideoutText:'In **Galactic HQ**, boss **Cyrus** would use captured legendary power to erase this flawed world and remake it without spirit or strife. Two ways in.',
      grunts:[{n:'Zubat',level:38},{n:'Golbat',level:38},{n:'Toxicroak',level:40}],
      bossName:'Galactic Boss Cyrus', boss:[{n:'Sneasel',level:42},{n:'Crobat',level:42},{n:'Gyarados',level:44},{n:'Houndoom',level:46}],
      clearText:'You shatter the machine before it can seize the legend’s power. Cyrus vanishes into the tear he opened, and the world stays whole — but you’ve looked into the void he wanted to make.' },
    e4:[
      {name:'Aaron',type:'Bug',team:[{n:'Scyther',level:53},{n:'Ariados',level:53},{n:'Drapion',level:57},{n:'Roserade',level:54}]},
      {name:'Bertha',type:'Ground',team:[{n:'Quagsire',level:55},{n:'Hippowdon',level:59},{n:'Gastrodon',level:56},{n:'Rhydon',level:55}]},
      {name:'Flint',type:'Fire',team:[{n:'Rapidash',level:58},{n:'Infernape',level:61},{n:'Houndoom',level:57},{n:'Magmar',level:57}]},
      {name:'Lucian',type:'Psychic',team:[{n:'Kadabra',level:59},{n:'Slowbro',level:60},{n:'Gengar',level:59},{n:'Alakazam',level:63}]}
    ],
    championIntro:'And then — **Cynthia**, the Champion, brilliant and warm and utterly without weakness. “I’ve been looking forward to this. Don’t hold back — I certainly won’t!”',
    champion:{name:'Cynthia',team:[{n:'Roserade',level:60},{n:'Gastrodon',level:60},{n:'Lucario',level:63},{n:'Milotic',level:63},{n:'Garchomp',level:66}]},
    endWin:'Garchomp falls at the last, and Cynthia smiles as if you’ve given her a gift. **You are the Champion of Sinnoh** — the highest, coldest road walked to its end, your whole team beside you.\n\n**Campaign complete.**',
    endSpy:'Cynthia falls — and because you walked Galactic’s halls from within, you give her and Rowan Cyrus’s notes on the legend’s power, so no one can ever finish what he began. **You are the Champion of Sinnoh**, and the keeper of a secret that keeps the world whole.\n\n**Campaign complete.**'
  });

})();
