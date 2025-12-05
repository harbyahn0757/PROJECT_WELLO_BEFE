# 검진 설계 플로우 수정 완료 보고서

## 수정 완료 사항

### 1. 프롬프트 수정: `items` 배열 명시적 강조

**수정 위치**: `format_hospital_checkup_items_for_prompt()` 함수

**수정 내용**:
- `national_checkup_items`의 `items` 배열을 명시적으로 강조
- GPT에게 `priority_1.items`에 구체적인 항목명을 사용하라는 명확한 지시 추가
- 예시 추가 및 금지 사항 명시

**수정 전**:
```python
sections.append(json.dumps(classified["일반"], ensure_ascii=False, indent=2))
```

**수정 후**:
```python
# items 배열을 명시적으로 강조
sections.append("**구체적인 검진 항목명 (items 배열):**\n")
for item in classified["일반"]:
    items_array = item.get("items", [])
    if items_array:
        sections.append(f"- **{item.get('name', 'N/A')}**의 세부 항목: {', '.join(items_array)}\n")
sections.append("\n")

sections.append("**⚠️ priority_1.items 작성 규칙 (매우 중요):**\n")
sections.append("1. 위의 'items' 배열에 있는 **구체적인 항목명**을 사용하세요\n")
sections.append("2. 예시: ['혈압측정', '체질량지수', '신체계측', '혈액검사', '소변검사']\n")
sections.append("3. **절대 사용하지 말 것**: 일반적인 카테고리명 (예: '소화기계 검사', '심혈관 건강 검사')\n")
sections.append("4. **반드시 DB의 'items' 배열에 있는 항목명만 사용하세요**\n")
sections.append("5. priority_1.items는 최대 3개만 선택하되, 환자의 상황(과거 검진 + 문진 + 선택 항목)과 가장 관련이 높은 항목을 선정하세요\n\n")
```

---

### 2. STEP 2 프롬프트 수정: `priority_1.items` 작성 규칙 강화

**수정 위치**: `create_checkup_design_prompt_step2()` 함수 내 프롬프트 템플릿

**수정 내용**:
- `priority_1.items` 작성 규칙에 구체적인 항목명 사용 강제
- 예시를 구체적인 항목명으로 변경
- 금지 사항 명시

**수정 전**:
```
"items": ["기본 검진 항목명 1", "기본 검진 항목명 2"],
```

**수정 후**:
```
"items": ["혈압측정", "체질량지수", "신체계측"],
```

**추가된 규칙**:
```
**중요 규칙 (priority_1) - 매우 중요:**
- priority_1.items의 모든 항목은 반드시 hospital_national_checkup의 **'items' 배열**에 있는 구체적인 항목명이어야 합니다
- **절대 사용하지 말 것**: 일반적인 카테고리명 (예: '소화기계 검사', '심혈관 건강 검사', '위장 건강', '심혈관 건강')
- **반드시 사용할 것**: DB의 'items' 배열에 있는 구체적인 항목명 (예: '혈압측정', '체질량지수', '신체계측', '혈액검사', '소변검사', '흉부X선', '시력검사', '청력검사')
- **예시**: 환자가 소화기계 관련 걱정이 있어도 '소화기계 검사'가 아닌 '혈액검사', '소변검사' 같은 구체적인 항목명을 사용하세요
```

---

### 3. RAG 검색 개선

**수정 위치**: `get_medical_evidence_from_rag()` 함수

**수정 내용**:
- 검색 쿼리를 더 구체적으로 작성
- 검색 결과 로깅 추가
- 검색 실패 시 대체 로직 개선

**수정 전**:
```python
deep_query = f"{concern_name}에 대한 진료지침 및 검진 가이드라인"
```

**수정 후**:
```python
# 더 구체적인 검색 쿼리 생성
if concern_type == "checkup":
    deep_query = f"{concern_name} 건강검진 결과 해석 및 추후 검진 가이드라인"
elif concern_type == "medication":
    medication_name = concern.get("medicationName", concern_name)
    deep_query = f"{medication_name} 복용 환자 검진 가이드라인 및 주의사항"
else:
    deep_query = f"{concern_name}에 대한 진료지침 및 검진 가이드라인"
```

**로깅 추가**:
```python
print(f"[INFO] RAG 기본 검색 성공 - 응답 길이: {len(evidence_text)}")
print(f"[INFO] RAG 심층 검색 성공 ({concern_name}) - 응답 길이: {len(evidence_text)}")
print(f"[INFO] RAG 검색 완료 - 전체 컨텍스트 길이: {len(combined_evidence)}")
```

---

## 김현우내과 DB 데이터 확인

### national_checkup_items 구조

