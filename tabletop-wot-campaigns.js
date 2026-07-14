/* Wheel of Time — five playable campaigns, one per book (1–5).
   ────────────────────────────────────────────────────────────────────────
   Solo branching adventures for the WoT world, run by tabletop-engine.js.
   Narrative scenes with meaningful choices and d20 skill checks (WoT RPG DCs);
   flags you set early change what happens later. Each campaign follows its
   novel's arc and can be played on its own; together they start at Book 1 and
   carry the story forward. Attaches to the 'wot' game as game.campaigns.

   Scene types used: story | check-in-choice | reward (narrative) | end.
   Choices: {label,to} · {label,check:{stat,dc,success,fail}} ·
            {label,set:'flag',to} · {label,need:'flag',to}.
   Load after tabletop-wot.js.
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  var wot=(window.TABLETOP_GAMES||[]).filter(function(g){return g.id==='wot';})[0];
  if(!wot) return;

  /* ═══════════════ BOOK 1 — THE EYE OF THE WORLD ═══════════════ */
  var eotw = {
    id:'eotw', title:'Book 1 — The Eye of the World',
    blurb:'Winternight in the Two Rivers. Trollocs come out of the dark for three young folk of Emond’s Field — and an Aes Sedai spirits you out into a world at war with the Shadow.',
    start:'winternight',
    scenes:{
      winternight:{ type:'story', title:'Winternight',
        text:'A blizzard-cold Bel Tine eve. You are **Rand al’Thor**, walking the Quarry Road when a black-cloaked rider watches you from the mist — and the wind carries no sound of hooves.\n\nThat night, howls split the dark. **Trollocs** — beast-snouted and huge — smash into the farm. Your father Tam is down, a fever-blade wound in his side.',
        choices:[
          { label:'Drag Tam to safety in the Westwood', set:'saved_tam', to:'westwood' },
          { label:'Stand and fight to buy time *(Combat, DC 15)*', check:{stat:'str',dc:15,success:'stood_ground',fail:'westwood'} }
        ] },
      stood_ground:{ type:'story', title:'A Heron-Mark Blade',
        text:'You take up Tam’s hidden sword — a **heron-mark blade**, a masterwork no shepherd should own — and hold the door until the Trollocs recoil. Questions for later. You get Tam clear.',
        choices:[{ label:'Into the Westwood', set:'saved_tam', to:'westwood' }] },
      westwood:{ type:'story', title:'Fever Dreams',
        text:'In the trees Tam raves — of the slopes of Dragonmount, of a woman, of a baby found in the snow. By dawn Emond’s Field smokes. The village Wisdom **Nynaeve** cannot break the fever; only the newcomer can.',
        choices:[
          { label:'Trust the Aes Sedai, Moiraine', set:'trust_moiraine', to:'moiraine' },
          { label:'Refuse her help, fear the witch', to:'moiraine' }
        ] },
      moiraine:{ type:'story', title:'Moiraine and Lan',
        text:'**Moiraine Damodred** of the Blue Ajah Heals your father with a touch of the One Power, her Warder **Lan** a blade at her shoulder. “The Dark One’s eye is on you three — you, Matrim, and Perrin. A Myrddraal leads the Trollocs. You cannot stay.”',
        choices:[
          { label:'Leave tonight — the village is bait', to:'flight' },
          { label:'Demand answers first *(Insight, DC 13)*', check:{stat:'wis',dc:13,success:'answers',fail:'flight'} }
        ] },
      answers:{ type:'story', title:'What She Will Say',
        text:'Moiraine tells you little and means all of it: one of you is *ta’veren*, a thread the Wheel weaves the Pattern around. The Shadow wants you dead. “Ride with me to Tar Valon, and live.”',
        choices:[{ label:'Ride', set:'knows_taveren', to:'flight' }] },
      flight:{ type:'story', title:'The Flight from the Two Rivers',
        text:'You flee in the night — Rand, Mat, Perrin, the Wisdom Nynaeve who follows, Egwene who will not be left, and the gleeman **Thom Merrilin**. A Draghkar’s shadow crosses the moon. Two roads open at the river.',
        choices:[
          { label:'Cross at Taren Ferry (fast, exposed)', to:'baerlon' },
          { label:'Cut for the old city of Shadar Logoth', set:'to_shadar', to:'shadar' }
        ] },
      baerlon:{ type:'story', title:'Baerlon',
        text:'The mining town of Baerlon. A Myrddraal — a **Fade**, eyeless and wrong — corners you in the inn, but Lan’s sword and Moiraine’s fire drive it off. Whitecloaks watch from the street. You slip out the wall at dawn, still bound for Shadar Logoth downriver.',
        choices:[{ label:'On to Shadar Logoth', set:'to_shadar', to:'shadar' }] },
      shadar:{ type:'story', title:'Shadar Logoth',
        text:'A dead city, marble and dust, silent as held breath. Moiraine’s warning is ice: **touch nothing, take nothing.** A fat little man named **Mordeth** offers you treasure from the ruins, smiling too wide.',
        choices:[
          { label:'Refuse and keep your hands empty', set:'clean', to:'mashadar' },
          { label:'Pocket a dagger from the hoard *(greed)*', set:'took_dagger', to:'mashadar' },
          { label:'See through him *(Insight, DC 15)*', check:{stat:'wis',dc:15,success:'saw_mordeth',fail:'mashadar'} }
        ] },
      saw_mordeth:{ type:'story', title:'The Thing That Was Mordeth',
        text:'You feel the wrongness before he finishes — Mordeth is what killed this city, hate given shape. You back away, taking nothing. The name **Mordeth** will matter again.',
        choices:[{ label:'Rejoin the others', set:'clean', to:'mashadar' }] },
      mashadar:{ type:'story', title:'Mashadar',
        text:'The city’s other evil wakes: **Mashadar**, a fog of grey death, pours through the streets. Trollocs that followed you are caught in it screaming. In the chaos the party is torn apart and scattered into the night.',
        choices:[
          { label:'Follow the river with Mat and Thom', set:'path_river', to:'whitebridge' },
          { label:'Strike overland with Perrin', set:'path_wolves', to:'wolves' }
        ] },
      whitebridge:{ type:'story', title:'Whitebridge',
        text:'You reach the great white span with Mat — who has grown sly and sick, a **ruby-hilted dagger** from Shadar Logoth clutched close (some of you took more than you should). A Fade murders in the square; Thom stays behind in fire so you two can run.',
        choices:[
          { label:'Press on for Caemlyn', to:'caemlyn' },
          { need:'took_dagger', label:'Fight the dagger’s whispers *(Will, DC 16)*', check:{stat:'wis',dc:16,success:'caemlyn',fail:'caemlyn'} }
        ] },
      wolves:{ type:'story', title:'A Wolfbrother Wakes',
        text:'With Perrin you fall in with **Elyas**, a man who runs with wolves — and Perrin finds the wolves answer *him*. Whitecloaks under **Bornhald** take you for Darkfriends. You break free and turn, like the others, toward Caemlyn.',
        choices:[{ label:'Toward Caemlyn', set:'perrin_wolf', to:'caemlyn' }] },
      caemlyn:{ type:'story', title:'Caemlyn',
        text:'The grandest city you have seen. A boy over a wall, a glimpse of the Daughter-Heir **Elayne** with her brothers Gawyn and Galad. A mad Whitecloak crowd bays. Then Moiraine gathers you all again — and turns the party north and east, toward the **Blight** and a place called the Eye of the World.',
        choices:[{ label:'Into the Blight', to:'blight' }] },
      blight:{ type:'story', title:'The Blight',
        text:'The land rots — trees that bleed, air that hates. At its heart waits the **Green Man**, last of the Nym, keeper of a pool of the untainted Power: the **Eye of the World**. And two of the Forsaken have broken free to reach it first: **Aginor** and **Balthamel**.',
        choices:[
          { label:'Seize the Power at the Eye and fight *(channel, DC 18)*', check:{stat:'cha',dc:18,success:'triumph',fail:'costly'} },
          { label:'Trust the Green Man and hold the line', to:'costly' }
        ] },
      triumph:{ type:'story', title:'The Light at Winter’s End',
        text:'Something opens in you like a door in a storm — *saidin*, raging and sweet and foul all at once. Fire answers your will. Balthamel falls to the Green Man’s vines; Aginor burns himself to ash reaching for more Power than he can hold. The Eye is spent — but the seal is bought.',
        choices:[{ label:'Finish it', set:'channeled', to:'triumph_end' }] },
      costly:{ type:'story', title:'A Price Paid',
        text:'The Green Man gives his ancient life to take Balthamel down; Aginor is undone by his own greed for the Power. You live. The banner of the Dragon and the broken seals hidden in the Eye are recovered — proof of what is coming.',
        choices:[{ label:'Ride home changed', to:'triumph_end' }] },
      triumph_end:{ type:'end', title:'The Wheel Turns',
        text:'The Trolloc host shatters at Tarwin’s Gap. You are alive, and something more than a shepherd now.\n\nWhat you did echoes: '+
          '\n\n**Campaign complete.** *The Great Hunt* takes up the road from here — the Horn of Valere is waking.' }
    }
  };

  /* ═══════════════ BOOK 2 — THE GREAT HUNT ═══════════════ */
  var hunt = {
    id:'hunt', title:'Book 2 — The Great Hunt',
    blurb:'The Horn of Valere — which calls dead heroes back to fight for the Light — is stolen from Fal Dara. Hunt it across the world before the Shadow can sound it first.',
    start:'faldara',
    scenes:{
      faldara:{ type:'story', title:'Theft at Fal Dara',
        text:'In the Shienaran keep of Fal Dara the **Amyrlin Seat** herself has come to test you. Then Trollocs breach the walls, **Padan Fain** flees, and the **Horn of Valere** and Mat’s cursed dagger vanish with him. Mat is dying without the blade.',
        choices:[
          { label:'Ride out with the Shienarans at once', set:'rode_fast', to:'hunt_trail' },
          { label:'Let the Amyrlin mark you first *(endure, DC 14)*', check:{stat:'con',dc:14,success:'marked',fail:'hunt_trail'} }
        ] },
      marked:{ type:'story', title:'The Amyrlin’s Eyes',
        text:'**Siuan Sanche** looks through you like deep water and names what you fear — that you can channel, that you may be more. She does not gentle you. She lets you ride. That is its own kind of chain.',
        choices:[{ label:'Take the hunt’s trail', set:'amyrlin_knows', to:'hunt_trail' }] },
      hunt_trail:{ type:'story', title:'The Trail Splits',
        text:'Fain’s trail runs south through the Kinslayer’s Dagger mountains. Then the world lurches — a wrongness in the Pattern — and you are **Skimmed** by a Portal Stone into a waste of frozen possibility, alone.',
        choices:[
          { label:'Walk the ghost-lives the Stone shows you', to:'portal' },
          { label:'Refuse the visions *(Will, DC 15)*', check:{stat:'wis',dc:15,success:'portal_strong',fail:'portal'} }
        ] },
      portal:{ type:'story', title:'The Lives You Might Live',
        text:'The Portal Stone drowns you in lives where you *did* proclaim yourself Dragon — and died, again and again, mad or murdered. You claw back to the true world, shaken, and find the trail again near the false-Dragon city of **Falme**.',
        choices:[{ label:'On to Falme', to:'falme' }] },
      portal_strong:{ type:'story', title:'Unbroken',
        text:'You hold to the one true thread and refuse the thousand deaths. You come through the Stone clear-eyed and certain — a small, hard victory over yourself. The trail leads to **Falme**.',
        choices:[{ label:'On to Falme', set:'steady', to:'falme' }] },
      falme:{ type:'story', title:'The Seanchan',
        text:'Falme is held by the **Seanchan**, returned across the ocean — and they leash women who channel as *damane*, collared animals. Egwene is taken and collared. The Horn is here, in a Seanchan strongroom.',
        choices:[
          { label:'Steal the Horn by stealth first *(Stealth, DC 16)*', check:{stat:'dex',dc:16,success:'got_horn',fail:'open_fight'} },
          { label:'Free the damane and Egwene first', set:'freed_egwene', to:'open_fight' }
        ] },
      got_horn:{ type:'story', title:'The Horn in Hand',
        text:'You take the **Horn of Valere** and Mat’s dagger from under Seanchan noses. But there is no clean way out — the whole town is waking, and Egwene is still collared above the harbor.',
        choices:[{ label:'Sound it and turn to save her', to:'sound' }] },
      open_fight:{ type:'story', title:'The Sky Splits',
        text:'It becomes open war in the streets of Falme. You cut Egwene free of the collar; Nynaeve and Elayne bring the *a’dam* down. And in your hand is the Horn — and Mat sets it to his lips.',
        choices:[{ label:'Sound the Horn of Valere', to:'sound' }] },
      sound:{ type:'story', title:'The Heroes of the Horn',
        text:'The Horn cries and the dead ride back — **Artur Hawkwing** and the heroes bound to the Wheel, banners of legend against the Seanchan. Above the clouds your battle with **Ishamael** is written in fire on the sky for all Falme to see.',
        choices:[
          { label:'Face Ishamael in the sky *(channel, DC 19)*', check:{stat:'cha',dc:19,success:'sky_win',fail:'sky_cost'} },
          { label:'Trust the heroes and the Light', to:'sky_cost' }
        ] },
      sky_win:{ type:'story', title:'The Dragon on the Sky',
        text:'You wound Ishamael and drive him back into the dark. Ten thousand people see the fiery sign of the Dragon above Falme — and Hawkwing’s own hand names you. There is no unsaying it now.',
        choices:[{ label:'Come down from the sky', set:'named_falme', to:'hunt_end' }] },
      sky_cost:{ type:'story', title:'A Sign to the World',
        text:'The heroes turn the day and the Seanchan reel back to their ships. You live, barely. But everyone at Falme saw the Dragon’s banner burn across heaven. The world will not forget.',
        choices:[{ label:'Gather the survivors', to:'hunt_end' }] },
      hunt_end:{ type:'end', title:'The Horn Recovered',
        text:'The Horn of Valere is won and the Seanchan thrown back — for now. But you have been seen, and named, and the Whitecloaks and the Tower and the Shadow all know your face.\n\n**Campaign complete.** In *The Dragon Reborn*, prophecy waits in the Stone of Tear.' }
    }
  };

  /* ═══════════════ BOOK 3 — THE DRAGON REBORN ═══════════════ */
  var reborn = {
    id:'reborn', title:'Book 3 — The Dragon Reborn',
    blurb:'You run from what you are — south toward Tear, where a sword that is not a sword waits in a fortress no army has ever taken. To draw Callandor is to proclaim yourself the Dragon.',
    start:'flee',
    scenes:{
      flee:{ type:'story', title:'The Dragon’s Fever',
        text:'You wake in the mountains sick with the Power and with dreams that are not yours — **Ba’alzamon’s** face, and always the crystal sword **Callandor** shining in the dark. You slip away from your friends before *saidin* makes you a danger to them, riding hard for Tear.',
        choices:[
          { label:'Ride alone and fast', set:'alone', to:'road_tear' },
          { label:'Leave a trail your friends can follow *(Nature, DC 13)*', check:{stat:'wis',dc:13,success:'followed',fail:'road_tear'} }
        ] },
      followed:{ type:'story', title:'Not Truly Alone',
        text:'You leave sign only a Two Rivers eye would read. Perrin, Moiraine and Lan take up the chase; Egwene, Nynaeve and Elayne hunt the **Black Ajah** along the same road. You are watched over, whether you want it or not.',
        choices:[{ label:'South to Tear', set:'guarded', to:'road_tear' }] },
      road_tear:{ type:'story', title:'The Road to Tear',
        text:'The land turns rich and hot. **Darkfriends** and worse dog your steps; a Gray Man puts a knife at your back in an alley. In dreams a woman of terrible beauty — **Lanfear** — offers to teach you, if only you will kneel.',
        choices:[
          { label:'Refuse Lanfear utterly', set:'refused_lanfear', to:'tear_city' },
          { label:'Bargain for knowledge *(Deceive, DC 16)*', check:{stat:'cha',dc:16,success:'played_her',fail:'tear_city'} }
        ] },
      played_her:{ type:'story', title:'A Dangerous Game',
        text:'You let her think she is winning and learn what you can — the weaves she shows, the hunger behind her eyes. It is like petting a leopard. You take the knowledge and give nothing real.',
        choices:[{ label:'Reach the city of Tear', set:'learned_weaves', to:'tear_city' }] },
      tear_city:{ type:'story', title:'The Stone of Tear',
        text:'The **Stone of Tear** has never fallen; the High Lords keep Callandor as proof no Dragon can be real, for prophecy says he must take it from *inside*. The **Forsaken Be’lal** rules here in secret, and thirteen Black sisters wait within.',
        choices:[
          { label:'Enter the Stone through the tunnels *(Stealth, DC 17)*', check:{stat:'dex',dc:17,success:'inside_quiet',fail:'inside_loud'} },
          { label:'Let the Aiel take the Stone by storm', set:'aiel_storm', to:'inside_loud' }
        ] },
      inside_quiet:{ type:'story', title:'Into the Heart',
        text:'You move through the Stone unseen while, above, the impossible happens — the **Aiel** come over the walls, taking the untakeable fortress in a single night to reach you. You climb toward the Heart of the Stone and the shining sword.',
        choices:[{ label:'To the Heart of the Stone', to:'callandor' }] },
      inside_loud:{ type:'story', title:'The Stone Falls',
        text:'War in the halls — Aiel spears, Trolloc blood, the Black Ajah’s weaves. Moiraine burns Be’lal to nothing before he can strike you down. Ahead, past the last door, Callandor waits in the Heart of the Stone.',
        choices:[{ label:'To the Heart of the Stone', to:'callandor' }] },
      callandor:{ type:'story', title:'Callandor',
        text:'The sword hangs in light, and **Ba’alzamon** stands between you and it, wearing a hundred deaths. To close your hand on Callandor is to become the Dragon Reborn before all the world — no more hiding, ever.',
        choices:[
          { label:'Take the sword and face him *(channel, DC 20)*', check:{stat:'cha',dc:20,success:'draw_win',fail:'draw_cost'} },
          { label:'Refuse the title, fight him without it', to:'draw_cost' }
        ] },
      draw_win:{ type:'story', title:'The Dragon Reborn',
        text:'Your hand closes on Callandor and the sa’angreal roars through you like the sun. You strike Ba’alzamon down — and learn his name was **Ishamael** all along, first among the Forsaken. The Stone is taken; the People of the Dragon have come. Prophecy fulfilled.',
        choices:[{ label:'Raise the sword', set:'is_dragon', to:'reborn_end' }] },
      draw_cost:{ type:'story', title:'No More Running',
        text:'Whether by the shining sword or by will alone, you cast Ishamael down and the Stone is yours. Callandor blazes in your fist where all of Tear can see it. There is no more pretending you are only a shepherd.',
        choices:[{ label:'Accept what you are', set:'is_dragon', to:'reborn_end' }] },
      reborn_end:{ type:'end', title:'He Who Comes With the Dawn',
        text:'The Stone of Tear has fallen and Callandor is drawn. Kings and Aes Sedai and Aiel all turn to the news: the Dragon is Reborn, and the Prophecies are moving.\n\n**Campaign complete.** *The Shadow Rising* opens the way to the Aiel Waste — and to the truth of who the Aiel are.' }
    }
  };

  /* ═══════════════ BOOK 4 — THE SHADOW RISING ═══════════════ */
  var shadow = {
    id:'shadow', title:'Book 4 — The Shadow Rising',
    blurb:'Holding the Stone of Tear, you must choose where to turn: into the Aiel Waste for the hidden truth at Rhuidean — or home, to defend the Two Rivers from Trollocs and Whitecloaks.',
    start:'stone_held',
    scenes:{
      stone_held:{ type:'story', title:'The Stone Held',
        text:'You rule the unrulable Stone, courted and feared. Two needs pull at you: the Aiel prophecy of the **Car’a’carn** waits west across the Dragonwall — and word comes that the Two Rivers burns, Trollocs and Whitecloaks both hunting a shepherd’s kin.',
        choices:[
          { label:'Ride west into the Aiel Waste', set:'went_waste', to:'rhuidean' },
          { label:'Send Perrin home to save the Two Rivers', set:'went_home', to:'tworivers' }
        ] },
      rhuidean:{ type:'story', title:'Rhuidean',
        text:'Across the Three-fold Land to the dead city of **Rhuidean**, ringed in fog. To become chief of chiefs you must walk into the *ter’angreal* of glass columns and live the memories of a thousand years of Aiel ancestors.',
        choices:[
          { label:'Walk the glass columns and bear the truth *(Will, DC 18)*', check:{stat:'wis',dc:18,success:'aiel_truth',fail:'aiel_truth'} }
        ] },
      aiel_truth:{ type:'story', title:'The Broken Oath',
        text:'You live it all: the Aiel were once the **Da’shain**, sworn to *never harm* and to serve the Aes Sedai — and they broke that oath in the Breaking. You come out of the columns marked with the Dragons, carrying a truth that could shatter the Aiel if you speak it.',
        choices:[
          { label:'Tell them the whole truth', set:'told_truth', to:'car_a_carn' },
          { label:'Reveal it carefully *(Diplomacy, DC 17)*', check:{stat:'cha',dc:17,success:'united_aiel',fail:'car_a_carn'} }
        ] },
      united_aiel:{ type:'story', title:'Chief of Chiefs',
        text:'You give them the truth in a way they can bear, and though some clans break away as **Shaido**, most kneel. You are **Car’a’carn**, the one who comes with the dawn, with the spears of the Waste at your back.',
        choices:[{ label:'Turn to the wetlands', set:'has_aiel', to:'shadow_end' }] },
      car_a_carn:{ type:'story', title:'The Spears Gather',
        text:'The revelation is a blade — some clans name you liar and turn Shaido — but the truth cannot be unspoken, and the Wise Ones know it for true. You lead the Aiel who will follow toward their fate in the wetlands.',
        choices:[{ label:'Turn to the wetlands', set:'has_aiel', to:'shadow_end' }] },
      tworivers:{ type:'story', title:'The Two Rivers Rises',
        text:'As **Perrin**, you come home to smoke. Trollocs raid the farms and Whitecloaks arrest folk as Darkfriends. But the Two Rivers still breeds stubborn people — and wolves answer your call.',
        choices:[
          { label:'Rally the villagers to fight *(Command, DC 16)*', check:{stat:'cha',dc:16,success:'rallied',fail:'siege'} },
          { label:'Set a trap in the woods *(Nature, DC 15)*', check:{stat:'wis',dc:15,success:'trap',fail:'siege'} }
        ] },
      rallied:{ type:'story', title:'The Wolf Banner',
        text:'Farmers with bows, Aiel who came to guard you, even the Whitecloaks in the end — you weld them into a defense and raise a red wolf-head banner over Emond’s Field. Faile stands at your side, and you are Lord Perrin now whether you like the word or not.',
        choices:[{ label:'Hold the line', set:'saved_home', to:'siege' }] },
      trap:{ type:'story', title:'Ambush at the Waygate',
        text:'You bleed the Trolloc host in the woods before it can mass, wolves and archers striking from the dark. It buys the village the time it needs to stand.',
        choices:[{ label:'Fall back to Emond’s Field', to:'siege' }] },
      siege:{ type:'story', title:'The Battle of Emond’s Field',
        text:'The last Trolloc wave breaks on the village — hedgehog barricades, Two Rivers longbows, Aiel spears, the Manetheren banner flying again after two thousand years. When dawn comes, the field is yours, and the Two Rivers has remembered how to fight.',
        choices:[{ label:'Bury the dead, raise the living', set:'saved_home', to:'shadow_end' }] },
      shadow_end:{ type:'end', title:'The Dragon Rising',
        text:'Whether you took the Waste or held the homeland, the Shadow’s rising has met an answer. New powers stand behind you now — Aiel spears, or a homeland that will never again bow to the dark.\n\n**Campaign complete.** *The Fires of Heaven* carries the war out of the Waste and into the heart of the nations.' }
    }
  };

  /* ═══════════════ BOOK 5 — THE FIRES OF HEAVEN ═══════════════ */
  var fires = {
    id:'fires', title:'Book 5 — The Fires of Heaven',
    blurb:'You lead the Aiel out of the Waste to break a false Dragon and take a throne from a Forsaken — while in the World of Dreams, Nynaeve hunts the most cowardly of the Forsaken to her lair.',
    start:'out_of_waste',
    scenes:{
      out_of_waste:{ type:'story', title:'Out of the Waste',
        text:'You bring the Aiel down out of the Dragonwall like a flood. The renegade **Shaido** and the false Dragon **Couladin** burn the land ahead of you, racing for Cairhien. Two ways to end him.',
        choices:[
          { label:'Meet the Shaido in open battle', set:'open_war', to:'cairhien' },
          { label:'Outmaneuver them with Mat’s luck *(strategy, DC 17)*', check:{stat:'int',dc:17,success:'outfought',fail:'cairhien'} }
        ] },
      outfought:{ type:'story', title:'The Gambler’s Field',
        text:'Mat Cauthon — cursed with a dead general’s memories — reads the ground like a book and hands you the battle before it starts. Fewer of your people die for it. He hates that he is good at this.',
        choices:[{ label:'Close on Cairhien', set:'mat_general', to:'cairhien' }] },
      cairhien:{ type:'story', title:'The Fall of Couladin',
        text:'Before the walls of Cairhien the Shaido break and Couladin dies, the false Dragon undone. The city — starving, scheming, deadly in its Game of Houses — is yours to hold. But **Lanfear** has watched you take another woman’s regard, and she is not sane about it.',
        choices:[
          { label:'Confront Lanfear’s jealousy head-on', to:'lanfear' },
          { label:'Try to talk her down *(Will, DC 19)*', check:{stat:'wis',dc:19,success:'survived_her',fail:'lanfear'} }
        ] },
      lanfear:{ type:'story', title:'The Betrayer’s Rage',
        text:'Lanfear’s love turns to murder in a heartbeat — she will destroy everything you care for rather than share you. The Power she throws could level a city. Someone you trust must make an impossible choice to stop her.',
        choices:[{ label:'The docks at Cairhien', to:'docks' }] },
      survived_her:{ type:'story', title:'A Moment’s Grace',
        text:'You buy a few breaths with words, enough for others to move — but Lanfear is a storm that words cannot hold for long. It ends at the docks, and it costs you dearly.',
        choices:[{ label:'The docks at Cairhien', to:'docks' }] },
      docks:{ type:'story', title:'Into the Doorway',
        text:'**Moiraine** takes Lanfear in her arms and hurls them both through a doorway *ter’angreal* into fire — gone, both of them, to save you. The woman who started your whole journey is lost, and you did not even get to thank her.',
        choices:[
          { label:'Grieve, then turn north', set:'lost_moiraine', to:'caemlyn_throne' }
        ] },
      caemlyn_throne:{ type:'story', title:'Rahvin in Caemlyn',
        text:'Word comes that **Rahvin** — a Forsaken — sits the throne of Andor as “Lord Gaebril,” ruling through Compulsion, and that he has struck down people you love. You **Travel** straight into Caemlyn with fire in your hands.',
        choices:[
          { label:'Storm the palace with balefire *(channel, DC 20)*', check:{stat:'cha',dc:20,success:'rahvin_burned',fail:'rahvin_hard'} },
          { label:'Hunt him through the palace patiently', to:'rahvin_hard' }
        ] },
      rahvin_burned:{ type:'story', title:'Balefire',
        text:'You chase Rahvin into *Tel’aran’rhiod* and burn him from the Pattern with **balefire** — a fire so absolute it unmakes what he did in the moments before he died, pulling the slain back from death. A terrible power, and you have used it.',
        choices:[{ label:'Stand in the ashes', set:'used_balefire', to:'fires_end' }] },
      rahvin_hard:{ type:'story', title:'A Hard Reckoning',
        text:'It is a running duel of the Power through palace and dream, and it nearly ends you — but Rahvin falls, and his hold on Andor with him. The throne stands empty for its true heir.',
        choices:[{ label:'Take stock of the cost', to:'fires_end' }] },
      fires_end:{ type:'end', title:'The Fires of Heaven',
        text:'A false Dragon broken, a Forsaken burned from a stolen throne, and Moiraine paid to save you. You are the storm at the center of the world now, and everyone — Tower, thrones, and Shadow — must reckon with the Dragon Reborn.\n\n**Campaign complete.** Five books walked; the Wheel turns on toward Tarmon Gai’don.' }
    }
  };

  wot.campaigns = (wot.campaigns||[]).concat([eotw, hunt, reborn, shadow, fires]);
})();
