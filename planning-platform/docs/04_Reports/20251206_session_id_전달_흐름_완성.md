# Session ID 전달 흐름 완성 보고서

## 📋 개요
프론트엔드에서 백엔드로 session_id를 전달하여 GPT 프롬프트 로깅 시스템을 완성했습니다.

---

## ✅ 구현 완료 사항

### 1. **백엔드 구현 (이미 완료)**

#### STEP 1 API (`/create-step1`)
```python
# app/api/v1/endpoints/checkup_design.py (line 592-598)

# 세션 로거 시작
session_logger = get_session_logger()
session_id = session_logger.start_session(
    patient_uuid=request.uuid,
    patient_name="",  # 환자 정보 조회 후 업데이트
    hospital_id=request.hospital_id
)
logger.info(f"🎬 [SessionLogger] 세션 시작: {session_id}")
```

**응답에 session_id 포함** (line 750):
```python
# 응답에 session_id 포함
ai_response['session_id'] = session_id

return CheckupDesignResponse(
    success=True,
    data=ai_response,
    message="STEP 1 분석 완료"
)
```

#### STEP 2 API (`/create-step2`)
```python
# app/api/v1/endpoints/checkup_design.py (line 101)

class CheckupDesignStep2Request(BaseModel):
    """STEP 2 검진 설계 요청 모델"""
    uuid: str
    hospital_id: str
    step1_result: Step1Result
    selected_concerns: List[ConcernItem]
    survey_responses: Optional[Dict[str, Any]]
    additional_info: Optional[Dict[str, Any]]
    prescription_analysis_text: Optional[str]
    selected_medication_texts: Optional[List[str]]
    session_id: Optional[str] = Field(None, description="세션 ID (로깅용)")
```

**GPT 호출 시 session_id 전달** (line 974):
```python
gpt_response_p1 = await gpt_service.call_api(
    gpt_request_p1,
    save_log=True,
    patient_uuid=request.uuid,
    session_id=request.session_id if hasattr(request, 'session_id') and request.session_id else None,
    step_number="2-1",
    step_name="Priority 1 - 일반검진 주의 항목"
)
```

---

### 2. **프론트엔드 구현 (금번 완료)**

#### 타입 정의 수정 (`checkupDesignService.ts`)

**CheckupDesignRequest에 session_id 추가**:
```typescript
export interface CheckupDesignRequest {
  uuid: string;
  hospital_id: string;
  selected_concerns: ConcernItem[];
  survey_responses?: {...};
  additional_info?: Record<string, any>;
  session_id?: string; // ✅ 추가됨 (로깅용)
}
```

**Step1Result에 session_id 추가**:
```typescript
export interface Step1Result {
  patient_summary: string;
  analysis: string;
  survey_reflection: string;
  selected_concerns_analysis: Array<{...}>;
  basic_checkup_guide: {...};
  session_id?: string; // ✅ 추가됨 (STEP 1에서 생성되어 반환됨)
}
```

**CheckupDesignStep2Request에 session_id 추가**:
```typescript
export interface CheckupDesignStep2Request extends CheckupDesignRequest {
  step1_result: Step1Result;
  session_id?: string; // ✅ 추가됨 (STEP 1에서 전달받음)
}
```

#### STEP 1 API 호출 시 session_id 로깅
```typescript
// checkupDesignService.ts (line 166-172)

const result: CheckupDesignResponse = await response.json();
console.log('✅ [STEP1-분석] API 응답 수신:', {
  success: result.success,
  has_analysis: !!result.data?.analysis,
  has_survey_reflection: !!result.data?.survey_reflection,
  has_selected_concerns_analysis: !!result.data?.selected_concerns_analysis,
  session_id: result.data?.session_id  // ✅ 추가됨
});

// session_id가 있으면 로그 출력
if (result.data?.session_id) {
  console.log('🎬 [SessionLogger] STEP 1에서 세션 ID 받음:', result.data.session_id);
}
```

