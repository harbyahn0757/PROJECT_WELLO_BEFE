# Welno RAG Chat Widget 통합 가이드

## 📋 개요

Welno RAG Chat Widget은 파트너 웹사이트에 쉽게 통합할 수 있는 AI 기반 건강 상담 채팅 위젯입니다. 
React나 다른 프레임워크에 의존하지 않는 순수 JavaScript로 구현되어 어떤 웹사이트에든 간단히 추가할 수 있습니다.

## 🚀 빠른 시작

### 1. 스크립트 로드

웹사이트의 `</body>` 태그 직전에 위젯 스크립트를 추가하세요:

```html
<script src="https://cdn.welno.com/widgets/welno-rag-chat-widget.min.js"></script>
```

### 2. 위젯 초기화

```html
<script>
document.addEventListener('DOMContentLoaded', function() {
    const widget = new WelnoRagChatWidget({
        apiKey: 'your-partner-api-key',
        baseUrl: 'https://api.welno.com',
        uuid: 'user-unique-id',
        hospitalId: 'your-clinic-id'
    });
    
    widget.init();
});
</script>
```

## ⚙️ 설정 옵션

### 필수 설정

| 옵션 | 타입 | 설명 |
|------|------|------|
| `apiKey` | string | 파트너 API Key (필수) |
| `baseUrl` | string | API 서버 URL |
| `uuid` | string | 사용자 고유 ID |
| `hospitalId` | string | 병원/클리닉 ID |

### 선택적 설정

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `position` | string | 'bottom-right' | 위젯 위치 (bottom-right, bottom-left, top-right, top-left) |
| `buttonColor` | string | '#A69B8F' | 채팅 버튼 색상 |
| `theme` | string | 'default' | 테마 설정 |
| `autoOpen` | boolean | false | 자동 열기 여부 |
| `welcomeMessage` | string | 기본 환영 메시지 | 첫 메시지 내용 |
| `partnerData` | object | null | 파트너 검진 데이터 |

### 콜백 함수

| 콜백 | 매개변수 | 설명 |
|------|----------|------|
| `onOpen` | () | 위젯이 열릴 때 호출 |
| `onClose` | () | 위젯이 닫힐 때 호출 |
| `onMessage` | (message) | 메시지 전송/수신 시 호출 |
| `onError` | (error) | 오류 발생 시 호출 |

## 📊 파트너 데이터 통합

### 검진 데이터 형식

위젯은 파트너사의 검진 데이터를 통합하여 더 개인화된 상담을 제공할 수 있습니다:

```javascript
const partnerData = {
    patient: {
        name: '김건강',
        birth_date: '1985-03-15',
        sex: 'M',
        phone: '010-1234-5678'
    },
    checkup_results: {
        height: 172,
        weight: 75,
        bmi: 25.3,
        systolic_bp: 135,
        diastolic_bp: 85,
        fasting_glucose: 105,
        total_cholesterol: 220,
        exam_date: '2024-01-20'
    },
    medical_history: [
        '2023년 고혈압 진단',
        '2022년 당뇨 전단계 진단'
    ]
};

const widget = new WelnoRagChatWidget({
    apiKey: 'your-api-key',
    partnerData: partnerData,
    // ... 기타 설정
});
```

### 동적 데이터 로드

검진 데이터를 서버에서 동적으로 가져오는 경우:

```javascript
async function initializeWidget() {
    try {
        // 서버에서 사용자 검진 데이터 가져오기
        const response = await fetch('/api/user/health-data');
        const healthData = await response.json();
        
        const widget = new WelnoRagChatWidget({
            apiKey: 'your-api-key',
            uuid: getCurrentUserId(),
            partnerData: healthData,
            
            onError: function(error) {
                console.error('채팅 위젯 오류:', error);
                // 사용자에게 친화적인 오류 메시지 표시
            }
        });
        
        widget.init();
        
    } catch (error) {
        console.error('위젯 초기화 실패:', error);
    }
}
```

## 🎨 스타일 커스터마이징

### CSS 변수 사용

위젯은 CSS 변수를 통해 스타일을 커스터마이징할 수 있습니다:

```css
:root {
    --welno-widget-primary-color: #667eea;
    --welno-widget-background: #ffffff;
    --welno-widget-text-color: #333333;
    --welno-widget-border-radius: 20px;
}
```

