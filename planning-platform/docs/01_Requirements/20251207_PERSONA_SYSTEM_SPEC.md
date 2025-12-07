# 🧠 WELLO Hybrid Persona System Specification
**작성일**: 2025-12-07 (Updated)  
**작성자**: Bro.Welno & Backend Team  
**대상**: Frontend Developer, Data Engineer, PM

---

## 1. Overview (개요)

WELLO Hybrid Persona System은 단순한 "설문-결과 매칭"을 넘어, **사용자의 숨겨진 의도(Intent)**와 **실제 건강 상태(Body Reality)**, 그리고 **행동 패턴(Behavior)**을 입체적으로 분석하여 "설득력 있는 검진 설계"를 제공하는 지능형 엔진입니다.

### 1.1 Core Philosophy: Action-First & Hybrid
- **Hybrid Persona**: 단일 성향이 아닌 **Primary(본심/감정)** + **Secondary(행동/습관)**의 복합 성향을 도출합니다. (예: "가족력으로 불안해하면서도(Worrier), 술/담배를 끊지 못하는(Manager) 모순적 상태")
- **3-Layer Scoring**: 설문(Lifestyle), 검진기록(Body), 클릭/의도(Intent) 3가지 차원에서 점수를 합산합니다.
- **Clinical Priority**: "체중 감소" 같은 **Red Flag**는 AI의 판단 이전에 **Rule**로 강제하여 의학적 안전성을 보장합니다.

### 1.2 System Pipeline (Mermaid)

```mermaid
flowchart TD
    %% 입력 레이어
    subgraph Input Layer
        A1[건강검진 데이터\n(Body Reality)] 
        A2[문진 응답\n(Lifestyle Survey)] 
        A3[이벤트 로그\n(User Behavior)] 
        A4[채팅 선택\n(User Intent)]
    end

    %% 로직 레이어
    subgraph Logic Core
        B[persona.py\n3-Layer Scoring Model]
        C[clinical_rules\nRed Flag Detection]
        D[RAG Engine\nMedical Guideline Retrieval]
    end

    %% 처리 흐름
    A1 & A2 & A4 --> B
    A2 --> C
    A3 --> B

    B --> E[Persona Result\n(Primary, Secondary, Combined)]
    C --> F[Priority Rules]
    
    %% Step 1 (분석)
    E --> G[Step 1 Prompt Gen]
    A1 & A2 & A3 & A4 --> G
    G --> H[LLM (Gemini-Flash)\nFast Analysis]
    H --> I[STEP 1 Output\n(Analysis, Risk Profile)]

    %% Step 2 (설계 & 설득)
    I --> J[Step 2 Prompt Gen]
    F --> J
    D --> J
    J --> K[LLM (GPT-4o)\nDeep Reasoning]
    K --> L[STEP 2 Output\n(Recommendations, Bridge Strategy)]
```

---

## 2. Input Data Specifications (입력 규격)

### 2.1 Chat & Survey Flow (전체 흐름)
사용자는 채팅 인터페이스를 통해 다음 순서로 데이터를 입력합니다.

1.  **초기 관심사 선택 (Intent)**: "암 걱정", "만성 피로", "정밀 검진" 등 키워드 선택.
2.  **건강 데이터 연동 (Body)**: 카카오/Tilko를 통해 과거 3년치 검진 데이터 및 투약 이력 확보.
3.  **생활습관 문진 (Lifestyle)**: 10~12개 문항 (음주, 흡연, 운동, 체중변화, 가족력 등).
4.  **행동 데이터 (Behavior)**: 문진 응답 중 망설임(체류시간), 수정(Change Count) 등 비언어적 신호 수집.

### 2.2 Data Structures

#### A. `health_data` (검진 기록)
- **Time Decay**: 최근 1년(1.0), 3년(0.5), 그 이상(0.1) 가중치 적용.
- **Parsing**: `raw_data` 내의 구조화된 데이터(ItemReferences)를 파싱하여 "질환의심", "유질환", "정상(A)" 등을 식별.

#### B. `survey_responses` (문진)
```json
{
  "weight_change": "decrease_bad",  // 의도치 않은 체중 감소 (Red Flag)
  "drinking": "weekly_3plus",       // 잦은 음주 (Manager +50)
  "smoking": "current_smoker",      // 흡연 (Manager +60)
  "family_history": ["stomach_cancer"], // 가족력 (Worrier +30)
  "symptoms": ["fatigue", "indigestion"], // 증상 (Symptom Solver)
  "daily_routine": ["desk_job", "irregular"] // 직업/생활패턴
}
```

#### C. `selected_concerns` (의도)
```json
[
  { "type": "keyword", "name": "암 가족력" }, // Worrier +15
  { "type": "symptom", "name": "소화 불량" }  // Symptom Solver +15
]
```

#### D. `user_attributes` (행동 - InteractionEvent)
**Critical**: 백엔드 검증을 위해 반드시 아래 포맷을 준수해야 합니다.
```json
[
  {
    "type": "dwell_time",
    "questionKey": "family_history",
    "value": "25000",  // 25초 (문자열로 전송)
    "timestamp": 1701923456789
  },
  {
    "type": "change_count",
    "questionKey": "drinking",
    "value": "3",
    "timestamp": 1701923459999
  }
]
```

---

## 3. Logic Layer: 3-Layer Scoring & Rules

### 3.1 3-Layer Scoring Model (`persona.py`)
세 가지 층위의 데이터를 합산하여 가장 강력한 페르소나를 도출합니다.

