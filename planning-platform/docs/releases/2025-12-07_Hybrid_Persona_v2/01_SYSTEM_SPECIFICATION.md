# 🧠 WELLO Hybrid Persona System Specification: The Master Bible
**작성일**: 2025-12-07 (Finalized)  
**작성자**: Bro.Welno & Backend Team  
**버전**: v2.5 (Fully Detailed Spec)  
**문서 분류**: 1급 기술 명세 (Technical & Sales Bible)

---

## 📋 Table of Contents
1.  **System Architecture (시스템 아키텍처)**
    *   Philosophy & Goal
    *   End-to-End Data Pipeline (Input -> Logic -> Output)
2.  **Input & Survey Detail (문진 로직 전수 매핑)**
    *   Q1 ~ Q10: UI Text, Internal Key, Scoring Logic
3.  **Persona Algorithm (3-Layer Scoring Model)**
    *   Layer 1: Lifestyle Survey (행동)
    *   Layer 2: Body Reality (검진 기록 & Time Decay)
    *   Layer 3: User Intent (클릭 로그)
    *   Final Decision Logic (Primary/Secondary)
4.  **Clinical Safety Rules (Red Flags)**
    *   Rule A: Unintended Weight Loss
    *   Rule B: Heart Disease Family History
    *   Rule C: Untreated Risk
5.  **RAG & LLM Prompting (생성 로직)**
    *   RAG Query Construction
    *   Step 1 Prompt Structure (Analysis)
    *   Step 2 Prompt Structure (Bridge Strategy)
6.  **External Communication Guide (세일즈 가이드)**
    *   To Users: Value Proposition & Script
    *   To Doctors: Pitching Logic & Objection Handling

---

## 1. System Architecture (시스템 아키텍처)

WELLO Hybrid Persona System은 환자의 **주관적 응답(Survey)**, **객관적 데이터(Checkup Data)**, **무의식적 행동(Log)**을 통합 분석하여 **"가장 설득력 있는 건강검진"**을 설계하는 AI 엔진입니다.

### 1.1 Core Philosophy
*   **Action-First**: 과거 병력(Worrier)보다 **"현재의 위험 행동(Manager/Symptom)"**에 가중치를 두어 행동 교정을 유도합니다.
*   **Hybrid Persona**: 단일 성향이 아닌 **Primary(본심) + Secondary(행동)** 구조로 분석하여, "불안해하면서도(Worrier) 술은 못 끊는(Manager)" 모순을 포착합니다.
*   **Safety-First**: AI의 확률적 판단 이전에 **Rule-Based Red Flag** 시스템이 작동하여 의학적 위험을 놓치지 않습니다.

### 1.2 End-to-End Data Pipeline
```mermaid
flowchart TD
    subgraph INPUT ["1. Data Ingestion"]
        A1[건강검진 기록 (NHIS)] --> |Time Decay| B1(Layer 2 Score)
        A2[생활습관 문진 (Survey)] --> |Action Weight| B2(Layer 1 Score)
        A3[클릭/이벤트 (Event Log)] --> |Intent Weight| B3(Layer 3 Score)
    end

    subgraph CORE ["2. Logic Engine (Python)"]
        B1 & B2 & B3 --> C{3-Layer Scoring}
        C --> D[Persona Determination]
        D --> |Primary/Secondary| E[Persona Result]
        
        A2 --> F{Red Flag Detector}
        F --> |Rules| G[Priority Rules]
    end

    subgraph GEN ["3. AI Generation (LLM)"]
        E & G --> H[Step 1 Prompt]
        H --> I[LLM: Analysis]
        
        G --> J{RAG Engine}
        J --> |Evidence| K[Step 2 Prompt]
        I & K --> L[LLM: Design & Strategy]
    end
    
    L --> OUTPUT[Final Report]
```

---

## 2. Input & Survey Detail (문진 로직 전수 매핑)

사용자가 응답하는 모든 문항의 **Internal Key**와 해당 답변이 **어떤 페르소나 점수**로 연결되는지 명세합니다.

### **Q1. 체중 변화 (Weight Change)**
*의도: 급격한 체중 감소(Red Flag) 및 자기관리 여부(Optimizer/Manager) 파악*

