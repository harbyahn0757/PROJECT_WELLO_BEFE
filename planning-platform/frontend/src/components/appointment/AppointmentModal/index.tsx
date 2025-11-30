/**
 * AppointmentModal
 * 예약 날짜 선택 모달 컴포넌트
 * 아래에서 올라오는 애니메이션과 웰로 효과 적용
 */
import React, { useState, useEffect } from 'react';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
import DateSelector from '../DateSelector';
import Legend from '../Legend';
import './styles.scss';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (selectedDates: string[]) => void;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // 모달 열기/닫기 애니메이션 처리
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // 다음 프레임에 애니메이션 시작
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // 애니메이션 완료 후 DOM에서 제거
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 400); // slideUp 애니메이션 시간과 맞춤
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 오버레이 클릭 시 닫기
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 예약 신청 완료
  const handleConfirm = () => {
    if (selectedDates.length === 0) {
      alert('예약을 희망하는 날짜를 선택해주세요.');
      return;
    }
    
    setIsLoading(true);
    
    // 웰로 효과를 위한 짧은 딜레이
    setTimeout(() => {
      onConfirm?.(selectedDates);
      setIsLoading(false);
      onClose();
    }, 500);
  };

  if (!shouldRender) return null;

  return (
    <div 
      className={`appointment-modal-overlay ${isAnimating ? 'appointment-modal-overlay--open' : 'appointment-modal-overlay--close'}`}
      onClick={handleOverlayClick}
    >
      <div className={`appointment-modal ${isAnimating ? 'appointment-modal--open' : 'appointment-modal--close'}`}>
        {/* 헤더 */}
        <div className="appointment-modal__header">
          <h2 className="appointment-modal__title">예약 날짜 선택</h2>
          <button 
            className="appointment-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="appointment-modal__content">
          {/* 안내 텍스트 */}
          <div className="appointment-modal__instruction">
            예약을 희망하는 날짜와 시간을 선택해주세요.
          </div>

          {/* 캘린더 영역 */}
          <div className="appointment-modal__calendar">
            <DateSelector
              selectedDates={selectedDates}
              onDateSelect={setSelectedDates}
            />
          </div>

          {/* 범례 */}
          <div className="appointment-modal__legend">
            <Legend />
          </div>

          {/* 안내 문구 */}
          <div className="appointment-modal__notice">
            *희망일은 확정일이 아니며, 선택하신 일정을 확인하고 전화로 안내드리고 있습니다.
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="appointment-modal__footer">
          <button
            className="appointment-modal__button"
            onClick={handleConfirm}
            disabled={selectedDates.length === 0 || isLoading}
          >
            {isLoading ? (
              <span className="appointment-modal__button-loading">
                <img 
                  src={WELLO_LOGO_IMAGE}
                  alt="로딩 중" 
                  className="wello-icon-blink"
                />
                <span>처리 중...</span>
              </span>
            ) : (
              '예약 신청 완료'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentModal;


