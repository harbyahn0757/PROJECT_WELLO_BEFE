# 틸코 인증 시스템 단계별 플로우 도식화

## 전체 시스템 아키텍처

```mermaid
graph TB
    subgraph "사용자 디바이스"
        Browser[웹 브라우저]
        KakaoTalk[카카오톡 앱]
    end
    
    subgraph "WELLO 시스템"
        Frontend[React 프론트엔드<br/>AuthForm.tsx]
        Backend[FastAPI 백엔드<br/>tilko_auth.py]
        Redis[(Redis 세션 저장소)]
    end
    
    subgraph "외부 API"
        TilkoAPI[틸코 API<br/>api.tilko.net]
        KakaoAPI[카카오 간편인증]
    end
    
    Browser --> Frontend
    Frontend --> Backend
    Backend --> Redis
    Backend --> TilkoAPI
    TilkoAPI --> KakaoAPI
    KakaoAPI --> KakaoTalk
```

## 단계별 상세 플로우

### 1단계: 초기 접속 및 정보 확인

```mermaid
sequenceDiagram
    participant User as 👤 사용자
    participant Browser as 🌐 브라우저
    participant Frontend as ⚛️ 프론트엔드
    participant Backend as 🔧 백엔드
    participant DB as 🗄️ 데이터베이스

    User->>Browser: URL 접속<br/>uuid=a1b2c3d4...&hospital=KHW001
    Browser->>Frontend: 페이지 로드
    Frontend->>Backend: GET /api/v1/patients/{uuid}
    Backend->>DB: SELECT * FROM mdx_agr_list WHERE uuid=?
    DB-->>Backend: 환자 정보 반환
    Backend-->>Frontend: 환자 데이터 (이름, 생년월일, 전화번호)
    Frontend-->>Browser: 정보 확인 화면 표시
    
    Note over Browser: 화면: "안광수님 존함이 맞나요?"<br/>전화번호: 010-5618-0757<br/>생년월일: 1981-09-27
```

### 2단계: 세션 생성 및 틸코 인증 요청

```mermaid
sequenceDiagram
    participant User as 👤 사용자
    participant Browser as 🌐 브라우저
    participant Frontend as ⚛️ 프론트엔드
    participant Backend as 🔧 백엔드
    participant Redis as 📦 Redis
    participant Tilko as 🔐 틸코 API

    User->>Browser: "인증하기" 버튼 클릭
    Browser->>Frontend: handleAllConfirmed()
    
    Frontend->>Backend: POST /api/v1/tilko/session/start<br/>{"user_name": "안광수", "birthdate": "19810927", ...}
    Backend->>Redis: 세션 생성 (30분 TTL)
    Redis-->>Backend: session_id: a4d89c6d-03f8...
    Backend-->>Frontend: {"success": true, "session_id": "a4d89c6d..."}
    
    Frontend->>Backend: POST /api/v1/tilko/session/simple-auth?session_id=a4d89c6d...
    Backend->>Tilko: POST /oauth/2.0/req<br/>암호화된 사용자 정보
    Tilko-->>Backend: {"Status": "OK", "ResultData": {"CxId": "133abc..."}}
    Backend->>Redis: temp_auth_data 저장
    Backend-->>Frontend: {"success": true, "message": "카카오톡에서 인증을 진행해주세요"}
    
    Frontend-->>Browser: 상태 변경: auth_pending
    Note over Browser: 화면: "카카오 인증을 확인해주세요"<br/>로딩 애니메이션 표시
```

### 3단계: 카카오톡 인증 및 상태 모니터링

```mermaid
sequenceDiagram
    participant User as 👤 사용자
    participant KakaoTalk as 📱 카카오톡
    participant Browser as 🌐 브라우저
    participant Frontend as ⚛️ 프론트엔드
    participant Backend as 🔧 백엔드
    participant Redis as 📦 Redis
    participant Tilko as 🔐 틸코 API

    Tilko->>KakaoTalk: 인증 메시지 발송
    KakaoTalk-->>User: 푸시 알림 수신
    
    Note over KakaoTalk: 화면: "건강보험공단 본인인증"<br/>"확인" 버튼
    User->>KakaoTalk: "확인" 버튼 클릭
    KakaoTalk->>Tilko: 인증 완료 신호
    
    loop 15초마다 상태 확인
        Frontend->>Backend: GET /api/v1/tilko/session/{session_id}/status
        Backend->>Redis: 세션 데이터 조회
        Redis-->>Backend: 현재 상태 반환
        Backend-->>Frontend: {"status": "auth_pending", "auth_completed": false}
        Note over Browser: 화면: 계속 대기 중...
    end
    
    Note over Backend: 수동 또는 자동으로<br/>auth_completed 상태 변경
    Backend->>Redis: status = "auth_completed"
    
    Frontend->>Backend: GET /api/v1/tilko/session/{session_id}/status
    Backend-->>Frontend: {"status": "auth_completed", "auth_completed": true}
    Frontend-->>Browser: 상태 변경: 인증 완료
    Note over Browser: 화면: "인증이 완료되었습니다!"<br/>다음 단계 버튼 활성화
```

