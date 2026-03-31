/**
 * ExistingPatientWelcome — 기존 환자 발견 시 맞이 화면
 *
 * 비밀번호 모달 전에 보여줌:
 * - 기존 데이터 건수 안내 (내용은 비공개)
 * - "기존 기록 활용" vs "새로 시작" 선택지
 */
import React from 'react';

interface DataSummary {
  healthCheckups: number;
  prescriptions: number;
  ragChats: number;
}

interface ExistingPatientWelcomeProps {
  patientName: string;
  dataSummary: DataSummary;
  hasPassword: boolean;
  onUseExisting: () => void;   // 기존 기록 활용 → 비밀번호 확인
  onStartFresh: () => void;    // 새로 시작 → Tilko 직행
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '32px 24px', maxWidth: '400px', margin: '0 auto',
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 인사 */}
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#2D2117', marginBottom: '8px' }}>
        {firstName}님, 다시 만나서 반가워요!
      </div>
      <div style={{ fontSize: '14px', color: '#8B7B6B', marginBottom: '24px' }}>
        이전에 웰노를 이용하신 기록이 있어요
      </div>

      {/* 데이터 요약 카드 */}
      <div style={{
        width: '100%', padding: '20px', borderRadius: '16px',
        background: '#F9F6F3', border: '1px solid #E8E0D8', marginBottom: '24px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#55433B', marginBottom: '12px' }}>
          {patientName}님의 기존 건강 기록
        </div>
        {dataSummary.healthCheckups > 0 && (
          <div style={{ fontSize: '13px', color: '#6B5B4F', marginBottom: '6px' }}>
            • 건강검진 결과 {dataSummary.healthCheckups}건
          </div>
        )}
        {dataSummary.prescriptions > 0 && (
          <div style={{ fontSize: '13px', color: '#6B5B4F', marginBottom: '6px' }}>
            • 처방/복약 내역 {dataSummary.prescriptions}건
          </div>
        )}
        {dataSummary.ragChats > 0 && (
          <div style={{ fontSize: '13px', color: '#6B5B4F', marginBottom: '6px' }}>
            • AI 건강 상담 {dataSummary.ragChats}회
          </div>
        )}
        {totalRecords === 0 && (
          <div style={{ fontSize: '13px', color: '#6B5B4F' }}>
            • 기본 프로필 정보
          </div>
        )}
      </div>

      {/* 선택지 */}
      <div style={{ fontSize: '14px', color: '#55433B', marginBottom: '16px', fontWeight: 600 }}>
        이 기록을 어떻게 할까요?
      </div>

      {/* 기존 기록 활용 (추천) */}
      <button
        onClick={onUseExisting}
        style={{
          width: '100%', padding: '16px 20px', borderRadius: '12px', marginBottom: '12px',
          background: '#55433B', color: 'white', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
          ⭐ 기존 기록으로 이어서 하기
        </div>
        <div style={{ fontSize: '12px', opacity: 0.85 }}>
          이전 데이터를 활용해 더 정확한 맞춤 분석을 받을 수 있어요
        </div>
      </button>

      {/* 새로 시작 */}
      <button
        onClick={onStartFresh}
        style={{
          width: '100%', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px',
          background: 'white', color: '#55433B', border: '1px solid #D1C7BD', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
          처음부터 새로 시작하기
        </div>
        <div style={{ fontSize: '12px', color: '#8B7B6B' }}>
          기존 기록은 그대로 보관돼요. 나중에 연결할 수 있어요.
        </div>
      </button>

      {/* 안내 */}
      <div style={{ fontSize: '11px', color: '#A99B8F', textAlign: 'center', lineHeight: 1.5 }}>
        {hasPassword
          ? '기존 기록 활용 시 본인 확인을 위해 비밀번호를 확인해요'
          : '기존 기록 활용 시 보안을 위해 비밀번호를 설정해요'
        }
      </div>
    </div>
  );
};

export default ExistingPatientWelcome;
