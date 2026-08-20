-- ============================================================
-- Supabase Schema: AMHS Messages & ASTERIX Surveillance Data
-- ============================================================

-- 1. AMHS Messages Table (METAR, TAF, SIGMET, NOTAM, FPL, DEP, ARR, etc.)
CREATE TABLE IF NOT EXISTS public.amhs_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_type VARCHAR(20) NOT NULL, -- METAR, TAF, SIGMET, NOTAM, FPL, DEP, ARR, DLA, CNL, CHG, IWXXM, REPORT
    protocol VARCHAR(20) DEFAULT 'AMQP', -- AMQP, SOAP, REST
    format VARCHAR(20) DEFAULT 'XML', -- XML, SOAP, GZIP_HEX
    filing_time VARCHAR(10),
    originator VARCHAR(100),
    recipient VARCHAR(100),
    callsign VARCHAR(20),
    location VARCHAR(10),
    raw_text TEXT,
    xml_payload TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amhs_type_created ON public.amhs_messages (message_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amhs_location ON public.amhs_messages (location);
CREATE INDEX IF NOT EXISTS idx_amhs_callsign ON public.amhs_messages (callsign);

-- 2. ASTERIX Surveillance Tracks (Cat.062, Cat.021, Cat.048, Cat.010)
CREATE TABLE IF NOT EXISTS public.asterix_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category INT NOT NULL, -- 62, 21, 48, 10, 34
    target_address VARCHAR(10) NOT NULL, -- ICAO 24-bit hex
    target_identification VARCHAR(20), -- Callsign
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    flight_level VARCHAR(10),
    speed_kts DOUBLE PRECISION,
    heading_deg DOUBLE PRECISION,
    mode3a VARCHAR(10),
    asterix_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asterix_cat_created ON public.asterix_tracks (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asterix_hex ON public.asterix_tracks (target_address);

-- Enable Supabase Realtime for live publishing
ALTER PUBLICATION supabase_realtime ADD TABLE public.amhs_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asterix_tracks;
