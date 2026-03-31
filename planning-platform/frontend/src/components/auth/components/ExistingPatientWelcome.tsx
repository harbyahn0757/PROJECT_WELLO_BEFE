/**
 * ExistingPatientWelcome — 기존 환자 발견 시 맞이 화면
 *
 * WelnoModal 디자인 시스템 기반:
 * - 다크 그라데이션 배경 + welno-icon-blink
 * - 기존 데이터 건수 안내 (내용은 비공개)
 * - "기존 기록 활용" vs "새로 시작" 선택지
 */
import React from 'react';
import WelnoModal from '../../common/WelnoModal';
import './ExistingPatientWelcome.scss';

interface DataSummary {
  healthCheckups: number;
  prescriptions: number;
  ragChats: number;
}

interface ExistingPatientWelcomeProps {
  patientName: string;
  dataSummary: DataSummary;
  hasPassword: boolean;
  onUseExisting: () => void;
  onStartFresh: () => void;
}

const ExistingPatientWelcome: React.FC<ExistingPatientWelcomeProps> = ({
  patientName,
  dataSummary,
  hasPassword,
  onUseExisting,
  onStartFresh,
}) => {
  const firstName = patientName?.slice(1) || patientName || '고객';
  const totalRecords = dataSummary.healthCheckups + dataSummary.prescriptions;

  return (
    <WelnoModal isOpen={true} showCloseButton={false} showWelnoIcon={true} size="medium">
      <div className="existing-welcome">
        <h2 className="existing-welcome__title">
          {firstName}님, 다시 만나서 반가워요!
        </h2>
        <p className="existing-welcome__subtitle">
          이전에 웰노를 이용하신 기록이 있어요
        </p>

        {/* 데이터 요약 카드 */}
        <div className="existing-welcome__card">
          <div className="existing-welcome__card-title">
            {patientName}님의 기존 건강 기록
          </div>
          {dataSummary.healthCheckups > 0 && (
            <div className="existing-welcome__card-item">
              건강검진 결과 {dataSummary.healthCheckups}건
            </div>
          )}
          {dataSummary.prescriptions > 0 && (
            <div className="existing-welcome__card-item">
              처방/복약 내역 {dataSummary.prescriptions}건
            </div>
          )}
          {dataSummary.ragChats > 0 && (
            <div className="existing-welcome__card-item">
              AI 건강 상담 {dataSummary.ragChats}회
            </div>
          )}
          {totalRecords === 0 && (
            <div className="existing-welcome__card-item">
              기본 프로필 정보
            </div>
          )}
        </div>

        {/* 선택지 */}
        <div className="existing-welcome__actions">
          <button className="existing-welcome__btn existing-welcome__btn--primary" onClick={onUseExisting}>
            <span className="existing-welcome__btn-title">기존 기록으로 이어서 하기</span>
            <span className="existing-welcome__btn-desc">
              이전 데이터를 활용해 더 정확한 맞춤 분석을 받을 수 있어요
            </span>
          </button>
          <button className="existing-welcome__btn existing-welcome__btn--secondary" onClick={onStartFresh}>
            <span className="existing-welcome__btn-title">처음부터 새로 시작하기</span>
            <span className="existing-welcome__btn-desc">
              기존 기록은 그대로 보관돼요
            </span>
          </button>
        </div>

        {/* 안내 */}
        <p className="existing-welcome__hint">
          {hasPassword
            ? '기존 기록 활용 시 본인 확인을 위해 비밀번호를 확인해요'
            : '기존 기록 활용 시 보안을 위해 비밀번호를 설정해요'
          }
        </p>
      </div>
    </WelnoModal>
  );
};

export default ExistingPatientWelcome;
