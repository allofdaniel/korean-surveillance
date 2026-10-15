import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMapStore, useLayerStore, useAircraftStore, useAtcStore } from '../../stores';

export function Toggle({ label, hint, on, set, disabled }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }): React.ReactElement {
  return (
    <button type="button" role="switch" aria-checked={on} className="ks-toggle" onClick={() => set(!on)} disabled={disabled}
      style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
      <span className="lbl">{label}{hint && <small>{hint}</small>}</span>
      <span className="ks-switch" aria-hidden="true" />
    </button>
  );
}

type Sector = { id: string };
type AtcData = { ACC?: Sector[]; TMA?: Sector[]; CTR?: Sector[] } | null;

const FILTER_LABEL: Record<string, string> = { none: '기본', nvg: '야간투시(NVG)', flir: '열영상(FLIR)', crt: '레이더 CRT' };

export default function LayersPanel({ atcData }: { atcData: AtcData }): React.ReactElement {
  const m = useMapStore(useShallow(s => ({
    isDarkMode: s.isDarkMode, setIsDarkMode: s.setIsDarkMode,
    showSatellite: s.showSatellite, setShowSatellite: s.setShowSatellite,
    is3DView: s.is3DView, setIs3DView: s.setIs3DView,
    showTerrain: s.showTerrain, setShowTerrain: s.setShowTerrain,
    show3DAltitude: s.show3DAltitude, setShow3DAltitude: s.setShow3DAltitude,
    showBuildings: s.showBuildings, setShowBuildings: s.setShowBuildings,
    viewFilter: s.viewFilter, cycleViewFilter: s.cycleViewFilter,
    showCctv: s.showCctv, setShowCctv: s.setShowCctv,
    showShips: s.showShips, setShowShips: s.setShowShips,
    showSatellites: s.showSatellites, setShowSatellites: s.setShowSatellites,
    showVwBuildings: s.showVwBuildings, setShowVwBuildings: s.setShowVwBuildings,
    showVwSpecial: s.showVwSpecial, setShowVwSpecial: s.setShowVwSpecial,
    showVwRoads: s.showVwRoads, setShowVwRoads: s.setShowVwRoads,
  })));
  const l = useLayerStore(useShallow(s => s));
  const ac = useAircraftStore(useShallow(s => ({
    showAircraft: s.showAircraft, setShowAircraft: s.setShowAircraft,
    showAircraftTrails: s.showAircraftTrails, setShowAircraftTrails: s.setShowAircraftTrails,
    show3DAircraft: s.show3DAircraft, setShow3DAircraft: s.setShow3DAircraft,
    trailDuration: s.trailDuration, setTrailDuration: s.setTrailDuration,
    headingPrediction: s.headingPrediction, setHeadingPrediction: s.setHeadingPrediction,
  })));
  const atc = useAtcStore(useShallow(s => ({
    atcOnlyMode: s.atcOnlyMode, setAtcOnlyMode: s.setAtcOnlyMode,
    radarRange: s.radarRange, setRadarRange: s.setRadarRange,
    radarBlackBackground: s.radarBlackBackground, setRadarBlackBackground: s.setRadarBlackBackground,
    selected: s.selectedAtcSectors, setSelected: s.setSelectedAtcSectors,
  })));

  const groupOn = (ids: string[]): boolean => ids.length > 0 && ids.every(id => atc.selected.has(id));
  const setGroup = (ids: string[], on: boolean): void => {
    const next = new Set(atc.selected);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    atc.setSelected(next);
  };
  const ids = (k: 'ACC' | 'TMA' | 'CTR'): string[] => (atcData?.[k] || []).map(s => s.id);

  return (
    <>
      <div className="ks-section">
        <div className="ks-section-title">지도</div>
        <Toggle label="어두운 지도" on={m.isDarkMode} set={m.setIsDarkMode} />
        <Toggle label="위성 영상" on={m.showSatellite} set={m.setShowSatellite} />
        <Toggle label="3D 보기" hint="기울임 + 고도 표현" on={m.is3DView} set={m.setIs3DView} />
        <Toggle label="지형 기복" on={m.showTerrain} set={m.setShowTerrain} />
        <Toggle label="3D 건물" on={m.showBuildings} set={m.setShowBuildings} disabled={!m.is3DView} hint={!m.is3DView ? '3D 보기에서 사용' : undefined} />
        <Toggle label="고도 입체 표현" hint="공역·절차를 실제 고도로" on={m.show3DAltitude} set={m.setShow3DAltitude} />
        <div className="ks-row">
          <span className="lbl">화면 필터</span>
          <button type="button" className="ks-btn" onClick={m.cycleViewFilter} style={{ height: 30 }}>{FILTER_LABEL[m.viewFilter] || m.viewFilter}</button>
        </div>
      </div>

      <div className="ks-section">
        <div className="ks-section-title">교통</div>
        <Toggle label="항공기" on={ac.showAircraft} set={ac.setShowAircraft} />
        <Toggle label="항적 꼬리" on={ac.showAircraftTrails} set={ac.setShowAircraftTrails} />
        <Toggle label="3D 항공기 모델" on={ac.show3DAircraft} set={ac.setShow3DAircraft} disabled={!m.is3DView} hint={!m.is3DView ? '3D 보기에서 사용' : undefined} />
        <div className="ks-row">
          <span className="lbl">꼬리 길이</span>
          <select className="ks-select" value={ac.trailDuration} onChange={e => ac.setTrailDuration(Number(e.target.value))} aria-label="항적 꼬리 길이">
            {[60_000, 120_000, 300_000, 600_000, 1_800_000].map(v => <option key={v} value={v}>{v / 60_000}분</option>)}
          </select>
        </div>
        <div className="ks-row">
          <span className="lbl">진행 방향 예측선</span>
          <select className="ks-select" value={ac.headingPrediction} onChange={e => ac.setHeadingPrediction(Number(e.target.value))} aria-label="진행 방향 예측">
            {[0, 30, 60, 120, 300].map(v => <option key={v} value={v}>{v === 0 ? '끔' : `${v}초`}</option>)}
          </select>
        </div>
      </div>

      <div className="ks-section">
        <div className="ks-section-title">국내 항공정보 <span className="count">AIRAC</span></div>
        <Toggle label="비행장" on={l.showKoreaAirports} set={l.setShowKoreaAirports} />
        <Toggle label="항로" on={l.showKoreaRoutes} set={l.setShowKoreaRoutes} />
        <Toggle label="웨이포인트" on={l.showKoreaWaypoints} set={l.setShowKoreaWaypoints} />
        <Toggle label="터미널 웨이포인트" on={l.showKoreaTerminalWaypoints} set={l.setShowKoreaTerminalWaypoints} />
        <Toggle label="항행안전시설" hint="VOR · DME · NDB" on={l.showKoreaNavaids} set={l.setShowKoreaNavaids} />
        <Toggle label="공역" hint="P · R · D · MOA" on={l.showKoreaAirspaces} set={l.setShowKoreaAirspaces} />
        <Toggle label="체공 패턴" on={l.showKoreaHoldings} set={l.setShowKoreaHoldings} />
        <Toggle label="장애물" on={l.showObstacles} set={l.setShowObstacles} />
      </div>

      <div className="ks-section">
        <div className="ks-section-title">관제</div>
        <Toggle label="레이더 화면" hint="관제 스코프 링 표시" on={atc.atcOnlyMode} set={atc.setAtcOnlyMode} />
        {atc.atcOnlyMode && (
          <>
            <div className="ks-row">
              <span className="lbl">레이더 범위</span>
              <select className="ks-select" value={atc.radarRange} onChange={e => atc.setRadarRange(Number(e.target.value))} aria-label="레이더 범위">
                {[50, 100, 150, 200, 250].map(v => <option key={v} value={v}>{v} NM</option>)}
              </select>
            </div>
            <Toggle label="검은 배경" on={atc.radarBlackBackground} set={atc.setRadarBlackBackground} />
          </>
        )}
        <Toggle label={`접근관제구역 TMA (${ids('TMA').length})`} on={groupOn(ids('TMA'))} set={v => setGroup(ids('TMA'), v)} />
        <Toggle label={`관제권 CTR (${ids('CTR').length})`} on={groupOn(ids('CTR'))} set={v => setGroup(ids('CTR'), v)} />
        <Toggle label={`지역관제 ACC 섹터 (${ids('ACC').length})`} on={groupOn(ids('ACC'))} set={v => setGroup(ids('ACC'), v)} />
      </div>

      <div className="ks-section">
        <div className="ks-section-title">전세계 항공정보 <span className="count">대용량</span></div>
        <Toggle label="공항" on={l.showGlobalAirports} set={l.setShowGlobalAirports} />
        <Toggle label="항로" on={l.showGlobalAirways} set={l.setShowGlobalAirways} />
        <Toggle label="항행안전시설" on={l.showGlobalNavaids} set={l.setShowGlobalNavaids} />
        <Toggle label="웨이포인트" hint="약 10MB" on={l.showGlobalWaypoints} set={l.setShowGlobalWaypoints} />
        <Toggle label="FIR · UIR" on={l.showGlobalFirUir} set={l.setShowGlobalFirUir} />
        <Toggle label="관제공역" on={l.showGlobalCtrlAirspace} set={l.setShowGlobalCtrlAirspace} />
        <Toggle label="제한공역" on={l.showGlobalRestrAirspace} set={l.setShowGlobalRestrAirspace} />
      </div>

      <div className="ks-section">
        <div className="ks-section-title">기타 실시간</div>
        <Toggle label="CCTV" hint="공항·도로 실시간 영상" on={m.showCctv} set={m.setShowCctv} />
        <Toggle label="선박 (AIS)" on={m.showShips} set={m.setShowShips} />
        <Toggle label="인공위성" hint="CelesTrak TLE" on={m.showSatellites} set={m.setShowSatellites} />
        <Toggle label="V-World 건물" on={m.showVwBuildings} set={m.setShowVwBuildings} />
        <Toggle label="V-World 주요시설" on={m.showVwSpecial} set={m.setShowVwSpecial} />
        <Toggle label="V-World 도로" on={m.showVwRoads} set={m.setShowVwRoads} />
      </div>
    </>
  );
}
