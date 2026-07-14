/* Grand Tabletop — campaign + grid-battle engine.
   ────────────────────────────────────────────────────────────────────────
   Turns a world into something you actually PLAY solo: a branching story of
   scenes (narrative + choices + skill checks) that, when a fight starts,
   drops into a grid-based tactical battle. State is saved per campaign so you
   can continue.

   Exposes:
     window.TTPlay   — the campaign scene runner  (TTPlay.open(game, campaign))
     window.TTBattle — the grid tactical battle   (TTBattle.start(opts))
     window.TTMon    — builds a battle-ready Pokémon from PTA_DEX + level

   The runner mounts into #v-play; the battle mounts into #tt-battle (a
   full-view overlay). Both are created by tabletop.html. Pure globals, no deps.
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  "use strict";
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  function md(s){ return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>'); }
  function roll(n,d){ var t=0; for(var i=0;i<n;i++) t+=1+Math.floor(Math.random()*d); return t; }
  function rint(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }

  /* ─────────── Type effectiveness (standard 18-type chart) ─────────── */
  // Only non-1.0 matchups are listed. sup = ×2, res = ×0.5, imm = ×0.
  var CHART = {
    Normal:{res:['Rock','Steel'],imm:['Ghost']},
    Fire:{sup:['Grass','Ice','Bug','Steel'],res:['Fire','Water','Rock','Dragon']},
    Water:{sup:['Fire','Ground','Rock'],res:['Water','Grass','Dragon']},
    Electric:{sup:['Water','Flying'],res:['Electric','Grass','Dragon'],imm:['Ground']},
    Grass:{sup:['Water','Ground','Rock'],res:['Fire','Grass','Poison','Flying','Bug','Dragon','Steel']},
    Ice:{sup:['Grass','Ground','Flying','Dragon'],res:['Fire','Water','Ice','Steel']},
    Fighting:{sup:['Normal','Ice','Rock','Dark','Steel'],res:['Poison','Flying','Psychic','Bug','Fairy'],imm:['Ghost']},
    Poison:{sup:['Grass','Fairy'],res:['Poison','Ground','Rock','Ghost'],imm:['Steel']},
    Ground:{sup:['Fire','Electric','Poison','Rock','Steel'],res:['Grass','Bug'],imm:['Flying']},
    Flying:{sup:['Grass','Fighting','Bug'],res:['Electric','Rock','Steel']},
    Psychic:{sup:['Fighting','Poison'],res:['Psychic','Steel'],imm:['Dark']},
    Bug:{sup:['Grass','Psychic','Dark'],res:['Fire','Fighting','Poison','Flying','Ghost','Steel','Fairy']},
    Rock:{sup:['Fire','Ice','Flying','Bug'],res:['Fighting','Ground','Steel']},
    Ghost:{sup:['Psychic','Ghost'],res:['Dark'],imm:['Normal']},
    Dragon:{sup:['Dragon'],res:['Steel'],imm:['Fairy']},
    Dark:{sup:['Psychic','Ghost'],res:['Fighting','Dark','Fairy']},
    Steel:{sup:['Ice','Rock','Fairy'],res:['Fire','Water','Electric','Steel']},
    Fairy:{sup:['Fighting','Dragon','Dark'],res:['Fire','Poison','Steel']}
  };
  function typeMult(atkType, defTypes){
    var c=CHART[atkType]; if(!c) return 1; var m=1;
    (defTypes||[]).forEach(function(dt){
      if(c.imm&&c.imm.indexOf(dt)!==-1) m*=0;
      else if(c.sup&&c.sup.indexOf(dt)!==-1) m*=2;
      else if(c.res&&c.res.indexOf(dt)!==-1) m*=0.5;
    });
    return m;
  }

  /* ─────────── Build a battle-ready Pokémon ─────────── */
  var dexIndex=null;
  function dexByName(nm){
    if(!dexIndex){ dexIndex={}; (window.PTA_DEX||[]).forEach(function(s){ dexIndex[s.n.toLowerCase()]=s; }); }
    return dexIndex[String(nm).toLowerCase()];
  }
  function TTMon(name, level){
    var s=dexByName(name);
    level=level||5;
    if(!s){ s={n:name,t:['Normal'],s:[20,6,6,6,6,6],mv:['Tackle']}; }
    var st=s.s; // [hp,atk,def,spa,spd,spe]
    var maxhp=st[0]*2 + level*4 + 10;
    var primary=s.t[0]||'Normal';
    // Give up to 3 usable moves: a melee STAB, a ranged STAB, and a normal fallback.
    var moves=[];
    var names=(s.mv&&s.mv.length)?s.mv.slice():['Tackle'];
    moves.push({ name:names[0]||'Strike', type:primary, range:1, dice:[2,6], stat:st[1], cat:'phys' });
    if(names[1]) moves.push({ name:names[1], type:primary, range:4, dice:[2,6], stat:st[3], cat:'spec' });
    if(names[2]) moves.push({ name:names[2], type:(s.t[1]||primary), range:3, dice:[1,8], stat:Math.max(st[1],st[3]), cat:'spec' });
    if(moves.length<2) moves.push({ name:'Tackle', type:'Normal', range:1, dice:[2,6], stat:st[1], cat:'phys' });
    return { n:s.n, types:s.t.slice(), level:level, maxhp:maxhp, hp:maxhp,
      atk:st[1], def:st[2], spa:st[3], spd:st[4], spe:st[5], moves:moves, status:null };
  }

  /* ══════════════════════════════════════════ GRID BATTLE ══════════════════ */
  var TTBattle=(function(){
    var W=8,H=6, TILE=0, el=null, B=null, sel=0;

    function dist(a,b){ return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y)); }
    function moveRange(m){ return 2 + Math.floor(m.spd/4); }

    function start(opts){
      // opts: { player:mon, party:[mon...], enemy:mon, catchable, bag:{balls,potions}, onEnd(fn) }
      B={ player:{mon:opts.player,x:1,y:H-2}, enemy:{mon:opts.enemy,x:W-2,y:1},
          party:opts.party||[opts.player], bag:opts.bag||{balls:0,potions:0},
          catchable:!!opts.catchable, onEnd:opts.onEnd||function(){}, log:[], phase:'player', moved:false, acted:false };
      sel=0;
      el=$('tt-battle'); el.classList.add('on');
      log('A wild '+B.enemy.mon.n+' (Lv '+B.enemy.mon.level+') appeared!');
      render();
    }
    function log(t){ B.log.unshift(t); if(B.log.length>6) B.log.length=6; }

    function reachable(){ // cells the player can move to this turn
      if(B.moved) return {};
      var mr=moveRange(B.player.mon), set={}, p=B.player;
      for(var y=0;y<H;y++)for(var x=0;x<W;x++){
        if(x===B.enemy.x&&y===B.enemy.y) continue;
        if(Math.max(Math.abs(x-p.x),Math.abs(y-p.y))<=mr) set[x+','+y]=1;
      }
      return set;
    }

    function render(){
      var p=B.player, e=B.enemy, reach=B.phase==='player'?reachable():{};
      var canAct=B.phase==='player'&&!B.acted;
      var m=p.mon.moves[sel];
      var inRange = m && dist(p,e)<=m.range;
      var html='<div class="bt-top">'+
          monBar(e.mon,'foe')+
        '</div>'+
        '<div class="bt-grid" id="bt-grid">';
      for(var y=0;y<H;y++)for(var x=0;x<W;x++){
        var cls='bt-cell'; var content='';
        if(reach[x+','+y]) cls+=' reach';
        if(x===p.x&&y===p.y){ cls+=' me'; content=mon(p.mon,'me'); }
        else if(x===e.x&&y===e.y){ cls+=' foe'+((canAct&&inRange)?' target':''); content=mon(e.mon,'foe'); }
        html+='<div class="'+cls+'" data-x="'+x+'" data-y="'+y+'">'+content+'</div>';
      }
      html+='</div>'+
        '<div class="bt-bottom">'+monBar(p.mon,'me')+'</div>'+
        '<div class="bt-log">'+B.log.map(function(l){return '<div>'+esc(l)+'</div>';}).join('')+'</div>'+
        '<div class="bt-actions">'+
          p.mon.moves.map(function(mv,i){
            return '<button class="bt-move'+(i===sel?' sel':'')+'" data-mv="'+i+'">'+esc(mv.name)+
              '<small>'+mv.type+' · rng '+mv.range+'</small></button>'; }).join('')+
        '</div>'+
        '<div class="bt-cmd">'+
          '<button data-cmd="fight"'+(canAct&&inRange?'':' disabled')+'>Fight'+(inRange?'':' (move closer)')+'</button>'+
          (B.catchable?'<button data-cmd="catch"'+(canAct?'':' disabled')+'>Ball ('+B.bag.balls+')</button>':'')+
          '<button data-cmd="potion"'+(canAct&&B.bag.potions>0?'':' disabled')+'>Potion ('+B.bag.potions+')</button>'+
          (B.party.filter(function(x){return x.hp>0&&x!==p.mon;}).length?'<button data-cmd="switch">Switch</button>':'')+
          '<button data-cmd="end">End turn</button>'+
          '<button data-cmd="run" class="run">Run</button>'+
        '</div>';
      el.innerHTML=html;
      // wire
      Array.prototype.forEach.call(el.querySelectorAll('.bt-cell'),function(c){
        c.onclick=function(){ cellTap(+c.dataset.x,+c.dataset.y); };
      });
      Array.prototype.forEach.call(el.querySelectorAll('.bt-move'),function(bm){
        bm.onclick=function(){ sel=+bm.dataset.mv; render(); };
      });
      Array.prototype.forEach.call(el.querySelectorAll('.bt-cmd button'),function(bc){
        bc.onclick=function(){ cmd(bc.dataset.cmd); };
      });
    }
    function mon(m,side){
      var pct=Math.max(0,Math.round(m.hp/m.maxhp*100));
      return '<div class="bt-tok '+side+'"><span>'+esc(m.n.slice(0,4))+'</span></div>';
    }
    function monBar(m,side){
      var pct=Math.max(0,Math.round(m.hp/m.maxhp*100));
      var col=pct>50?'#63bb5b':pct>20?'#f4d23c':'#ee1515';
      return '<div class="bt-info '+side+'"><div class="bt-nm">'+esc(m.n)+' <small>Lv'+m.level+'</small>'+
        (m.status?' <em>'+esc(m.status)+'</em>':'')+'</div>'+
        '<div class="bt-hp"><i style="width:'+pct+'%;background:'+col+'"></i></div>'+
        '<div class="bt-hpn">'+Math.max(0,m.hp)+' / '+m.maxhp+'</div></div>';
    }
    function cellTap(x,y){
      if(B.phase!=='player') return;
      // tap enemy in range → attack with selected move
      if(x===B.enemy.x&&y===B.enemy.y){ if(!B.acted) doAttack(B.player,B.enemy,B.player.mon.moves[sel]); return; }
      // move
      if(!B.moved && reachable()[x+','+y]){ B.player.x=x; B.player.y=y; B.moved=true; render(); }
    }
    function cmd(c){
      if(c==='run'){ finish('run'); return; }
      if(B.phase!=='player') return;
      if(c==='fight'){ doAttack(B.player,B.enemy,B.player.mon.moves[sel]); }
      else if(c==='catch'){ doCatch(); }
      else if(c==='potion'){ doPotion(); }
      else if(c==='switch'){ doSwitch(); }
      else if(c==='end'){ endPlayerTurn(); }
    }
    function damage(att,def,mv){
      var base=roll(mv.dice[0],mv.dice[1]) + Math.floor(mv.stat/2) + Math.floor(att.level/3);
      var mult=typeMult(mv.type,def.types);
      var stab = att.types.indexOf(mv.type)!==-1 ? 1.5 : 1;
      var dmg=Math.max(mult===0?0:1, Math.round(base*mult*stab));
      return {dmg:dmg,mult:mult};
    }
    function doAttack(from,to,mv){
      if(dist(from,to)>mv.range){ log(from.mon.n+' is too far to use '+mv.name+'.'); render(); return; }
      var r=damage(from.mon,to.mon,mv);
      to.mon.hp-=r.dmg;
      var eff=r.mult===0?' It had no effect…':r.mult>1?' Super effective!':r.mult<1?' Not very effective…':'';
      log(from.mon.n+' used '+mv.name+'! '+r.dmg+' dmg.'+eff);
      B.acted=true;
      if(to.mon.hp<=0){ afterKO(to); return; }
      if(from===B.player) maybeEnemyTurn(); else render();
    }
    function afterKO(side){
      if(side===B.enemy){ log('The wild '+B.enemy.mon.n+' fainted!'); render(); setTimeout(function(){ finish('win'); },700); }
      else { // player's mon fainted
        log(B.player.mon.n+' fainted!');
        var next=B.party.filter(function(x){return x.hp>0&&x!==B.player.mon;})[0];
        if(next){ B.player.mon=next; sel=0; B.moved=B.acted=false; log('Go, '+next.n+'!'); render(); }
        else { render(); setTimeout(function(){ finish('lose'); },700); }
      }
    }
    function doCatch(){
      B.bag.balls--; B.acted=true;
      var e=B.enemy.mon;
      // PTA-style: roll d100, want LOW. Threshold rises as the foe weakens.
      var hpPct=e.hp/e.maxhp;
      var thresh=25 + Math.round((1-hpPct)*45) + (e.status?15:0); // 25..85
      var r=roll(1,100);
      log('You threw a Poké Ball… (need ≤'+thresh+', rolled '+r+')');
      if(r<=thresh){ log('Gotcha! '+e.n+' was caught!'); render(); setTimeout(function(){ finish('caught'); },700); }
      else { log(e.n+' broke free!'); maybeEnemyTurn(); }
    }
    function doPotion(){
      B.bag.potions--; var heal=Math.round(B.player.mon.maxhp*0.5);
      B.player.mon.hp=Math.min(B.player.mon.maxhp,B.player.mon.hp+heal);
      log(B.player.mon.n+' recovered '+heal+' HP.'); B.acted=true; maybeEnemyTurn();
    }
    function doSwitch(){
      var opts=B.party.filter(function(x){return x.hp>0&&x!==B.player.mon;});
      if(!opts.length) return;
      B.player.mon=opts[0]; sel=0; log('Go, '+opts[0].n+'!'); B.acted=true; maybeEnemyTurn();
    }
    function endPlayerTurn(){ maybeEnemyTurn(true); }
    function maybeEnemyTurn(force){
      if(!force && !B.acted) { render(); return; }
      B.phase='enemy'; render();
      setTimeout(enemyTurn, 550);
    }
    function enemyTurn(){
      var e=B.enemy,p=B.player;
      // pick best move; move into range if needed
      var mv=e.mon.moves[0];
      e.mon.moves.forEach(function(m){ if(m.range>=mv.range) {} });
      var best=e.mon.moves.slice().sort(function(a,b){return b.range-a.range;})[0]||mv;
      if(dist(e,p)>best.range){
        // step toward player up to its move range
        var mr=moveRange(e.mon);
        var dx=Math.sign(p.x-e.x), dy=Math.sign(p.y-e.y), steps=mr;
        while(steps-->0 && dist(e,p)>best.range){
          var nx=e.x+dx, ny=e.y+dy;
          if(nx===p.x&&ny===p.y) break;
          e.x=Math.max(0,Math.min(W-1,nx)); e.y=Math.max(0,Math.min(H-1,ny));
        }
      }
      render();
      setTimeout(function(){
        if(dist(e,p)<=best.range){ doAttack(e,p,best); }
        else { log('The wild '+e.mon.n+' crept closer.'); }
        if(B.enemy.mon.hp>0 && B.player.mon.hp>0){ B.phase='player'; B.moved=B.acted=false; render(); }
      }, 550);
    }
    function finish(result){
      el.classList.remove('on');
      var out={ result:result, party:B.party, bag:B.bag, caught: result==='caught'?B.enemy.mon:null };
      B.onEnd(out);
    }
    return { start:start };
  })();

  /* ══════════════════════════════════════════ CAMPAIGN RUNNER ══════════════ */
  var TTPlay=(function(){
    var game=null, camp=null, S=null, KEY=null;

    function open(g, campaign){
      game=g; camp=campaign; KEY='tt_camp_'+g.id+'_'+campaign.id;
      S=load();
      renderHub();
    }
    function load(){ try{ return JSON.parse(localStorage.getItem(KEY)); }catch(e){ return null; } }
    function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }

    function fresh(){
      return { scene:camp.start, party:[], box:[], bag:{balls:5,potions:3}, flags:{}, dex:[], done:false, logline:'' };
    }

    /* ---- Pokémon auto-progression: EXP, leveling, HP (all tracked for you) ---- */
    function expNeeded(lv){ return 12 + lv*lv*6; }
    function levelUp(entry){
      entry.level++;
      var before=TTMon(entry.n, entry.level-1).maxhp;
      var after=TTMon(entry.n, entry.level).maxhp;
      entry.hp=Math.min(after, (entry.hp!=null?entry.hp:after) + (after-before)); // gain the new HP
      entry._mon=null; // rebuild at the new level next battle
    }
    function awardExp(base){
      var alive=S.party.filter(function(m){return m.hp>0;});
      var ups=[];
      alive.forEach(function(m,i){
        var gain = i===0 ? base : Math.ceil(base/2);
        m.exp=(m.exp||0)+gain;
        while(m.exp>=expNeeded(m.level)){ m.exp-=expNeeded(m.level); levelUp(m); ups.push(m.n+' → Lv'+m.level); }
      });
      return ups;
    }
    // Multi-campaign menu + entry point.
    function mount(g){
      game=g;
      var camps=g.campaigns||[];
      if(camps.length===1) open(g,camps[0]); else menu(g);
    }
    function menu(g){
      game=g; camp=null;
      var box=$('play-body'); if(!box) return;
      box.innerHTML='<div class="camp-menu"><h2>Campaigns</h2><p class="camp-intro">Pick an adventure. Your progress in each is saved separately — come back any time.</p>'+
        (g.campaigns||[]).map(function(c,i){
          var st=null; try{ st=JSON.parse(localStorage.getItem('tt_camp_'+g.id+'_'+c.id)); }catch(e){}
          var status = st ? (st.done?'✓ Completed':'▶ Continue') : 'New';
          var extra = st&&!st.done&&st.party&&st.party.length ? ' · '+st.party.length+' in party' : '';
          return '<button class="camp-list" data-i="'+i+'"><b>'+esc(c.title)+'</b>'+
            '<small>'+esc(c.blurb||'')+'</small><span class="camp-tag">'+status+extra+'</span></button>';
        }).join('')+'</div>';
      Array.prototype.forEach.call(box.querySelectorAll('.camp-list'),function(b){
        b.onclick=function(){ open(g, g.campaigns[+b.dataset.i]); };
      });
    }
    function playHeader(){
      var multi=(game.campaigns||[]).length>1;
      return '<div class="play-bar">'+
        (multi?'<button id="pb-menu">≡ Campaigns</button>':'<span></span>')+
        '<button id="pb-save">💾 Save &amp; Quit</button></div>';
    }
    function wireHeader(){
      var m=$('pb-menu'); if(m) m.onclick=function(){ save(); menu(game); };
      var s=$('pb-save'); if(s) s.onclick=function(){ save(); toast('Progress saved ✓'); if((game.campaigns||[]).length>1) menu(game); else renderHub(); };
    }
    // The "Play" tab landing: continue or start.
    function renderHub(){
      var box=$('play-body'); if(!box) return;
      var has = S && !S.done;
      box.innerHTML = playHeader()+
        '<div class="camp-hero">'+
          '<h2>'+esc(camp.title)+'</h2>'+
          '<p>'+md(camp.blurb||'')+'</p>'+
        '</div>'+
        (has?'<button class="camp-btn primary" id="camp-continue">▶ Continue</button>'+
             '<div class="camp-status">'+esc(S.logline||'In progress')+' · Party: '+(S.party.map(function(m){return m.n;}).join(', ')||'—')+'</div>':'')+
        '<button class="camp-btn" id="camp-new">'+(has?'↻ Restart campaign':'▶ Start campaign')+'</button>';
      if(has) $('camp-continue').onclick=function(){ goScene(S.scene); };
      $('camp-new').onclick=function(){
        if(has && !confirm('Restart from the beginning? Your current run is lost.')) return;
        S=fresh(); save(); goScene(S.scene);
      };
      wireHeader();
    }

    function scene(id){ return camp.scenes[id]; }
    function goScene(id){
      S.scene=id; save();
      var sc=scene(id);
      if(!sc){ renderScene({type:'end',title:'The End',text:'(Missing scene: '+id+')'}); return; }
      if(sc.type==='battle'){ runBattle(sc); return; }
      if(sc.type==='reward'){ applyReward(sc); return; }
      renderScene(sc);
    }

    function derivedParty(){ // ensure party mons are battle objects
      return S.party.map(function(m){ return m._mon || (m._mon=rehydrate(m)); });
    }
    function rehydrate(m){ var mon=TTMon(m.n,m.level); mon.hp=(m.hp!=null?m.hp:mon.maxhp); return mon; }

    function renderScene(sc){
      var box=$('play-body');
      var choices=(sc.choices||[]).map(function(ch,i){
        var lock = ch.need && !S.flags[ch.need];
        return '<button class="scene-choice" data-i="'+i+'"'+(lock?' disabled':'')+'>'+
          md(ch.label)+(ch.check?'<small>check: '+ch.check.stat.toUpperCase()+' vs DC '+ch.check.dc+'</small>':'')+
          (lock?'<small>requires '+esc(ch.need)+'</small>':'')+'</button>';
      }).join('');
      box.innerHTML = playHeader()+
        '<div class="scene">'+
          (sc.title?'<h3 class="scene-title">'+esc(sc.title)+'</h3>':'')+
          '<div class="scene-text">'+md(sc.text||'')+'</div>'+
          (sc.type==='starter'?starterUI(sc):'')+
          '<div class="scene-choices">'+choices+
            (sc.type==='end'?'<button class="scene-choice end" id="scene-finish">✦ Finish</button>':'')+
          '</div>'+
        '</div>'+ partyStrip();
      Array.prototype.forEach.call(box.querySelectorAll('.scene-choice[data-i]'),function(b){
        b.onclick=function(){ choose(sc, +b.dataset.i); };
      });
      if(sc.type==='end'){ S.done=true; save(); var f=$('scene-finish'); if(f) f.onclick=function(){ if((game.campaigns||[]).length>1) menu(game); else renderHub(); }; }
      if(sc.type==='starter'){ wireStarter(sc); }
      wireHeader();
    }
    function partyStrip(){
      if(!S.party.length) return '';
      return '<div class="party-strip">'+S.party.map(function(m){
        return '<span class="party-chip">'+esc(m.n)+' <small>Lv'+m.level+'</small></span>';
      }).join('')+'<span class="party-chip bag">🎒 '+S.bag.balls+'⚪ '+S.bag.potions+'🧪</span></div>';
    }
    function starterUI(sc){
      return '<div class="starter-grid">'+sc.options.map(function(o,i){
        var s=dexByName(o.n)||{t:['Normal']};
        return '<button class="starter-card" data-s="'+i+'"><b>'+esc(o.n)+'</b><span>'+s.t.join('/')+'</span>'+
          (o.note?'<small>'+esc(o.note)+'</small>':'')+'</button>';
      }).join('')+'</div>';
    }
    function wireStarter(sc){
      Array.prototype.forEach.call($('play-body').querySelectorAll('.starter-card'),function(b){
        b.onclick=function(){
          var o=sc.options[+b.dataset.s];
          addMon(o.n, o.level||5);
          S.logline='Chose '+o.n;
          goScene(sc.to);
        };
      });
    }
    function addMon(name,level){
      var mon=TTMon(name,level);
      var entry={ n:mon.n, level:level, hp:mon.maxhp, exp:0 };
      if(S.party.length<6) S.party.push(entry); else { S.box=S.box||[]; S.box.push(entry); }
      if(S.dex.indexOf(mon.n)===-1) S.dex.push(mon.n);
      save();
    }

    function choose(sc, i){
      var ch=sc.choices[i];
      if(ch.check){
        // roll 1d20 + stat mod (use party lead's stat if present, else +0)
        var mod=0; // campaigns can key checks to trainer stats later
        var r=roll(1,20);
        var pass=(r + mod) >= ch.check.dc;
        S.flags['_lastcheck']=r;
        toast((pass?'Success':'Failure')+'! (d20='+r+' vs DC '+ch.check.dc+')');
        goScene(pass?ch.check.success:ch.check.fail);
        return;
      }
      if(ch.set){ S.flags[ch.set]=true; }
      goScene(ch.to);
    }

    function runBattle(sc){
      var party=derivedParty().filter(function(m){return m.hp>0;});
      if(!party.length){ // heal if wiped mid-run
        party=derivedParty(); party.forEach(function(m){ m.hp=m.maxhp; });
        party=party.filter(function(m){return m.hp>0;});
      }
      if(!party.length){ renderScene({type:'story',title:'No Pokémon!',text:'You have no Pokémon able to battle.',choices:[{label:'Continue',to:sc.lose||camp.start}]}); return; }
      var lead=party[0];
      var enemy=TTMon(sc.enemy.n, sc.enemy.level||lead.level);
      TTBattle.start({
        player:lead, party:derivedParty(), enemy:enemy, catchable:sc.catchable!==false, bag:S.bag,
        onEnd:function(out){
          // persist party hp + bag + catches
          S.party.forEach(function(pm){ if(pm._mon) pm.hp=pm._mon.hp; });
          S.bag=out.bag;
          if(out.caught){ addMon(out.caught.n, out.caught.level); toast('Caught & registered '+out.caught.n+'!'); }
          if(out.result==='win'||out.result==='caught'){
            var ups=awardExp((sc.enemy.level||5)*6 + 12);  // auto EXP + level-ups
            save();
            if(ups.length) setTimeout(function(){ toast(ups.join(' · ')); }, out.caught?900:0);
            goScene(sc.win);
          }
          else if(out.result==='run'){ save(); goScene(sc.run||sc.win); }
          else { save(); goScene(sc.lose||camp.start); }
        }
      });
    }
    function applyReward(sc){
      if(sc.give){
        if(sc.give.balls) S.bag.balls+=sc.give.balls;
        if(sc.give.potions) S.bag.potions+=sc.give.potions;
        if(sc.give.mon) addMon(sc.give.mon, sc.give.level||5);
        if(sc.give.heal){ derivedParty().forEach(function(m){ m.hp=m.maxhp; }); S.party.forEach(function(pm){ if(pm._mon) pm.hp=pm._mon.hp; }); }
      }
      save();
      renderScene({type:'story',title:sc.title,text:sc.text,choices:[{label:sc.cont||'Continue',to:sc.to}]});
    }
    function toast(t){
      var d=document.createElement('div'); d.className='tt-toast'; d.textContent=t;
      document.body.appendChild(d); setTimeout(function(){ d.classList.add('show'); },10);
      setTimeout(function(){ d.classList.remove('show'); setTimeout(function(){ d.remove(); },300); },1600);
    }
    return { open:open, mount:mount, menu:menu, renderHub:renderHub };
  })();

  window.TTMon=TTMon; window.TTBattle=TTBattle; window.TTPlay=TTPlay;
})();
