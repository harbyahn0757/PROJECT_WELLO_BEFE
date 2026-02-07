/**
 * Welno RAG Chat Widget 테스트 스크립트
 * Node.js 환경에서 위젯의 기본 기능을 테스트합니다.
 */

// DOM 환경 시뮬레이션 (간단한 모킹)
global.document = {
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    innerHTML: '',
    textContent: '',
    style: {},
    setAttribute: function(name, value) { this[name] = value; },
    addEventListener: function() {},
    appendChild: function() {},
    querySelector: function() { return null; },
    remove: function() {}
  }),
  head: {
    appendChild: function() {}
  },
  body: {
    appendChild: function() {}
  },
  getElementById: function() { return null; }
};

global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  visualViewport: null,
  addEventListener: function() {},
  removeEventListener: function() {}
};

// 위젯 로드
const WelnoRagChatWidget = require('./WelnoRagChatWidget.js');

console.log('🧪 Welno RAG Chat Widget 테스트 시작');
console.log('=' * 50);

// 테스트 1: 위젯 생성
console.log('\n1️⃣ 위젯 생성 테스트');
try {
  const widget = new WelnoRagChatWidget({
    apiKey: 'test_pk_12345678901234567890123456789012',
    baseUrl: 'http://localhost:8082',
    uuid: 'test_widget_user',
    hospitalId: 'test_widget_clinic',
    partnerData: {
      patient_info: {
        name: '김테스트',
        age: 35,
        gender: 'M'
      },
      health_metrics: {
        bmi: 22.9,
        blood_pressure: '120/80'
      }
    }
  });
  
  console.log('✅ 위젯 생성 성공');
  console.log('   - API Key:', widget.config.apiKey.substring(0, 20) + '...');
  console.log('   - Base URL:', widget.config.baseUrl);
  console.log('   - UUID:', widget.config.uuid);
  console.log('   - Hospital ID:', widget.config.hospitalId);
  console.log('   - Partner Data:', widget.config.partnerData ? 'Yes' : 'No');
  
} catch (error) {
  console.log('❌ 위젯 생성 실패:', error.message);
}

// 테스트 2: 필수 파라미터 검증
console.log('\n2️⃣ 필수 파라미터 검증 테스트');
try {
  const widget = new WelnoRagChatWidget({
    // apiKey 누락
    baseUrl: 'http://localhost:8082'
  });
  console.log('❌ 검증 실패: API Key 없이도 생성됨');
} catch (error) {
  console.log('✅ 검증 성공:', error.message);
}

// 테스트 3: 설정 기본값 확인
console.log('\n3️⃣ 설정 기본값 테스트');
try {
  const widget = new WelnoRagChatWidget({
    apiKey: 'test_key'
  });
  
  console.log('✅ 기본값 설정 확인:');
  console.log('   - Position:', widget.config.position);
  console.log('   - Button Color:', widget.config.buttonColor);
  console.log('   - Theme:', widget.config.theme);
  console.log('   - Auto Open:', widget.config.autoOpen);
  console.log('   - Welcome Message:', widget.config.welcomeMessage.substring(0, 30) + '...');
  
} catch (error) {
  console.log('❌ 기본값 설정 실패:', error.message);
}

// 테스트 4: 아이콘 생성 테스트
console.log('\n4️⃣ 아이콘 생성 테스트');
try {
  const widget = new WelnoRagChatWidget({
    apiKey: 'test_key'
  });
  
  const chatIcon = widget.getChatIcon();
  const closeIcon = widget.getCloseIcon();
  const sendIcon = widget.getSendIcon();
  
  console.log('✅ 아이콘 생성 성공:');
  console.log('   - Chat Icon:', chatIcon.includes('svg') ? 'Valid SVG' : 'Invalid');
  console.log('   - Close Icon:', closeIcon.includes('svg') ? 'Valid SVG' : 'Invalid');
  console.log('   - Send Icon:', sendIcon.includes('svg') ? 'Valid SVG' : 'Invalid');
  
} catch (error) {
  console.log('❌ 아이콘 생성 실패:', error.message);
}

// 테스트 5: CSS 네임스페이스 확인
console.log('\n5️⃣ CSS 네임스페이스 테스트');
try {
  const widget = new WelnoRagChatWidget({
    apiKey: 'test_key'
  });
  
  console.log('✅ CSS 네임스페이스 확인:');
  console.log('   - CSS Prefix:', widget.cssPrefix);
  console.log('   - Container Class:', `${widget.cssPrefix}-container`);
  console.log('   - Button Class:', `${widget.cssPrefix}-button`);
  console.log('   - Window Class:', `${widget.cssPrefix}-window`);
  
} catch (error) {
  console.log('❌ CSS 네임스페이스 확인 실패:', error.message);
}

console.log('\n' + '=' * 50);
console.log('🎯 테스트 완료!');
console.log('\n💡 실제 브라우저 테스트:');
console.log('   1. http://localhost:8084/test.html 접속');
console.log('   2. "위젯 초기화" 버튼 클릭');
console.log('   3. 우측 하단에 채팅 버튼 확인');
console.log('   4. 채팅 버튼 클릭하여 위젯 열기');
console.log('   5. 메시지 입력하여 RAG 채팅 테스트');