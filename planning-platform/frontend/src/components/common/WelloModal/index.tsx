/**
 * 웰로 공통 모달 컴포넌트
 * 모든 모달에서 공통으로 사용되는 구조와 스타일을 제공
 */
import React from 'react';
import { WELLO_LOGO_IMAGE } from '../../constants/images';
import './styles.scss';

interface WelloModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  showCloseButton?: boolean;
  showWelloIcon?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

const WelloModal: React.FC<WelloModalProps> = ({
  isOpen,
  onClose,
  children,
  showCloseButton = false,
  showWelloIcon = true,
  className = '',
  size = 'medium'
}) => {
  if (!isOpen) return null;

  return (
    <div className="wello-modal-overlay">
      <div className={`wello-modal wello-modal--${size} ${className}`}>
        {/* 웰로 아이콘 (선택적) */}
        {showWelloIcon && (
          <div className="wello-modal-icon">
            <img 
              src={WELLO_LOGO_IMAGE}
              alt="웰로 아이콘" 
              className="wello-icon-blink"
            />
          </div>
        )}

        {/* 닫기 버튼 (선택적) */}
        {showCloseButton && onClose && (
          <button className="wello-modal-close" onClick={onClose}>
            ×
          </button>
        )}

        {/* 모달 컨텐츠 */}
        <div className="wello-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default WelloModal;
