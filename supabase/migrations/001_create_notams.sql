-- ============================================================
-- NOTAM Database Schema for Supabase
-- Replaces Supabase Storage JSON blob approach with proper DB
-- ============================================================

-- 1. NOTAM 메인 테이블
CREATE TABLE IF NOT EXISTS notams (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- NOTAM 핵심 필드 (AIM Korea format)
  notam_number TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  full_text TEXT,
  e_text TEXT,
  qcode TEXT,
  qcode_mean TEXT,
  effective_start TEXT,          -- YYMMDDHHMM format
  effective_end TEXT,            -- YYMMDDHHMM or "PERM" or "EST"
  series TEXT,                   -- A, C, D, E
  fir TEXT,                      -- RKRR
  issue_time TEXT,
  ais_type TEXT,
  seq TEXT,

  -- Q-line 파싱 좌표 (공간 쿼리용)
  q_lat DOUBLE PRECISION,
  q_lon DOUBLE PRECISION,
  q_radius_nm INTEGER,
  q_lower_alt INTEGER,           -- ft (x100)
  q_upper_alt INTEGER,           -- ft (x100)

  -- 분류
  source_type TEXT DEFAULT 'domestic',  -- 'domestic', 'international', 'snowtam'
  source_group TEXT,                    -- 시리즈 or 공항코드 (A, C, D, E, RKSI, ...)

  -- 메타데이터
  crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- NOTAM 번호 유니크 (같은 NOTAM 중복 방지)
  CONSTRAINT notams_unique_number UNIQUE(notam_number)
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_notams_location ON notams(location);
CREATE INDEX IF NOT EXISTS idx_notams_series ON notams(series);
CREATE INDEX IF NOT EXISTS idx_notams_source_type ON notams(source_type);
CREATE INDEX IF NOT EXISTS idx_notams_effective_start ON notams(effective_start);
CREATE INDEX IF NOT EXISTS idx_notams_effective_end ON notams(effective_end);
CREATE INDEX IF NOT EXISTS idx_notams_qcode ON notams(qcode);
CREATE INDEX IF NOT EXISTS idx_notams_fir ON notams(fir);
CREATE INDEX IF NOT EXISTS idx_notams_crawled_at ON notams(crawled_at);
CREATE INDEX IF NOT EXISTS idx_notams_coords ON notams(q_lat, q_lon)
  WHERE q_lat IS NOT NULL AND q_lon IS NOT NULL;

-- 3. RLS (Row Level Security)
ALTER TABLE notams ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (anon key로 Swagger/API 접근)
CREATE POLICY "notams_public_read" ON notams
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- service_role만 쓰기 가능 (n8n 크롤러용)
CREATE POLICY "notams_service_write" ON notams
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_notams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notams_updated_at_trigger
  BEFORE UPDATE ON notams
  FOR EACH ROW
  EXECUTE FUNCTION update_notams_updated_at();


-- ============================================================
-- 크롤링 로그 테이블 (모니터링용)
-- ============================================================
CREATE TABLE IF NOT EXISTS notam_crawl_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'aim-korea',
  domestic_a INTEGER DEFAULT 0,
  domestic_c INTEGER DEFAULT 0,
  domestic_d INTEGER DEFAULT 0,
  domestic_e INTEGER DEFAULT 0,
  international INTEGER DEFAULT 0,
  snowtam INTEGER DEFAULT 0,
  total_upserted INTEGER DEFAULT 0,
  total_records INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',     -- 'success', 'partial', 'error'
  error_message TEXT,
  execution_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notam_crawl_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crawl_logs_public_read" ON notam_crawl_logs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "crawl_logs_service_write" ON notam_crawl_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crawl_logs_crawled_at
  ON notam_crawl_logs(crawled_at DESC);


-- ============================================================
-- Supabase Database Function: NOTAM 검색 RPC
-- PostgREST로 복잡한 쿼리를 지원
-- ============================================================

-- 영역 내 NOTAM 검색 (bounds 기반)
CREATE OR REPLACE FUNCTION search_notams(
  p_south DOUBLE PRECISION DEFAULT NULL,
  p_west DOUBLE PRECISION DEFAULT NULL,
  p_north DOUBLE PRECISION DEFAULT NULL,
  p_east DOUBLE PRECISION DEFAULT NULL,
  p_period TEXT DEFAULT 'all',
  p_series TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000
)
RETURNS SETOF notams
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_period_start TEXT;
  v_period_end TEXT;
BEGIN
  RETURN QUERY
  SELECT n.*
  FROM notams n
  WHERE
    -- 영역 필터
    (p_south IS NULL OR n.q_lat >= p_south - 1)
    AND (p_north IS NULL OR n.q_lat <= p_north + 1)
    AND (p_west IS NULL OR n.q_lon >= p_west - 1)
    AND (p_east IS NULL OR n.q_lon <= p_east + 1)
    -- 시리즈 필터
    AND (p_series IS NULL OR n.series = p_series)
    -- 위치 필터
    AND (p_location IS NULL OR n.location = p_location)
    -- 기간 필터 (period)
    AND (
      p_period = 'all'
      OR (p_period = 'current' AND (
        n.effective_end IS NULL
        OR n.effective_end = 'PERM'
        OR n.effective_end = 'EST'
        OR n.effective_end > TO_CHAR(v_now AT TIME ZONE 'UTC', 'YYMMDDHH24MI')
      ))
    )
  ORDER BY n.crawled_at DESC, n.notam_number DESC
  LIMIT p_limit;
END;
$$;

-- 최근 크롤링 상태 확인
CREATE OR REPLACE FUNCTION get_notam_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_notams', (SELECT COUNT(*) FROM notams),
    'latest_crawl', (SELECT MAX(crawled_at) FROM notams),
    'series_counts', (
      SELECT json_object_agg(series, cnt)
      FROM (SELECT series, COUNT(*) as cnt FROM notams GROUP BY series) s
    ),
    'source_counts', (
      SELECT json_object_agg(source_type, cnt)
      FROM (SELECT source_type, COUNT(*) as cnt FROM notams GROUP BY source_type) s
    ),
    'last_crawl_log', (
      SELECT row_to_json(l)
      FROM notam_crawl_logs l
      ORDER BY crawled_at DESC
      LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
