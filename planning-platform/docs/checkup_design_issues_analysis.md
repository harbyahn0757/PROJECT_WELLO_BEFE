# 건강 검진 설계 출력 문제점 분석표

## 현재 상황과 문제점 원인 분석

### 문제 1: "올해 주의 깊게 보셔야 하는거" 섹션 항목 범위 문제

| 항목 | 내용 |
|------|------|
| **현재 문제** | priority_1의 항목들이 기본 검진 항목에서 나와야 하는데, 범위를 크게 보고 답이 나오는 것 같음 |
| **DB 구조** | DB에는 일반/종합/옵션으로 구분되어 있음 |
| **프롬프트 위치** | `checkup_design_prompt.py` 라인 599-608 |
| **프롬프트 내용** | `hospital_national_checkup`만 priority_1에 포함하도록 지시하고 있음 |
| **문제 원인** | 1. 프롬프트에서 `hospital_national_checkup`의 구조를 명확히 제시하지 않음<br>2. GPT가 일반/종합/옵션 구분을 정확히 이해하지 못함<br>3. 프롬프트에 "기본 검진 항목 중에서"라는 표현만 있고, DB의 일반/종합/옵션 구분을 명시하지 않음 |
| **데이터 흐름** | API → `hospital_national_checkup` 조회 → 프롬프트에 포함 → GPT 응답 → 프론트엔드 렌더링 |
| **해결 방안** | 1. 프롬프트에 일반/종합/옵션 구분 명시<br>2. `hospital_national_checkup`의 구조를 더 명확히 제시<br>3. GPT에게 "일반" 카테고리 항목만 priority_1에 포함하도록 강조 |

---

### 문제 2: 문진 반영내용, 선택하신 항목분석 배경 섹션 제거

| 항목 | 내용 |
|------|------|
| **현재 문제** | 배경 섹션이 있어서 접혀있어도 너무 많은 영역을 차지함 |
| **프론트엔드 위치** | `CheckupRecommendationsPage.tsx` 라인 520-700 (종합 분석), 라인 700-900 (문진 반영, 선택 항목 분석) |
| **현재 구조** | 1. 종합 분석: 배경색 있는 섹션<br>2. 문진 반영 내용: 아코디언 (배경 있음)<br>3. 선택하신 항목 분석: 아코디언 (배경 있음) |
| **문제 원인** | 1. 아코디언이 접혀있어도 배경색이 있어서 공간을 차지함<br>2. 간격이 `$spacing-lg`로 설정되어 있어서 너무 큼<br>3. 공통 상수를 사용하고 있어서 별도 선언 필요 |
| **해결 방안** | 1. 문진 반영, 선택 항목 분석 섹션의 배경 제거<br>2. 간격을 좁히는 별도 상수 선언 (`$spacing-sm` 또는 `$spacing-xs`)<br>3. 아코디언만 남기고 배경 제거 |

---

### 문제 3: "추천검진항목" → "추가로 검사 해보세요" 변경 및 뱃지 제거

| 항목 | 내용 |
|------|------|
| **현재 문제** | 1. "추천검진항목"이라는 제목을 "추가로 검사 해보세요"로 변경 필요<br>2. 하단 아코디언 펼치면 "병원에서 추천하는 특화 검진 (업셀링 위주)"가 나오는데 왜 나오는지 확인 필요<br>3. 뱃지들 제거 필요 |
| **프론트엔드 위치** | `CheckupRecommendationsPage.tsx` 라인 1460-1980 |
| **현재 구조** | 1. 섹션 헤더: "추천검진 항목" (라인 1466)<br>2. priority_2 우선순위 카드: "병원 추천 검진 항목" (라인 1489)<br>3. priority_3 섹션: "이 검사도 고민해보세요" (라인 1731)<br>4. 뱃지: `checkup-recommendations__card-badge`, `checkup-recommendations__category-priority-badge` 등 |
| **데이터 출처** | 1. "추천검진 항목": 프론트엔드 하드코딩 (라인 1466)<br>2. "병원에서 추천하는 특화 검진": `recommendationData.summary.priority_2.description` (GPT 응답)<br>3. "이 검사도 고민해보세요": 프론트엔드 하드코딩 (라인 1731) |
| **문제 원인** | 1. 섹션 제목이 하드코딩되어 있음<br>2. priority_2.description이 GPT에서 생성되는데, 프롬프트에서 "병원에서 추천하는 특화 검진 (업셀링 위주)"라는 표현을 사용하고 있음<br>3. 뱃지가 여러 곳에 하드코딩되어 있음 |
| **프롬프트 위치** | `checkup_design_prompt.py` 라인 727-730 (priority_2 description) |
| **해결 방안** | 1. 섹션 제목 "추천검진 항목" → "추가로 검사 해보세요"로 변경<br>2. 프롬프트에서 priority_2.description의 "병원에서 추천하는 특화 검진 (업셀링 위주)" 표현 제거 또는 수정<br>3. 뱃지 제거: `checkup-recommendations__card-badge`, `checkup-recommendations__category-priority-badge` 등 |