#### STEP 2 API 호출 시 session_id 전달
```typescript
// checkupDesignService.ts (line 189-198)

console.log('🔍 [STEP2-설계] API 호출:', {
  url,
  uuid: request.uuid,
  hospital_id: request.hospital_id,
  has_step1_result: !!request.step1_result,
  session_id: request.session_id  // ✅ 추가됨
});

// session_id가 있으면 로그 출력
if (request.session_id) {
  console.log('🎬 [SessionLogger] STEP 2에 세션 ID 전달:', request.session_id);
}

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(request),  // session_id가 포함됨
});
```

#### CheckupDesignPage.tsx 수정

**STEP 1 응답에서 session_id 추출**:
```typescript
// CheckupDesignPage.tsx (line 146-159)

// STEP 1 결과 저장 (타이핑 효과용) - analyzing 단계에서 타이핑 시작
if (step1Response.success && step1Response.data) {
  setStep1Result(step1Response.data);
  setProcessingProgress(50);
  
  // 세션 ID 추출
  const sessionId = step1Response.data.session_id;
  if (sessionId) {
    console.log('🎬 [CheckupDesignPage] STEP 1에서 세션 ID 받음:', sessionId);
  } else {
    console.warn('⚠️ [CheckupDesignPage] STEP 1 응답에 session_id가 없음');
  }
  
  // analyzing 단계 유지 (타이핑 효과가 시작되도록)
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

**STEP 2 요청에 session_id 포함**:
```typescript
// CheckupDesignPage.tsx (line 165-191)

const step1Data = step1Response.data;
const step1Result: Step1Result = {
  patient_summary: step1Data.patient_summary || '',
  analysis: step1Data.analysis || '',
  survey_reflection: step1Data.survey_reflection || '',
  selected_concerns_analysis: step1Data.selected_concerns_analysis || [],
  basic_checkup_guide: step1Data.basic_checkup_guide || {
    title: '',
    description: '',
    focus_items: []
  },
  session_id: step1Data.session_id  // ✅ 세션 ID 전달
};

const step2Request: CheckupDesignStep2Request = {
  uuid,
  hospital_id: hospital,
  step1_result: step1Result,
  selected_concerns: selectedConcerns,
  survey_responses: surveyResponses,
  session_id: step1Data.session_id  // ✅ 세션 ID 전달
};

// 세션 ID 로그
if (step1Data.session_id) {
  console.log('🎬 [CheckupDesignPage] STEP 2에 세션 ID 전달:', step1Data.session_id);
}

console.log('🔍 [CheckupDesignPage] STEP 2 API 호출 시작');
```

---

## 🔄 전체 흐름

### 1️⃣ **STEP 1: 세션 시작 및 분석**

```
프론트엔드                      백엔드
    |                              |
    | ─────── POST /create-step1 ──────>
    |         (uuid, hospital_id,       |
    |          selected_concerns)       |
    |                              |
    |                              | session_logger.start_session()
    |                              | → session_id 생성
    |                              |
    |                              | GPT API 호출 (분석)
    |                              | → session_id와 함께 로깅
    |                              |
    | <─────── Response ───────────
    |         {                         |
    |           success: true,          |
    |           data: {                 |
    |             analysis: "...",      |
    |             session_id: "XXX"  ✅ |
    |           }                       |
    |         }                         |
    |                              |
    | console.log("세션 ID 받음: XXX")
    |                              |
```

### 2️⃣ **STEP 2: 세션 ID 전달 및 설계**

```
프론트엔드                      백엔드
    |                              |
    | session_id 추출              |
    | (step1Response.data.session_id)
    |                              |
    | ─────── POST /create-step2 ──────>
    |         {                         |
    |           uuid: "...",            |
    |           hospital_id: "...",     |
    |           step1_result: {...},    |
    |           session_id: "XXX"    ✅ |
    |         }                         |
    |                              |
    |                              | request.session_id 확인
    |                              | → "XXX"
    |                              |
    |                              | GPT API 호출 (Priority 1)
    |                              | → session_id="XXX"로 로깅
    |                              |
    |                              | GPT API 호출 (Priority 2,3)
    |                              | → session_id="XXX"로 로깅
    |                              |
    | <─────── Response ───────────
    |         {                         |
    |           success: true,          |
    |           data: {                 |
    |             recommended_items...  |
    |           }                       |
    |         }                         |
    |                              |
