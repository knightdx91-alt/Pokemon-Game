import sys,pickle,json,gzip,numpy as np; sys.path.insert(0,'/tmp/psp')
from ppt import decode
from PIL import Image
seen=pickle.load(open('/tmp/psp/images.pkl','rb'))
def seam_ratio(raw):
    # Read flat; swizzled data shows discontinuities at every 16-byte block edge.
    im=decode(raw,False); a=np.asarray(im.convert('RGB')).astype(np.int16)
    import struct
    fmt=struct.unpack_from('<H',raw,8)[0]; bpp={5:1,3:4,2:2,1:2}[fmt]; step=16//bpp
    if a.shape[1]<=step*2: return 1.0
    dx=np.abs(np.diff(a,axis=1)).mean(axis=(0,2))
    cols=np.arange(len(dx)); seam=dx[(cols%step)==step-1].mean(); inner=dx[(cols%step)!=step-1].mean()
    return (seam+1)/(inner+1)
def rough(im):
    a=np.asarray(im.convert('RGB')).astype(np.int16)
    return np.abs(np.diff(a,axis=0)).mean()+np.abs(np.diff(a,axis=1)).mean()
index={}
for h,(l,d) in seen.items():
    raw=gzip.decompress(d) if d[:2]==b'\x1f\x8b' else d
    if raw[:4]!=b'ppt\0':
        if raw[:4]==b'\x89PNG':
            open(f'/tmp/psp/png/{h}.png','wb').write(raw); index[h]={'label':l,'swz':None}
        continue
    try:
        a=decode(raw,False)
        try:
            b=decode(raw,True); best,s=(b,True) if (seam_ratio(raw)>1.3 or rough(b)<rough(a)) else (a,False)
        except Exception: best,s=a,False
    except Exception as e:
        print('fail',l,e); continue
    best.save(f'/tmp/psp/png/{h}.png'); index[h]={'label':l,'swz':s,'size':best.size}
json.dump(index,open('/tmp/psp/index.json','w'),indent=0)
print(len(index))
