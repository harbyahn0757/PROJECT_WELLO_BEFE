# 파트너 위젯 · 병원별 임베딩 준비 명세

**목적:** 파트너가 위젯 로드 시 `apiKey`, `baseUrl`, `uuid`, `hospitalId`, `partnerData`(선택) 등을 넘기는 방식이 **현재 Welno 코드와 호환되는지** 확인하고, **병원별 임베딩 확장 시** 하위 종속성을 정리한 문서입니다.

---

## 1. 보내는 방식 정리 (파트너 측)

### 1.1 백엔드에서 병원 ID 설정 (예: routes/checkupData.js)

```javascript
exportData.welnoHospitalId = exportData.cust_id || 'medilinx_clinic';
```

- `cust_id`가 있으면 그대로 사용, 없으면 `'medilinx_clinic'` 사용 → **이 방식 그대로 사용 가능.**

### 1.2 뷰에서 위젯 초기화 (예: views/health_examination_result.ejs)

```javascript
var opts = {
    apiKey: <%- typeof welnoApiKey !== "undefined" ? JSON.stringify(welnoApiKey) : '""' %>,
    baseUrl: 'https://welno.kindhabit.com',
    uuid: <%- typeof welnoUuid !== "undefined" ? JSON.stringify(welnoUuid) : '""' %>,
    hospitalId: <%- typeof welnoHospitalId !== "undefined" ? JSON.stringify(welnoHospitalId) : '""' %>,
    position: 'bottom-right',
    theme: 'light',
    welcomeMessage: '안녕하세요! 검진 결과에 대해 궁금한 점을 물어보세요.'
};
// partnerData가 있으면 추가
if (typeof welnoPartnerData !== "undefined" && welnoPartnerData) {
    opts.partnerData = welnoPartnerData;
}
var widget = new WelnoRagChatWidget(opts);
widget.init();
```

- **넘기는 항목:** `apiKey`, `baseUrl`, `uuid`, `hospitalId`, `position`, `theme`, `welcomeMessage`, (선택) `partnerData`.
- **결론:** 위 구성이 Welno 위젯·API 계약과 일치하며, **이대로 보내면 됩니다.**

---

## 2. Welno 측 수신 계약 (하위 호환 확인)

### 2.1 위젯(프론트) 수신

| 파트너 옵션   | Welno 위젯 필드   | 기본값(미전달 시)   | 비고 |
|---------------|-------------------|----------------------|------|
| apiKey        | config.apiKey     | (필수, 없으면 throw) | -    |
| baseUrl       | config.baseUrl    | `'http://localhost:8082'` | - |
| uuid          | config.uuid       | `'widget_user_' + Date.now()` | 페이지마다 동일 값 권장 |
| hospitalId    | config.hospitalId | `'widget_partner'`   | **병원별 구분용, 반드시 전달 권장** |
| partnerData   | config.partnerData | `null`              | 있으면 웜업/메시지 시 그대로 전송 |
| position      | config.position   | `'bottom-right'`     | -    |
| theme         | config.theme      | `'default'`          | -    |
| welcomeMessage| config.welcomeMessage | 기본 문구        | -    |

- **파일:** `planning-platform/frontend/src/embed/WelnoRagChatWidget.js` (constructor)
- **하위 호환:** `hospitalId` 미전달 시 `'widget_partner'` 사용 → 기존 동작 유지. 병원별로 쓰려면 **반드시** `hospitalId` 전달.

### 2.2 API 요청 시 전달 내용

- **웜업** `POST /welno-api/v1/rag-chat/partner/warmup`  
  - Body: `uuid`, `hospital_id`(← config.hospitalId), `health_data`(← config.partnerData, 있으면)
- **메시지** `POST /welno-api/v1/rag-chat/partner/message`  
  - Body: `uuid`, `hospital_id`, `message`, `session_id`, `health_data`(있으면)

위젯은 `hospitalId` → `hospital_id`, `partnerData` → `health_data` 로 그대로 매핑하여 전송합니다. **현재 코드에 문제 없음.**

---

## 3. 백엔드 하위 종속성 (hospital_id / partnerData 사용처)

아래 구간은 모두 **이미 `hospital_id`를 사용**하므로, 파트너가 `hospitalId`를 넘기면 **병원별로** 구분됩니다. 추가 수정 없이 병원별 임베딩에 대응 가능합니다.

### 3.1 세션 ID 생성

- **파일:** `backend/app/utils/security_utils.py`
- **함수:** `generate_secure_session_id(partner_id, uuid, hospital_id, ...)`
- **역할:** `hospital_id`가 해시 입력에 포함 → **병원별로 서로 다른 세션 ID** 생성.
- **확인:** `hospital_id` 인자 필수, 호출부에서 모두 전달 중.

### 3.2 파트너 RAG API (웜업 / 메시지)

- **파일:** `backend/app/api/v1/endpoints/partner_rag_chat.py`
- **웜업:** `PartnerWarmupRequest.hospital_id` 필수 → 서비스에 그대로 전달.
- **메시지:** `PartnerChatMessageRequest.hospital_id` 필수(또는 Legacy에서 `body.get('hospital_id', 'partner')`) → 서비스에 그대로 전달.
- **로그:** 웜업/메시지 수신 시 `partner_id`, `uuid`, `hospital_id` 로그 출력(위젯 모드 점검용).

### 3.3 파트너 RAG 서비스

