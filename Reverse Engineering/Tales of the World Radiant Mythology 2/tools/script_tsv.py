"""Export / import every skit + NPC line for an English style pass.

  python3 script_tsv.py export GAME.iso lines.tsv     # key<TAB>index<TAB>text  (\\r\\n shown as |)
  python3 script_tsv.py import GAME.iso lines.tsv     # writes changed lines back into GAME.iso (in place)

Edit only the third column. Keep lines <= ~42 characters (use | for a line break, max 4 per box).
"""
import sys, io, gzip, collections, pycdlib
from facechat import parse, build
from isolib import members, repack, patch_iso
def scripts(iso):
    for folder in ('facechat','npc'):
        for root,ds,fs in iso.walk(iso_path='/PSP_GAME/USRDIR/'+folder):
            for f in fs:
                p=root+'/'+f; b=io.BytesIO(); iso.get_file_from_iso_fp(b,iso_path=p); d=b.getvalue()
                for e in members(d)[1]:
                    if e[5].endswith('.scr'):
                        raw=gzip.decompress(e[4]) if e[4][:2]==b'\x1f\x8b' else e[4]
                        yield p, d, e[5], parse(raw)
def export(isop, out):
    iso=pycdlib.PyCdlib(); iso.open(isop)
    with open(out,'w',encoding='latin-1') as w:
        for p,d,n,P in scripts(iso):
            for i,s in enumerate(P['strs']):
                w.write(f"{p.split('USRDIR/')[1].split(';')[0]}|{n}\t{i}\t{s.decode('latin-1').replace(chr(13)+chr(10),'|').replace(chr(10),'|')}\n")
def imp(isop, tsv):
    want=collections.defaultdict(dict)
    for line in open(tsv,encoding='latin-1'):
        k,i,t=line.rstrip('\n').split('\t'); want[k][int(i)]=t.replace('|','\r\n').encode('latin-1')
    iso=pycdlib.PyCdlib(); iso.open(isop); changes={}; per=collections.defaultdict(dict)
    for p,d,n,P in scripts(iso):
        k=p.split('USRDIR/')[1].split(';')[0]+'|'+n; strs=list(P['strs']); new=[want[k].get(i,s) for i,s in enumerate(strs)]
        if new!=strs: per[p][n]=build(P,new); per[p]['__d']=d
    iso.close()
    for p,r in per.items():
        d=r.pop('__d'); changes[p]=repack(d,r)
    print('archives changed',len(changes)); patch_iso(isop,changes)
if __name__=='__main__':
    {'export':export,'import':imp}[sys.argv[1]](sys.argv[2],sys.argv[3])
