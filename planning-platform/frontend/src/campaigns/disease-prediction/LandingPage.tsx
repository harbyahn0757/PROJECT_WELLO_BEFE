import React, { useMemo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PartnerStatus } from './index';
import { API_ENDPOINTS } from '../../config/api';
import { checkAllTermsAgreement } from '../../utils/termsAgreement';
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
  status?: PartnerStatus | null;
}

const LandingPage: React.FC<Props> = ({ status }) => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const [isGenerating, setIsGenerating] = useState(false);

  // URL 파라미터 파싱
  const userData = {
    data: query.get('data') || '', // 암호화된 전체 데이터
    uuid: query.get('uuid') || query.get('webapp_key') || '', // 사용자 식별자
    partner_id: status?.partner_id || query.get('partner') || 'kindhabit', // 서버 식별 파트너 ID 우선
    oid: query.get('oid') || '', // 기존 주문번호
    name: query.get('name') || '',
    gender: query.get('gender') || '',
    birth: query.get('birth') || '',
    email: query.get('email') || '',
  };

  // ✅ Auto Trigger 로직 (결제 완료 또는 무료 유저 즉시 생성)
  useEffect(() => {
    const autoTrigger = query.get('auto_trigger') === 'true';
    
    // auto_trigger가 true일 때만 자동 생성 (결제 완료 후 콜백)
    if (autoTrigger && !isGenerating) {
      handleDirectGenerate();
    }

    // 플로팅 버튼 텍스트 업데이트 (결제 페이지용)
    const amount = status?.payment_amount || 7900;
    const text = status?.requires_payment === false ? 'AI 리포트 즉시 생성하기' : `${amount.toLocaleString('ko-KR')}원 결제하고 리포트 보기`;
    window.dispatchEvent(new CustomEvent('welno-campaign-button-text', { 
      detail: { text } 
    }));
  }, [query, isGenerating, status]); // query나 생성 상태가 바뀔 때 체크하도록 수정

  const handleDirectGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(API_ENDPOINTS.GENERATE_REPORT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userData,
          api_key: query.get('api_key') || ''
        }),
      });

      const data = await response.json();
      if (data.success) {
        // 생성 페이지(Result)로 이동
        navigate(`/campaigns/disease-prediction?page=result&oid=${data.oid || userData.oid}`);
      } else {
        alert('리포트 생성 시작 실패: ' + data.detail);
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Direct generation failed:', error);
      setIsGenerating(false);
    }
  };

  const handlePayment = async () => {
    // 약관 체크 추가 (partner가 없으면 status에서 가져오거나 기본값 사용)
    const uuid = userData.uuid;
    // status가 로드되었으면 status의 partner_id 사용, 없으면 userData의 partner_id 또는 기본값
    const partnerId = status?.partner_id || userData.partner_id || 'kindhabit';
    
    if (uuid && partnerId) {
      try {
        const termsCheck = await checkAllTermsAgreement(uuid, partnerId);
        
        if (termsCheck.needsAgreement) {
          // 약관 모달 표시를 위해 page=terms로 이동
          navigate(`/campaigns/disease-prediction?page=terms&uuid=${uuid}&partner=${partnerId}&api_key=${query.get('api_key') || ''}`);
          return;
        }
      } catch (error) {
        console.error('[LandingPage] 약관 체크 오류:', error);
        // 약관 체크 실패해도 결제 진행 (에러 처리)
      }
    }
    
    try {
      // 1. 백엔드에 결제 초기화 요청 (서명 생성 및 주문 저장)
      const response = await fetch(API_ENDPOINTS.INIT_PAYMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userData,
          api_key: query.get('api_key') || '' // API Key 추가 보장
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 2. 이니시스 결제창 호출을 위한 FORM 생성 및 제출
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'https://mobile.inicis.com/smart/payment/';
        form.acceptCharset = 'euc-kr'; // 매뉴얼 표준에 따라 euc-kr로 설정

        const params: Record<string, string> = {
          P_INI_PAYMENT: 'CARD', 
          P_MID: data.P_MID,
          P_OID: data.P_OID,
          P_AMT: data.P_AMT,
          P_GOODS: '질병예측 리포트',
          P_UNAME: userData.name || '사용자',
          P_MOBILE: query.get('phone') || '01000000000',
          P_EMAIL: userData.email || '',
          P_NEXT_URL: data.P_NEXT_URL, // 백엔드에서 전달받은 운영 URL 사용
          P_CHARSET: 'utf8',
          P_TIMESTAMP: data.P_TIMESTAMP,
          P_CHKFAKE: data.P_CHKFAKE,
          P_NOTI: data.P_OID,
          P_RESERVED: 'below1000=Y&vbank_receipt=Y&centerCd=Y&twoticket=OK&cp_view=Y',
        };

        Object.keys(params).forEach((key) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = params[key];
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      } else {
        alert('결제 준비 중 오류가 발생했습니다: ' + data.error);
      }
    } catch (error) {
      console.error('Payment initialization failed:', error);
      alert('서버 통신 오류가 발생했습니다.');
    }
  };

  // ✅ 전역 플로팅 버튼 클릭 이벤트 구독
  useEffect(() => {
    const handleCampaignClick = () => {
      console.log('📣 [LandingPage] 전역 버튼 클릭 수신 -> 결제 시도');
      handlePayment();
    };

    window.addEventListener('welno-campaign-click', handleCampaignClick);
    return () => {
      window.removeEventListener('welno-campaign-click', handleCampaignClick);
    };
  }, [userData]); // userData 변경 시 리스너 재등록

  return (
    <div className="dp-landing">
      <main className="dp-content">
        <section className="image-intro">
          <img src={reportB1} alt="intro 1" className="intro-img" />
          <img src={reportB2} alt="intro 2" className="intro-img" />
          <img src={reportB7_1} alt="intro extra" className="intro-img" />
          <img src={reportB3} alt="intro 3" className="intro-img" />
          <img src={reportB4} alt="intro 4" className="intro-img" />
          <img src={reportB5} alt="intro 5" className="intro-img" />
          <img src={reportB6} alt="intro 6" className="intro-img" />
        </section>

        <section className="payment-guide">
          <div className="price-box">
            <span className="item-name">AI 질병예측 리포트 (PDF)</span>
            <span className="price">7,900원</span>
          </div>
          <ul className="benefits">
            <li>✅ 10대 주요 질환 4년 내 발병 위험도 분석</li>
            <li>✅ 동일 연령 대비 건강 등수 확인</li>
            <li>✅ 건강나이 정밀 분석</li>
            <li>✅ 개인 맞춤형 건강 관리 가이드 제공</li>
            <li>✅ 분석 결과 PDF 이메일 발송</li>
          </ul>
        </section>

        <section className="company-info">
          <h4>기업정보</h4>
          <p>착한습관 | 02-6406-3507</p>
          <p>대표자 | 김태연</p>
          <p>사업자등록번호 459-63-00643 | 통신판매번호 2023-서울성동-0121</p>
          <p>경기도 용인시 기흥구 공세로150-29, B01-E167호</p>
          <p className="footer-links">
            kkakkung3334@gmail.com | <span>이용약관</span> | <span>개인정보처리방침</span>
          </p>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
