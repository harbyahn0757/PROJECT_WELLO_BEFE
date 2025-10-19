/**
 * RecentCheckupWidget - 최근 검진 결과 위젯
 * 가장 최근 건강검진 결과를 요약하여 표시
 */
import React from 'react';
import { TilkoHealthCheckupRaw } from '../../../../types/health';
import './styles.scss';

export interface RecentCheckupWidgetProps {
  checkupData?: TilkoHealthCheckupRaw;
  loading?: boolean;
  onViewDetails?: () => void;
  className?: string;
}

const RecentCheckupWidget: React.FC<RecentCheckupWidgetProps> = ({
  checkupData,
  loading = false,
  onViewDetails,
  className = ''
}) => {
  // 주요 지표 추출
  const extractKeyMetrics = (checkup: TilkoHealthCheckupRaw) => {
    const metrics: { name: string; value: string; unit: string; status: string }[] = [];
    
    checkup.Inspections?.forEach((inspection: any) => {
      inspection.Illnesses?.forEach((illness: any) => {
        illness.Items?.forEach((item: any) => {
          // 주요 지표만 선별
          const keyMetrics = ['신장', '체중', '혈압(최고/최저)', '공복혈당', '총콜레스테롤'];
          if (keyMetrics.includes(item.Name)) {
            metrics.push({
              name: item.Name,
              value: item.Value,
              unit: item.Unit || '',
              status: getItemStatus(item.Name, item.Value)
            });
          }
        });
      });
    });
    
    return metrics;
  };

  // 개별 지표 상태 판정
  const getItemStatus = (name: string, value: string): string => {
    const numValue = parseFloat(value);
    
    switch (name) {
      case '공복혈당':
        if (numValue < 100) return 'normal';
        if (numValue < 126) return 'warning';
        return 'danger';
      case '총콜레스테롤':
        if (numValue < 200) return 'normal';
        if (numValue < 240) return 'warning';
        return 'danger';
      case '혈압(최고/최저)':
        const [systolic] = value.split('/').map(v => parseInt(v));
        if (systolic < 120) return 'normal';
        if (systolic < 140) return 'warning';
        return 'danger';
      default:
        return 'normal';
    }
  };

  // 전체 상태 판정
  const getOverallStatus = (code: string) => {
    switch (code) {
      case '정상':
        return { status: 'normal', label: '정상', color: 'var(--color-success)' };
      case '의심':
      case '질환의심':
        return { status: 'warning', label: '주의', color: 'var(--color-warning)' };
      case '질환':
      case '이상':
        return { status: 'danger', label: '위험', color: 'var(--color-danger)' };
      default:
        return { status: 'unknown', label: '미확인', color: 'var(--color-gray-500)' };
    }
  };

  if (loading) {
    return (
      <div className={`recent-checkup-widget recent-checkup-widget--loading ${className}`}>
        <div className="recent-checkup-widget__header">
          <div className="skeleton-line skeleton-line--title"></div>
          <div className="skeleton-line skeleton-line--date"></div>
        </div>
        <div className="recent-checkup-widget__content">
          <div className="skeleton-line skeleton-line--status"></div>
          <div className="metrics-skeleton">
            {[1, 2, 3].map(i => (
              <div key={i} className="metric-skeleton">
                <div className="skeleton-line skeleton-line--metric-name"></div>
                <div className="skeleton-line skeleton-line--metric-value"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!checkupData) {
    return (
      <div className={`recent-checkup-widget recent-checkup-widget--empty ${className}`}>
        <div className="empty-state">
          <div className="empty-icon">🏥</div>
          <h3>검진 데이터 없음</h3>
          <p>아직 건강검진 데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  const keyMetrics = extractKeyMetrics(checkupData);
  const overallStatus = getOverallStatus(checkupData.Code);

  return (
    <div className={`recent-checkup-widget ${className}`}>
      {/* 헤더 */}
      <div className="recent-checkup-widget__header">
        <div className="header-info">
          <h3 className="widget-title">최근 건강검진</h3>
          <div className="checkup-info">
            <span className="checkup-date">{checkupData.Year} {checkupData.CheckUpDate}</span>
            <span className="checkup-location">{checkupData.Location}</span>
          </div>
        </div>
        
        <div 
          className="overall-status"
          style={{ backgroundColor: overallStatus.color }}
        >
          {overallStatus.label}
        </div>
      </div>

      {/* 주요 지표 */}
      <div className="recent-checkup-widget__content">
        <div className="key-metrics">
          {keyMetrics.slice(0, 4).map((metric, index) => (
            <div key={index} className={`metric-item metric-item--${metric.status}`}>
              <div className="metric-name">{metric.name}</div>
              <div className="metric-value">
                {metric.value} {metric.unit}
              </div>
            </div>
          ))}
        </div>

        {/* 상세 보기 버튼 */}
        {onViewDetails && (
          <button 
            className="view-details-button"
            onClick={onViewDetails}
            aria-label="검진 결과 상세 보기"
          >
            상세 보기 →
          </button>
        )}

        {/* 설명 */}
        {checkupData.Description && (
          <div className="checkup-description">
            {checkupData.Description}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentCheckupWidget;
