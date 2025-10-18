/**
 * HealthTrends - 건강 추이 분석 페이지
 * 시계열 데이터 기반 건강 상태 변화 추적
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import FilterSection from '../../components/health/FilterSection';
import { 
  transformHealthDataForLineChart,
  transformHealthDataForBarChart,
  extractNumericValue
} from '../../utils/healthDataTransformers';
import { TilkoHealthCheckupRaw, FilterState } from '../../types/health';
import './styles.scss';

interface TrendAnalysis {
  metric: string;
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
  recommendation: string;
}

const HealthTrends: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<TilkoHealthCheckupRaw[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['공복혈당', '총콜레스테롤', '혈압(최고/최저)']);
  const [filters, setFilters] = useState<FilterState>({
    year: new Date().getFullYear(),
    category: 'all',
    searchTerm: '',
    hospitalName: ''
  });

  // 사용 가능한 지표 목록
  const availableMetrics = [
    '신장', '체중', '허리둘레', '체질량지수',
    '혈압(최고/최저)', '공복혈당', '총콜레스테롤',
    '고밀도(HDL) 콜레스테롤', '저밀도(LDL) 콜레스테롤',
    '중성지방', '혈색소', '혈청크레아티닌'
  ];

  // 데이터 로드
  useEffect(() => {
    const loadHealthData = () => {
      try {
        const storedData = localStorage.getItem('wello_health_data');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          const healthCheckups = parsedData.health_data?.ResultList || [];
          setHealthData(healthCheckups);
        }
      } catch (error) {
        console.error('건강 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHealthData();
  }, []);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    return healthData.filter(checkup => {
      if (filters.year && filters.year > 0) {
        const checkupYear = parseInt(checkup.Year.replace('년', ''));
        if (checkupYear !== filters.year) return false;
      }

      if (filters.hospitalName) {
        if (!checkup.Location.toLowerCase().includes(filters.hospitalName.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [healthData, filters]);

  // 차트 데이터 생성
  const lineChartData = useMemo(() => {
    if (!filteredData.length) return [];
    
    const allSeries = transformHealthDataForLineChart(filteredData);
    return allSeries.filter(series => selectedMetrics.includes(series.name));
  }, [filteredData, selectedMetrics]);

  const barChartData = useMemo(() => {
    if (!filteredData.length) return [];
    
    return transformHealthDataForBarChart(filteredData, selectedMetrics);
  }, [filteredData, selectedMetrics]);

  // 추이 분석
  const trendAnalysis = useMemo((): TrendAnalysis[] => {
    if (!filteredData.length || filteredData.length < 2) return [];

    const analyses: TrendAnalysis[] = [];

    selectedMetrics.forEach(metric => {
      const metricData: { date: string; value: number }[] = [];

      filteredData.forEach(checkup => {
        checkup.Inspections.forEach(inspection => {
          inspection.Illnesses.forEach(illness => {
            illness.Items.forEach(item => {
              if (item.Name === metric) {
                const value = extractNumericValue(item.Value);
                if (value > 0) {
                  metricData.push({
                    date: `${checkup.Year} ${checkup.CheckUpDate}`,
                    value
                  });
                }
              }
            });
          });
        });
      });

      if (metricData.length >= 2) {
        // 시간순 정렬
        metricData.sort((a, b) => new Date(a.date.replace('년', '').replace('/', '-')).getTime() - new Date(b.date.replace('년', '').replace('/', '-')).getTime());
        
        const firstValue = metricData[0].value;
        const lastValue = metricData[metricData.length - 1].value;
        const changePercent = ((lastValue - firstValue) / firstValue) * 100;

        let trend: 'improving' | 'stable' | 'declining';
        let recommendation: string;

        // 지표별 개선/악화 판단 (예시)
        const improvingMetrics = ['고밀도(HDL) 콜레스테롤'];
        const decliningMetrics = ['공복혈당', '총콜레스테롤', '저밀도(LDL) 콜레스테롤', '중성지방', '혈압(최고/최저)'];

        if (Math.abs(changePercent) < 5) {
          trend = 'stable';
          recommendation = `${metric} 수치가 안정적으로 유지되고 있습니다.`;
        } else if (changePercent > 0) {
          if (improvingMetrics.includes(metric)) {
            trend = 'improving';
            recommendation = `${metric} 수치가 개선되고 있습니다. 현재 생활습관을 유지하세요.`;
          } else if (decliningMetrics.includes(metric)) {
            trend = 'declining';
            recommendation = `${metric} 수치가 상승하고 있습니다. 식단과 운동을 점검해보세요.`;
          } else {
            trend = 'stable';
            recommendation = `${metric} 수치 변화를 지속적으로 관찰하세요.`;
          }
        } else {
          if (improvingMetrics.includes(metric)) {
            trend = 'declining';
            recommendation = `${metric} 수치가 감소하고 있습니다. 전문의와 상담을 권합니다.`;
          } else if (decliningMetrics.includes(metric)) {
            trend = 'improving';
            recommendation = `${metric} 수치가 개선되고 있습니다. 좋은 추세입니다.`;
          } else {
            trend = 'stable';
            recommendation = `${metric} 수치 변화를 지속적으로 관찰하세요.`;
          }
        }

        analyses.push({
          metric,
          trend,
          changePercent,
          recommendation
        });
      }
    });

    return analyses;
  }, [filteredData, selectedMetrics]);

  if (loading) {
    return (
      <div className="health-trends health-trends--loading">
        <div className="health-trends__loading">
          <div className="loading-spinner" />
          <p>건강 추이를 분석하는 중...</p>
        </div>
      </div>
    );
  }

  if (!healthData.length) {
    return (
      <div className="health-trends health-trends--empty">
        <div className="health-trends__empty">
          <div className="empty-icon"></div>
          <h2>건강 데이터가 없습니다</h2>
          <p>추이 분석을 위해서는 최소 2회 이상의 검진 데이터가 필요합니다.</p>
          <button 
            className="wello-button wello-button-primary"
            onClick={() => navigate('/wello/login')}
          >
            건강정보 연동하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="health-trends">
      {/* 헤더 */}
      <div className="health-trends__header">
        <div className="health-trends__title">
          <button 
            className="back-button"
            onClick={() => navigate(-1)}
          >
            ← 뒤로
          </button>
          <h1>건강 추이 분석</h1>
          <p>시간에 따른 건강 상태 변화를 분석합니다</p>
        </div>
      </div>

      {/* 필터 및 지표 선택 */}
      <div className="health-trends__controls">
        <div className="health-trends__filters">
          <FilterSection
            filters={filters}
            onFilterChange={(newFilters) => setFilters({ ...filters, ...newFilters })}
            type="checkup"
          />
        </div>

        <div className="health-trends__metrics">
          <h3>분석할 지표 선택</h3>
          <div className="metric-selector">
            {availableMetrics.map(metric => (
              <label key={metric} className="metric-checkbox">
                <input
                  type="checkbox"
                  checked={selectedMetrics.includes(metric)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMetrics([...selectedMetrics, metric]);
                    } else {
                      setSelectedMetrics(selectedMetrics.filter(m => m !== metric));
                    }
                  }}
                />
                <span className="metric-checkbox__label">{metric}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 추이 분석 결과 */}
      {trendAnalysis.length > 0 && (
        <div className="health-trends__analysis">
          <h3>추이 분석 결과</h3>
          <div className="trend-cards">
            {trendAnalysis.map((analysis, index) => (
              <div key={index} className={`trend-card trend-card--${analysis.trend}`}>
                <div className="trend-card__header">
                  <h4>{analysis.metric}</h4>
                  <div className={`trend-indicator trend-indicator--${analysis.trend}`}>
                    {analysis.trend === 'improving' && '↗'}
                    {analysis.trend === 'stable' && '→'}
                    {analysis.trend === 'declining' && '↘'}
                    <span>{Math.abs(analysis.changePercent).toFixed(1)}%</span>
                  </div>
                </div>
                <p className="trend-card__recommendation">{analysis.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 차트 */}
      <div className="health-trends__charts">
        {/* 시계열 추이 차트 */}
        {lineChartData.length > 0 && (
          <div className="chart-section">
            <LineChart
              title="건강 수치 시계열 추이"
              subtitle="선택한 지표들의 시간별 변화"
              series={lineChartData}
              height={400}
              showGrid={true}
              showReferenceLines={true}
              xAxisLabel="검진 날짜"
              yAxisLabel="수치"
              onPointHover={(point, series) => {
                console.log('포인트 호버:', point, series);
              }}
            />
          </div>
        )}

        {/* 비교 바 차트 */}
        {barChartData.length > 0 && (
          <div className="chart-section">
            <BarChart
              title="지표별 수치 비교"
              subtitle="연도별 또는 검진별 비교"
              series={barChartData}
              height={350}
              orientation="vertical"
              showValues={true}
              showReferenceLines={true}
              xAxisLabel="기간"
              yAxisLabel="수치"
              onBarClick={(point, series) => {
                console.log('바 클릭:', point, series);
              }}
            />
          </div>
        )}
      </div>

      {/* 건강 관리 팁 */}
      <div className="health-trends__tips">
        <h3>건강 관리 팁</h3>
        <div className="tip-cards">
          <div className="tip-card">
            <div className="tip-card__icon tip-card__icon--diet"></div>
            <div className="tip-card__content">
              <h4>균형잡힌 식단</h4>
              <p>규칙적인 식사와 영양소 균형을 맞춘 식단으로 건강한 수치를 유지하세요.</p>
            </div>
          </div>
          
          <div className="tip-card">
            <div className="tip-card__icon tip-card__icon--exercise"></div>
            <div className="tip-card__content">
              <h4>꾸준한 운동</h4>
              <p>주 3회 이상 30분씩 유산소 운동을 통해 심혈관 건강을 개선하세요.</p>
            </div>
          </div>
          
          <div className="tip-card">
            <div className="tip-card__icon tip-card__icon--checkup"></div>
            <div className="tip-card__content">
              <h4>정기 검진</h4>
              <p>연 1회 이상 정기 건강검진으로 건강 상태를 지속적으로 모니터링하세요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthTrends;
