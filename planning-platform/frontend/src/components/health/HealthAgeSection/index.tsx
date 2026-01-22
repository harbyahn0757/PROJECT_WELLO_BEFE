/**
 * HealthAgeSection - 건강 나이 비교 섹션
 * DiseaseReportPage와 CategoryView에서 공통 사용
 */
import React, { useMemo } from 'react';
import { HealthAgeSectionProps, AgeComparison } from './types';
import './styles.scss';

const HealthAgeSection: React.FC<HealthAgeSectionProps> = ({
  healthAge,
  actualAge,
  variant = 'default',
  className = '',
  showGlowEffect = false,
  onAgeClick,
  compact = false,
  showBorder = false
}) => {
  // 나이 비교 계산
  const ageComparison: AgeComparison | null = useMemo(() => {
    if (actualAge === null) return null;
    
    const difference = Math.abs(healthAge - actualAge);
    const isHealthier = healthAge < actualAge;
    
    return {
      ageDifference: difference,
      isHealthier
    };
  }, [healthAge, actualAge]);
  
  // 색상 클래스 결정 (건강나이 박스)
  const getBodyageColorClass = () => {
    if (actualAge === null) return '';
    return healthAge < actualAge ? 'bodyage-better' : 'bodyage-worse';
  };
  
  const Element = variant === 'card' ? 'section' : 'div';
  
  return (
    <Element 
      className={`health-age-section variant-${variant} ${compact ? 'compact' : ''} ${showBorder ? 'with-border' : ''} ${className}`}
    >
      {/* variant-default일 때는 제목 숨김 */}
      {variant !== 'default' && <h2 className="section-title">건강나이</h2>}
      
      {/* 비교 메시지 */}
      {ageComparison && (
        <p className="age-comparison-message">
          {ageComparison.isHealthier 
            ? <>실제 나이보다 건강나이가 <span className={`age-difference-badge ${showGlowEffect ? 'glow-effect' : ''}`}>{ageComparison.ageDifference.toFixed(1)}세</span> 낮습니다.</>
            : <>실제 나이보다 건강나이가 <span className={`age-difference-badge ${showGlowEffect ? 'glow-effect' : ''}`}>{ageComparison.ageDifference.toFixed(1)}세</span> 높습니다.</>
          }
        </p>
      )}
      
      {/* actualAge가 없을 때 기본 메시지 */}
      {!ageComparison && actualAge !== null && (
        <p className="age-comparison-message">
          {healthAge < actualAge
            ? <>실제 나이보다 건강나이가 <span className={`age-difference-badge ${showGlowEffect ? 'glow-effect' : ''}`}>{Math.abs(healthAge - actualAge).toFixed(1)}세</span> 낮습니다.</>
            : <>실제 나이보다 건강나이가 <span className={`age-difference-badge ${showGlowEffect ? 'glow-effect' : ''}`}>{Math.abs(healthAge - actualAge).toFixed(1)}세</span> 높습니다.</>
          }
        </p>
      )}
      
      {/* 나이 박스들 */}
      <div className="age-comparison-boxes">
        {/* 검진나이 (실제나이) */}
        <div 
          className={`age-box current-age-box ${showGlowEffect ? 'glow-effect' : ''}`}
          onClick={onAgeClick}
          style={{ cursor: onAgeClick ? 'pointer' : 'default' }}
        >
          <div className="age-box-label">검진나이</div>
          <div className="age-box-value" data-no-suffix={actualAge === null}>
            {actualAge !== null ? actualAge : '계산 중...'}
          </div>
        </div>
        
        {/* 화살표 */}
        <div className="age-arrow">
          <div className="arrow-icon">→</div>
        </div>
        
        {/* 건강나이 */}
        <div 
          className={`age-box bodyage-box ${getBodyageColorClass()} ${showGlowEffect ? 'glow-effect' : ''}`}
          onClick={onAgeClick}
          style={{ cursor: onAgeClick ? 'pointer' : 'default' }}
        >
          <div className="age-box-label">건강나이</div>
          <div className="age-box-value">{healthAge.toFixed(1)}</div>
        </div>
      </div>
    </Element>
  );
};

export default HealthAgeSection;
