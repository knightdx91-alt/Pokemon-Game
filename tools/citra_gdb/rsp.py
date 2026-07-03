import socket, binascii

class RSP:
    def __init__(s, host='127.0.0.1', port=24689, timeout=600):
        s.sock = socket.create_connection((host, port), timeout=30)
        s.sock.settimeout(timeout)
        s.buf = b''
    def _cks(s, d): return sum(d) % 256
    def send(s, cmd):
        if isinstance(cmd, str): cmd = cmd.encode()
        pkt = b'$' + cmd + b'#' + f'{s._cks(cmd):02x}'.encode()
        s.sock.sendall(pkt)
    def _read1(s):
        if s.buf:
            c = s.buf[:1]; s.buf = s.buf[1:]; return c
        d = s.sock.recv(1)
        if d == b'': raise EOFError('stub closed')
        return d
    def _read2(s):
        r = b''
        while len(r) < 2: r += s._read1()
        return r
    def recv_pkt(s, timeout=None):
        if timeout is not None: s.sock.settimeout(timeout)
        while True:
            c = s._read1()
            if c == b'$': break
        data = b''
        while True:
            c = s._read1()
            if c == b'#': break
            data += c
        s._read2()
        s.sock.sendall(b'+')
        return data
    def drain(s):
        """Discard any already-buffered stale packets (non-blocking)."""
        s.sock.setblocking(False)
        try:
            while True:
                d = s.sock.recv(4096)
                if not d:
                    break
                s.buf += d
        except BlockingIOError:
            pass
        finally:
            s.sock.setblocking(True)
            s.sock.settimeout(600)
        # drop everything buffered up to and including the last '#xx'
        s.buf = b''
    def cmd(s, c, timeout=None):
        s.drain()
        s.send(c); return s.recv_pkt(timeout)
    def cont_async(s): s.send(b'c')
    def interrupt(s): s.sock.sendall(b'\x03')
    def wait_halt(s, timeout=120): return s.recv_pkt(timeout)
    def set_bp(s, addr): return s.cmd(f'Z0,{addr:x},4')
    def del_bp(s, addr): return s.cmd(f'z0,{addr:x},4')
    # watchpoints: kind 2=write, 3=read, 4=access
    def set_wp(s, addr, length, kind=4): return s.cmd(f'Z{kind},{addr:x},{length:x}')
    def del_wp(s, addr, length, kind=4): return s.cmd(f'z{kind},{addr:x},{length:x}')
    def regs(s):
        r = s.cmd('g')
        n = min(len(r) // 8, 17)
        return [int.from_bytes(binascii.unhexlify(r[i*8:(i+1)*8]), 'little') for i in range(n)]
    def mem(s, addr, length):
        out = b''
        while length > 0:
            chunk = min(length, 512)
            r = s.cmd(f'm{addr:x},{chunk:x}')
            if r.startswith(b'E'): raise IOError(f'mem err {r} @{addr:x}')
            out += binascii.unhexlify(r); addr += chunk; length -= chunk
        return out
