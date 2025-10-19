/**
 * HealthSummaryWidget - 건강 지표 요약 위젯
 * 전체 건강 상태를 한눈에 볼 수 있는 요약 정보 제공
 */
import React, { useMemo } from 'react';
import { TilkoHealthCheckupRaw } from '../../../../types/health';
import PieChart from '../../../charts/PieChart';
import { getHealthStatusDistribution } from '../../../../utils/healthDataTransformers';
import './styles.scss';

export interface HealthSummaryWidgetProps {
  healthData: TilkoHealthCheckupRaw[];
  loading?: boolean;
  onViewTrends?: () => void;
  className?: string;
}

interface HealthMetricSummary {
  name: string;
  latestValue: string;
  trend: 'improving' | 'stable' | 'worsening' | 'unknown';
  status: 'normal' | 'warning' | 'danger';
  unit: string;
}

const HealthSummaryWidget: React.FC<HealthSummaryWidgetProps> = ({
  healthData,
  loading = false,
  onViewTrends,
  className = ''
}) => {
  // 건강 상태 분포 계산
  const statusDistribution = useMemo(() => {
    if (!healthData.length) return [];
    
    const statusCounts = { '정상': 0, '주의': 0, '위험': 0 };
    
    healthData.forEach(checkup => {
      switch (checkup.Code) {
        case '정상':
          statusCounts['정상']++;
          break;
        case '의심':
        case '질환의심':
          statusCounts['주의']++;
          break;
        case '질환':
        case '이상':
          statusCounts['위험']++;
          break;
      }
    });

    const total = healthData.length;
    return Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        id: status,
        label: status,
        value: count,
        percentage: (count / total) * 100,
        color: status === '정상' 
          ? 'var(--color-success)' 
          : status === '주의' 
          ? 'var(--color-warning)' 
          : 'var(--color-danger)'
      }));
  }, [healthData]);

  // 주요 건강 지표 요약
  const healthMetrics = useMemo(() => {
    if (!healthData.length) return [];

    const metrics: HealthMetricSummary[] = [];
    const keyMetrics = ['공복혈당', '총콜레스테롤', '혈압(최고/최저)', '체중'];

    keyMetrics.forEach(metricName => {
      const values: { value: number; date: string }[] = [];
      
      healthData.forEach(checkup => {
        checkup.Inspections?.forEach((inspection: any) => {
          inspection.Illnesses?.forEach((illness: any) => {
            illness.Items?.forEach((item: any) => {
              if (item.Name === metricName) {
                const numValue = parseFloat(item.Value);
                if (!isNaN(numValue)) {
                  values.push({
                    value: numValue,
                    date: `${checkup.Year} ${checkup.CheckUpDate}`
                  });
                }
              }
            });
          });
        });
      });

      if (values.length > 0) {
        // 날짜순 정렬
        values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const latest = values[values.length - 1];
        const trend = values.length > 1 ? getTrend(values) : 'unknown';
        const status = getMetricStatus(metricName, latest.value);

        metrics.push({
          name: metricName,
          latestValue: latest.value.toString(),
          trend,
          status,
          unit: getMetricUnit(metricName)
        });
      }
    });

    return metrics;
  }, [healthData]);

  // 추세 계산
  const getTrend = (values: { value: number; date: string }[]): 'improving' | 'stable' | 'worsening' | 'unknown' => {
    if (values.length < 2) return 'unknown';
    
    const recent = values.slice(-3); // 최근 3개 값
    const trend = recent[recent.length - 1].value - recent[0].value;
    const threshold = recent[0].value * 0.05; // 5% 변화 기준
    
    if (Math.abs(trend) < threshold) return 'stable';
    return trend > 0 ? 'worsening' : 'improving';
  };

  // 지표별 상태 판정
  const getMetricStatus = (name: string, value: number): 'normal' | 'warning' | 'danger' => {
    switch (name) {
      case '공복혈당':
        if (value < 100) return 'normal';
        if (value < 126) return 'warning';
        return 'danger';
      case '총콜레스테롤':
        if (value < 200) return 'normal';
        if (value < 240) return 'warning';
        return 'danger';
      case '혈압(최고/최저)':
        if (value < 120) return 'normal';
        if (value < 140) return 'warning';
        return 'danger';
      default:
        return 'normal';
    }
  };

  // 지표별 단위
  const getMetricUnit = (name: string): string => {
    switch (name) {
      case '공복혈당':
        return 'mg/dL';
      case '총콜레스테롤':
        return 'mg/dL';
      case '혈압(최고/최저)':
        return 'mmHg';
      case '체중':
        return 'kg';
      default:
        return '';
    }
  };

  // 추세 아이콘
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '↗';
      case 'worsening':
        return '↘';
      case 'stable':
        return '→';
      default:
        return '?';
    }
  };

  // 추세 색상
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'var(--color-success)';
      case 'worsening':
        return 'var(--color-danger)';
      case 'stable':
        return 'var(--color-gray-500)';
      default:
        return 'var(--color-text-secondary)';
    }
  };

  if (loading) {
    return (
      <div className={`health-summary-widget health-summary-widget--loading ${className}`}>
        <div className="widget-header">
          <div className="skeleton-line skeleton-line--title"></div>
        </div>
        <div className="widget-content">
          <div className="chart-skeleton">
            <div className="skeleton-circle"></div>
          </div>
          <div className="metrics-skeleton">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="metric-skeleton">
                <div className="skeleton-line skeleton-line--metric"></div>
                <div className="skeleton-line skeleton-line--value"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!healthData.length) {
    return (
      <div className={`health-summary-widget health-summary-widget--empty ${className}`}>
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>건강 데이터 없음</h3>
          <p>건강 요약을 보려면 먼저 건강검진 데이터를 연동해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`health-summary-widget ${className}`}>
      {/* 헤더 */}
      <div className="widget-header">
        <h3 className="widget-title">건강 상태 요약</h3>
        <div className="summary-stats">
          <span className="total-checkups">총 {healthData.length}회 검진</span>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="widget-content">
        {/* 상태 분포 차트 */}
        <div className="status-chart">
          <PieChart
            data={statusDistribution}
            height={180}
            showLabels={false}
            innerRadius={40}
            title="검진 결과 분포"
          />
        </div>

        {/* 주요 지표 */}
        <div className="key-metrics">
          {healthMetrics.map((metric, index) => (
            <div key={index} className={`metric-summary metric-summary--${metric.status}`}>
              <div className="metric-header">
                <span className="metric-name">{metric.name}</span>
                <div 
                  className="metric-trend"
                  style={{ color: getTrendColor(metric.trend) }}
                >
                  {getTrendIcon(metric.trend)}
                </div>
              </div>
              <div className="metric-value">
                {metric.latestValue} {metric.unit}
              </div>
            </div>
          ))}
        </div>

        {/* 액션 버튼 */}
        {onViewTrends && (
          <button 
            className="view-trends-button"
            onClick={onViewTrends}
            aria-label="건강 추이 상세 보기"
          >
            추이 분석 보기 →
          </button>
        )}
      </div>
    </div>
  );
};

export default HealthSummaryWidget;