---

### 문제 4: DB 일반/종합/옵션 구분이 섞이는 문제

| 항목 | 내용 |
|------|------|
| **현재 문제** | DB에는 일반/종합/옵션으로 나눠져 있는데 섞이는 것 같음 |
| **DB 구조** | `wello_hospitals` 테이블:<br>- `national_checkup_items` (JSONB): 일반검진 항목<br>- `recommended_items` (JSONB): 병원 추천 항목<br>- `external_checkup_items` (매핑 테이블): 외부 검사 항목 |
| **API 위치** | `checkup_design.py` 라인 158-160 |
| **데이터 조회** | `wello_data_service.get_hospital_by_id()` → `hospital_national_checkup`, `hospital_recommended`, `hospital_external_checkup` |
| **프롬프트 전달** | `checkup_design_prompt.py` 라인 599-654 |
| **문제 원인** | 1. 프롬프트에서 일반/종합/옵션 구분을 명확히 하지 않음<br>2. GPT가 `hospital_national_checkup`의 구조(일반/종합/옵션)를 정확히 이해하지 못함<br>3. 프롬프트에 "일반검진 항목"이라고만 하고, DB의 카테고리 구분을 명시하지 않음 |
| **해결 방안** | 1. 프롬프트에 `hospital_national_checkup`의 구조를 명확히 제시 (일반/종합/옵션 구분)<br>2. priority_1에는 "일반" 카테고리만 포함하도록 명시<br>3. "종합", "옵션"은 다른 우선순위로 분류하도록 지시 |

---

## 데이터 흐름 분석

### 프롬프트 → 백엔드 → 프론트엔드 흐름

```
1. API 요청 (checkup_design.py)
   ↓
2. 병원 정보 조회 (wello_data_service.get_hospital_by_id)
   - hospital_national_checkup (일반/종합/옵션 구분)
   - hospital_recommended (병원 추천)
   - hospital_external_checkup (외부 검사)
   ↓
3. 프롬프트 생성 (checkup_design_prompt.py)
   - hospital_national_checkup를 프롬프트에 포함
   - 하지만 일반/종합/옵션 구분을 명확히 하지 않음
   ↓
4. GPT 응답
   - priority_1: 기본 검진 항목 (하지만 일반/종합/옵션이 섞일 수 있음)
   - priority_2: 병원 추천 항목
   - priority_3: 선택 검진 항목
   ↓
5. 프론트엔드 렌더링 (CheckupRecommendationsPage.tsx)
   - priority_1: "이번 검진시 유의 깊게 보실 항목이에요"
   - priority_2: "추천검진 항목" → "추가로 검사 해보세요"로 변경 필요
   - priority_3: "이 검사도 고민해보세요"
```

---

## 해결 방안 요약

### 1. priority_1 항목 범위 문제
- **프롬프트 수정**: `checkup_design_prompt.py`에서 `hospital_national_checkup`의 구조를 명확히 제시하고, "일반" 카테고리만 priority_1에 포함하도록 지시
- **검증 로직 추가**: 백엔드에서 priority_1.items가 실제로 `hospital_national_checkup`의 "일반" 카테고리에 포함되는지 검증

### 2. 배경 섹션 제거 및 간격 조정
- **프론트엔드 수정**: `CheckupRecommendationsPage.tsx`에서 문진 반영, 선택 항목 분석 섹션의 배경 제거
- **간격 상수 추가**: 별도 상수 선언 (`$spacing-sm` 또는 `$spacing-xs`)하여 간격 좁히기

### 3. 섹션 제목 변경 및 뱃지 제거
- **프론트엔드 수정**: "추천검진 항목" → "추가로 검사 해보세요"로 변경
- **프롬프트 수정**: priority_2.description에서 "병원에서 추천하는 특화 검진 (업셀링 위주)" 표현 제거
- **뱃지 제거**: `checkup-recommendations__card-badge`, `checkup-recommendations__category-priority-badge` 등 제거

### 4. DB 구분 명확화
- **프롬프트 수정**: `hospital_national_checkup`의 구조를 명확히 제시하고, 일반/종합/옵션 구분을 명시
- **검증 로직 추가**: 백엔드에서 priority_1.items가 "일반" 카테고리에만 포함되는지 검증

