import React, { useState, useEffect } from 'react';
import { EventPage } from './EventPage';
import { EventPageFixed } from './EventPageFixed';
import SurveyPage from './SurveyPage';
import { RevokePage } from './RevokePage';
import { useCampaignSkin } from './hooks/useCampaignSkin';
import { useCampaignPageTracking, getMktUuidFromUrl } from '../../hooks/usePageTracking';

// 타입 정의
type PageType = 'event' | 'event-fixed' | 'survey' | 'mockup' | 'revoked';

interface CampaignProps {
  initialPage?: PageType;
  onPageChange?: (page: PageType) => void;
  className?: string;
}

// MockupPage 컴포넌트 (통합)
const MockupPage: React.FC = () => {
  const { skinType } = useCampaignSkin();
  // 하단 고정이므로 항상 표시
  const isVisible = true;

  return (
    <div className={`campaign-container skin-${skinType.toLowerCase()}`}>
      <div className="mockup-page">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="container">
            <div className="hero-content">
              <h1 className="hero-title">
                과거 검진결과에 AI 분석을 더하면<br />
                올해 꼭 받아야 할 검사가 보입니다
              </h1>
              <p className="hero-subtitle">
                검진받고 끝내지 마세요. AI 기반 검진 플래닝으로 스마트한 건강관리를 시작하세요
              </p>
              
              <div className="hero-stats">
                <div className="stat-item">
                  <div className="stat-number">2,500만명</div>
                  <div className="stat-label">연간 건강검진 수검자</div>
                  <div className="stat-source">출처: 국민건강보험공단</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">27.9%</div>
                  <div className="stat-label">고혈압 의심 판정 후<br />실제 병원 방문률</div>
                  <div className="stat-source">출처: 의사신문</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">검증된</div>
                  <div className="stat-label">AI 질병예측<br />분석 시스템</div>
                  <div className="stat-source">출처: Selvy Checkup</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="problem-section">
          <div className="container">
            <h2 className="section-title">
              충격적인 현실: 검진 받고도 <span className="highlight">10명 중 7명이 방치</span>
            </h2>
            <p className="section-subtitle">
              대한민국 건강검진 사후관리의 민낯을 공개합니다
            </p>
            
            <div className="shocking-stats">
              <h3 className="shocking-title">🚨 정부 공식 통계가 말하는 충격적 현실</h3>
              <div className="shocking-grid">
                <div className="shocking-item">
                  <div className="shocking-number">27.9%</div>
                  <div className="shocking-desc">고혈압 의심 판정 후<br />실제 진단검사 받은 비율</div>
                </div>
                <div className="shocking-item">
                  <div className="shocking-number">38.7%</div>
                  <div className="shocking-desc">당뇨병 의심 판정 후<br />실제 진단검사 받은 비율</div>
                </div>
                <div className="shocking-item">
                  <div className="shocking-number">12%</div>
                  <div className="shocking-desc">이상지질혈증 의심 판정 후<br />실제 진단검사 받은 비율</div>
                </div>
                <div className="shocking-item">
                  <div className="shocking-number">25.1%</div>
                  <div className="shocking-desc">고혈압 의심자 중<br />실제 진료 받은 비율</div>
                </div>
              </div>
              <p className="data-source">
                <strong>출처: 의사신문, 국민건강보험공단 건강검진 사후관리 실태조사</strong>
              </p>
            </div>
            
            <div className="problem-details">
              <div className="problem-item">
                <h3>🏥 사후관리 서비스의 구조적 문제점</h3>
                <p><strong>만족도는 71.5%지만 실상은 다릅니다.</strong> <span className="source-tag">보건복지부</span></p>
                <ul>
                  <li><strong>'상담의 전문성 부족'</strong> - 건강검진 후 상담이 형식적이고 깊이가 부족</li>
                  <li><strong>'설명이 구체적이지 않음'</strong> - "다 괜찮으세요"라는 뻔한 대답만 반복</li>
                  <li><strong>'서비스 정보가 세분화되어 있지 않음'</strong> - 개인별 맞춤 정보 제공 부재</li>
                </ul>
                <div className="source-citation">출처: 보건복지부 건강검진/사후관리 조사·정책보고서</div>
              </div>
              
              <div className="problem-item">
                <h3>❓ 검진 결과 이해도의 심각한 문제</h3>
                <p><strong>대다수 국민이 검진 결과를 제대로 이해하지 못하고 있습니다.</strong></p>
                <ul>
                  <li>"검진결과를 이해하기 어렵다" (국민 대다수 호소)</li>
                  <li>"나에게 꼭 필요한 항목이 무엇인지 모르겠다"</li>
                  <li>정부 연구 결과: <strong>진단 결과를 충분히 이해하지 못해 사후관리가 미흡</strong></li>
                </ul>
                <div className="source-citation">출처: 의사신문, 히트뉴스</div>
              </div>

              <div className="problem-item">
                <h3>💸 경제적 손실과 사회적 비용</h3>
                <p><strong>조기 발견 실패로 인한 막대한 사회적 비용이 발생하고 있습니다.</strong></p>
                <ul>
                  <li>암 조기 발견 시 생존율: <strong>90%</strong> vs 늦은 발견 시: <strong>30% 미만</strong></li>
                  <li>심뇌혈관 질환: 한국 사망원인 <strong>상위 3위</strong></li>
                  <li>만성질환 관리 실패로 인한 의료비 급증</li>
                </ul>
              </div>
            </div>

            <div className="testimonials">
              <h3 className="testimonial-title">실제 건강검진 후기 - 이런 경험 있으시죠?</h3>
              
              <div className="testimonial">
                <div className="testimonial-content">
                  검진 후 결과 상담이나 follow up이 삼성(병원)만큼은 아니었던 것 같아요. 검사와 상담 등이 형식적이고, 검사결과 이상이 있어서 외래 진료가 필요한 경우에도 구체적인 안내가 부족했어요.
                </div>
                <div className="testimonial-author">- 마일모아 커뮤니티, 해외거주 한국인</div>
              </div>
              
              <div className="testimonial">
                <div className="testimonial-content">
                  일주일 후 결과지를 받으러 가서 닥터한테 궁금한 점을 물어봐도 아무 설명도 없이 앵무새 마냥 "다 괜찮으세요"만 반복하더라고요. 진짜 괜찮은 건지, 주의할 점은 없는 건지 전혀 알 수가 없었어요.
                </div>
                <div className="testimonial-author">- 마일모아 커뮤니티, 2016년 KMI 검진 후기</div>
              </div>
              
              <div className="testimonial">
                <div className="testimonial-content">
                  매년 똑같은 패키지로 검진받는데, 나이가 들어가면서 어떤 검사를 추가로 받아야 하는지, 내 가족력이나 기존 건강상태를 고려해서 뭘 더 체크해야 하는지 아무도 알려주지 않아요.
                </div>
                <div className="testimonial-author">- 네이버 카페, 50대 직장인</div>
              </div>
            </div>
          </div>
        </section>

        {/* Government Section */}
        <section className="government-section">
          <div className="container">
            <div className="government-content">
              <h2 className="section-title">🏛️ 정부도 인정한 맞춤형 건강관리의 필요성</h2>
              <div className="government-highlight">
                <div className="government-amount">400억원</div>
                <p className="government-subtitle">
                  <strong>"질병 예측 디지털마커 기반 개인 건강기록 통합 관리시스템"</strong>
                </p>
                <p className="government-description">
                  보건복지부가 2020-2024년 대규모 투자한 사업으로,<br />
                  <strong>우리 서비스와 정확히 같은 방향성</strong>을 가지고 있습니다.
                </p>
              </div>
              <p className="government-goal">
                <strong>정부 목표:</strong> 건강/검진기록, 생활/식습관 및 유전적 차이를 통합적으로 고려한<br />
                IoT 기술 기반의 질병 예측 및 개인 맞춤 헬스케어 서비스 제공
              </p>
            </div>
          </div>
        </section>

        {/* Market Evidence Section */}
        <section className="market-evidence-section">
          <div className="container">
            <h2 className="section-title">시장이 증명하는 <span className="highlight">압도적 수요</span></h2>
            <p className="section-subtitle">대국민 설문조사와 실제 서비스 이용 현황이 말하는 확실한 니즈</p>
            
            <div className="evidence-grid">
              <div className="evidence-card">
                <div className="evidence-stat">91.8%</div>
                <h4 className="evidence-title">맞춤형 검진설계 서비스 이용 의향</h4>
                <p className="evidence-description">대국민 설문조사에서 응답자의 91.8%가 도입 시 이용하겠다고 답변</p>
                <div className="evidence-source">출처: 보건복지부 대국민 설문조사</div>
              </div>
              
              <div className="evidence-card">
                <div className="evidence-stat">86.2%</div>
                <h4 className="evidence-title">개인 맞춤형 건강관리 앱 만족도</h4>
                <p className="evidence-description">'나의 건강기록' 앱 사용자 만족도. 특히 50-60대 연령층에서 만족도가 높음</p>
                <div className="evidence-source">출처: 한국보건산업진흥원</div>
              </div>
              
              <div className="evidence-card">
                <div className="evidence-stat">89.3%</div>
                <h4 className="evidence-title">타인 추천 의향</h4>
                <p className="evidence-description">맞춤형 건강관리 서비스를 타인에게 추천하겠다는 의향. 높은 만족도를 반증</p>
                <div className="evidence-source">출처: 한국보건산업진흥원 서비스만족도 조사</div>
              </div>
              
              <div className="evidence-card">
                <div className="evidence-stat">50만건+</div>
                <h4 className="evidence-title">AI 건강예측 서비스 연간 리포트</h4>
                <p className="evidence-description">Selvy Checkup 등 AI 기반 건강예측 서비스의 연간 리포트 발급 건수</p>
                <div className="evidence-source">출처: Selvy Checkup 사업 실적</div>
              </div>
              
              <div className="evidence-card">
                <div className="evidence-stat">3.04점</div>
                <h4 className="evidence-title">사후관리 이용자 건강성적 (5점 만점)</h4>
                <p className="evidence-description">사후관리 서비스 이용자의 1년 후 만성질환 관리 성적 (미이용자 2.81점 대비 향상)</p>
                <div className="evidence-source">출처: 국민건강보험공단 사후관리 효과 분석</div>
              </div>
              
              <div className="evidence-card">
                <div className="evidence-stat">검증된</div>
                <h4 className="evidence-title">AI 질병예측 분석 시스템</h4>
                <p className="evidence-description">임상적으로 검증된 AI 기반 질병예측 서비스. 이미 다수의 의료기관에서 활용</p>
                <div className="evidence-source">출처: Selvy Checkup 등 AI 헬스케어 기업</div>
              </div>
            </div>
            
            <div className="warning-box">
              <strong>⚠️ 놓치면 위험한 골든타임</strong><br />
              • <strong>암 조기 발견 시 생존율 90%</strong> vs 늦은 발견 시 30% 미만<br />
              • <strong>심뇌혈관 질환</strong>은 한국 사망원인 상위 3위<br />
              • <strong>당뇨병 합병증</strong> 예방을 위한 조기 관리의 중요성<br />
              • 체계적 관리 없이는 만성질환 진행 위험 지속 증가
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="solution-section">
          <div className="container">
            <h2 className="section-title">이제 <span className="highlight">AI 분석 + 전문가 상담</span>으로 완벽한 검진 계획을</h2>
            <div className="solution-intro">
              <p>AI가 정밀 분석하고, 전문가가 직접 상담하여<br />
              당신만을 위한 맞춤형 건강검진 로드맵을 함께 설계합니다.</p>
            </div>
            
            <div className="solution-grid">
              <div className="solution-card">
                <div className="solution-icon">🤖</div>
                <h3 className="solution-title">AI 정밀 분석<br />(1단계)</h3>
                <p className="solution-description">과거 3년간 검진 이력 종합 분석<br />10대 주요 질환별 위험도 예측<br />임상적으로 검증된 예측 시스템 활용</p>
              </div>
              <div className="solution-card">
                <div className="solution-icon">👨‍⚕️</div>
                <h3 className="solution-title">전문가 1:1 상담<br />(2단계)</h3>
                <p className="solution-description">AI 분석 결과를 전문가가 직접 해석<br />개인별 상황과 가족력 추가 고려<br />궁금한 점 상세 설명 및 질의응답</p>
              </div>
              <div className="solution-card">
                <div className="solution-icon">📋</div>
                <h3 className="solution-title">맞춤 검진계획 공동설계<br />(3단계)</h3>
                <p className="solution-description">AI 추천 + 전문가 판단으로 최종 계획<br />우선순위 검진 항목과 최적 시기<br />개인 예산과 일정 고려한 현실적 설계</p>
              </div>
              <div className="solution-card">
                <div className="solution-icon">🛡️</div>
                <h3 className="solution-title">사후관리 및 보험상담<br />(4단계)</h3>
                <p className="solution-description">검진 결과 지속 모니터링<br />위험도 변화에 따른 보장 점검<br />정기적 건강상담 및 업데이트</p>
              </div>
            </div>
            
            <div className="success-box">
              <strong>🏛️ 정부 정책과 완벽 일치</strong><br />
              보건복지부 400억원 투자 "질병 예측 디지털마커 기반 개인 건강기록 통합 관리시스템" 사업의 목표와 100% 일치하는 서비스입니다. 정부가 추진하는 미래 헬스케어의 방향성을 지금 먼저 경험해보세요.
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="process-section">
          <div className="container">
            <h2 className="section-title"><span className="highlight">AI + 전문가</span>가 함께하는 4단계 맞춤 설계</h2>
            <p className="section-subtitle">AI의 정밀한 분석과 전문가의 임상 경험이 만나 완벽한 건강검진 계획을 만들어갑니다</p>
            
            <div className="process-steps">
              <div className="step">
                <div className="step-number">1</div>
                <h3>AI 데이터 분석</h3>
                <p>공단 간편인증으로 검진 이력 수집<br />AI가 10대 질환 위험도 자동 분석<br />개인별 건강 패턴 정밀 추출</p>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <h3>전문가 상담 (30분)</h3>
                <p>AI 분석 결과를 전문가가 해석<br />가족력, 생활습관 추가 문진<br />개인 상황 맞춤 보완 분석</p>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <h3>검진 계획 공동 설계</h3>
                <p>AI 추천 + 전문가 판단 종합<br />우선순위와 예산 고려한 계획<br />실행 가능한 현실적 로드맵</p>
              </div>
              <div className="step">
                <div className="step-number">4</div>
                <h3>지속 관리 & 보험 상담</h3>
                <p>검진 후 결과 분석 및 상담<br />위험도 변화 모니터링<br />필요시 보험 보장 점검</p>
              </div>
            </div>
          </div>
        </section>

        {/* Success Stories Section */}
        <section className="success-stories-section">
          <div className="container">
            <h2 className="section-title">실제 이용자들의 <span className="highlight">생생한 성공 스토리</span></h2>
            <p className="section-subtitle">AI 추천으로 조기 발견하고 건강을 지킨 실제 사례들</p>
            
            <div className="success-grid">
              <div className="success-card">
                <h4>🎯 간암 고위험군 조기 발견 사례</h4>
                <div className="success-story">
                  "AI 분석에서 간암 위험도가 높게 나왔는데, 전문가 상담에서 가족력과 음주력을 추가로 고려해 간 초음파와 AFP 검사를 강력히 권했어요. 실제로 초기 간암이 발견됐고, 조기 치료로 완치 판정 받았습니다. AI만으로는 놓쳤을 수도 있었는데 전문가 상담이 결정적이었어요."
                </div>
                <div className="success-author">- 김○○님, 52세 남성, 경기도</div>
              </div>
              
              <div className="success-card">
                <h4>💖 유방암 가족력 맞춤 검진</h4>
                <div className="success-story">
                  "AI에서 유방암 위험도가 나왔지만 구체적으로 어떤 검사를 언제 받아야 하는지 모르겠더라고요. 전문가 상담에서 어머니의 발병 연령과 제 나이를 고려해 유방 MRI를 당장 받고, 6개월마다 정기 검진을 받으라고 상세히 설명해주셨어요. 지금은 안심하고 정기 관리받고 있습니다."
                </div>
                <div className="success-author">- 이○○님, 43세 여성, 서울</div>
              </div>
              
              <div className="success-card">
                <h4>🫀 심혈관 질환 예방 성공</h4>
                <div className="success-story">
                  "당뇨와 고혈압 있는 상태에서 AI가 심혈관 위험도를 높게 봤는데, 전문가가 운동부하검사까지 추천해주셨어요. 혼자였다면 그냥 넘어갔을 텐데, 상담을 통해 관상동맥 문제를 미리 발견하고 시술받았어요. 정말 생명을 구한 상담이었습니다."
                </div>
                <div className="success-author">- 박○○님, 58세 남성, 부산</div>
              </div>
              
              <div className="success-card">
                <h4>💰 효율적 검진으로 비용 절약</h4>
                <div className="success-story">
                  "AI 분석 후 전문가 상담에서 제 연령과 위험도를 고려해 꼭 필요한 검사만 골라주셨어요. 불필요한 비싼 검사는 빼고, 정말 중요한 검사는 추가해서 비용은 절반으로 줄면서도 더 정확한 건강 체크가 가능했어요. 개인 맞춤 상담의 힘을 느꼈습니다."
                </div>
                <div className="success-author">- 정○○님, 45세 여성, 대구</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="container">
            <h2 className="cta-title">더 이상 막연한 건강관리는 그만,<br /><span className="highlight">AI + 전문가 상담</span>으로 정확한 계획을</h2>
            <p className="cta-subtitle">
              AI가 분석하고, 전문가가 상담하여<br />
              <strong>2025년 당신만의 건강검진 로드맵을 함께 만듭니다</strong>
            </p>
            

            
            <div className="cta-benefits">
              ✅ <strong>검증된 AI 분석</strong> - 임상적으로 검증된 질병 위험도 예측<br />
              ✅ <strong>전문가 1:1 상담</strong> - 30분간 개인 맞춤 상담<br />
              ✅ <strong>공동 설계</strong> - AI 추천 + 전문가 판단으로 완벽한 계획<br />
              ✅ <strong>지속 관리</strong> - 검진 후에도 계속되는 건강 상담
            </div>
          </div>
        </section>

        {/* 플로팅 CTA 버튼 */}
        <div className={`floating-cta ${isVisible ? 'visible' : 'hidden'}`}>
          <button 
            className="floating-button"
            onClick={() => {
              const currentUrl = new URL(window.location.href);
              currentUrl.searchParams.set('page', 'survey');
              window.location.href = currentUrl.toString();
            }}
          >
            건강검진 설계 시작하기
          </button>
        </div>
      </div>
    </div>
  );
};

