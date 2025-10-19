/**
 * AccessibilityButton - 접근성 설정 버튼
 * 페이지 우측 하단에 고정되어 접근성 패널을 열 수 있는 버튼
 */
import React, { useState } from 'react';
import AccessibilityPanel from '../AccessibilityPanel';
import { useAccessibility } from '../../../hooks/useAccessibility';
import './styles.scss';

export interface AccessibilityButtonProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showLabel?: boolean;
  className?: string;
}

const AccessibilityButton: React.FC<AccessibilityButtonProps> = ({
  position = 'bottom-right',
  showLabel = false,
  className = ''
}) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { announce, AccessibilityComponents } = useAccessibility();

  const handleTogglePanel = () => {
    const newState = !isPanelOpen;
    setIsPanelOpen(newState);
    
    if (newState) {
      announce('접근성 설정 패널이 열렸습니다');
    } else {
      announce('접근성 설정 패널이 닫혔습니다');
    }
  };

  return (
    <>
      {/* 접근성 컴포넌트 */}
      <AccessibilityComponents />

      {/* 접근성 버튼 */}
      <button
        className={`accessibility-button accessibility-button--${position} ${className}`}
        onClick={handleTogglePanel}
        aria-label="접근성 설정 열기"
        aria-expanded={isPanelOpen}
        aria-haspopup="dialog"
        title="접근성 설정"
      >
        <div className="accessibility-button__icon">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* 접근성 아이콘 (사람 모양) */}
            <path
              d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 7.5V9C15 10.1 14.1 11 13 11H11C9.9 11 9 10.1 9 9V7.5L3 7V9C3 10.1 3.9 11 5 11H7V22H9V16H15V22H17V11H19C20.1 11 21 10.1 21 9Z"
              fill="currentColor"
            />
          </svg>
        </div>
        
        {showLabel && (
          <span className="accessibility-button__label">
            접근성
          </span>
        )}

        {/* 활성 상태 인디케이터 */}
        {isPanelOpen && (
          <div className="accessibility-button__indicator" />
        )}
      </button>

      {/* 접근성 패널 */}
      <AccessibilityPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        position={position.includes('top') ? 
          (position.includes('right') ? 'top-right' : 'top-left') :
          (position.includes('right') ? 'bottom-right' : 'bottom-left')
        }
      />
    </>
  );
};

export default AccessibilityButton;
