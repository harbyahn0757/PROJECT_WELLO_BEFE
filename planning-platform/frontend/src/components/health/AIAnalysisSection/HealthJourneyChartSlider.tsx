/**
 * HealthJourneyChartSlider - 건강 여정 차트 슬라이더 컴포넌트
 * 주요 건강 지표들을 카드 형태로 슬라이드하여 표시
 */
import React, { useState, useRef, useEffect } from 'react';
import HealthJourneyMiniChart from './HealthJourneyMiniChart';
import { TilkoHealthCheckupRaw } from '../../../types/health';

interface HealthJourneyChartSliderProps {
  healthData: TilkoHealthCheckupRaw[];
  keyChanges?: Array<{
    metric: string;
    previousValue: string;
    currentValue: string;
    changeType: 'improved' | 'worsened' | 'stable';
    significance: string;
  }>;
}

// 주요 건강 지표 정의
const HEALTH_METRICS = [
  {
    key: '체질량지수',
    title: 'BMI (체질량지수)',
    unit: 'kg/m²',
    description: '체중과 신장의 비율로 비만도를 측정하는 지표입니다.'
  },
  {
    key: '허리둘레',
    title: '허리둘레',
    unit: 'cm',
    description: '복부비만을 측정하는 중요한 지표입니다.'
  },
  {
    key: '공복혈당',
    title: '공복혈당',
    unit: 'mg/dL',
    description: '당뇨병 진단과 혈당 관리의 핵심 지표입니다.'
  },
  {
    key: '수축기혈압',
    title: '수축기혈압',
    unit: 'mmHg',
    description: '심장이 수축할 때의 혈압으로 심혈관 건강을 나타냅니다.'
  },
  {
    key: '총콜레스테롤',
    title: '총콜레스테롤',
    unit: 'mg/dL',
    description: '심혈관 질환 위험도를 평가하는 중요한 지표입니다.'
  },
  {
    key: '헤모글로빈',
    title: '헤모글로빈',
    unit: 'g/dL',
    description: '빈혈 진단과 산소 운반 능력을 측정하는 지표입니다.'
  }
];

const HealthJourneyChartSlider: React.FC<HealthJourneyChartSliderProps> = ({
  healthData,
  keyChanges = []
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // 실제 데이터가 있는 지표만 필터링
  const availableMetrics = HEALTH_METRICS.filter(metric => {
    return healthData.some(item => {
      // 해당 지표의 데이터가 있는지 확인 (TilkoHealthCheckupRaw 구조)
      if (item.Inspections && Array.isArray(item.Inspections)) {
        return item.Inspections.some((inspection: any) => {
          if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
            return inspection.Illnesses.some((illness: any) => {
              if (illness.Items && Array.isArray(illness.Items)) {
                return illness.Items.some((dataItem: any) => 
                  dataItem.Name === metric.key && 
                  dataItem.Value && 
                  !isNaN(parseFloat(dataItem.Value))
                );
              }
              return false;
            });
          }
          return false;
        });
      }
      return false;
    });
  });

  // 동기부여 메시지 생성
  const getMotivationalMessage = (metricKey: string): string => {
    const keyChange = keyChanges.find(change => 
      change.metric.includes(metricKey) || metricKey.includes(change.metric)
    );
    
    if (keyChange) {
      switch (keyChange.changeType) {
        case 'improved':
          return `${keyChange.significance} 개선되었습니다! 계속 노력해보세요! 💪`;
        case 'worsened':
          return `${keyChange.significance} 주의가 필요합니다. 생활습관 개선을 권장합니다.`;
        case 'stable':
          return `${keyChange.significance} 안정적으로 유지되고 있습니다.`;
        default:
          return keyChange.significance;
      }
    }
    
    // 기본 동기부여 메시지
    const messages: { [key: string]: string } = {
      '체질량지수': '꾸준한 운동과 식단 관리로 건강한 체중을 유지해보세요!',
      '허리둘레': '복부 운동과 유산소 운동으로 허리둘레를 관리해보세요!',
      '공복혈당': '규칙적인 식사와 운동으로 혈당을 안정적으로 관리해보세요!',
      '수축기혈압': '저염식과 규칙적인 운동으로 혈압을 관리해보세요!',
      '총콜레스테롤': '건강한 식단과 운동으로 콜레스테롤을 관리해보세요!',
      '헤모글로빈': '균형잡힌 영양 섭취로 건강한 혈액을 유지해보세요!'
    };
    
    return messages[metricKey] || '꾸준한 건강 관리로 더 나은 내일을 만들어보세요!';
  };

  // 슬라이드 이동
  const goToSlide = (index: number) => {
    if (index < 0 || index >= availableMetrics.length || isTransitioning) return;
    
    setIsTransitioning(true);
    setCurrentIndex(index);
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };

  // 이전/다음 슬라이드
  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : availableMetrics.length - 1;
    goToSlide(newIndex);
  };

  const goToNext = () => {
    const newIndex = currentIndex < availableMetrics.length - 1 ? currentIndex + 1 : 0;
    goToSlide(newIndex);
  };

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  if (availableMetrics.length === 0) {
    return (
      <div className="health-journey-chart-slider">
        <div className="slider-empty">
          <p>표시할 건강 지표 데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="health-journey-chart-slider">
      <div className="slider-header">
        <h4 className="slider-title">주요 건강 지표 변화</h4>
        <div className="slider-info">
          <span className="current-slide">{currentIndex + 1}</span>
          <span className="slide-separator">/</span>
          <span className="total-slides">{availableMetrics.length}</span>
        </div>
      </div>

      <div className="slider-container" ref={sliderRef}>
        <div 
          className="slider-track"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            transition: isTransitioning ? 'transform 0.3s ease-in-out' : 'none'
          }}
        >
          {availableMetrics.map((metric, index) => (
            <div key={metric.key} className="slider-slide">
              <div className="chart-card">
                <div className="chart-description">
                  <p>{metric.description}</p>
                </div>
                
                <HealthJourneyMiniChart
                  healthData={healthData}
                  metric={metric.key}
                  title={metric.title}
                  unit={metric.unit}
                  motivationalMessage={getMotivationalMessage(metric.key)}
                  className="slider-chart"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 네비게이션 컨트롤 */}
      <div className="slider-controls">
        <button
          className="slider-btn slider-btn-prev"
          onClick={goToPrevious}
          disabled={isTransitioning}
          aria-label="이전 지표"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>

        <div className="slider-dots">
          {availableMetrics.map((_, index) => (
            <button
              key={index}
              className={`slider-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              disabled={isTransitioning}
              aria-label={`${index + 1}번째 지표로 이동`}
            />
          ))}
        </div>

        <button
          className="slider-btn slider-btn-next"
          onClick={goToNext}
          disabled={isTransitioning}
          aria-label="다음 지표"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default HealthJourneyChartSlider;
