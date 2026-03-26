/**
 * 검진설계 캠페인 소개 랜딩 페이지
 * - 알림톡 링크의 검진 데이터 유무에 따른 분기
 * - 기존 데이터로 바로 설계 vs Tilko 다년간 정밀 설계
 */
import React from 'react';

interface CheckupDesignStatus {
  success: boolean;
  case_id: string;
  action: string;
  has_design: boolean;
  has_health_data: boolean;
  message?: string;
  available_years?: number[];
  latest_year?: number;
}

interface Props {
  uuid: string;
  partnerId: string;
  hospitalId: string;
  status: CheckupDesignStatus | null;
  healthData: any; // 알림톡 링크에서 복호화된 검진 데이터
  onStartDesign: () => void;
  onStartDesignWithData: (data: any) => void; // 기존 데이터로 바로 시작
  onAuth: () => void;
  onAuthMultiYear: () => void; // Tilko 다년간 데이터 수집 후 설계
  onViewResult: () => void;
}

const IntroLandingPage: React.FC<Props> = ({
  uuid, partnerId, hospitalId, status, healthData,
  onStartDesign, onStartDesignWithData, onAuth, onAuthMultiYear, onViewResult,
}) => {
  const hasLinkData = healthData && (healthData.bmi || healthData.bphigh || healthData.blds);
  const hasDbData = status?.has_health_data;
  const hasAnyData = hasLinkData || hasDbData;
  const isProcessing = status?.action === 'show_processing';

  // 설계 완료 상태
  if (status?.action === 'show_result') {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={titleStyle}>AI 검진설계 결과</h1>
          <p style={subtitleStyle}>검진설계가 완료되었습니다</p>
        </div>
        <button onClick={onViewResult} style={primaryBtnStyle}>
          내 검진설계 결과 보기
        </button>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={titleStyle}>AI 맞춤 건강검진 설계</h1>
        <p style={subtitleStyle}>
          건강검진 데이터를 AI가 분석하여<br />
          나에게 꼭 필요한 검진 항목을 추천합니다
        </p>
      </div>

      {/* 혜택 리스트 */}
      <div style={cardStyle}>
        {[
          { icon: '🔬', text: '3-Layer 페르소나 분석으로 맞춤 설계' },
          { icon: '📊', text: '과거 검진 데이터 추이 기반 위험도 평가' },
          { icon: '📚', text: '의학 근거 기반 검진항목 추천 (RAG)' },
          { icon: '💊', text: '약물 복용 이력 반영 정밀 분석' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 0', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none',
          }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '14px', color: '#374151' }}>{item.text}</span>
          </div>
        ))}
      </div>

      {/* ── 데이터 있음: 2가지 선택 ── */}
      {hasAnyData && !isProcessing && (
        <>
          <div style={infoBannerStyle('#ecfdf5', '#a7f3d0', '#065f46')}>
            ✅ 검진 데이터가 확인되었습니다. 설계 방식을 선택해주세요.
          </div>

          {/* 선택 1: 기존 데이터로 바로 설계 */}
          <div
            onClick={() => hasLinkData ? onStartDesignWithData(healthData) : onStartDesign()}
            style={choiceCardStyle}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>⚡</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a5f' }}>
                  기존 데이터로 설계
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  {status?.latest_year ? `${status.latest_year}년 검진 결과 기반` : '현재 보유 데이터 기반'}
                  {' · 바로 시작 (약 1분)'}
                </div>
              </div>
            </div>
          </div>

          {/* 선택 2: Tilko 다년간 정밀 설계 */}
          <div onClick={onAuthMultiYear} style={{...choiceCardStyle, borderColor: '#c7d2fe'}}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>🔍</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e3a5f' }}>
                  다년간 데이터로 정밀 설계
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  건보공단 본인인증 → 과거~현재 검진 추이 분석
                  {' · 약 2-3분 소요'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 데이터 없음: 인증 유도 ── */}
      {!hasAnyData && !isProcessing && (
        <>
          <div style={infoBannerStyle('#fef3c7', '#fcd34d', '#92400e')}>
            건강검진 데이터가 필요합니다. 본인 인증 후 데이터를 불러옵니다.
          </div>
          <button onClick={onAuth} style={primaryBtnStyle}>
            본인 인증하고 검진설계 받기
          </button>
        </>
      )}

      {/* 진행 중 */}
      {isProcessing && (
        <button disabled style={{...primaryBtnStyle, background: '#9ca3af', cursor: 'default'}}>
          분석 진행 중...
        </button>
      )}

      {!uuid && (
        <p style={{ marginTop: '16px', fontSize: '12px', color: '#9ca3af' }}>
          파트너 링크를 통해 접속해주세요
        </p>
      )}
    </div>
  );
};

// 스타일 상수
const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: '40px 20px', background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
};
const titleStyle: React.CSSProperties = {
  fontSize: '28px', fontWeight: 800, color: '#1e3a5f', marginBottom: '12px',
};
const subtitleStyle: React.CSSProperties = {
  fontSize: '16px', color: '#4b5563', lineHeight: 1.6, maxWidth: '400px',
};
const cardStyle: React.CSSProperties = {
  background: 'white', borderRadius: '16px', padding: '24px',
  width: '100%', maxWidth: '400px', marginBottom: '32px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};
const primaryBtnStyle: React.CSSProperties = {
  width: '100%', maxWidth: '400px', padding: '16px',
  background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px',
  fontSize: '16px', fontWeight: 700, cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
};
const choiceCardStyle: React.CSSProperties = {
  width: '100%', maxWidth: '400px', padding: '18px 20px',
  background: 'white', border: '2px solid #d1fae5', borderRadius: '14px',
  marginBottom: '12px', cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};
const infoBannerStyle = (bg: string, border: string, color: string): React.CSSProperties => ({
  background: bg, border: `1px solid ${border}`, borderRadius: '10px',
  padding: '12px 20px', marginBottom: '16px', maxWidth: '400px', width: '100%',
  fontSize: '13px', color, margin: '0 0 16px',
});

export default IntroLandingPage;
