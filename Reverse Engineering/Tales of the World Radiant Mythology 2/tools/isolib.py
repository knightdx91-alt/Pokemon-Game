import io,struct,gzip,pycdlib
def gz(raw,name):
    b=io.BytesIO()
    with gzip.GzipFile(filename=name,mode='wb',fileobj=b,mtime=0) as f: f.write(raw)
    return b.getvalue()
def members(d):
    n,align=struct.unpack_from('<II',d,8); ents=[]
    for i in range(n):
        no,sz,do,h=struct.unpack_from('<IIII',d,0x10+16*i); ents.append([no,sz,do,h,d[do:do+sz],d[no:d.index(b'\0',no)].decode()])
    return align,ents
def repack(d, repl):
    align,ents=members(d); hit=0
    for e in ents:
        if e[5] in repl:
            new=repl[e[5]]
            if e[4][:2]==b'\x1f\x8b' and new[:2]!=b'\x1f\x8b':
                fn=e[4][10:e[4].index(b'\0',10)] if e[4][3]&8 else e[5].encode()
                new=gz(new,fn.decode())
            e[4]=new; hit+=1
    assert hit==len(repl)
    first=min(e[2] for e in ents); out=bytearray(d[:first])
    for e in sorted(ents,key=lambda e:e[2]):
        out+=b'\0'*((-len(out))%align); e[2]=len(out); e[1]=len(e[4]); out+=e[4]
    out+=b'\0'*((-len(out))%align)
    for i,e in enumerate(ents): struct.pack_into('<IIII',out,0x10+16*i,e[0],e[1],e[2],e[3])
    return bytes(out)
def patch_iso(path, changes):
    iso=pycdlib.PyCdlib(); iso.open(path); locs={}
    for p in changes:
        rec=iso.get_record(iso_path=p); par=rec.parent
        locs[p]=(rec.extent_location(),rec.data_length,par.extent_location(),par.data_length,rec.file_identifier())
    iso.close(); moved=0
    with open(path,'r+b') as f:
        f.seek(0,2); end=f.tell()
        for p,data in changes.items():
            lba,olen,plba,plen,ident=locs[p]
            if len(data)<=((olen+2047)//2048)*2048: newlba=lba
            else: newlba=end//2048; end+=((len(data)+2047)//2048)*2048; moved+=1
            f.seek(newlba*2048); f.write(data+b'\0'*((-len(data))%2048))
            f.seek(plba*2048); pd=bytearray(f.read(plen)); pos=0; done=False
            while pos<len(pd):
                ln=pd[pos]
                if ln==0: pos=((pos//2048)+1)*2048; continue
                if bytes(pd[pos+33:pos+33+pd[pos+32]])==ident:
                    struct.pack_into('<I',pd,pos+2,newlba); struct.pack_into('>I',pd,pos+6,newlba)
                    struct.pack_into('<I',pd,pos+10,len(data)); struct.pack_into('>I',pd,pos+14,len(data)); done=True; break
                pos+=ln
            assert done,p
            f.seek(plba*2048); f.write(pd)
        vs=end//2048; f.seek(16*2048+80); f.write(struct.pack('<I',vs)+struct.pack('>I',vs)); f.truncate(end)
    return moved
