#!/usr/bin/env python3
"""
?섏쭛??NOTAM ?곗씠?곕? Supabase DB???낅줈??
蹂묓빀???곗씠???뚯씪 (43,652嫄???Supabase notams ?뚯씠釉붿뿉 upsert
"""

import requests
import json
import os
import time
from datetime import datetime
from typing import List, Dict
from _secrets import get_supabase_config
# ============================================================
# Configuration
# ============================================================

# Supabase ?ㅼ젙 (yessirpanda ?꾨줈?앺듃)
SUPABASE_URL, SUPABASE_SERVICE_KEY = get_supabase_config()

# ?곗씠???뚯씪 (理쒖쥌 蹂묓빀 ?뚯씪)
DATA_FILE = "./data/historical_notams_20260210_140036.json"

# 諛곗튂 ?ш린 (538K ?덉퐫?쒕? ?꾪빐 利앷?)
BATCH_SIZE = 500

# ============================================================
# Supabase Functions
# ============================================================

def test_connection() -> bool:
    """Supabase ?곌껐 ?뚯뒪??""
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }

    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/notams?select=notam_number&limit=1",
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            print(f"[OK] Supabase ?곌껐 ?깃났")
            return True
        else:
            print(f"[FAIL] Supabase ?곌껐 ?ㅽ뙣: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"[FAIL] Supabase ?곌껐 ?ㅻ쪟: {e}")
        return False


def get_current_count() -> int:
    """?꾩옱 DB ?덉퐫????議고쉶"""
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Prefer': 'count=exact'
    }

    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/notams?select=notam_number",
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            content_range = response.headers.get('Content-Range', '')
            if '/' in content_range:
                return int(content_range.split('/')[1])
        return 0
    except Exception as exc:
        print(f"[FAIL] Supabase current count query failed: {exc}")
        return 0


def upsert_batch(records: List[Dict]) -> int:
    """諛곗튂 upsert"""
    if not records:
        return 0

    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
    }

    # ?덉퐫???뺣━ (None 媛??쒓굅, ?꾩닔 ?꾨뱶留?
    cleaned = []
    for rec in records:
        clean_rec = {
            'notam_number': rec.get('notam_number', ''),
            'location': rec.get('location', ''),
            'full_text': rec.get('full_text', ''),
            'e_text': rec.get('e_text', ''),
            'qcode': rec.get('qcode', ''),
            'qcode_mean': rec.get('qcode_mean', ''),
            'effective_start': rec.get('effective_start', ''),
            'effective_end': rec.get('effective_end', ''),
            'series': rec.get('series', ''),
            'fir': rec.get('fir', ''),
            'issue_time': rec.get('issue_time', ''),
            'crawled_at': datetime.utcnow().isoformat() + 'Z'
        }

        # 醫뚰몴 ?뺣낫 (?덉쑝硫?異붽?)
        if rec.get('q_lat') is not None:
            clean_rec['q_lat'] = rec['q_lat']
        if rec.get('q_lon') is not None:
            clean_rec['q_lon'] = rec['q_lon']
        if rec.get('q_radius_nm') is not None:
            clean_rec['q_radius_nm'] = rec['q_radius_nm']
        if rec.get('q_lower_alt') is not None:
            clean_rec['q_lower_alt'] = rec['q_lower_alt']
        if rec.get('q_upper_alt') is not None:
            clean_rec['q_upper_alt'] = rec['q_upper_alt']

        cleaned.append(clean_rec)

    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/notams",
            headers=headers,
            json=cleaned,
            timeout=60
        )

        if response.status_code in [200, 201]:
            return len(cleaned)
        else:
            print(f"    Upsert ?ㅻ쪟: {response.status_code} - {response.text[:200]}")
            return 0
    except Exception as e:
        print(f"    Upsert ?덉쇅: {e}")
        return 0


def main():
    print("=" * 70)
    print("NOTAM migration to Supabase")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # 1. Check Supabase connectivity
    print("\n[1] Supabase connectivity check")
    if not test_connection():
        print("\n[ERROR] Supabase ?곌껐 ?ㅽ뙣. ?꾨줈?앺듃 ?곹깭瑜??뺤씤?섏꽭??")
        return

    # 2. ?꾩옱 DB ?곹깭
    print("\n[2] ?꾩옱 DB ?곹깭")
    before_count = get_current_count()
    print(f"  Existing records: {before_count:,}")

    # 3. Source file load
    print("\n[3] Source file load")
    if not os.path.exists(DATA_FILE):
        print(f"  [ERROR] ?뚯씪??李얠쓣 ???놁뒿?덈떎: {DATA_FILE}")
        return

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        notams = json.load(f)

    print(f"  Source records: {len(notams):,}")

    # 4. Upsert to Supabase
    print("\n[4] Upsert to Supabase")
    total_uploaded = 0
    total_batches = (len(notams) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(notams), BATCH_SIZE):
        batch = notams[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1

        uploaded = upsert_batch(batch)
        total_uploaded += uploaded

        # 吏꾪뻾瑜??쒖떆
        progress = (batch_num / total_batches) * 100
        print(f"  Upsert {batch_num}/{total_batches}: {uploaded} records ({progress:.1f}%)")

        time.sleep(0.2)  # Rate limiting

    # 5. 寃곌낵 ?뺤씤
    print("\n[5] 寃곌낵 ?뺤씤")
    after_count = get_current_count()
    print(f"  Count before: {before_count:,}")
    print(f"  Count after: {after_count:,}")
    print(f"  Change: {after_count - before_count:,}")
    print(f"  Upserted total: {total_uploaded:,}")

    print("\n" + "=" * 70)
    print("Done.")
    print("=" * 70)


if __name__ == "__main__":
    main()

