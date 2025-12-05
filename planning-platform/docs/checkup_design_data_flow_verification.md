# 검진 설계 데이터 플로우 점검 문서

## 전체 플로우 개요

```
사용자 선택 → ChatInterface → CheckupDesignPage → API 호출 → 백엔드 프롬프트 → GPT → 파싱 → 화면 표시
```

---

## 1. 사용자 선택 데이터 수집 (프론트엔드)

### 1.1 ChatInterface에서 데이터 수집

**파일**: `frontend/src/components/checkup-design/ChatInterface/index.tsx`

**함수**: `handleSurveySubmit` (라인 726)

**수집되는 데이터**:

```typescript
// 1. 선택된 처방 이력
state.selectedPrescriptionEffects.forEach(effect => {
  const pattern = prescriptionAnalysis?.topEffects.find(...);
  const medicationText = formatEffectPatternMessage(pattern);
  selectedMedicationTexts.push(medicationText);
  
  const medicationConcern = {
    type: 'medication',
    id: `prescription-${pattern.effect}`,
    medicationName: medicationName,
    period: period,
    hospitalName: hospitalName,
    medicationText: medicationText  // 프롬프트용 사용자 친화적 텍스트
  };
  selectedConcerns.push(medicationConcern);
});

// 2. 선택된 검진 기록
state.selectedCheckupRecords.forEach(recordId => {
  const checkupConcern = {
    type: 'checkup',
    id: recordId,
    name: '건강검진',
    date: date,
    location: location,
    status: status,  // 'warning' | 'abnormal'
    abnormalCount: statusCounts.abnormal,
    warningCount: statusCounts.warning
  };
  selectedConcerns.push(checkupConcern);
});

// 3. 설문 응답 + 약품 분석 텍스트
const enhancedSurveyResponses = {
  ...surveyResponses,  // weight_change, exercise_frequency, family_history, ...
  prescription_analysis_text: prescriptionAnalysisText,  // 전체 약품 분석 결과
  selected_medication_texts: selectedMedicationTexts  // 선택된 약품 텍스트 배열
};
```

**로그 확인**:
- `console.log('🔍 [ChatInterface] 최종 selectedConcerns:', ...)`
- `console.log('🔍 [ChatInterface] 약품 분석 결과 텍스트:', ...)`
- `console.log('🔍 [ChatInterface] 선택된 약품 텍스트:', ...)`

---

## 2. 프론트엔드 → 백엔드 API 호출

### 2.1 CheckupDesignPage에서 API 호출

**파일**: `frontend/src/pages/CheckupDesignPage.tsx`

**함수**: `handleNext` (라인 98)

**STEP 1 호출**:
```typescript
const step1Response = await checkupDesignService.createCheckupDesignStep1({
  uuid,
  hospital_id: hospital,
  selected_concerns: selectedConcerns,  // ChatInterface에서 전달받은 데이터
  survey_responses: surveyResponses  // 설문 응답 + 약품 분석 텍스트 포함
});
```

**STEP 2 호출**:
```typescript
const step2Request: CheckupDesignStep2Request = {
  uuid,
  hospital_id: hospital,
  step1_result: step1Result,  // STEP 1 결과
  selected_concerns: selectedConcerns,
  survey_responses: surveyResponses,
  prescription_analysis_text: surveyResponses.prescription_analysis_text,
  selected_medication_texts: surveyResponses.selected_medication_texts
};

const step2Response = await checkupDesignService.createCheckupDesignStep2(step2Request);
```

**로그 확인**:
- `console.log('✅ [검진설계] 선택된 항목:', ...)`
- `console.log('✅ [검진설계] 선택된 염려 항목:', ...)`
- `console.log('✅ [검진설계] 설문 응답:', ...)`
- `console.log('🔍 [CheckupDesignPage] STEP 1 API 호출 시작')`
- `console.log('✅ [CheckupDesignPage] STEP 1 응답 수신:', ...)`
- `console.log('✅ [CheckupDesignPage] STEP 2 응답 수신:', ...)`

---

## 3. 백엔드 API 엔드포인트

### 3.1 STEP 1 엔드포인트

