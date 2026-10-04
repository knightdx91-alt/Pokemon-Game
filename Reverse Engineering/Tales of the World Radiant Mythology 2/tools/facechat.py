import struct
def parse(raw):
    assert raw[:8]==b'FaceChat'
    unk,sc,cc,pad=struct.unpack_from('<hhhH',raw,8)
    code=raw[0x10:0x10+cc*2]; lo=0x10+cc*2; so=lo+sc*2
    offs=struct.unpack_from(f'<{sc}H',raw,lo)
    strs=[raw[so+o:raw.index(b'\0',so+o)] for o in offs]
    tail_start=so+max((o+len(s)+1 for o,s in zip(offs,strs)),default=0)
    return dict(unk=unk,pad=pad,code=code,offs=offs,strs=strs,blob=raw[so:],so=so)
def build(p, strs):
    """Rebuild with new string list (same count). Strings are re-laid out sequentially."""
    out=bytearray(); offs=[]
    for s in strs:
        offs.append(len(out)); out+=s+b'\0'
    assert len(out)<65536
    hdr=b'FaceChat'+struct.pack('<hhhH',p['unk'],len(strs),len(p['code'])//2,p['pad'])
    body=hdr+p['code']+struct.pack(f'<{len(strs)}H',*offs)+bytes(out)
    return body
