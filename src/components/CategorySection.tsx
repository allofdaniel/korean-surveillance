import React, { type ReactNode } from 'react';

interface CategorySectionProps {
  title: string;
  /** 좌측 strip + 헤더 텍스트 색상 */
  accent: string;
  expanded: boolean;
  onToggle: () => void;
  /** 옆에 부가 정보 (예: 선택된 항목 수) */
  badge?: string | number;
  children: ReactNode;
}

/**
 * 좌측 패널의 대분류(Major Category) 헤더.
 * 내부 Accordion 들과 시각적으로 구별되도록 더 큰 헤더 + accent 색상 + 접기 토글.
 */
const CategorySection: React.FC<CategorySectionProps> = React.memo(({
  title,
  accent,
  expanded,
  onToggle,
  badge,
  children,
}) => {
  const headerId = React.useId();
  const contentId = React.useId();

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className="category-section"
      style={{
        marginTop: 12,
        marginBottom: 4,
        borderLeft: `3px solid ${accent}`,
        paddingLeft: 4,
      }}
    >
      <div
        id={headerId}
        role="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKey}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: accent,
          background: `${accent}14`, // 8% opacity hex
          borderRadius: 6,
          marginBottom: expanded ? 6 : 0,
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
      >
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {badge !== undefined && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 8px',
                borderRadius: 10,
                background: `${accent}33`,
                letterSpacing: '0.3px',
                textTransform: 'none',
              }}
            >
              {badge}
            </span>
          )}
          <span style={{ fontSize: 9, transition: 'transform 0.3s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            ▼
          </span>
        </span>
      </div>
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        style={{
          maxHeight: expanded ? 5000 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s ease-out, opacity 0.25s ease-out',
          opacity: expanded ? 1 : 0,
          paddingLeft: 2,
        }}
      >
        {children}
      </div>
    </div>
  );
});

CategorySection.displayName = 'CategorySection';

export default CategorySection;