**파일**: `backend/app/api/v1/endpoints/checkup_design.py`

**함수**: `create_checkup_design_step1` (라인 571)

**데이터 처리**:

```python
# 1. 선택한 염려 항목 변환
selected_concerns = []
for concern in request.selected_concerns:
    concern_dict = {
        "type": concern.type,
        "id": concern.id,
        "name": concern.name,
        "date": concern.date or concern.checkupDate,
        "value": concern.value,
        "unit": concern.unit,
        "status": concern.status,
        "location": concern.location or concern.hospitalName,
        "medication_name": concern.medicationName,
        "period": concern.period,
        "medication_text": concern.medicationText  # 프롬프트용 텍스트
    }
    selected_concerns.append(concern_dict)

# 2. 설문 응답 정리
survey_responses_clean = request.survey_responses or {}
prescription_analysis_text = survey_responses_clean.pop("prescription_analysis_text", None)
selected_medication_texts = survey_responses_clean.pop("selected_medication_texts", None)

# 3. 프롬프트 생성
user_message = create_checkup_design_prompt_step1(
    patient_name=patient_name,
    patient_age=patient_age,
    patient_gender=patient_gender,
    health_data=health_data,
    prescription_data=prescription_data,
    selected_concerns=selected_concerns,  # 변환된 염려 항목
    survey_responses=survey_responses_clean,  # 설문 응답 (약품 분석 텍스트 제외)
    hospital_national_checkup=hospital_national_checkup,
    prescription_analysis_text=prescription_analysis_text,  # 별도 전달
    selected_medication_texts=selected_medication_texts  # 별도 전달
)
```

**로그 확인**:
- `logger.info(f"🔍 [STEP1-분석] 요청 시작 - UUID: {request.uuid}, 선택 항목: {len(request.selected_concerns)}개")`
- `logger.info(f"📊 [STEP1-분석] 건강 데이터: {len(health_data)}건")`
- `logger.info(f"💊 [STEP1-분석] 처방전 데이터: {len(prescription_data)}건")`

### 3.2 STEP 2 엔드포인트

**함수**: `create_checkup_design_step2` (라인 801)

**데이터 처리**:

```python
# 1. RAG 기반 프롬프트 생성 (async)
user_message = await create_checkup_design_prompt_step2(
    step1_result=step1_result_dict,  # STEP 1 결과
    patient_name=patient_name,
    patient_age=patient_age,
    patient_gender=patient_gender,
    health_data=health_data,
    prescription_data=prescription_data,
    selected_concerns=selected_concerns,
    survey_responses=survey_responses_clean,
    hospital_national_checkup=hospital_national_checkup,
    hospital_recommended=hospital_recommended,
    hospital_external_checkup=hospital_external_checkup,
    prescription_analysis_text=prescription_analysis_text,
    selected_medication_texts=selected_medication_texts
)
```

**로그 확인**:
- `logger.info(f"✅ [STEP2-설계] RAG 기반 프롬프트 생성 완료")`
- `logger.info(f"🤖 [STEP2-설계] OpenAI API 호출 시작... (모델: {powerful_model})")`

---

## 4. 백엔드 프롬프트 생성

### 4.1 STEP 1 프롬프트 생성

**파일**: `backend/app/services/checkup_design_prompt.py`

**함수**: `create_checkup_design_prompt_step1` (라인 약 1200)

**포함되는 데이터**:

1. **환자 기본 정보**
   - patient_name, patient_age, patient_gender

2. **선택한 염려 항목** (`selected_concerns`)
   ```python
   if selected_concerns:
       sections.append("## 선택한 염려 항목\n\n")
       for concern in selected_concerns:
           # type, name, date, location, status, medication_text 등 포함
   ```

3. **설문 응답** (`survey_responses`)
   ```python
   if survey_responses:
       sections.append("## 문진 내용\n\n")
       # weight_change, exercise_frequency, family_history, smoking, drinking, ...
   ```

4. **약품 분석 텍스트** (`prescription_analysis_text`)
   ```python
   if prescription_analysis_text:
       sections.append("## 약품 복용 이력 분석\n\n")
       sections.append(prescription_analysis_text)
   ```

