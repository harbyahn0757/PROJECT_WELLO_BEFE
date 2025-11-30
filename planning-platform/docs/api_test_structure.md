# 검진 설계 API 테스트 구조

## 테스트 스크립트

### 1. `test_checkup_design_api.py`
전체 API 통합 테스트 스크립트

**위치**: `backend/scripts/test_checkup_design_api.py`

**기능**:
- 설문 포함 전체 테스트
- 설문 없이 테스트
- 응답 구조 검증
- 카테고리별 상세 정보 확인

**실행 방법**:
```bash
cd planning-platform/backend
python3 scripts/test_checkup_design_api.py
```

**테스트 데이터**:
- UUID: `e3471a9a-2d67-4a23-8599-849963397d1c`
- Hospital ID: `KIM_HW_CLINIC`
- API URL: `http://localhost:9282/wello-api/v1/checkup-design/create`

### 2. `check_test_patient_data.py`
테스트용 환자 데이터 확인 스크립트

**위치**: `backend/scripts/check_test_patient_data.py`

**기능**:
- 환자 정보 확인
- 건강검진 데이터 개수 확인
- 처방전 데이터 개수 확인
- 최근 건강검진 샘플 확인

**실행 방법**:
```bash
cd planning-platform/backend
python3 scripts/check_test_patient_data.py
```

## API 엔드포인트

### POST `/wello-api/v1/checkup-design/create`

**요청 형식**:
```json
{
  "uuid": "e3471a9a-2d67-4a23-8599-849963397d1c",
  "hospital_id": "KIM_HW_CLINIC",
  "selected_concerns": [
    {
      "type": "checkup",
      "id": "checkup-0",
      "name": "건강검진",
      "date": "2021/09/28",
      "location": "이루탄메디케어의원",
      "status": "abnormal",
      "abnormalCount": 2,
      "warningCount": 1
    }
  ],
  "survey_responses": {
    "weight_change": "increase_some",
    "exercise_frequency": "sometimes",
    "family_history": ["hypertension", "diabetes"],
    "smoking": "non_smoker",
    "drinking": "monthly_1_2",
    "sleep_hours": "6_7",
    "stress_level": "medium",
    "additional_concerns": "최근 두통이 자주 발생합니다."
  }
}
```

**응답 형식**:
```json
{
  "success": true,
  "data": {
    "recommended_items": [
      {
        "category": "기본 건강검진",
        "category_en": "Basic Health Checkup",
        "itemCount": 3,
        "items": [
          {
            "name": "혈압 측정",
            "nameEn": "Blood Pressure Measurement",
            "description": "혈압을 측정하여 고혈압 여부를 확인합니다.",
            "reason": "가족력에 고혈압이 있어 정기적으로 혈압을 체크하는 것이 중요합니다.",
            "priority": 1,
            "recommended": true
          }
        ],
        "doctor_recommendation": {
          "has_recommendation": true,
          "message": "안광수님, 최근 두통이 자주 발생하고...",
          "highlighted_text": "기본 건강검진을 통해 건강 상태를 점검하세요."
        },
        "defaultExpanded": true
      }
    ],
    "analysis": "환자의 건강 상태를 종합적으로 분석한 결과...",
    "total_count": 5
  },
  "message": "검진 설계가 완료되었습니다."
}
```

## 테스트 시나리오

### 시나리오 1: 설문 포함 전체 테스트
1. 염려 항목 선택
2. 설문 응답 입력 (8개 항목)
3. API 호출
4. 응답 검증
5. DB 저장 확인

### 시나리오 2: 설문 없이 테스트
1. 염려 항목만 선택
2. 설문 응답 없이 API 호출
3. 응답 검증 (설문 없이도 정상 동작 확인)

## 검증 항목

1. **HTTP 상태 코드**: 200
2. **응답 구조**: `success`, `data`, `message` 필드 존재
3. **데이터 구조**: `recommended_items`, `analysis`, `total_count` 필드 존재
4. **카테고리별 항목**: 각 카테고리에 `items` 배열 존재
5. **의사 추천**: `doctor_recommendation` 필드 존재
6. **DB 저장**: `wello_checkup_design_requests` 테이블에 저장 확인

## 개선 사항

1. ✅ 설문 응답이 프롬프트에 포함됨
2. ✅ 설문 데이터가 DB에 저장됨
3. ✅ Perplexity API 우선 사용, 실패 시 OpenAI 폴백
4. ✅ 업셀링용 데이터 저장 완료

## 다음 단계

1. 실제 프론트엔드에서 테스트
2. 다양한 설문 응답 조합 테스트
3. DB 저장 데이터 확인
4. 업셀링용 데이터 활용 방안 검토