| 선택지 (UI Text) | Key (`weight_change`) | Score Logic | 비고 |
| :--- | :--- | :--- | :--- |
| 변화 없음 | `maintain` | - | |
| **의도치 않게 빠짐 (3kg 이상)** | `decrease_bad` | **🚩 Red Flag** | `unintended_weight_loss` 트리거 (내시경/CT 강제) |
| 다이어트로 뺌 | `decrease_good` | **🟢 Optimizer +40** | 건강 관리 의지 높음 |
| 조금 쪘음 (1~3kg) | `increase_some` | - | 주의 단계 |
| **많이 쪘음 (3kg 이상)** | `increase_more` | **🔴 Manager +40** | 대사증후군 위험군 |

### **Q2. 일과 패턴 (Daily Routine)** *복수 선택 가능*
*의도: 직업 환경에 따른 만성질환/스트레스/근골격계 위험 파악*

| 선택지 (UI Text) | Key (`daily_routine`) | Score Logic | 비고 |
| :--- | :--- | :--- | :--- |
| 주로 앉아서 모니터 집중 | `desk_job` | **🔴 Manager +20** | 운동 부족 |
| 중요한 결정/정신적 압박 | `mental_stress` | **🟡 Symptom Solver +30** | 스트레스성 질환 |
| 사람 상대/감정 소모 | `service_job` | **🟡 Symptom Solver +30** | 감정 노동 |
| 몸을 쓰거나 서 있는 일 | `physical_job` | **🟡 Symptom Solver +30** | 육체 피로/통증 |
| 밤낮 불규칙/식사 불규칙 | `irregular` | **🔴 Manager +40** | 대사 위험 매우 높음 |

### **Q3. 운동 (Exercise)**
*의도: 자기관리 수준(Optimizer) 파악*

| 선택지 (UI Text) | Key | Score Logic |
| :--- | :--- | :--- |
| 규칙적으로 운동함 (주 3회↑) | `regular` | **🟢 Optimizer +60** |
| 가끔 운동함 | `sometimes` | - |
| 거의 안 함 | `rarely` | - |
| 전혀 안 함 | `never` | - |

### **Q4. 흡연 (Smoking)**
*의도: 최상위 위험 인자(Manager) 파악*

| 선택지 (UI Text) | Key | Score Logic |
| :--- | :--- | :--- |
| 비흡연 | `non_smoker` | - |
| 과거 흡연 (금연) | `ex_smoker` | **🟢 Optimizer +20** |
| **현재 흡연** | `current_smoker` | **🔴 Manager +60** |

### **Q5. 음주 (Drinking)**
*의도: 간 질환 및 대사 위험 인자 파악*

| 선택지 (UI Text) | Key | Score Logic |
| :--- | :--- | :--- |
| 주 3회 이상 | `weekly_3plus` | **🔴 Manager +50** |
| 주 1-2회 | `weekly_1_2` | **🔴 Manager +20** |
| 월 1-2회 | `monthly_1_2` | - |
| 월 1회 미만/안 함 | `monthly_less`/`never` | - |

### **Q6. 수면 (Sleep)**
*의도: 즉각적인 해결이 필요한 고통(Symptom) 파악*

| 선택지 (UI Text) | Key | Score Logic |
| :--- | :--- | :--- |
| **5시간 미만** | `less_5` | **🟡 Symptom Solver +40** |
| 5-6시간 | `5_6` | - |
| 7시간 이상 | `more_7` | - |

### **Q7. 가족력 (Family History)** *복수 선택 가능*
*의도: 유전적 위험 및 불안 심리(Worrier) 파악*

| 선택지 (UI Text) | Key | Score Logic |
| :--- | :--- | :--- |
| **암** | `cancer` | **🔵 Worrier +30** |
| **뇌졸중** | `stroke` | **🔵 Worrier +20** |
| **심장질환** | `heart_disease` | **🔵 Worrier +20** |
| 당뇨병 | `diabetes` | **🔵 Worrier +10** |
| 고혈압 | `hypertension` | **🔵 Worrier +10** |
| 없음 | `none` | - |

### **Q8. 대장내시경 경험 (Colonoscopy)**
*의도: 검진에 대한 태도(회피 vs 관리) 파악*

| 선택지 (UI Text) | Key | Score Logic |
| :--- | :--- | :--- |
| 예, 편안했습니다 | `yes_comfortable` | **🟢 Optimizer +30** |
| 예, 불편했습니다 | `yes_uncomfortable` | - |
| **아니오, 두려워서** | `no_afraid` | **🔵 Worrier +40** (회피) |
| 아니오, 경험 없음 | `no_never` | - |

