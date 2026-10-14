# aircraft-tracker → Supabase 연동 (항적 이력)

NAS `/volume1/docker/aircraft-tracker/` 수집기에 Supabase 실시간 적재를 추가한다.
기존 흐름(airplanes.live → SQLite → S3 시간당 백업)은 그대로 두고, **추가로** 매 사이클
항적을 Supabase `aircraft_positions` 테이블에 batch INSERT 한다. 웹앱 `/api/aircraft-history`
가 이 테이블을 읽어 프런트 trail seed 로 쓴다.

## 선행 조건 (Daniel 확인 필요)
1. 올바른 Supabase 프로젝트의 URL + service_role 키 (현재 저장분은 ref 불일치, OVERHAUL_PLAN §11.3).
2. 테이블 생성: 레포 `supabase/migrations/20261014000000_aircraft_positions.sql` 적용.

## 배포 절차
1. `supabase_sync.py` 를 `/volume1/docker/aircraft-tracker/` 에 복사.
2. `collector.py` 에 아래 패치 적용 (fetch_sector 의 `return filtered` 직전).
3. `docker-compose.yml` 에 환경변수 추가.
4. 재빌드+재시작: `cd /volume1/docker/aircraft-tracker && docker compose up -d --build`

## collector.py 패치
`self.db.log_stats(...)` 호출 다음, `return filtered` 앞에 추가:

```python
                # Supabase 실시간 동기화 (best-effort; 환경변수 미설정 시 no-op)
                try:
                    from supabase_sync import insert_positions
                    insert_positions(sector_id, filtered)
                except Exception as e:
                    logger.debug(f"Supabase sync skipped: {e}")
```

## docker-compose.yml 환경변수 추가
`environment:` 아래에:

```yaml
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
```
그리고 같은 폴더 `.env` 파일(절대 git 커밋 금지)에 실제 값:
```
SUPABASE_URL=https://<정확한-프로젝트>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## 참고 / 주의
- 수집 사이클 30초 → 항적 점 간격 ~30초. 더 촘촘히 하려면 collector.py `run_continuous(interval_sec=...)`
  와 airplanes.live rate limit(1/sec) 균형 조정.
- 보존: aircraft_positions 는 최근 24h 롤링 권장(마이그레이션 주석의 DELETE 를 pg_cron 으로).
- ⚠️ 보안: 현재 `s3_sync.py` 에 AWS 액세스 키가 하드코딩돼 있음(AKIA...). env(AWS_ACCESS_KEY_ID/
  AWS_SECRET_ACCESS_KEY)로 이전하고 노출된 키는 **폐기/재발급** 권장.
- 필드 매핑: hex, ts(UTC), sector, lat, lon, alt_ft(alt_baro; ground→0+on_ground),
  gs, track, callsign(flight), on_ground.
