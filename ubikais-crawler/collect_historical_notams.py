#!/usr/bin/env python3
"""Collect historical NOTAMs from UBIKAIS and upload to Supabase or save locally."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
import urllib3


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _parse_years(raw_years: str) -> List[str]:
    years: List[str] = []
    for token in raw_years.split(","):
        year = token.strip()
        if not year:
            continue
        if len(year) == 4 and year.isdigit():
            year = year[-2:]
        elif len(year) == 2 and year.isdigit():
            pass
        else:
            raise ValueError(f"Invalid year value: {year}")
        if year not in years:
            years.append(year)
    if not years:
        raise ValueError("No valid years were provided")
    return years


def _parse_int(name: str, default: int) -> int:
    value = os.getenv(name, str(default)).strip()
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError as e:
        raise RuntimeError(f"Invalid integer value for {name}: {value}") from e
    if parsed <= 0:
        raise RuntimeError(f"{name} must be greater than 0")
    return parsed


VERIFY_SSL = os.getenv("UBIKAIS_VERIFY_SSL", "false").lower() in {"1", "true", "yes", "on"}
REQUEST_TIMEOUT = int(os.getenv("UBIKAIS_HTTP_TIMEOUT_SECONDS", "30"))
if not VERIFY_SSL:
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

UBIKAIS_BASE_URL = os.getenv("UBIKAIS_BASE_URL", "https://ubikais.fois.go.kr:8030")
UBIKAIS_USERNAME = _require_env("UBIKAIS_USERNAME")
UBIKAIS_PASSWORD = _require_env("UBIKAIS_PASSWORD")

SUPABASE_URL = _require_env("SUPABASE_URL")
SUPABASE_SERVICE_KEY = _require_env("SUPABASE_SERVICE_ROLE_KEY")

YEARS = _parse_years(os.getenv("UBIKAIS_YEARS", "23,24,25,26"))
SERIES_LIST = [series.strip().upper() for series in os.getenv("UBIKAIS_SERIES", "A,C,D,E,G,Z").split(",") if series.strip()]
if not SERIES_LIST:
    raise RuntimeError("UBIKAIS_SERIES must include at least one series")

BATCH_SIZE = _parse_int("UBIKAIS_BATCH_SIZE", 50)
OUTPUT_DIR = Path("./data")



def login_ubikais() -> requests.Session:
    """Login to UBIKAIS and return an authenticated requests session."""
    session = requests.Session()
    session.verify = VERIFY_SSL

    print("UBIKAIS login start")
    session.get(
        f"{UBIKAIS_BASE_URL}/common/login",
        params={"systemId": "sysUbikais"},
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        timeout=REQUEST_TIMEOUT,
    )

    response = session.post(
        f"{UBIKAIS_BASE_URL}/common/loginProc",
        data={
            "userId": UBIKAIS_USERNAME,
            "userPw": UBIKAIS_PASSWORD,
            "systemId": "sysUbikais",
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": f"{UBIKAIS_BASE_URL}/common/login?systemId=sysUbikais",
        },
        allow_redirects=True,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    main_response = session.get(
        f"{UBIKAIS_BASE_URL}/sysUbikais/biz/main.ubikais",
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        timeout=REQUEST_TIMEOUT,
    )
    main_response.raise_for_status()

    if main_response.url.endswith("/common/login"):
        raise RuntimeError("UBIKAIS login failed: redirected to login page")

    print("[OK] UBIKAIS login succeeded")
    return session


def fetch_sequence_list(session: requests.Session, year: str, series: str) -> List[Dict[str, Any]]:
    url = f"{UBIKAIS_BASE_URL}/sysUbikais/biz/nps/selectNotamRecSeq.fois"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{UBIKAIS_BASE_URL}/sysUbikais/biz/nps/notamRecSeq",
    }

    all_records: List[Dict[str, Any]] = []
    offset = 0
    limit = 500

    while True:
        params = {
            "downloadYn": "1",
            "printYn": "",
            "srchFir": "RKRR",
            "srchSeries": series,
            "srchSeq": "",
            "srchYear": year,
            "cmd": "get-records",
            "limit": str(limit),
            "offset": str(offset),
        }

        try:
            response = session.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT)
            if response.status_code != 200:
                print(f"    Error: UBIKAIS returned HTTP {response.status_code} for {year}-{series}")
                break

            data = response.json()
            records = data.get("records", []) if isinstance(data, dict) else []
            raw_total = data.get("total", 0) if isinstance(data, dict) else 0
            total = int(raw_total) if isinstance(raw_total, str) and raw_total.isdigit() else int(raw_total) if isinstance(raw_total, int) else 0

            all_records.extend(records)

            if not records or len(all_records) >= total:
                break

            offset += limit
            time.sleep(0.3)
        except requests.RequestException as e:
            print(f"    Request error: {e}")
            break
        except (ValueError, TypeError) as e:
            print(f"    Parse error: {e}")
            break

    return all_records


def parse_q_line(full_text: str) -> Dict[str, Any]:
    if not full_text:
        return {}

    # Example: Q)RKRR/QMXLC/IV/BO/A/000/999/3728N12626E005
    pattern = r"Q\)\s*(\w+)/(\w+)/\w+/\w+/\w+/(\d{3})/(\d{3})/(\d{4})([NS])(\d{5})([EW])(\d{3})"
    match = re.search(pattern, full_text)
    if not match:
        return {}

    try:
        fir = match.group(1)
        qcode = match.group(2)
        lower_alt = int(match.group(3)) * 100
        upper_alt = int(match.group(4)) * 100

        lat_str = match.group(5)
        lat_deg = int(lat_str[:2])
        lat_min = int(lat_str[2:4])
        lat = lat_deg + lat_min / 60
        if match.group(6) == "S":
            lat = -lat

        lon_str = match.group(7)
        lon_deg = int(lon_str[:3])
        lon_min = int(lon_str[3:5])
        lon = lon_deg + lon_min / 60
        if match.group(8) == "W":
            lon = -lon

        radius_nm = int(match.group(9))
    except (ValueError, IndexError) as e:
        print(f"    Failed to parse Q-line: {e}")
        return {}

    return {
        "fir": fir,
        "qcode": qcode,
        "q_lower_alt": lower_alt,
        "q_upper_alt": upper_alt,
        "q_lat": lat,
        "q_lon": lon,
        "q_radius_nm": radius_nm,
    }


def transform_record(rec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    series = rec.get("ntSeries", "").strip()
    seq = rec.get("ntSndSeq", "").strip()
    year = rec.get("ntYear", "").strip()

    if not (series and seq and year):
        return None

    full_text = rec.get("amsOriginal", "")
    parsed = parse_q_line(full_text)

    effective_end = rec.get("ntEndDate", "") or ""
    if rec.get("ntPerm") == "PERM":
        effective_end = "PERM"
    elif rec.get("ntPerm") == "EST" and effective_end:
        effective_end = f"{effective_end}EST"

    return {
        "notam_number": f"{series}{seq}/{year}",
        "location": rec.get("ntAd", ""),
        "full_text": full_text,
        "e_text": rec.get("ntText", ""),
        "qcode": rec.get("ntCode", "") or parsed.get("qcode", ""),
        "qcode_mean": rec.get("ntCodeDesc", ""),
        "effective_start": rec.get("ntStartDate", ""),
        "effective_end": effective_end,
        "series": series,
        "fir": rec.get("ntFir", "") or parsed.get("fir", ""),
        "issue_time": rec.get("ntSendDate", ""),
        "ais_type": rec.get("ntStatus", ""),
        "seq": seq,
        "q_lat": parsed.get("q_lat"),
        "q_lon": parsed.get("q_lon"),
        "q_radius_nm": parsed.get("q_radius_nm"),
        "q_lower_alt": parsed.get("q_lower_alt") or (_to_int(rec.get("ntLower")) * 100 if _to_int(rec.get("ntLower")) is not None else None),
        "q_upper_alt": parsed.get("q_upper_alt") or (_to_int(rec.get("ntUpper")) * 100 if _to_int(rec.get("ntUpper")) is not None else None),
        "source_type": "historical",
        "source_group": series,
        "crawled_at": datetime.utcnow().isoformat() + "Z",
    }


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def test_supabase_connection() -> bool:
    try:
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        }
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/notams?select=notam_number&limit=1",
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            verify=VERIFY_SSL,
        )
        if response.status_code == 200:
            print("[OK] Supabase connection ok")
            return True

        print(f"[FAIL] Supabase check failed: {response.status_code}")
        print(response.text[:200])
    except requests.RequestException as e:
        print(f"[FAIL] Supabase check failed: {e}")
    return False


def upsert_batch(records: List[Dict[str, Any]]) -> int:
    if not records:
        return 0

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/notams",
            headers=headers,
            json=records,
            timeout=REQUEST_TIMEOUT,
            verify=VERIFY_SSL,
        )

        if response.status_code in [200, 201]:
            return len(records)

        print(f"    Upsert failed: {response.status_code} - {response.text[:200]}")
    except requests.RequestException as e:
        print(f"    Upsert failed: {e}")

    return 0


def collect_all_historical_notams() -> None:
    print("=" * 70)
    print("UBIKAIS historical NOTAM collection")
    print(f"Target years: {', '.join('20' + y for y in YEARS)}")
    print(f"Target series: {', '.join(SERIES_LIST)}")
    print(f"Supabase: {SUPABASE_URL}")
    print("=" * 70)

    if not test_supabase_connection():
        print("\n[ERROR] Supabase connection failed. Check credentials and endpoint.")
        return

    session = login_ubikais()

    total_collected = 0
    total_upserted = 0

    for year in YEARS:
        print(f"\n{'=' * 50}")
        print(f"Year 20{year}")
        print('=' * 50)

        year_collected = 0
        year_upserted = 0

        for series in SERIES_LIST:
            print(f"  [{series}] Series ...", end=" ")

            records = fetch_sequence_list(session, year, series)
            print(f"{len(records)} records")

            if not records:
                continue

            transformed: List[Dict[str, Any]] = []
            for rec in records:
                transformed_record = transform_record(rec)
                if transformed_record:
                    transformed.append(transformed_record)

            print(f"      {len(transformed)} transformed records")

            upserted = 0
            for i in range(0, len(transformed), BATCH_SIZE):
                batch = transformed[i : i + BATCH_SIZE]
                upserted += upsert_batch(batch)
                time.sleep(0.2)

            print(f"      {upserted} DB records upserted")

            year_collected += len(records)
            year_upserted += upserted
            time.sleep(0.5)

        print(f"\n  [20{year}] Summary: {year_collected} collected, {year_upserted} upserted")
        total_collected += year_collected
        total_upserted += year_upserted

    print("\n" + "=" * 70)
    print("Collection complete")
    print("=" * 70)
    print(f"Total collected: {total_collected}")
    print(f"Total upserted:  {total_upserted}")
    print("=" * 70)


def collect_and_save_locally() -> None:
    print("=" * 70)
    print("UBIKAIS historical NOTAM local collection")
    print("=" * 70)

    session = login_ubikais()
    all_notams: List[Dict[str, Any]] = []

    for year in YEARS:
        print(f"\n20{year}")
        for series in SERIES_LIST:
            print(f"  [{series}] Series...", end=" ")
            records = fetch_sequence_list(session, year, series)
            print(f"{len(records)} records")
            for rec in records:
                transformed_record = transform_record(rec)
                if transformed_record:
                    all_notams.append(transformed_record)
            time.sleep(0.5)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / f"historical_notams_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    with output_file.open("w", encoding="utf-8") as f:
        json.dump(all_notams, f, ensure_ascii=False, indent=2)

    print(f"Saved: {output_file}")
    print(f"Saved records: {len(all_notams)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect UBIKAIS historical NOTAMs")
    parser.add_argument("--local", action="store_true", help="Save locally instead of upserting to Supabase")
    args = parser.parse_args()

    if args.local:
        collect_and_save_locally()
    else:
        collect_all_historical_notams()


if __name__ == "__main__":
    main()