### **Q9. 추가 고민사항 (Additional Concerns)**
*   **Logic**: 텍스트 분석
*   "통증", "아픔", "불편", "소화" 등 포함 시 -> **🟡 Symptom Solver +50**

---

## 3. Persona Algorithm (3-Layer Scoring Model)

WELLO는 문진뿐만 아니라 외부 데이터까지 통합하여 점수를 계산합니다.

### Layer 1: Lifestyle Survey (문진)
*   위 **Section 2**의 문진 점수 합계.
*   *특징: 현재 행동(흡연, 음주)에 높은 가중치.*

### Layer 2: Body Reality (검진 기록)
*   **Data Source**: 건강검진 기록 (NHIS/Hospital Data)
*   **Time Decay (시간 감쇠)**:
    *   최근 1년 이내 데이터: 점수 반영률 **100% (x1.0)**
    *   1년 ~ 3년 데이터: 점수 반영률 **50% (x0.5)**
    *   3년 초과 데이터: 점수 반영률 **10% (x0.1)**
*   **Scoring**:
    *   질환 의심/유질환 소견 (고혈압, 당뇨, 비만, 간질환 등): **Manager +50**
    *   정상(A) 판정: **Optimizer +40**
*   **Untreated Risk Logic (방치된 위험)**:
    *   조건: (과거 질환 소견 있음) AND (최근 1년 내 처방 이력 없음)
    *   결과: **Manager 점수 1.5배 가중** (관리 시급성 강조)

### Layer 3: User Intent (사용자 의도)
*   **Data Source**: 채팅창 내 선택/클릭 로그 (`selected_concerns`)
*   **Scoring**:
    *   "암", "종양", "가족력" 관련 키워드: **Worrier +15**
    *   "초음파", "CT", "내시경", "통증" 관련 키워드: **Symptom Solver +15**
    *   "지방간", "혈압", "당뇨" 관련 키워드: **Manager +10**
    *   "활력", "기능", "영양" 관련 키워드: **Optimizer +15**

### Final Decision Logic (최종 결정)
1.  **Total Score Calculation**: Layer 1 + 2 + 3 합산.
2.  **Primary Persona 선정**:
    *   최고 점수 유형 선택.
    *   **Tie-breaking (동점 우선순위)**:
        1.  **Manager** (생명 직결 위급성)
        2.  **Symptom Solver** (즉시 해결 니즈)
        3.  **Worrier** (심리적 불안)
        4.  **Optimizer** (상위 욕구)
        5.  **Minimalist** (기본값)
3.  **Secondary Persona 선정**:
    *   2위 유형의 점수가 **1위 점수의 70% 이상**이거나 **절대 점수 50점 이상**일 때 선정.
    *   *목적: 복합적인 심리 상태(갈등) 분석용.*

---

## 4. Clinical Safety Rules (Red Flags)

AI의 판단보다 우선하는 **Hard-coded Safety Logic**입니다.

### 🚩 Rule A: Unintended Weight Loss (의도치 않은 체중 감소)
*   **Condition**: `weight_change == "decrease_bad"`
*   **Clinical Reasoning**: 설명되지 않는 체중 감소는 암(위/대장/췌장) 또는 당뇨, 갑상선 항진증의 강력한 신호입니다.
*   **System Action**:
    *   `Risk Flag: unintended_weight_loss` 생성.
    *   **Priority 2 최상단**에 다음 항목 강제 배치:
        *   위 내시경, 대장 내시경, 복부 초음파, 복부 CT, 췌장 검사, 갑상선 기능 검사.

### 🚩 Rule B: Heart Disease Family History (심장 질환 가족력)
*   **Condition**: `family_history` contains `"heart_disease"`
*   **Clinical Reasoning**: 심장 질환은 가족력 영향이 크며, 돌연사 위험이 있습니다.
*   **System Action**:
    *   단순 유전자 검사보다 **구조적 확인 검사(Structural Check)** 우선.
    *   **관상동맥 석회화 CT** 또는 **심장 초음파**를 필수 항목(Priority 2)으로 격상.

### 🚩 Rule C: Untreated History (치료 방치)
*   **Condition**: (과거 검진 '고혈압/당뇨' 소견) AND (처방 이력 없음)
*   **System Action**:
    *   기본 혈액검사 외에 **합병증 정밀 검사** 강제 추천.
    *   예: 고혈압 방치 -> **경동맥 초음파, 안저 검사, 신장 기능 검사** 추천.

---

