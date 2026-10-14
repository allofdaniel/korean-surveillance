-- 대한감시 항적 이력 테이블
-- NAS aircraft-tracker 수집기(airplanes.live→SQLite, 30초 사이클)가 이 테이블에도 batch 적재.
-- 프런트 trail seed 는 /api/aircraft-history 가 이 테이블을 조회해서 공급.
-- 참고: docs/OVERHAUL_PLAN_v1.md §4, §11.4

create table if not exists public.aircraft_positions (
  id          bigint generated always as identity primary key,
  hex         text        not null,
  ts          timestamptz not null default now(),
  sector      text,
  lat         double precision not null,
  lon         double precision not null,
  alt_ft      integer,
  gs          double precision,
  track       double precision,
  callsign    text,
  on_ground   boolean     not null default false
);

-- hex + 시간 범위 조회 최적화
create index if not exists idx_aircraft_positions_hex_ts
  on public.aircraft_positions (hex, ts desc);

-- 시간 범위 스캔(대량 적재) 최적화 — BRIN 이 저비용
create index if not exists idx_aircraft_positions_ts_brin
  on public.aircraft_positions using brin (ts);

-- RLS: 서버(service_role)만 쓰기/읽기. 브라우저 anon 키로는 접근 불가.
alter table public.aircraft_positions enable row level security;
-- (service_role 는 RLS 를 우회하므로 별도 정책 불필요.
--  anon 직접 읽기를 허용하려면 아래 주석을 해제하고 범위를 제한할 것.)
-- create policy "anon read recent" on public.aircraft_positions
--   for select to anon using (ts > now() - interval '2 hours');

-- 보존 정책(예시): 최근 24시간만 유지. pg_cron 사용 시 스케줄 등록.
-- delete from public.aircraft_positions where ts < now() - interval '24 hours';
