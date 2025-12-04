# 검진 설계 결과 페이지 화면 구성 분석 보고서

## JSON 응답 구조 분석

### 1. 전체 구조
```json
{
  "patient_summary": "...",           // 환자 요약 (현재 미사용)
  "basic_checkup_guide": {...},       // 일반검진 가이드 (현재 미렌더링)
  "selected_concerns_analysis": [...], // 선택 항목 분석 (현재 미사용)
  "summary": {
    "priority_1": {...},              // 1순위: 관리하실 항목이에요 (렌더링됨)
    "priority_2": {...},              // 2순위: 병원 추천 (렌더링됨)
    "priority_3": {...}               // 3순위: 선택 검진 (렌더링됨)
  },
  "strategies": [...],                 // 브리징 전략 (현재 미사용)
  "recommended_items": [...],         // 카테고리별 추천 항목 (렌더링됨)
  "analysis": "...",                   // 종합 분석 (렌더링됨)
  "survey_reflection": "...",          // 문진 반영 (현재 미사용)
  "doctor_comment": "...",            // 의사 코멘트 (현재 미사용)
  "_citations": [...]                 // 참고 자료 (렌더링됨)
}
```

## 현재 화면 구성 (CheckupRecommendationsPage.tsx)

### ✅ 렌더링되는 섹션

1. **헤더 + 인사말**
   - 병원 로고
   - 뒤로가기 버튼
   - 환자 이름 + 인사말
   - 정보 아이콘

2. **종합 분석 섹션** (`gptResponse.analysis`)
   - `{highlight}...{/highlight}` 패턴 지원
   - Perplexity Citations 표시

3. **관리하실 항목이에요 섹션** (`summary.priority_1`)
   - 섹션 헤더 (제목 + 개수 뱃지)
   - 1순위 우선순위 카드 (아코디언)
     - `priority_1.description` 표시
     - `priority_1.items` 뱃지 형태로 표시
     - `priority_1.national_checkup_note` 간호사 말풍선으로 표시
   - `priority_level === 1`인 카테고리 카드들

4. **추가권고검진 섹션** (`priority_level === 2`)
   - 카테고리별 카드 (아코디언)
   - 각 카테고리 내 검진 항목들
   - 의사 추천 메시지

5. **선택 추가 항목 섹션** (`priority_level === 3`)
   - 카테고리별 카드 (아코디언)
   - 각 카테고리 내 검진 항목들

### ❌ 미렌더링 섹션

1. **`basic_checkup_guide`** (일반검진 가이드)
   - `title`: "일반검진, 이 부분은 잘 보세요"
   - `description`: 설명 텍스트
   - `focus_items`: 배열
     - `item_name`: 항목명
     - `why_important`: 왜 중요한지
     - `check_point`: 확인 포인트

2. **`selected_concerns_analysis`** (선택 항목 분석)
   - 각 선택 항목에 대한 추이 분석
   - 검진 설계 반영 내용
   - 관련 검진 항목

3. **`strategies`** (브리징 전략)
   - The Bridge Strategy 적용 내용
   - 4단계 브리징 내러티브
   - 추천 항목 정보

4. **`summary.priority_2.description`** (2순위 설명)
   - 현재 카테고리별로만 표시됨

5. **`summary.priority_3.description`** (3순위 설명)
   - 현재 카테고리별로만 표시됨

6. **`survey_reflection`** (문진 반영 내용)
   - 문진 내용이 검진 설계에 어떻게 반영되었는지

7. **`doctor_comment`** (의사 코멘트)
   - 마무리 인사 및 검진 독려 메시지

## 권장 화면 구성

### 1. 상단 섹션 (현재 유지)
- 헤더 + 인사말
- 종합 분석 (`analysis`)

### 2. 일반검진 가이드 섹션 (신규 추가 필요)
**위치**: 종합 분석 아래, "관리하실 항목이에요" 위

