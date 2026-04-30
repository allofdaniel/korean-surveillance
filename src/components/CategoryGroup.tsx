/**
 * CategoryGroup Component
 * 대분류(Major Category) 래퍼 — 4px 좌측 accent 테두리, 뱃지, 접기 토글
 */
import React, { type ReactNode, useId } from 'react';

export interface CategoryGroupProps {
  /** Optional small SVG or character icon (rendered before title) */
  icon?: ReactNode;
  title: string;
  /** CSS color string — controls left border + header tint */
  accentColor: string;
  /** Open by default? */
  defaultExpanded?: boolean;
  /** Controlled expanded state (overrides internal state when provided) */
  expanded?: boolean;
  /** Called when header is clicked (use with controlled expanded) */
  onToggle?: () => void;
  /** Active-count badge — e.g. "3 켜짐" */
  badge?: string | number;
  children: ReactNode;
}

const CategoryGroup: React.FC<CategoryGroupProps> = React.memo(
  ({ icon, title, accentColor, expanded, onToggle, badge, children }) => {
    const headerId = useId();
    const contentId = useId();

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle?.();
      }
    };

    const isOpen = expanded ?? false;

    return (
      <div
        className="category-group"
        style={{ '--cat-accent': accentColor } as React.CSSProperties}
      >
        <button
          id={headerId}
          className="category-header"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={onToggle}
          onKeyDown={handleKeyDown}
          type="button"
        >
          <span className="category-header-left">
            {icon && <span className="category-icon" aria-hidden="true">{icon}</span>}
            <span className="category-title">{title}</span>
          </span>
          <span className="category-header-right">
            {badge !== undefined && (
              <span className="category-badge">{badge}</span>
            )}
            <span
              className="category-chevron"
              aria-hidden="true"
              style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
            >
              ▼
            </span>
          </span>
        </button>

        <div
          id={contentId}
          className={`category-body${isOpen ? ' expanded' : ''}`}
          role="region"
          aria-labelledby={headerId}
        >
          <div className="category-body-inner">
            {children}
          </div>
        </div>
      </div>
    );
  }
);

CategoryGroup.displayName = 'CategoryGroup';

export default CategoryGroup;
