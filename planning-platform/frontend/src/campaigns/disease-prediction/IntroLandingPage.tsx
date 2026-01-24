import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PartnerStatus } from './index';
import { API_ENDPOINTS } from '../../config/api';
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
  
  // 리포트 생성 중 상태
  const [isGenerating, setIsGenerating] = useState(false);

  // 금액 포맷팅 헬퍼
  const formatAmount = (amount?: number) => {
    if (!amount) return '7,900';
    return amount.toLocaleString('ko-KR');
  };

  // 버튼 문구 및 동작 결정 로직
  const buttonConfig = useMemo(() => {
    const paymentAmount = status?.payment_amount || 7900;
    const amountText = formatAmount(paymentAmount);
    
    if (!status) {
      return { text: `${amountText}원 결제하고 리포트 보기`, action: 'payment' };
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
    return { text: `${amountText}원 결제하고 리포트 보기`, action: 'payment' };
  }, [status]);

  // 실제 버튼 클릭 처리 로직 (useCallback으로 메모이제이션)
  const handleButtonClick = useCallback(() => {
    console.log('🎯 [IntroLanding] handleButtonClick 실행', { 
      action: buttonConfig.action, 
      partner, 
      uuid, 
      hasData: !!data 
    });
    
    // 공통 파라미터 생성 (api_key 포함)
    const commonParams = `partner=${partner}&uuid=${uuid}&data=${encodeURIComponent(data)}&api_key=${apiKey}`;

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
        console.log('💳 [IntroLanding] 결제 페이지로 이동');
        navigate(`/campaigns/disease-prediction?page=payment&${commonParams}`);
        break;
    }
  }, [buttonConfig.action, partner, uuid, data, apiKey, navigate]);

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
    };
  }, [handleButtonClick, buttonConfig.text]);

  return (
    <div className="dp-landing">
      {/* 리포트 생성 중 스피너 */}
      <PageTransitionLoader isVisible={isGenerating} message="리포트를 분석 중입니다..." />
      
      <main className="dp-content">
        {/* 소개 이미지 섹션 */}
        <section className="image-intro">
          <img src={reportB1} alt="intro 1" className="intro-img" />
          <img src={reportB2} alt="intro 2" className="intro-img" />
          <img src={reportB7_1} alt="intro extra" className="intro-img" />
          <img src={reportB3} alt="intro 3" className="intro-img" />
          <img src={reportB4} alt="intro 4" className="intro-img" />
          <img src={reportB5} alt="intro 5" className="intro-img" />
          <img src={reportB6} alt="intro 6" className="intro-img" />
        </section>

        {/* CTA 영역 */}
        <section className="payment-guide">
          <div className="price-box">
            <span className="item-name">AI 질병예측 리포트 (PDF)</span>
            <span className="price">
              {status?.requires_payment === false 
                ? '무료' 
                : status?.payment_amount 
                  ? `${status.payment_amount.toLocaleString('ko-KR')}원`
                  : '7,900원'}
            </span>
          </div>
          
          <ul className="benefits">
            <li>✓ 20대 질병 예측 분석</li>
            <li>✓ 암 발생 위험도 분석</li>
            <li>✓ 건강 나이 분석</li>
            <li>✓ PDF 리포트 다운로드</li>
          </ul>
        </section>
      </main>
    </div>
  );
};

export default IntroLandingPage;
