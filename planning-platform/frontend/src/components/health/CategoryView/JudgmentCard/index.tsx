/**
 * JudgmentCard - 건강검진 판정 결과 카드
 * 재사용 가능
 */
import React from 'react';
import './styles.scss';

interface JudgmentCardProps {
  patientName: string;
  judgment: string;        // 정상, 질환의심 등
  description?: string;
  icon?: string;
  className?: string;
}

const JudgmentCard: React.FC<JudgmentCardProps> = ({
  patientName,
  judgment,
  description,
  icon = '🤔',
  className = ''
}) => {
  // 판정 결과에 따른 스타일 클래스
  const getJudgmentClass = () => {
    if (judgment?.includes('질환')) return 'judgment-caution';
    if (judgment?.includes('의심')) return 'judgment-warning';
    if (judgment?.includes('정상')) return 'judgment-normal';
    return '';
  };
  
  return (
    <div className={`judgment-card ${getJudgmentClass()} ${className}`}>
      <div className="judgment-header">
        <div className="judgment-text-wrapper">
          <span className="judgment-text">
            {patientName}님 판정 결과는{' '}
            <strong className="judgment-result">{judgment}</strong>이에요
          </span>
          <span className="judgment-help-icon" title="판정 결과에 대한 설명">?</span>
        </div>
        <span className="judgment-icon" role="img" aria-label="판정 아이콘">
          {icon}
        </span>
      </div>
      {description && (
        <p className="judgment-description">{description}</p>
      )}
    </div>
  );
};

export default JudgmentCard;
