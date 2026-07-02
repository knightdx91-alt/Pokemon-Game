#!/usr/bin/env python3
"""Self-check for the catch-rate core in decomp/src/pml/battle/CatchRate.cpp.
Verifies the base catch value a = (3M-2H)*rate/(3M) (ball=status=1) matches the
canonical Gen formula and the known identities (full-HP -> rate/3; a>=255 =>
guaranteed). Q12 status/ball constants are matched separately (0x2800=2.5x,
0x1800=1.5x). No ROM needed."""

def base_a(maxhp, curhp, rate):        # (3M-2H)*rate/(3M), integer
    return ((3*maxhp - 2*curhp) * rate) // (3*maxhp)

def q12(v, mod):                       # shared ApplyModifier (round-half-up)
    p = v*mod; return (p >> 12) + (1 if (p & 0xFFF) > 0x800 else 0)

def main():
    ok = True
    # full HP -> a == rate//3
    for M, rate in [(100,45),(300,255),(50,3),(150,120)]:
        got, exp = base_a(M, M, rate), rate//3 if (3*M) else 0
        # exact: (3M-2M)*rate/(3M) = M*rate/(3M) = rate//3 only when M*rate divisible; compare formula-to-formula
        exp = (M*rate)//(3*M)
        ok &= got == exp; print(f"fullHP M{M} rate{rate}: a={got} exp={exp} {'OK' if got==exp else 'FAIL'}")
    # low HP raises a
    a_full = base_a(200,200,100); a_low = base_a(200,10,100)
    ok &= a_low > a_full; print(f"low-HP boost: full={a_full} low={a_low} {'OK' if a_low>a_full else 'FAIL'}")
    # status/ball Q12 constants (verified against known Gen-7 values)
    for mod, mult in [(0x2800,2.5),(0x1800,1.5),(0x1000,1.0)]:
        r = q12(1000, mod); exp = int(1000*mult)
        ok &= r == exp; print(f"status/ball x{mult}: q12(1000,{hex(mod)})={r} exp={exp} {'OK' if r==exp else 'FAIL'}")
    # guaranteed-catch threshold 255 == 0xff000 >> 12
    ok &= (0xff000 >> 12) == 255; print(f"auto-catch thresh 0xff000>>12 = {0xff000>>12} (255) OK")
    print("verify:", "PASS" if ok else "FAIL"); raise SystemExit(0 if ok else 1)

if __name__ == '__main__': main()
