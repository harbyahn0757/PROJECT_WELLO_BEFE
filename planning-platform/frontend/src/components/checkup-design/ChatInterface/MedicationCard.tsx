/**
 * 약품 효능 카드 컴포넌트
 */
import React from 'react';
import { MedicationEffectPattern } from '../../../utils/prescriptionPatternAnalyzer';
import './styles.scss';

interface MedicationCardProps {
  pattern: MedicationEffectPattern;
  onClick: (pattern: MedicationEffectPattern) => void;
  selected?: boolean;
  animationDelay?: number; // 애니메이션 딜레이 (ms)
}

const MedicationCard: React.FC<MedicationCardProps> = ({
  pattern,
  onClick,
  selected = false,
  animationDelay = 0
}) => {
  // 복용 기간 텍스트 변환
  const months = Math.floor(pattern.totalDays / 30);
  const days = pattern.totalDays % 30;
  let durationText = '';
  if (months > 0 && days > 0) {
    durationText = `${months}개월 ${days}일`;
  } else if (months > 0) {
    durationText = `${months}개월`;
  } else {
    durationText = `${days}일`;
  }

  // 복용 밀도에 따른 설명
  const density = pattern.patternAnalysis.consumptionDensity;
  let densityText = '';
  if (density >= 0.8) {
    densityText = '지속적으로';
  } else if (density >= 0.5) {
    densityText = '주기적으로';
  } else if (density >= 0.3) {
    densityText = '간헐적으로';
  } else {
    densityText = '가끔';
  }

  // 연도 범위
  const yearRange = pattern.years.length > 1
    ? `${pattern.years[pattern.years.length - 1]}년 ~ ${pattern.years[0]}년`
    : `${pattern.years[0]}년`;

  // 장기 복용 여부
  const isLongTerm = pattern.totalDays >= 180;
  const isRecent = new Date(pattern.lastPrescriptionEndDate) >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  return (
    <button
      className={`medication-card ${selected ? 'medication-card--selected' : ''}`}
      onClick={() => onClick(pattern)}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="medication-card__header">
        <h3 className="medication-card__effect">{pattern.effect}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="medication-card__prescription-count-badge">
            {pattern.prescriptionCount}회
          </span>
          {(isLongTerm || isRecent) && (
            <div className="medication-card__badges">
              {isLongTerm && (
                <span className="medication-card__badge medication-card__badge--long-term">
                  장기 복용
                </span>
              )}
              {isRecent && (
                <span className="medication-card__badge medication-card__badge--recent">
                  최근 복용
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="medication-card__body">
        <div className="medication-card__info">
          <span className="medication-card__period">{yearRange}</span>
          <span className="medication-card__duration">{durationText}간 {densityText} 복용</span>
        </div>
        <div className="medication-card__details">
          {pattern.patternAnalysis.restartCount > 0 && (
            <span className="medication-card__restart">
              중단 후 {pattern.patternAnalysis.restartCount}회 재시작
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default MedicationCard;

