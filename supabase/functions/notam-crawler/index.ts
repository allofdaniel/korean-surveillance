import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// 환경변수
// ============================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AIM_URL = "https://aim.koca.go.kr/xNotam/searchValidNotam.do";
const AIRPORTS = [
  "RKSI", "RKSS", "RKPK", "RKPC", "RKPS", "RKPU", "RKSM", "RKTH",
  "RKPD", "RKTL", "RKTU", "RKNW", "RKJK", "RKJB", "RKJY", "RKJJ",
  "RKTN", "RKNY",
];
const SERIES = ["A", "C", "D", "E", "G", "Z"];

// ============================================================
// 유틸리티
// ============================================================
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// AIM Korea API 호출
// ============================================================
async function aimPost(
  params: string,
  ibpage?: number
): Promise<{ DATA: any[]; Total: number }> {
  let body = params;
  if (ibpage) body += "&ibpage=" + ibpage;

  try {
    const res = await fetch(AIM_URL, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://aim.koca.go.kr/xNotam/index.do?type=search2",
      },
      body,
    });
    return await res.json();
  } catch (e) {
    return { DATA: [], Total: 0 };
  }
}

async function fetchAllPages(params: string): Promise<any[]> {
  const first = await aimPost(params);
  const allItems = [...(first.DATA || [])];
  const total = first.Total || 0;

  if (total > 100) {
    let page = 2;
    while (allItems.length < total && page <= 10) {
      const next = await aimPost(params, page);
      if (!next.DATA || next.DATA.length === 0) break;
      allItems.push(...next.DATA);
      page++;
    }
  }
  return allItems;
}

// ============================================================
// Q-line 좌표 파싱
// ============================================================
function parseQLine(fullText: string) {
  if (!fullText) return {};
  const m = fullText.match(
    /Q\)\s*(\w+)\/(\w+)\/\w+\/\w+\/\w+\/(\d{3})\/(\d{3})\/(\d{4})([NS])(\d{5})([EW])(\d{3})/
  );
  if (!m) return {};

  const latDeg = parseInt(m[5].substring(0, 2), 10);
  const latMin = parseInt(m[5].substring(2, 4), 10);
  let lat = latDeg + latMin / 60;
  if (m[6] === "S") lat = -lat;

  const lonDeg = parseInt(m[7].substring(0, 3), 10);
  const lonMin = parseInt(m[7].substring(3, 5), 10);
  let lon = lonDeg + lonMin / 60;
  if (m[8] === "W") lon = -lon;

  return {
    fir: m[1],
    qcode: m[2],
    q_lower_alt: parseInt(m[3], 10) * 100,
    q_upper_alt: parseInt(m[4], 10) * 100,
    q_lat: lat,
    q_lon: lon,
    q_radius_nm: parseInt(m[9], 10),
  };
}

// ============================================================
// AIM Korea 레코드 → DB 레코드 변환
// ============================================================
function transformRecord(
  rec: any,
  sourceType: string,
  sourceGroup: string,
  crawledAt: string
) {
  const fullText = rec.FULL_TEXT || "";
  const parsed = parseQLine(fullText);

  // B) / C) 라인에서 유효기간 추출
  const startMatch = fullText.match(/B\)\s*(\d{10})/);
  const endMatch = fullText.match(/C\)\s*(\d{10}|PERM)/);

  return {
    notam_number: rec.NOTAM_NO || "",
    location: rec.LOCATION || "",
    full_text: fullText,
    e_text: rec.ECODE || "",
    qcode: parsed.qcode || "",
    qcode_mean: "",
    effective_start: startMatch ? startMatch[1] : "",
    effective_end: endMatch ? endMatch[1] : "",
    series: rec.SERIES || "",
    fir: parsed.fir || "",
    issue_time: "",
    ais_type: rec.status || "",
    seq: rec.SEQ || "",
    q_lat: parsed.q_lat || null,
    q_lon: parsed.q_lon || null,
    q_radius_nm: parsed.q_radius_nm || null,
    q_lower_alt: parsed.q_lower_alt || null,
    q_upper_alt: parsed.q_upper_alt || null,
    source_type: sourceType,
    source_group: sourceGroup,
    crawled_at: crawledAt,
  };
}

