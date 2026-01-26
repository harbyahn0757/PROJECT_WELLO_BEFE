/**
 * 브라우저 콘솔에서 실행할 디버깅 스크립트
 * 
 * 사용법:
 * 1. 브라우저 개발자 도구 열기 (F12)
 * 2. Console 탭 선택
 * 3. 아래 스크립트를 복사해서 붙여넣고 Enter
 */

// React 컴포넌트 인스턴스 찾기
function findReactComponent(element) {
  for (let key in element) {
    if (key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber$')) {
      let fiberNode = element[key];
      while (fiberNode) {
        if (fiberNode.memoizedState) {
          return fiberNode;
        }
        fiberNode = fiberNode.return;
      }
    }
  }
  return null;
}

// DiseasePredictionCampaign 컴포넌트 찾기
function findDiseasePredictionComponent() {
  const root = document.querySelector('[data-reactroot]') || document.body;
  const allElements = root.querySelectorAll('*');
  
  for (let el of allElements) {
    const fiber = findReactComponent(el);
    if (fiber && fiber.memoizedState) {
      // currentPage 상태 찾기
      let stateNode = fiber;
      while (stateNode) {
        if (stateNode.memoizedState) {
          const state = stateNode.memoizedState;
          // currentPage 상태 찾기
          let currentState = state;
          let depth = 0;
          while (currentState && depth < 10) {
            if (currentState.memoizedState) {
              // 상태 값 확인
              const stateValue = currentState.memoizedState;
              if (typeof stateValue === 'string' && 
                  ['landing', 'result', 'intro', 'payment', 'terms'].includes(stateValue)) {
                return {
                  element: el,
                  fiber: stateNode,
                  currentPage: stateValue,
                  state: stateNode.memoizedState
                };
              }
            }
            currentState = currentState.next;
            depth++;
          }
        }
        stateNode = stateNode.return;
      }
    }
  }
  return null;
}

// 간단한 방법: DOM에서 직접 확인
function checkCurrentPage() {
  console.log('=== DiseasePredictionCampaign 상태 확인 ===');
  
  // 1. URL 파라미터 확인
  const urlParams = new URLSearchParams(window.location.search);
  const page = urlParams.get('page');
  console.log('1. URL 파라미터 page:', page);
  
  // 2. 렌더링된 컴포넌트 확인
  const landingPage = document.querySelector('.dp-landing');
  const introPage = document.querySelector('[class*="intro"]') || document.querySelector('[class*="Intro"]');
  
  console.log('2. 렌더링된 컴포넌트:');
  console.log('   - LandingPage (.dp-landing):', landingPage ? '있음' : '없음');
  console.log('   - IntroLandingPage:', introPage ? '있음' : '없음');
  
  // 3. localStorage 약관 데이터 확인
  const uuid = urlParams.get('uuid');
  const partner = urlParams.get('partner');
  if (uuid && partner) {
    const termsKey = `TERMS_AGREEMENT_${uuid}_${partner}`;
    const termsData = localStorage.getItem(termsKey);
    console.log('3. 로컬 약관 데이터:');
    console.log('   - 키:', termsKey);
    console.log('   - 존재:', termsData ? '있음' : '없음');
    if (termsData) {
      try {
        const parsed = JSON.parse(termsData);
        console.log('   - 데이터:', parsed);
      } catch (e) {
        console.log('   - 파싱 실패:', e);
      }
    }
  }
  
  // 4. 상태 체크 API 응답 확인 (Network 탭에서 확인)
  console.log('4. 상태 체크 API:');
  console.log('   - Network 탭에서 /check-partner-status 응답 확인 필요');
  
  // 5. React DevTools로 확인
  console.log('5. React DevTools:');
  console.log('   - React DevTools 설치되어 있으면 Components 탭에서 확인');
  console.log('   - DiseasePredictionCampaign 컴포넌트 찾기');
  console.log('   - currentPage state 값 확인');
  
  console.log('=== 확인 완료 ===');
}

// 실행
checkCurrentPage();

// 추가: 실시간 모니터링
console.log('\n=== 실시간 모니터링 시작 ===');
console.log('URL 변경 감지 중...');

let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('📍 URL 변경됨:', lastUrl);
    checkCurrentPage();
  }
}, 1000);

console.log('모니터링 중... (1초마다 체크)');
