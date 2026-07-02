#!/usr/bin/env python3
"""Self-check for decomp/src/pml/battle/DamageCalc.cpp (USUM damage server).
Reproduces the ROM's base-damage core (sub_81f2c) and ApplyModifier (sub_84d40)
and checks them against the textbook Gen-6/7 formula. No ROM needed."""

M5, M50 = 0xCCCCCCCD, 0x51EB851F   # reciprocal magics read from Battle.cro

def base_rom(power, atk, dfn, level):        # exact ROM integer sequence
    r1 = power * atk
    r0 = ((M5 * (level << 1)) >> 32) >> 2    # 2*Level/5
    r0 = (r0 + 2) * r1                        # (2L/5+2)*(P*A)
    r0 = r0 // dfn                            # /Defense
    return ((M50 * r0) >> 32 >> 4) + 2        # /50 + 2

def base_ref(power, atk, dfn, level):
    return ((2*level//5 + 2) * power * atk // dfn)//50 + 2

def apply_mod(v, mod):                        # sub_84d40 Q12 round-half-up
    p = v*mod; return (p >> 12) + (1 if (p & 0xFFF) > 0x800 else 0)

def main():
    ok = True
    for p,a,d,l in [(80,100,100,50),(120,150,120,100),(40,55,40,5),
                    (95,200,150,75),(250,300,50,100),(60,120,80,37)]:
        r,e = base_rom(p,a,d,l), base_ref(p,a,d,l)
        ok &= r==e; print(f"base P{p} A{a} D{d} L{l}: rom={r} ref={e} {'OK' if r==e else 'FAIL'}")
    for v,mod,e in [(100,6144,150),(37,8192,74),(37,2048,18),(1262,4096,1262)]:
        r=apply_mod(v,mod); ok &= r==e
        print(f"applymod({v},{mod})={r} exp {e} {'OK' if r==e else 'FAIL'}")
    print("verify:", "PASS" if ok else "FAIL"); raise SystemExit(0 if ok else 1)

if __name__ == '__main__': main()
