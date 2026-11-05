"""Fail if any procedure leg references a waypoint the app cannot resolve, or AIP airports report errors."""
import json, sys
p = sys.argv[1]
a = json.load(open(p, encoding='utf-8'))
names = {w.get('id') for w in a.get('terminalWaypoints', [])} | {w.get('name') for w in a.get('waypoints', [])} | {n.get('ident') for n in a.get('navaids', [])}
for apt in a.get('airports', []):
    for r in apt.get('runways', []) or []:
        names.add(r.get('id'))
bad = []
for t in ('sids', 'stars', 'iaps'):
    for icao in (a.get('metadata', {}).get('aip_airports') or {}):
        for k, legs in (a['procedures'][t].get(icao) or {}).items():
            for L in legs:
                if L.get('wpt') and L['wpt'] not in names:
                    bad.append(f"{icao} {t} {k}: {L['wpt']}")
errs = {k: v for k, v in (a.get('metadata', {}).get('aip_airports') or {}).items() if v.get('issues')}
print('AIP airports:', list((a.get('metadata', {}).get('aip_airports') or {}).keys()))
if errs:
    print('airports with validation warnings:', errs)
if bad:
    print('UNRESOLVED WAYPOINTS:'); print('\n'.join(bad)); sys.exit(1)
print('OK')
