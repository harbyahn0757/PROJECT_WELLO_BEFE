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
import TermsAgreementModal from '../../components/terms/TermsAgreementModal';
import { checkAllTermsAgreement, saveTermsAgreement } from '../../utils/termsAgreement';
import { STORAGE_KEYS, StorageManager } from '../../constants/storage';

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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingDesignAction, setPendingDesignAction] = useState<(() => void) | null>(null);

  // URL 파라미터 (평문 / lookup_key / 레거시 암호화)
  const urlParams = new URLSearchParams(location.search);
  // P0 #1 hotfix v2: URL query 가 사라진 재진입 시 localStorage 폴백 (어제 hotfix A-1/A-2 가 저장한 값)
  const [uuid, setUuid] = useState(
    urlParams.get('uuid') ||
    StorageManager.getItem<string>(STORAGE_KEYS.PATIENT_UUID) ||
    ''
  );
  const [partnerId, setPartnerId] = useState(urlParams.get('partner') || 'welno');
  const [hospitalId, setHospitalId] = useState(
    urlParams.get('hospital') ||
    StorageManager.getItem<string>(STORAGE_KEYS.HOSPITAL_ID) ||
    ''
  );
  const [healthData, setHealthData] = useState<any>(null);
  const linkKey = urlParams.get('key') || '';
  const encryptedData = (() => {
    const match = location.search.match(/[?&]data=([^&]*)/);
    return match ? decodeURIComponent(match[1]) : '';
  })();

  // 링크 데이터 로드 (key 방식 우선 → data 암호화 fallback)
  useEffect(() => {
    const loadLinkData = async () => {
      let d: any = null;

      // 1) lookup_key 방식 (신규)
      if (linkKey) {
        try {
          const r = await fetch(`${API_BASE}/partner-office/alimtalk/link-data/${linkKey}`);
          if (r.ok) d = await r.json();
        } catch (e) { /* fallback */ }
      }

      // 2) 레거시 암호화 data 방식
      if (!d && encryptedData) {
        try {
          const r = await fetch(`${API_BASE}/partner-office/alimtalk/decrypt-landing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: encryptedData }),
          });
          if (r.ok) d = await r.json();
        } catch (e) { /* fallback */ }
      }

      if (!d || !d.success) return;

      const resolvedUuid = d.uuid || '';
      const resolvedHospital = d.hospital || '';
      setHealthData(d);

      // 건강데이터 DB 저장
      if (d.bmi || d.bphigh || d.blds) {
        try {
          await fetch(`${API_BASE}/checkup-design/save-link-health-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uuid: resolvedUuid, hospital_id: resolvedHospital,
              name: d.name, birthday: d.birthday, gender: d.gender,
              bmi: d.bmi, height: d.height, weight: d.weight,
              bphigh: d.bphigh, bplwst: d.bplwst, blds: d.blds,
              totchole: d.totchole, hdlchole: d.hdlchole, ldlchole: d.ldlchole,
              triglyceride: d.triglyceride, hmg: d.hmg, gfr: d.gfr,
            }),
          });
        } catch (e) { /* ignore */ }
      }

      setUuid(resolvedUuid);
      setHospitalId(resolvedHospital);
      // P0 #1: 알림톡 lookup_key 진입 시 localStorage 저장 (재진입을 위해 영속화)
      StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, resolvedUuid);
      StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, resolvedHospital);
      if (linkKey) {
        // P0 Soft Lock: lookup_key 저장 — axios 인터셉터가 환자 API 요청 시 자동 첨부
        StorageManager.setItem(STORAGE_KEYS.ALIMTALK_LOOKUP_KEY, linkKey);
      }
    };

    if (linkKey || encryptedData) loadLinkData();
  }, [linkKey, encryptedData]);

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
          // Tilko 인증 복귀 → 데이터 있으면 바로 설계 시작
          if (urlParams.get('from_auth') === 'true') {
            handleStartDesign();
            return;
          }
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

  // processing 상태에서 5초 폴링 (auto_trigger 완료 자동 감지)
  useEffect(() => {
    if (currentPage !== 'processing') return;
    const interval = setInterval(() => {
      checkUserStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentPage, checkUserStatus]);

  // ── 설계 진입 (동의 체크 후) ──
  const doNavigateDesign = useCallback(() => {
    if (!uuid) return;
    const params = new URLSearchParams();
    params.set('uuid', uuid);
    if (hospitalId) params.set('hospital', hospitalId);
    params.set('partner', partnerId);
    navigate(`/checkup-design?${params.toString()}`);
  }, [uuid, hospitalId, partnerId, navigate]);

  // ── "검진설계 시작" 버튼 클릭 ──
  const handleStartDesign = async () => {
    if (!uuid) return;

    // from_auth=true: Tilko 인증 복귀 — 약관은 인증 전에 이미 동의함 → 스킵
    const isFromAuth = new URLSearchParams(location.search).get('from_auth') === 'true';
    if (isFromAuth) {
      console.log('[CheckupDesign] from_auth=true → 약관 스킵, 바로 설계 진입');
      doNavigateDesign();
      return;
    }

    // 약관 동의 체크
    try {
      const termsResult = await checkAllTermsAgreement(uuid, partnerId);
      console.log('[CheckupDesign] 약관 체크 결과:', termsResult.needsAgreement);
      if (termsResult.needsAgreement) {
        setPendingDesignAction(() => doNavigateDesign);
        setShowTermsModal(true);
        return;
      }
    } catch (e) {
      console.log('[CheckupDesign] 약관 체크 실패:', e);
      setPendingDesignAction(() => doNavigateDesign);
      setShowTermsModal(true);
      return;
    }
    doNavigateDesign();
  };

  // ── 이전 Tilko 세션 정리 (카카오 인앱 localStorage 잔존 방지) ──
  // ChatInterface에서도 재사용 (auth_tilko 분기)
  const clearStaleAuth = () => {
    try {
      ['tilko_info_confirming', 'tilko_auth_waiting', 'tilko_auth_completed',
       'tilko_auth_requested', 'tilko_collecting_status', 'tilko_manual_collect',
       'password_modal_open', 'tilko_session_id', 'tilko_session_data',
       'start_info_confirmation', 'tilko_selected_auth_type',
       'tilko_auth_method_selection', 'checkup_survey_panel_open'].forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  };

  // ── "본인 인증" 버튼 클릭 ──
  const handleAuth = () => {
    if (!uuid) return;
    clearStaleAuth();
    const returnTo = `/campaigns/checkup-design?uuid=${uuid}&partner=${partnerId}&hospital=${hospitalId}&from_auth=true`;
    navigate(`/login?return_to=${encodeURIComponent(returnTo)}&mode=campaign&uuid=${uuid}&partner=${partnerId}&hospital=${hospitalId}`);
  };

  // ── "기존 데이터로 바로 설계" (알림톡 링크 데이터 → DB 저장 → 일반 설계) ──
  const handleStartDesignWithData = async (data: any) => {
    try {
      // 링크 건강데이터를 welno_checkup_data에 저장 (기존 파이프라인 호환)
      await fetch(`${API_BASE}/checkup-design/save-link-health-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid, hospital_id: hospitalId,
          name: data.name, birthday: data.birthday, gender: data.gender,
          bmi: data.bmi, height: data.height, weight: data.weight,
          bphigh: data.bphigh, bplwst: data.bplwst, blds: data.blds,
          totchole: data.totchole, hdlchole: data.hdlchole, ldlchole: data.ldlchole,
          triglyceride: data.triglyceride, hmg: data.hmg, gfr: data.gfr,
          sgotast: data.sgotast, sgptalt: data.sgptalt, creatinine: data.creatinine,
          checkup_year: data.checkup_year,
        }),
      });
    } catch (e) {
      console.error('링크 데이터 저장 실패:', e);
    }
    // DB에 저장 후 일반 모드로 설계 진입
    handleStartDesign();
  };

  // ── "Tilko 다년간 정밀 설계" ──
  const handleAuthMultiYear = () => {
    if (!uuid) return;
    clearStaleAuth();
    const returnTo = `/campaigns/checkup-design?uuid=${uuid}&partner=${partnerId}&hospital=${hospitalId}&from_auth=true`;
    navigate(`/login?return_to=${encodeURIComponent(returnTo)}&mode=multi_year&uuid=${uuid}&partner=${partnerId}&hospital=${hospitalId}`);
  };

  // ── "결과 보기" ──
  const handleViewResult = () => {
    setCurrentPage('result');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '14px' }}>확인하고 있어요...</p>
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
          <p style={{ color: '#374151', fontSize: '16px', fontWeight: 600 }}>만들고 있어요...</p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>조금만 기다려주세요</p>
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
        <>
          <TermsAgreementModal
            isOpen={showTermsModal}
            onClose={() => setShowTermsModal(false)}
            onConfirm={async (agreedTerms, termsAgreement) => {
              // 약관 동의 저장 (API + localStorage) — 미저장 시 재방문마다 모달 재표시
              if (uuid) {
                await saveTermsAgreement(uuid, partnerId, termsAgreement || {
                  terms_service: agreedTerms.includes('terms-service'),
                  terms_privacy: agreedTerms.includes('terms-privacy'),
                  terms_sensitive: agreedTerms.includes('terms-sensitive'),
                  terms_marketing: agreedTerms.includes('terms-marketing'),
                });
              }
              setShowTermsModal(false);
              if (pendingDesignAction) pendingDesignAction();
            }}
          />
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
        </>
      );
  }
};

export default CheckupDesignCampaign;