## 5. RAG & LLM Prompting (생성 로직)

### RAG Query Construction
환자 데이터를 바탕으로 Vector DB(LlamaCloud)를 검색할 쿼리를 생성합니다.
*   **Template**: `"{Age}세 {Gender} {RiskFactors} 환자에게 권장되는 {Symptom} 관련 정밀 검사와 의학적 가이드라인"`
*   **Example**: *"45세 남성 흡연자(Current Smoker), 체중 감소(Weight Loss) 환자에게 권장되는 소화기/폐 관련 정밀 검사와 의학적 가이드라인"*

### Step 1 Prompt: Analysis (분석)
*   **Role**: "당신은 30년 경력의 예방의학 전문의이자, 환자의 마음을 읽는 상담가입니다."
*   **Instruction**: "Primary Persona(본심)와 Secondary Persona(행동) 사이의 **'심리적 갈등(Conflict)'**을 분석하십시오. 의학 용어 대신 쉬운 비유(Layman's Terms)를 사용하십시오."

### Step 2 Prompt: Bridge Strategy (설계 및 설득)
*   **Role**: "당신은 환자의 불안을 해소하고 행동 변화를 이끌어내는 건강 설계사입니다."
*   **Bridge Strategy Template**:
    1.  **Anchor (공감)**: "술자리 때문에 걱정 많으시죠?" (Worrier 공감)
    2.  **Gap (지적)**: "하지만 피검사만으로는 간이 얼마나 굳었는지 알 수 없습니다." (한계 지적)
    3.  **Offer (제안)**: "초음파로 직접 눈으로 확인하고, 마음 편하게 지내시죠." (해결책)

---

## 6. External Communication Guide (세일즈 가이드)

### 🗣️ To Users (수검자용)
*"이거 왜 해야 하나요?"*

#### Value Proposition
> "건강검진, 매번 똑같은 거 받으셨죠? WELLO는 당신의 **생활 습관**과 **가족력**, **과거 데이터**까지 분석해서, **'지금 내 몸이 가장 필요로 하는 검사'**만 쏙 골라주는 **AI 주치의**입니다."

#### 상황별 스크립트
*   **[시나리오 1: 술/담배 하는데 검사 귀찮아함]**
    *   "고객님, 술/담배 하시면서 검사 안 받으시면, 나중에 병원비로 차 한 대 값 나갑니다. **'간 섬유화 스캔'**이랑 **'폐 CT'** 딱 두 개만 찍어보세요. 이거 확인하면 1년 동안 발 뻗고 주무십니다."
*   **[시나리오 2: 가족력 때문에 불안해함]**
    *   "걱정만 한다고 해결되지 않습니다. 유전자 검사로 확률만 보지 마시고, **'내시경'과 '초음파'로 현재 상태를 눈으로 확인**하세요. '깨끗하다'는 의사 소견 한 줄이 최고의 안정제입니다."

### 🏥 To Doctors/Hospitals (병원장/실장용)
*"이걸 도입하면 뭐가 좋나요?"*

#### Value Proposition
> "원장님, **문진 시간은 1/10**로 줄이고, **추가 검진(Upselling) 동의율은 2배**로 높여 드립니다. 환자가 스스로 필요성을 느끼게 만드는 **'데이터 기반 설득 리포트'**를 제공합니다."

#### 설득 논리 (Sales Pitch)
*   **[Point 1: 3중 교차 검증의 신뢰도]**
    *   "환자 말만 듣고 문진하시나요? 저희는 **1) 문진, 2) 건보공단 데이터, 3) 클릭 로그**를 교차 검증합니다. 말로는 술 안 마신다는데 간 수치 높고 지방간 클릭하는 환자, WELLO는 잡아냅니다."
*   **[Point 2: 근거 기반 업셀링 (Evidence-Based)]**
    *   "그냥 '좋은 검사니 하세요'라고 하면 장사꾼 같죠? WELLO는 **'환자분의 체중이 급감했고 당뇨력이 있어서 췌장 검사가 필수입니다'**라고 **학회 가이드라인**을 근거로 제시합니다. 환자가 거절할 명분이 없습니다."
*   **[Point 3: 페르소나 맞춤 상담]**
    *   "불안한 환자(Worrier)에게는 '안심'을, 깐깐한 환자(Minimalist)에게는 '가성비'를 어필해야 합니다. WELLO가 이 환자의 **'공략 포인트'**를 미리 알려드립니다."
