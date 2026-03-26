/**
 * 검진설계 캠페인 오케스트레이터
 * disease-prediction/index.tsx 패턴 참조.
 *
 * URL: /campaigns/checkup-design?uuid={uuid}&partner={pid}&hospital={hid}
 * 상태 머신: check-status API → case A~E → 페이지 자동 분기
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import IntroLandingPage from './IntroLandingPage';
import ResultPage from './ResultPage';

type PageType = 'intro' | 'design' | 'processing' | 'result';

interface CheckupDesignStatus {
  success: boolean;
  case_id: string;
  action: string;
  has_design: boolean;
  has_health_data: boolean;
  design_status?: string;
  design_request_id?: number;
  message?: string;
}

const getApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1';
  if (window.location.hostname === 'welno.kindhabit.com') return '/welno-api/v1';
  return '/api/v1';
};

const API_BASE = getApiBase();

const CheckupDesignCampaign: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState<PageType>('intro');
  const [status, setStatus] = useState<CheckupDesignStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // URL 파라미터 (평문 또는 암호화)
  const urlParams = new URLSearchParams(location.search);
  const [uuid, setUuid] = useState(urlParams.get('uuid') || '');
  const [partnerId, setPartnerId] = useState(urlParams.get('partner') || 'welno');
  const [hospitalId, setHospitalId] = useState(urlParams.get('hospital') || '');
  const [healthData, setHealthData] = useState<any>(null); // 암호화 링크의 검진 데이터
  const encryptedData = urlParams.get('data') || '';

  // 암호화된 data 파라미터 복호화
  useEffect(() => {
    if (!encryptedData) return;
    fetch(`${API_BASE}/partner-office/alimtalk/decrypt-landing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: encryptedData }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setUuid(d.uuid || '');
          setHospitalId(d.hospital || '');
          setHealthData(d); // bmi, bphigh 등 검진 데이터 저장
        }
      })
      .catch(e => console.error('복호화 실패:', e));
  }, [encryptedData]);

  // ── 상태 체크 ──
  const checkUserStatus = useCallback(async () => {
    if (!uuid) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/checkup-design/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          partner_id: partnerId,
          hospital_id: hospitalId || undefined,
        }),
      });
      const data: CheckupDesignStatus = await response.json();
      setStatus(data);

      if (!data.success) {
        setCurrentPage('intro');
        setLoading(false);
        return;
      }

      // 상태 머신 분기
      switch (data.action) {
        case 'show_result':
          setCurrentPage('result');
          break;
        case 'show_step2_ready':
          // Step1 완료 → 검진설계 페이지로 이동 (Step2 진행)
          setCurrentPage('design');
          break;
        case 'show_design_start':
          // 데이터 있음 → 검진설계 시작 가능
          setCurrentPage('intro');
          break;
        case 'redirect_to_auth':
          // 데이터 없음 → 인증 필요 (intro에서 안내)
          setCurrentPage('intro');
          break;
        case 'show_processing':
          setCurrentPage('processing');
          break;
        default:
          setCurrentPage('intro');
      }
    } catch (e) {
      console.error('[CheckupDesignCampaign] 상태 체크 실패:', e);
      setCurrentPage('intro');
    } finally {
      setLoading(false);
    }
  }, [uuid, partnerId, hospitalId]);

  useEffect(() => {
    checkUserStatus();
  }, [checkUserStatus]);

  // ── "검진설계 시작" 버튼 클릭 ──
  const handleStartDesign = () => {
    // 검진설계 메인 페이지로 이동 (기존 CheckupDesignPage 재사용)
    const params = new URLSearchParams();
    if (uuid) params.set('uuid', uuid);
    if (hospitalId) params.set('hospital', hospitalId);
    params.set('partner', partnerId);
    navigate(`/checkup-design?${params.toString()}`);
  };

  // ── "본인 인증" 버튼 클릭 ──
  const handleAuth = () => {
    const returnTo = `/campaigns/checkup-design?uuid=${uuid}&partner=${partnerId}&hospital=${hospitalId}`;
    navigate(`/login?return_to=${encodeURIComponent(returnTo)}&mode=campaign`);
  };

  // ── "기존 데이터로 바로 설계" (알림톡 링크 검진 데이터 사용) ──
  const handleStartDesignWithData = (data: any) => {
    const params = new URLSearchParams();
    if (uuid) params.set('uuid', uuid);
    if (hospitalId) params.set('hospital', hospitalId);
    params.set('partner', partnerId);
    params.set('mode', 'link_data'); // 링크 데이터 모드
    navigate(`/checkup-design?${params.toString()}`, { state: { linkHealthData: data } });
  };

  // ── "Tilko 다년간 정밀 설계" ──
  const handleAuthMultiYear = () => {
    const returnTo = `/campaigns/checkup-design?uuid=${uuid}&partner=${partnerId}&hospital=${hospitalId}`;
    navigate(`/login?return_to=${encodeURIComponent(returnTo)}&mode=multi_year`);
  };

  // ── "결과 보기" ──
  const handleViewResult = () => {
    setCurrentPage('result');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '14px' }}>검진설계 상태 확인 중...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── 페이지 렌더링 ──
  switch (currentPage) {
    case 'result':
      return (
        <ResultPage
          uuid={uuid}
          hospitalId={hospitalId}
          partnerId={partnerId}
        />
      );

    case 'processing':
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#374151', fontSize: '16px', fontWeight: 600 }}>AI 검진설계 분석 중...</p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>잠시만 기다려주세요. 자동으로 결과가 표시됩니다.</p>
          <button
            onClick={() => checkUserStatus()}
            style={{ marginTop: '20px', padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
          >
            새로고침
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );

    case 'design':
      // Step2 준비됨 → 검진설계 페이지로 바로 이동
      handleStartDesign();
      return null;

    case 'intro':
    default:
      return (
        <IntroLandingPage
          uuid={uuid}
          partnerId={partnerId}
          hospitalId={hospitalId}
          status={status}
          healthData={healthData}
          onStartDesign={handleStartDesign}
          onStartDesignWithData={handleStartDesignWithData}
          onAuth={handleAuth}
          onAuthMultiYear={handleAuthMultiYear}
          onViewResult={handleViewResult}
        />
      );
  }
};

export default CheckupDesignCampaign;
