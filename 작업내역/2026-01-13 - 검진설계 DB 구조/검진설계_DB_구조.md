# 검진 설계 데이터베이스 구조

## 📊 테이블: `welno.welno_checkup_design_requests`

### 기본 스키마
```sql
CREATE TABLE IF NOT EXISTS welno.welno_checkup_design_requests (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES welno.welno_patients(id) ON DELETE CASCADE,
    
    -- 선택한 염려 항목 (JSONB)
    selected_concerns JSONB NOT NULL,
    
    -- 설문 응답 (JSONB)
    survey_responses JSONB,
    
    -- 추가 고민사항 (텍스트)
    additional_concerns TEXT,
    
    -- 검진 설계 결과 (JSONB) - STEP 1 + STEP 2 병합 결과
    design_result JSONB,
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 인덱스
```sql
CREATE INDEX idx_design_requests_patient ON welno.welno_checkup_design_requests(patient_id);
CREATE INDEX idx_design_requests_created ON welno.welno_checkup_design_requests(created_at);
CREATE INDEX idx_design_requests_concerns ON welno.welno_checkup_design_requests USING GIN (selected_concerns);
CREATE INDEX idx_design_requests_survey ON welno.welno_checkup_design_requests USING GIN (survey_responses);
```

---

## 📋 컬럼 상세 설명

### 1. `id` (SERIAL PRIMARY KEY)
- 검진 설계 요청의 고유 ID
- 자동 증가

### 2. `patient_id` (INTEGER)
- 환자 테이블(`welno.welno_patients`) 참조
- `ON DELETE CASCADE`: 환자 삭제 시 관련 설계 요청도 삭제

### 3. `selected_concerns` (JSONB NOT NULL)
- 사용자가 선택한 염려 항목들
- 구조:
```json
[
  {
    "type": "health_data" | "prescription",
    "id": "항목 ID",
    "name": "항목명",
    "date": "날짜",
    "value": "값",
    "unit": "단위",
    "status": "상태",
    "location": "병원명",
    "medication_name": "약물명",
    "period": "기간",
    "medication_text": "약물 설명"
  }
]
```

### 4. `survey_responses` (JSONB)
- 문진 설문 응답 데이터
- 구조:
```json
{
  "weight_change": "증가" | "감소" | "유지",
  "family_history": ["고혈압", "당뇨병", ...],
  "smoking": "current_smoker" | "past_smoker" | "non_smoker",
  "drinking": "주 3회 이상" | "주 1-2회" | ...,
  "exercise_freq": {...},
  "sleep_hours": "5-6시간" | ...,
  "stress_level": "매우 높음" | ...,
  "additional_concerns": "텍스트"
}
```

### 5. `additional_concerns` (TEXT)
- 추가 고민사항 (텍스트)
- `survey_responses.additional_concerns`에서 추출하여 별도 저장

### 6. `design_result` (JSONB)
- **STEP 1 + STEP 2 병합 결과**
- 구조:
```json
{
  // STEP 1 결과
  "patient_summary": "환자 상태 3줄 요약",
  "analysis": "종합 분석",
  "risk_profile": [
    {
      "organ_system": "폐 (Lung)",
      "risk_level": "High Risk",
      "reason": "현재 흡연자 or 가족력"
    }
  ],
  "chronic_analysis": {
    "has_chronic_disease": true,
    "disease_list": ["고혈압"],
    "complication_risk": "합병증 위험 설명"
  },
  "survey_reflection": "문진 내용 반영 예고",
  "selected_concerns_analysis": [...],
  "basic_checkup_guide": {...},
  
  // STEP 2 결과
  "summary": {...},
  "priority_1": {
    "title": "일반검진 주의 항목",
    "items": [...]
  },
  "priority_2": {
    "title": "정밀 검진 추천",
    "items": [...]
  },
  "priority_3": {
    "title": "프리미엄 검진",
    "items": [...]
  },
  "strategies": [...],
  "recommended_items": [...],
  "doctor_comment": "...",
  "total_count": 15
}
```

### 7. `created_at` / `updated_at` (TIMESTAMPTZ)
- 생성/수정 시간
- 자동 업데이트 트리거 적용

---

## 🔍 데이터 조회 방법

### 1. 최신 검진 설계 조회
```sql
SELECT * FROM welno.welno_checkup_design_requests
WHERE patient_id = (
    SELECT id FROM welno.welno_patients 
    WHERE uuid = 'd0b25dd5-8026-4fdc-94cc-ba8f8ddbac8e' 
    AND hospital_id = 'PEERNINE'
)
AND design_result IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

