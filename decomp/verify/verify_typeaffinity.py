#!/usr/bin/env python3
"""Self-check for decomp/src/pml/battle/TypeAffinity.cpp — reproduces the ROM's
CalcAffinity + MulAffinity (with the corrected bit_index+1 map-back) and checks
that composed dual/triple-type effectiveness matches known Gen-7 multipliers.
Uses the committed type chart; no ROM needed."""
import json, os
tc = json.load(open(os.path.join(os.path.dirname(__file__),
                                 '..', 'data', 'type_chart.json')))
CODE, T = tc['chart'], {n: i for i, n in enumerate(tc['types'])}
AFFVAL = [0,1,2,4,8,16,32,64,128,256,512,1024,2048,4096]
NONE, IM, HALF, NEU, SUP = 0x12, 0, 6, 7, 8

def calc(a, d, inv=False):
    if a == NONE or d == NONE: return NEU
    return {0:(SUP if inv else IM), 2:(SUP if inv else HALF),
            4:NEU, 8:(HALF if inv else SUP)}[CODE[a][d]]

def mul(a, b):
    if a >= 14 or b >= 14: return IM
    prod = (AFFVAL[a]*AFFVAL[b]) >> 6
    if prod > 4096: prod = 4096
    elif prod == 0 and a != IM and b != IM: prod = 1
    for i in range(32):
        if prod & (1 << i):
            return min(i+1, 13)          # ROM: bit_index + 1
    return IM

def eff(atk, defs):
    r = calc(T[atk], T[defs[0]])
    for d in defs[1:]: r = mul(r, calc(T[atk], T[d]))
    return round(2**(r-1)/64, 4) if r else 0.0     # AffinityID -> multiplier

def main():
    cases = [('Fire',['Grass','Poison'],2.0),('Fire',['Grass','Bug'],4.0),
             ('Water',['Fire','Ground'],4.0),('Ground',['Flying'],0.0),
             ('Electric',['Ground','Flying'],0.0),('Ice',['Dragon','Flying'],4.0),
             ('Fighting',['Ghost'],0.0),('Normal',['Rock','Steel'],0.25),
             ('Fire',['Water','Rock'],0.25),('Grass',['Water','Ground'],4.0),
             ('Normal',['Normal'],1.0),('Dragon',['Fairy'],0.0)]
    ok = True
    for atk, defs, exp in cases:
        g = eff(atk, defs); good = abs(g-exp) < 1e-6; ok &= good
        print(f"{atk:9} vs {'/'.join(defs):13} = {g:<6} exp {exp:<6} {'OK' if good else 'FAIL'}")
    print("verify:", "PASS" if ok else "FAIL"); raise SystemExit(0 if ok else 1)

if __name__ == '__main__': main()