### 4단계: 건강검진 데이터 수집

```mermaid
sequenceDiagram
    participant User as 👤 사용자
    participant Browser as 🌐 브라우저
    participant Frontend as ⚛️ 프론트엔드
    participant Backend as 🔧 백엔드
    participant Redis as 📦 Redis
    participant Tilko as 🔐 틸코 API
    participant NHIS as 🏥 건보공단

    User->>Browser: "건강검진 데이터 수집" 버튼 클릭
    Browser->>Frontend: 데이터 수집 요청
    
    Frontend->>Backend: POST /api/v1/tilko/session/{session_id}/collect-health-data
    Backend->>Redis: 세션에서 auth_data 조회
    Redis-->>Backend: CxId, Token, TxId 반환
    
    Backend->>Tilko: POST /oauth/2.0/health<br/>인증 토큰으로 건강검진 데이터 요청
    Tilko->>NHIS: 건보공단 API 호출
    NHIS-->>Tilko: 건강검진 결과 반환
    Tilko-->>Backend: 암호화된 건강검진 데이터
    
    Backend->>Redis: health_data 저장
    Backend-->>Frontend: {"success": true, "message": "데이터 수집 완료"}
    
    Frontend-->>Browser: 상태 변경: 데이터 수집 완료
    Note over Browser: 화면: "건강검진 데이터가 수집되었습니다"<br/>결과 표시 또는 다음 단계
```

## 화면별 상태 변화

### 프론트엔드 화면 상태

```mermaid
stateDiagram-v2
    [*] --> InfoConfirm: 페이지 로드
    InfoConfirm --> AuthRequesting: 인증하기 클릭
    AuthRequesting --> AuthPending: 틸코 API 호출 성공
    AuthPending --> AuthCompleted: 카카오톡 인증 완료
    AuthCompleted --> DataCollecting: 데이터 수집 시작
    DataCollecting --> DataCompleted: 수집 완료
    DataCompleted --> [*]
    
    InfoConfirm: 정보 확인<br/>- 이름, 전화번호, 생년월일 표시<br/>- "인증하기" 버튼
    AuthRequesting: 인증 요청 중<br/>- "카카오 간편인증을 요청하고 있습니다"<br/>- 로딩 스피너
    AuthPending: 인증 대기<br/>- "카카오톡에서 인증을 확인해주세요"<br/>- 15초마다 상태 확인
    AuthCompleted: 인증 완료<br/>- "인증이 완료되었습니다"<br/>- "건강검진 데이터 수집" 버튼
    DataCollecting: 데이터 수집 중<br/>- "건강검진 데이터를 수집하고 있습니다"<br/>- 프로그레스 바
    DataCompleted: 수집 완료<br/>- "데이터 수집이 완료되었습니다"<br/>- 결과 표시
```

### 백엔드 세션 상태

```mermaid
stateDiagram-v2
    [*] --> initiated: 세션 생성
    initiated --> auth_requesting: 간편인증 요청
    auth_requesting --> auth_pending: 틸코 API 성공
    auth_pending --> auth_completed: 카카오톡 인증 완료
    auth_completed --> fetching_health_data: 데이터 수집 시작
    fetching_health_data --> completed: 수집 완료
    completed --> [*]
    
    initiated: 세션 초기화<br/>- user_info 저장<br/>- 30분 TTL 설정
    auth_requesting: 인증 요청 중<br/>- 틸코 API 호출<br/>- 암호화 처리
    auth_pending: 인증 대기<br/>- temp_auth_data 저장<br/>- CxId 보관
    auth_completed: 인증 완료<br/>- auth_data 생성<br/>- 토큰 저장
    fetching_health_data: 데이터 수집<br/>- 백그라운드 작업<br/>- 틸코 API 호출
    completed: 완료<br/>- health_data 저장<br/>- 세션 종료 준비
```

