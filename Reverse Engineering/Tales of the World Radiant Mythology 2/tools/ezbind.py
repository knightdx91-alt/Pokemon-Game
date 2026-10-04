import struct, gzip, zlib
def unpack(d):
    """EZBIND: 'EZBIND\0\0', u32 count, u32 align, then count x {name_off,size,data_off,hash}."""
    if d[:6]!=b'EZBIND': return None
    n=struct.unpack_from('<I',d,8)[0]; out=[]
    for i in range(n):
        no,sz,do,h=struct.unpack_from('<IIII',d,0x10+16*i)
        name=d[no:d.index(b'\0',no)].decode('ascii','replace')
        blob=d[do:do+sz]
        if blob[:2]==b'\x1f\x8b':
            try: blob=gzip.decompress(blob)
            except Exception: blob=zlib.decompressobj(31).decompress(blob)
        out.append((name,blob))
    return out
