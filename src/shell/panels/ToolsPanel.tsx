import React from 'react';
import { Activity, ClipboardList, PlaneTakeoff, Home, ExternalLink } from 'lucide-react';

interface ToolsPanelProps {
  onOpenApiDashboard: () => void;
  onHome: () => void;
}

export default function ToolsPanel({ onOpenApiDashboard, onHome }: ToolsPanelProps): React.ReactElement {
  return (
    <>
      <div className="ks-section">
        <div className="ks-section-title">관제 업무</div>
        <a className="ks-tool" href="/efs" target="_blank" rel="noopener noreferrer">
          <ClipboardList size={18} />
          <span className="lbl">전자비행스트립 EFS<small>운항 스트립 보드</small></span>
          <ExternalLink size={14} color="var(--ks-text-3)" />
        </a>
        <a className="ks-tool" href="/ifs" target="_blank" rel="noopener noreferrer">
          <PlaneTakeoff size={18} />
          <span className="lbl">정보융합지원 IFS<small>UBIKAIS 운항스케줄 · AMOS</small></span>
          <ExternalLink size={14} color="var(--ks-text-3)" />
        </a>
      </div>
      <div className="ks-section">
        <div className="ks-section-title">시스템</div>
        <button type="button" className="ks-tool" onClick={onOpenApiDashboard}>
          <Activity size={18} />
          <span className="lbl">연계 API 대시보드<small>데이터 소스별 연결 상태</small></span>
        </button>
        <button type="button" className="ks-tool" onClick={onHome}>
          <Home size={18} />
          <span className="lbl">대한감시 홈<small>랜딩 페이지로 이동</small></span>
        </button>
      </div>
    </>
  );
}