## 에러 처리 및 예외 상황

### 주요 에러 케이스

```mermaid
flowchart TD
    Start([인증 시작]) --> CheckUser{사용자 정보<br/>유효성 검사}
    CheckUser -->|실패| Error1[에러: 사용자 정보 불일치]
    CheckUser -->|성공| CreateSession[세션 생성]
    
    CreateSession --> CallTilko[틸코 API 호출]
    CallTilko --> CheckCxId{CxId 존재?}
    CheckCxId -->|null| Error2[에러: 카카오톡 미연동]
    CheckCxId -->|존재| WaitAuth[카카오톡 인증 대기]
    
    WaitAuth --> CheckTimeout{5분 타임아웃?}
    CheckTimeout -->|예| Error3[에러: 인증 타임아웃]
    CheckTimeout -->|아니오| CheckAuth{인증 완료?}
    CheckAuth -->|아니오| WaitAuth
    CheckAuth -->|예| Success[인증 성공]
    
    Error1 --> End([종료])
    Error2 --> End
    Error3 --> End
    Success --> End
```

## 데이터 저장 구조

### Redis 세션 데이터 구조

```json
{
  "session_id": "a4d89c6d-03f8-41d3-872d-4d0c0fd662e8",
  "user_info": {
    "name": "안광수",
    "birthdate": "19810927",
    "phone_no": "01056180757",
    "gender": "M"
  },
  "status": "auth_completed",
  "created_at": "2025-10-14T17:10:24.168868",
  "updated_at": "2025-10-14T17:12:26.213091",
  "expires_at": "2025-10-14T17:40:24.168868",
  "temp_auth_data": {
    "cxId": "133abc2743-4ec1-4fd7-8aa8-89308fbf7a5b",
    "privateAuthType": "0",
    "reqTxId": "b3225489b85246c6959ed530ad31bc5eezaay5u4",
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "txId": "b3225489b85246c6959ed530ad31bc5eezaay5u4"
  },
  "auth_data": {
    "CxId": "133abc2743-4ec1-4fd7-8aa8-89308fbf7a5b",
    "PrivateAuthType": "0",
    "ReqTxId": "b3225489b85246c6959ed530ad31bc5eezaay5u4",
    "Token": "eyJhbGciOiJIUzI1NiJ9...",
    "TxId": "b3225489b85246c6959ed530ad31bc5eezaay5u4"
  },
  "health_data": null,
  "prescription_data": null,
  "progress": {
    "auth_requested": false,
    "auth_completed": true,
    "health_data_fetched": false,
    "prescription_data_fetched": false,
    "completed": false
  },
  "messages": [
    {
      "timestamp": "2025-10-14T17:10:24.168868",
      "type": "info",
      "message": "안광수님의 인증 세션이 시작되었습니다."
    },
    {
      "timestamp": "2025-10-14T17:12:26.213113",
      "type": "info",
      "message": "인증이 완료되었습니다. 건강검진 데이터를 수집할 수 있습니다."
    }
  ]
}
```

## API 엔드포인트 매핑

| 단계 | 프론트엔드 액션 | 백엔드 API | 설명 |
|------|----------------|------------|------|
| 1 | 페이지 로드 | `GET /api/v1/patients/{uuid}` | 환자 정보 조회 |
| 2 | 인증 시작 | `POST /api/v1/tilko/session/start` | 세션 생성 |
| 3 | 간편인증 | `POST /api/v1/tilko/session/simple-auth` | 틸코 인증 요청 |
| 4 | 상태 확인 | `GET /api/v1/tilko/session/{id}/status` | 인증 상태 모니터링 |
| 5 | 데이터 수집 | `POST /api/v1/tilko/session/{id}/collect-health-data` | 건강검진 데이터 수집 |

## 보안 고려사항

1. **데이터 암호화**: 틸코 API 통신 시 AES + RSA 이중 암호화
2. **세션 관리**: Redis TTL 30분, 자동 만료
3. **토큰 보안**: JWT 토큰 안전한 저장 및 전송
4. **개인정보 보호**: 민감 정보 암호화 저장
5. **API 보안**: CORS 설정, 인증 헤더 검증

이 도식화를 통해 전체 틸코 인증 시스템의 흐름을 이해하고, 각 단계별 처리 과정을 명확히 파악할 수 있습니다.
