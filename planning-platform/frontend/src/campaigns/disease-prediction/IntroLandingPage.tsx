import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PartnerStatus } from './index';
import { API_ENDPOINTS } from '../../config/api';
import { checkAllTermsAgreement } from '../../utils/termsAgreement';
import PageTransitionLoader from '../../components/PageTransitionLoader';
import './styles/landing.scss';

// 이미지 임포트
import reportB1 from './assets/report_b_1.png';
import reportB7_1 from './assets/report_b_7-1.png';
import reportB2 from './assets/report_b_2.png';
import reportB3 from './assets/report_b_3.png';
import reportB4 from './assets/report_b_4.png';
import reportB5 from './assets/report_b_5.png';
import reportB6 from './assets/report_b_6.png';

interface Props {
  status: PartnerStatus | null;
}

const IntroLandingPage: React.FC<Props> = ({ status }) => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(search), [search]);

  // URL 파라미터
  const urlPartner = query.get('partner');
  const partner = status?.partner_id || urlPartner || 'kindhabit';
  const uuid = query.get('uuid') || '';
  const data = query.get('data') || '';
  const apiKey = query.get('api_key') || '';
  const oid = query.get('oid') || '';
  const autoTrigger = query.get('auto_trigger') === 'true';
  const ready = query.get('ready') === 'true';  // ✅ 생성 준비 완료 플래그
  
  // 리포트 생성 중 상태
  const [isGenerating, setIsGenerating] = useState(false);

  // 금액 포맷팅 헬퍼
  const formatAmount = (amount?: number) => {
    if (!amount) return '7,900';
    return amount.toLocaleString('ko-KR');
  };

  // 버튼 문구 및 동작 결정 로직
  const buttonConfig = useMemo(() => {
    if (!status) {
      return { text: '질병예측 리포트 보기', action: 'payment' };
    }

    const { has_payment, has_checkup_data, requires_payment } = status;

    // 1. 이미 결제했거나 무료인 경우
    if (has_payment || !requires_payment) {
      if (has_checkup_data) {
        return { text: 'AI 리포트 즉시 생성하기', action: 'generate' };
      } else {
        return { text: '본인 인증하고 리포트 보기', action: 'auth' };
      }
    }

    // 2. 결제가 필요한 경우
    return { text: '질병예측 리포트 보기', action: 'payment' };
  }, [status]);

  // 실제 버튼 클릭 처리 로직 (useCallback으로 메모이제이션)
  const handleButtonClick = useCallback(async () => {
    console.log('🎯 [IntroLanding] handleButtonClick 실행', { 
      action: buttonConfig.action, 
      partner, 
      uuid, 
      hasData: !!data,
      statusPartnerId: status?.partner_id
    });
    
    // 공통 파라미터 생성 (api_key 포함)
    // partner가 없으면 status에서 가져오거나 기본값 사용
    const finalPartner = partner || status?.partner_id || 'kindhabit';
    const params = new URLSearchParams();
    params.set('partner', finalPartner);
    if (uuid) params.set('uuid', uuid);
    if (data) params.set('data', data);
    if (apiKey) params.set('api_key', apiKey);
    const commonParams = params.toString();

    switch (buttonConfig.action) {
      case 'auth':
        const returnPath = encodeURIComponent(`/campaigns/disease-prediction?${commonParams}`);
        console.log('🔐 [IntroLanding] 인증 페이지로 이동');
        navigate(`/login?return_to=${returnPath}`);
        break;
      
      case 'generate':
        console.log('🚀 [IntroLanding] 리포트 생성 트리거');
        navigate(`/campaigns/disease-prediction?page=payment&${commonParams}&auto_trigger=true`);
        break;

      case 'payment':
      default:
        // 약관 체크 추가 (status의 partner_id 우선 사용)
        const partnerForTerms = status?.partner_id || partner || 'kindhabit';
        if (uuid && partnerForTerms) {
          try {
            console.log('[IntroLandingPage] 약관 체크 시작:', { uuid, partnerForTerms });
            const termsCheck = await checkAllTermsAgreement(uuid, partnerForTerms);
            
            if (termsCheck.needsAgreement) {
              console.log('[IntroLandingPage] 약관 동의 필요 → 약관 모달 표시');
              // 약관 모달 표시를 위해 page=terms로 이동 (모든 파라미터 포함)
              const termsParams = new URLSearchParams();
              termsParams.set('page', 'terms');
              if (uuid) termsParams.set('uuid', uuid);
              if (partnerForTerms) termsParams.set('partner', partnerForTerms);
              if (apiKey) termsParams.set('api_key', apiKey);
              if (data) termsParams.set('data', data);
              navigate(`/campaigns/disease-prediction?${termsParams.toString()}`);
              return;
            } else {
              console.log('[IntroLandingPage] 약관 동의 완료 → 스피너 표시 후 결제 진행');
            }
          } catch (error) {
            console.error('[IntroLandingPage] 약관 체크 오류:', error);
            // 약관 체크 실패해도 결제 진행 (에러 처리)
          }
        } else {
          console.warn('[IntroLandingPage] 약관 체크 불가:', { uuid, partnerForTerms });
        }
        
        // 바로 결제 페이지로 이동 (히스토리에 추가하여 뒤로가기 가능하도록)
        console.log('💳 [IntroLanding] 결제 페이지로 이동');
        // navigate 직후 location.search 변경 전에 currentPage를 즉시 업데이트하기 위해 커스텀 이벤트 발생
        window.dispatchEvent(new CustomEvent('welno-campaign-page-change', { 
          detail: { page: 'payment' } 
        }));
        navigate(`/campaigns/disease-prediction?page=payment&${commonParams}`, { replace: false });
        break;
    }
  }, [buttonConfig.action, partner, uuid, data, apiKey, navigate, status]);

  // 리포트 생성 폴링 (oid가 있고 auto_trigger가 true인 경우)
  useEffect(() => {
    if (oid && autoTrigger && !isGenerating) {
      setIsGenerating(true);
      
      const pollReport = async () => {
        try {
          const response = await fetch(API_ENDPOINTS.GET_REPORT(oid));
          const data = await response.json();
          
          if (data.success && data.report_url) {
            console.log('✅ 리포트 생성 확인됨 -> 이동');
            setIsGenerating(false);
            navigate(`/disease-report?oid=${oid}`);
            return true;
          }
          return false;
        } catch (err) {
          console.error('Polling error:', err);
          return false;
        }
      };

      // 즉시 1회 실행 후 주기적으로 실행
      pollReport();
      
      const intervalId = setInterval(async () => {
        const finished = await pollReport();
        if (finished) clearInterval(intervalId);
      }, 3000); // 3초 간격

      return () => clearInterval(intervalId);
    }
  }, [oid, autoTrigger, isGenerating, navigate]);

  // 마운트/언마운트 로그
  useEffect(() => {
    console.log('🟢 [IntroLandingPage] ===== IntroLandingPage 컴포넌트 마운트됨 =====');
    console.log('🟢 [IntroLandingPage] 이 페이지는:');
    console.log('🟢 [IntroLandingPage] - 혜택 리스트: "✓ 20대 질병 예측 분석..."');
    console.log('🟢 [IntroLandingPage] - "기업정보" 섹션이 없어야 함');
    return () => {
      console.log('🟢 [IntroLandingPage] 🗑️ IntroLandingPage 언마운트됨');
    };
  }, []);

  // 전역 플로팅 버튼 이벤트 리스너
  useEffect(() => {
    console.log('👂 [IntroLanding] 이벤트 리스너 등록됨');
    
    const onCampaignClick = () => {
      console.log('🔔 [IntroLanding] welno-campaign-click 이벤트 수신 완료!');
      handleButtonClick();
    };

    window.addEventListener('welno-campaign-click', onCampaignClick);
    
    // 플로팅 버튼 텍스트 업데이트 (마운트 시 및 status 변경 시)
    console.log('📤 [IntroLanding] 버튼 텍스트 업데이트 전송:', buttonConfig.text);
    window.dispatchEvent(new CustomEvent('welno-campaign-button-text', { 
      detail: { text: buttonConfig.text } 
    }));
    
    return () => {
      console.log('🗑️ [IntroLanding] 이벤트 리스너 제거됨');
      window.removeEventListener('welno-campaign-click', onCampaignClick);
      // ✅ 언마운트 시 플로팅 버튼 다시 표시
      if (ready) {
        window.dispatchEvent(new CustomEvent('welno-campaign-button-hide', { 
          detail: { hide: false } 
        }));
      }
    };
  }, [handleButtonClick, buttonConfig.text, ready]);

  return (
    <div className="dp-landing" data-page="intro" key="intro-page-root">
      {/* 리포트 생성 중 스피너 (리포트 생성 시에만 사용) */}
      <PageTransitionLoader isVisible={isGenerating} message="리포트를 분석 중입니다..." />
      
      <main className="dp-content" key="intro-page-main">
        {/* CTA 영역 - 상단으로 이동 */}
        <section className="payment-guide" style={{ textAlign: 'center', padding: '10px 0' }}>
          <div className="price-box" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: '5px', marginBottom: '10px', marginTop: '10px' }}>
            <span className="item-name" style={{ fontSize: '18px', letterSpacing: '-0.3px', lineHeight: '1.4', color: '#8B4513', fontWeight: '600' }}>AI 질병예측 리포트 (PDF)</span>
          </div>
          
          {/* 구분선 */}
          <hr style={{ 
            width: '100%', 
            maxWidth: '300px', 
            margin: '10px auto', 
            border: 'none', 
            borderTop: '1px solid #e0e0e0' 
          }} />
          
          <ul className="benefits" style={{ listStyle: 'none', padding: 0, margin: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <li style={{ fontSize: '14px', letterSpacing: '-0.2px', lineHeight: '1.4' }}>✓ 20대 질병 예측 분석</li>
            <li style={{ fontSize: '14px', letterSpacing: '-0.2px', lineHeight: '1.4' }}>✓ 암 발생 위험도 분석</li>
            <li style={{ fontSize: '14px', letterSpacing: '-0.2px', lineHeight: '1.4' }}>✓ 건강 나이 분석</li>
            <li style={{ fontSize: '14px', letterSpacing: '-0.2px', lineHeight: '1.4' }}>✓ PDF 리포트 다운로드</li>
          </ul>
        </section>

        {/* 소개 이미지 섹션 */}
        <section className="image-intro">
          <img src={reportB1} alt="intro 1" className="intro-img" />
          <img src={reportB2} alt="intro 2" className="intro-img" />
          <img src={reportB3} alt="intro 3" className="intro-img" />
          <img src={reportB4} alt="intro 4" className="intro-img" />
          <img src={reportB5} alt="intro 5" className="intro-img" />
          <img src={reportB6} alt="intro 6" className="intro-img" />
          <img src={reportB7_1} alt="intro extra" className="intro-img" />
        </section>
      </main>
    </div>
  );
};

export default IntroLandingPage;