```

### 3️⃣ **로깅 파일 구조**

```
backend/logs/
└── patient_e3471a9a.json
    {
      "patient_uuid": "e3471a9a-...",
      "patient_name": "홍길동",
      "hospital_id": "guro_seoul",
      "sessions": [
        {
          "session_id": "20241206_123045_e3471a9a",  ✅
          "started_at": "2024-12-06T12:30:45",
          "steps": [
            {
              "step_number": "1",
              "step_name": "빠른 분석",
              "model": "gpt-4o-mini",
              "prompt": "...",
              "response": "...",
              "timestamp": "2024-12-06T12:30:50"
            },
            {
              "step_number": "2-1",
              "step_name": "Priority 1 - 일반검진 주의 항목",
              "model": "gpt-4o",
              "prompt": "...",
              "response": "...",
              "timestamp": "2024-12-06T12:31:05"
            },
            {
              "step_number": "2-2",
              "step_name": "Priority 2,3 + Strategies",
              "model": "gpt-4o",
              "prompt": "...",
              "response": "...",
              "timestamp": "2024-12-06T12:31:25"
            }
          ]
        }
      ]
    }
```

---

## 🎯 핵심 포인트

### ✅ 구현 완료
1. **STEP 1에서 session_id 생성 및 반환** ✅
2. **프론트엔드에서 session_id 추출** ✅
3. **STEP 2 요청 시 session_id 전달** ✅
4. **백엔드에서 session_id 기반 로깅** ✅
5. **같은 session_id로 모든 STEP 묶여서 로깅** ✅

### 📊 로깅 데이터 연결성
- **STEP 1 (분석)**: session_id로 로깅
- **STEP 2-1 (Priority 1)**: 같은 session_id로 로깅
- **STEP 2-2 (Priority 2,3)**: 같은 session_id로 로깅
- **결과**: 하나의 검진 설계 요청에 대한 모든 GPT 호출이 하나의 세션으로 묶여서 관리됨

### 🔍 디버깅 편의성
- 브라우저 콘솔에서 session_id 확인 가능
- 백엔드 로그에서 session_id로 검색 가능
- 로그 파일에서 session_id로 전체 플로우 추적 가능

---

## 🧪 테스트 방법

### 1. 검진 설계 요청 실행
1. 건강 데이터가 있는 환자로 로그인
2. 검진 설계 페이지 진입
3. 염려 항목 선택 및 설문 응답
4. "검진 항목 추천받기" 클릭

### 2. 브라우저 콘솔 확인
```
🎬 [SessionLogger] STEP 1에서 세션 ID 받음: 20241206_123045_e3471a9a
🎬 [CheckupDesignPage] STEP 2에 세션 ID 전달: 20241206_123045_e3471a9a
🎬 [SessionLogger] STEP 2에 세션 ID 전달: 20241206_123045_e3471a9a
```

### 3. 백엔드 로그 확인
```bash
# 특정 session_id로 검색
grep "20241206_123045_e3471a9a" backend/logs/uvicorn.log

# 로그 파일 확인
cat backend/logs/patient_e3471a9a.json
```

---

## 📝 요약

**프론트엔드에서 백엔드로 session_id를 전달하는 로직이 완성되었습니다!**

- ✅ 타입 정의 추가
- ✅ STEP 1 응답에서 session_id 추출
- ✅ STEP 2 요청에 session_id 포함
- ✅ 콘솔 로그로 흐름 추적 가능
- ✅ 백엔드 로깅 시스템과 완전 연동

**결과**: 이제 하나의 검진 설계 요청에 대한 모든 GPT 프롬프트와 응답이 같은 session_id로 묶여서 로깅됩니다! 🎉

---

## 📅 작성일
2024-12-06

## 📌 관련 파일
- `planning-platform/frontend/src/services/checkupDesignService.ts`
- `planning-platform/frontend/src/pages/CheckupDesignPage.tsx`
- `planning-platform/backend/app/api/v1/endpoints/checkup_design.py`
- `planning-platform/backend/app/services/session_logger.py`

