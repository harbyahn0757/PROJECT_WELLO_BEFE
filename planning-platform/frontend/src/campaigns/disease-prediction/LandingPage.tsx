import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import './styles/landing.scss';

// 이미지 임포트
import reportB1 from './assets/report_b_1.png';
import reportB7_1 from './assets/report_b_7-1.png';
import reportB2 from './assets/report_b_2.png';
import reportB3 from './assets/report_b_3.png';
import reportB4 from './assets/report_b_4.png';
import reportB5 from './assets/report_b_5.png';
import reportB6 from './assets/report_b_6.png';

const LandingPage: React.FC = () => {
  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);

  // URL 파라미터 파싱
  const userData = {
    data: query.get('data') || '', // 암호화된 전체 데이터
    uuid: query.get('uuid') || query.get('webapp_key') || '', // 사용자 식별자
    name: query.get('name') || '',
    gender: query.get('gender') || '',
    birth: query.get('birth') || '',
    email: query.get('email') || '',
  };

  const handlePayment = async () => {
    try {
      // 1. 백엔드에 결제 초기화 요청 (서명 생성 및 주문 저장)
      const response = await fetch('/api/campaigns/disease-prediction/init-payment/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
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
          P_UNAME: userData.name,
          P_MOBILE: query.get('phone') || '01000000000',
          P_EMAIL: userData.email,
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

      <footer className="dp-footer">
        <button className="pay-button" onClick={handlePayment}>
          인공지능 질병예측 리포트 설계하기
        </button>
      </footer>
    </div>
  );
};

export default LandingPage;
