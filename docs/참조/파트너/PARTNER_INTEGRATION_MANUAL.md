# 🏥 Welno RAG Chat 파트너 통합 매뉴얼

**생성일**: 미상  
**작업일자**: 미상  
**작업내용**: Welno RAG Chat 파트너 통합 매뉴얼

---

## 📋 개요

이 매뉴얼은 외부 파트너사가 Welno의 RAG 기반 건강상담 채팅 기능을 자신의 웹사이트에 통합하는 방법을 안내합니다.

**지원 기능**:
- 🤖 AI 기반 건강상담 채팅
- 📊 파트너 제공 건강 데이터 분석
- 🎨 커스터마이징 가능한 UI
- 📱 모바일 반응형 디자인

---

## 🚀 빠른 시작 (5분 완성)

### 1단계: API Key 발급
파트너십 담당자에게 연락하여 API Key를 발급받으세요.
- 📧 이메일: partnership@welno.com
- 📞 전화: 02-1234-5678

### 2단계: 기본 통합

웹사이트의 `</body>` 태그 직전에 다음 코드를 추가하세요:

```html
<!-- Welno RAG Chat Widget -->
<script src="https://cdn.welno.com/widgets/welno-rag-chat-widget.min.js"></script>
<script>
    const welnoChat = new WelnoRagChatWidget({
        apiKey: 'YOUR_API_KEY_HERE',
        baseUrl: 'https://api.welno.com',
        uuid: 'PATIENT_UNIQUE_ID',
        hospitalId: 'YOUR_HOSPITAL_ID'
    });
    
    welnoChat.init();
</script>
```

### 3단계: 테스트
웹사이트를 새로고침하면 우측 하단에 채팅 버튼이 나타납니다. 클릭해서 테스트해보세요!

---

## ⚙️ 상세 설정

### 필수 설정 옵션

| 옵션 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `apiKey` | string | 파트너 API 키 | `'pk_abc123...'` |
| `baseUrl` | string | Welno API 서버 URL | `'https://api.welno.com'` |
| `uuid` | string | 환자/사용자 고유 ID | `'patient_12345'` |
| `hospitalId` | string | 병원/클리닉 식별자 | `'seoul_clinic'` |

### 선택적 설정 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `position` | string | `'bottom-right'` | 위젯 위치 (`'bottom-left'`, `'top-right'`, `'top-left'`) |
| `buttonColor` | string | `'#A69B8F'` | 채팅 버튼 색상 (HEX 코드) |
| `theme` | string | `'default'` | UI 테마 (`'light'`, `'dark'`, `'custom'`) |
| `autoOpen` | boolean | `false` | 페이지 로드 시 자동으로 채팅창 열기 |
| `welcomeMessage` | string | 기본 메시지 | 채팅창을 열 때 표시할 환영 메시지 |

### 고급 설정 예시

```javascript
const welnoChat = new WelnoRagChatWidget({
    // 필수 설정
    apiKey: 'pk_your_api_key_here',
    baseUrl: 'https://api.welno.com',
    uuid: 'patient_' + userId,
    hospitalId: 'gangnam_clinic',
    
    // UI 커스터마이징
    position: 'bottom-left',
    buttonColor: '#2E7D32',
    theme: 'light',
    autoOpen: false,
    welcomeMessage: '안녕하세요! 건강에 대해 궁금한 점을 물어보세요. 🏥',
    
    // 환자 건강 데이터 (선택적)
    partnerData: {
        patient: {
            name: '홍길동',
            age: 35,
            gender: 'M',
            phone: '010-1234-5678'
        },
        checkup_results: {
            height: 175,
            weight: 70,
            bmi: 22.9,
            blood_pressure: '120/80',
            fasting_glucose: 95,
            total_cholesterol: 180,
            exam_date: '2024-01-15'
        },
        medical_history: [
            '2023년 건강검진 정상',
            '고혈압 가족력 있음'
        ]
    },
    
    // 이벤트 콜백
    onOpen: function() {
        console.log('채팅창이 열렸습니다');
        // Google Analytics 이벤트 추적
        gtag('event', 'welno_chat_open', {
            event_category: 'engagement',
            event_label: 'health_consultation'
        });
    },
    
    onClose: function() {
        console.log('채팅창이 닫혔습니다');
    },
    
    onMessage: function(message) {
        console.log('새 메시지:', message);
        // 메시지별 추적 로직
    },
    
    onError: function(error) {
        console.error('위젯 오류:', error);
        // 오류 리포팅 시스템에 전송
    }
});

welnoChat.init();
```

---

## 🏥 건강 데이터 통합

### 지원하는 데이터 형식

#### 1. 기본 환자 정보
```javascript
partnerData: {
    patient: {
        name: '홍길동',           // 환자명
        birth_date: '1988-05-15', // 생년월일 (YYYY-MM-DD)
        age: 35,                  // 나이
        gender: 'M',              // 성별 (M/F)
        phone: '010-1234-5678',   // 연락처
        email: 'hong@email.com'   // 이메일 (선택적)
    }
}
```

