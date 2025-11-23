/**
 * Legend
 * 캘린더 범례 컴포넌트
 */
import React from 'react';
import './styles.scss';

const Legend: React.FC = () => {
  return (
    <div className="legend">
      <div className="legend__item">
        <div className="legend__circle legend__circle--today" />
        <span className="legend__text">오늘</span>
      </div>
      <div className="legend__item">
        <div className="legend__circle legend__circle--selected" />
        <span className="legend__text">예약 희망일</span>
      </div>
    </div>
  );
};

export default Legend;



