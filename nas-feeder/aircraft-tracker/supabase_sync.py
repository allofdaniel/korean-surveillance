"""
Supabase 실시간 동기화 모듈 (대한감시 항적 이력)
NAS aircraft-tracker 수집기가 매 사이클 수집한 항적을 Supabase aircraft_positions 테이블에 batch INSERT.
웹앱(/api/aircraft-history)이 이 테이블을 조회해 프런트 trail seed 로 사용.

배포: 이 파일을 /volume1/docker/aircraft-tracker/ 에 두고 collector.py 에서 호출(아래 INTEGRATION.md).
환경변수 미설정 시 조용히 no-op → 기존 S3/SQLite 흐름에 영향 없음.
"""

import os
import json
import logging
import datetime
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
_ENABLED = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

if not _ENABLED:
    logger.info("[supabase_sync] SUPABASE_URL/KEY 미설정 -> 동기화 비활성(no-op)")


def _row(sector, ac):
    """airplanes.live 항공기 dict -> aircraft_positions row"""
    lat = ac.get("lat")
    lon = ac.get("lon")
    if lat is None or lon is None:
        return None
    alt = ac.get("alt_baro")
    on_ground = (alt == "ground")
    alt_ft = 0 if on_ground else (alt if isinstance(alt, (int, float)) else ac.get("alt_geom"))
    flight = ac.get("flight")
    return {
        "hex": (ac.get("hex") or "").lower().strip(),
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "sector": sector,
        "lat": lat,
        "lon": lon,
        "alt_ft": int(alt_ft) if isinstance(alt_ft, (int, float)) else None,
        "gs": ac.get("gs"),
        "track": ac.get("track"),
        "callsign": flight.strip() if isinstance(flight, str) else None,
        "on_ground": bool(on_ground),
    }


def insert_positions(sector, aircraft_list):
    """항적 batch 를 Supabase 에 INSERT. 반환: 삽입 시도 건수(실패 시 0)."""
    if not _ENABLED:
        return 0
    rows = [r for r in (_row(sector, ac) for ac in aircraft_list) if r and r["hex"]]
    if not rows:
        return 0
    url = f"{SUPABASE_URL}/rest/v1/aircraft_positions"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("apikey", SUPABASE_SERVICE_ROLE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_ROLE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201, 204):
                return len(rows)
            logger.warning(f"[supabase_sync] unexpected status {resp.status}")
            return 0
    except urllib.error.HTTPError as e:
        logger.warning(f"[supabase_sync] HTTP {e.code}: {e.read()[:200]}")
        return 0
    except Exception as e:
        logger.warning(f"[supabase_sync] failed: {e}")
        return 0
