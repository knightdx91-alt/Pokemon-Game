import json,re,os,time,urllib.request,urllib.error
CACHE="/tmp/dexfix/cache"; os.makedirs(CACHE,exist_ok=True)
broken=[(n,nm,c) for n,nm,c in json.load(open("/tmp/dexfix/broken.json"))["broken"] if nm!="NONE"]

def get(url):
    key=os.path.join(CACHE,re.sub(r'[^a-z0-9]+','_',url.split('/api/v2/')[1]))+".json"
    if os.path.exists(key):
        try: return json.load(open(key))
        except: pass
    for a in range(4):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'ee-dexfix'})
            d=json.load(urllib.request.urlopen(req,timeout=40))
            json.dump(d,open(key,'w')); return d
        except urllib.error.HTTPError as e:
            if e.code==404: return None
            time.sleep(1.5*(a+1))
        except Exception: time.sleep(1.5*(a+1))
    return None

# EE name -> (pokemon_slug for height/weight, species_slug for genus/flavor)
FORM={
 'PRIMAL_KYOGRE':('kyogre-primal','kyogre'),'PRIMAL_GROUDON':('groudon-primal','groudon'),
 'SHAYMIN_SKY':('shaymin-sky','shaymin'),'GIRATINA_ORIGIN':('giratina-origin','giratina'),
 'DARMANITAN_ZEN':('darmanitan-zen','darmanitan'),'MELOETTA_PIROUETTE':('meloetta-pirouette','meloetta'),
 'AEGISLASH_BLADE':('aegislash-blade','aegislash'),'HOOPA_UNBOUND':('hoopa-unbound','hoopa'),
 'MINIOR_CORE':('minior-red','minior'),'LYCANROC_MIDNIGHT':('lycanroc-midnight','lycanroc'),
 'LYCANROC_DUSK':('lycanroc-dusk','lycanroc'),'ZYGARDE_10':('zygarde-10','zygarde'),
 'ZYGARDE_COMPLETE':('zygarde-complete','zygarde'),'KYUREM_BLACK':('kyurem-black','kyurem'),
 'KYUREM_WHITE':('kyurem-white','kyurem'),'MEOWSTIC_F':('meowstic-female','meowstic'),
 'TORNADUS_THERIAN':('tornadus-therian','tornadus'),'THUNDURUS_THERIAN':('thundurus-therian','thundurus'),
 'LANDORUS_THERIAN':('landorus-therian','landorus'),
 'BURMY_SANDY':('burmy-sandy','burmy'),'BURMY_TRASH':('burmy-trash','burmy'),
 'WORMADAM_SANDY':('wormadam-sandy','wormadam'),'WORMADAM_TRASH':('wormadam-trash','wormadam'),
 'ROTOM_HEAT':('rotom-heat','rotom'),'ROTOM_WASH':('rotom-wash','rotom'),'ROTOM_FROST':('rotom-frost','rotom'),
 'ROTOM_FAN':('rotom-fan','rotom'),'ROTOM_MOW':('rotom-mow','rotom'),
}
def slugs(name):
    if name in FORM: return FORM[name]
    if name.startswith('MEGA_'):
        rest=name[5:].lower()
        if rest.endswith('_x'): base=rest[:-2].replace('_','-'); return (base+'-mega-x',base)
        if rest.endswith('_y'): base=rest[:-2].replace('_','-'); return (base+'-mega-y',base)
        base=rest.replace('_','-'); return (base+'-mega',base)
    if name.startswith('ALOLAN_'):
        base=name[7:].lower().replace('_','-'); return (base+'-alola',base)
    # base species
    s=name.lower().replace('_','-')
    fix={'nidoran-f':'nidoran-f','nidoran-m':'nidoran-m','wormadam':'wormadam-plant','burmy':'burmy-plant',
         'darmanitan':'darmanitan-standard','meowstic':'meowstic-male','basculin':'basculin-red-striped',
         'zygarde':'zygarde-50','minior':'minior-red-meteor','mimikyu':'mimikyu-disguised',
         'gourgeist':'gourgeist-average','pumpkaboo':'pumpkaboo-average','lycanroc':'lycanroc-midday',
         'oricorio':'oricorio-baile','flabebe':'flabebe','type-null':'type-null',
         'giratina':'giratina-altered','shaymin':'shaymin-land','tornadus':'tornadus-incarnate',
         'thundurus':'thundurus-incarnate','landorus':'landorus-incarnate','pyroar':'pyroar-male',
         'wishiwashi':'wishiwashi-solo','keldeo':'keldeo-ordinary'}
    return (fix.get(s,s), s)

def wrap(text,width=39,maxlines=4):
    words=text.split(); lines=[]; cur=""
    for w in words:
        if len(cur)+len(w)+(1 if cur else 0)<=width: cur=(cur+" "+w).strip()
        else: lines.append(cur); cur=w
        if len(lines)==maxlines: break
    if cur and len(lines)<maxlines: lines.append(cur)
    return lines[:maxlines]

def clean(t):
    t=t.replace('\x0c',' ').replace('\n',' ').replace('\r',' ').replace('­','').replace('​','')
    t=t.replace('POKéMON','Pokémon').replace('POKeMON','Pokémon')
    t=re.sub(r'\s+',' ',t).strip()
    return t

out={}
for i,(sid,name,cur) in enumerate(broken):
    pslug,sslug=slugs(name)
    pk=get(f"https://pokeapi.co/api/v2/pokemon/{pslug}")
    if pk is None: pk=get(f"https://pokeapi.co/api/v2/pokemon/{sslug}")
    sp=get(f"https://pokeapi.co/api/v2/pokemon-species/{sslug}")
    height=pk['height'] if pk else 10
    weight=pk['weight'] if pk else 100
    genus="Unknown"
    desc="This Pokémon has recently been added to the regional records."
    if sp:
        gs=[g['genus'] for g in sp['genera'] if g['language']['name']=='en']
        if gs: genus=gs[0].replace(' Pokémon','').replace('Pokémon','').strip() or 'Unknown'
        fe=[f['flavor_text'] for f in sp['flavor_text_entries'] if f['language']['name']=='en']
        if fe:
            # prefer a reasonably long one
            fe.sort(key=lambda x:abs(len(x)-140)); desc=clean(fe[0])
    out[name]={'id':sid,'height':int(height),'weight':int(weight),
               'category':clean(genus)[:11],'desc_lines':wrap(clean(desc)),
               'pslug':pslug,'sslug':sslug,'ok':bool(pk and sp)}
    if (i+1)%25==0: print(f"...{i+1}/{len(broken)}")
json.dump(out,open("/tmp/dexfix/data.json","w"),ensure_ascii=False,indent=0)
miss=[k for k,v in out.items() if not v['ok']]
print("done",len(out),"missing-data:",len(miss),miss[:20])
