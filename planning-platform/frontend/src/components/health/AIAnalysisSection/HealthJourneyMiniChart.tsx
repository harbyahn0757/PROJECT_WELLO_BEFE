/**
 * HealthJourneyMiniChart - AI 분석 섹션용 미니 차트 컴포넌트
 * TrendsSection의 차트 로직을 재활용하여 건강 여정에서 사용
 */
import React, { useMemo } from 'react';
import LineChart, { LineChartSeries, LineChartDataPoint } from '../../charts/LineChart';
import { TilkoHealthCheckupRaw } from '../../../types/health';

interface HealthJourneyMiniChartProps {
  healthData: TilkoHealthCheckupRaw[];
  metric: string;
  title: string;
  unit?: string;
  motivationalMessage?: string;
  className?: string;
}

// 지표별 필드명 매핑 (TrendsSection에서 추출)
const getFieldNameForMetric = (metric: string): string => {
  const fieldMap: { [key: string]: string } = {
    '체질량지수': 'BMI',
    'BMI': 'BMI',
    '허리둘레': '허리둘레',
    '공복혈당': '공복혈당',
    '수축기혈압': '수축기혈압',
    '이완기혈압': '이완기혈압',
    '총콜레스테롤': '총콜레스테롤',
    '중성지방': '중성지방',
    '헤모글로빈': '헤모글로빈',
    '체중': '체중'
  };
  return fieldMap[metric] || metric;
};

// 건강검진 데이터에서 특정 지표 값 추출 (TrendsSection에서 추출)
const getValueFromHealthData = (healthDataItem: any, metric: string): number => {
  try {
    const fieldName = getFieldNameForMetric(metric);
    
    // Inspections에서 검색 (TilkoHealthCheckupRaw 구조)
    if (healthDataItem.Inspections && Array.isArray(healthDataItem.Inspections)) {
      for (const inspection of healthDataItem.Inspections) {
        if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
          for (const illness of inspection.Illnesses) {
            if (illness.Items && Array.isArray(illness.Items)) {
              for (const item of illness.Items) {
                if (item.Name === fieldName && item.Value) {
                  const value = parseFloat(item.Value);
                  if (!isNaN(value) && isFinite(value)) {
                    return value;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return 0;
  } catch (error) {
    console.warn(`[HealthJourneyMiniChart] ${metric} 값 추출 실패:`, error);
    return 0;
  }
};

const HealthJourneyMiniChart: React.FC<HealthJourneyMiniChartProps> = ({
  healthData,
  metric,
  title,
  unit = '',
  motivationalMessage,
  className = ''
}) => {
  // 차트 데이터 생성
  const chartData = useMemo(() => {
    if (!healthData || healthData.length === 0) {
      return [];
    }

    // 년도별 데이터 그룹화 및 정렬
    const yearlyData = healthData
      .map(item => {
        const value = getValueFromHealthData(item, metric);
        const date = item.CheckUpDate || '';
        const year = date ? new Date(date).getFullYear() : 0;
        
        return {
          year,
          value,
          date,
          originalItem: item
        };
      })
      .filter(item => item.year > 0 && item.value > 0)
      .sort((a, b) => a.year - b.year);

    // 년도별 평균값 계산
    const yearlyAverages = yearlyData.reduce((acc, item) => {
      if (!acc[item.year]) {
        acc[item.year] = { sum: 0, count: 0, dates: [] };
      }
      acc[item.year].sum += item.value;
      acc[item.year].count += 1;
      acc[item.year].dates.push(item.date);
      return acc;
    }, {} as { [year: number]: { sum: number; count: number; dates: string[] } });

    // LineChart 데이터 포인트 생성
    const dataPoints: LineChartDataPoint[] = Object.entries(yearlyAverages)
      .map(([year, data]) => ({
        date: `${year}-01-01`, // 년도 기준으로 표시
        value: Math.round((data.sum / data.count) * 10) / 10, // 소수점 1자리
        label: `${year}년`
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return dataPoints;
  }, [healthData, metric]);

  // LineChart 시리즈 구성
  const chartSeries: LineChartSeries[] = useMemo(() => {
    if (chartData.length === 0) {
      return [];
    }

    return [{
      id: `metric-${metric}`,
      name: title,
      data: chartData,
      color: '#7c746a', // WELLO 브랜드 컬러
      showPoints: true,
      showArea: false,
      unit
    }];
  }, [chartData, metric, title, unit]);

  // 트렌드 분석
  const trendAnalysis = useMemo(() => {
    if (chartData.length < 2) {
      return { trend: 'stable', change: 0, message: '' };
    }

    const firstValue = chartData[0].value;
    const lastValue = chartData[chartData.length - 1].value;
    const change = lastValue - firstValue;
    const changePercent = Math.round((change / firstValue) * 100);

    let trend: 'improved' | 'worsened' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) {
      // BMI, 혈당 등은 감소가 개선
      if (['체질량지수', 'BMI', '공복혈당', '총콜레스테롤', '중성지방'].includes(metric)) {
        trend = change < 0 ? 'improved' : 'worsened';
      } else {
        // 일반적으로는 증가가 개선 (예: 헤모글로빈)
        trend = change > 0 ? 'improved' : 'worsened';
      }
    }

    return { trend, change: changePercent, message: motivationalMessage || '' };
  }, [chartData, metric, motivationalMessage]);

  if (chartData.length === 0) {
    return (
      <div className={`health-journey-mini-chart ${className}`}>
        <div className="chart-header">
          <h5 className="chart-title">{title}</h5>
        </div>
        <div className="chart-empty">
          <p>데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`health-journey-mini-chart ${className}`}>
      <div className="chart-header">
        <h5 className="chart-title">{title}</h5>
        <div className={`trend-indicator ${trendAnalysis.trend}`}>
          {trendAnalysis.trend === 'improved' && '📈 개선'}
          {trendAnalysis.trend === 'worsened' && '📉 주의'}
          {trendAnalysis.trend === 'stable' && '➡️ 안정'}
          <span className="change-percent">
            {trendAnalysis.change > 0 ? '+' : ''}{trendAnalysis.change}%
          </span>
        </div>
      </div>
      
      <div className="chart-container">
        <LineChart
          series={chartSeries}
          width={280}
          height={120}
          showGrid={true}
          showReferenceLines={false}
          dateFormat="short"
          valueFormat={(value) => `${value}${unit}`}
        />
      </div>
      
      {trendAnalysis.message && (
        <div className="motivational-message">
          <p>{trendAnalysis.message}</p>
        </div>
      )}
      
      <div className="chart-summary">
        <div className="summary-stats">
          <span className="first-value">
            {chartData[0].label}: {chartData[0].value}{unit}
          </span>
          <span className="arrow">→</span>
          <span className="last-value">
            {chartData[chartData.length - 1].label}: {chartData[chartData.length - 1].value}{unit}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HealthJourneyMiniChart;
