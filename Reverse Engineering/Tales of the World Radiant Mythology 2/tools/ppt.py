import struct, gzip, numpy as np
from PIL import Image
def unswizzle(buf, w_bytes, h):
    """PSP swizzle: 16-byte x 8-row blocks."""
    out=bytearray(len(buf)); bw=w_bytes//16; i=0
    for by in range(h//8):
        for bx in range(bw):
            for r in range(8):
                o=(by*8+r)*w_bytes+bx*16
                out[o:o+16]=buf[i:i+16]; i+=16
    return bytes(out)
def header(d):
    w,h,fmt,_,w2,h2,bw,bh=struct.unpack_from('<8H',d,4)
    return w,h,fmt,bw,bh
def decode(d, swz=None):
    if d[:2]==b'\x1f\x8b': d=gzip.decompress(d)
    _,_,fmt,_,_=header(d)
    _,_,_,_,bw,bh,vw,vh=struct.unpack_from('<8H',d,4)   # stored dims, then visible dims
    w,h=vw,vh
    bpp={5:1,3:4,2:2,1:2}[fmt]
    n=bw*bh*bpp
    px=d[0x20:0x20+n]
    if swz is None: swz=False
    if swz and (bw*bpp)%16==0 and bh%8==0: px=unswizzle(px,bw*bpp,bh)
    if fmt==5:
        po=struct.unpack_from('<I',d,0x18)[0]
        pb=d[po+16:po+16+1024]; pb=pb[:len(pb)//4*4]
        pal=np.zeros((256,4),np.uint8); p=np.frombuffer(pb,np.uint8).reshape(-1,4); pal[:len(p)]=p
        a=pal[np.frombuffer(px,np.uint8)].reshape(bh,bw,4)
    elif fmt==3:
        a=np.frombuffer(px,np.uint8).reshape(bh,bw,4)
    else:
        v=np.frombuffer(px,'<u2').reshape(bh,bw).astype(np.uint32)
        r=(v&0x1f)<<3; g=((v>>5)&0x1f)<<3; b=((v>>10)&0x1f)<<3; al=np.where(v>>15,255,0)
        a=np.stack([r,g,b,al],-1).astype(np.uint8)
    return Image.fromarray(np.ascontiguousarray(a[:h,:w]),'RGBA')
