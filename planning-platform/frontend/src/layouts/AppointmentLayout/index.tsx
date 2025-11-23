/**
 * AppointmentLayout
 * 예약 페이지 전용 레이아웃
 * 헤더만 재사용하고, 하단 버튼은 새로 생성
 */
import React, { ReactNode } from 'react';
import HealthTrendsHeader from '../../components/health/HealthTrendsHeader';
import './styles.scss';

interface AppointmentLayoutProps {
  children: ReactNode;
  onBack?: () => void;
  // 하단 버튼 props
  buttonText?: string;
  onButtonClick?: () => void;
  buttonDisabled?: boolean;
}

const AppointmentLayout: React.FC<AppointmentLayoutProps> = ({
  children,
  onBack,
  buttonText = '예약 신청 완료',
  onButtonClick,
  buttonDisabled = false
}) => {
  return (
    <div className="appointment-layout">
      {/* 헤더 (재사용) - fixed */}
      <HealthTrendsHeader
        onBack={onBack || (() => window.history.back())}
        title="예약 날짜 선택"
        // 예약 페이지에서는 새로고침과 업데이트 시간 불필요
        lastUpdateTime={null}
        onRefresh={undefined}
      />

      {/* 컨텐츠 영역 (스크롤 가능) - 헤더 아래부터 시작 */}
      <div className="appointment-layout__body">
        <div className="appointment-layout__content">
          {children}
        </div>
      </div>

      {/* 하단 버튼 (새로 생성) - fixed */}
      {onButtonClick && (
        <div className="appointment-layout__footer">
          <button
            className="appointment-layout__button"
            onClick={onButtonClick}
            disabled={buttonDisabled}
          >
            {buttonText}
          </button>
        </div>
      )}
    </div>
  );
};

export default AppointmentLayout;

