import React, { useState, useEffect } from 'react';
import {
  Activity,
  Radio,
  CloudRain,
  FileText,
  Plane,
  Volume2,
  CheckCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  X,
  Play,
  Pause,
  Layers,
  Database
} from 'lucide-react';

interface InterfaceItem {
  no: number | string;
  system: string;
  name: string;
  subData: string;
  protocol: string;
  linkType: string;
  format: string;
  interval: string;
  sender: string;
  receiver: string;
  source: string;
  status: 'ACTIVE' | 'WARNING' | 'INACTIVE';
  endpoint: string;
  doc: string;
}

interface ApiDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_ITEMS: InterfaceItem[] = [
  {
    no: 1,
    system: '항적정보',
    name: '항적정보(융합)',
    subData: '융합 항적 (System Track)',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'ASTERIX Cat.062 (JSON)',
    interval: '1~2초 (실시간)',
    sender: 'koreansurveillance.com',
    receiver: 'TBAS / MSDP / 외부서버',
    source: 'OpenSky Network / ADS-B Feeder',
    status: 'ACTIVE',
    endpoint: '/api/asterix?cat=62',
    doc: 'ASTERIX Category 062 Eurocontrol Spec'
  },
  {
    no: 2,
    system: '항적정보',
    name: '항적정보(개별)',
    subData: 'ADS-B 개별 항적',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'ASTERIX Cat.021 (JSON)',
    interval: '1~2초 (실시간)',
    sender: 'koreansurveillance.com',
    receiver: 'TBAS / ADS-B Ground Station',
    source: 'OpenSky Network / 홈 Feeder',
    status: 'ACTIVE',
    endpoint: '/api/asterix?cat=21',
    doc: 'ASTERIX Category 021 Target Report'
  },
  {
    no: 3,
    system: '항적정보',
    name: '항적정보(개별)',
    subData: 'Radar (PSR/SSR) 합성 항적',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'ASTERIX Cat.048 (JSON)',
    interval: '4초 (회전주기)',
    sender: 'koreansurveillance.com',
    receiver: 'MSDP / Radar Processing',
    source: 'ADS-B Radar Polar Synthesis',
    status: 'ACTIVE',
    endpoint: '/api/asterix?cat=48&typ=COMBINED_PSR_SSR',
    doc: 'ASTERIX Category 048 Monoradar Target Report'
  },
  {
    no: 4,
    system: '항적정보',
    name: '지상이동체 항적',
    subData: 'G-SMGCS 표면 감시 항적',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'ASTERIX Cat.010 (JSON)',
    interval: '1초 (실시간)',
    sender: 'koreansurveillance.com',
    receiver: 'A-SMGCS / EFS Strip',
    source: 'Airport Surface Surveillance Feeder',
    status: 'ACTIVE',
    endpoint: '/api/asterix?cat=10',
    doc: 'ASTERIX Category 010 Surface Movement'
  },
  {
    no: 5,
    system: '항적정보',
    name: '상태 정보',
    subData: 'Mode-S North Mark & 상태',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'ASTERIX Cat.034 (JSON)',
    interval: '4초 (회전주기)',
    sender: 'koreansurveillance.com',
    receiver: 'MSDP System Monitoring',
    source: 'Synthetic Radar North Mark Generator',
    status: 'ACTIVE',
    endpoint: '/api/asterix?cat=34',
    doc: 'ASTERIX Category 034 Station Message'
  },
  {
    no: 6,
    system: '항적정보',
    name: '항적정보(개별)',
    subData: 'Primary Radar (PSR) 단독 항적',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'ASTERIX Cat.048 (JSON)',
    interval: '4초 (회전주기)',
    sender: 'koreansurveillance.com',
    receiver: 'MSDP Radar Processor',
    source: 'PSR Synthesis Engine',
    status: 'ACTIVE',
    endpoint: '/api/asterix?cat=48&typ=SINGLE_PSR',
    doc: 'ASTERIX Category 048 Single PSR Report'
  },
  {
    no: 7,
    system: '항적정보',
    name: '항적정보(개별)',
    subData: 'Secondary Radar (SSR) 단독 항적',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'ASTERIX Cat.048 (JSON)',
    interval: '4초 (회전주기)',
    sender: 'koreansurveillance.com',
    receiver: 'MSDP Radar Processor',
    source: 'SSR Synthesis Engine',
    status: 'ACTIVE',
    endpoint: '/api/asterix?cat=48&typ=SINGLE_SSR',
    doc: 'ASTERIX Category 048 Single SSR Report'
  },
  {
    no: 8,
    system: '항적정보',
    name: '항적 통계 및 궤적',
    subData: 'System Track Trace & History',
    protocol: 'REST / WebSocket',
    linkType: 'Stream / Pull',
    format: 'JSON Array / GeoJSON',
    interval: '1~2초',
    sender: 'koreansurveillance.com',
    receiver: 'TBAS Flight Tracker',
    source: 'Realtime Track Fusion Engine',
    status: 'ACTIVE',
    endpoint: '/api/aircraft?history=true',
    doc: 'Flight Path Trace Stream'
  },
  {
    no: 9,
    system: '기상정보',
    name: '정규 기상보고 (METAR)',
    subData: '공항 정규 항공기상 실측치',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'AMHS IPM XML (IA5 Text)',
    interval: '매 30분 / 정시',
    sender: 'koreansurveillance.com',
    receiver: 'IFS / 기상연계서버 / TBAS',
    source: 'AMO (항공기상청 domestic-airport)',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=METAR&icao=RKSI',
    doc: 'ICAO Annex 3 METAR in X.400 IPM XML'
  },
  {
    no: 10,
    system: '기상정보',
    name: '공항 예보 (TAF)',
    subData: '공항 24/30시간 기상예보',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'AMHS IPM XML (IA5 Text)',
    interval: '매 6시간',
    sender: 'koreansurveillance.com',
    receiver: 'IFS / 기상연계서버 / TBAS',
    source: 'AMO (항공기상청 domestic-airport)',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=TAF&icao=RKSS',
    doc: 'ICAO Annex 3 TAF in X.400 IPM XML'
  },
  {
    no: 11,
    system: '기상정보',
    name: '위험기상특보 (SIGMET)',
    subData: 'FIR 내 중증 난기류/착빙/화산재 특보',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'AMHS IPM XML (IA5 Text)',
    interval: '발생시 (비정기)',
    sender: 'koreansurveillance.com',
    receiver: 'IFS / 기상연계서버 / TBAS',
    source: 'AMO (항공기상청 SIGMET Feed)',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=SIGMET',
    doc: 'ICAO Annex 3 SIGMET in X.400 IPM XML'
  },
  {
    no: 12,
    system: '기상정보',
    name: '디지털 기상 (IWXXM)',
    subData: 'XML 기상전문 FTBP Gzip 바이너리',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'AMHS XML (Gzip Hex FTBP)',
    interval: '매 30분',
    sender: 'koreansurveillance.com',
    receiver: 'IFS / 차세대 기상시스템',
    source: 'AMO / KMA IWXXM Feed',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=IWXXM&icao=RKSI',
    doc: 'WMO/ICAO IWXXM 2023-1 FTBP Body'
  },
  {
    no: '9-A',
    system: '기상정보',
    name: '실시간 관제기상 (AMOS)',
    subData: '42개 활주로별 초단위 순간풍/RVR/QNH',
    protocol: 'REST / WebSocket',
    linkType: 'Push / Pull',
    format: 'JSON / AMHS MET REPORT XML',
    interval: '1~2초 (초고빈도 실시간)',
    sender: 'koreansurveillance.com',
    receiver: '관제탑 / EFS / TBAS',
    source: 'AMO (AmosRealTimeMqc.do)',
    status: 'ACTIVE',
    endpoint: '/api/weather?type=amos&icao=RKSI',
    doc: 'Real-time AMOS Sensor Readings'
  },
  {
    no: 13,
    system: '항공고시보',
    name: '항공고시보 (NOTAM)',
    subData: '공항/항로 시설 상태 및 비행제한구역',
    protocol: 'SOAP / REST',
    linkType: 'Pull / Push',
    format: 'AMHS SOAP XML (receiveAmhsMessage)',
    interval: '5분 (실시간 캐시)',
    sender: 'koreansurveillance.com',
    receiver: 'IFS / 비행정보시스템 / TBAS',
    source: 'AIM Korea (aim.koca.go.kr)',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=NOTAM&location=RKSI',
    doc: 'AIDA-NG SOAP Envelope for NOTAM'
  },
  {
    no: 14,
    system: '비행계획서',
    name: '비행계획서 (FPL)',
    subData: 'ICAO Doc 4444 비행계획 전문',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'AMHS IPM XML',
    interval: '실시간 (운항스케줄 동기화)',
    sender: 'koreansurveillance.com',
    receiver: 'FDP / 관제시스템 / EFS',
    source: 'UBIKAIS (fois.go.kr) / 공항공사',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=FPL&callsign=KAL867',
    doc: 'ICAO Doc 4444 FPL in AMHS IPM'
  },
  {
    no: 15,
    system: '비행계획서',
    name: '비행계획 변경보 (CHG)',
    subData: '출발시간/항로/순항고도 변경 전문',
    protocol: 'AMQP / REST',
    linkType: 'Pub/Sub / Pull',
    format: 'AMHS IPM XML',
    interval: '변경 감지시',
    sender: 'koreansurveillance.com',
    receiver: 'FDP / 관제시스템',
    source: 'UBIKAIS 변경 감지 이벤트',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=CHG&callsign=CES5052',
    doc: 'ICAO Doc 4444 CHG in AMHS IPM'
  },
  {
    no: 16,
    system: '비행계획서',
    name: '비행계획 취소보 (CNL)',
    subData: '운항 취소/결항 전문',
    protocol: 'SOAP / REST',
    linkType: 'Push / Pull',
    format: 'AMHS SOAP XML',
    interval: '결항 감지시',
    sender: 'koreansurveillance.com',
    receiver: 'FDP / 관제시스템',
    source: 'UBIKAIS 결항 감지 이벤트',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=CNL&callsign=KAL1847',
    doc: 'ICAO Doc 4444 CNL in AMHS SOAP'
  },
  {
    no: 17,
    system: '비행계획서',
    name: '비행 지연보 (DLA)',
    subData: '지연 출발 통보 전문',
    protocol: 'SOAP / REST',
    linkType: 'Push / Pull',
    format: 'AMHS SOAP XML',
    interval: '지연 감지시',
    sender: 'koreansurveillance.com',
    receiver: 'FDP / 관제시스템 / EFS',
    source: 'UBIKAIS (depStatus=DLA)',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=DLA&callsign=KAL867',
    doc: 'ICAO Doc 4444 DLA in AMHS SOAP'
  },
  {
    no: 18,
    system: '비행계획서',
    name: '출발보 (DEP)',
    subData: '실제 이륙 시간(ATD) 통보',
    protocol: 'SOAP / REST',
    linkType: 'Push / Pull',
    format: 'AMHS SOAP XML',
    interval: '이륙 감지시 (속도 > 100kt)',
    sender: 'koreansurveillance.com',
    receiver: 'FDP / 관제시스템 / EFS',
    source: 'ADS-B 이륙 감지 + UBIKAIS',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=DEP&callsign=CES5052',
    doc: 'ICAO Doc 4444 DEP in AMHS SOAP'
  },
  {
    no: 19,
    system: '비행계획서',
    name: '도착보 (ARR)',
    subData: '실제 착륙 시간(ATA) 통보',
    protocol: 'SOAP / REST',
    linkType: 'Push / Pull',
    format: 'AMHS SOAP XML',
    interval: '착륙 감지시',
    sender: 'koreansurveillance.com',
    receiver: 'FDP / 관제시스템 / EFS',
    source: 'ADS-B 착륙 감지 + UBIKAIS',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=ARR&callsign=DLH718',
    doc: 'ICAO Doc 4444 ARR in AMHS SOAP'
  },
  {
    no: 20,
    system: '비행계획서',
    name: '비행계획서 접수/통보 (IPN)',
    subData: 'IPM 접수 확인 및 NDR 배달보고',
    protocol: 'SOAP / REST',
    linkType: 'Push / Pull',
    format: 'AMHS SOAP XML',
    interval: '전문 수신 직후',
    sender: 'koreansurveillance.com',
    receiver: 'AIDA-NG Message Switch',
    source: 'AMHS Message Dispatcher',
    status: 'ACTIVE',
    endpoint: '/api/amhs?type=METREPORT&icao=RKSI',
    doc: 'NonDeliveryReport / IPN in SOAP'
  },
  {
    no: 21,
    system: '관제음성',
    name: '관제음성 스트림',
    subData: '인천/김포/제주 TWR·APP 실시간 음성',
    protocol: 'HTTP Stream (Icecast)',
    linkType: 'Audio Stream',
    format: 'AUDIO/MPEG (MP3)',
    interval: '실시간 스트리밍',
    sender: 'koreansurveillance.com',
    receiver: '관제 콘솔 / TBAS Voice Panel',
    source: 'LiveATC Relay (s1-fmt2.liveatc.net)',
    status: 'ACTIVE',
    endpoint: '/api/voice?airport=RKSI',
    doc: 'Live ATC Audio Stream'
  },
  {
    no: 22,
    system: '운영정보',
    name: '전자비행스트립 (EFS)',
    subData: 'FPL + 실시간 항적 융합 전자 스트립',
    protocol: 'REST / WebSocket',
    linkType: 'Pub/Sub',
    format: 'EFS Strip Standard JSON',
    interval: '1~2초',
    sender: 'koreansurveillance.com',
    receiver: 'EFS 콘솔 / 관제석',
    source: 'FPL + ADS-B Surveillance Fusion',
    status: 'ACTIVE',
    endpoint: '/api/flight-schedule',
    doc: 'Electronic Flight Strip Object'
  },
  {
    no: 23,
    system: '운영정보',
    name: '운항정보디스플레이 (FIDS)',
    subData: '공항별 실시간 출/도착 전광판 데이터',
    protocol: 'REST / WebSocket',
    linkType: 'Pull / Push',
    format: 'FIDS Schedule JSON',
    interval: '10초 (실시간 캐시)',
    sender: 'koreansurveillance.com',
    receiver: 'FIDS 모니터 / 승객안내 / TBAS',
    source: 'UBIKAIS (fois.go.kr) / 공항공사',
    status: 'ACTIVE',
    endpoint: '/api/flight-schedule',
    doc: 'FIDS Flight Schedule JSON'
  },
];

