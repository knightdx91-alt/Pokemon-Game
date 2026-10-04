import struct, gzip, numpy as np
from PIL import Image
from ppt import decode
def swizzle(buf, w_bytes, h):
    out=bytearray(len(buf)); bw=w_bytes//16; i=0
    for by in range(h//8):
        for bx in range(bw):
            for r in range(8):
                o=(by*8+r)*w_bytes+bx*16; out[i:i+16]=buf[o:o+16]; i+=16
    return bytes(out)
def encode(orig, img, swz):
    """Re-encode img into the same ppt layout as orig (same dims/format/palette size)."""
    d=bytearray(orig); _,_,fmt,_,sw,sh,vw,vh=struct.unpack_from('<8H',d,4)
    img=img.convert('RGBA'); canvas=np.zeros((sh,sw,4),np.uint8); canvas[:vh,:vw]=np.asarray(img)[:vh,:vw]
    if fmt==3:
        px=canvas.tobytes()
    elif fmt==5:
        po=struct.unpack_from('<I',d,0x18)[0]; ncol=min(256,(len(d)-po-16)//4)
        q=Image.fromarray(canvas,'RGBA').quantize(colors=ncol,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
        pal=np.array(q.getpalette(rawmode='RGBA')[:ncol*4],np.uint8).reshape(-1,4)
        full=np.zeros((ncol,4),np.uint8); full[:len(pal)]=pal
        d[po+16:po+16+ncol*4]=full.tobytes(); px=np.asarray(q,np.uint8).tobytes()
    else: raise ValueError(fmt)
    bpp={3:4,5:1}[fmt]
    if swz: px=swizzle(px,sw*bpp,sh)
    assert len(px)==sw*sh*bpp
    d[0x20:0x20+len(px)]=px
    return bytes(d)
