# 🚀 Deployment Report: Hybrid Persona & Upselling Engine v2.0
**Date:** 2025-12-07
**Author:** Bro.Welno & User

---

## 📋 Summary
이번 업데이트는 기존의 단순 "문진-검사" 매핑 시스템을 **"3-Layer 하이브리드 페르소나"** 기반의 지능형 설계 엔진으로 고도화하는 작업입니다.
환자의 **심리(Primary)**와 **행동(Secondary)**의 충돌을 분석하고, **임상적 위험(Red Flag)**을 감지하여 우선순위를 강제 조정하며, **RAG 기반의 의학적 근거**를 제공합니다.

---

## 🛠️ Key Features & Changes

### 1. 🧠 Core Logic Upgrade (Persona Engine)
*   **3-Layer Scoring System 도입**:
    *   **Layer 1 (Body Reality)**: 건강검진/처방 데이터 기반의 신체적 팩트 (가중치: 시간 경과에 따른 Time Decay 적용).
    *   **Layer 2 (User Intent)**: 클릭/선택한 관심사 기반의 의도 파악.
    *   **Layer 3 (Lifestyle Survey)**: 문진 응답 기반의 생활 습관 분석.
*   **Action-First Philosophy**:
    *   과거력(Worrier)보다 **현재의 위험 행동(Manager, Symptom Solver)**에 더 높은 가중치를 부여.
    *   "단순 걱정"과 "실제 위험"을 구분하여 페르소나 할당.
*   **Hybrid Persona**:
    *   단일 유형이 아닌 `Primary`(본심) + `Secondary`(행동) 구조로 분석하여 "모순된 심리" 포착.

### 2. 🛡️ Stability & Safety (Robustness)
*   **Critical Error Fix (`persona.py`)**:
    *   `selected_concerns`의 `name` 필드가 `None`일 때 발생하는 `TypeError` (500 Error) 수정.
*   **Empty Description Defense (`step2_upselling.py` & `checkup_design.py`)**:
    *   **Step 1 (Prompt)**: LLM에게 Priority 2, 3의 모든 항목에 대해 설명을 작성하도록 강제.
    *   **Step 2 (Fallback)**: LLM이 설명을 누락할 경우, 백엔드에서 **DB의 공식 설명(Hospital Recommendation)**을 자동으로 매핑하여 보완.
*   **RAG Evidence Cleaning (`rag_service.py`)**:
    *   PDF 파서가 반환하는 Raw HTML Table 태그를 제거하고, 가독성 있는 **Text Table (Markdown Style)**로 정제하여 프론트엔드 깨짐 현상 해결.

### 3. 🚦 Clinical Rules & Logic
*   **Red Flag System**:
    *   `체중 감소`, `심장 질환 가족력` 등 치명적 위험 신호 감지 시, AI 판단보다 우선하는 **Hard Rule** 적용.
    *   예: 체중 감소 시 유전자 검사보다 **내시경/CT/초음파**를 최우선(Priority 1, 2)으로 강제 배정.
*   **Medical Reframing**:
    *   암 검진을 **"만성질환 관리"** 관점으로 재해석 (예: 폐 CT -> "폐 염증 확인").
    *   "안 하면 죽습니다" 대신 **"이거 하나로 1년이 편해집니다"**라는 가성비/효율 소구 톤 적용.

---

## 📂 Modified Files
*   `backend/app/services/checkup_design/persona.py`: 3-Layer Scoring, Time Decay, Error Fix.
*   `backend/app/services/checkup_design/step1_prompt.py`: 페르소나 분석 프롬프트, 갈등(Conflict) 분석.
*   `backend/app/services/checkup_design/step2_upselling.py`: 4-Step Bridge Strategy, Empty Description Rule.
*   `backend/app/api/v1/endpoints/checkup_design.py`: Fallback Logic, Data Flow.
*   `backend/app/services/checkup_design/rag_service.py`: HTML Table Cleaning.
*   `backend/app/services/checkup_design/prompt_utils.py`: Clinical Rule Injection.
*   `backend/app/services/checkup_design/constants.py`: Hybrid Persona Aliases.

---

## ✅ QA & Verification
*   **Integration Test**: 실제 DB 및 API 호출 테스트 완료 (`tests/run_real_http_test_with_db.py`).
*   **Edge Case**: `Anxious Manager`, `Symptom Solver` 등 5가지 엣지 케이스 검증 완료.
*   **Error Handling**: 실제 서비스 로그 기반 에러 수정 완료.

---

**Ready for Deployment.**

