/**
 * StatWidget - 통계 위젯 컴포넌트
 * 숫자 기반 통계를 표시하는 재사용 가능한 위젯
 */
import React from 'react';
import './styles.scss';

export interface StatWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: string;
    label: string;
  };
  icon?: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const StatWidget: React.FC<StatWidgetProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'primary',
  size = 'medium',
  loading = false,
  onClick,
  className = ''
}) => {
  const getTrendIcon = () => {
    switch (trend?.direction) {
      case 'up':
        return '↗';
      case 'down':
        return '↘';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const getTrendColor = () => {
    switch (trend?.direction) {
      case 'up':
        return 'var(--color-success)';
      case 'down':
        return 'var(--color-danger)';
      case 'stable':
        return 'var(--color-gray-500)';
      default:
        return 'var(--color-text-secondary)';
    }
  };

  if (loading) {
    return (
      <div className={`stat-widget stat-widget--${size} stat-widget--loading ${className}`}>
        <div className="stat-widget__skeleton">
          <div className="skeleton-line skeleton-line--title"></div>
          <div className="skeleton-line skeleton-line--value"></div>
          <div className="skeleton-line skeleton-line--subtitle"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`stat-widget stat-widget--${size} stat-widget--${color} ${onClick ? 'stat-widget--clickable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {/* 아이콘 */}
      {icon && (
        <div className="stat-widget__icon">
          {icon}
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="stat-widget__content">
        <div className="stat-widget__header">
          <h3 className="stat-widget__title">{title}</h3>
          {trend && (
            <div 
              className="stat-widget__trend"
              style={{ color: getTrendColor() }}
              aria-label={`${trend.direction === 'up' ? '증가' : trend.direction === 'down' ? '감소' : '변화없음'} ${trend.value} ${trend.label}`}
            >
              <span className="trend-icon">{getTrendIcon()}</span>
              <span className="trend-value">{trend.value}</span>
            </div>
          )}
        </div>

        <div className="stat-widget__value" aria-label={`${title} 값: ${value}`}>
          {value}
        </div>

        {subtitle && (
          <div className="stat-widget__subtitle">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatWidget;
