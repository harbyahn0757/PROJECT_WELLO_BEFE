/**
 * 검진 카드 컴포넌트
 */
import React from 'react';
import './styles.scss';

interface CheckupCardProps {
  id: string;
  year: string;
  date: string;
  location: string;
  abnormalCount: number;
  warningCount: number;
  onClick: (id: string) => void;
  selected?: boolean;
  animationDelay?: number; // 애니메이션 딜레이 (ms)
}

const CheckupCard: React.FC<CheckupCardProps> = ({
  id,
  year,
  date,
  location,
  abnormalCount,
  warningCount,
  onClick,
  selected = false,
  animationDelay = 0
}) => {
  return (
    <button
      className={`checkup-card ${selected ? 'checkup-card--selected' : ''}`}
      onClick={() => onClick(id)}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="checkup-card__header">
        <h3 className="checkup-card__title">{year}년 건강검진</h3>
        <span className="checkup-card__date">{date}</span>
      </div>
      <div className="checkup-card__body">
        <div className="checkup-card__location">{location}</div>
        <div className="checkup-card__status">
          {abnormalCount > 0 && (
            <span className="checkup-card__badge checkup-card__badge--abnormal">
              이상 {abnormalCount}건
            </span>
          )}
          {warningCount > 0 && (
            <span className="checkup-card__badge checkup-card__badge--warning">
              경계 {warningCount}건
            </span>
          )}
          {abnormalCount === 0 && warningCount === 0 && (
            <span className="checkup-card__badge checkup-card__badge--normal">
              정상
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default CheckupCard;

