#!/usr/bin/env python3
"""RSP daemon: owns the single gdbstub connection.
Reads JSON commands (one per line) from IN, appends JSON results to OUT.
ops: cont, interrupt, wait{timeout}, bp{addr}, unbp{addr}, regs, mem{addr,len,file}, quit
"""
import sys, json, time, os
SP = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SP)
from rsp import RSP

IN = '/tmp/rsp_in'
OUT = '/tmp/rsp_out'

r = RSP(timeout=600)
out = open(OUT, 'a', buffering=1)
def emit(o): out.write(json.dumps(o) + '\n')
emit({"ev": "connected", "halt": r.cmd('?', timeout=10).decode(errors='replace')})

open(IN, 'a').close()
pos = 0
while True:
    with open(IN) as f:
        f.seek(pos); lines = f.readlines(); pos = f.tell()
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        try:
            c = json.loads(ln)
        except Exception:
            continue
        op = c.get('op')
        try:
            if op == 'cont':
                r.cont_async(); emit({"ok": "cont"})
            elif op == 'interrupt':
                r.interrupt(); h = r.wait_halt(timeout=15)
                emit({"ok": "interrupt", "halt": h.decode(errors='replace')})
            elif op == 'wait':
                h = r.wait_halt(timeout=c.get('timeout', 120))
                emit({"ok": "halt", "halt": h.decode(errors='replace')})
            elif op == 'bp':
                emit({"ok": "bp", "addr": hex(c['addr']), "r": r.set_bp(c['addr']).decode(errors='replace')})
            elif op == 'unbp':
                emit({"ok": "unbp", "addr": hex(c['addr']), "r": r.del_bp(c['addr']).decode(errors='replace')})
            elif op == 'wp':
                emit({"ok": "wp", "addr": hex(c['addr']), "len": c['len'], "kind": c.get('kind', 4),
                      "r": r.set_wp(c['addr'], c['len'], c.get('kind', 4)).decode(errors='replace')})
            elif op == 'unwp':
                emit({"ok": "unwp", "addr": hex(c['addr']), "r": r.del_wp(c['addr'], c['len'], c.get('kind', 4)).decode(errors='replace')})
            elif op == 'regs':
                emit({"ok": "regs", "regs": [hex(x) for x in r.regs()]})
            elif op == 'mem':
                d = r.mem(c['addr'], c['len'])
                open(c.get('file', '/tmp/rsp_mem.bin'), 'wb').write(d)
                emit({"ok": "mem", "addr": hex(c['addr']), "len": len(d), "file": c.get('file', '/tmp/rsp_mem.bin')})
            elif op == 'quit':
                emit({"ok": "quit"}); sys.exit(0)
            else:
                emit({"err": "unknown op", "op": op})
        except Exception as e:
            emit({"err": str(e), "op": op})
    time.sleep(0.05)