export const BnrPlanningXogXCampaign: React.FC<CampaignProps> = () => {
  const [currentPage, setCurrentPage] = useState('mockup');

  // 페이지 추적 훅 추가
  const mktUuid = getMktUuidFromUrl();
  const { accessAllowed } = useCampaignPageTracking({
    mktUuid: mktUuid || undefined,
    enabled: true,
    trackTimeSpent: true
  });

  // URL 파라미터에서 페이지 확인
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    
    if (page === 'survey') {
      setCurrentPage('survey');
    } else if (page === 'event') {
      setCurrentPage('event');
    } else if (page === 'event-fixed') {
      setCurrentPage('event-fixed');
    } else if (page === 'revoked') {
      setCurrentPage('revoked');
    } else {
      setCurrentPage('mockup');
    }
  }, []);

  // 페이지 타이틀 설정
  useEffect(() => {
    if (currentPage === 'survey') {
      document.title = 'Xog: 쏙 - 건강검진 설계 신청';
    } else if (currentPage === 'event' || currentPage === 'event-fixed') {
      document.title = 'Xog: 쏙 - 특별 이벤트';
    } else if (currentPage === 'revoked') {
      document.title = 'Xog: 쏙 - 캠페인 철회';
    } else {
      document.title = 'Xog: 쏙 - 질병예측 리포트 캠페인';
    }
  }, [currentPage]);

  // 페이지별 렌더링
  if (currentPage === 'survey') {
    return <SurveyPage />;
  }
  
  if (currentPage === 'event') {
    return <EventPage onStartSurvey={() => {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('page', 'survey');
      window.location.href = currentUrl.toString();
    }} />;
  }
  
  if (currentPage === 'event-fixed') {
    return <EventPageFixed onStartSurvey={() => {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('page', 'survey');
      window.location.href = currentUrl.toString();
    }} />;
  }
  
  if (currentPage === 'revoked') {
    // URL 파라미터에서 회수 정보 추출
    const urlParams = new URLSearchParams(window.location.search);
    const revokeInfo = {
      reason: urlParams.get('reason') || '관리자 회수',
      revoked_at: urlParams.get('revoked_at') || new Date().toISOString(),
      revoked_by: urlParams.get('revoked_by') || '시스템'
    };
    const customerName = urlParams.get('customer_name') || undefined;
    
    return <RevokePage revokeInfo={revokeInfo} customerName={customerName} />;
  }

  return <MockupPage />;
};

// 개별 컴포넌트들도 내보내기 (필요한 경우)
export { EventPage } from './EventPage';
export { EventPageFixed } from './EventPageFixed';
export { RevokePage } from './RevokePage';
export { default as SurveyPage } from './SurveyPage';

// 타입들도 내보내기
export type {
  SkinType,
  BirthDate,
  SurveyData,
  QuestionStatus,
  OptionItem,
  QuestionInfo,
  ProgressInfo,
  CalendarOptions,
  SkinConfig
} from './types';

// 훅들도 내보내기 (필요한 경우)
export { useCampaignSkin } from './hooks/useCampaignSkin';
export { useSurveyData } from './hooks/useSurveyData';

// 기본 내보내기
export default BnrPlanningXogXCampaign; 