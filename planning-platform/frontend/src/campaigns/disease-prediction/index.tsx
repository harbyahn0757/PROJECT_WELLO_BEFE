import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_ENDPOINTS } from '../../config/api';
import { checkAllTermsAgreement, saveTermsAgreement } from '../../utils/termsAgreement';
import TermsAgreementModal from '../../components/terms/TermsAgreementModal';
import LandingPage from './LandingPage';
import IntroLandingPage from './IntroLandingPage';
import ReadyModal from './ReadyModal';

type PageType = 'landing' | 'result' | 'intro' | 'payment' | 'terms';

// 리포트 생성 중 컴포넌트
const ReportGeneratingPage: React.FC<{ status: PartnerStatus | null; onMount?: () => void }> = ({ status, onMount }) => {
  const location = useLocation();
  
  useEffect(() => {
    // 마운트 시 콜백 호출 (ReadyModal 닫기 용도)
    if (onMount) {
      onMount();
    }
  }, [onMount]);
  
  useEffect(() => {
    if (status?.has_report && status?.redirect_url) {
      console.log('[DiseasePrediction] 리포트 생성 완료, 리다이렉트:', status.redirect_url);
      window.location.href = status.redirect_url;
      return;
    }
    
    // 3초마다 상태 체크 (최대 3분)
    const pollingStartTime = Date.now();
    const MAX_POLLING_MS = 3 * 60 * 1000; // 3분
    const checkInterval = setInterval(async () => {
      // 3분 타임아웃 체크
      if (Date.now() - pollingStartTime > MAX_POLLING_MS) {
        clearInterval(checkInterval);
        console.log('[ReportGeneratingPage] 3분 폴링 타임아웃');
        // 토스트 알림
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:14px 24px;border-radius:12px;font-size:14px;z-index:99999;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:90vw;line-height:1.5';
        toast.innerHTML = '리포트 생성에 시간이 걸리고 있습니다.<br/>잠시 후 다시 접속해주세요.';
        document.body.appendChild(toast);
        return;
      }
      try {
        const urlParams = new URLSearchParams(location.search);
        const uuid = urlParams.get('uuid');
        const partner = urlParams.get('partner');
        const apiKey = urlParams.get('api_key');
        const oid = urlParams.get('oid');
        
        // 1. oid가 있으면 우선적으로 리포트 API 폴링
        if (oid) {
          console.log('[ReportGeneratingPage] oid 기반 리포트 폴링 중:', oid);
          const response = await fetch(API_ENDPOINTS.GET_REPORT(oid));
          const result = await response.json();
          
          if (result.success && (result.report_url || result.mediarc_response)) {
            clearInterval(checkInterval);
            if (result.report_url) {
              console.log('[ReportGeneratingPage] 리포트 생성 완료 (oid), 리다이렉트');
            } else if (result.mediarc_response) {
              console.log('⚠️ [ReportGeneratingPage] PDF 없음, 데이터만으로 리다이렉트:', {
                oid: oid,
                has_mediarc_data: !!result.mediarc_response
              });
            }
            window.location.href = `/disease-report?oid=${oid}`;
            return;
          }
        }
        
        // 2. uuid/partner가 있으면 상태 체크 API 폴링 (기존 로직)
        if (uuid && partner) {
          const checkUrl = `${API_ENDPOINTS.CHECK_PARTNER_STATUS}?uuid=${uuid}&partner=${partner}${apiKey ? `&api_key=${apiKey}` : ''}`;
          const response = await fetch(checkUrl);
          const result: PartnerStatus = await response.json();
          
          console.log('[ReportGeneratingPage] 상태 재체크 (uuid):', result);
          
          if (result.has_report && result.redirect_url) {
            clearInterval(checkInterval);
            console.log('[ReportGeneratingPage] 리포트 생성 완료 (uuid), 리다이렉트:', result.redirect_url);
            window.location.href = result.redirect_url;
          }
        }
      } catch (error) {
        console.error('[ReportGeneratingPage] 상태 체크 오류:', error);
      }
    }, 3000);
    
    return () => clearInterval(checkInterval);
  }, [status, location.search]);
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '20px' }}>🔄</div>
      <h2 style={{ fontSize: '20px', marginBottom: '10px', color: '#333' }}>
        AI 질병예측 리포트 생성 중...
      </h2>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '30px' }}>
        잠시만 기다려주세요.<br />
        곧 완성된 리포트 화면으로 이동합니다.
      </p>
      <div className="loading-spinner" style={{
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #8B7355',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export interface PartnerStatus {
  case_id: string;
  action: string;
  redirect_url: string;
  has_report: boolean;
  has_checkup_data: boolean;
  has_payment: boolean;
  requires_payment: boolean;
  payment_amount?: number; // 파트너별 결제 금액 (DB에서 조회)
  partner_id?: string;     // 식별된 파트너 ID
  is_welno_user: boolean;
  error_message?: string;  // 결제 실패 에러 메시지
  failed_oid?: string;     // 실패한 결제 OID
  data_quality?: 'good' | 'partial' | 'insufficient';  // 검진데이터 품질
  data_quality_message?: string;  // 품질 안내 메시지
  data_quality_valid_count?: number;
  data_quality_total_count?: number;
  data_quality_invalid_fields?: string[];
}

const DiseasePredictionCampaign: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('intro'); // 초기값을 'intro'로 변경하여 IntroLandingPage가 먼저 보이도록
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PartnerStatus | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);  // ✅ 생성 준비 모달
  const navigate = useNavigate();
  const location = useLocation();

  // 브라우저 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // popstate 이벤트는 이미 URL이 변경된 후 발생하므로
      // location.search를 확인하여 페이지 상태 동기화
      const urlParams = new URLSearchParams(location.search);
      const page = urlParams.get('page');
      
      console.log('[DiseasePrediction] 브라우저 뒤로가기/앞으로가기 감지:', { page, location: location.search });
      
      if (page && ['payment', 'landing', 'terms', 'intro', 'result'].includes(page)) {
        setCurrentPage(page as PageType);
        setLoading(false);
        console.log('[DiseasePrediction] 페이지 변경:', page);
      } else if (!page) {
        setCurrentPage('intro');
        setLoading(false);
        console.log('[DiseasePrediction] intro 페이지로 복귀');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.search]);

  useEffect(() => {
    const checkUserStatus = async () => {
      const urlParams = new URLSearchParams(location.search);
      const page = urlParams.get('page'); // string | null
      const partner = urlParams.get('partner');
      const uuid = urlParams.get('uuid');
      const oid = urlParams.get('oid');
      const data = urlParams.get('data');
      const apiKey = urlParams.get('api_key');
      
      console.log('[DiseasePrediction] URL 파라미터 확인:', { 
        page, partner, uuid, oid,
        data_exists: !!data, 
        data_length: data?.length || 0,
        apiKey: !!apiKey,
        currentPage_before: currentPage
      });
      
      // ✅ page=result이고 oid가 있으면 uuid 없어도 결과 페이지로 진입 허용
      if (page === 'result' && oid) {
        console.log('[DiseasePrediction] page=result & oid 감지, 결과 페이지로 설정');
        setCurrentPage('result');
        setLoading(false);
        return;
      }
      
      // page 파라미터가 없을 때 처리
      if (!page) {
        // 이미 payment나 terms 페이지에 있다면 유지 (약관 동의 후 이동 중일 수 있음)
        if (currentPage === 'payment' || currentPage === 'terms') {
          console.log('[DiseasePrediction] page 파라미터 없지만 현재 페이지 유지:', currentPage);
          setLoading(false);
          return;
        }
        // ✅ page 없어도 intro로 설정은 하되, 상태 체크는 계속 진행
        console.log('[DiseasePrediction] page 파라미터 없음, intro로 설정하고 상태 체크 진행');
        setCurrentPage('intro');
        // return 제거 - 아래 상태 체크 로직 계속 실행
      }

      // 1. 약관 동의 체크는 플로팅 버튼 클릭 시에만 수행
      // (랜딩페이지를 먼저 보여주기 위해 페이지 로드 시 약관 체크 제거)

      // result 페이지는 제거됨 - 리포트 생성 중에는 intro 페이지에서 스피너 표시

      // 2. UUID가 있으면 상태 체크 API 호출 (partner는 빈 문자열일 수 있음)
      if (uuid) {
        try {
          const response = await fetch(API_ENDPOINTS.CHECK_PARTNER_STATUS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partner_id: partner || null,
              api_key: apiKey || null,
              uuid: uuid,
              encrypted_data: data || null
            })
          });

          if (!response.ok) throw new Error('상태 체크 실패');

          const result: PartnerStatus = await response.json();
          console.log('[DiseasePrediction] 상태 체크 결과:', result);
          setStatus(result);

          // action에 따라 분기
          if (result.action === 'show_report') {
            console.log('[DiseasePrediction] 리포트 있음, 결과 페이지로 이동:', result.redirect_url);
            window.location.href = result.redirect_url;
            return;
          }

          // ✅ 결제 실패 건 안내
          if (result.action === 'show_payment_failed') {
            console.log('[DiseasePrediction] 결제 실패 안내:', result.error_message);
            alert(`결제 실패\n\n사유: ${result.error_message}\n\n다시 시도해주세요.`);
            setCurrentPage('intro');
            setLoading(false);
            return;
          }

          // ✅ 생성 준비 완료 모달 표시
          if (result.action === 'show_ready_modal') {
            console.log('[DiseasePrediction] 생성 준비 완료, 모달 표시');
            setShowReadyModal(true);
            setCurrentPage('intro');
            setLoading(false);
            return;
          }

          // redirect_to_auth는 플로팅 버튼 클릭 시 처리하므로 여기서는 무시
          // (랜딩페이지를 먼저 보여주기 위해)
          if (result.action === 'redirect_to_auth') {
            console.log('[DiseasePrediction] 데이터 수집 필요 (플로팅 버튼 클릭 시 처리)');
            // 상태만 저장하고 리다이렉트하지 않음
            // 플로팅 버튼 클릭 시 약관 체크 후 결제 진행, 결제 완료 후 데이터 부족하면 그때 인증 페이지로 이동
          }

          // show_terms_modal은 플로팅 버튼 클릭 시 처리하므로 여기서는 무시
          // (랜딩페이지를 먼저 보여주기 위해)
          if (result.action === 'show_terms_modal') {
            console.log('[DiseasePrediction] 약관 동의 필요 (플로팅 버튼 클릭 시 처리)');
            // 상태만 저장하고 리다이렉트하지 않음
            // 플로팅 버튼 클릭 시 약관 체크하도록 처리
          }
          
          // URL 파라미터에 page가 있으면 해당 페이지로, 없으면 intro
          const validPages: PageType[] = ['payment', 'landing', 'terms', 'intro', 'result'];
          if (page && validPages.includes(page as PageType)) {
            console.log('[DiseasePrediction] currentPage 설정 (상태 체크 후):', page, '현재 currentPage:', currentPage);
            // page 파라미터가 있으면 무조건 설정 (navigate 후 재실행 방지)
            setCurrentPage(page as PageType);
          } else {
            console.log('[DiseasePrediction] currentPage 설정: intro (page 파라미터 없음)');
            // page 파라미터가 없을 때만 intro로 설정 (이미 payment나 terms로 설정된 경우 유지)
            if (currentPage !== 'payment' && currentPage !== 'landing' && currentPage !== 'terms') {
              setCurrentPage('intro');
            }
          }
          
        } catch (error) {
          console.error('[DiseasePrediction] 상태 체크 오류:', error);
          setCurrentPage('intro');
        }
      } else {
        // 파트너 정보 없으면 기본 intro (소개 페이지)
        setCurrentPage('intro');
      }

      setLoading(false);
      console.log('[DiseasePrediction] loading 상태: false로 변경');
    };

    checkUserStatus();
  }, [navigate, location.search]);

  // 🔧 URL 파라미터로 localStorage 정리 기능
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const clearStorage = urlParams.get('clear_storage');
    
    if (clearStorage === 'true') {
      console.log('[디버그] URL 파라미터로 localStorage 정리 요청됨');
      
      const keysToRemove = [
        'collectingStatus',
        'welno_password_modal_open',
        'welno_tilko_auth_waiting',
        'welno_tilko_auth_method_selection',
        'welno_tilko_info_confirming',
        'manualCollect'
      ];
      
      let removedCount = 0;
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          removedCount++;
        }
      });
      
      console.log('[디버그] URL 파라미터 localStorage 정리 완료:', { removedCount });
      
      // URL에서 clear_storage 파라미터 제거
      urlParams.delete('clear_storage');
      const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
      
      // 잠시 후 페이지 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [location.search]);

  useEffect(() => {
    document.title = 'Xog: 쏙 - AI 질병예측 리포트';
  }, []);

  // 커스텀 이벤트로 currentPage 변경 요청 수신
  useEffect(() => {
    const handlePageChange = (event: CustomEvent<{ page: PageType }>) => {
      const { page } = event.detail;
      console.log('[DiseasePrediction] 커스텀 이벤트로 currentPage 변경 요청:', page);
      if (page === 'payment' || page === 'landing' || page === 'terms') {
        setCurrentPage(page);
        setLoading(false);
      }
    };

    window.addEventListener('welno-campaign-page-change', handlePageChange as EventListener);
    return () => {
      window.removeEventListener('welno-campaign-page-change', handlePageChange as EventListener);
    };
  }, []);

  // page=terms일 때 약관 모달 표시
  useEffect(() => {
    if (currentPage === 'terms') {
      setShowTermsModal(true);
    }
  }, [currentPage]);

  // currentPage 변경 시 스크롤을 맨 위로 이동 및 DOM 확인
  useEffect(() => {
    if (currentPage === 'payment') {
      console.log('[DiseasePrediction] payment 페이지로 전환, 스크롤 맨 위로 이동');
      console.log('[DiseasePrediction] DOM 요소 확인:', {
        container: document.querySelector('[data-current-page="payment"]'),
        paymentPage: document.querySelector('[data-page="payment"]'),
        introPage: document.querySelector('[data-page="intro"]'),
        companyInfo: document.querySelector('.company-info')
      });
      
      // 즉시 스크롤 (smooth 대신 auto로 빠르게)
      window.scrollTo({ top: 0, behavior: 'auto' });
      
      // 약간의 지연 후 다시 확인 및 스크롤
      setTimeout(() => {
        const container = document.querySelector('[data-current-page="payment"]');
        const paymentPage = document.querySelector('[data-page="payment"]');
        const introPage = document.querySelector('[data-page="intro"]');
        const companyInfo = document.querySelector('.company-info');
        
        console.log('[DiseasePrediction] 100ms 후 DOM 확인:', { 
          container: !!container, 
          paymentPage: !!paymentPage,
          introPage: !!introPage, // intro가 남아있으면 문제
          companyInfo: !!companyInfo // company-info가 있어야 LandingPage가 제대로 렌더링된 것
        });
        
        if (introPage) {
          console.error('[DiseasePrediction] ⚠️ intro 요소가 아직 DOM에 남아있음!');
        }
        
        if (!companyInfo) {
          console.error('[DiseasePrediction] ⚠️ company-info 섹션이 없음! LandingPage가 제대로 렌더링되지 않았을 수 있음');
        }
        
        if (paymentPage) {
          paymentPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (container) {
          container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [currentPage]);

  // 로딩 중이더라도 이전 컴포넌트를 유지하여 이벤트 리스너 마운트 해제 방지
  // renderContent를 함수가 아닌 직접 JSX로 변경하여 최신 currentPage 참조 보장
  console.log('[DiseasePrediction] 렌더링:', { currentPage, loading, hasStatus: !!status });
  
  let content;
  if (currentPage === 'result') {
    console.log('🟣 [DiseasePrediction] ===== 리포트 생성 중 화면 =====');
    content = <ReportGeneratingPage status={status} onMount={() => setShowReadyModal(false)} />;
  } else if (currentPage === 'payment') {
    console.log('🔵 [DiseasePrediction] ===== LandingPage 렌더링 (payment) =====');
    console.log('🔵 [DiseasePrediction] 이 컴포넌트는 혜택 리스트가 "✅ 10대 주요 질환..."이고, 하단에 "기업정보" 섹션이 있어야 함');
    content = <LandingPage key="payment-page" status={status} />;
  } else if (currentPage === 'terms') {
    console.log('🟡 [DiseasePrediction] ===== IntroLandingPage 렌더링 (terms) =====');
    content = <IntroLandingPage key="terms-page" status={status} />;
  } else if (currentPage === 'intro') {
    console.log('🟢 [DiseasePrediction] ===== IntroLandingPage 렌더링 (intro) =====');
    console.log('🟢 [DiseasePrediction] 이 컴포넌트는 혜택 리스트가 "✓ 20대 질병..."이고, "기업정보" 섹션이 없어야 함');
    content = <IntroLandingPage key="intro-page" status={status} />;
  } else {
    console.log('⚪ [DiseasePrediction] ===== LandingPage 렌더링 (기본값, currentPage:', currentPage, ') =====');
    content = <LandingPage key="landing-default" />;
  }

  const urlParams = new URLSearchParams(location.search);
  const uuid = urlParams.get('uuid');
  const urlPartner = urlParams.get('partner');
  const apiKey = urlParams.get('api_key');
  const data = urlParams.get('data');
  // status의 partner_id를 우선 사용 (백엔드에서 반환한 정확한 값)
  const partner = status?.partner_id || urlPartner || 'kindhabit';

  return (
    <div 
      style={{ position: 'relative', minHeight: '100vh' }} 
      data-current-page={currentPage}
      key={`container-${currentPage}`} // currentPage 변경 시 컨테이너도 완전히 재생성
    >
      {content}
      
      {/* 약관 모달 (page=terms일 때 표시) */}
      {showTermsModal && (
        <TermsAgreementModal
          isOpen={showTermsModal}
          onClose={() => {
            setShowTermsModal(false);
            // 메인 페이지로 돌아가기
            const params = new URLSearchParams();
            if (uuid) params.set('uuid', uuid);
            if (partner) params.set('partner', partner);
            if (apiKey) params.set('api_key', apiKey);
            if (data) params.set('data', data);
            navigate(`/campaigns/disease-prediction?${params.toString()}`);
          }}
          onConfirm={async (agreedTerms: any, termsAgreement: any) => {
            // 약관 저장
            if (uuid && termsAgreement && partner) {
              await saveTermsAgreement(
                uuid,
                partner,
                {
                  terms_service: termsAgreement.terms_service,
                  terms_privacy: termsAgreement.terms_privacy,
                  terms_sensitive: termsAgreement.terms_sensitive,
                  terms_marketing: termsAgreement.terms_marketing,
                },
                undefined, // oid 없음
                undefined, // userInfo 없음
                apiKey || undefined
              );
            }
            
            // 약관 모달 닫기
            setShowTermsModal(false);
            
            // navigate 직후 location.search 변경 전에 currentPage를 즉시 업데이트하기 위해 커스텀 이벤트 발생
            window.dispatchEvent(new CustomEvent('welno-campaign-page-change', { 
              detail: { page: 'payment' } 
            }));
            
            // 결제 페이지로 이동 (모든 파라미터 포함, replace: false로 히스토리 추가)
            const params = new URLSearchParams();
            params.set('page', 'payment');
            if (uuid) params.set('uuid', uuid);
            if (partner) params.set('partner', partner);
            if (apiKey) params.set('api_key', apiKey);
            if (data) params.set('data', data);
            navigate(`/campaigns/disease-prediction?${params.toString()}`, { replace: false });
          }}
        />
      )}
      
      {/* ✅ 생성 준비 완료 모달 */}
      {showReadyModal && status && (
        <ReadyModal
          onGenerate={async () => {
            try {
              const query = new URLSearchParams(location.search);
              const uuid = query.get('uuid');
              const partner = query.get('partner');
              const oid = query.get('oid');
              const apiKey = query.get('api_key');

              // oid 없어도 uuid + partner로 조회 가능
              console.log('[ReadyModal] 리포트 생성 시작:', { oid, uuid, partner, hasApiKey: !!apiKey });

              // 직접 생성 API 호출 (oid 없어도 uuid + partner로 조회)
              const response = await fetch(API_ENDPOINTS.GENERATE_REPORT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  oid: oid || undefined,
                  uuid,
                  partner_id: partner,
                  api_key: apiKey || undefined
                })
              });

              const result = await response.json();

              if (result.success) {
                console.log('[ReadyModal] 리포트 생성 시작 성공');
                setShowReadyModal(false);
                
                // 결과 페이지로 직접 이동 (분석 데이터는 이미 DB에 저장됨)
                const resultUrl = oid 
                  ? `/disease-report?oid=${oid}`
                  : `/disease-report?uuid=${uuid}&hospital_id=PEERNINE`;
                
                console.log('[ReadyModal] 결과 페이지로 이동:', resultUrl);
                window.location.href = resultUrl;
              } else {
                alert('리포트 생성 시작 실패: ' + result.detail);
              }
            } catch (error) {
              console.error('[ReadyModal] 리포트 생성 오류:', error);
              alert('서버 통신 오류가 발생했습니다.');
            }
          }}
          onClose={() => setShowReadyModal(false)}
          userName={status?.partner_id}
        />
      )}

      {/* 전역 로딩 오버레이 (마운트 해제 없이 위에 덮음) */}
      {loading && !status && (
        <div style={{ 
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          zIndex: 9999,
          fontSize: '18px',
          color: '#666'
        }}>
          로딩 중...
        </div>
      )}
      {/* 디버깅: 로딩 상태 표시 */}
      {loading && status && (
        <div style={{
          position: 'fixed',
          top: 10,
          right: 10,
          padding: '10px',
          backgroundColor: 'orange',
          color: 'white',
          zIndex: 10000,
          fontSize: '12px'
        }}>
          ⚠️ loading=true, status 있음 (스피너 안 보임)
        </div>
      )}
      
    </div>
  );
};

export default DiseasePredictionCampaign;
