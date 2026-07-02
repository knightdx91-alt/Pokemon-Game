#!/usr/bin/env python3
"""Verify extracted move-effect data (status, stat changes, flags, weather) in
data/pokemon/usum_moves.json against known Gen-7 move behavior. Needs the
generated move data (run tools/usum_moves.py first)."""
import json, os, sys
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
FLAGS = {'fire_punch':{'contact','punch'}, 'tackle':{'contact'},
         'hyper_voice':{'sound','ignoreSub'}, 'recover':{'snatch','heal'},
         'fly':{'charge','gravity'}, 'hyper_beam':{'recharge'}}
WEATHER = {'rain_dance':'rain','sunny_day':'sun','sandstorm':'sandstorm','hail':'hail'}

def main():
    ok = True
    for k, exp in STATUS.items():
        got = M.get(k, {}).get('status'); ok &= got == exp
        print(f"status {k:14} = {got} exp {exp} {'OK' if got==exp else 'FAIL'}")
    for k, exp in STAT.items():
        got = [(c['stat'], c['stages'], c['target']) for c in M.get(k, {}).get('statChanges', [])]
        ok &= got == exp; print(f"stats  {k:14} {'OK' if got==exp else 'FAIL '+str(got)}")
    for k, need in FLAGS.items():
        have = set(M.get(k, {}).get('flags', [])); ok &= need <= have
        print(f"flags  {k:14} {'OK' if need<=have else 'FAIL '+str(have)}")
    for k, w in WEATHER.items():
        g = M.get(k, {}).get('weather'); ok &= g == w
        print(f"weather{k:14} = {g} {'OK' if g==w else 'FAIL'}")
    print("verify:", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
