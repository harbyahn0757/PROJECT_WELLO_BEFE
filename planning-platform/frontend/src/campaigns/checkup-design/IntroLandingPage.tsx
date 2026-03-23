/**
 * 검진설계 캠페인 소개 랜딩 페이지
 * disease-prediction/IntroLandingPage.tsx 패턴 참조.
 */

import React from 'react';

interface CheckupDesignStatus {
  success: boolean;
  case_id: string;
  action: string;
  has_design: boolean;
  has_health_data: boolean;
  message?: string;
}

interface Props {
  uuid: string;
  partnerId: string;
  hospitalId: string;
  status: CheckupDesignStatus | null;
  onStartDesign: () => void;
  onAuth: () => void;
  onViewResult: () => void;
}

const IntroLandingPage: React.FC<Props> = ({
  uuid, partnerId, hospitalId, status, onStartDesign, onAuth, onViewResult,
}) => {
  // 상태별 CTA 버튼 텍스트 & 동작
  const getButtonConfig = () => {
    if (!status || !status.success) {
      return { text: 'AI 검진설계 시작하기', action: onStartDesign };
    }

    switch (status.action) {
      case 'show_result':
        return { text: '내 검진설계 결과 보기', action: onViewResult };
      case 'show_design_start':
      case 'show_step2_ready':
        return { text: 'AI 검진설계 시작하기', action: onStartDesign };
      case 'redirect_to_auth':
        return { text: '본인 인증하고 검진설계 받기', action: onAuth };
      case 'show_processing':
        return { text: '분석 진행 중...', action: () => {} };
      default:
        return { text: 'AI 검진설계 시작하기', action: onStartDesign };
    }
  };

  const btn = getButtonConfig();
  const isProcessing = status?.action === 'show_processing';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
    }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a5f', marginBottom: '12px' }}>
          AI 맞춤 건강검진 설계
        </h1>
        <p style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.6, maxWidth: '400px' }}>
          건강검진 데이터를 AI가 분석하여<br />
          나에게 꼭 필요한 검진 항목을 추천합니다
        </p>
      </div>

      {/* 혜택 리스트 */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '24px',
        width: '100%', maxWidth: '400px', marginBottom: '32px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}>
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

      {/* 상태 메시지 */}
      {status?.has_health_data && !status?.has_design && (
        <div style={{
          background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px',
          padding: '12px 20px', marginBottom: '16px', maxWidth: '400px', width: '100%',
        }}>
          <p style={{ fontSize: '13px', color: '#065f46', margin: 0 }}>
            ✅ 건강검진 데이터가 준비되어 있습니다. 바로 설계를 시작할 수 있어요!
          </p>
        </div>
      )}

      {status?.action === 'redirect_to_auth' && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px',
          padding: '12px 20px', marginBottom: '16px', maxWidth: '400px', width: '100%',
        }}>
          <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
            건강검진 데이터가 필요합니다. 본인 인증 후 데이터를 불러옵니다.
          </p>
        </div>
      )}

      {/* CTA 버튼 */}
      <button
        onClick={btn.action}
        disabled={isProcessing}
        style={{
          width: '100%', maxWidth: '400px', padding: '16px',
          background: isProcessing ? '#9ca3af' : '#2563eb',
          color: 'white', border: 'none', borderRadius: '12px',
          fontSize: '16px', fontWeight: 700, cursor: isProcessing ? 'default' : 'pointer',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
        }}
      >
        {btn.text}
      </button>

      {!uuid && (
        <p style={{ marginTop: '16px', fontSize: '12px', color: '#9ca3af' }}>
          파트너 링크를 통해 접속해주세요
        </p>
      )}
    </div>
  );
};

export default IntroLandingPage;