1.  **Layer 1: Lifestyle (문진)** - **"Action First"**
    - 현재의 **행동(흡연, 음주, 비만)**에 가장 높은 가중치를 둡니다. (Manager 점수↑)
    - 고통(통증, 수면부족)은 즉시 해결 욕구로 연결됩니다. (Symptom Solver 점수↑)
2.  **Layer 2: Body Reality (검진/투약)** - **"Fact Check"**
    - 과거에 고혈압/당뇨 소견이 있었으나 약을 안 먹는다? -> **Untreated Risk** (Manager 가산점 폭발)
    - 정상 소견 유지 중? -> Optimizer 가산점.
3.  **Layer 3: User Intent (클릭)** - **"Hidden Desire"**
    - "암" 키워드 선택 -> Worrier 가산.
    - "초음파/내시경" 선택 -> Symptom Solver 가산.

### 3.2 Persona Types
| Type | 핵심 동인 | 주요 특징 | Scoring Key Factors |
| :--- | :--- | :--- | :--- |
| **Manager** | **위급/관리** | 나쁜 생활습관, 만성질환 위험 | 흡연, 과음, 비만, 이상소견 방치 |
| **Symptom Solver** | **고통/해결** | 현재 아픔, 기능적 불편 | 통증 호소, 수면 부족, 체중 급감 |
| **Worrier** | **불안/안심** | 가족력, 막연한 공포 | 암 가족력, 건강염려 키워드 선택 |
| **Optimizer** | **최적화/활력** | 건강하지만 더 나은 상태 추구 | 운동, 금연 성공, 영양제 관심 |
| **Minimalist** | **효율/가성비** | 특별한 이슈 없음 | (기본값) 다른 점수가 없을 때 |

### 3.3 Clinical Priority Rules (Red Flags)
AI가 확률적으로 실수하지 않도록, 특정 조건에서는 **강제 규칙**이 발동합니다.

- **Rule A: Unintended Weight Loss** (`weight_change == "decrease_bad"`)
  - **Action**: 위/대장 내시경, 복부 초음파, 췌장/갑상선 검사를 **Priority 2 최상단**에 배치.
  - **Logic**: 암/당뇨/갑상선 등 소모성 질환 감별이 최우선. 유전자 검사 등은 후순위.
- **Rule B: Untreated History** (과거 이상소견 + 투약 없음)
  - **Action**: 해당 질환 추적 검사(예: 혈압 높음 -> 심장/경동맥 초음파) 강제 추천.

---

## 4. Output Specifications (출력 규격)

### 4.1 Step 1 Output (Analysis)
빠른 분석 결과와 페르소나 정보를 반환합니다.

```json
{
  "persona": {
    "type": "Worrier",                // [UI용] 뱃지 표시용 (Primary)
    "primary_persona": "Worrier",
    "secondary_persona": "Manager",   // [Logic용] 행동 교정 타겟
    "combined_type": "Worrier_Manager",
    "risk_flags": ["unintended_weight_loss"] // [Critical] 발견된 위험 신호
  },
  "patient_summary": "3줄 요약...",
  "analysis": "종합 분석 텍스트 (공감 + 팩트 + 행동 지적)",
  "risk_profile": [ ... ],
  "basic_checkup_guide": { ... }
}
```

### 4.2 Step 2 Output (Design & Upselling)
RAG(LlamaCloud)를 통해 검색된 의학적 근거를 바탕으로 최종 설계를 제안합니다.

```json
{
  "summary": { ... },
  "priority_1": { // 기본 검진 내 주의 항목
    "title": "이번 검진 시 유의 깊게 보실 항목이에요",
    "items": ["혈압측정", "간기능검사"],
    "focus_items": [ { "name": "혈압", "why_important": "..." } ]
  },
  "priority_2": { // 병원 추천 정밀 검진 (Upselling Core)
    "title": "필수로 확인하셔야 할 정밀 검진",
    "items": ["위 내시경", "복부 초음파"],
    "health_context": "체중 감소 원인 파악 및 간 상태 확인"
  },
  "priority_3": { // 선택 검진
    "title": "선택해서 받아보실 수 있는 추가 검진",
    "items": ["저선량 폐 CT"]
  },
  "strategies": [ // 설득 논리 (Bridge Strategy)
    {
      "target": "복부 초음파",
      "step1_anchor": "음주가 잦으셔서 걱정되시죠? (Worrier 공감)",
      "step2_gap": "혈액검사만으로는 간의 실제 모양을 알 수 없습니다.",
      "step3_offer": "초음파로 직접 보고 안심하세요.",
      "doctor_recommendation": {
        "reason": "체중 감소와 음주력이 동반되어...",
        "evidence": "관련 의학 가이드라인 [1]"
      }
    }
  ],
  "rag_evidences": [ ... ] // 사용된 의학 근거 원문
}
```

---

## 5. RAG Integration (검색 증강 생성)

Step 2에서는 **LlamaCloud** 기반의 RAG 엔진이 작동합니다.
1.  **Retrieve**: 환자의 증상, 문진 키워드, Red Flag를 Query로 변환하여 Vector DB 검색.
2.  **Context**: 검색된 "임상 가이드라인", "검사 설명", "질환 정보"를 프롬프트에 주입.
3.  **Generation**: LLM은 내장된 지식이 아니라 **주입된 Context를 근거로** 추천 이유를 작성합니다. (Hallucination 방지)

---

**담당자**: Backend Team (Bro.Welno)
