import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_ENDPOINTS } from '../../config/api';
import { checkAllTermsAgreement, saveTermsAgreement } from '../../utils/termsAgreement';
import TermsAgreementModal from '../../components/terms/TermsAgreementModal';
import LandingPage from './LandingPage';
import IntroLandingPage from './IntroLandingPage';

type PageType = 'landing' | 'result' | 'intro' | 'payment' | 'terms';

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
}

const DiseasePredictionCampaign: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PartnerStatus | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkUserStatus = async () => {
      const urlParams = new URLSearchParams(location.search);
      const page = urlParams.get('page') as PageType;
      const partner = urlParams.get('partner');
      const uuid = urlParams.get('uuid');
      const data = urlParams.get('data');
      const apiKey = urlParams.get('api_key');

      // 1. 약관 동의 체크는 플로팅 버튼 클릭 시에만 수행
      // (랜딩페이지를 먼저 보여주기 위해 페이지 로드 시 약관 체크 제거)

      // result 페이지는 제거됨 - 리포트 생성 중에는 intro 페이지에서 스피너 표시

      // 2. 파트너 또는 API Key & UUID가 있는 경우 상태 체크 API 호출
      if ((partner || apiKey) && uuid) {
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
            navigate(result.redirect_url);
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
          // result 페이지는 제거됨
          if (page === 'payment' || page === 'landing' || page === 'terms') {
            setCurrentPage(page);
          } else {
            setCurrentPage('intro');
          }
          
        } catch (error) {
          console.error('[DiseasePrediction] 상태 체크 오류:', error);
          setCurrentPage('intro');
        }
      } else {
        // 파트너 정보 없으면 기본 landing (결제 페이지)
        setCurrentPage('landing');
      }

      setLoading(false);
    };

    checkUserStatus();
  }, [navigate, location.search]);

  useEffect(() => {
    document.title = 'Xog: 쏙 - AI 질병예측 리포트';
  }, []);

  // page=terms일 때 약관 모달 표시
  useEffect(() => {
    if (currentPage === 'terms') {
      setShowTermsModal(true);
    }
  }, [currentPage]);

  // 로딩 중이더라도 이전 컴포넌트를 유지하여 이벤트 리스너 마운트 해제 방지
  const renderContent = () => {
    // result 페이지는 제거 - 리포트 생성 중에는 intro 페이지에서 스피너 표시
    if (currentPage === 'payment') {
      return <LandingPage status={status} />;
    }

    if (currentPage === 'terms') {
      // 약관 모달이 표시되는 동안 intro 페이지 표시
      return <IntroLandingPage status={status} />;
    }

    if (currentPage === 'intro') {
      return <IntroLandingPage status={status} />;
    }

    return <LandingPage />;
  };

  const urlParams = new URLSearchParams(location.search);
  const uuid = urlParams.get('uuid');
  const urlPartner = urlParams.get('partner');
  const apiKey = urlParams.get('api_key');
  const data = urlParams.get('data');
  // status의 partner_id를 우선 사용 (백엔드에서 반환한 정확한 값)
  const partner = status?.partner_id || urlPartner || 'kindhabit';

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {renderContent()}
      
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
          onConfirm={async (agreedTerms, termsAgreement) => {
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
            
            // 결제 페이지로 이동 (모든 파라미터 포함)
            const params = new URLSearchParams();
            params.set('page', 'payment');
            if (uuid) params.set('uuid', uuid);
            if (partner) params.set('partner', partner);
            if (apiKey) params.set('api_key', apiKey);
            if (data) params.set('data', data);
            navigate(`/campaigns/disease-prediction?${params.toString()}`);
          }}
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
    </div>
  );
};

export default DiseasePredictionCampaign;
