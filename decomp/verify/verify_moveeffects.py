#!/usr/bin/env python3
"""Verify extracted move-effect data (status + stat changes) in
data/pokemon/usum_moves.json against known Gen-7 move behavior. Needs the
generated move data (run tools/usum_moves.py first)."""
import json, os
M = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..',
              'data', 'pokemon', 'usum_moves.json')))

STATUS = {'ember':'burn','flamethrower':'burn','will_o_wisp':'burn',
          'thunder_wave':'paralysis','stun_spore':'paralysis',
          'sleep_powder':'sleep','ice_beam':'freeze','toxic':'poison',
          'poison_powder':'poison','confuse_ray':'confusion'}
STAT = {'swords_dance':[('atk',2,'self')], 'growl':[('atk',-1,'target')],
        'leer':[('def',-1,'target')], 'agility':[('spe',2,'self')],
        'nasty_plot':[('spa',2,'self')], 'charm':[('atk',-2,'target')],
        'growth':[('atk',1,'self'),('spa',1,'self')],
        'calm_mind':[('spa',1,'self'),('spd',1,'self')]}

def main():
    ok = True
    for k, exp in STATUS.items():
        got = M.get(k, {}).get('status')
        ok &= got == exp; print(f"status {k:14} = {got} exp {exp} {'OK' if got==exp else 'FAIL'}")
    for k, exp in STAT.items():
        sc = M.get(k, {}).get('statChanges', [])
        got = [(c['stat'], c['stages'], c['target']) for c in sc]
        ok &= got == exp; print(f"stats  {k:14} = {got} {'OK' if got==exp else 'FAIL'}")
    print("verify:", "PASS" if ok else "FAIL"); raise SystemExit(0 if ok else 1)

if __name__ == '__main__': main()
