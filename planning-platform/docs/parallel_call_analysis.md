# 병렬 호출 아이디어 검토

## 제안된 구조

### 현재 구조 (순차 호출)
```
STEP 1 (15초) → STEP 2 (64초) = 총 79초
```

### 제안된 구조 (병렬 호출)
```
STEP 1 (15초) ─┐
               ├─ 병합 → 총 64초
STEP 2 (64초) ─┘
```

## 상세 분석

### STEP 1 (현재 그대로 유지)
- **목적**: 빠른 분석 및 사용자 피드백
- **출력**: patient_summary, analysis, survey_reflection, selected_concerns_analysis, basic_checkup_guide
- **소요 시간**: 약 15초
- **모델**: sonar (빠른 모델)
- **변경 없음**

### STEP 2 (기존 방식으로 변경)
- **목적**: 검진 설계 및 근거 확보
- **입력**: 원본 데이터 (STEP 1 결과 없이)
- **출력**: strategies, recommended_items, summary, doctor_comment, total_count
- **소요 시간**: 약 64초
- **모델**: sonar-pro (강력한 모델)
- **프롬프트**: `create_checkup_design_prompt_legacy` 사용
- **시스템 메시지**: `CHECKUP_DESIGN_SYSTEM_MESSAGE_LEGACY` 사용

## 장점

### 1. 전체 시간 단축
- **현재**: 79초 (15초 + 64초)
- **병렬**: 64초 (max(15초, 64초))
- **단축률**: 약 19% (15초 단축)

### 2. 사용자 경험 개선
- STEP 1 완료 후 즉시 피드백 제공 (15초 후)
- STEP 2는 백그라운드에서 진행
- 사용자는 분석 결과를 읽는 동안 STEP 2가 완료됨

### 3. 구현 단순화
- STEP 2가 STEP 1 결과에 의존하지 않음
- 병합 로직 단순화 (두 결과를 그대로 합치기만 하면 됨)

## 단점 및 고려사항

### 1. 데이터 일관성 문제
- **문제**: STEP 1과 STEP 2가 서로 다른 분석을 할 수 있음
  - STEP 1: "흡연, 가족력 당뇨, 운동 부족" 분석
  - STEP 2: 다른 관점에서 분석할 수 있음
- **영향**: 최종 결과에서 분석 내용이 일관되지 않을 수 있음

### 2. 품질 저하 가능성
- **문제**: STEP 2가 STEP 1의 분석 결과를 활용하지 못함
  - STEP 1에서 "문진에서 확인된 흡연, 가족력 당뇨"를 분석했지만
  - STEP 2는 이를 모르고 다시 분석해야 함
- **영향**: 추천 항목이 STEP 1 분석과 완벽히 매칭되지 않을 수 있음

### 3. 중복 작업
- **문제**: STEP 1과 STEP 2가 같은 데이터를 각각 분석
  - 환자 정보, 건강 데이터, 처방전 데이터를 두 번 처리
- **영향**: API 호출 비용 증가 (하지만 시간은 단축)

### 4. 병합 로직 복잡도
- **현재**: STEP 1 결과를 STEP 2에 전달하여 일관성 보장
- **병렬**: 두 결과를 단순 병합하므로 일관성 보장 어려움

## 구현 방법

### 백엔드 수정
```python
# 병렬 호출
step1_task = create_checkup_design_step1(request)
step2_task = create_checkup_design_step2_legacy(request)  # 기존 방식

step1_result, step2_result = await asyncio.gather(step1_task, step2_task)

# 병합
ai_response = merge_checkup_design_responses(step1_result, step2_result)
```

### STEP 2 Legacy 함수 생성 필요
- `create_checkup_design_step2_legacy()` 함수 생성
- 기존 `create_checkup_design_prompt_legacy` 사용
- `CHECKUP_DESIGN_SYSTEM_MESSAGE_LEGACY` 사용

## 성능 비교

### 시나리오 1: 정상 케이스
- **현재**: 79초
- **병렬**: 64초
- **개선**: 15초 단축 (19%)

### 시나리오 2: STEP 1 실패
- **현재**: STEP 1 실패 시 전체 실패 또는 폴백
- **병렬**: STEP 2는 계속 진행 가능 (부분 성공)

### 시나리오 3: STEP 2 실패
- **현재**: STEP 1 결과만 반환
- **병렬**: STEP 1 결과만 반환 (동일)

## 권장 사항

### 옵션 1: 병렬 호출 구현 (추천)
**조건**: 데이터 일관성이 크게 중요하지 않은 경우
- 전체 시간 19% 단축
- 사용자 경험 개선
- 구현 난이도: 중간

### 옵션 2: 하이브리드 접근
**조건**: 데이터 일관성이 중요한 경우
- STEP 1 완료 후 즉시 사용자에게 표시
- STEP 2는 STEP 1 결과를 받아서 진행 (현재 방식)
- 사용자는 STEP 1 결과를 읽는 동안 STEP 2 진행
- 전체 시간: 여전히 79초이지만, 사용자 체감 시간은 15초

### 옵션 3: 현재 방식 유지
**조건**: 데이터 일관성이 매우 중요한 경우
- STEP 1 → STEP 2 순차 호출
- STEP 2가 STEP 1 결과를 활용하여 일관성 보장
- 전체 시간: 79초

## 결론

**병렬 호출은 시간 단축 측면에서 유리하지만, 데이터 일관성과 품질 측면에서 트레이드오프가 있습니다.**

**추천**: 
1. 먼저 하이브리드 접근(옵션 2)을 시도하여 사용자 경험 개선
2. 데이터 일관성이 문제가 되지 않는다면 병렬 호출(옵션 1)로 전환
3. 품질이 최우선이라면 현재 방식(옵션 3) 유지