- **파일:** `backend/app/services/partner_rag_chat_service.py`
- **사용처:**
  - `handle_partner_message_stream(..., hospital_id, ...)` → 내부 `_generate_partner_response_stream`, `_inject_partner_context_to_session` 등에 전달.
  - `_inject_partner_context_to_session(uuid, hospital_id, session_id, ...)` → Welno RAG 서비스 호출 시 `hospital_id` 전달.
- **역할:** 대화·컨텍스트가 **uuid + hospital_id** 단위로 유지됨.

### 3.4 Welno RAG 채팅 서비스 (대화 저장·조회)

- **파일:** `backend/app/services/welno_rag_chat_service.py`
- **사용처:**
  - `add_message(uuid, hospital_id, role, content)`  
  - `get_history(uuid, hospital_id)`  
  - 메타데이터/설문 키: `welno:rag_chat:metadata:{uuid}:{hospital_id}:{session_id}` 등.
- **역할:** 채팅 기록·메타데이터가 **병원별(uuid + hospital_id)** 로 분리됨.

### 3.5 Redis 키

- 세션 메타/데이터: `session_id` 기반 (이미 `hospital_id`가 세션 ID 생성에 반영).
- Welno 쪽: `welno:rag_chat:*:{uuid}:{hospital_id}:*` 형태로 **병원별 분리**.

### 3.6 기타

- **Slack 알림:** `slack_service` 등에서 `hospital_id` 전달 시 "병원/파트너" 필드에 표시.
- **감사 로그:** `log_partner_access(..., additional_info={"hospital_id": ...})` 로 기록.

---

## 4. partnerData(검진 데이터) 흐름

- 위젯: `config.partnerData` → 웜업/메시지 요청 시 `health_data`로 전송.
- API: `health_data`(또는 `patient_info`+`checkup_results` 등) 수신 → `_process_partner_health_data()` 로 전처리 → `partner_data`로 RAG 컨텍스트에 반영.
- **병원 ID와의 관계:**  
  - 같은 `uuid`라도 **hospital_id가 다르면** 세션·히스토리가 분리되므로, **병원별로 서로 다른 partnerData**를 넣어도 서로 덮어쓰지 않음.  
  - 즉, **병원별 데이터 수신은 현재 구조로 이미 지원됨.**

---

## 5. 병원별 임베딩 확장 시 체크리스트

나중에 **병원별 임베딩 기능**을 더 넓히거나, 여러 병원에서 동시에 위젯을 쓸 때 아래만 지키면 **현재 코드와 충돌 없음**입니다.

### 파트너(호출 측) 준비

- [ ] **병원 ID 일원화**  
  - 각 병원/클리닉마다 고유한 `cust_id`(또는 이에 대응하는 값)를 두고,  
  - `welnoHospitalId = cust_id || 'medilinx_clinic'` 형태로 export.
- [ ] **위젯 초기화 시 항상 전달**  
  - `apiKey`, `baseUrl`, `uuid`, `hospitalId`, `position`, `theme`, `welcomeMessage`  
  - 검진 등 데이터가 있으면 `partnerData` 추가.
- [ ] **같은 환자·같은 병원**에서는 **동일한 uuid + hospitalId** 사용 (세션·캐시 일관성).

### Welno(우리) 측 확인 사항 (이미 반영됨)

- [x] 위젯: `hospitalId` 수신 및 모든 API 호출에 `hospital_id` 포함.
- [x] API: 웜업/메시지에서 `hospital_id` 필수(또는 Legacy 기본값) 처리.
- [x] 세션: `hospital_id` 포함한 세션 ID 생성.
- [x] 대화/메타: `uuid` + `hospital_id` 단위 저장·조회.
- [x] 로그/감사: `hospital_id` 포함 로그로 위젯 모드·병원별 추적 가능.

### 추가로 하고 싶을 때 (선택)

- 신규 파트너/병원 추가 시: **동일 API Key**로 여러 `hospitalId`를 쓰는 것 가능 (현재 구조 지원).
- 병원별 통계/분석이 필요하면: 이미 로그·감사에 `hospital_id`가 있으므로, 수집 파이프라인에서 `hospital_id` 기준 집계만 추가하면 됨.

---

## 6. 요약

| 항목 | 상태 |
|------|------|
| 파트너가 `cust_id` → `welnoHospitalId`, 위젯에 `hospitalId` 넣어서 전송 | ✅ 권장 방식이며 현재 계약과 일치 |
| `apiKey`, `baseUrl`, `uuid`, `hospitalId`, `position`, `theme`, `welcomeMessage` + (선택) `partnerData` | ✅ 위젯·API 스펙과 동일, 그대로 사용 가능 |
| Welno 백엔드가 `hospital_id`를 세션·히스토리·Redis·로그 전반에 사용 | ✅ 이미 반영됨, 하위 호환 유지 |
| 병원별로 서로 다른 데이터(partnerData) 수신 | ✅ hospital_id로 세션/컨텍스트가 분리되므로 현재 코드로 지원됨 |

**정리:**  
지금처럼 **routes/checkupData.js에서 `welnoHospitalId` 설정하고, health_examination_result.ejs에서 위젯 옵션에 `hospitalId`(및 필요 시 `partnerData`) 포함해 초기화**하는 방식이 맞고,  
Welno 쪽은 **이미 hospital_id 기반으로 동작**하므로 **현재 코드를 깨지 않고** 병원별 임베딩·데이터 수신이 가능합니다.  
나중에 병원을 더 늘릴 때는 **동일 계약(opts 형태 + hospitalId 필수 전달)**만 유지하면 됩니다.