#### 2. 검진 결과 데이터
```javascript
partnerData: {
    checkup_results: {
        // 기본 신체 정보
        height: 175,              // 키 (cm)
        weight: 70,               // 체중 (kg)
        bmi: 22.9,               // BMI
        
        // 혈압
        systolic_bp: 120,         // 수축기 혈압
        diastolic_bp: 80,         // 이완기 혈압
        blood_pressure: '120/80', // 또는 문자열 형식
        
        // 혈액 검사
        fasting_glucose: 95,      // 공복혈당 (mg/dL)
        total_cholesterol: 180,   // 총 콜레스테롤 (mg/dL)
        hdl_cholesterol: 50,      // HDL 콜레스테롤 (mg/dL)
        ldl_cholesterol: 110,     // LDL 콜레스테롤 (mg/dL)
        triglycerides: 120,       // 중성지방 (mg/dL)
        
        // 기타 검사
        hemoglobin: 14.5,         // 혈색소 (g/dL)
        hematocrit: 42.0,         // 헤마토크리트 (%)
        
        // 검진 정보
        exam_date: '2024-01-15',  // 검진일
        exam_type: '종합검진'      // 검진 종류
    }
}
```

#### 3. 병력 및 추가 정보
```javascript
partnerData: {
    medical_history: [
        '2023년 고혈압 진단',
        '2022년 당뇨 전단계',
        '가족력: 심장병'
    ],
    
    medications: [
        {
            name: '혈압약',
            dosage: '5mg',
            frequency: '1일 1회'
        }
    ],
    
    lifestyle: {
        smoking: false,           // 흡연 여부
        drinking: 'occasional',   // 음주 (none/occasional/regular/heavy)
        exercise: 'regular',      // 운동 (none/light/regular/heavy)
        diet: 'balanced'          // 식습관 (poor/fair/balanced/excellent)
    }
}
```

### 파트너별 데이터 형식

#### MediLinx 형식
```javascript
// MediLinx 파트너는 다음 형식을 사용하세요
partnerData: {
    patient: {
        name: '김환자',
        birth_date: '1985-03-15',
        sex: 'M',  // gender 대신 sex 사용
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
    }
}
```

#### KindHabit 형식
```javascript
// KindHabit 파트너는 다음 형식을 사용하세요
partnerData: {
    user_profile: {
        name: '이사용자',
        age: 28,
        gender: 'F'
    },
    health_metrics: {
        weight: 55,
        height: 160,
        body_fat: 22.5,
        muscle_mass: 38.2,
        last_updated: '2024-02-01'
    },
    activity_data: {
        daily_steps: 8500,
        calories_burned: 320,
        active_minutes: 45
    }
}
```

---

## 🎨 UI 커스터마이징

### CSS 변수를 통한 스타일링

위젯은 CSS 변수를 사용하여 쉽게 커스터마이징할 수 있습니다:

```css
/* 위젯 스타일 커스터마이징 */
:root {
    --welno-primary-color: #2E7D32;
    --welno-secondary-color: #4CAF50;
    --welno-text-color: #333333;
    --welno-background-color: #ffffff;
    --welno-border-radius: 12px;
    --welno-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    --welno-font-family: 'Noto Sans KR', sans-serif;
}

/* 채팅 버튼 커스터마이징 */
.welno-chat-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3) !important;
}

/* 채팅창 헤더 커스터마이징 */
.welno-chat-header {
    background: var(--welno-primary-color) !important;
    color: white !important;
}

/* 메시지 버블 커스터마이징 */
.welno-message-user {
    background: var(--welno-primary-color) !important;
    color: white !important;
}

.welno-message-assistant {
    background: #f5f5f5 !important;
    color: var(--welno-text-color) !important;
}
```

### 반응형 디자인

위젯은 자동으로 반응형으로 동작하지만, 추가 조정이 필요한 경우:

```css
/* 모바일 최적화 */
@media (max-width: 768px) {
    .welno-chat-window {
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
    }
    
    .welno-chat-button {
        bottom: 20px !important;
        right: 20px !important;
        width: 60px !important;
        height: 60px !important;
    }
}

/* 태블릿 최적화 */
@media (min-width: 769px) and (max-width: 1024px) {
    .welno-chat-window {
        width: 400px !important;
        height: 600px !important;
    }
}
```

---

## 🔧 API 참조

### 엔드포인트 목록

#### 1. 파트너 상태 확인
```http
GET /api/v1/rag-chat/partner/status
Authorization: Bearer YOUR_API_KEY
```

**응답 예시**:
```json
{
    "success": true,
    "partner_info": {
        "partner_id": "your_partner_id",
        "partner_name": "Your Hospital",
        "iframe_allowed": true,
        "allowed_domains": ["yourdomain.com"]
    },
    "service_status": {
        "rag_service": "available",
        "redis_connected": true,
        "api_version": "v1"
    }
}
```

