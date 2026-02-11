/**
 * HealthComparison - 건강 데이터 비교 페이지
 * 기간별, 검진별 건강 데이터 비교 분석 도구
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalSessionDetection from '../../../hooks/useGlobalSessionDetection';
import BarChart from '../../../components/charts/BarChart';
import LineChart from '../../../components/charts/LineChart';
import { TilkoHealthCheckupRaw } from '../../../types/health';
import './styles.scss';

interface ComparisonPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface ComparisonMetric {
  id: string;
  name: string;
  unit: string;
  normalRange?: { min: number; max: number };
}

const HealthComparison: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // 전역 세션 감지
  useGlobalSessionDetection({ enabled: true });
  const [healthData, setHealthData] = useState<TilkoHealthCheckupRaw[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('공복혈당');
  const [comparisonType, setComparisonType] = useState<'period' | 'hospital' | 'year'>('period');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);

  // 비교 가능한 지표들
  const availableMetrics: ComparisonMetric[] = [
    { id: '공복혈당', name: '공복혈당', unit: 'mg/dL', normalRange: { min: 70, max: 100 } },
    { id: '총콜레스테롤', name: '총콜레스테롤', unit: 'mg/dL', normalRange: { min: 0, max: 200 } },
    { id: '혈압(최고/최저)', name: '수축기혈압', unit: 'mmHg', normalRange: { min: 90, max: 120 } },
    { id: '체중', name: '체중', unit: 'kg' },
    { id: '신장', name: '신장', unit: 'cm' },
    { id: 'HDL콜레스테롤', name: 'HDL콜레스테롤', unit: 'mg/dL', normalRange: { min: 40, max: 999 } },
    { id: 'LDL콜레스테롤', name: 'LDL콜레스테롤', unit: 'mg/dL', normalRange: { min: 0, max: 130 } },
    { id: '중성지방', name: '중성지방', unit: 'mg/dL', normalRange: { min: 0, max: 150 } }
  ];

  // 데이터 로드
  useEffect(() => {
    const loadHealthData = () => {
      try {
        const storedData = localStorage.getItem('welno_health_data');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          const healthList = parsedData.health_data?.ResultList || [];
          setHealthData(healthList);
        }
      } catch (error) {
        console.error('건강 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHealthData();
  }, []);

  // 사용 가능한 연도들
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    healthData.forEach(checkup => {
      const year = checkup.Year.replace('년', '');
      years.add(year);
    });
    return Array.from(years).sort();
  }, [healthData]);

  // 사용 가능한 병원들
  const availableHospitals = useMemo(() => {
    const hospitals = new Set<string>();
    healthData.forEach(checkup => {
      if (checkup.Location) {
        hospitals.add(checkup.Location);
      }
    });
    return Array.from(hospitals);
  }, [healthData]);

  // 기간별 비교 데이터 생성
  const periodComparisonData = useMemo(() => {
    if (comparisonType !== 'period' || selectedPeriods.length === 0) return [];

    const periods = selectedPeriods.map(periodId => {
      const [startYear, endYear] = periodId.split('-');
      return {
        id: periodId,
        label: `${startYear}-${endYear}`,
        data: healthData.filter(checkup => {
          const year = parseInt(checkup.Year.replace('년', ''));
          return year >= parseInt(startYear) && year <= parseInt(endYear);
        })
      };
    });

    return periods.map(period => {
      const values: number[] = [];
      
      period.data.forEach(checkup => {
        checkup.Inspections?.forEach((inspection: any) => {
          inspection.Illnesses?.forEach((illness: any) => {
            illness.Items?.forEach((item: any) => {
              if (item.Name === selectedMetric) {
                const value = parseFloat(item.Value);
                if (!isNaN(value)) {
                  values.push(value);
                }
              }
            });
          });
        });
      });

      const avgValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      
      return {
        category: period.label,
        value: Math.round(avgValue * 100) / 100,
        label: `${Math.round(avgValue * 100) / 100}`,
        status: getValueStatus(selectedMetric, avgValue),
        meta: { count: values.length, values }
      };
    });
  }, [comparisonType, selectedPeriods, healthData, selectedMetric]);

  // 병원별 비교 데이터 생성
  const hospitalComparisonData = useMemo(() => {
    if (comparisonType !== 'hospital' || selectedHospitals.length === 0) return [];

    return selectedHospitals.map(hospital => {
      const hospitalData = healthData.filter(checkup => checkup.Location === hospital);
      const values: number[] = [];
      
      hospitalData.forEach(checkup => {
        checkup.Inspections?.forEach((inspection: any) => {
          inspection.Illnesses?.forEach((illness: any) => {
            illness.Items?.forEach((item: any) => {
              if (item.Name === selectedMetric) {
                const value = parseFloat(item.Value);
                if (!isNaN(value)) {
                  values.push(value);
                }
              }
            });
          });
        });
      });

      const avgValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      
      return {
        category: hospital,
        value: Math.round(avgValue * 100) / 100,
        label: `${Math.round(avgValue * 100) / 100}`,
        status: getValueStatus(selectedMetric, avgValue),
        meta: { count: values.length, values }
      };
    });
  }, [comparisonType, selectedHospitals, healthData, selectedMetric]);

  // 연도별 비교 데이터 생성
  const yearComparisonData = useMemo(() => {
    if (comparisonType !== 'year' || selectedYears.length === 0) return [];

    return selectedYears.map(year => {
      const yearData = healthData.filter(checkup => checkup.Year.replace('년', '') === year);
      const values: number[] = [];
      
      yearData.forEach(checkup => {
        checkup.Inspections?.forEach((inspection: any) => {
          inspection.Illnesses?.forEach((illness: any) => {
            illness.Items?.forEach((item: any) => {
              if (item.Name === selectedMetric) {
                const value = parseFloat(item.Value);
                if (!isNaN(value)) {
                  values.push(value);
                }
              }
            });
          });
        });
      });

      const avgValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      
      return {
        category: `${year}년`,
        value: Math.round(avgValue * 100) / 100,
        label: `${Math.round(avgValue * 100) / 100}`,
        status: getValueStatus(selectedMetric, avgValue),
        meta: { count: values.length, values }
      };
    }).sort((a, b) => parseInt(a.category) - parseInt(b.category));
  }, [comparisonType, selectedYears, healthData, selectedMetric]);

  // 값의 상태 판정
  const getValueStatus = (metricName: string, value: number): 'normal' | 'warning' | 'danger' => {
    const metric = availableMetrics.find(m => m.id === metricName);
    if (!metric?.normalRange) return 'normal';

    if (value >= metric.normalRange.min && value <= metric.normalRange.max) {
      return 'normal';
    } else if (value > metric.normalRange.max * 1.2 || value < metric.normalRange.min * 0.8) {
      return 'danger';
    } else {
      return 'warning';
    }
  };

  // 현재 비교 데이터
  const currentComparisonData = useMemo(() => {
    switch (comparisonType) {
      case 'period':
        return periodComparisonData;
      case 'hospital':
        return hospitalComparisonData;
      case 'year':
        return yearComparisonData;
      default:
        return [];
    }
  }, [comparisonType, periodComparisonData, hospitalComparisonData, yearComparisonData]);

  // 차트 데이터 생성
  const chartData = useMemo(() => {
    if (currentComparisonData.length === 0) return [];

    const selectedMetricInfo = availableMetrics.find(m => m.id === selectedMetric);
    
    return [{
      id: 'comparison',
      name: selectedMetricInfo?.name || selectedMetric,
      data: currentComparisonData.map(item => ({
        label: item.category,
        value: item.value,
        status: item.status,
        unit: selectedMetricInfo?.unit,
        metadata: item.meta
      })),
      color: 'var(--color-primary)',
      unit: selectedMetricInfo?.unit
    }];
  }, [currentComparisonData, selectedMetric, availableMetrics]);

  // 기간 선택 핸들러
  const handlePeriodToggle = (periodId: string) => {
    setSelectedPeriods(prev => 
      prev.includes(periodId) 
        ? prev.filter(id => id !== periodId)
        : [...prev, periodId]
    );
  };

  // 병원 선택 핸들러
  const handleHospitalToggle = (hospital: string) => {
    setSelectedHospitals(prev => 
      prev.includes(hospital) 
        ? prev.filter(h => h !== hospital)
        : [...prev, hospital]
    );
  };

  // 연도 선택 핸들러
  const handleYearToggle = (year: string) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };

  if (loading) {
    return (
      <div className="health-comparison health-comparison--loading">
        <div className="health-comparison__loading">
          <div className="loading-spinner" />
          <p>건강 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!healthData.length) {
    return (
      <div className="health-comparison health-comparison--empty">
        <div className="health-comparison__empty">
          <div className="empty-icon">📊</div>
          <h2>건강 데이터가 없습니다</h2>
          <p>먼저 건강정보를 연동하여 데이터를 가져와주세요.</p>
          <button 
            className="welno-button welno-button-primary"
            onClick={() => navigate('/login')}
          >
            건강정보 연동하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="health-comparison">
      {/* 헤더 */}
      <div className="health-comparison__header">
        <div className="health-comparison__title">
          <button 
            className="back-button"
            onClick={() => navigate(-1)}
          >
            ← 뒤로
          </button>
          <h1>건강 데이터 비교</h1>
          <p>기간별, 병원별, 연도별 건강 지표를 비교 분석합니다</p>
        </div>
      </div>

      {/* 컨트롤 패널 */}
      <div className="health-comparison__controls">
        {/* 지표 선택 */}
        <div className="control-group">
          <label className="control-label">비교할 지표</label>
          <select
            className="control-select"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            {availableMetrics.map(metric => (
              <option key={metric.id} value={metric.id}>
                {metric.name} ({metric.unit})
              </option>
            ))}
          </select>
        </div>

        {/* 비교 유형 선택 */}
        <div className="control-group">
          <label className="control-label">비교 유형</label>
          <div className="comparison-type-buttons">
            <button
              className={`type-button ${comparisonType === 'period' ? 'active' : ''}`}
              onClick={() => setComparisonType('period')}
            >
              기간별
            </button>
            <button
              className={`type-button ${comparisonType === 'hospital' ? 'active' : ''}`}
              onClick={() => setComparisonType('hospital')}
            >
              병원별
            </button>
            <button
              className={`type-button ${comparisonType === 'year' ? 'active' : ''}`}
              onClick={() => setComparisonType('year')}
            >
              연도별
            </button>
          </div>
        </div>

        {/* 선택 옵션 */}
        <div className="control-group">
          <label className="control-label">
            {comparisonType === 'period' && '비교할 기간'}
            {comparisonType === 'hospital' && '비교할 병원'}
            {comparisonType === 'year' && '비교할 연도'}
          </label>
          
          {comparisonType === 'period' && (
            <div className="selection-options">
              {[
                { id: '2020-2021', label: '2020-2021년' },
                { id: '2022-2023', label: '2022-2023년' },
                { id: '2024-2024', label: '2024년' }
              ].map(period => (
                <button
                  key={period.id}
                  className={`option-button ${selectedPeriods.includes(period.id) ? 'selected' : ''}`}
                  onClick={() => handlePeriodToggle(period.id)}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}

          {comparisonType === 'hospital' && (
            <div className="selection-options">
              {availableHospitals.map(hospital => (
                <button
                  key={hospital}
                  className={`option-button ${selectedHospitals.includes(hospital) ? 'selected' : ''}`}
                  onClick={() => handleHospitalToggle(hospital)}
                >
                  {hospital}
                </button>
              ))}
            </div>
          )}

          {comparisonType === 'year' && (
            <div className="selection-options">
              {availableYears.map(year => (
                <button
                  key={year}
                  className={`option-button ${selectedYears.includes(year) ? 'selected' : ''}`}
                  onClick={() => handleYearToggle(year)}
                >
                  {year}년
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 비교 결과 */}
      <div className="health-comparison__results">
        {currentComparisonData.length > 0 ? (
          <>
            {/* 차트 */}
            <div className="comparison-chart">
            <BarChart
              series={chartData}
              title={`${availableMetrics.find(m => m.id === selectedMetric)?.name} 비교`}
              subtitle={`${comparisonType === 'period' ? '기간별' : comparisonType === 'hospital' ? '병원별' : '연도별'} 평균값 비교`}
              height={400}
              orientation="vertical"
              showValues={true}
              yAxisLabel={availableMetrics.find(m => m.id === selectedMetric)?.unit}
              valueFormat={(value) => `${value}${availableMetrics.find(m => m.id === selectedMetric)?.unit}`}
            />
            </div>

            {/* 상세 분석 */}
            <div className="comparison-analysis">
              <h3>비교 분석 결과</h3>
              <div className="analysis-grid">
                {currentComparisonData.map((item, index) => (
                  <div key={index} className={`analysis-item analysis-item--${item.status}`}>
                    <div className="analysis-header">
                      <h4>{item.category}</h4>
                      <span className={`status-badge status-badge--${item.status}`}>
                        {item.status === 'normal' ? '정상' : item.status === 'warning' ? '주의' : '위험'}
                      </span>
                    </div>
                    <div className="analysis-value">
                      {item.value} {availableMetrics.find(m => m.id === selectedMetric)?.unit}
                    </div>
                    <div className="analysis-meta">
                      검진 {item.meta.count}회 평균
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="no-comparison-data">
            <div className="no-data-icon">📈</div>
            <h3>비교할 데이터를 선택해주세요</h3>
            <p>위에서 비교하고 싶은 {comparisonType === 'period' ? '기간' : comparisonType === 'hospital' ? '병원' : '연도'}을 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthComparison;
