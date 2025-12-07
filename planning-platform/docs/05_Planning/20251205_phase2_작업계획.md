
# Phase 2: API 엔드포인트 수정 작업 계획

## 🎯 핵심 전략: 기존 코드 절대 건드리지 않기!

**안전성 최우선:**
- ✅ 기존 API 엔드포인트 그대로 유지
- ✅ 프론트엔드 수정 불필요
- ✅ 롤백 쉬움
- ✅ 점진적 테스트 가능

---

## 📂 작업 대상 파일

`/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/app/api/v1/endpoints/checkup_design.py`

---

## 🔧 작업 내용

### 1. 기존 create_checkup_design_step2 엔드포인트 내부 로직만 수정

**현재 로직:**
```python
@router.post("/create-step2")
async def create_checkup_design_step2(...):
    # 1. 프롬프트 생성 (1회)
    user_message, structured_evidences = await create_checkup_design_prompt_step2(...)
    
    # 2. GPT 호출 (1회)
    gpt_response = await gpt_service.call_api(...)
    
    # 3. 결과 반환
    return result
```

**개선 로직:**
```python
@router.post("/create-step2")
async def create_checkup_design_step2(...):
    # 1. Priority 1 프롬프트 생성
    user_message_p1, evidences_p1 = await create_checkup_design_prompt_step2_priority1(...)
    
    # 2. GPT 호출 (Priority 1)
    gpt_response_p1 = await gpt_service.call_api(user_message_p1, ...)
    step2_1_result = json.loads(gpt_response_p1.response)
    
    # 3. Upselling 프롬프트 생성 (step2_1_result 포함)
    user_message_p2, evidences_p2 = await create_checkup_design_prompt_step2_upselling(
        ...,
        step2_1_result=step2_1_result,  # ← 연결성!
        ...
    )
    
    # 4. GPT 호출 (Upselling)
    gpt_response_p2 = await gpt_service.call_api(user_message_p2, ...)
    step2_2_result = json.loads(gpt_response_p2.response)
    
    # 5. 결과 병합
    merged_result = {
        **step2_1_result,  # summary, priority_1
        **step2_2_result,  # priority_2, priority_3, strategies, doctor_comment
        "_structured_evidences": evidences_p1 + evidences_p2
    }
    
    # 6. 기존과 동일하게 반환
    return result
```

---

## ⚠️ 주의사항

1. **API 응답 형식 절대 변경 금지**
   - 기존과 동일한 JSON 구조 반환
   - 프론트엔드는 변화를 인지하지 못함

2. **에러 처리 강화**
   - STEP 2-1 실패 시 롤백
   - STEP 2-2 실패 시 STEP 2-1 결과라도 반환 (부분 성공)

3. **로깅 강화**
   - 각 단계별 실행 시간 기록
   - 프롬프트 길이 기록
   - 토큰 사용량 기록

---

## 📋 작업 단계

### Step 1: 기존 코드 백업
- checkup_design.py 백업 (주석으로)

### Step 2: import 추가
```python
from app.services.checkup_design_prompt import (
    create_checkup_design_prompt_step2,  # 기존
    create_checkup_design_prompt_step2_priority1,  # 새로 추가
    create_checkup_design_prompt_step2_upselling  # 새로 추가
)
```

### Step 3: create_checkup_design_step2 엔드포인트 수정
- 내부 로직만 2개 함수 순차 호출로 변경
- 외부 인터페이스 동일 유지

### Step 4: 로깅 추가
- 각 단계별 시간, 길이, 토큰 로그

### Step 5: 에러 처리
- try-except로 각 단계 감싸기
- 부분 성공 시나리오 처리

---

## ✅ 완료 조건

- [ ] 기존 API 응답 형식 유지
- [ ] 프론트엔드 수정 불필요 확인
- [ ] 로그에 2단계 실행 기록
- [ ] 테스트 통과 (기존 데이터로)

---

## 🚀 다음 단계

Phase 2 완료 후 → Phase 3 (통합 로그 시스템) 또는 실전 테스트

