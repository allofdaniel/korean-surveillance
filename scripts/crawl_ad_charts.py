"""
AD 차트 크롤러 (eAIP Korea) — georeferencing 토대
공항별 AD-2 페이지에서 (1) 차트 PDF 목록 + 유형, (2) GCP 좌표(ARP, 활주로 threshold)
를 추출해 ad_charts_index.json 으로 저장.

출력 구조:
{
  "airac": "2026-09-30",
  "airports": {
    "RKPU": {
      "arp": {"lat":..., "lon":...},
      "runways": [{"ident":"18","lat":...,"lon":...}, {"ident":"36",...}],
      "charts": [{"name":"(2-12) INSTR APCH CHART","type":"IAC","pdf":"https://..."}]
    }, ...
  }
}
"""
import re, json, sys
from pathlib import Path
import requests

HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
HISTORY = "https://aim.koca.go.kr/eaipPub/Package/history-en-GB.html"

CHART_TYPE = [
    ("INSTR APCH", "IAC"), ("VISUAL APCH", "VAC"), ("SID", "SID"), ("STAR", "STAR"),
    ("OBSTACLE CHART TYPE A", "AOC-A"), ("OBSTACLE CHART TYPE B", "AOC-B"),
    ("AD CHART", "ADC"), ("GROUND MOVEMENT", "GMC"), ("PARKING", "PDC"),
    ("BIRD", "BIRD"), ("AERODROME TERRAIN", "ATOC"),
]

def dms(s):
    m = re.match(r"^(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([NS])$", s)
    if m:
        v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
        return round(-v if m[4] == "S" else v, 6)
    m = re.match(r"^(\d{3})(\d{2})(\d{2}(?:\.\d+)?)([EW])$", s)
    if m:
        v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
        return round(-v if m[4] == "W" else v, 6)
    return None

def classify(name):
    up = name.upper()
    for key, t in CHART_TYPE:
        if key in up:
            return t
    return "OTHER"

def latest_airac():
    try:
        h = requests.get(HISTORY, headers=HDR, timeout=30).text
        pkgs = sorted(set(re.findall(r"(\d{4}-\d{2}-\d{2})-AIRAC", h)))
        return pkgs[-1] if pkgs else "2026-09-30"
    except Exception:
        return "2026-09-30"

def crawl_airport(base, icao):
    url = f"{base}/KR-AD-2.{icao}-en-GB.html"
    try:
        r = requests.get(url, headers=HDR, timeout=40)
        if r.status_code != 200:
            return None
    except Exception as e:
        print(f"  {icao}: fetch error {e}")
        return None
    html = r.text

    # charts: PDF links under this airport's AD folder
    charts = []
    seen = set()
    for href in re.findall(r'href=["\']([^"\']+\.pdf)["\']', html, re.IGNORECASE):
        if f"/AD/{icao}/" not in href:
            continue
        name = re.sub(r"_\d+(?=\.pdf$)", "", href.split("/")[-1]).replace(".pdf", "")
        if name in seen:
            continue
        seen.add(name)
        charts.append({"name": name, "type": classify(name), "pdf": href})

    # GCP: ARP (AD 2.2) + runway thresholds (AD 2.12). 페이지 전체에서 DMS 쌍 추출.
    pairs = re.findall(r"(\d{6}(?:\.\d+)?[NS])\s*(\d{7}(?:\.\d+)?[EW])", html)
    coords = []
    for la, lo in pairs:
        dlat, dlon = dms(la), dms(lo)
        if dlat is not None and dlon is not None:
            coords.append({"lat": dlat, "lon": dlon})
    # ARP: 보통 첫 좌표(AD 2.2). runway threshold 는 세분 파싱 TODO(라벨 매칭).
    arp = coords[0] if coords else None

    # runway idents present on page (e.g., RWY 18/36)
    rwy_idents = sorted(set(re.findall(r"\bRWY\s*(\d{2})\b", html)))

    return {
        "arp": arp,
        "runway_idents": rwy_idents,
        "gcp_candidates": coords[:40],  # georeferencing 후보(라벨 매칭은 다음 단계)
        "charts": charts,
    }

def main():
    airac = latest_airac()
    base = f"https://aim.koca.go.kr/eaipPub/Package/{airac}-AIRAC/html/eAIP"
    print(f"AIRAC={airac}\nbase={base}")

    # 공항 목록: 인자로 받거나 korea_airports.json 사용
    icaos = sys.argv[1:]
    if not icaos:
        apf = Path(__file__).with_name("korea_airports.json")
        if apf.exists():
            data = json.loads(apf.read_text(encoding="utf-8"))
            ap = data.get("airports", data)
            icaos = list(ap.keys()) if isinstance(ap, dict) else [a.get("icao") for a in ap]
        else:
            icaos = ["RKPU", "RKSI", "RKSS", "RKPC", "RKPK", "RKTU", "RKNY", "RKJB", "RKTN", "RKJJ"]

    out = {"airac": airac, "base": base, "airports": {}}
    for icao in icaos:
        if not icao:
            continue
        info = crawl_airport(base, icao)
        if info and info["charts"]:
            out["airports"][icao] = info
            print(f"  {icao}: {len(info['charts'])} charts, {len(info['gcp_candidates'])} gcp candidates, rwy {info['runway_idents']}")

    outdir = Path(__file__).resolve().parent.parent / "public" / "data"
    outdir.mkdir(parents=True, exist_ok=True)
    outfile = outdir / "ad_charts_index.json"
    outfile.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved {len(out['airports'])} airports -> {outfile}")

if __name__ == "__main__":
    main()