// ============================================================
// Edge Function Handler
// ============================================================
Deno.serve(async (req) => {
  // 인증: service_role 키 또는 CRON_SECRET 확인
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const validTokens = [
    SUPABASE_SERVICE_KEY ? `Bearer ${SUPABASE_SERVICE_KEY}` : null,
    cronSecret ? `Bearer ${cronSecret}` : null,
  ].filter(Boolean);

  if (!authHeader || !validTokens.includes(authHeader)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startMs = Date.now();
  const now = new Date();
  const crawledAt = now.toISOString();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  const min = String(now.getUTCMinutes()).padStart(2, "0");
  const fromDate = `${y}-${m}-${d}`;
  const time = `${h}${min}`;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const allDbRecords: any[] = [];
    const counts: Record<string, any> = {
      domestic: {} as Record<string, number>,
      international: {} as Record<string, number>,
      snowtam: 0,
    };

    // ---- 1. 국내 NOTAM (시리즈별: A/C/D/E/G/Z) ----
    for (const series of SERIES) {
      const params = `sch_inorout=D&sch_from_date=${fromDate}&sch_from_time=${time}&sch_to_date=${fromDate}&sch_to_time=${time}&sch_airport=&sch_series=${series}&sch_select=&Page=100`;
      const items = await fetchAllPages(params);
      counts.domestic[series] = items.length;

      for (const item of items) {
        allDbRecords.push(
          transformRecord(item, "domestic", series, crawledAt)
        );
      }
      await sleep(300);
    }

    // ---- 2. SNOWTAM ----
    const snowParams = `sch_inorout=D&sch_from_date=${fromDate}&sch_from_time=${time}&sch_to_date=${fromDate}&sch_to_time=${time}&sch_airport=&sch_series=S&sch_snow_series=S&sch_select=&Page=100`;
    const snowItems = await fetchAllPages(snowParams);
    counts.snowtam = snowItems.length;
    for (const item of snowItems) {
      allDbRecords.push(transformRecord(item, "snowtam", "SNOW", crawledAt));
    }

    // ---- 3. 국제 NOTAM (공항별: 18개) ----
    for (const airport of AIRPORTS) {
      const params = `sch_inorout=I&sch_from_date=${fromDate}&sch_from_time=${time}&sch_to_date=${fromDate}&sch_to_time=${time}&sch_airport=${airport}&sch_series=&sch_select=&Page=100`;
      const items = await fetchAllPages(params);
      if (items.length > 0) {
        counts.international[airport] = items.length;
        for (const item of items) {
          allDbRecords.push(
            transformRecord(item, "international", airport, crawledAt)
          );
        }
      }
      await sleep(200);
    }

    const totalRaw = allDbRecords.length;

    // ---- 4. 중복 제거 (notam_number 기준) ----
    const deduped = new Map<string, any>();
    for (const rec of allDbRecords) {
      if (rec.notam_number) {
        deduped.set(rec.notam_number, rec);
      }
    }
    const dbRecords = Array.from(deduped.values());

    // ---- 5. 배치 Upsert (50건씩) ----
    const BATCH_SIZE = 50;
    let upsertedTotal = 0;
    const errors: string[] = [];

    for (let i = 0; i < dbRecords.length; i += BATCH_SIZE) {
      const batch = dbRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("notams").upsert(batch, {
        onConflict: "notam_number",
        ignoreDuplicates: false,
      });
      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
      } else {
        upsertedTotal += batch.length;
      }
    }

    // ---- 6. 크롤 로그 기록 ----
    const executionMs = Date.now() - startMs;
    const domesticTotal = Object.values(counts.domestic as Record<string, number>).reduce(
      (s, v) => s + v,
      0
    );
    const intlTotal = Object.values(counts.international as Record<string, number>).reduce(
      (s, v) => s + v,
      0
    );

    await supabase.from("notam_crawl_logs").insert({
      crawled_at: crawledAt,
      source: "aim-korea",
      domestic_a: (counts.domestic as any).A || 0,
      domestic_c: (counts.domestic as any).C || 0,
      domestic_d: (counts.domestic as any).D || 0,
      domestic_e: (counts.domestic as any).E || 0,
      international: intlTotal,
      snowtam: counts.snowtam || 0,
      total_upserted: upsertedTotal,
      total_records: totalRaw,
      status: errors.length === 0 ? "success" : "partial",
      error_message: errors.length > 0 ? errors.join("; ") : null,
      execution_ms: executionMs,
    });

    return new Response(
      JSON.stringify({
        status: errors.length === 0 ? "SUCCESS" : "PARTIAL",
        source: "aim-korea (aim.koca.go.kr)",
        totalRaw,
        deduplicated: dbRecords.length,
        upserted: upsertedTotal,
        executionMs,
        counts: {
          domestic: { ...counts.domestic, total: domesticTotal },
          international: { ...counts.international, total: intlTotal },
          snowtam: counts.snowtam,
        },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const executionMs = Date.now() - startMs;
    await supabase
      .from("notam_crawl_logs")
      .insert({
        crawled_at: crawledAt,
        source: "aim-korea",
        status: "error",
        error_message: (e as Error).message,
        execution_ms: executionMs,
      })
      .catch(() => {});

    return new Response(
      JSON.stringify({
        status: "ERROR",
        error: (e as Error).message,
        executionMs,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