### 커스텀 CSS 적용

특정 스타일을 오버라이드하려면:

```css
/* 채팅 버튼 커스터마이징 */
.welno-rag-widget-button {
    background: linear-gradient(45deg, #667eea, #764ba2) !important;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
}

/* 채팅 창 헤더 커스터마이징 */
.welno-rag-widget-header {
    background: #667eea !important;
}
```

## 📱 반응형 지원

위젯은 자동으로 반응형을 지원하며, 모바일에서는 다음과 같이 동작합니다:

- 화면 크기에 맞춰 채팅창 크기 조정
- 터치 인터페이스 최적화
- 키보드 표시 시 자동 레이아웃 조정

## 🔒 보안 고려사항

### API Key 관리

```javascript
// ❌ 잘못된 방법: 클라이언트에 API Key 노출
const widget = new WelnoRagChatWidget({
    apiKey: 'pk_live_12345...' // 보안 위험!
});

// ✅ 올바른 방법: 서버에서 안전하게 제공
async function getApiKey() {
    const response = await fetch('/api/get-widget-config', {
        credentials: 'include' // 인증된 사용자만
    });
    return response.json();
}

const config = await getApiKey();
const widget = new WelnoRagChatWidget(config);
```

### 도메인 제한

파트너 설정에서 허용된 도메인만 위젯을 사용할 수 있도록 제한할 수 있습니다.

## 📈 분석 및 추적

### 구글 애널리틱스 연동

```javascript
const widget = new WelnoRagChatWidget({
    apiKey: 'your-api-key',
    
    onOpen: function() {
        gtag('event', 'chat_opened', {
            event_category: 'engagement',
            event_label: 'health_chat'
        });
    },
    
    onMessage: function(message) {
        if (message.role === 'user') {
            gtag('event', 'chat_message_sent', {
                event_category: 'engagement',
                event_label: 'health_chat'
            });
        }
    }
});
```

### 커스텀 이벤트 추적

```javascript
const widget = new WelnoRagChatWidget({
    apiKey: 'your-api-key',
    
    onMessage: function(message) {
        // 자체 분석 시스템으로 전송
        analytics.track('Health Chat Message', {
            role: message.role,
            timestamp: new Date().toISOString(),
            userId: getCurrentUserId()
        });
    }
});
```

## 🛠️ API 참조

### 위젯 메서드

```javascript
const widget = new WelnoRagChatWidget(config);

// 위젯 초기화
widget.init();

// 위젯 열기
widget.open();

// 위젯 닫기
widget.close();

// 위젯 제거
widget.destroy();
```

### 상태 확인

```javascript
// 위젯이 열려있는지 확인
console.log(widget.state.isOpen);

// 메시지 히스토리 확인
console.log(widget.state.messages);

// 세션 ID 확인
console.log(widget.state.sessionId);
```

## 🔧 문제 해결

### 자주 발생하는 문제

**1. 위젯이 표시되지 않음**
- API Key가 올바른지 확인
- 콘솔에서 JavaScript 오류 확인
- 네트워크 연결 상태 확인

**2. 채팅 응답이 오지 않음**
- API 서버 연결 상태 확인
- CORS 설정 확인
- API Key 권한 확인

**3. 스타일 충돌**
- CSS 네임스페이스 확인 (`welno-rag-widget-*`)
- z-index 값 조정
- 기존 CSS와의 충돌 해결

### 디버깅

```javascript
// 디버그 모드 활성화
const widget = new WelnoRagChatWidget({
    apiKey: 'your-api-key',
    debug: true, // 상세 로그 출력
    
    onError: function(error) {
        console.error('위젯 오류:', error);
        // 오류 리포팅 서비스로 전송
        errorReporting.captureException(error);
    }
});
```

## 📞 지원

기술적 문제나 질문이 있으시면 다음 채널을 통해 연락해주세요:

- **이메일**: support@welno.com
- **문서**: https://docs.welno.com
- **GitHub**: https://github.com/welno/rag-chat-widget

## 📄 라이선스

이 위젯은 MIT 라이선스 하에 배포됩니다.

---

© 2024 Welno. All rights reserved.