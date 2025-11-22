/**
 * BackButton - 공용 뒤로가기 버튼 컴포넌트
 * 랜딩페이지의 건강검진 결과지 다시보기 카드 오른쪽 버튼과 동일한 디자인
 */
import React from 'react';
import './styles.scss';

interface BackButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  ariaLabel = '뒤로가기',
  className = ''
}) => {
  return (
    <button
      className={`back-button ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <svg className="back-button__svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
      </svg>
    </button>
  );
};

export default BackButton;

