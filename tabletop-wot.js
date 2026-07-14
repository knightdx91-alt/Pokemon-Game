/* Wheel of Time — story content for Grand Tabletop.
   ────────────────────────────────────────────────────────────────────────
   Built from the user's own copies: the complete 14-book omnibus (+ the
   New Spring prequel) supplies the story guide, character/faction codex and
   world timeline; the Wheel of Time Roleplaying Game rulebook supplies the
   mechanics folded into the WoT dice/lore (see tabletop-games.js + the
   rulebook enrichment appended at the bottom of this file).

   This module ATTACHES to the 'wot' game object already defined in
   tabletop-games.js, adding three optional, data-driven sections the shell
   renders as extra tabs when present:
     story    [{book, chapters, era, blurb}]      → "Story" tab (spoiler-aware)
     codex    [{name, faction, role, desc}]       → "Codex" tab (filterable)
     timeline [{when, event}]                      → "Timeline" tab
   Load order (tabletop.html): tabletop-games.js → tabletop-wot.js → app.
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  var wot = (window.TABLETOP_GAMES||[]).filter(function(g){return g.id==='wot';})[0];
  if(!wot) return;

  /* ─────────────── STORY GUIDE — the 15 volumes in reading order ───────────────
     Blurbs are spoiler-aware: safe to read for the book named and everything
     before it. A ⚠ marks a volume whose blurb reveals a major turn. */
  wot.story = [
    { book:'New Spring', chapters:27, era:'Prequel · ~20 years before',
      blurb:'The prequel. During the Aiel War, novice **Moiraine Damodred** and **Siuan Sanche** overhear the Foretelling that the **Dragon has been Reborn** — a boy child born on the slopes of Dragonmount. Newly raised Aes Sedai, Moiraine begins the secret hunt that will define her life, and a young Malkieri swordsman named **al’Lan Mandragoran** becomes her Warder.' },
    { book:'The Eye of the World', chapters:54, era:'Book 1',
      blurb:'Trollocs raid the sleepy **Two Rivers** on Winternight. Moiraine and Lan flee toward Tar Valon with five youths — **Rand al’Thor**, **Mat Cauthon**, **Perrin Aybara**, **Egwene al’Vere** and the Wisdom **Nynaeve** — one of whom the Dark One most wants dead. Pursued by Myrddraal across half the world, they race to the **Eye of the World** as the Forsaken begin to stir.' },
    { book:'The Great Hunt', chapters:51, era:'Book 2',
      blurb:'The **Horn of Valere**, which calls dead heroes back to fight for the Light, is stolen. Rand hunts it across the Aiel-haunted lands while grappling with a terrible truth about himself. The Seanchan invade from across the ocean with leashed **damane**, and the Amyrlin Seat herself takes an interest in the young man from the Two Rivers.' },
    { book:'The Dragon Reborn', chapters:57, era:'Book 3',
      blurb:'Rand flees toward the fortress of **Tear** and the crystal sword **Callandor**, which only the Dragon Reborn can wield. His friends and the Aes Sedai chase after him, Perrin comes into his own as a wolfbrother, and the three Two Rivers women begin their training — and their pursuit of the Black Ajah.' },
    { book:'The Shadow Rising', chapters:58, era:'Book 4',
      blurb:'Rand travels into the **Aiel Waste** to Rhuidean and learns the hidden history of the Aiel and their broken oaths. Perrin returns home to defend the Two Rivers from Trolloc raids and the Whitecloaks, while Nynaeve and Elayne hunt the Black Ajah to the sea-country of Tarabon.' },
    { book:'The Fires of Heaven', chapters:57, era:'Book 5 · ⚠',
      blurb:'Rand marches the Aiel out of the Waste to break the false Dragon **Couladin**. Nynaeve duels the Forsaken Moghedien in the World of Dreams. Mat becomes an unwilling, brilliant general — and the book closes on a shattering loss at the hands of Lanfear and a betrayer.' },
    { book:'Lord of Chaos', chapters:57, era:'Book 6 · ⚠',
      blurb:'Rand founds the **Black Tower** to train men who can channel and juggles a dozen thrones. A hard-line embassy of Aes Sedai comes to "guide" him, and the book ends at **Dumai’s Wells** — the bloodiest battle yet, where the Asha’man announce themselves and the price of kneeling to no one is paid in full.' },
    { book:'A Crown of Swords', chapters:42, era:'Book 7',
      blurb:'Rand pursues the Forsaken **Sammael** in Illian and claims the Crown of Swords. Nynaeve and Elayne recover the **Bowl of the Winds** to break the Dark One’s unnatural heat, and Mat is swept up with the Aes Sedai fugitives of Salidar in the chaos of Ebou Dar.' },
    { book:'The Path of Daggers', chapters:30, era:'Book 8',
      blurb:'The Bowl of the Winds is used and the seasons lurch back toward order. Rand’s campaign against the Seanchan goes catastrophically wrong when the male half of the Source’s taint warps his channeling, and Egwene leads the rebel Aes Sedai army to lay siege to Tar Valon itself.' },
    { book:"Winter's Heart", chapters:36, era:'Book 9 · ⚠',
      blurb:'Perrin hunts for his kidnapped wife **Faile**. Mat escapes Ebou Dar with the **Daughter of the Nine Moons**. In the book’s climax Rand, with Nynaeve’s help, uses the **Choedan Kal** to do the impossible — **cleanse saidin of the Dark One’s taint** at Shadar Logoth.' },
    { book:'Crossroads of Twilight', chapters:30, era:'Book 10',
      blurb:'The quietest volume: the world reacts to the cleansing of saidin, which every channeler felt. Egwene tightens the siege of Tar Valon, Mat courts his reluctant Seanchan bride, and Perrin makes a devil’s bargain to get Faile back.' },
    { book:'Knife of Dreams', chapters:39, era:'Book 11',
      blurb:'The pace snaps back. Mat rescues Faile and finally weds **Tuon**. Egwene, captured inside the White Tower, wages a one-woman war to reunite it from within. Rand loses a hand but forces the Seanchan toward truce, and the seals on the Dark One’s prison are visibly failing — **Tarmon Gai’don** is near.' },
    { book:'The Gathering Storm', chapters:52, era:'Book 12 · Sanderson',
      blurb:'Brandon Sanderson completes Jordan’s work. Rand, gone cold and hard as cuendillar under the weight of the world, is nearly consumed by despair — until a moment atop **Dragonmount** where he remembers why the wheel turns and laughs. Egwene breaks the White Tower’s corruption and is raised the true Amyrlin.' },
    { book:'Towers of Midnight', chapters:30, era:'Book 13',
      blurb:'The threads converge. Perrin masters the wolf-dream and forges a weapon to face the Whitecloaks and Slayer. Mat ventures into the **Tower of Ghenjei** to rescue Moiraine from the Aelfinn and Eelfinn. Rand, remade and luminous, begins uniting the nations for the Last Battle.' },
    { book:'A Memory of Light', chapters:49, era:'Book 14 · The Last Battle',
      blurb:'**Tarmon Gai’don.** Every nation, army and channeler gathers on four battlefronts as Rand goes to Shayol Ghul to face the Dark One. Mat commands the armies of the Light; Egwene, Lan, Perrin, Elayne and Aviendha each meet their moment. The Wheel weaves as the Wheel wills — and the age turns.' }
  ];

  /* ─────────────── CHARACTER & FACTION CODEX ─────────────── */
  wot.codex = [
    // The Two Rivers five (the ta'veren core)
    { name:'Rand al’Thor', faction:'The Light', role:'The Dragon Reborn',
      desc:'A shepherd from the Two Rivers revealed to be the Dragon Reborn — the champion of the Light reborn to fight the Dark One at Tarmon Gai’don, and prophesied to break the world in doing so. The most powerful male channeler of the Age. Ta’veren.' },
    { name:'Matrim (Mat) Cauthon', faction:'The Light', role:'Gambler · General',
      desc:'Rand’s reckless, lucky friend. Carrying the memories of dead generals and freed of a corrupting dagger from Shadar Logoth, he becomes the greatest battle commander of the Age. Wielder of the ashandarei and husband to the Seanchan Empress. Ta’veren.' },
    { name:'Perrin Aybara', faction:'The Light', role:'Wolfbrother · Lord of the Two Rivers',
      desc:'A steady blacksmith who can speak to wolves and walk the wolf-dream. Reluctantly becomes a battle-lord defending his homeland. Wields a great hammer, Mah’alleinir. Ta’veren.' },
    { name:'Egwene al’Vere', faction:'White Tower', role:'The Amyrlin Seat',
      desc:'Innkeeper’s daughter from Emond’s Field who rises from novice to become the Amyrlin Seat, a Dreamer of rare power, and the woman who reunites and reforms a broken White Tower.' },
    { name:'Nynaeve al’Meara', faction:'White Tower', role:'Wisdom · Yellow Ajah Healer',
      desc:'The fierce former Wisdom of Emond’s Field. One of the strongest channelers alive, who can only reach the Source through her temper. A Healer without equal — she Heals stilling and gentling, long thought impossible.' },
    // Warders, guides, mentors
    { name:'Moiraine Damodred', faction:'Blue Ajah', role:'Aes Sedai who found the Dragon',
      desc:'The Cairhienin Aes Sedai who spent twenty years searching for the Dragon Reborn and set the whole tale in motion. Cool, secretive, relentless. Presumed lost battling Lanfear, later recovered from the Finns.' },
    { name:'al’Lan Mandragoran', faction:'The Light', role:'Warder · uncrowned King of Malkier',
      desc:'The last king of dead Malkier and Moiraine’s Warder — a peerless swordsman bound by an oath to the Dark One’s eventual defeat. Later Warder to Myrelle, then husband to Nynaeve, and leader of the forlorn charge at the Gap.' },
    { name:'Thom Merrilin', faction:'The Light', role:'Gleeman · court-bard',
      desc:'A traveling gleeman with a mysterious past as a royal Court-bard of Andor and a man who once loved a queen. Mentor to the boys; later companion to Moiraine.' },
    // Andor & the crown
    { name:'Elayne Trakand', faction:'Andor', role:'Daughter-Heir → Queen of Andor',
      desc:'Heir to the Lion Throne, Aes Sedai of the Green Ajah, a gifted maker of ter’angreal, and one of Rand’s three loves. Wins the thrones of Andor and Cairhien.' },
    { name:'Aviendha', faction:'Aiel', role:'Maiden of the Spear → Wise One',
      desc:'A fierce Aiel Maiden of the Spear who gives up the spear to train as a Wise One and channeler. Bound to Elayne and Min as first-sisters and one of Rand’s three loves.' },
    { name:'Min Farshaw', faction:'The Light', role:'Viewer of the Pattern',
      desc:'A young woman who sees images and auras around people that foretell their futures — always true, not always understood. Practical, wry, and one of Rand’s three loves.' },
    { name:'Loial', faction:'Ogier', role:'Ogier scholar',
      desc:'A young (by Ogier reckoning) Ogier from Stedding Shangtai, endlessly curious and bookish, who leaves the stedding to see the world and ends up in the middle of history. Speaker to the Great Trees and a doughty axe in a pinch.' },
    // White Tower leadership
    { name:'Siuan Sanche', faction:'White Tower', role:'former Amyrlin Seat',
      desc:'A fisherman’s daughter from Tear who rose to the Amyrlin Seat and secretly steered the search for the Dragon. Deposed and stilled, later Healed, she becomes a shrewd advisor to Egwene.' },
    { name:'Cadsuane Melaidhrin', faction:'Green Ajah', role:'legendary Aes Sedai',
      desc:'The most famous and formidable living Aes Sedai, out of legend and long thought dead. Takes it upon herself to teach Rand and the Asha’man laughter and tears before the Last Battle.' },
    // The Shadow
    { name:'The Dark One (Shai’tan)', faction:'The Shadow', role:'the antagonist',
      desc:'The source of all evil, sealed away at Shayol Ghul at the moment of creation. His touch on saidin taints every man who channels; his prison weakens as the seals fail.' },
    { name:'Ishamael / Moridin', faction:'The Forsaken', role:'Nae’blis — first among the Forsaken',
      desc:'The most powerful and philosophical of the Forsaken, never fully sealed. Reborn as Moridin, he is named the Dark One’s regent and is bound to Rand by a strange thread of fate.' },
    { name:'Lanfear / Cyndane', faction:'The Forsaken', role:'obsessed with the Dragon',
      desc:'Once Lews Therin’s lover in the Age of Legends; the strongest female Forsaken. Obsessed with possessing Rand across lifetimes. Reborn diminished as Cyndane.' },
    { name:'Padan Fain', faction:'wild card', role:'Darkfriend turned something worse',
      desc:'A peddler and Darkfriend hound sent to hunt the boys, warped by the evil of Shadar Logoth into a unique horror that even the Shadow cannot control. Hates Rand above all.' },
    { name:'Semirhage', faction:'The Forsaken', role:'the sadist',
      desc:'A Forsaken who was, in the Age of Legends, the greatest Healer alive before she turned to torture. Cold, patient, and terrifying.' },
    { name:'Graendal / Hessalam', faction:'The Forsaken', role:'the manipulator',
      desc:'A Forsaken who works through Compulsion and puppet rulers from a hidden palace of pleasures. Survives by never being where the danger is.' },
    // Peoples / factions (not persons)
    { name:'The Aes Sedai', faction:'White Tower', role:'organization',
      desc:'Female channelers organized into seven Ajahs under the Amyrlin Seat in Tar Valon, bound by the Three Oaths sworn on the Oath Rod. Feared, courted, and distrusted across every nation.' },
    { name:'The Asha’man', faction:'Black Tower', role:'organization',
      desc:'Rand’s order of men who can channel, trained as weapons at the Black Tower — "Defenders of the Light." A double-edged force, tainted until the cleansing and riddled with the Shadow’s influence.' },
    { name:'The Aiel', faction:'The Waste', role:'people',
      desc:'Fierce veiled warriors of the Three-fold Land who fight with spear and bow but never swords. Sworn ancient servants of the Aes Sedai they’ve forgotten, and the "People of the Dragon" of prophecy.' },
    { name:'The Seanchan', faction:'Seanchan Empire', role:'invading empire',
      desc:'Descendants of Artur Hawkwing’s armies returned from across the ocean to reclaim the continent. They leash channelers as damane and rule by rigid hierarchy — enemies who may become allies against the Shadow.' },
    { name:'The Children of the Light', faction:'Whitecloaks', role:'militant order',
      desc:'The Whitecloaks: zealots who see Darkfriends everywhere, hate Aes Sedai above all, and answer to no crown. Led for a time by the fanatic Pedron Niall and later by Galad.' },
    { name:'The Forsaken', faction:'The Shadow', role:'the thirteen',
      desc:'Thirteen of the Age of Legends’ mightiest channelers who swore to the Dark One and were sealed with him at Shayol Ghul: Ishamael, Lanfear, Sammael, Rahvin, Be’lal, Asmodean, Graendal, Semirhage, Mesaana, Moghedien, Aginor, Balthamel, Demandred.' }
  ];

  /* ─────────────── WORLD TIMELINE ─────────────── */
  wot.timeline = [
    { when:'The Age of Legends', event:'A golden age of the One Power. Aes Sedai are honored and both sexes channel together. Peace until the drilling of the Bore.' },
    { when:'The Bore', event:'Researchers drill into the Dark One’s prison seeking a genderless source of the Power, letting his touch into the world. The **War of the Shadow** (the War of Power) begins.' },
    { when:'The Sealing', event:'**Lews Therin Telamon**, the Dragon, leads the Hundred Companions to seal the Dark One away — but the Dark One taints saidin in the act. Lews Therin goes mad and kills everyone he loves: "Kinslayer."' },
    { when:'The Breaking of the World', event:'Every male Aes Sedai goes mad. Over ~a century the maddened male channelers reshape mountains and drown lands, shattering civilization.' },
    { when:'After the Breaking', event:'The Aiel migrate to the Waste; the Ogier withdraw to stedding; the White Tower is founded at Tar Valon to gather and guide female channelers.' },
    { when:'~FY 943 → the Trolloc Wars', event:'Waves of Trolloc invasions out of the Blight nearly destroy the young nations over four centuries.' },
    { when:'The rise of Artur Hawkwing', event:'Artur Paendrag Tanreall unites the entire continent under one throne, besieges Tar Valon, and sends armies across the ocean (who become the Seanchan). His empire dies with him in the **War of the Hundred Years**.' },
    { when:'~50 years ago — the Aiel War', event:'The Aiel cross the Spine of the World after King Laman of Cairhien fells Avendoraldera. It is during this war that the Dragon is Reborn on Dragonmount (see *New Spring*).' },
    { when:'The tale begins', event:'Trollocs raid the Two Rivers on Winternight. Moiraine takes Rand, Mat, Perrin, Egwene and Nynaeve out into the world. (*The Eye of the World*)' },
    { when:'Rand proclaimed', event:'Rand seizes Callandor in the Stone of Tear, fulfilling prophecy and openly declaring himself the Dragon Reborn. (*The Dragon Reborn*)' },
    { when:'The Aiel revelation', event:'Rand enters Rhuidean and learns the Aiel’s broken oath of peace; he becomes their Car’a’carn, the Chief of Chiefs. (*The Shadow Rising*)' },
    { when:'The Tower splits', event:'The White Tower divides: the deposing of Siuan Sanche and the rebel Aes Sedai gathering in Salidar against the usurper Elaida.' },
    { when:'Dumai’s Wells', event:'Rand, held captive by Aes Sedai, is freed in a slaughter as the Asha’man reveal their power. A turning point for men who channel. (*Lord of Chaos*)' },
    { when:'The Cleansing', event:'Rand uses the Choedan Kal at Shadar Logoth to **cleanse saidin of the Dark One’s taint** — undoing the curse of three thousand years. (*Winter’s Heart*)' },
    { when:'The Tower reunited', event:'Egwene endures captivity and is raised the true Amyrlin, healing the Tower’s schism as the Seanchan raid Tar Valon. (*The Gathering Storm*)' },
    { when:'Dragonmount', event:'On the edge of destroying the world in despair, Rand remembers hope atop Dragonmount and is remade. (*The Gathering Storm*)' },
    { when:'Tarmon Gai’don', event:'**The Last Battle.** The nations unite on four fronts while Rand faces the Dark One at Shayol Ghul. The Age turns. (*A Memory of Light*)' }
  ];

})();
