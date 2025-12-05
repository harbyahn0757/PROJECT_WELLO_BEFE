# 검진 설계 플로우 코드 레벨 분석 보고서

## 문제점 요약

1. **priority_1 섹션 말풍선에 텍스트 없음**
2. **priority_1에 구체적인 검진 항목명이 아닌 일반적인 카테고리명만 표시됨** (예: "소화기계 검사", "심혈관 건강 검사")
3. **DB에 있는 실제 검진 항목(items 배열)을 활용하지 않음** (예: "혈압측정", "체질량지수", "신체계측" 등)
4. **하부 섹션에 설명 부족** (RAG 검색 결과 부족 가능성)

---

## 1. 데이터베이스 구조 분석

### 1.1 김현우내과 DB 구조

**테이블**: `wello.wello_hospitals`
**병원 ID**: `KIM_HW_CLINIC`

**필드 구조**:
- `national_checkup_items` (JSONB): 일반검진 항목
- `recommended_items` (JSONB): 병원 추천 항목
- `external_checkup_items`: 외부 검사 항목 (매핑 테이블에서 조회)

**national_checkup_items 구조**:
```json
[
  {
    "name": "일반건강검진",
    "category": "기본검진",
    "description": "국가에서 시행하는 의무 건강검진",
    "age_range": "40-64",
    "gender": "all",
    "frequency": "2년마다",
    "items": ["신체계측", "혈압측정", "혈액검사", "소변검사", "흉부X선", "시력검사", "청력검사"]
  },
  {
    "name": "암검진",
    "category": "암검진",
    "description": "국가 암검진 프로그램",
    "age_range": "40-74",
    "gender": "all",
    "frequency": "1-2년마다",
    "items": ["위암검진", "대장암검진", "간암검진", "유방암검진", "자궁경부암검진"]
  }
]
```

**핵심 포인트**:
- 각 항목에 `items` 배열이 있음
- `items` 배열에 구체적인 검진 항목명이 포함됨 (예: "혈압측정", "체질량지수", "신체계측")
- 이 `items` 배열을 `priority_1.items`에 사용해야 함

---

## 2. 코드 레벨 플로우 분석

### 2.1 병원 정보 조회

**파일**: `backend/app/services/wello_data_service.py`
**함수**: `get_hospital_by_id()` (라인 163)

**조회 쿼리**:
```python
hospital_query = """
    SELECT hospital_id, hospital_name, phone, address, 
           supported_checkup_types, layout_type, brand_color, logo_position, 
           checkup_items, national_checkup_items, recommended_items,
           is_active, created_at
    FROM wello.wello_hospitals 
    WHERE hospital_id = $1 AND is_active = true
"""
```

**반환 데이터**:
- `hospital_dict['national_checkup_items']`: JSONB 배열
- `hospital_dict['recommended_items']`: JSONB 배열
- `hospital_dict['external_checkup_items']`: 매핑 테이블에서 조회한 배열

**확인 사항**: ✅ DB에서 정상적으로 조회됨

---

### 2.2 프롬프트 생성 (STEP 2)

**파일**: `backend/app/services/checkup_design_prompt.py`
**함수**: `create_checkup_design_prompt_step2()` (라인 2057)

**프롬프트에 포함되는 데이터**:

1. **병원 검진 항목 섹션**:
   - `format_hospital_checkup_items_for_prompt()` 함수 호출 (라인 2311)
   - `hospital_national_checkup`, `hospital_recommended`, `hospital_external_checkup` 전달

2. **문제점 발견**:
   - `format_hospital_checkup_items_for_prompt()` 함수에서 `national_checkup_items`의 `items` 배열을 제대로 활용하지 않음
   - 프롬프트에 `items` 배열이 포함되지 않음

---

### 2.3 format_hospital_checkup_items_for_prompt 함수 분석

**파일**: `backend/app/services/checkup_design_prompt.py`
**함수**: `format_hospital_checkup_items_for_prompt()` (라인 551)

**현재 구현**:
```python
if national_checkup_items:
    classified = classify_hospital_checkup_items_by_category(national_checkup_items)
    
    sections.append("## 병원 기본 검진 항목 (카테고리별 분류)\n\n")
    
    # 일반/기본검진 카테고리
    if classified["일반"]:
        sections.append("### [일반/기본검진] 카테고리 (priority_1에 포함 가능)\n")
        sections.append("**중요**: 이 카테고리의 항목만 priority_1에 포함할 수 있습니다.\n\n")
        sections.append(json.dumps(classified["일반"], ensure_ascii=False, indent=2))
        sections.append("\n\n")
```

**문제점**:
1. `items` 배열이 JSON에 포함되지만, 프롬프트에서 명시적으로 강조되지 않음
2. GPT가 `items` 배열을 활용하라는 지시가 명확하지 않음
3. `priority_1.items`에 구체적인 항목명을 넣으라는 지시가 있지만, 어떤 항목명을 사용해야 하는지 예시가 부족함

---

### 2.4 RAG 검색 분석

**파일**: `backend/app/services/checkup_design_prompt.py`
**함수**: `get_medical_evidence_from_rag()` (라인 327)

**검색 로직**:
1. 기본 검색: `patient_summary` 기반 위험 요인 가이드라인 검색
2. 심층 검색: `concerns` 리스트 순회하며 각 염려 항목별 검색