### 2. 폐 관련 위험도 확인
```sql
SELECT 
    id,
    created_at,
    design_result->'risk_profile' as risk_profile
FROM welno.welno_checkup_design_requests
WHERE patient_id = (
    SELECT id FROM welno.welno_patients 
    WHERE uuid = 'd0b25dd5-8026-4fdc-94cc-ba8f8ddbac8e' 
    AND hospital_id = 'PEERNINE'
)
AND design_result IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

### 3. 설문 응답에서 흡연 정보 확인
```sql
SELECT 
    id,
    survey_responses->>'smoking' as smoking_status,
    survey_responses->'family_history' as family_history
FROM welno.welno_checkup_design_requests
WHERE patient_id = (
    SELECT id FROM welno.welno_patients 
    WHERE uuid = 'd0b25dd5-8026-4fdc-94cc-ba8f8ddbac8e' 
    AND hospital_id = 'PEERNINE'
)
ORDER BY created_at DESC
LIMIT 1;
```

---

## 📝 데이터 저장 흐름

### STEP 1 (분석)
- **저장 안 함** (메모리에서만 처리)
- 결과는 STEP 2로 전달

### STEP 2 (설계)
- **저장함** (`save_checkup_design_request` 호출)
- `design_result`에 STEP 1 + STEP 2 병합 결과 저장
- 저장 위치: `planning-platform/backend/app/api/v1/endpoints/checkup_design.py:1547-1559`

---

## 🔗 관련 파일

1. **테이블 생성 스크립트**
   - `planning-platform/backend/database_schema.sql` (line 165-195)
   - `planning-platform/backend/scripts/create_checkup_design_table.sql`

2. **데이터 저장 서비스**
   - `planning-platform/backend/app/services/welno_data_service.py` (line 783-853)

3. **API 엔드포인트**
   - `planning-platform/backend/app/api/v1/endpoints/checkup_design.py`
   - `/create-step1`: STEP 1 분석 (저장 안 함)
   - `/create-step2`: STEP 2 설계 (저장함)

---

## 💡 폐 관련 문제 판단 근거 확인 방법

### 방법 1: `risk_profile` 확인
```sql
SELECT 
    jsonb_array_elements(design_result->'risk_profile') as risk_item
FROM welno.welno_checkup_design_requests
WHERE patient_id = (SELECT id FROM welno.welno_patients WHERE uuid = '...' AND hospital_id = '...')
AND design_result->'risk_profile' @> '[{"organ_system": "폐"}]'::jsonb
ORDER BY created_at DESC
LIMIT 1;
```

### 방법 2: `survey_responses`에서 흡연 정보 확인
```sql
SELECT 
    survey_responses->>'smoking' as smoking_status
FROM welno.welno_checkup_design_requests
WHERE patient_id = (SELECT id FROM welno.welno_patients WHERE uuid = '...' AND hospital_id = '...')
ORDER BY created_at DESC
LIMIT 1;
```

### 방법 3: `analysis` 필드에서 폐 관련 언급 확인
```sql
SELECT 
    design_result->>'analysis' as analysis_text
FROM welno.welno_checkup_design_requests
WHERE patient_id = (SELECT id FROM welno.welno_patients WHERE uuid = '...' AND hospital_id = '...')
AND design_result->>'analysis' LIKE '%폐%'
ORDER BY created_at DESC
LIMIT 1;
```
