#!/usr/bin/env python3
"""Download every AD-2 chart PDF of the currently effective Korean eAIP issue.

Usage: python3 fetch_aip_charts.py <cache_dir> [ICAO ...]
Writes <cache_dir>/manifest.json: {airac, airports: {ICAO: [{title, url, pdf}]}}
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request

BASE = 'https://aim.koca.go.kr/eaipPub/Package/'
# Huge (up to ~90 MB) and never overlaid — listed as links to the original PDF instead.
LINK_ONLY = re.compile(r'OBSTACLE CHART|PRECISION \w+ TERRAIN', re.I)


def get(url, binary=False, tries=5):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'koreasurveillance-chart-sync/1.0'})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            return data if binary else data.decode('utf-8', 'ignore')
        except Exception as e:  # flaky upstream / proxy: back off and retry
            last = e
            time.sleep(2 + 3 * i)
    raise RuntimeError(f'GET failed {url}: {last}')


def remote_size(url):
    try:
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'koreasurveillance-chart-sync/1.0'})
        with urllib.request.urlopen(req, timeout=60) as r:
            return int(r.headers.get('Content-Length') or -1)
    except Exception:
        return -1


def is_deleted(page, pos):
    """The eAIP keeps superseded charts in the page, wrapped in class="... AmdtDeleted..."."""
    classes = re.findall(r'class="([^"]*)"', page[max(0, pos - 700):pos])
    return any('Deleted' in c for c in classes[-3:])


def effective_issue():
    s = get(BASE + 'history-en-GB.html')
    cur = s.split('Next Issues')[0]
    m = re.search(r'href="([0-9]{4}-[0-9]{2}-[0-9]{2}(?:-AIRAC)?)/html/index-en-GB\.html"', cur)
    if not m:
        raise SystemExit('could not find the currently effective issue')
    return m.group(1)


def main():
    cache = sys.argv[1]
    only = set(sys.argv[2:])
    os.makedirs(cache, exist_ok=True)
    issue = effective_issue()
    menu = get(f'{BASE}{issue}/html/eAIP/KR-menu-en-GB.html')
    icaos = sorted(set(re.findall(r'KR-AD-2\.([A-Z]{4})-en-GB\.html', menu)))
    if only:
        icaos = [i for i in icaos if i in only]
    out = {'airac': issue, 'airports': {}}
    for icao in icaos:
        page_url = f'{BASE}{issue}/html/eAIP/KR-AD-2.{icao}-en-GB.html'
        page = get(page_url)
        items, seen = [], set()
        for m in re.finditer(r'<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)</a>', page, re.S | re.I):
            url = urllib.parse.urljoin(page_url, html.unescape(m.group(1))).replace('http://', 'https://')
            if f'/AD/{icao}/' not in url or url in seen or is_deleted(page, m.start()):
                continue
            seen.add(url)
            title = html.unescape(re.sub(r'<[^>]+>', '', m.group(2))).strip()
            fn = urllib.parse.unquote(url.rsplit('/', 1)[1])
            sec = (re.match(r'\((2-[\d-]+)\)', fn) or [None, ''])[1]
            dst = os.path.join(cache, icao, fn)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if LINK_ONLY.search(title) or LINK_ONLY.search(fn):
                items.append({'title': title, 'section': sec, 'url': url, 'pdf': None})
                continue
            qurl = urllib.parse.quote(url, safe=':/()%')
            tag = dst + '.src'
            src = open(tag).read() if os.path.exists(tag) else None
            if os.path.exists(dst) and src != url and remote_size(qurl) != os.path.getsize(dst):
                os.remove(dst)          # cached copy came from another AIRAC package
            if not os.path.exists(dst) or os.path.getsize(dst) < 1000:
                try:
                    data = get(qurl, binary=True)
                except RuntimeError as e:  # keep going; the chart is still listed as a link
                    print('  !', e, flush=True)
                    items.append({'title': title, 'section': sec, 'url': url, 'pdf': None})
                    continue
                with open(dst, 'wb') as f:
                    f.write(data)
            with open(tag, 'w') as f:
                f.write(url)
            items.append({'title': title, 'section': sec, 'url': url, 'pdf': os.path.relpath(dst, cache)})
        out['airports'][icao] = items
        print(f'{icao}: {len(items)} pdfs', flush=True)
    with open(os.path.join(cache, 'manifest.json'), 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('issue', issue)


if __name__ == '__main__':
    main()
