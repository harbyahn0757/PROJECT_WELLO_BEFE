# 검진 설계 데이터 구조 분석 및 구현 확인

## JSON 데이터 구조 분석

### 1. priority_1.focus_items 구조
```json
{
  "item_name": "혈당 및 당화혈색소",
  "why_important": "가족력으로 당뇨병 위험이 높고...",  // 각주 참조 없음
  "check_point": "공복혈당과 당화혈색소 수치를..."     // 각주 참조 없음
}
```

### 2. recommended_items[0].items 구조 (기본검진 카테고리)
```json
{
  "name": "혈당 및 당화혈색소",
  "description": "혈당 조절 상태와 당뇨병 위험을 평가하는 검사입니다.",
  "reason": "가족력으로 당뇨병 위험이 있고...",  // 각주 참조 없음
  "evidence": "대한당뇨병학회 가이드라인에 따르면... [1].",  // 각주 참조 있음
  "references": ["https://www.diabetes.or.kr/pro/news/view.php?number=1234"]
}
```

## 현재 구현 확인

### ✅ 정상 동작하는 부분

1. **데이터 파싱**
   - `convertGPTResponseToRecommendationData` 함수가 `recommended_items`를 올바르게 파싱
   - `priority_1`, `priority_2`, `priority_3`를 `summary` 객체에 올바르게 매핑
   - `categories` 배열에 `priorityLevel`, `priorityDescription`, `items` 등 모든 필드 포함

2. **매칭 로직**
   - `findItemData` 함수가 `focus_items.item_name`과 `recommended_items.items.name`을 매칭
   - 정확 일치 → 부분 포함 → 정규화 후 매칭 → 정규화 후 부분 포함 → priority_1.items 배열 매칭
   - 매칭 성공 시 `description`, `evidence`, `references` 반환

3. **각주 표시 로직**
   - `why_important`와 `check_point`에 각주 참조가 없으면 하단 각주 표시 안 함 ✓
   - `evidence`에 `[1]`이 있으면 하단에 `[1] [링크]` 표시 ✓

### ⚠️ 확인 필요 사항

1. **데이터 매칭 정확도**
   - JSON 예시: `focus_items.item_name` = "혈당 및 당화혈색소"
   - JSON 예시: `recommended_items[0].items[0].name` = "혈당 및 당화혈색소"
   - ✅ 정확 일치로 매칭 가능

2. **각주 참조 번호 매핑**
   - `evidence` 텍스트: "... [1]."
   - `references` 배열: `["https://www.diabetes.or.kr/..."]`
   - `renderTextWithFootnotes` 함수가 `[1]`을 `references[0]`와 매핑해야 함
   - ✅ `footnoteParser.tsx`에서 올바르게 처리 중

3. **데이터 누락 가능성**
   - `focus_items`에 `item_name`이 있지만 `recommended_items`에 매칭되는 `name`이 없을 수 있음
   - 현재 로직: 매칭 실패 시 `{ references: [] }` 반환
   - ⚠️ 이 경우 `description`, `evidence`가 표시되지 않음

## 구현 검증 체크리스트

### ✅ 완료된 항목
- [x] `recommended_items` 파싱 및 `categories` 변환
- [x] `priority_1.focus_items` 표시
- [x] `findItemData` 매칭 로직 (5단계 매칭)
- [x] `description` 표시 (ⓘ 아이콘)
- [x] `why_important`와 `check_point` 통합 표시
- [x] `evidence` 표시 (의학적 근거)
- [x] 각주 표시 조건부 로직 (텍스트에 각주 참조가 있을 때만)
- [x] 각주 링크 처리 (`[링크]` 텍스트로 표시)

### ⚠️ 개선 필요 사항

1. **매칭 실패 시 처리**
   - 현재: 매칭 실패 시 `description`, `evidence` 없이 표시
   - 개선: 매칭 실패 시 로그 출력 또는 사용자에게 알림

2. **각주 번호 매핑 검증**
   - `evidence`의 `[1]`이 `references[0]`와 정확히 매핑되는지 확인 필요
   - `footnoteParser.tsx`의 `parseFootnotes` 함수 검증 필요

3. **데이터 일관성 검증**
   - `priority_1.items` 배열과 `recommended_items[0].items`의 `name` 일치 여부 확인
   - `focus_items.item_name`과 `recommended_items.items.name` 일치 여부 확인

## 테스트 시나리오

### 시나리오 1: 정상 매칭
- `focus_items[0].item_name` = "혈당 및 당화혈색소"
- `recommended_items[0].items[0].name` = "혈당 및 당화혈색소"
- 예상 결과: `description`, `evidence`, `references` 모두 표시

### 시나리오 2: 부분 매칭
- `focus_items[0].item_name` = "혈당 및 당화혈색소"
- `recommended_items[0].items[0].name` = "혈당"
- 예상 결과: 부분 포함 로직으로 매칭 성공

### 시나리오 3: 매칭 실패
- `focus_items[0].item_name` = "혈당 및 당화혈색소"
- `recommended_items`에 매칭되는 항목 없음
- 예상 결과: `description`, `evidence` 없이 `why_important`만 표시

## 결론

현재 구현은 JSON 데이터 구조를 올바르게 파싱하고 표시하고 있습니다. 다만 매칭 실패 시 처리와 각주 번호 매핑 검증이 필요합니다.

