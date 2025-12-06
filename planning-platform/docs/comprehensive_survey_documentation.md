# 문진 시스템 종합 문서

**작성일**: 2025-12-07  
**목적**: 문진의 모든 것 - 패널, 연관관계, 페르소나, 계산식 등 전체 정리

---

## 📋 목차

1. [문진 개요](#문진-개요)
2. [문진 항목 구조](#문진-항목-구조)
3. [페르소나 시스템](#페르소나-시스템)
4. [점수 계산식](#점수-계산식)
5. [패널별 문진](#패널별-문진)
6. [데이터베이스 구조](#데이터베이스-구조)
7. [API 구조](#api-구조)

---

## 문진 개요

### 문진의 목적
- 환자의 건강 상태 파악
- 검진 설계에 필요한 정보 수집
- 페르소나 판정을 통한 맞춤형 검진 제안
- 업셀링 전략 수립

### 문진 흐름
```
1. 염려 항목 선택 (ConcernSelection)
2. 문진 패널 표시 (CheckupDesignSurveyPanel)
3. 문진 항목 입력 (5-8개)
4. API 호출 (선택한 염려 항목 + 설문 응답)
5. 페르소나 판정
6. 검진 설계 생성
```

---

## 문진 항목 구조

### 전체 문진 항목 목록

```python
survey_responses = {
    # Q1: 체중 변화
    "weight_change": "decrease_bad" | "decrease_good" | "increase_some" | "increase_more" | "stable",
    
    # Q2: 일상 생활 패턴 (배열 가능)
    "daily_routine": ["desk_job"] | ["mental_stress"] | ["service_job"] | ["physical_job"] | ["irregular"],
    
    # Q3: 운동 빈도
    "exercise_frequency": "regular" | "sometimes" | "rarely" | "never",
    
    # Q4: 흡연 상태
    "smoking": "current_smoker" | "past_smoker" | "never",
    
    # Q5: 음주 빈도
    "drinking": "weekly_3plus" | "weekly_1_2" | "monthly" | "rarely" | "never",
    
    # Q6: 수면 시간
    "sleep_hours": "less_5" | "5_6" | "7_8" | "more_9",
    
    # Q7: 스트레스 수준
    "stress_level": "very_high" | "high" | "normal" | "low" | "very_low",
    
    # Q8: 가족력 (배열)
    "family_history": ["cancer"] | ["stroke"] | ["heart_disease"] | ["diabetes"] | ["hypertension"] | ["none"],
    
    # Q9: 대장내시경 경험
    "colonoscopy_experience": "yes" | "no_afraid" | "no_never",
    
    # Q10: 추가 걱정사항 (자유 텍스트)
    "additional_concerns": "최근 두통이 심합니다"
}
```

### 문진 항목별 상세 설명

#### Q1: 체중 변화 (`weight_change`)
- **질문**: 최근 3개월간 체중 변화가 있으신가요?
- **가능한 값**:
  - `"decrease_bad"`: 의도치 않은 체중 감소 (3kg 이상)
  - `"decrease_good"`: 의도한 체중 감소 (다이어트 성공)
  - `"increase_some"`: 약간 증가 (1-3kg)
  - `"increase_more"`: 많이 증가 (3kg 이상)
  - `"stable"`: 유지
- **페르소나 영향**: Symptom Solver, Manager, Optimizer

#### Q2: 일상 생활 패턴 (`daily_routine`)
- **질문**: 주로 어떤 일을 하시나요?
- **가능한 값** (배열 또는 단일 문자열):
  - `"desk_job"`: 사무직
  - `"mental_stress"`: 정신적 압박이 많은 직업
  - `"service_job"`: 감정 소모가 많은 서비스직
  - `"physical_job"`: 육체노동
  - `"irregular"`: 불규칙한 생활
- **페르소나 영향**: Symptom Solver, Manager, Optimizer

#### Q3: 운동 빈도 (`exercise_frequency`)
- **질문**: 최근 운동을 하시나요?
- **가능한 값**:
  - `"regular"`: 규칙적으로 운동함 (주 3회 이상)
  - `"sometimes"`: 가끔 운동함 (주 1-2회)
  - `"rarely"`: 거의 안 함
  - `"never"`: 전혀 안 함
- **페르소나 영향**: Optimizer

#### Q4: 흡연 상태 (`smoking`)
- **질문**: 흡연하시나요?
- **가능한 값**:
  - `"current_smoker"`: 현재 흡연 중
  - `"past_smoker"`: 과거 흡연 (금연)
  - `"never"`: 비흡연
- **페르소나 영향**: Manager

#### Q5: 음주 빈도 (`drinking`)
- **질문**: 음주 빈도는?
- **가능한 값**:
  - `"weekly_3plus"`: 주 3회 이상
  - `"weekly_1_2"`: 주 1-2회
  - `"monthly"`: 월 1-2회
  - `"rarely"`: 거의 안 마심
  - `"never"`: 전혀 안 마심
- **페르소나 영향**: Manager

#### Q6: 수면 시간 (`sleep_hours`)
- **질문**: 평균 수면 시간은?
- **가능한 값**:
  - `"less_5"`: 5시간 미만
  - `"5_6"`: 5-6시간
  - `"7_8"`: 7-8시간
  - `"more_9"`: 9시간 이상
- **페르소나 영향**: Symptom Solver

#### Q7: 스트레스 수준 (`stress_level`)
- **질문**: 최근 스트레스 수준은?
- **가능한 값**:
  - `"very_high"`: 매우 높음
  - `"high"`: 높음
  - `"normal"`: 보통
  - `"low"`: 낮음
  - `"very_low"`: 매우 낮음
- **페르소나 영향**: (현재 코드에서 직접 사용 안 함, daily_routine으로 추론)

#### Q8: 가족력 (`family_history`)
- **질문**: 가족 중에 다음 질환이 있으신가요? (복수 선택 가능)
- **가능한 값** (배열):
  - `"cancer"`: 암 가족력
  - `"stroke"`: 뇌졸중 가족력
  - `"heart_disease"`: 심장질환 가족력
  - `"diabetes"`: 당뇨병 가족력
  - `"hypertension"`: 고혈압 가족력
  - `"none"`: 없음
- **페르소나 영향**: Worrier (최우선)

#### Q9: 대장내시경 경험 (`colonoscopy_experience`)
- **질문**: 대장내시경을 받아보신 적이 있으신가요?
- **가능한 값**:
  - `"yes"`: 예, 받아봤음
  - `"no_afraid"`: 아니오, 두려워서 안 받아봄
  - `"no_never"`: 아니오, 한 번도 안 받아봄
- **페르소나 영향**: (현재 코드에서 직접 사용 안 함)

#### Q10: 추가 걱정사항 (`additional_concerns`)
- **질문**: 검진 설계 시 고려해주셨으면 하는 특이사항이나 고민사항이 있으신가요?
- **타입**: 자유 텍스트 (최대 500자)
- **페르소나 영향**: Symptom Solver (증상 키워드 감지)

---

## 페르소나 시스템

### 페르소나 유형 (5가지)

1. **Worrier (가족력/불안형)** - 우선순위 1
2. **Symptom Solver (증상해결형)** - 우선순위 2
3. **Manager (만성질환 관리형)** - 우선순위 3
4. **Optimizer (웰니스/활력형)** - 우선순위 4
5. **Minimalist (실속형)** - 우선순위 5 (기본값)

### 페르소나별 특성

| 페르소나 | 업셀링 강도 | Bridge Strategy | 톤앤매너 | 설득 메시지 |
|---------|-----------|----------------|---------|-----------|
| **Worrier** | very_high | Peace of Mind | 공감, 안심, 확신 | "가족력 때문에 불안하시죠? 눈으로 확인하고 마음의 짐을 덜으세요." |
| **Symptom Solver** | high | Gap Filling | 분석적, 해결책 제시 | "단순 피로가 아닙니다. 숨겨진 원인을 데이터로 찾아야 합니다." |
| **Manager** | medium | Linkage | 경고, 관리, 체계적 | "음주와 비만이 만나면 간이 굳어집니다. 연결고리를 끊어야 합니다." |
| **Optimizer** | very_high | Vitality | 프리미엄, 최신지견 | "병이 없는 것과 활력이 넘치는 건 다릅니다. 최상의 컨디션을 만드세요." |
| **Minimalist** | low | Efficiency | 간결, 핵심, 가성비 | "바쁘시겠지만, 가성비 있게 딱 이것 하나만 챙기시면 됩니다." |

---

## 점수 계산식

### 초기 점수 설정

```python
scores = {
    "Worrier": 0,
    "Symptom Solver": 0,
    "Manager": 0,
    "Optimizer": 0,
    "Minimalist": 100  # 기본값
}
```

### 1. Worrier (가족력/불안형) 점수 계산

```python
# 기본 점수
if family_history and "none" not in family_history:
    scores["Worrier"] = 100  # 최고 점수
    scores["Minimalist"] = 0
    
    # 가족력 종류별 가중치
    if "cancer" in family_history:
        scores["Worrier"] += 20  # 암 가족력은 더 강력
    if "stroke" in family_history or "heart_disease" in family_history:
        scores["Worrier"] += 15
```

**점수표**:
- 기본 점수: 100점 (가족력이 있으면)
- 암 가족력: +20점
- 뇌졸중/심장질환 가족력: +15점

**예시**:
- `["cancer"]` → 100 + 20 = **120점**
- `["cancer", "stroke"]` → 100 + 20 + 15 = **135점**

---

### 2. Symptom Solver (증상해결형) 점수 계산

```python
# Q1: 의도치 않은 체중 감소
if weight_change == "decrease_bad":
    scores["Symptom Solver"] += 50
    scores["Minimalist"] = 0

# Q6: 심각한 수면 부족
if sleep_hours == "less_5":
    scores["Symptom Solver"] += 30
    scores["Minimalist"] = 0

# Q2/Q7: 스트레스가 많은 직업
if any(job in daily_routine for job in ["mental_stress", "service_job"]):
    scores["Symptom Solver"] += 40
    scores["Worrier"] += 15  # 불안감 동반 가능성
    scores["Minimalist"] = 0

# Q2: 육체노동
if "physical_job" in daily_routine:
    scores["Symptom Solver"] += 20
    scores["Minimalist"] = 0

# Q10: 증상 키워드 감지
symptom_keywords = ["통증", "아픔", "아파", "불편", "두통", "피로", "어지럼", 
                    "답답", "저림", "숨", "가슴", "배", "허리", "무릎", 
                    "관절", "소화", "변비", "설사"]
if additional_concerns and any(keyword in additional_concerns for keyword in symptom_keywords):
    scores["Symptom Solver"] += 35
    scores["Minimalist"] = 0
```

**점수표**:
- 의도치 않은 체중 감소: +50점
- 수면 부족 (5시간 미만): +30점
- 정신적 스트레스/서비스직: +40점
- 육체노동: +20점
- 증상 키워드 포함: +35점

**예시**:
- 체중 감소 + 수면 부족: 50 + 30 = **80점**
- 정신적 스트레스 + 증상 키워드: 40 + 35 = **75점**
- 복합 조건: 50 + 30 + 40 + 35 = **155점**

---

### 3. Manager (만성질환 관리형) 점수 계산

```python
# Q4: 현재 흡연
if smoking == "current_smoker":
    scores["Manager"] += 40
    scores["Minimalist"] = 0

# Q5: 잦은 음주 (주 2회 이상)
if drinking in ["weekly_1_2", "weekly_3plus"]:
    scores["Manager"] += 30
    scores["Minimalist"] = 0

# Q1: 체중 증가
if weight_change in ["increase_some", "increase_more"]:
    scores["Manager"] += 25
    scores["Minimalist"] = 0

# Q7: 불규칙한 생활
if "irregular" in daily_routine:
    scores["Manager"] += 20
    scores["Minimalist"] = 0

# 복합 위험 가중치 (흡연 + 음주 + 비만)
if (smoking == "current_smoker" and
    drinking in ["weekly_1_2", "weekly_3plus"] and
    weight_change == "increase_more"):
    scores["Manager"] += 30  # 추가 가중치
```

**점수표**:
- 현재 흡연: +40점
- 잦은 음주 (주 1-2회 이상): +30점
- 체중 증가: +25점
- 불규칙한 생활: +20점
- 복합 위험 (흡연+음주+비만): +30점 (추가)

**예시**:
- 흡연만: **40점**
- 흡연 + 음주: 40 + 30 = **70점**
- 복합 위험: 40 + 30 + 25 + 30 = **125점**

---

### 4. Optimizer (웰니스/활력형) 점수 계산

```python
# Q3: 규칙적 운동
if exercise_frequency == "regular":
    scores["Optimizer"] += 40

# Q2: 고소득 직업군 (전문직/관리직)
if "desk_job" in daily_routine or "mental_stress" in daily_routine:
    scores["Optimizer"] += 30

# Q1: 다이어트 성공 (자기관리)
if weight_change == "decrease_good":
    scores["Optimizer"] += 25
    scores["Minimalist"] = 0

# Optimizer + 고소득 복합 (프리미엄 타겟)
if (exercise_frequency == "regular" and "mental_stress" in daily_routine):
    scores["Optimizer"] += 20  # 추가 가중치
```

**점수표**:
- 규칙적 운동: +40점
- 사무직/정신적 스트레스 직업: +30점
- 다이어트 성공: +25점
- 복합 조건 (운동+고소득): +20점 (추가)

**예시**:
- 규칙적 운동만: **40점**
- 규칙적 운동 + 사무직: 40 + 30 = **70점**
- 복합 조건: 40 + 30 + 20 = **90점**
- 다이어트 성공: **25점**

---

### 5. Minimalist (실속형) 점수 계산

```python
# 기본값: 100점으로 시작
scores["Minimalist"] = 100

# 다른 페르소나가 점수를 받으면 0점으로 설정
# 조건:
# 1. 가족력이 있는 경우
# 2. 체중 변화가 있는 경우 (감소/증가 모두)
# 3. 수면 부족
# 4. 스트레스가 많은 직업
# 5. 증상 키워드가 포함된 경우
# 6. 흡연 중
# 7. 음주 빈도가 높은 경우
# 8. 불규칙한 생활
# 9. 다이어트 성공
```

**점수표**:
- 기본값: 100점
- 다른 페르소나 조건 만족 시: 0점

---

### 최종 판정 로직

```python
# 가장 높은 점수를 받은 페르소나 선택
primary_persona = max(scores, key=scores.get)

# 동점인 경우 우선순위 적용
# 1. Worrier
# 2. Symptom Solver
# 3. Manager
# 4. Optimizer
# 5. Minimalist
```

---

## 패널별 문진

### 현재 구현된 문진 패널

#### 1. CheckupDesignSurveyPanel
- **위치**: `frontend/src/components/CheckupDesign/SurveyPanel/`
- **용도**: 검진 설계 전 문진 입력
- **문진 항목**: 8-10개 (체중, 운동, 흡연, 음주, 수면, 스트레스, 가족력, 추가 고민사항)

#### 2. 병원별 문진 템플릿
- **테이블**: `questionnaire_templates`
- **예시**:
  - 세브란스 헬스체크업 문진표
  - 김현우내과의원 국가일반검진 문진표
  - 메디링스병원 고객 만족도 조사

---

## 데이터베이스 구조

### 1. questionnaire_templates (템플릿 메타데이터)

```sql
CREATE TABLE questionnaire_templates (
    id SERIAL PRIMARY KEY,
    content_type_id VARCHAR(50),  -- 예: "SEVERANCE_HEALTH_CHECKUP_001"
    content_name VARCHAR(200),     -- 예: "세브란스 헬스체크업 문진표"
    description TEXT,
    questionnaire_required BOOLEAN,
    questionnaire_schema JSONB,    -- JSON 스키마 (질문 구조 전체)
    questionnaire_validation JSONB,
    hospital_id VARCHAR(50),
    version INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### 2. template_contents (실제 질문 내용)

```sql
CREATE TABLE template_contents (
    content_id SERIAL PRIMARY KEY,
    content_key VARCHAR(100),      -- 예: "SEVERANCE_HEALTH_CHECKUP_001_31"
    content_type VARCHAR(50),      -- "question"
    title JSONB,                   -- 다국어 지원 {"ko": "질문 제목"}
    description JSONB,
    question_type VARCHAR(50),     -- "radio", "checkbox", "text", "dropdown"
    is_required BOOLEAN,
    options JSONB,                -- 선택지
    display_order INTEGER,
    group_id VARCHAR(100),
    hospital_id VARCHAR(50),
    created_at TIMESTAMPTZ
);
```

### 3. wello_checkup_design_requests (검진 설계 요청)

```sql
CREATE TABLE wello_checkup_design_requests (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES wello_patients(id),
    selected_concerns JSONB NOT NULL,      -- 선택한 염려 항목
    survey_responses JSONB NOT NULL,       -- 설문 응답
    additional_concerns TEXT,               -- 추가 고민사항
    design_result JSONB,                    -- 검진 설계 결과
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API 구조

### 문진 응답 데이터 구조

```json
{
  "weight_change": "decrease_bad",
  "daily_routine": ["desk_job"],
  "exercise_frequency": "regular",
  "smoking": "current_smoker",
  "drinking": "weekly_3plus",
  "sleep_hours": "less_5",
  "stress_level": "very_high",
  "family_history": ["cancer", "diabetes"],
  "colonoscopy_experience": "no_afraid",
  "additional_concerns": "최근 두통이 심합니다"
}
```

### 페르소나 판정 결과 구조

```json
{
  "primary_persona": "Worrier",
  "persona_score": {
    "Worrier": 120,
    "Symptom Solver": 40,
    "Manager": 30,
    "Optimizer": 10,
    "Minimalist": 0
  },
  "bridge_strategy": "Peace of Mind",
  "tone": "공감, 안심, 확신",
  "upselling_intensity": "very_high",
  "persuasion_message": "가족력 때문에 불안하시죠? 눈으로 확인하고 마음의 짐을 덜으세요."
}
```

---

## 실제 계산 예시

### 예시 1: Worrier (가족력 우선)

```python
survey_responses = {
    "family_history": ["cancer", "stroke"],
    "weight_change": "stable",
    "smoking": "never",
    "drinking": "rarely"
}

# 점수 계산
Worrier: 100 (기본) + 20 (암) + 15 (뇌졸중) = 135점
Symptom Solver: 0점
Manager: 0점
Optimizer: 0점
Minimalist: 0점 (가족력 있음)

→ 최종: Worrier (135점)
```

### 예시 2: Symptom Solver (증상 중심)

```python
survey_responses = {
    "family_history": [],
    "weight_change": "decrease_bad",
    "sleep_hours": "less_5",
    "daily_routine": ["service_job"],
    "additional_concerns": "두통이 심합니다"
}

# 점수 계산
Worrier: 0점
Symptom Solver: 50 (체중 감소) + 30 (수면 부족) + 40 (서비스직) + 35 (증상 키워드) = 155점
Manager: 0점
Optimizer: 0점
Minimalist: 0점

→ 최종: Symptom Solver (155점)
```

### 예시 3: Manager (만성질환 위험)

```python
survey_responses = {
    "family_history": [],
    "smoking": "current_smoker",
    "drinking": "weekly_3plus",
    "weight_change": "increase_more"
}

# 점수 계산
Worrier: 0점
Symptom Solver: 0점
Manager: 40 (흡연) + 30 (음주) + 25 (비만) + 30 (복합 가중치) = 125점
Optimizer: 0점
Minimalist: 0점

→ 최종: Manager (125점)
```

### 예시 4: Optimizer (웰니스)

```python
survey_responses = {
    "family_history": [],
    "exercise_frequency": "regular",
    "daily_routine": ["mental_stress"],
    "weight_change": "decrease_good"
}

# 점수 계산
Worrier: 0점
Symptom Solver: 0점
Manager: 0점
Optimizer: 40 (운동) + 30 (정신적 스트레스) + 20 (복합 가중치) + 25 (다이어트 성공) = 115점
Minimalist: 0점

→ 최종: Optimizer (115점)
```

### 예시 5: Minimalist (기본값)

```python
survey_responses = {
    "family_history": [],
    "weight_change": "stable",
    "smoking": "never",
    "drinking": "rarely",
    "exercise_frequency": "sometimes",
    "sleep_hours": "7_8"
}

# 점수 계산
Worrier: 0점
Symptom Solver: 0점
Manager: 0점
Optimizer: 0점
Minimalist: 100점 (기본값 유지)

→ 최종: Minimalist (100점)
```

---

## 참고 자료

### 관련 문서
1. `planning-platform/backend/docs/persona_scoring_guide.md` - 페르소나 점수 계산 상세 가이드
2. `planning-platform/backend/docs/wello_questionnaire_template_structure.md` - 문진 템플릿 구조
3. `planning-platform/docs/checkup_design_survey_improvement_plan.md` - 설문 개선 계획
4. `planning-platform/backend/app/services/checkup_design/persona.py` - 페르소나 판정 코드

### 코드 위치
- 페르소나 판정: `app/services/checkup_design/persona.py`
- 설문 매핑: `app/services/checkup_design/survey_mapping.py`
- 프롬프트 생성: `app/services/checkup_design/step1_prompt.py`

---

**마지막 업데이트**: 2025-12-07

