-- AIP 자동판독 결과를 AIRAC 이력과 함께 보관 (읽기는 공개, 쓰기는 service_role만)
create table if not exists public.aip_cycles (
  airac date primary key,
  built_at timestamptz not null default now(),
  airports text[] not null default '{}',
  source_note text
);

create table if not exists public.aip_obstacles (
  airac date not null references public.aip_cycles(airac) on delete cascade,
  id text not null,
  airport text not null,            -- ICAO, or 'ENR' for ENR 5.4
  lat double precision not null,
  lon double precision not null,
  elev_m real,                      -- AMSL (top)
  hgt_m real,                       -- AGL as published
  ground_m real,                    -- Copernicus DEM GLO-30 at the position
  elev_estimated boolean not null default false,
  position_estimated boolean not null default false,
  obst_type text,
  category text,
  marking text,
  remarks text,
  sources text[] not null default '{}',
  qa text,
  primary key (airac, id)
);
create index if not exists aip_obstacles_airport on public.aip_obstacles (airac, airport);

create table if not exists public.aip_fixes (
  airac date not null references public.aip_cycles(airac) on delete cascade,
  airport text not null,
  ident text not null,
  lat double precision not null,
  lon double precision not null,
  sources text[] not null default '{}',
  primary key (airac, airport, ident)
);

create table if not exists public.aip_procedures (
  airac date not null references public.aip_cycles(airac) on delete cascade,
  airport text not null,
  kind text not null,               -- sids | stars | iaps
  ident text not null,              -- app key, e.g. KALO1S.RW36L
  legs jsonb not null,
  qa jsonb,
  primary key (airac, airport, kind, ident)
);

alter table public.aip_cycles enable row level security;
alter table public.aip_obstacles enable row level security;
alter table public.aip_fixes enable row level security;
alter table public.aip_procedures enable row level security;
create policy "aip read" on public.aip_cycles for select using (true);
create policy "aip read" on public.aip_obstacles for select using (true);
create policy "aip read" on public.aip_fixes for select using (true);
create policy "aip read" on public.aip_procedures for select using (true);
