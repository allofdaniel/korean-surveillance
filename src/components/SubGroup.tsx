/**
 * SubGroup Component
 * 중분류(Middle Category) 아코디언 — 1px 테두리, 쉐브론, CategoryGroup 내부에서 사용
 */
import React, { type ReactNode, useId } from 'react';

export interface SubGroupProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  /** Optional count or string badge */
  badge?: string | number;
  children: ReactNode;
  className?: string;
}

const SubGroup: React.FC<SubGroupProps> = React.memo(
  ({ title, expanded, onToggle, badge, children, className = '' }) => {
    const headerId = useId();
    const contentId = useId();

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    };

    return (
      <div className={`subgroup ${className}`}>
        <button
          id={headerId}
          className="subgroup-header"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggle}
          onKeyDown={handleKeyDown}
          type="button"
        >
          <span className="subgroup-title">{title}</span>
          <span className="subgroup-header-right">
            {badge !== undefined && (
              <span className="subgroup-badge">{badge}</span>
            )}
            <span
              className="subgroup-chevron"
              aria-hidden="true"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
            >
              ▸
            </span>
          </span>
        </button>

        <div
          id={contentId}
          className={`subgroup-body${expanded ? ' expanded' : ''}`}
          role="region"
          aria-labelledby={headerId}
        >
          <div className="subgroup-body-inner">
            {children}
          </div>
        </div>
      </div>
    );
  }
);

SubGroup.displayName = 'SubGroup';

export default SubGroup;