```
[일반검진, 이 부분은 잘 보세요]
{description}

[아코디언 카드]
- 혈압(최고/최저)
  왜 중요한지: ...
  확인 포인트: ...
- 혈액검사(공복혈당, 콜레스테롤)
  왜 중요한지: ...
  확인 포인트: ...
- 소변검사
  왜 중요한지: ...
  확인 포인트: ...
```

### 3. 관리하실 항목이에요 섹션 (현재 유지)
- `priority_1` 카드
- `priority_level === 1` 카테고리들

### 4. 선택 항목 분석 섹션 (신규 추가 고려)
**위치**: 관리하실 항목이에요 아래 (선택적)

```
[선택하신 항목 분석]
- 스토마정(소화성궤양용제) 복용 이력
  추이 분석: ...
  검진 설계 반영: ...
  관련 검진 항목: ...
```

### 5. 추가권고검진 섹션 (현재 유지)
- `priority_level === 2` 카테고리들

### 6. 선택 추가 항목 섹션 (현재 유지)
- `priority_level === 3` 카테고리들

### 7. 하단 섹션 (신규 추가 고려)
- **문진 반영 내용** (`survey_reflection`)
  - 문진 내용이 검진 설계에 어떻게 반영되었는지 설명
- **의사 코멘트** (`doctor_comment`)
  - 마무리 인사 및 검진 독려 메시지

## 우선순위별 작업 계획

### Phase 1: 필수 추가 (사용자 경험 개선)
1. **`basic_checkup_guide` 렌더링**
   - 일반검진 가이드 섹션 추가
   - `focus_items` 아코디언 카드로 표시
   - 위치: 종합 분석 아래

2. **`doctor_comment` 렌더링**
   - 하단에 의사 코멘트 섹션 추가
   - 마무리 메시지로 활용

### Phase 2: 선택적 추가 (정보 보강)
3. **`selected_concerns_analysis` 렌더링**
   - 선택 항목 분석 섹션 추가
   - 사용자가 선택한 항목의 맥락 설명

4. **`survey_reflection` 렌더링**
   - 문진 반영 내용 섹션 추가
   - 문진이 검진 설계에 어떻게 반영되었는지 설명

### Phase 3: 고급 기능 (향후 고려)
5. **`strategies` 렌더링**
   - 브리징 전략 섹션 추가
   - The Bridge Strategy 4단계 내러티브 표시

6. **`priority_2`, `priority_3` description 표시**
   - 각 우선순위 섹션에 설명 추가

## 현재 데이터 매핑 상태

### ✅ 정상 매핑
- `gptResponse.analysis` → 종합 분석 섹션
- `gptResponse.summary.priority_1` → 관리하실 항목이에요 섹션
- `gptResponse.recommended_items` → 카테고리별 검진 항목
- `gptResponse._citations` → 참고 자료

### ⚠️ 부분 매핑
- `gptResponse.basic_checkup_guide` → 변수에 저장되지만 렌더링 안 됨
- `gptResponse.summary.priority_2.description` → 카테고리별로만 표시
- `gptResponse.summary.priority_3.description` → 카테고리별로만 표시

### ❌ 미매핑
- `gptResponse.patient_summary`
- `gptResponse.selected_concerns_analysis`
- `gptResponse.strategies`
- `gptResponse.survey_reflection`
- `gptResponse.doctor_comment`

## 결론

현재 화면은 **핵심 기능은 모두 렌더링**되고 있으나, **일반검진 가이드**와 **의사 코멘트** 등 사용자 경험을 개선할 수 있는 섹션들이 누락되어 있습니다. 

**우선적으로 추가해야 할 섹션:**
1. `basic_checkup_guide` - 일반검진 가이드 (사용자가 일반검진 결과지를 확인할 때 주의할 점)
2. `doctor_comment` - 의사 코멘트 (마무리 메시지)

이 두 섹션을 추가하면 사용자가 검진 결과지를 확인할 때 더 명확한 가이드를 받을 수 있고, 전체적인 메시지의 완성도가 높아집니다.

