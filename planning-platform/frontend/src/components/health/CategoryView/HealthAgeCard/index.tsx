/**
 * HealthAgeCard - 건강 나이 비교 카드
 * 건강 나이 vs 실제 나이 비교 표시 (재사용 가능)
 */
import React from 'react';
import './styles.scss';

interface HealthAgeCardProps {
  healthAge: number;
  actualAge: number;
  className?: string;
  patientName?: string;
}

const HealthAgeCard: React.FC<HealthAgeCardProps> = ({
  healthAge,
  actualAge,
  className = '',
  patientName
}) => {
  const isOlder = healthAge > actualAge;
  const difference = Math.abs(healthAge - actualAge);
  
  return (
    <div className={`health-age-card ${className}`}>
      <div className="health-age-header">
        <span className="health-age-message">
          건강 나이가 실제보다 {isOlder ? '많아요' : '적어요'}
        </span>
        <span className="info-icon" title="건강 나이는 검진 결과를 바탕으로 산출됩니다">?</span>
      </div>
      <div className="health-age-comparison">
        <div className="age-item">
          <span className="age-label">건강나이</span>
          <span className="age-value">{healthAge}살</span>
        </div>
        <div className="age-divider" />
        <div className="age-item">
          <span className="age-label">실제나이</span>
          <span className="age-value">{actualAge}살</span>
        </div>
      </div>
      {difference > 5 && (
        <div className="health-age-notice">
          {isOlder 
            ? `실제보다 ${difference}살 많습니다. 건강관리가 필요해요.`
            : `실제보다 ${difference}살 적습니다. 건강을 잘 관리하고 계시네요!`
          }
        </div>
      )}
    </div>
  );
};

export default HealthAgeCard;