#### 2. 채팅 메시지 전송
```http
POST /api/v1/rag-chat/partner/message
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**요청 본문**:
```json
{
    "uuid": "patient_unique_id",
    "hospital_id": "your_hospital_id",
    "message": "BMI가 25인데 정상인가요?",
    "session_id": "optional_session_id",
    "health_data": {
        "patient": {
            "name": "홍길동",
            "age": 35,
            "gender": "M"
        },
        "checkup_results": {
            "bmi": 25.0,
            "blood_pressure": "130/85"
        }
    }
}
```

**응답**: Server-Sent Events (SSE) 스트림

#### 3. 세션 정보 조회
```http
POST /api/v1/rag-chat/partner/session/info
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**요청 본문**:
```json
{
    "session_id": "session_unique_id"
}
```

---

## 🔒 보안 및 개인정보

### API Key 보안
- ✅ API Key는 서버 사이드에서만 사용
- ✅ HTTPS 연결 필수
- ✅ API Key 정기적 갱신 권장

### 개인정보 처리
- ✅ 모든 데이터는 암호화되어 전송
- ✅ 개인식별정보는 해시 처리
- ✅ GDPR, 개인정보보호법 준수

### 도메인 화이트리스트
파트너 설정에서 허용된 도메인에서만 위젯 사용 가능:

```json
{
    "allowed_domains": [
        "yourhospital.com",
        "www.yourhospital.com",
        "app.yourhospital.com"
    ]
}
```

---

## 📊 사용량 모니터링

### 기본 제한사항
- **API 호출**: 분당 100회
- **메시지 길이**: 최대 1,000자
- **세션 시간**: 30분 비활성 시 만료

### 사용량 확인
파트너 대시보드에서 실시간 사용량 확인 가능:
- 📈 일별/월별 API 호출 수
- 👥 활성 사용자 수
- 💬 메시지 수
- ⚡ 평균 응답 시간

---

## 🐛 문제 해결

### 자주 발생하는 문제

#### 1. 위젯이 표시되지 않음
```javascript
// 해결방법 1: DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    const welnoChat = new WelnoRagChatWidget({...});
    welnoChat.init();
});

// 해결방법 2: 스크립트 로드 확인
if (typeof WelnoRagChatWidget !== 'undefined') {
    const welnoChat = new WelnoRagChatWidget({...});
    welnoChat.init();
} else {
    console.error('Welno 위젯 스크립트가 로드되지 않았습니다.');
}
```

#### 2. API 인증 오류
```
HTTP 401: API Key가 필요합니다.
HTTP 403: 유효하지 않은 API Key입니다.
```

**해결방법**:
- API Key 확인
- 도메인 화이트리스트 확인
- HTTPS 사용 확인

#### 3. CORS 오류
```
Access to fetch at 'https://api.welno.com' from origin 'https://yourdomain.com' has been blocked by CORS policy
```

**해결방법**: 파트너십 담당자에게 도메인 등록 요청

### 디버깅 모드

개발 중에는 디버그 모드를 활성화하세요:

```javascript
const welnoChat = new WelnoRagChatWidget({
    apiKey: 'your_api_key',
    baseUrl: 'https://api.welno.com',
    uuid: 'test_user',
    hospitalId: 'test_hospital',
    
    // 디버그 모드 활성화
    debug: true,
    
    onError: function(error) {
        console.error('Welno 위젯 오류:', error);
        // 상세 오류 정보 출력
        console.error('Error details:', error.details);
    }
});
```

---

## 📞 지원 및 연락처

### 기술 지원
- **이메일**: dev@welno.com
- **전화**: 02-1234-5678 (평일 9:00-18:00)
- **Slack**: #welno-partner-support

### 파트너십 문의
- **이메일**: partnership@welno.com
- **전화**: 02-1234-5679

### 긴급 지원
- **24시간 핫라인**: 02-1234-5680
- **카카오톡**: @welno_support

---

## 📚 추가 리소스

### 문서
- [API 상세 문서](https://docs.welno.com/api)
- [위젯 개발자 가이드](https://docs.welno.com/widget)
- [보안 가이드라인](https://docs.welno.com/security)

### 샘플 코드
- [GitHub 저장소](https://github.com/welno/partner-examples)
- [CodePen 데모](https://codepen.io/welno/pen/widget-demo)
- [JSFiddle 예제](https://jsfiddle.net/welno/widget-example)

### 커뮤니티
- [개발자 포럼](https://forum.welno.com)
- [Discord 채널](https://discord.gg/welno)
- [YouTube 튜토리얼](https://youtube.com/welno-dev)

---

*최종 업데이트: 2026년 2월 6일*
*매뉴얼 버전: v1.0*

**이 매뉴얼에 대한 피드백이나 개선 제안이 있으시면 언제든 연락주세요! 🚀**