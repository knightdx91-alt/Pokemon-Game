import json,sys,re
from PIL import Image,ImageDraw
idx=json.load(open('/tmp/psp/index.json'))
items=sorted(((v['label'],h) for h,v in idx.items()))
excl=re.compile(r'FACE\d+_\d+_(base|anim)|face\.ppt$')
sel=[(l,h) for l,h in items if not excl.search(l)]
groups={}
for l,h in sel:
    g=l.split('/')[0]; groups.setdefault(g,[]).append((l,h))
T=150; cols=6; rows=5
num=0; manifest={}
for g,L in groups.items():
    for s in range(0,len(L),cols*rows):
        chunk=L[s:s+cols*rows]
        sheet=Image.new('RGB',(cols*T,rows*(T+14)),(40,40,48)); d=ImageDraw.Draw(sheet)
        for i,(l,h) in enumerate(chunk):
            im=Image.open(f'/tmp/psp/png/{h}.png').convert('RGBA'); im.thumbnail((T-4,T-4))
            bg=Image.new('RGBA',im.size,(110,110,120,255)); bg.alpha_composite(im)
            x=(i%cols)*T; y=(i//cols)*(T+14)
            sheet.paste(bg,(x+2,y+2)); d.text((x+2,y+T),f'{num}',fill=(255,255,0))
            manifest[num]=(l,h); num+=1
        name=f'/tmp/psp/sheets/{g}_{s//(cols*rows):02d}.png'; sheet.save(name)
json.dump(manifest,open('/tmp/psp/manifest.json','w'))
print(num,'thumbs'); import os; print(sorted(os.listdir('/tmp/psp/sheets')))
