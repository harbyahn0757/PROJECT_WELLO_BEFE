/**
 * TrendsSection - 건강지표 추이 분석 컴포넌트
 * ComprehensiveAnalysisPage에서 추출한 추이 섹션
 */
import React, { useState, useEffect } from 'react';
import { TilkoHealthCheckupRaw, TilkoPrescriptionRaw } from '../../../types/health';
import '../../../pages/ComprehensiveAnalysisPage/styles.scss';

interface TrendsSectionProps {
  healthData: TilkoHealthCheckupRaw[];
  prescriptionData: TilkoPrescriptionRaw[];
  filterMode: 'all' | 'checkup' | 'pharmacy' | 'treatment';
  isLoading?: boolean;
}

const TrendsSection: React.FC<TrendsSectionProps> = ({
  healthData,
  prescriptionData,
  filterMode,
  isLoading = false
}) => {
  // 건강 지표 슬라이더 상태
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const [activeVisitDotIndex, setActiveVisitDotIndex] = useState(0);
  const [isLoadingVisitData, setIsLoadingVisitData] = useState(true);
  
  // 건강 지표 목록
  const healthMetrics = [
    '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)', 
    '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤', 
    'LDL 콜레스테롤', '중성지방', '헤모글로빈'
  ];

  // 헬퍼 함수들 (ComprehensiveAnalysisPage에서 복사)
  const getFieldNameForMetric = (metric: string): string => {
    switch (metric) {
      case '신장': return 'height';
      case '체중': return 'weight';
      case 'BMI': return 'bmi';
      case '허리둘레': return 'waist_circumference';
      case '혈압 (수축기)': return 'blood_pressure_high';
      case '혈압 (이완기)': return 'blood_pressure_low';
      case '혈당': return 'blood_sugar';
      case '총콜레스테롤': return 'cholesterol';
      case 'HDL 콜레스테롤': return 'hdl_cholesterol';
      case 'LDL 콜레스테롤': return 'ldl_cholesterol';
      case '중성지방': return 'triglyceride';
      case '헤모글로빈': return 'hemoglobin';
      default: return 'blood_pressure_high';
    }
  };
  
  const getUnitForMetric = (metric: string): string => {
    switch (metric) {
      case '신장': return 'cm';
      case '체중': return 'kg';
      case 'BMI': return 'kg/m²';
      case '허리둘레': return 'cm';
      case '혈압 (수축기)':
      case '혈압 (이완기)': return 'mmHg';
      case '혈당': return 'mg/dL';
      case '총콜레스테롤':
      case 'HDL 콜레스테롤':
      case 'LDL 콜레스테롤':
      case '중성지방': return 'mg/dL';
      case '헤모글로빈': return 'g/dL';
      default: return '';
    }
  };

  // 범위 체크 함수
  const isInRange = (value: number, rangeStr: string): boolean => {
    if (!rangeStr) return false;
    
    try {
      if (rangeStr.includes('-')) {
        const [min, max] = rangeStr.split('-').map(s => parseFloat(s.trim()));
        return !isNaN(min) && !isNaN(max) && value >= min && value <= max;
      }
      
      if (rangeStr.includes('>=')) {
        const min = parseFloat(rangeStr.replace('>=', '').trim());
        return !isNaN(min) && value >= min;
      }
      
      if (rangeStr.includes('<=')) {
        const max = parseFloat(rangeStr.replace('<=', '').trim());
        return !isNaN(max) && value <= max;
      }
      
      if (rangeStr.includes('>')) {
        const min = parseFloat(rangeStr.replace('>', '').trim());
        return !isNaN(min) && value > min;
      }
      
      if (rangeStr.includes('<')) {
        const max = parseFloat(rangeStr.replace('<', '').trim());
        return !isNaN(max) && value < max;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  };

  // 건강지표 상태 판단 함수
  const getHealthStatus = (metric: string, value: number, healthDataItem: any): { status: 'normal' | 'warning' | 'abnormal' | 'neutral', text: string, date: string } => {
    if (metric === '신장') {
      return {
        status: 'neutral',
        text: '측정',
        date: healthDataItem?.CheckUpDate || ''
      };
    }

    const rawData = healthDataItem?.raw_data;
    if (!rawData) {
      return {
        status: 'normal',
        text: '정상',
        date: healthDataItem?.CheckUpDate || ''
      };
    }

    const code = rawData.Code || '';
    let overallStatus: 'normal' | 'warning' | 'abnormal' = 'normal';
    
    if (code.includes('정상') || code === '정A') {
      overallStatus = 'normal';
    } else if (code.includes('의심') || code === '의심') {
      overallStatus = 'warning';
    } else if (code.includes('질환') || code.includes('이상')) {
      overallStatus = 'abnormal';
    }

    let itemStatus = overallStatus;
    
    if (rawData.Inspections && Array.isArray(rawData.Inspections)) {
      for (const inspection of rawData.Inspections) {
        if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
          for (const illness of inspection.Illnesses) {
            if (illness.Items && Array.isArray(illness.Items)) {
              const item = illness.Items.find((item: any) => 
                item.Name && (
                  item.Name.includes(metric.replace(' (수축기)', '').replace(' (이완기)', '')) ||
                  (metric.includes('혈압') && item.Name.includes('혈압')) ||
                  (metric.includes('콜레스테롤') && item.Name.includes('콜레스테롤')) ||
                  (metric === '중성지방' && item.Name.includes('중성지방')) ||
                  (metric === '헤모글로빈' && item.Name.includes('혈색소'))
                )
              );
              
              if (item && item.ItemReferences && Array.isArray(item.ItemReferences)) {
                const itemValue = parseFloat(item.Value);
                if (!isNaN(itemValue)) {
                  for (const ref of item.ItemReferences) {
                    if (ref.Name === '질환의심' && isInRange(itemValue, ref.Value)) {
                      itemStatus = 'abnormal';
                      break;
                    } else if ((ref.Name === '정상(B)' || ref.Name === '정상(경계)') && isInRange(itemValue, ref.Value)) {
                      itemStatus = 'warning';
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const statusText = itemStatus === 'normal' ? '정상' : 
                      itemStatus === 'warning' ? '경계' : '이상';
    
    return {
      status: itemStatus,
      text: statusText,
      date: rawData.CheckUpDate || healthDataItem?.CheckUpDate || ''
    };
  };

  // 로딩 상태
  useEffect(() => {
    setIsLoadingVisitData(true);
    const timer = setTimeout(() => setIsLoadingVisitData(false), 500);
    return () => clearTimeout(timer);
  }, [healthData, prescriptionData]);

  // 닷 슬라이더 스크롤 동기화
  useEffect(() => {
    const slider = document.querySelector('.health-metrics-slider') as HTMLElement;
    if (!slider) return;

    const handleScroll = () => {
      const cards = document.querySelectorAll('.health-metric-card');
      if (cards.length === 0) return;

      const sliderRect = slider.getBoundingClientRect();
      const contentWidth = sliderRect.width;
      const sliderCenter = sliderRect.left + contentWidth / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - sliderCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveDotIndex(closestIndex);
    };

    slider.addEventListener('scroll', handleScroll);
    return () => slider.removeEventListener('scroll', handleScroll);
  }, [healthData]);

  // 방문 추이 닷 슬라이더 스크롤 동기화
  useEffect(() => {
    const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
    if (!slider) return;

    const handleVisitScroll = () => {
      const cards = document.querySelectorAll('.visit-trend-card');
      if (cards.length === 0) return;

      const sliderRect = slider.getBoundingClientRect();
      const contentWidth = sliderRect.width;
      const sliderCenter = sliderRect.left + contentWidth / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - sliderCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveVisitDotIndex(closestIndex);
    };

    slider.addEventListener('scroll', handleVisitScroll);
    return () => slider.removeEventListener('scroll', handleVisitScroll);
  }, [prescriptionData]);

  if (isLoading) {
    return (
      <div className="trends-loading">
        <div className="loading-spinner">
          <img 
            src="/wello/wello-icon.png" 
            alt="로딩 중" 
            className="spinner-icon"
            style={{
              width: '48px',
              height: '48px',
              animation: 'faviconBlink 1.5s ease-in-out infinite'
            }}
          />
        </div>
        <p className="loading-text">건강 추이를 분석하는 중...</p>
      </div>
    );
  }

  return (
    <div className="trends-section">
      {/* 건강지표 추이 분석 카드 */}
      <section className="analysis-card">
        <div className="card-header">
          <h2 className="section-title">건강지표 추이 분석</h2>
          <div className="chart-info">
            <span className="info-text">12개 주요 지표</span>
          </div>
        </div>
        
        {/* 건강지표 컨테이너 */}
        <div className="health-metrics-wrapper">
          <div className="health-metrics-container">
            <div className="health-metrics-slider">
              {healthMetrics.map((metric, index) => {
                // 🔧 최신 건강 데이터 올바른 추출 (수정된 로직 적용)
                const getLatestHealthData = () => {
                  if (!healthData || healthData.length === 0) return null;
                  
                  const sortedData = [...healthData].sort((a, b) => {
                    const dateA = new Date(a.CheckUpDate || a.Year || '1900-01-01');
                    const dateB = new Date(b.CheckUpDate || b.Year || '1900-01-01');
                    return dateB.getTime() - dateA.getTime();
                  });
                  
                  return sortedData[0];
                };

                const getValueFromHealthData = (healthDataItem: any, metric: string): number => {
                  if (!healthDataItem) return 0;
                  
                  if (healthDataItem.raw_data?.Inspections) {
                    for (const inspection of healthDataItem.raw_data.Inspections) {
                      if (inspection.Illnesses) {
                        for (const illness of inspection.Illnesses) {
                          if (illness.Items) {
                            const item = illness.Items.find((item: any) => {
                              if (!item.Name) return false;
                              const itemName = item.Name.toLowerCase();
                              const metricName = metric.toLowerCase().replace(' (수축기)', '').replace(' (이완기)', '');
                              
                              return itemName.includes(metricName) ||
                                     (metric.includes('혈압') && itemName.includes('혈압')) ||
                                     (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                                     (metric === '중성지방' && itemName.includes('중성지방')) ||
                                     (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                            });
                            
                            if (item && item.Value) {
                              const value = parseFloat(item.Value);
                              return isNaN(value) ? 0 : value;
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  const fieldName = getFieldNameForMetric(metric);
                  const value = parseFloat(healthDataItem[fieldName]) || 0;
                  return value;
                };

                const latestHealthData = getLatestHealthData();
                const latestValue = latestHealthData ? 
                  getValueFromHealthData(latestHealthData, metric) : 0;

                const healthStatus = latestHealthData ? 
                  getHealthStatus(metric, latestValue, latestHealthData) : 
                  { status: 'normal' as const, text: '정상', date: '' };
                
                return (
                  <div 
                    key={metric}
                    className="health-metric-card"
                  >
                    <div className="metric-header">
                      <div className={`status-badge status-${healthStatus.status}`}>
                        <span className="status-text">{healthStatus.text}</span>
                        {healthStatus.date && (
                          <span className="status-date">
                            {latestHealthData?.Year?.slice(0, 2) || '24'}년 {healthStatus.date}
                          </span>
                        )}
                      </div>
                      <h3 className="metric-title">{metric}</h3>
                      <div className="metric-value">
                        <span className="value">
                          {latestValue > 0 ? latestValue.toFixed(1) : 
                           (latestValue === 0 ? '0.0' : '-')}
                        </span>
                        <span className="unit">{getUnitForMetric(metric)}</span>
                      </div>
                    </div>
                    
                    <div className="metric-chart">
                      <div className="no-data">
                        <p>차트 데이터 로딩 중...</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* 닷 인디케이터 - 12개 고정 */}
            <div className="slider-dots">
              {Array.from({ length: 12 }, (_, index) => (
                <div 
                  key={index}
                  className={`dot ${index === activeDotIndex ? 'active' : ''}`}
                  onClick={() => {
                    setActiveDotIndex(index);
                    const slider = document.querySelector('.health-metrics-slider') as HTMLElement;
                    const card = document.querySelectorAll('.health-metric-card')[index] as HTMLElement;
                    if (slider && card) {
                      const cardOffsetLeft = card.offsetLeft;
                      const sliderClientWidth = slider.clientWidth;
                      const cardWidth = card.offsetWidth;
                      
                      let targetScrollLeft = cardOffsetLeft - (sliderClientWidth - cardWidth) / 2;
                      const maxScrollLeft = slider.scrollWidth - sliderClientWidth;
                      targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
                      
                      slider.scrollTo({
                        left: targetScrollLeft,
                        behavior: 'smooth'
                      });
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 방문 추이 분석 카드 */}
      <section className="analysis-card">
        <div className="card-header">
          <h2 className="section-title">의료기관 방문 추이</h2>
          <div className="chart-info">
            <span className="info-text">약국 및 병원 방문 건수</span>
          </div>
        </div>
        
        {/* 방문 추이 컨테이너 */}
        <div className="visit-trends-wrapper">
          <div className="visit-trends-container">
            <div className="visit-trends-slider">
              {/* 약국 방문 추이 */}
              <div className="visit-trend-card">
                <div className="trend-header">
                  <h3 className="trend-title">약국 방문 추이</h3>
                </div>
                <div className="trend-chart">
                  {isLoadingVisitData ? (
                    <div className="chart-loading">
                      <div className="loading-spinner">
                        <img 
                          src="/wello/wello-icon.png" 
                          alt="로딩 중" 
                          className="spinner-icon"
                        />
                      </div>
                      <p className="loading-text">처방 데이터 분석 중...</p>
                    </div>
                  ) : (
                    <div className="chart-loading">
                      <div className="loading-spinner">
                        <img 
                          src="/wello/wello-icon.png" 
                          alt="데이터 없음" 
                          className="spinner-icon"
                          style={{ opacity: 0.5, animation: 'none' }}
                        />
                      </div>
                      <p className="loading-text">처방 데이터 차트 준비 중...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 병원 방문 추이 */}
              <div className="visit-trend-card">
                <div className="trend-header">
                  <h3 className="trend-title">병원 방문 추이</h3>
                </div>
                <div className="trend-chart">
                  {isLoadingVisitData ? (
                    <div className="chart-loading">
                      <div className="loading-spinner">
                        <img 
                          src="/wello/wello-icon.png" 
                          alt="로딩 중" 
                          className="spinner-icon"
                        />
                      </div>
                      <p className="loading-text">병원 방문 데이터 분석 중...</p>
                    </div>
                  ) : (
                    <div className="chart-loading">
                      <div className="loading-spinner">
                        <img 
                          src="/wello/wello-icon.png" 
                          alt="데이터 없음" 
                          className="spinner-icon"
                          style={{ opacity: 0.5, animation: 'none' }}
                        />
                      </div>
                      <p className="loading-text">병원 방문 데이터 차트 준비 중...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 닷 인디케이터 */}
            <div className="visit-trends-dots">
              <div className={`dot ${activeVisitDotIndex === 0 ? 'active' : ''}`} onClick={() => {
                const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
                if (slider) {
                  slider.scrollTo({ left: 0, behavior: 'smooth' });
                }
              }}></div>
              <div className={`dot ${activeVisitDotIndex === 1 ? 'active' : ''}`} onClick={() => {
                const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
                if (slider) {
                  const card = document.querySelectorAll('.visit-trend-card')[1] as HTMLElement;
                  if (card) {
                    const cardOffsetLeft = card.offsetLeft;
                    const sliderClientWidth = slider.clientWidth;
                    const cardWidth = card.offsetWidth;
                    let targetScrollLeft = cardOffsetLeft - (sliderClientWidth - cardWidth) / 2;
                    const maxScrollLeft = slider.scrollWidth - sliderClientWidth;
                    targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
                    slider.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
                  }
                }
              }}></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TrendsSection;
