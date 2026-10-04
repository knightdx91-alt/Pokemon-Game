import sys,io,struct,gzip,pickle,shutil,os,pycdlib; sys.path.insert(0,'/tmp/psp')
from PIL import Image
SRC='/tmp/psp/dl.bin'; OUT='/tmp/psp/RM2_EN_iter3_imgfix.iso'
enc=pickle.load(open('/tmp/psp/encoded.pkl','rb'))
def raw_members(d):
    n,align=struct.unpack_from('<II',d,8); ents=[]
    for i in range(n):
        no,sz,do,h=struct.unpack_from('<IIII',d,0x10+16*i); ents.append([no,sz,do,h,d[do:do+sz]])
    return align,ents
def name_of(d,no): return d[no:d.index(b'\0',no)].decode()
def repack(d, repl):
    """repl: {member_name: new_bytes}. Keeps header/name table; re-lays data in original order."""
    align,ents=raw_members(d); hit=0
    for e in ents:
        nm=name_of(d,e[0])
        if nm in repl:
            new=repl[nm]
            if e[4][:2]==b'\x1f\x8b' and new[:2]!=b'\x1f\x8b':      # original was gzipped: keep it gzipped
                fn=b''
                if e[4][3]&8: fn=e[4][10:e[4].index(b'\0',10)]
                new=gz(new,fn.decode() or nm)
            e[4]=new; hit+=1
    assert hit==len(repl), (hit,repl.keys())
    first=min(e[2] for e in ents); out=bytearray(d[:first])
    for e in sorted(ents,key=lambda e:e[2]):
        pad=(-len(out))%align; out+=b'\0'*pad
        e[2]=len(out); e[1]=len(e[4]); out+=e[4]
    out+=b'\0'*((-len(out))%align)
    for i,e in enumerate(ents): struct.pack_into('<IIII',out,0x10+16*i,e[0],e[1],e[2],e[3])
    return bytes(out)
def gz(raw,name):
    b=io.BytesIO()
    with gzip.GzipFile(filename=name,mode='wb',fileobj=b,mtime=0) as f: f.write(raw)
    return b.getvalue()
def png(path):
    b=io.BytesIO(); Image.open(path).convert('RGBA' if 'icon' not in path else 'RGBA').save(b,'PNG',optimize=True); return b.getvalue()
iso=pycdlib.PyCdlib(); iso.open(SRC)
def get(p):
    b=io.BytesIO(); iso.get_file_from_iso_fp(b,iso_path=p); return b.getvalue()
U='/PSP_GAME/USRDIR/'; E='/tmp/psp/edited/'
changes={}
for arc in ['facechat/gv0507.arc','facechat/gv0306.arc','facechat/gv0206.arc','facechat/gv0102.arc']:
    changes[U+arc]=repack(get(U+arc),{'gv1.ppt':enc['facechat/gv0507.arc>gv1.ppt']})
changes[U+'facechat/gv0502.arc']=repack(get(U+'facechat/gv0502.arc'),{'gv2.ppt':enc['facechat/gv0502.arc>gv2.ppt']})
changes[U+'common/network.arc']=repack(get(U+'common/network.arc'),{'mercenary_bg14.ppt':enc['common/network.arc>mercenary_bg14.ppt']})
changes[U+'credit/credit.arc']=repack(get(U+'credit/credit.arc'),{'edlogo.ppt':enc['credit/credit.arc>edlogo.ppt']})
changes[U+'title/title.arc']=repack(get(U+'title/title.arc'),{'lisence.ppt':enc['title/title.arc>lisence.ppt']})
h0=enc['puzzle/hex/hex_help_0.ppt.gz']; h1=enc['puzzle/hex/hex_help_1.ppt.gz']
changes[U+'puzzle/hex/hex_help_0.ppt.gz']=gz(h0,'hex_help_0.ppt'); changes[U+'puzzle/hex/hex_help_1.ppt.gz']=gz(h1,'hex_help_1.ppt')
changes[U+'puzzle/hex_help.arc']=repack(get(U+'puzzle/hex_help.arc'),{'hex_help_0.ppt.gz':gz(h0,'hex_help_0.ppt'),'hex_help_1.ppt.gz':gz(h1,'hex_help_1.ppt')})
for f,icon in [('savedata','sd'),('exsavedata','ex'),('nisavedata','ni'),('nesavedata',None)]:
    r={'pic1.png':png(E+f'{f}_pic1.png')}
    if icon: r['icon0.png']=png(E+f'{icon}_icon0.png')
    changes[U+f'game/{f}.bin']=repack(get(U+f'game/{f}.bin'),r)
changes['/PSP_GAME/PIC1.PNG']=png(E+'root_PIC1.png')
# ---- patch ISO: in place if it fits the original sectors, else append at end
locs={}
for p in changes:
    rec=iso.get_record(iso_path=p); par=rec.parent
    locs[p]=(rec.extent_location(), rec.data_length, par.extent_location(), par.data_length, rec.file_identifier())
iso.close()
if not os.path.exists(OUT): shutil.copyfile(SRC,OUT)
with open(OUT,'r+b') as f:
    f.seek(0,2); end=f.tell(); assert end%2048==0
    for p,data in changes.items():
        lba,olen,plba,plen,ident=locs[p]
        alloc=((olen+2047)//2048)*2048
        if len(data)<=alloc: newlba=lba
        else: newlba=end//2048; end+=((len(data)+2047)//2048)*2048
        f.seek(newlba*2048); f.write(data+b'\0'*((-len(data))%2048))
        # update directory record in parent extent
        f.seek(plba*2048); pd=bytearray(f.read(plen)); pos=0; done=False
        while pos<len(pd):
            ln=pd[pos]
            if ln==0: pos=((pos//2048)+1)*2048; continue
            il=pd[pos+32]; idn=bytes(pd[pos+33:pos+33+il])
            if idn==ident:
                struct.pack_into('<I',pd,pos+2,newlba); struct.pack_into('>I',pd,pos+6,newlba)
                struct.pack_into('<I',pd,pos+10,len(data)); struct.pack_into('>I',pd,pos+14,len(data)); done=True; break
            pos+=ln
        assert done,p
        f.seek(plba*2048); f.write(pd)
        print(f"{p:50} {olen:>9} -> {len(data):>9}  {'in place' if newlba==lba else 'moved to LBA %d'%newlba}")
    # volume space size in PVD (sector 16)
    f.seek(16*2048+80); struct.pack_into
    vs=end//2048; f.seek(16*2048+80); f.write(struct.pack('<I',vs)+struct.pack('>I',vs))
    f.truncate(end)
print('ISO size',end)