5. **선택된 약품 텍스트** (`selected_medication_texts`)
   ```python
   if selected_medication_texts:
       sections.append("## 선택한 약품 복용 이력\n\n")
       for text in selected_medication_texts:
           sections.append(f"- {text}\n")
   ```

### 4.2 STEP 2 프롬프트 생성 (RAG 포함)

**함수**: `create_checkup_design_prompt_step2` (async, 라인 약 2000)

**RAG 시스템 사용**:

```python
# 1. RAG 엔진 초기화
query_engine = await init_rag_engine()

# 2. RAG 검색 수행
rag_evidence_context = await get_medical_evidence_from_rag(
    query_engine=query_engine,
    patient_summary=step1_result.get("patient_summary", ""),
    concerns=[c.get("name", "") for c in selected_concerns]
)

# 3. 프롬프트 최상단에 RAG 컨텍스트 배치
sections.insert(0, f"""
[Critical Evidence: 검색된 의학 가이드라인]

{rag_evidence_context}

**중요**: 답변은 이 내용에 기반해서만 하라.
""")
```

**포함되는 데이터**:

1. **STEP 1 결과** (`step1_result`)
   - patient_summary, analysis, risk_profile, chronic_analysis, survey_reflection, selected_concerns_analysis, basic_checkup_guide

2. **RAG 검색 결과** (`rag_evidence_context`)
   - 환자 요약 기반 검색 결과
   - 각 염려 항목별 검색 결과

3. **선택한 염려 항목** (`selected_concerns`)

4. **설문 응답** (`survey_responses`)

5. **약품 분석 텍스트** (`prescription_analysis_text`)

6. **병원 검진 항목** (`hospital_national_checkup`, `hospital_recommended`, `hospital_external_checkup`)

---

## 5. GPT API 호출 및 응답 파싱

### 5.1 STEP 1 GPT 호출

**파일**: `backend/app/api/v1/endpoints/checkup_design.py`

**라인**: 670-720

```python
# GPT 요청 생성
gpt_request = GPTRequest(
    system_message=CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1,
    user_message=user_message,  # 프롬프트
    model=fast_model,  # gpt-4o-mini
    temperature=0.3,
    max_tokens=4096,
    response_format={"type": "json_object"}
)

# API 호출
gpt_api_response = await gpt_service.call_api(gpt_request)

# JSON 파싱
ai_response = gpt_service.parse_json_response(gpt_api_response.content)
```

**예상 응답 구조**:
```json
{
  "patient_summary": "환자 상태 3줄 요약",
  "analysis": "종합 분석",
  "risk_profile": [
    {
      "organ_system": "위 (Stomach)",
      "risk_level": "High Risk",
      "reason": "위축성 위염 이력"
    }
  ],
  "chronic_analysis": {
    "has_chronic_disease": false,
    "disease_list": [],
    "complication_risk": "Low"
  },
  "survey_reflection": "문진 내용 반영 예고",
  "selected_concerns_analysis": [
    {
      "concern": "2021년 건강검진",
      "analysis": "이상 소견 분석",
      "recommendations": ["추가 검진 항목"]
    }
  ],
  "basic_checkup_guide": {
    "focus_items": [
      {
        "item_name": "혈압",
        "why_important": "이유",
        "check_point": "확인 포인트"
      }
    ]
  }
}
```

### 5.2 STEP 2 GPT 호출

**라인**: 916-970

```python
# GPT 요청 생성
gpt_request = GPTRequest(
    system_message=CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2,
    user_message=user_message,  # RAG 컨텍스트 포함 프롬프트
    model=powerful_model,  # gpt-4o
    temperature=0.3,
    max_tokens=16384,
    response_format={"type": "json_object"}
)

# API 호출
gpt_api_response = await gpt_service.call_api(gpt_request)

# JSON 파싱
ai_response = gpt_service.parse_json_response(gpt_api_response.content)

# STEP 1과 STEP 2 결과 병합
merged_result = merge_checkup_design_responses(step1_result_dict, ai_response)
```

