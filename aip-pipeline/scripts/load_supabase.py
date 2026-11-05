"""Upload one AIRAC build to Supabase (tables from supabase/001_aip_tables.sql).

env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
usage: python scripts/load_supabase.py ../public/data/aip/2026-10-28 ../public/data/korea_airspace.json
"""
import os, sys, json, glob, urllib.request

URL = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

def post(table, rows, chunk=500):
    for i in range(0, len(rows), chunk):
        req = urllib.request.Request(f'{URL}/rest/v1/{table}', data=json.dumps(rows[i:i + chunk]).encode(), method='POST',
                                     headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json',
                                              'Prefer': 'resolution=merge-duplicates,return=minimal'})
        urllib.request.urlopen(req).read()

def main(outdir, app_path):
    airac = os.path.basename(outdir.rstrip('/'))
    app = json.load(open(app_path, encoding='utf-8'))
    airports = []
    obst, fixes, procs = [], [], []
    for f in sorted(glob.glob(os.path.join(outdir, 'RK??.json'))):
        d = json.load(open(f, encoding='utf-8'))
        ic = d['icao']; airports.append(ic)
        for o in d['obstacles']:
            obst.append({'airac': airac, 'id': o['id'], 'airport': ic, 'lat': o['lat'], 'lon': o['lon'], 'elev_m': o.get('elev_m'),
                         'hgt_m': o.get('hgt_m'), 'ground_m': o.get('ground_m'), 'elev_estimated': bool(o.get('elev_estimated')),
                         'position_estimated': bool(o.get('position_estimated')), 'obst_type': o.get('type'),
                         'category': o.get('category'), 'marking': o.get('marking'), 'remarks': o.get('remarks'),
                         'sources': o.get('sources', []), 'qa': o.get('qa')})
        for k, v in d['fixes'].items():
            fixes.append({'airac': airac, 'airport': ic, 'ident': k, 'lat': v['pos'][0], 'lon': v['pos'][1], 'sources': v['sources']})
        for kind in ('sids', 'stars', 'iaps'):
            for key, legs in app['procedures'][kind].get(ic, {}).items():
                procs.append({'airac': airac, 'airport': ic, 'kind': kind, 'ident': key, 'legs': legs})
    enr = os.path.join(outdir, 'ENR54_obstacles.json')
    if os.path.exists(enr):
        for o in json.load(open(enr, encoding='utf-8')):
            obst.append({'airac': airac, 'id': o['id'], 'airport': 'ENR', 'lat': o['lat'], 'lon': o['lon'], 'elev_m': o.get('elev_m'),
                         'hgt_m': o.get('hgt_m'), 'ground_m': o.get('ground_m'), 'elev_estimated': bool(o.get('elev_estimated')),
                         'position_estimated': False, 'obst_type': o.get('type'), 'category': o.get('category'),
                         'marking': o.get('marking'), 'remarks': o.get('remarks'), 'sources': o.get('sources', []), 'qa': o.get('qa')})
    post('aip_cycles', [{'airac': airac, 'airports': airports, 'source_note': 'eAIP 자동판독 (aip-pipeline)'}])
    post('aip_obstacles', obst); post('aip_fixes', fixes); post('aip_procedures', procs, chunk=200)
    print(f'{airac}: obstacles {len(obst)}, fixes {len(fixes)}, procedures {len(procs)}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
