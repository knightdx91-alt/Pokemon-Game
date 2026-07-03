#!/usr/bin/env python3
"""Send one command to the rsp daemon and print the newest matching reply.
Usage: rspctl.py '<json>'  — appends to /tmp/rsp_in, waits, prints new /tmp/rsp_out lines.
"""
import sys, time, json, os

IN = '/tmp/rsp_in'
OUT = '/tmp/rsp_out'

def tail_count():
    try:
        return sum(1 for _ in open(OUT))
    except FileNotFoundError:
        return 0

def main():
    payload = sys.argv[1]
    wait = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
    before = tail_count()
    with open(IN, 'a') as f:
        f.write(payload.strip() + '\n')
    t0 = time.time()
    while time.time() - t0 < wait:
        lines = open(OUT).read().splitlines() if os.path.exists(OUT) else []
        if len(lines) > before:
            for l in lines[before:]:
                print(l)
            return
        time.sleep(0.05)
    print(json.dumps({"timeout": True, "waited": wait}))

if __name__ == '__main__':
    main()