**예상 응답 구조**:
```json
{
  "summary": {
    "priority_1": {
      "title": "기본 검진 항목",
      "description": "설명",
      "items": ["혈압", "혈당", ...],
      "count": 5
    },
    "priority_2": {
      "title": "추가 검진 항목",
      "description": "설명",
      "items": ["대장내시경", "위내시경", ...],
      "count": 3,
      "upselling_focus": true
    }
  },
  "strategies": [
    {
      "category": "대장검사",
      "step1_anchor": "기본 검진 설명",
      "step2_gap": "한계 설명",
      "step3_patient_context": "환자 상황",
      "step4_offer": "추가 검진 제안"
    }
  ],
  "recommended_items": [
    {
      "category": "대장검사",
      "category_en": "Colonoscopy",
      "priority_level": 2,
      "itemCount": 2,
      "items": [
        {
          "name": "대장내시경",
          "nameEn": "Colonoscopy",
          "description": "설명",
          "reason": "추천 이유",
          "evidence": "의학적 근거",
          "references": ["참고 자료"],
          "recommended": true
        }
      ],
      "doctor_recommendation": {
        "has_recommendation": true,
        "message": "의사 추천 메시지"
      }
    }
  ],
  "doctor_comment": "의사 종합 코멘트",
  "total_count": 5
}
```

---

## 6. 프론트엔드 화면 렌더링

### 6.1 CheckupRecommendationsPage

**파일**: `frontend/src/pages/CheckupRecommendationsPage.tsx`

**데이터 구조 매핑**:

```typescript
// 1. Summary 섹션
const priority1 = data.summary?.priority_1;
const priority2 = data.summary?.priority_2;

// 2. Strategies 아코디언
const strategies = data.strategies || [];

// 3. Recommended Items 아코디언
const recommendedItems = data.recommended_items || [];

// 4. Doctor Comment
const doctorComment = data.doctor_comment || '';
```

**렌더링 구조**:

1. **주요 사항 요약** (`summary.priority_1`, `summary.priority_2`)
   - 제목: "주요 사항은 아래와 같아요"
   - Priority 1: 기본 검진 항목
   - Priority 2: 추가 검진 항목

2. **검진 설계 전략** (`strategies`)
   - 아코디언 형태
   - 각 전략별 Bridge Strategy (4단계)

3. **추천 검진 항목** (`recommended_items`)
   - 카테고리별 아코디언
   - 각 항목별: name, description, reason, evidence, references
   - 의사 추천 메시지

4. **의사 코멘트** (`doctor_comment`)
   - 하단에 표시

---

## 7. 실제 데이터 확인 방법

### 7.1 프론트엔드 콘솔 로그

**브라우저 개발자 도구 → Console**에서 확인:

```
✅ [검진설계] 선택된 항목: [...]
✅ [검진설계] 선택된 염려 항목: [...]
✅ [검진설계] 설문 응답: {...}
🔍 [CheckupDesignPage] STEP 1 API 호출 시작
✅ [CheckupDesignPage] STEP 1 응답 수신: {...}
✅ [CheckupDesignPage] STEP 2 응답 수신: {...}
```

### 7.2 네트워크 탭 확인

**브라우저 개발자 도구 → Network**:

1. **STEP 1 요청**
   - URL: `/wello-api/v1/checkup-design/create-step1`
   - Method: POST
   - Request Payload 확인:
     - `selected_concerns`: 배열 구조 확인
     - `survey_responses`: 객체 구조 확인
     - `prescription_analysis_text`: 문자열 확인
     - `selected_medication_texts`: 배열 확인

2. **STEP 2 요청**
   - URL: `/wello-api/v1/checkup-design/create-step2`
   - Method: POST
   - Request Payload 확인:
     - `step1_result`: STEP 1 결과 포함 확인
     - `selected_concerns`: 동일한 데이터 확인
     - `survey_responses`: 동일한 데이터 확인

3. **응답 확인**
   - Response Body에서 JSON 구조 확인
   - 필수 필드 존재 확인

### 7.3 백엔드 로그 확인