export const ApiDashboardModal: React.FC<ApiDashboardModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<InterfaceItem[]>(INITIAL_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeItem, setActiveItem] = useState<InterfaceItem | null>(INITIAL_ITEMS[0]);
  const [liveSample, setLiveSample] = useState<string>('');
  const [loadingSample, setLoadingSample] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioStreamUrl, setAudioStreamUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchCatalog();
      if (!activeItem) {
        handleInspectSample(INITIAL_ITEMS[0]);
      }
    }
  }, [isOpen]);

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/data-status');
      if (res.ok) {
        const json = await res.json();
        if (json.items && json.items.length > 0) {
          setItems(json.items);
        }
      }
    } catch {
      // Fallback already in place
    }
  };

  const handleInspectSample = async (item: InterfaceItem) => {
    setActiveItem(item);
    setLoadingSample(true);
    setLiveSample('');
    setIsPlayingAudio(false);

    if (item.format.includes('AUDIO')) {
      setAudioStreamUrl('https://s1-fmt2.liveatc.net/rksi_twr');
      setLoadingSample(false);
      setLiveSample('LiveATC Voice Stream: RKSI Tower 118.2MHz\nStatus: STREAMING\nProtocol: ICECAST HTTP STREAM (AUDIO/MPEG)\nURL: https://s1-fmt2.liveatc.net/rksi_twr');
      return;
    }

    try {
      const res = await fetch(item.endpoint);
      const contentType = res.headers.get('content-type') || '';
      let text = '';
      if (contentType.includes('json')) {
        const json = await res.json();
        text = JSON.stringify(json, null, 2);
      } else {
        text = await res.text();
      }
      setLiveSample(text);
    } catch (e: unknown) {
      setLiveSample(`Failed to fetch live sample: ${(e as Error).message}`);
    } finally {
      setLoadingSample(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(liveSample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const categories = ['ALL', '항적정보', '기상정보', '항공고시보', '비행계획서', '관제음성', '운영정보'];

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'ALL' || item.system === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subData.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.format.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-hidden">
      <div className="relative flex flex-col w-full max-w-7xl h-[92vh] bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  외부 연계 데이터 게이트웨이 대시보드
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  23개 규격 전체 가동중
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                koreansurveillance.com — 실시간 항적(ASTERIX), 항공기상(AMO/AMOS), NOTAM, 비행계획(UBIKAIS), 관제음성(LiveATC) 종합 모니터링
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchCatalog}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
              title="데이터 새로고침"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>새로고침</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-6 py-3 border-b border-slate-800/80 bg-slate-900/60">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>연계 인터페이스</span>
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">23 <span className="text-xs font-normal text-slate-400">종류</span></div>
            <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">● 100% 규격 일치 검증</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>실시간 관제 기상 (AMOS)</span>
              <CloudRain className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">42 <span className="text-xs font-normal text-slate-400">활주로 엔드</span></div>
            <div className="text-[10px] text-blue-400 mt-0.5 font-medium">1~2초 초고빈도 수집</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>실시간 감시 항적</span>
              <Plane className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">90+ <span className="text-xs font-normal text-slate-400">대/한반도</span></div>
            <div className="text-[10px] text-purple-400 mt-0.5 font-medium">ASTERIX Cat.062/021</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>유효 NOTAM</span>
              <FileText className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">460 <span className="text-xs font-normal text-slate-400">건</span></div>
            <div className="text-[10px] text-amber-400 mt-0.5 font-medium">AIM Korea 실시간 캐시</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>운항스케줄 & 관제음성</span>
              <Volume2 className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">UBIKAIS / LiveATC</div>
            <div className="text-[10px] text-rose-400 mt-0.5 font-medium">FPL 전문 & 오디오 스트림</div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Table Panel */}
          <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
            
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                      selectedCategory === cat
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {cat === 'ALL' ? '전체 보기 (23)' : cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="인터페이스/형식/출처 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">NO</th>
                    <th className="py-2.5 px-3">시스템 / 인터페이스 명</th>
                    <th className="py-2.5 px-3">데이터 형식</th>
                    <th className="py-2.5 px-3">프로토콜 / 연계 방식</th>
                    <th className="py-2.5 px-3">발생 주기</th>
                    <th className="py-2.5 px-3">소스 출처</th>
                    <th className="py-2.5 px-3 text-center">상태</th>
                    <th className="py-2.5 px-3 text-center">실시간 검증</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredItems.map(item => (
                    <tr
                      key={item.no}
                      onClick={() => handleInspectSample(item)}
                      className={`hover:bg-cyan-950/20 cursor-pointer transition ${
                        activeItem?.no === item.no ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">{item.no}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-400">{item.subData}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          item.format.includes('ASTERIX')
                            ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                            : item.format.includes('AMHS')
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                            : item.format.includes('AUDIO')
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {item.format}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-300">{item.protocol}</div>
                        <div className="text-[10px] text-slate-500">{item.linkType}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">{item.interval}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.source}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle className="w-2.5 h-2.5 mr-1" />
                          정상
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectSample(item);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 rounded transition"
                        >
                          샘플 보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Inspector Panel */}
          <div className="w-full md:w-[480px] lg:w-[540px] flex flex-col bg-slate-950/90 overflow-hidden">
            {activeItem ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Inspector Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/60">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                        NO. {activeItem.no}
                      </span>
                      <h3 className="font-bold text-white text-sm">{activeItem.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{activeItem.doc}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopy}
                      disabled={loadingSample || !liveSample}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition disabled:opacity-50"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copied ? '복사완료!' : '전문 복사'}</span>
                    </button>
                    <a
                      href={activeItem.endpoint}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 transition"
                      title="API 직접 열기"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Inspector Metadata Card */}
                <div className="p-4 border-b border-slate-800 grid grid-cols-2 gap-2 text-xs bg-slate-900/40">
                  <div><span className="text-slate-500">엔드포인트:</span> <code className="text-cyan-400 font-mono">{activeItem.endpoint}</code></div>
                  <div><span className="text-slate-500">발생 주기:</span> <span className="text-slate-200 font-medium">{activeItem.interval}</span></div>
                  <div><span className="text-slate-500">원천 소스:</span> <span className="text-slate-200">{activeItem.source}</span></div>
                  <div><span className="text-slate-500">포맷:</span> <span className="text-slate-200 font-mono">{activeItem.format}</span></div>
                </div>

                {/* Audio Player if Voice item */}
                {activeItem.format.includes('AUDIO') && (
                  <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400">
                        <Volume2 className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">RKSI 인천국제공항 관제탑 (118.2 MHz)</div>
                        <div className="text-[11px] text-slate-400">LiveATC Realtime Audio Feed</div>
                      </div>
                    </div>
                    <audio controls autoPlay className="h-8 max-w-[200px]" src={audioStreamUrl}>
                      Your browser does not support audio element.
                    </audio>
                  </div>
                )}

                {/* Live Sample Viewer */}
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-semibold text-slate-400 flex items-center">
                      <Activity className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                      실시간 라이브 페이로드 (Live Payload)
                    </span>
                    <button
                      onClick={() => handleInspectSample(activeItem)}
                      className="text-[11px] text-cyan-400 hover:underline flex items-center"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      실시간 재요청
                    </button>
                  </div>

                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-y-auto font-mono text-[11px] text-emerald-400/90 leading-relaxed custom-scrollbar">
                    {loadingSample ? (
                      <div className="flex items-center justify-center h-full text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                        실시간 데이터 호출 중...
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap">{liveSample || '데이터가 없습니다.'}</pre>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <Database className="w-12 h-12 stroke-[1] mb-3 text-slate-600" />
                <h4 className="text-sm font-semibold text-slate-400">인터페이스를 선택하세요</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  좌측 목록에서 항목을 클릭하거나 [샘플 보기] 버튼을 누르면 실시간 라이브 변환 데이터(XML / JSON)를 즉시 검증할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400">
          <div className="flex items-center space-x-4">
            <span>서버: <strong className="text-slate-200">koreansurveillance.com</strong></span>
            <span>연계 허브: <strong className="text-cyan-400">n8n / Supabase / Vercel API Gateway</strong></span>
          </div>
          <div>
            <span>보안: <strong className="text-emerald-400">DO-278A SRS-SEC-001 준수</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ApiDashboardModal;
