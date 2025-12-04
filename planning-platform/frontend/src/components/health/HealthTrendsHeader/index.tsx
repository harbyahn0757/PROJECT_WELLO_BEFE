/**
 * HealthTrendsHeader - 건강 추이 페이지 헤더 컴포넌트
 * 메인 페이지의 인사말 섹션이 위로 올라가면서 헤더 역할을 함
 */
import React, { useState, useEffect, useRef } from 'react';
import BackButton from '../../shared/BackButton';
import WelloModal from '../../common/WelloModal';
import './styles.scss';
import './refresh-modal.scss';

interface HealthTrendsHeaderProps {
  onBack: () => void;
  title?: string; // 제목 (기본값: "건강 추이")
  description?: string; // 설명 텍스트 (제목 아래 표시)
  headerType?: 'default' | 'large'; // 헤더 높이 타입 (기본값: 'default')
  lastUpdateTime?: string | null;
  patientName?: string;
  onRefresh?: (withdraw?: boolean) => void | Promise<void>;
}

const HealthTrendsHeader: React.FC<HealthTrendsHeaderProps> = ({
  onBack,
  title = '건강 추이', // 기본값
  description,
  headerType = 'default', // 기본값: 'default'
  lastUpdateTime,
  patientName,
  onRefresh
}) => {
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [withdrawChecked, setWithdrawChecked] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // 헤더 높이 계산 및 CSS 변수 설정 (리사이즈 시 재계산)
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.getBoundingClientRect().height;
        // CSS 변수를 :root에 설정하여 모든 자식 요소에서 사용 가능하도록
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    // 초기 계산
    updateHeaderHeight();

    // 리사이즈 및 내용 변경 시 재계산
    window.addEventListener('resize', updateHeaderHeight);
    
    // MutationObserver로 헤더 내용 변경 감지
    const observer = new MutationObserver(updateHeaderHeight);
    if (headerRef.current) {
      observer.observe(headerRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      observer.disconnect();
      // 헤더가 언마운트될 때 CSS 변수 제거 (다른 페이지에 영향 방지)
      document.documentElement.style.removeProperty('--header-height');
    };
  }, [title, description, lastUpdateTime, headerType]);

  // 새로고침 확인 핸들러
  const handleRefreshClick = () => {
    if (onRefresh) {
      setShowRefreshModal(true);
    }
  };

  const handleRefreshConfirm = () => {
    setShowRefreshModal(false);
    if (onRefresh) {
      onRefresh(withdrawChecked);
    }
    // 체크박스 상태 초기화
    setWithdrawChecked(false);
  };

  const handleRefreshCancel = () => {
    setShowRefreshModal(false);
    // 체크박스 상태 초기화
    setWithdrawChecked(false);
  };
  // 마지막 업데이트 시간 포맷팅
  const formatLastUpdateTime = (time: string | null | undefined): string => {
    if (!time) return '';
    
    try {
      // ISO 형식 또는 다른 형식의 시간을 파싱
      const date = new Date(time);
      if (isNaN(date.getTime())) {
        // 날짜 파싱 실패 시 원본 반환
        return time;
      }
      
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      const period = hours >= 12 ? '오후' : '오전';
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      
      return `${year}년 ${month}월 ${day}일 ${period} ${displayHours}:${minutes}`;
    } catch (error) {
      console.warn('시간 포맷팅 실패:', error);
      return time;
    }
  };

  return (
    <>
      <div 
        ref={headerRef}
        className={`health-trends-header ${headerType === 'large' ? 'health-trends-header--large' : ''}`}
      >
        {/* 랜딩페이지 헤더 구조 (높이만 작게) */}
        <div className="health-trends-header__header-greeting-section">
          {/* 뒤로가기 버튼 (좌측) - 공용 컴포넌트 사용 */}
          <BackButton onClick={onBack} />

          {/* 제목 및 업데이트 정보 (중앙) */}
          <div className="health-trends-header__center">
            <div className="health-trends-header__title">
              {title}
            </div>
            {description && (
              <div className="health-trends-header__description">
                {description}
              </div>
            )}
            {lastUpdateTime && (
              <div className="health-trends-header__update">
                {onRefresh && (
                  <button 
                    className="health-trends-header__refresh-icon"
                    onClick={handleRefreshClick}
                    aria-label="데이터 새로고침"
                    type="button"
                  >
                    <svg 
                      className="health-trends-header__refresh-icon-svg"
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        d="M4 4V9H4.58152M19.9381 11C19.446 7.05369 16.0796 4 12 4C8.64262 4 5.76829 6.06817 4.58152 9M4.58152 9H9M20 20V15H19.4185M19.4185 15C18.2317 17.9318 15.3574 20 12 20C7.92038 20 4.55399 16.9463 4.06189 13M19.4185 15H15" 
                        stroke="#7c746a" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
                <span className="health-trends-header__update-text">
                  마지막 업데이트 : {formatLastUpdateTime(lastUpdateTime)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 새로고침 확인 다이얼로그 */}
      <WelloModal
        isOpen={showRefreshModal}
        onClose={handleRefreshCancel}
        showCloseButton={true}
        showWelloIcon={false}
        size="medium"
        className="wello-modal--white"
      >
        <div className="health-trends-refresh-modal">
          <h2 className="health-trends-refresh-modal__title">
            데이터를 새로고침하시겠어요?
          </h2>
          <p className="health-trends-refresh-modal__description">
            최신 건강정보로 업데이트해요.
          </p>
          
          {/* 탈퇴하기 체크박스 */}
          <div className="health-trends-refresh-modal__withdraw-section">
            <label className="health-trends-refresh-modal__withdraw-checkbox">
              <input
                type="checkbox"
                checked={withdrawChecked}
                onChange={(e) => setWithdrawChecked(e.target.checked)}
              />
              <span className="health-trends-refresh-modal__withdraw-label">
                탈퇴하기
              </span>
            </label>
            {withdrawChecked && (
              <p className="health-trends-refresh-modal__withdraw-warning">
                탈퇴 시 모든 약관 동의와 건강정보가 삭제되며, 첫 화면으로 이동합니다.
              </p>
            )}
          </div>
          
          <div className="health-trends-refresh-modal__actions">
            <button
              className="health-trends-refresh-modal__btn health-trends-refresh-modal__btn--confirm"
              onClick={handleRefreshConfirm}
            >
              {withdrawChecked ? '탈퇴하기' : '새로고침'}
            </button>
          </div>
        </div>
      </WelloModal>
    </>
  );
};

export default HealthTrendsHeader;