```bash
# 최신 로그 확인 (현재 시간 이후)
date
tail -200 /root/.pm2/logs/Todayon-BE-out.log | grep -E "검진설계|STEP1|STEP2" | tail -50

# 에러 로그 확인
tail -100 /root/.pm2/logs/Todayon-BE-error.log | grep -E "검진설계|STEP1|STEP2"
```

**확인할 로그**:
- `🔍 [STEP1-분석] 요청 시작 - UUID: ..., 선택 항목: ...개`
- `📊 [STEP1-분석] 건강 데이터: ...건`
- `💊 [STEP1-분석] 처방전 데이터: ...건`
- `✅ [STEP1-분석] JSON 파싱 성공`
- `📊 [STEP1-분석] 파싱된 응답 키: [...]`
- `✅ [STEP2-설계] RAG 기반 프롬프트 생성 완료`
- `✅ [STEP2-설계] JSON 파싱 성공`
- `📊 [STEP2-설계] 파싱된 응답 키: [...]`

---

## 8. 데이터 전달 체크리스트

### ✅ 사용자 선택 데이터 수집

- [ ] `selectedPrescriptionEffects`가 올바르게 수집되었는가?
- [ ] `selectedCheckupRecords`가 올바르게 수집되었는가?
- [ ] `prescriptionAnalysisText`가 올바르게 생성되었는가?
- [ ] `selectedMedicationTexts`가 올바르게 생성되었는가?
- [ ] `surveyResponses`가 올바르게 수집되었는가?

### ✅ 프론트엔드 → 백엔드 전달

- [ ] API 요청 Body에 `selected_concerns` 배열이 포함되었는가?
- [ ] `selected_concerns` 각 항목에 `type`, `id`, `name`, `date`, `location`, `status` 등이 포함되었는가?
- [ ] `survey_responses` 객체에 모든 필드가 포함되었는가?
- [ ] `prescription_analysis_text`가 `survey_responses`에 포함되었는가?
- [ ] `selected_medication_texts`가 `survey_responses`에 포함되었는가?

### ✅ 백엔드 프롬프트 생성

- [ ] `create_checkup_design_prompt_step1`에 `selected_concerns`가 포함되었는가?
- [ ] `create_checkup_design_prompt_step1`에 `survey_responses`가 포함되었는가?
- [ ] `create_checkup_design_prompt_step1`에 `prescription_analysis_text`가 포함되었는가?
- [ ] `create_checkup_design_prompt_step2`에 RAG 컨텍스트가 포함되었는가?
- [ ] `create_checkup_design_prompt_step2`에 `step1_result`가 포함되었는가?

### ✅ GPT 응답 파싱

- [ ] STEP 1 응답이 JSON으로 올바르게 파싱되었는가?
- [ ] STEP 1 응답에 필수 필드(`patient_summary`, `analysis`, `risk_profile` 등)가 있는가?
- [ ] STEP 2 응답이 JSON으로 올바르게 파싱되었는가?
- [ ] STEP 2 응답에 필수 필드(`summary`, `strategies`, `recommended_items` 등)가 있는가?
- [ ] STEP 1과 STEP 2 결과가 올바르게 병합되었는가?

### ✅ 프론트엔드 화면 표시

- [ ] `summary.priority_1`이 "주요 사항 요약" 섹션에 표시되는가?
- [ ] `strategies`가 "검진 설계 전략" 아코디언에 표시되는가?
- [ ] `recommended_items`가 "추천 검진 항목" 아코디언에 표시되는가?
- [ ] 각 항목의 `reason`, `evidence`, `references`가 올바르게 표시되는가?
- [ ] `doctor_comment`가 하단에 표시되는가?

---

## 9. 문제 발생 시 확인 사항

### 문제 1: 사용자 선택 데이터가 전달되지 않음

**확인**:
1. 브라우저 콘솔에서 `🔍 [ChatInterface] 최종 selectedConcerns` 로그 확인
2. Network 탭에서 API 요청 Payload 확인
3. `selected_concerns` 배열이 비어있지 않은지 확인

**해결**:
- `handleSurveySubmit` 함수에서 데이터 수집 로직 확인
- `selectedPrescriptionEffects`, `selectedCheckupRecords` 상태 확인

