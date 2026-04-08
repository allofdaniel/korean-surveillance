/**
 * AircraftInfoPanel Component
 * DO-278A ?붽뎄?ы빆 異붿쟻: SRS-UI-010
 *
 * ?좏깮????났湲??곸꽭 ?뺣낫 ?⑤꼸
 */

import { useState, useEffect } from 'react';
import type { AircraftPosition } from '@/types';
import { getAircraftRepository } from '@/infrastructure/repositories/AircraftRepository';
import { ICAO_TO_IATA } from '@/config/constants';

interface AircraftInfoPanelProps {
  aircraft: AircraftPosition;
  onClose?: () => void;
  className?: string;
}

/**
 * ??났湲??뺣낫 ?⑤꼸 而댄룷?뚰듃
 */
export function AircraftInfoPanel({
  aircraft,
  onClose,
  className = '',
}: AircraftInfoPanelProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  /**
   * ??났湲??ъ쭊 濡쒕뱶
   */
  useEffect(() => {
    if (!aircraft.registration) {
      setPhotoUrl(null);
      return;
    }

    // Race condition 諛⑹?: registration 蹂寃??먮뒗 而댄룷?뚰듃 unmount ??痍⑥냼
    let cancelled = false;

    const loadPhoto = async () => {
      setIsLoadingPhoto(true);
      try {
        const repo = getAircraftRepository();
        const url = await repo.fetchPhotoUrl(aircraft.hex, aircraft.registration!);
        // 痍⑥냼?섏? ?딆븯???뚮쭔 ?곹깭 ?낅뜲?댄듃
        if (!cancelled) {
          setPhotoUrl(url);
        }
      } catch {
        if (!cancelled) {
          setPhotoUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPhoto(false);
        }
      }
    };

    loadPhoto();

    return () => {
      cancelled = true;
    };
  }, [aircraft.hex, aircraft.registration]);

  /**
   * 肄쒖궗?몄뿉????났???뺣낫 異붿텧
   */
  const getAirlineInfo = (callsign?: string) => {
    if (!callsign) return null;
    const icaoCode = callsign.slice(0, 3);
    const iataCode = ICAO_TO_IATA[icaoCode];
    if (iataCode) {
      return { icao: icaoCode, iata: iataCode };
    }
    return null;
  };

  const airlineInfo = getAirlineInfo(aircraft.flight);

  /**
   * 怨좊룄 ?щ㎎??
   */
  const formatAltitude = (alt?: number) => {
    if (alt === undefined || alt === null) return 'N/A';
    if (alt === 0) return 'GND';
    return `${alt.toLocaleString()} ft`;
  };

  /**
   * ?띾룄 ?щ㎎??
   */
  const formatSpeed = (speed?: number) => {
    if (speed === undefined || speed === null) return 'N/A';
    return `${Math.round(speed)} kt`;
  };

  /**
   * 諛⑹쐞媛??щ㎎??
   */
  const formatHeading = (heading?: number) => {
    if (heading === undefined || heading === null) return 'N/A';
    return `${Math.round(heading)}째`;
  };

  /**
   * ?섏쭅 ?띾룄 ?щ㎎??
   */
  const formatVerticalRate = (rate?: number) => {
    if (rate === undefined || rate === null) return 'N/A';
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toLocaleString()} fpm`;
  };

  return (
    <div
      className={`aircraft-info-panel ${className}`}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: '8px',
        padding: '16px',
        color: '#fff',
        minWidth: '280px',
        maxWidth: '350px',
      }}
    >
      {/* ?ㅻ뜑 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          paddingBottom: '8px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            {aircraft.flight || aircraft.hex}
          </h3>
          {airlineInfo && (
            <span style={{ fontSize: '12px', color: '#aaa' }}>
              {airlineInfo.icao} / {airlineInfo.iata}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px 8px',
            }}
          >
            횞
          </button>
        )}
      </div>

      {/* ?ъ쭊 */}
      {(photoUrl || isLoadingPhoto) && (
        <div
          style={{
            marginBottom: '12px',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: '#333',
            minHeight: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLoadingPhoto ? (
            <span style={{ color: '#666' }}>Loading...</span>
          ) : (
            <img
              src={photoUrl!}
              alt={aircraft.registration || 'Aircraft'}
              style={{ width: '100%', height: 'auto' }}
            />
          )}
        </div>
      )}

      {/* 湲곕낯 ?뺣낫 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <InfoRow label="ICAO24" value={aircraft.hex} />
        <InfoRow label="Registration" value={aircraft.registration || 'N/A'} />
        <InfoRow label="Type" value={aircraft.aircraft_type || 'N/A'} />
        <InfoRow label="Squawk" value={aircraft.squawk || 'N/A'} />
      </div>

      {/* 鍮꾪뻾 ?뺣낫 */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#aaa' }}>
          Flight Data
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <InfoRow label="Altitude" value={formatAltitude(aircraft.altitude_baro)} />
          <InfoRow label="Ground Speed" value={formatSpeed(aircraft.ground_speed)} />
          <InfoRow label="Track" value={formatHeading(aircraft.track)} />
          <InfoRow
            label="Vertical Rate"
            value={formatVerticalRate(aircraft.baro_rate)}
            highlight={aircraft.baro_rate !== undefined && aircraft.baro_rate !== 0 && Math.abs(aircraft.baro_rate) > 1000}
          />
        </div>
      </div>

      {/* ?꾩튂 ?뺣낫 */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#aaa' }}>
          Position
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <InfoRow label="Latitude" value={aircraft.lat?.toFixed(4) || 'N/A'} />
          <InfoRow label="Longitude" value={aircraft.lon?.toFixed(4) || 'N/A'} />
        </div>
      </div>

      {/* 異붽? ?뺣낫 */}
      {aircraft.owner_operator && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <InfoRow label="Operator" value={aircraft.owner_operator} fullWidth />
        </div>
      )}
    </div>
  );
}

/**
 * ?뺣낫 ??而댄룷?뚰듃
 */
function InfoRow({
  label,
  value,
  highlight = false,
  fullWidth = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: highlight ? '#FF9800' : '#fff',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default AircraftInfoPanel;

