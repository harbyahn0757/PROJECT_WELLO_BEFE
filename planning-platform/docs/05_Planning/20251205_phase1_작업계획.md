
# Phase 1: 백엔드 프롬프트 함수 분할 작업 계획

## 📝 작업 개요

기존 `create_checkup_design_prompt_step2` 함수 (21KB 프롬프트 생성)를  
2개로 분할하여 각각 짧은 프롬프트(8-10KB)를 생성합니다.

---

## 🔧 작업 내용

### 1. 새 함수 1: `create_checkup_design_prompt_step2_priority1`

**목적**: Priority 1 (일반검진 주의 항목) 전용 프롬프트 생성

**출력 JSON 구조**:
```json
{
  "summary": {
    "key_health_issues": ["..."],
    "family_history_concerns": ["..."],
    "lifestyle_factors": ["..."]
  },
  "priority_1": {
    "title": "이번 검진 시 유의 깊게 보실 항목이에요",
    "items": ["혈압측정", "혈당검사"],
    "focus_items": [...]
  }
}
```

**프롬프트 구성** (8-9KB):
- RAG 에비던스 (최상단)
- 환자 기본 정보
- 건강검진 데이터 (5년치)
- 처방 데이터
- 문진 데이터
- STEP 1 결과
- 일반검진 항목 (hospital_national_checkup)
- **Priority 1만 생성하라는 명확한 지시**
- 스타일 다양화 지침 (5가지)
- 패턴 반복 금지 지침

---

### 2. 새 함수 2: `create_checkup_design_prompt_step2_upselling`

**목적**: Priority 2, 3, Strategies, doctor_comment 생성

**출력 JSON 구조**:
```json
{
  "priority_2": {...},
  "priority_3": {...},
  "strategies": [...],
  "doctor_comment": {...}
}
```

**프롬프트 구성** (9-10KB):
- RAG 에비던스 (최상단)
- 환자 기본 정보
- 문진 데이터
- **STEP 2-1 결과 요약** (연결성!)
- 병원 추천 항목 (hospital_recommended)
- 선택 검진 항목 (hospital_external_checkup)
- STEP 1 결과
- **Priority 2, 3, Strategies만 생성하라는 명확한 지시**
- Bridge Strategy 변주 지침
- 강력한 업셀링 메시지 지침

---

## 📂 파일 위치

`/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/app/services/checkup_design_prompt.py`

**추가 위치**: 파일 끝 (기존 함수 아래)

---

## ✅ 체크리스트

- [ ] `create_checkup_design_prompt_step2_priority1` 함수 추가
  - [ ] 함수 시그니처 정의
  - [ ] RAG 에비던스 섹션
  - [ ] 환자/건강 데이터 섹션
  - [ ] STEP 1 결과 섹션
  - [ ] Priority 1 전용 시스템 메시지
  - [ ] Priority 1 전용 JSON 스키마
  - [ ] 반환값 (user_message, structured_evidences)

- [ ] `create_checkup_design_prompt_step2_upselling` 함수 추가
  - [ ] 함수 시그니처 정의 (step2_1_result 파라미터 포함)
  - [ ] RAG 에비던스 섹션
  - [ ] STEP 2-1 요약 섹션 (연결성)
  - [ ] 병원 항목 섹션
  - [ ] Upselling 전용 시스템 메시지
  - [ ] Upselling 전용 JSON 스키마
  - [ ] 반환값 (user_message, structured_evidences)

- [ ] 기존 `create_checkup_design_prompt_step2` 함수는 **유지** (호환성)

---

## 🚀 작업 시작

함수를 추가하겠습니다!