**문제점 가능성**:
1. RAG 검색 결과가 부족할 수 있음
2. 검색 쿼리가 너무 일반적일 수 있음
3. 검색 결과가 프롬프트에 제대로 포함되지 않을 수 있음

---

## 3. 프론트엔드 렌더링 분석

### 3.1 CheckupRecommendationsPage

**파일**: `frontend/src/pages/CheckupRecommendationsPage.tsx`

**priority_1 렌더링**:
- `summary.priority_1.items` 배열을 렌더링
- 각 항목에 대한 `focus_items` 정보 표시

**문제점**:
- `priority_1.items`에 일반적인 카테고리명이 들어오면 화면에 그대로 표시됨
- 구체적인 항목명이 없으면 말풍선에 표시할 내용이 없음

---

## 4. 해결 방안

### 4.1 프롬프트 수정 (우선순위: 높음)

**수정 위치**: `format_hospital_checkup_items_for_prompt()` 함수

**수정 내용**:
1. `national_checkup_items`의 `items` 배열을 명시적으로 강조
2. GPT에게 `priority_1.items`에 `items` 배열의 구체적인 항목명을 사용하라고 명확히 지시
3. 예시 추가: "예: ['혈압측정', '체질량지수', '신체계측']"

**수정 예시**:
```python
if classified["일반"]:
    sections.append("### [일반/기본검진] 카테고리 (priority_1에 포함 가능)\n")
    sections.append("**중요**: 이 카테고리의 항목만 priority_1에 포함할 수 있습니다.\n\n")
    
    # items 배열을 명시적으로 강조
    for item in classified["일반"]:
        items_array = item.get("items", [])
        if items_array:
            sections.append(f"**{item.get('name')}**의 세부 항목:\n")
            sections.append(f"- {', '.join(items_array)}\n\n")
    
    sections.append(json.dumps(classified["일반"], ensure_ascii=False, indent=2))
    sections.append("\n\n")
    
    sections.append("**priority_1.items 작성 규칙:**\n")
    sections.append("- 위의 'items' 배열에 있는 구체적인 항목명을 사용하세요\n")
    sections.append("- 예: ['혈압측정', '체질량지수', '신체계측']\n")
    sections.append("- 일반적인 카테고리명(예: '소화기계 검사')을 사용하지 마세요\n")
    sections.append("- 반드시 DB의 'items' 배열에 있는 항목명만 사용하세요\n\n")
```

### 4.2 STEP 2 프롬프트 수정

**수정 위치**: `create_checkup_design_prompt_step2()` 함수

**수정 내용**:
1. `priority_1.items` 작성 규칙 강화
2. DB의 `items` 배열을 활용하라는 명시적 지시 추가

**수정 예시**:
```python
"priority_1": {{
  "title": "1순위: 관리하실 항목이에요",
  "description": "...",
  "items": ["혈압측정", "체질량지수", "신체계측"],  // 반드시 national_checkup_items의 items 배열에 있는 구체적인 항목명만 사용
  "count": 3,
  "national_checkup_items": ["혈압측정", "체질량지수", "신체계측"],  // items와 동일
  "focus_items": [
    {{
      "item_name": "혈압측정",  // items 배열의 항목명과 정확히 일치해야 함
      "why_important": "...",
      "check_point": "..."
    }}
  ]
}}
```

### 4.3 RAG 검색 개선

**수정 위치**: `get_medical_evidence_from_rag()` 함수

**개선 방안**:
1. 검색 쿼리를 더 구체적으로 작성
2. 검색 결과가 없을 때 대체 로직 추가
3. 검색 결과 로깅 추가

---

## 5. 점검 체크리스트

### 5.1 DB 데이터 확인

- [ ] `national_checkup_items`에 `items` 배열이 있는가?
- [ ] `items` 배열에 구체적인 항목명이 있는가?
- [ ] 김현우내과의 `items` 배열 내용 확인

### 5.2 프롬프트 확인

- [ ] `format_hospital_checkup_items_for_prompt()`에서 `items` 배열을 포함하는가?
- [ ] GPT에게 `items` 배열을 활용하라는 지시가 있는가?
- [ ] `priority_1.items` 작성 규칙이 명확한가?

### 5.3 RAG 검색 확인

- [ ] RAG 검색이 정상적으로 실행되는가?
- [ ] 검색 결과가 프롬프트에 포함되는가?
- [ ] 검색 결과가 충분한가?

### 5.4 프론트엔드 확인

- [ ] `priority_1.items`가 올바르게 렌더링되는가?
- [ ] `focus_items`가 올바르게 표시되는가?
- [ ] 말풍선에 텍스트가 표시되는가?

---

## 6. 즉시 수정 필요 사항

1. **프롬프트 수정**: `format_hospital_checkup_items_for_prompt()` 함수에서 `items` 배열을 명시적으로 강조
2. **STEP 2 프롬프트 수정**: `priority_1.items` 작성 규칙 강화
3. **RAG 검색 로깅 추가**: 검색 결과 확인을 위한 로깅 추가

---

## 7. 추가 확인 사항

1. **실제 DB 데이터 확인**: 김현우내과의 `national_checkup_items` 실제 데이터 확인
2. **프롬프트 로그 확인**: 실제 생성된 프롬프트에서 `items` 배열이 포함되는지 확인
3. **GPT 응답 확인**: GPT가 `priority_1.items`에 구체적인 항목명을 사용하는지 확인

---

이 보고서를 바탕으로 코드 수정을 진행하겠습니다.