### 문제 2: 프롬프트에 데이터가 포함되지 않음

**확인**:
1. 백엔드 로그에서 프롬프트 생성 로그 확인
2. `create_checkup_design_prompt_step1` 함수에서 `selected_concerns` 처리 확인
3. `survey_responses` 처리 확인

**해결**:
- 프롬프트 생성 함수에서 조건문 확인
- 데이터가 None이 아닌지 확인

### 문제 3: GPT 응답 파싱 실패

**확인**:
1. 백엔드 로그에서 `❌ [STEP1-분석] JSON 파싱 실패` 또는 `❌ [STEP2-설계] JSON 파싱 실패` 확인
2. GPT 응답 원본 확인 (로그에 저장됨)

**해결**:
- `gpt_service.parse_json_response` 함수 확인
- GPT 응답이 JSON 형식인지 확인
- `response_format={"type": "json_object"}` 설정 확인

### 문제 4: 화면에 데이터가 표시되지 않음

**확인**:
1. 브라우저 콘솔에서 API 응답 확인
2. `CheckupRecommendationsPage`에서 데이터 구조 확인
3. React DevTools에서 컴포넌트 props 확인

**해결**:
- API 응답 구조와 컴포넌트에서 기대하는 구조 일치 확인
- 옵셔널 체이닝(`?.`) 사용 확인
- 기본값 처리 확인

---

## 10. 테스트 시나리오

### 시나리오 1: 기본 검진만 선택

1. 검진 기록 1개 선택
2. 설문 응답 (기본 질문만)
3. "아니오, 이대로 진행하겠습니다" 선택
4. **확인**: 기본 검진 항목만 추천되는지

### 시나리오 2: 약품 + 검진 선택

1. 약품 이력 1개 선택
2. 검진 기록 1개 선택
3. 설문 응답 (기본 질문 + 추가 질문)
4. **확인**: 약품 분석 텍스트가 프롬프트에 포함되는지
5. **확인**: 선택된 약품 텍스트가 프롬프트에 포함되는지

### 시나리오 3: RAG 컨텍스트 확인

1. STEP 2 프롬프트에 RAG 컨텍스트 포함 확인
2. **확인**: `[Critical Evidence: 검색된 의학 가이드라인]` 섹션이 최상단에 있는지
3. **확인**: GPT 응답의 `evidence` 필드에 RAG 기반 근거가 있는지

---

## 11. 로그 파일 위치

### 백엔드 로그
- 출력 로그: `/root/.pm2/logs/Todayon-BE-out.log`
- 에러 로그: `/root/.pm2/logs/Todayon-BE-error.log`

### 프론트엔드 로그
- 브라우저 콘솔 (개발자 도구)
- Network 탭 (API 요청/응답)

---

## 12. 주요 데이터 구조

### ConcernItem (염려 항목)

```typescript
{
  type: 'checkup' | 'medication' | 'hospital',
  id: string,
  name?: string,
  date?: string,
  location?: string,
  status?: 'warning' | 'abnormal',
  abnormalCount?: number,
  warningCount?: number,
  medicationName?: string,
  period?: string,
  medicationText?: string  // 프롬프트용 사용자 친화적 텍스트
}
```

### SurveyResponses (설문 응답)

```typescript
{
  // 기본 질문
  weight_change?: string,
  exercise_frequency?: string,
  family_history?: string[],
  smoking?: string,
  drinking?: string,
  sleep_hours?: string,
  stress_level?: string,
  additional_concerns?: string,
  optional_questions_enabled?: 'yes' | 'no',
  
  // 선택적 추가 질문
  cancer_history?: string,
  hepatitis_carrier?: string,
  colonoscopy_experience?: string,
  lung_nodule?: string,
  gastritis?: string,
  imaging_aversion?: string[],
  genetic_test?: string,
  
  // 약품 분석 (프롬프트용)
  prescription_analysis_text?: string,
  selected_medication_texts?: string[]
}
```

---

이 문서를 참고하여 검진 설계 플로우 전체를 점검하세요.

