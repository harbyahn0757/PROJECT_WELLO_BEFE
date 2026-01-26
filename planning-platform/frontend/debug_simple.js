/**
 * 간단한 디버깅 스크립트 (브라우저 콘솔에서 실행)
 * 
 * 복사해서 콘솔에 붙여넣으세요
 */

(function() {
  console.log('🔍 DiseasePredictionCampaign 디버깅 시작');
  console.log('='.repeat(60));
  
  // 1. URL 파라미터
  const params = new URLSearchParams(window.location.search);
  console.log('📌 URL 파라미터:');
  console.log('   page:', params.get('page'));
  console.log('   uuid:', params.get('uuid'));
  console.log('   partner:', params.get('partner'));
  console.log('   data:', params.get('data') ? '있음 (' + params.get('data').length + '자)' : '없음');
  
  // 2. 렌더링된 컴포넌트
  console.log('\n📄 렌더링된 컴포넌트:');
  const landing = document.querySelector('.dp-landing');
  const intro = document.querySelector('[class*="intro-landing"]') || 
                document.querySelector('[class*="IntroLanding"]');
  console.log('   LandingPage (.dp-landing):', landing ? '✅ 렌더링됨' : '❌ 없음');
  console.log('   IntroLandingPage:', intro ? '✅ 렌더링됨' : '❌ 없음');
  
  if (landing) {
    console.log('   LandingPage 내용:', landing.innerHTML.substring(0, 200) + '...');
  }
  if (intro) {
    console.log('   IntroLandingPage 내용:', intro.innerHTML.substring(0, 200) + '...');
  }
  
  // 3. localStorage 약관 데이터
  const uuid = params.get('uuid');
  const partner = params.get('partner');
  if (uuid && partner) {
    const key = `TERMS_AGREEMENT_${uuid}_${partner}`;
    const data = localStorage.getItem(key);
    console.log('\n💾 로컬 약관 데이터:');
    console.log('   키:', key);
    console.log('   존재:', data ? '✅ 있음' : '❌ 없음');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        console.log('   필수 약관 동의:', parsed.all_required_agreed ? '✅' : '❌');
        console.log('   마지막 업데이트:', parsed.last_updated);
      } catch (e) {
        console.log('   파싱 실패');
      }
    }
  }
  
  // 4. 콘솔 로그 필터링
  console.log('\n📋 최근 로그 확인:');
  console.log('   콘솔에서 "[DiseasePrediction]" 필터링하여 확인');
  console.log('   특히 다음 로그 확인:');
  console.log('   - [DiseasePrediction] currentPage 설정:');
  console.log('   - [DiseasePrediction] renderContent 실행:');
  console.log('   - [DiseasePrediction] LandingPage 렌더링:');
  
  // 5. React DevTools 안내
  console.log('\n⚛️ React DevTools 사용:');
  console.log('   1. React DevTools 확장 프로그램 설치');
  console.log('   2. Components 탭 열기');
  console.log('   3. DiseasePredictionCampaign 컴포넌트 찾기');
  console.log('   4. currentPage state 값 확인');
  console.log('   5. renderContent 함수 실행 시점 확인');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 디버깅 정보 출력 완료');
})();
