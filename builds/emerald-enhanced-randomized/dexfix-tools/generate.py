import json,re
EE="/home/user/Pokemon-Game/source/emerald-enhanced"
data=json.load(open("/tmp/dexfix/data.json"))

sh=open(f"{EE}/include/constants/species.h").read()
natdex={}
for line in sh.splitlines():
    if line.strip().startswith("//"): continue
    m=re.match(r"\s*#define NATIONAL_DEX_([A-Z0-9_]+)\s+(\d+)",line)
    if m: natdex.setdefault(m.group(1),int(m.group(2)))
name2id={}
for line in sh.splitlines():
    m=re.match(r"\s*#define SPECIES_([A-Z0-9_]+)\s+(\d+)\s*$",line)
    if m: name2id.setdefault(m.group(1),int(m.group(2)))

pc=open(f"{EE}/src/pokemon.c").read()
i=pc.index("gSpeciesToNationalPokedexNum[NUM_SPECIES]");b=pc.index("{",i);d=0
for j in range(b,len(pc)):
    if pc[j]=="{":d+=1
    elif pc[j]=="}":
        d-=1
        if d==0:e=j;break
arr=pc[b+1:e]
sp2nat={}
usednums=set()
for line in arr.splitlines():
    line=line.split("//")[0]
    m=re.search(r"SPECIES_TO_NATIONAL\(([A-Z0-9_]+)\)",line)
    if m:
        v=natdex.get(m.group(1),0); sp2nat[m.group(1)]=v; usednums.add(v); continue
    m=re.search(r"\[SPECIES_([A-Z0-9_]+)\s*-\s*1\]\s*=\s*(NATIONAL_DEX_[A-Z0-9_]+|0x[0-9a-fA-F]+|\d+)",line)
    if m:
        rv=m.group(2)
        v=natdex.get(rv[len('NATIONAL_DEX_'):],0) if rv.startswith('NATIONAL_DEX_') else int(rv,0)
        sp2nat[m.group(1)]=v; usednums.add(v)
# entry numbers present
pe=open(f"{EE}/src/data/pokemon/pokedex_entries.h").read()
entry_nums=set()
for line in pe.splitlines():
    s=line.strip()
    if s.startswith("/*") or s.startswith("//"): continue
    m=re.match(r"\[NATIONAL_DEX_([A-Z0-9_]+)\]\s*=",s)
    if m and m.group(1) in natdex: entry_nums.add(natdex[m.group(1)])
    m2=re.match(r"\[(\d+)\]\s*=",s)
    if m2: entry_nums.add(int(m2.group(1)))
usednums.discard(0)

# TRUE broken = real species (in data.json) with natdex 0 OR natdex without an entry,
# AND not already having a raw/macro mapping we must not duplicate.
already_mapped_ids=set()
for n,v in sp2nat.items():
    if n in name2id: already_mapped_ids.add(name2id[n])

need=[]
skipped=[]
seen_ids=set()
for name,v in data.items():
    nd=sp2nat.get(name,0)
    if nd>0 and nd in entry_nums:
        skipped.append(name); continue           # displays fine already (e.g. shared-dex form)
    if name in sp2nat:
        skipped.append(name); continue            # has a mapping line already -> can't duplicate index; leave as-is
    nid=name2id.get(name)
    if nid is None or nid in already_mapped_ids or nid in seen_ids:
        skipped.append(name); continue            # alias / duplicate id
    seen_ids.add(nid)
    need.append(name)
need.sort(key=lambda n:name2id[n])

gen=(x for x in range(686,20000) if x not in usednums)
assign={n:next(gen) for n in need}
maxnum=max(assign.values())

def san(t):
    t=t.replace('\\','').replace('"','')
    o=[]
    for ch in t:
        c=ord(ch)
        if ch in "éÉ" or 32<=c<127: o.append(ch)
        elif ch in "’‘“”": o.append("'")
        elif ch in "–—": o.append("-")
        elif ch=="♀": o.append(" F")
        elif ch=="♂": o.append(" M")
        elif ch=="…": o.append("...")
    return "".join(o)

txt=["// AUTO-GENERATED Pokedex descriptions (PokeAPI: height=dm, weight=hg).",""]
for name in need:
    lines=[san(l) for l in data[name]['desc_lines'] if l.strip()] or ["Data is still being compiled for","this Pokemon."]
    body="\n".join('    "%s%s"'%(l,("\\n" if k<len(lines)-1 else "")) for k,l in enumerate(lines))
    txt.append("const u8 gRandomDexText_%s[] = _(\n%s);"%(name,body))
open(f"{EE}/src/data/pokemon/pokedex_text_random.h","w").write("\n".join(txt)+"\n")

ent=["    // AUTO-GENERATED dex entries for previously entry-less species."]
for name in need:
    v=assign[name]; dd=data[name]
    ent.append("    [%d] =\n    {\n        .categoryName = _(\"%s\"),\n        .height = %d,\n        .weight = %d,\n        .description = gRandomDexText_%s,\n        .pokemonScale = 256,\n        .pokemonOffset = 0,\n        .trainerScale = 256,\n        .trainerOffset = 0,\n    },"%(
        v, san(dd['category']) or "Unknown", dd['height'], dd['weight'], name))
open(f"{EE}/src/data/pokemon/pokedex_entries_random.h","w").write("\n".join(ent)+"\n")

nat=["    // AUTO-GENERATED national dex numbers for previously unmapped species."]
for name in need:
    nat.append("    [SPECIES_%s - 1] = %d,"%(name,assign[name]))
open(f"{EE}/src/data/pokemon/pokedex_natdex_random.h","w").write("\n".join(nat)+"\n")

print("need(fix):",len(need),"skipped(already ok/mapped):",len(skipped))
print("natdex range",min(assign.values()),"..",maxnum,"=> NATIONAL_DEX_COUNT/POKEMON_SLOTS_NUMBER =",maxnum+1)
json.dump({"maxnum":maxnum,"need":need,"skipped":skipped},open("/tmp/dexfix/assign.json","w"))
