/* eslint-disable react-hooks/exhaustive-deps */
// Mapbox GL dependencies are intentionally excluded from useEffect deps

import { useEffect, type MutableRefObject } from 'react';
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import {
  getNotamValidity,
  buildCancelledNotamSet,
} from '../utils/notam';
import { resolveNotamGeometry, type ResolvedNotamGeom } from '../utils/notamGeometry';
import { safeRemoveLayer, safeRemoveSource } from '../utils/mapbox';
import { escapeHtml } from '../utils/sanitize';
import type { NotamItem, NotamData } from './useNotamData';

/**
 * useNotamLayer - NOTAM 지도 레이어 렌더링 훅
 * - 선택된 위치의 NOTAM 표시
 * - 3D 고도 extrusion
 * - 클릭 시 상세 팝업
 */
export default function useNotamLayer(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  notamLocationsOnMap: Set<string>,
  notamData: NotamData | null,
  is3DView: boolean
): void {
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clean up previous layers
    ['notam-extrusion', 'notam-fill', 'notam-outline', 'notam-icons', 'notam-labels'].forEach(id => safeRemoveLayer(map.current, id));
    ['notam-areas', 'notam-centers'].forEach(id => safeRemoveSource(map.current, id));

    // Active NOTAMs on map - only show when locations are selected
    if (notamLocationsOnMap.size === 0 || !notamData?.data || notamData.data.length === 0) return;

    // Build set of cancelled NOTAMs first
    const cancelledSet = buildCancelledNotamSet(notamData.data);

    interface NotamFeature {
      type: 'Feature';
      geometry: {
        type: string;
        coordinates: unknown;
      };
      properties: Record<string, unknown>;
    }

    // 1. NOTAM → resolved geometry (단일 진실 소스). 1번씩만 호출.
    interface ResolvedEntry {
      notam: NotamItem;
      geom: ResolvedNotamGeom;
      validity: 'active' | 'future' | 'expired';
    }
    const resolved: ResolvedEntry[] = [];
    for (const n of notamData.data) {
      // 선택된 location 만
      if (!notamLocationsOnMap.has(n.location)) continue;
      // 취소된 NOTAM 제외
      const validity = getNotamValidity(n, cancelledSet);
      if (validity === false) continue;
      // 지오메트리 결정
      const geom = resolveNotamGeometry(n);
      if (!geom) continue;
      // FIR-wide (radius ≥ 999) 제외 — 맵 전체를 덮음
      if (geom.radiusNM >= 999) continue;
      resolved.push({ notam: n, geom, validity });
    }

    if (resolved.length === 0) return;

    // 2. fill polygon features
    const notamFeatures: NotamFeature[] = resolved.map(({ notam: n, geom, validity }) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: geom.fillCoordinates },
      properties: {
        id: n.id,
        notam_number: n.notam_number,
        location: n.location,
        qcode: n.qcode,
        qcode_mean: n.qcode_mean,
        e_text: n.e_text,
        full_text: n.full_text,
        effective_start: n.effective_start,
        effective_end: n.effective_end || 'PERM',
        series: n.series,
        fir: n.fir,
        lowerAlt: geom.lowerAlt,
        upperAlt: geom.upperAlt,
        validity,
        kind: geom.kind,
        source: geom.source,
        radiusNM: geom.radiusNM,
        radiusBucket: geom.radiusBucket,
      },
    }));

    // 3. center marker features — 같은 좌표에 쌓인 NOTAM 들 라디얼 분산
    const stackBuckets = new Map<string, ResolvedEntry[]>();
    for (const r of resolved) {
      const key = `${r.geom.centroid.lat.toFixed(4)}_${r.geom.centroid.lon.toFixed(4)}`;
      const arr = stackBuckets.get(key);
      if (arr) arr.push(r); else stackBuckets.set(key, [r]);
    }

    const notamCenterFeatures: NotamFeature[] = resolved.map((entry) => {
      const { notam: n, geom, validity } = entry;
      const key = `${geom.centroid.lat.toFixed(4)}_${geom.centroid.lon.toFixed(4)}`;
      const bucket = stackBuckets.get(key) || [entry];
      const total = bucket.length;
      let lon = geom.centroid.lon, lat = geom.centroid.lat;
      if (total > 1) {
        const idx = bucket.indexOf(entry);
        // stack 크기 비례 라디얼 분산 — 많이 쌓일수록 큰 원 (가독성)
        const offsetDeg = Math.min(0.005 + total * 0.0015, 0.025);
        const angle = (idx / total) * 2 * Math.PI;
        const cosLat = Math.cos(geom.centroid.lat * Math.PI / 180) || 1e-6;
        lon = geom.centroid.lon + (Math.sin(angle) * offsetDeg) / cosLat;
        lat = geom.centroid.lat + Math.cos(angle) * offsetDeg;
      }

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          id: n.id,
          notam_number: n.notam_number,
          location: n.location,
          qcode: n.qcode,
          qcode_mean: n.qcode_mean,
          e_text: n.e_text,
          full_text: n.full_text,
          effective_start: n.effective_start,
          effective_end: n.effective_end || 'PERM',
          series: n.series,
          fir: n.fir,
          lowerAlt: geom.lowerAlt,
          upperAlt: geom.upperAlt,
          validity,
          stack_total: total,
          stack_index: total > 1 ? bucket.indexOf(entry) + 1 : 0,
          kind: geom.kind,
          source: geom.source,
          radiusNM: geom.radiusNM,
          radiusBucket: geom.radiusBucket,
        },
      };
    });

    map.current.addSource('notam-areas', { type: 'geojson', data: { type: 'FeatureCollection', features: notamFeatures } as GeoJSON.FeatureCollection });

    // 3D extrusion layer for NOTAMs (shows altitude range) - color by validity
    if (is3DView) {
      map.current.addLayer({
        id: 'notam-extrusion',
        type: 'fill-extrusion',
        source: 'notam-areas',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['==', ['get', 'validity'], 'future'], '#2196F3',
            ['==', ['get', 'validity'], 'expired'], '#9E9E9E',
            '#FF9800'
          ],
          'fill-extrusion-opacity': 0.45,
          'fill-extrusion-base': ['*', ['get', 'lowerAlt'], 0.3048],
          'fill-extrusion-height': ['*', ['get', 'upperAlt'], 0.3048]
        }
      });
    }

    // 2D fill layer - 가시성 강화 (어두운 배경에서도 잘 보이게)
    // 큰 NOTAM (large/wide) 은 fill 을 더 흐리게 — 작은 NOTAM 가독성 보호
    map.current.addLayer({
      id: 'notam-fill',
      type: 'fill',
      source: 'notam-areas',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'validity'], 'future'], '#2196F3',
          ['==', ['get', 'validity'], 'expired'], '#9E9E9E',
          '#FF9800'
        ],
        'fill-opacity': is3DView
          ? [
              'case',
              ['==', ['get', 'radiusBucket'], 'wide'], 0.05,
              ['==', ['get', 'radiusBucket'], 'large'], 0.08,
              0.12
            ]
          : [
              'case',
              ['==', ['get', 'radiusBucket'], 'wide'], 0.10,
              ['==', ['get', 'radiusBucket'], 'large'], 0.18,
              ['==', ['get', 'radiusBucket'], 'point'], 0.40,
              0.28
            ]
      }
    });
    map.current.addLayer({
      id: 'notam-outline',
      type: 'line',
      source: 'notam-areas',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'validity'], 'future'], '#2196F3',
          ['==', ['get', 'validity'], 'expired'], '#9E9E9E',
          '#FF9800'
        ],
        // zoom 별 두께, 큰 NOTAM 은 더 얇게 — 작은 NOTAM 가독성 보호
        'line-width': [
          'case',
          ['==', ['get', 'radiusBucket'], 'wide'],
            ['interpolate', ['linear'], ['zoom'], 4, 1.0, 12, 1.5],
          ['==', ['get', 'radiusBucket'], 'large'],
            ['interpolate', ['linear'], ['zoom'], 4, 1.5, 12, 2.5],
          ['interpolate', ['linear'], ['zoom'], 4, 2.5, 8, 3.5, 12, 4.5]
        ],
        'line-dasharray': [4, 2]
      }
    });

    map.current.addSource('notam-centers', { type: 'geojson', data: { type: 'FeatureCollection', features: notamCenterFeatures } as GeoJSON.FeatureCollection });
    map.current.addLayer({
      id: 'notam-icons',
      type: 'circle',
      source: 'notam-centers',
      paint: {
        // 반경 버킷 + 줌 별 크기. 작은 NOTAM 도 시인성 확보, 큰 NOTAM 은 너무 두드러지지 않게
        'circle-radius': [
          'case',
          ['==', ['get', 'radiusBucket'], 'point'],
            ['interpolate', ['linear'], ['zoom'], 4, 6, 8, 6, 12, 5],
          ['==', ['get', 'radiusBucket'], 'small'],
            ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 7, 12, 6],
          ['==', ['get', 'radiusBucket'], 'medium'],
            ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 8, 12, 7],
          ['==', ['get', 'radiusBucket'], 'large'],
            ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 9, 12, 8],
          // wide
          ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 10, 12, 9]
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'validity'], 'future'], '#2196F3',
          ['==', ['get', 'validity'], 'expired'], '#9E9E9E',
          '#FF9800'
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.95
      }
    });
    map.current.addLayer({
      id: 'notam-labels',
      type: 'symbol',
      source: 'notam-centers',
      layout: {
        'text-field': ['get', 'notam_number'],
        'text-size': 10,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-allow-overlap': true,
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold']
      },
      paint: {
        'text-color': [
          'case',
          ['==', ['get', 'validity'], 'future'], '#2196F3',
          ['==', ['get', 'validity'], 'expired'], '#9E9E9E',
          '#FF9800'
        ],
        'text-halo-color': 'rgba(0, 0, 0, 0.9)',
        'text-halo-width': 1.5
      }
    });

    // Helper function to show NOTAM popup
    const showNotamPopup = (props: Record<string, unknown>, lngLat: mapboxgl.LngLat): void => {
      // Format effective times (YYMMDDHHMM -> readable format)
      const formatNotamTime = (timeStr: unknown): string => {
        if (!timeStr || timeStr === 'PERM') return 'PERM (영구)';
        const str = String(timeStr);
        if (str.length < 10) return str;
        const year = '20' + str.substring(0, 2);
        const month = str.substring(2, 4);
        const day = str.substring(4, 6);
        const hour = str.substring(6, 8);
        const minute = str.substring(8, 10);
        return `${year}-${month}-${day} ${hour}:${minute}Z`;
      };

      const startTime = formatNotamTime(props.effective_start);
      const endTime = formatNotamTime(props.effective_end);
      // validity 는 항상 controlled 값 ('active'|'future'|'expired') 만 들어옴 — 안전
      const validity = props.validity === 'future' || props.validity === 'expired'
        ? (props.validity as 'future' | 'expired')
        : 'active';
      const validityColor = validity === 'future' ? '#2196F3'
        : validity === 'expired' ? '#9E9E9E'
        : '#FF9800';
      const validityText = validity === 'future' ? '예정'
        : validity === 'expired' ? '만료'
        : '활성';
      const validityBgColor = validity === 'future' ? 'rgba(33,150,243,0.2)'
        : validity === 'expired' ? 'rgba(158,158,158,0.2)'
        : 'rgba(255,152,0,0.2)';

      // 모든 외부 NOTAM 데이터는 escapeHtml 로 sanitize. setHTML() 에 들어가므로
      // <script>, on*= 등의 인젝션 방어 필수.
      const e = escapeHtml;
      const notamNo = e(props.notam_number as string);
      const seriesS = e((props.series as string) || '');
      const locS = e(props.location as string);
      const firS = e((props.fir as string) || 'RKRR');
      const qcodeS = e(props.qcode as string);
      const qcodeMeanS = e((props.qcode_mean as string) || '-');
      // e_text 와 full_text 는 multi-line. escape 후 \n → <br> 변환.
      const eTextSafe = e((props.e_text as string) || '-').replace(/\r?\n/g, '<br>');
      const fullTextSafe = e((props.full_text as string) || '').replace(/\r?\n/g, '<br>');
      // 고도 — number 가 아니면 '-' 표기
      const lowerAltN = props.lowerAlt;
      const upperAltN = props.upperAlt;
      const altDisplay = (typeof lowerAltN === 'number' && typeof upperAltN === 'number'
        && !isNaN(lowerAltN) && !isNaN(upperAltN))
        ? `FL${String(Math.round(lowerAltN / 100)).padStart(3, '0')} ~ FL${String(Math.round(upperAltN / 100)).padStart(3, '0')}`
        : '-';

      const popupContent = `
        <div style="max-width: 400px; font-size: 12px; max-height: 500px; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid ${validityColor}40; padding-bottom: 6px;">
            <span style="font-weight: bold; color: ${validityColor}; font-size: 14px;">${notamNo}</span>
            <div style="display: flex; gap: 4px;">
              <span style="background: ${validityBgColor}; color: ${validityColor}; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${validityText}</span>
              <span style="background: rgba(255,255,255,0.1); color: #aaa; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${seriesS}</span>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; margin-bottom: 8px;">
            <span style="color: #888;">위치:</span><span>${locS} (${firS})</span>
            <span style="color: #888;">Q-Code:</span><span>${qcodeS}</span>
            <span style="color: #888;">의미:</span><span>${qcodeMeanS}</span>
            <span style="color: #888;">유효시작:</span><span style="color: #4CAF50;">${e(startTime)}</span>
            <span style="color: #888;">유효종료:</span><span style="color: #f44336;">${e(endTime)}</span>
            <span style="color: #888;">고도:</span><span>${altDisplay}</span>
          </div>
          <div style="margin-bottom: 8px;">
            <div style="color: #888; margin-bottom: 4px; font-size: 11px;">내용 (E):</div>
            <div style="background: ${validityBgColor}; padding: 8px; border-radius: 4px; white-space: pre-wrap; line-height: 1.4;">${eTextSafe}</div>
          </div>
          <details style="margin-top: 8px;">
            <summary style="cursor: pointer; color: ${validityColor}; font-size: 11px;">전문 보기 (Full Text)</summary>
            <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 4px; font-family: monospace; font-size: 10px; white-space: pre-wrap; line-height: 1.3; color: #ccc;">${fullTextSafe}</div>
          </details>
        </div>
      `;
      new mapboxgl.Popup({ closeButton: true, maxWidth: '450px' })
        .setLngLat(lngLat)
        .setHTML(popupContent)
        .addTo(map.current!);
    };

    // Add popup on click for fill layer
    const handleFillClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }): void => {
      const feature = e.features?.[0];
      if (feature) {
        showNotamPopup(feature.properties || {}, e.lngLat);
      }
    };

    const handleIconClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }): void => {
      e.preventDefault();
      const feature = e.features?.[0];
      if (feature) {
        showNotamPopup(feature.properties || {}, e.lngLat);
      }
    };

    const setCursor = (): void => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; };
    const resetCursor = (): void => { if (map.current) map.current.getCanvas().style.cursor = ''; };

    map.current.on('click', 'notam-fill', handleFillClick);
    map.current.on('mouseenter', 'notam-fill', setCursor);
    map.current.on('mouseleave', 'notam-fill', resetCursor);
    map.current.on('click', 'notam-icons', handleIconClick);
    map.current.on('mouseenter', 'notam-icons', setCursor);
    map.current.on('mouseleave', 'notam-icons', resetCursor);

    return () => {
      try {
        map.current?.off('click', 'notam-fill', handleFillClick);
        map.current?.off('mouseenter', 'notam-fill', setCursor);
        map.current?.off('mouseleave', 'notam-fill', resetCursor);
        map.current?.off('click', 'notam-icons', handleIconClick);
        map.current?.off('mouseenter', 'notam-icons', setCursor);
        map.current?.off('mouseleave', 'notam-icons', resetCursor);
      } catch { /* ignore */ }
    };

  }, [mapLoaded, notamLocationsOnMap, notamData, is3DView, map]);
}