```json
[
  {
    "name": "일반건강검진",
    "category": "기본검진",
    "items": ["신체계측", "혈압측정", "혈액검사", "소변검사", "흉부X선", "시력검사", "청력검사"],
    "gender": "all",
    "age_range": "40-64",
    "frequency": "2년마다",
    "description": "국가에서 시행하는 의무 건강검진"
  },
  {
    "name": "암검진",
    "category": "암검진",
    "items": ["위암검진", "대장암검진", "간암검진", "유방암검진", "자궁경부암검진"],
    "gender": "all",
    "age_range": "40-74",
    "frequency": "1-2년마다",
    "description": "국가 암검진 프로그램"
  }
]
```

**사용 가능한 구체적인 항목명**:
- 신체계측
- 혈압측정
- 체질량지수 (신체계측에 포함될 수 있음)
- 혈액검사
- 소변검사
- 흉부X선
- 시력검사
- 청력검사
- 위암검진
- 대장암검진
- 간암검진
- 유방암검진
- 자궁경부암검진

---

## 데이터 플로우 확인

### 1. DB → 백엔드

**확인**: ✅ 정상
- `get_hospital_by_id()` 함수에서 `national_checkup_items` 정상 조회
- JSONB 배열로 반환됨

### 2. 백엔드 → 프롬프트

**수정 전**: ❌ `items` 배열이 프롬프트에 포함되지만 명시적으로 강조되지 않음
**수정 후**: ✅ `items` 배열을 명시적으로 강조하고 사용 규칙 명시

### 3. 프롬프트 → GPT

**수정 전**: ❌ GPT가 일반적인 카테고리명 사용 가능
**수정 후**: ✅ GPT가 구체적인 항목명만 사용하도록 강제

### 4. GPT → 프론트엔드

**확인 필요**: 프론트엔드에서 `priority_1.items`가 올바르게 렌더링되는지 확인

---

## 예상 결과

### 수정 전
```json
{
  "priority_1": {
    "items": ["소화기계 검사", "심혈관 건강 검사"],
    "focus_items": [
      {
        "item_name": "소화기계 검사",
        "why_important": "...",
        "check_point": "..."
      }
    ]
  }
}
```

### 수정 후 (예상)
```json
{
  "priority_1": {
    "items": ["혈압측정", "체질량지수", "신체계측"],
    "focus_items": [
      {
        "item_name": "혈압측정",
        "why_important": "가족력으로 심장병이 있어 혈압을 주의 깊게 모니터링해야 합니다...",
        "check_point": "수축기 혈압이 140mmHg 이상이거나 이완기 혈압이 90mmHg 이상이면 고혈압 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요."
      },
      {
        "item_name": "체질량지수",
        "why_important": "문진에서 체중 증가를 확인했고, 운동 부족이 있어 대사증후군 위험이 높습니다...",
        "check_point": "체질량지수가 25 이상이면 비만으로 진단될 수 있으니 이 부분은 잘 봐주세요."
      },
      {
        "item_name": "신체계측",
        "why_important": "과거 검진에서 경계 범위였고, 문진에서 확인한 체중 증가를 고려하여...",
        "check_point": "신체계측 결과를 통해 비만 여부와 건강 상태를 종합적으로 평가할 수 있습니다."
      }
    ]
  }
}
```

---

## 추가 확인 사항

### 1. RAG 검색 결과 확인

**확인 방법**:
- 백엔드 로그에서 `[INFO] RAG 검색 완료 - 전체 컨텍스트 길이: ...` 확인
- 검색 결과가 충분한지 확인 (길이가 0이면 문제)

**개선 사항**:
- 검색 쿼리를 더 구체적으로 작성
- 검색 결과 로깅 추가

### 2. 프론트엔드 렌더링 확인

**확인 사항**:
- `priority_1.items`가 올바르게 표시되는지
- `focus_items`가 올바르게 표시되는지
- 말풍선에 텍스트가 표시되는지

---

## 다음 단계

1. **테스트 실행**: 실제 검진 설계를 실행하여 결과 확인
2. **로그 확인**: 백엔드 로그에서 RAG 검색 결과 확인
3. **프론트엔드 확인**: 화면에 구체적인 항목명이 표시되는지 확인
4. **추가 수정**: 필요 시 추가 수정 진행

---

## 수정 파일 목록

1. `backend/app/services/checkup_design_prompt.py`
   - `format_hospital_checkup_items_for_prompt()` 함수 수정
   - `create_checkup_design_prompt_step2()` 함수 내 프롬프트 템플릿 수정
   - `get_medical_evidence_from_rag()` 함수 개선

---

수정 완료. 테스트 후 결과를 확인하세요.

