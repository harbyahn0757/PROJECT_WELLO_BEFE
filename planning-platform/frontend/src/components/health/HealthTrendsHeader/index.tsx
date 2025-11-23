/**
 * HealthTrendsHeader - 건강 추이 페이지 헤더 컴포넌트
 * 메인 페이지의 인사말 섹션이 위로 올라가면서 헤더 역할을 함
 */
import React from 'react';
import BackButton from '../../shared/BackButton';
import './styles.scss';

interface HealthTrendsHeaderProps {
  onBack: () => void;
  title?: string; // 제목 (기본값: "건강 추이")
  lastUpdateTime?: string | null;
  patientName?: string;
  onRefresh?: () => void;
}

const HealthTrendsHeader: React.FC<HealthTrendsHeaderProps> = ({
  onBack,
  title = '건강 추이', // 기본값
  lastUpdateTime,
  patientName,
  onRefresh
}) => {
  // 새로고침 확인 핸들러
  const handleRefreshClick = () => {
    if (onRefresh) {
      if (window.confirm('데이터를 새로고침하시겠습니까?')) {
        onRefresh();
      }
    }
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
    <div className="health-trends-header">
      {/* 랜딩페이지 헤더 구조 (높이만 작게) */}
      <div className="health-trends-header__header-greeting-section">
        {/* 뒤로가기 버튼 (좌측) - 공용 컴포넌트 사용 */}
        <BackButton onClick={onBack} />

        {/* 제목 및 업데이트 정보 (중앙) */}
        <div className="health-trends-header__center">
          <div className="health-trends-header__title">
            {title}
          </div>
          {lastUpdateTime && (
            <div className="health-trends-header__update">
              {onRefresh && (
                <button 
                  className="health-trends-header__refresh-icon"
                  onClick={handleRefreshClick}
                  aria-label="데이터 새로고침"
                  type="button"
                >
                  <span className="health-trends-header__refresh-icon-inner"></span>
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
  );
};

export default HealthTrendsHeader;

