import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_ENDPOINTS } from '../../config/api';
import LandingPage from './LandingPage';
import IntroLandingPage from './IntroLandingPage';

type PageType = 'landing' | 'result' | 'intro' | 'payment';

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

          if (result.action === 'redirect_to_auth') {
            window.location.href = result.redirect_url;
            return;
          }
          
          // URL 파라미터에 page가 있으면 해당 페이지로, 없으면 intro
          // result 페이지는 제거됨
          if (page === 'payment' || page === 'landing') {
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

  // 로딩 중이더라도 이전 컴포넌트를 유지하여 이벤트 리스너 마운트 해제 방지
  const renderContent = () => {
    // result 페이지는 제거 - 리포트 생성 중에는 intro 페이지에서 스피너 표시
    if (currentPage === 'payment') {
      return <LandingPage status={status} />;
    }

    if (currentPage === 'intro') {
      return <IntroLandingPage status={status} />;
    }

    return <LandingPage />;
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {renderContent()}
      
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
