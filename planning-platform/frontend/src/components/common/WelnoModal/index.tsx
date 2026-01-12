/**
 * 웰로 공통 모달 컴포넌트
 * 모든 모달에서 공통으로 사용되는 구조와 스타일을 제공
 */
import React from 'react';
import { WELNO_LOGO_IMAGE } from '../../../constants/images';
import './styles.scss';

interface WelnoModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  showCloseButton?: boolean;
  showWelnoIcon?: boolean;
  showWelloIcon?: boolean; // 호환성을 위해 추가
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

const WelnoModal: React.FC<WelnoModalProps> = ({
  isOpen,
  onClose,
  children,
  showCloseButton = false,
  showWelnoIcon = true,
  showWelloIcon, // props로 받아옴
  className = '',
  size = 'medium'
}) => {
  if (!isOpen) return null;

  // showWelloIcon이 제공되면 그것을 사용, 아니면 showWelnoIcon 사용
  const displayIcon = showWelloIcon !== undefined ? showWelloIcon : showWelnoIcon;

  return (
    <div className="welno-modal-overlay">
      <div className={`welno-modal welno-modal--${size} ${className}`}>
        {/* 웰로 아이콘 (선택적) */}
        {displayIcon && (
          <div className="welno-modal-icon">
            <img 
              src={WELNO_LOGO_IMAGE}
              alt="웰로 아이콘" 
              className="welno-icon-blink"
            />
          </div>
        )}

        {/* 닫기 버튼 (선택적) */}
        {showCloseButton && onClose && (
          <button className="welno-modal-close" onClick={onClose}>
            ×
          </button>
        )}

        {/* 모달 컨텐츠 */}
        <div className="welno-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default WelnoModal;
