# mediArc 건강 플래너 Phase 2/3/4 통합 기획서

> 작성일: 2026-04-16 | 담당: dev-planner
> 상위 문서: docs/health-planner-benchmark-survey.md, docs/supplement-benchmark-survey.md
> 선행 완료: Phase 3 (BMI 슬라이더 + 시간축 감쇠 + alpha 논문 근거) + 건기식 RAG 28종 + GPT 스토리텔링

---

## 0. 요약

| Phase | 목표 | 핵심 산출물 | 예상 규모 |
|-------|------|------------|----------|
| **2** | 생활습관 토글 UI + 엔진 확장 (운동/식습관) | HealthPlannerPanel.tsx, engine.py 확장 | BE 2파일 + FE 3파일 + SCSS 1파일 |
| **3** | 클라이언트 사이드 경량 계산기 (JBS3 패턴) | ratio_table API, useHealthPlanner 훅 | BE 2파일 + FE 2파일 |
| **4** | 약물 상호작용 (RAG 357종) | MedicationInput.tsx, nutrition_service Step 3 | BE 1파일 + FE 2파일 |
| 공통 | 모바일 대응 | 전 컴포넌트 반응형 + 터치 최적화 | SCSS 리팩터 |

**총 변경 파일 수**: BE 5파일 + FE 7파일 + SCSS 2파일 = ~14파일
**권장 모드**: TEAM (FE/BE 병렬, 같은 파일 병렬 수정 금지)

---

## 1. Phase 2 -- 생활습관 토글 + 엔진 확장

### 1-1. 현재 상태 (코드 팩트)

**BE (engine.py)**:
- `compute_milestone_scenario()` (line 2001-2109): bmi_target, smoking_target("quit"), drinking_target("none"), time_horizon_months 지원
- `exercise_weekly`는 patient 데이터로 입력받지만 `classify_risk_factors()` (line 403-481)에서 위험인자로 사용하지 않음 -- 개선 효과 계산 로직 없음
- 식습관(나트륨/식이패턴) 관련 입력 필드 자체가 없음
- 혈압 보정: BMI -1 -> SBP -1.5, DBP -0.8 / 금주 -> SBP -4, DBP -3

**FE**:
- simulate API 엔드포인트 존재: `POST /mediarc-report/{uuid}/simulate` (partner_office.py line 3208)
- `SimulateRequest` (line 3031-3040): bmi_target, weight_delta_kg, smoking_target, drinking_target, time_horizon_months
- FE 측 BmiSlider/MilestonePanel 등 인터랙티브 UI는 미구현 (DiseaseReportPage에서 API 호출 코드만 존재)
- HealthAgeSection 컴포넌트 존재하나 시뮬레이션 UI 없음

**벤치마크 참조 (docs/health-planner-benchmark-survey.md)**:
- JBS3 Heart Age: 슬라이더 + 토글 -> 건강나이 delta 실시간 표시 (첫 5개월 140만 뷰)
- ASCVD: Before/After 병렬 표시
- Noom: 카드 선택형 (초록/노랑/빨강 컬러코딩)

### 1-2. Phase 2-A: FE 인터랙티브 플래너 UI

#### 와이어프레임 (모바일 세로 기준, 375px)

```
+---------------------------------------+
|  [건강 플래너]              현재 | 목표  |
+---------------------------------------+
|                                       |
|    건강나이  48세  -->  43세  (-5)     |
|    [====== 카운트 애니메이션 ======]    |
|                                       |
+---------------------------------------+
|  체중 (BMI)                           |
|  현재 78kg (BMI 26.3)                 |
|  -----[======O=========]----- 68kg    |
|        60        78       100         |
+---------------------------------------+
|  흡연                                 |
|  [* 흡연 중]     [ 금연 ]             |
+---------------------------------------+
|  음주                                 |
|  현재: 주 3회                         |
|  [ 유지 ]  [ 절주 ]  [* 금주 ]        |
+---------------------------------------+
|  운동                    <-- 신규      |
|  현재: 주 1회                         |
|  +--------+ +--------+ +--------+    |
|  | 안 함  | |주 1-2  | |주 3-4  |    |
|  | (빨강) | |(노랑)* | |(초록)  |    |
|  +--------+ +--------+ +--------+    |
|  +--------+                           |
|  |  매일  |                           |
|  | (진초) |                           |
|  +--------+                           |
+---------------------------------------+
|  식습관 (나트륨)             <-- 신규  |
|  현재: 짜게                           |
|  +--------+ +--------+ +--------+    |
|  |  짜게  | |  보통  | | 싱겁게 |    |
|  |(빨강)* | |(노랑)  | |(초록)  |    |
|  +--------+ +--------+ +--------+    |
+---------------------------------------+
|  시간축                               |
|  [지금] [6개월] [1년] [5년]           |
|     *                                 |
+---------------------------------------+
|                                       |
|  질환별 위험도 변화                    |
|  +----------------------------------+|
|  | 당뇨    1.8배 -> 1.3배   -28%    ||
|  | 심혈관  2.1배 -> 1.6배   -24%    ||
|  | 고혈압  1.5배 -> 1.1배   -27%    ||
|  | ...                              ||
|  +----------------------------------+|
|                                       |
+---------------------------------------+
```

#### 데스크탑 와이어프레임 (1024px+)

```
+------------------------------------------------------+
|  [건강 플래너]                                         |
+------------------------------------------------------+
|                                                      |
|  +-- 좌측 패널 (컨트롤) --+  +-- 우측 패널 (결과) -+ |
|  |                        |  |                     | |
|  | 건강나이  48세 -> 43세  |  | [Before]  [After]  | |
|  |                        |  |                     | |
|  | 체중 (BMI)             |  | 당뇨    1.8  1.3   | |
|  | ---[===O====]--- 68kg  |  | 심혈관  2.1  1.6   | |
|  |                        |  | 고혈압  1.5  1.1   | |
|  | 흡연  [흡연|금연]      |  | ...                | |
|  |                        |  |                     | |
|  | 음주  [유지|절주|금주]  |  | [바 차트 시각화]    | |
|  |                        |  |                     | |
|  | 운동  [카드4개]         |  |                     | |
|  |                        |  |                     | |
|  | 식습관 [카드3개]        |  |                     | |
|  |                        |  |                     | |
|  | 시간축                  |  |                     | |
|  | [지금][6M][1Y][5Y]     |  |                     | |
|  +------------------------+  +---------------------+ |
+------------------------------------------------------+
```

#### 컴포넌트 구조

```
HealthPlannerPanel (신규)
  +-- PlannerHeader
  |     건강나이 delta 숫자 (카운트 애니메이션)
  +-- PlannerControls
  |     +-- BmiSlider (체중/BMI 슬라이더)
  |     +-- SmokingToggle (흡연 -> 금연)
  |     +-- DrinkingSelector (주N회 -> 금주)
  |     +-- ExerciseCardGroup (신규 -- 4단계 카드 선택)
  |     +-- DietCardGroup (신규 -- 3단계 카드 선택)
  |     +-- TimeHorizonSelector (0/6/12/60개월)
  +-- PlannerResults
        +-- BeforeAfterCompare (현재 vs 개선 비교)
        +-- DiseaseRatioChart (질환별 ratio 바 차트)
```

#### 컨트롤 타입별 Props 인터페이스

```typescript
// BmiSlider (기존 확장)
interface BmiSliderProps {
  currentBmi: number;
  currentWeight: number;
  height: number;
  targetBmi: number | null;
  onChange: (bmiTarget: number) => void;
  min?: number;   // default: 15
  max?: number;   // default: 45
}

// SmokingToggle
interface SmokingToggleProps {
  currentStatus: 'current' | 'former' | 'never';
  targetStatus: 'current' | 'quit' | null;
  onChange: (target: 'current' | 'quit' | null) => void;
  disabled?: boolean;  // never인 경우 비활성
}

// DrinkingSelector
interface DrinkingSelectorProps {
  currentStatus: 'heavy' | 'moderate' | 'yes' | 'none';
  targetStatus: 'none' | null;
  onChange: (target: 'none' | null) => void;
}

// ExerciseCardGroup (신규)
interface ExerciseCardGroupProps {
  currentWeekly: number;         // 현재 주간 운동 횟수
  targetWeekly: number | null;   // 목표 주간 운동 횟수
  onChange: (target: number | null) => void;
  options: ExerciseOption[];
}

interface ExerciseOption {
  label: string;       // "안 함", "주 1-2회", "주 3-4회", "매일"
  value: number;       // 0, 1.5, 3.5, 7
  color: string;       // '#ef4444', '#f59e0b', '#22c55e', '#15803d'
  description: string; // "150분/주 미만", "150분/주 달성" 등
}

// DietCardGroup (신규)
interface DietCardGroupProps {
  currentLevel: 'high_sodium' | 'normal' | 'low_sodium';
  targetLevel: string | null;
  onChange: (target: string | null) => void;
  options: DietOption[];
}

interface DietOption {
  label: string;       // "짜게", "보통", "싱겁게"
  value: string;       // 'high_sodium', 'normal', 'low_sodium'
  color: string;
  sodiumMg: string;    // "4000+mg/일", "2000mg/일", "<1500mg/일"
}
```

### 1-3. Phase 2-B: 엔진 확장 (운동/식습관)

#### 운동 효과 모델 (논문 근거 수집 필요)

현재 engine.py의 `classify_risk_factors()`에 운동 위험인자가 없음. 추가 필요:

```python
# classify_risk_factors() 추가 예정 인자 (line ~470)
"physical_inactivity": (p.get("exercise_weekly") or 0) < 3,  # WHO 기준 150분/주 미만
"regular_exercise": (p.get("exercise_weekly") or 0) >= 3,    # 주 3회 이상
```

**엔진 확장 -- compute_milestone_scenario() 추가 파라미터**:

```python
# milestone keys 추가:
#   exercise_target: int | None     목표 주간 운동 횟수 (0/1.5/3.5/7)
#   diet_target: str | None         "low_sodium" | "normal" | None

# 운동 효과 (혈압 보정):
#   주 3-4회(150분) 달성 시: SBP -5~-8, DBP -3~-5
#   매일(300분+) 달성 시: SBP -8~-12, DBP -5~-8
#   출처: 2023 ESH/ESC Guidelines (실 PMID 확인 필요)

# 식습관(나트륨) 효과 (혈압 보정):
#   고나트륨 -> 저나트륨 전환 시: SBP -5~-6, DBP -2~-3
#   출처: DASH-Sodium Trial (PMID 11136953, 실 확인 필요)
```

**중요**: 논문 근거는 dev-coder 구현 전 WebSearch로 PMID 실확인 필수. AI 출처 날조 방지 (CLAUDE.md 반복실수 테이블 2026-03-30 참조).

#### SimulateRequest 확장

```python
# partner_office.py SimulateRequest 확장
class SimulateRequest(BaseModel):
    bmi_target: Optional[float] = Field(None, ge=15.0, le=45.0)
    weight_delta_kg: Optional[float] = Field(None, ge=0.0, le=100.0)
    smoking_target: Optional[Literal["current", "quit"]] = None
    drinking_target: Optional[Literal["none"]] = None
    exercise_target: Optional[float] = Field(None, ge=0.0, le=7.0)   # 신규
    diet_target: Optional[Literal["low_sodium", "normal"]] = None    # 신규
    time_horizon_months: Literal[0, 6, 12, 60] = 0
    force: bool = False
```

#### SimulateResponse 변경: 없음 (기존 ratios/labels 구조 그대로 사용)

### 1-4. Phase 2-C: 결과 실시간 시각화

#### Before/After 비교 레이아웃

```
+-------------------------------------------+
|  질환별 위험도 변화                         |
+-------------------------------------------+
|  질환        현재     개선     감소율       |
|  ---------  ------   ------   --------    |
|  당뇨       1.8배    1.3배    -28% [====] |
|  심혈관     2.1배    1.6배    -24% [===]  |
|  고혈압     1.5배    1.1배    -27% [====] |
|  대사증후군  1.3배    1.0배    -23% [===]  |
|  ...                                      |
+-------------------------------------------+
|  혈압 예상 변화                            |
|  SBP: 138 -> 122 (-16)                    |
|  DBP:  88 ->  78 (-10)                    |
+-------------------------------------------+
```

- 건강나이 delta 카운트업 애니메이션: CSS `transition` + `requestAnimationFrame`
- 질환별 ratio 바 차트: 현재(빨강) -> 개선(초록) 슬라이드 애니메이션
- 시간축(0/6/12/60개월) 전환 시 alpha 감쇠 반영하여 결과 재계산

---

## 2. Phase 3 -- 클라이언트 사이드 경량 계산기

### 2-1. 문제 정의

현재 simulate API는 서버에서 `compute_milestone_scenario()` 전체를 실행합니다.
슬라이더를 움직일 때마다 서버 호출이 필요하면 네트워크 레이턴시 + 엔진 실행 시간으로 인해 실시간 피드백이 불가능합니다.

**해결: JBS3 패턴** -- 초기 로드 시 서버에서 "base 결과 + ratio_table" 전송, 이후 조작은 클라이언트에서 delta 적용.

### 2-2. ratio_table 구조

서버가 1회 전송하는 사전 계산 테이블:

```typescript
interface RatioTable {
  // 기본 결과 (현재 상태)
  base: {
    bodyage: number;             // 현재 건강나이
    age: number;                 // 실제 나이
    bmi: number;                 // 현재 BMI
    sbp: number;                 // 현재 수축기혈압
    dbp: number;                 // 현재 이완기혈압
    fbg: number;                 // 현재 공복혈당
    disease_ratios: Record<string, number>;  // 질환별 ratio (현재)
  };

  // 인자별 delta 계수
  deltas: {
    // BMI 1단위 감소 시
    bmi_per_unit: {
      sbp: number;    // -1.5
      dbp: number;    // -0.8
      fbg_threshold: number;  // BMI 2 이상 감소 시 fbg*0.7 적용
      disease_factors: Record<string, number>;  // 질환별 ratio 감소 계수
    };

    // 금연 시
    quit_smoking: {
      disease_factors: Record<string, number>;  // 질환별 ratio 변화 계수
    };

    // 금주 시
    quit_drinking: {
      sbp: number;    // -4.0
      dbp: number;    // -3.0
      disease_factors: Record<string, number>;
    };

    // 운동 (주 3-4회 달성 시)
    exercise_moderate: {
      sbp: number;    // -5.0
      dbp: number;    // -3.0
      disease_factors: Record<string, number>;
    };

    // 운동 (매일)
    exercise_daily: {
      sbp: number;    // -8.0
      dbp: number;    // -5.0
      disease_factors: Record<string, number>;
    };

    // 식습관 (저나트륨 전환)
    diet_low_sodium: {
      sbp: number;    // -5.0
      dbp: number;    // -2.5
      disease_factors: Record<string, number>;
    };
  };

  // 시간축 감쇠 테이블 (질환 x 행동 x 월수 -> alpha)
  attenuation: Record<string, Record<string, Record<number, number>>>;
  // 예: attenuation["cardiovascular"]["bmi"][6] = 0.85
}
```

### 2-3. BE -- ratio_table 생성 엔드포인트

```
GET /mediarc-report/{uuid}?include_ratio_table=true
```

기존 `/mediarc-report/{uuid}` 응답에 `ratio_table` 필드 추가 (옵셔널).
`include_ratio_table=true` 쿼리 파라미터일 때만 포함 (하위 호환).

**구현 위치**: `partner_office.py`의 기존 mediarc-report GET 핸들러
**의존**: `engine.py`에서 `_TIME_ATTENUATION_TABLE`, `classify_risk_factors()`, `calculate_individual_rr()` 활용

ratio_table 생성 로직 (새 함수):
```python
def build_ratio_table(patient: dict, disease_results: dict) -> dict:
    """
    현재 patient 기준으로 클라이언트 경량 계산용 ratio_table 생성.
    각 인자 변경 시 예상 delta를 사전 계산하여 반환.
    """
```

### 2-4. FE -- useHealthPlanner 훅

```typescript
// useHealthPlanner.ts (신규)

interface UseHealthPlannerReturn {
  // 상태
  baseResult: RatioTable['base'] | null;
  currentSettings: PlannerSettings;
  computedResult: ComputedResult;
  isLoading: boolean;

  // 액션
  setBmiTarget: (bmi: number) => void;
  setSmokingTarget: (target: 'quit' | null) => void;
  setDrinkingTarget: (target: 'none' | null) => void;
  setExerciseTarget: (weeklyCount: number | null) => void;
  setDietTarget: (target: 'low_sodium' | 'normal' | null) => void;
  setTimeHorizon: (months: 0 | 6 | 12 | 60) => void;
  resetAll: () => void;
}

interface PlannerSettings {
  bmiTarget: number | null;
  smokingTarget: 'quit' | null;
  drinkingTarget: 'none' | null;
  exerciseTarget: number | null;   // 주간 횟수
  dietTarget: string | null;
  timeHorizonMonths: 0 | 6 | 12 | 60;
}

interface ComputedResult {
  bodyage: number;
  bodyageDelta: number;
  sbp: number;
  dbp: number;
  fbg: number;
  diseaseRatios: Record<string, number>;
  hasImprovement: boolean;
}
```

**클라이언트 계산 로직** (ratio_table 기반):

```typescript
function computeLocal(
  base: RatioTable['base'],
  deltas: RatioTable['deltas'],
  attenuation: RatioTable['attenuation'],
  settings: PlannerSettings
): ComputedResult {
  let sbpDelta = 0;
  let dbpDelta = 0;
  let bodyageDelta = 0;
  const ratioFactors: Record<string, number[]> = {};

  // 1. BMI 변화
  if (settings.bmiTarget !== null) {
    const bmiDiff = base.bmi - settings.bmiTarget;
    if (bmiDiff > 0) {
      sbpDelta -= bmiDiff * deltas.bmi_per_unit.sbp;  // -1.5/unit
      dbpDelta -= bmiDiff * deltas.bmi_per_unit.dbp;  // -0.8/unit
      // ... disease_factors 적용
    }
  }

  // 2. 금연
  if (settings.smokingTarget === 'quit') {
    // deltas.quit_smoking.disease_factors 적용
  }

  // 3. 금주
  if (settings.drinkingTarget === 'none') {
    sbpDelta -= deltas.quit_drinking.sbp;
    dbpDelta -= deltas.quit_drinking.dbp;
  }

  // 4. 운동
  if (settings.exerciseTarget !== null && settings.exerciseTarget >= 3) {
    const exerciseDeltas = settings.exerciseTarget >= 7
      ? deltas.exercise_daily
      : deltas.exercise_moderate;
    sbpDelta -= exerciseDeltas.sbp;
    dbpDelta -= exerciseDeltas.dbp;
  }

  // 5. 식습관
  if (settings.dietTarget === 'low_sodium') {
    sbpDelta -= deltas.diet_low_sodium.sbp;
    dbpDelta -= deltas.diet_low_sodium.dbp;
  }

  // 6. 시간축 감쇠 alpha 적용
  // attenuation 테이블에서 질환/행동/월수별 alpha 조회
  // 최종 ratio = base_ratio * alpha

  // 7. 건강나이 delta 계산
  // (간이 공식: SBP 2 감소 = 건강나이 -0.3세 등)

  return { /* computed values */ };
}
```

**데이터 플로우**:

```
[페이지 로드]
  -> GET /mediarc-report/{uuid}?include_ratio_table=true
  -> useHealthPlanner 초기화 (base + ratio_table 저장)

[슬라이더 조작]
  -> PlannerSettings 변경 (React state)
  -> computeLocal() 즉시 실행 (서버 호출 0)
  -> ComputedResult -> UI 반영 (0ms 지연)

[정밀 확인 버튼]
  -> POST /mediarc-report/{uuid}/simulate (기존 API)
  -> 서버 정밀 계산 결과로 검증/보정
```

### 2-5. 오프라인/캐시 전략

- ratio_table 로컬 캐시: `localStorage['planner_ratio_{uuid}']`
- 캐시 TTL: 24시간 (검진 결과가 당일 내 변하지 않으므로)
- 오프라인 시: 캐시된 ratio_table로 시뮬레이션 가능 (3G에서도 즉시 반응)
- PWA 전환 대비: Service Worker 캐시 전략과 호환되는 구조

---

## 3. Phase 4 -- 약물 상호작용

### 3-1. 현재 상태 (코드 팩트)

**nutrition_service.py** (line 236-237):
```python
# Step 3: 약물 상호작용 (Phase 1: 스킵)
# medications=[] -> 경고 없음. Phase 2에서 FAISS "약물명+영양소+상호작용" 검색 구현.
```

**facade.py** (line 140):
```python
nutrition_result = _svc.recommend_sync(
    patient=_nr_patient, diseases=_nr_diseases,
    name=name, medications=[],  # <-- 항상 빈 배열
)
```

**nutrition_rules.py**: drug/medication/interaction 관련 코드 없음 (grep 0건).

**FAISS DB**: `/data/vector_db/welno/faiss_db` -- 건기식 28종 RAG 문서 존재. 약물 상호작용 전용 문서는 별도 적재 필요.

**벤치마크 참조 (docs/supplement-benchmark-survey.md)**:
- Persona Nutrition: 4,000+ 약물-영양소 상호작용 DB
- 필라이즈: 부작용 위험 성분 경고 포함

### 3-2. Phase 4-A: 복용 약물 입력 UI

#### 와이어프레임

```
+---------------------------------------+
|  현재 복용 중인 약이 있으신가요?        |
|                                       |
|  [약물명 입력... ]  [추가]             |
|  (자동완성 드롭다운)                    |
|                                       |
|  추가된 약물:                          |
|  +----------------------------------+|
|  | 암로디핀 5mg          [x 삭제]   ||
|  +----------------------------------+|
|  +----------------------------------+|
|  | 메트포르민 500mg      [x 삭제]   ||
|  +----------------------------------+|
|                                       |
|  [건너뛰기]            [확인]         |
+---------------------------------------+
```

**모바일 최적화**:
- 입력 필드: 키보드 올라올 때 viewport 자동 조정
- 약물 카드: 스와이프 삭제 (좌 -> 삭제 확인)
- 자동완성: 모바일 전용 바텀시트 드롭다운

#### 컴포넌트 구조

```
MedicationInput (신규)
  +-- MedicationSearchInput
  |     자유 텍스트 + 자동완성 (약물명 DB)
  +-- MedicationCardList
  |     +-- MedicationCard (추가된 약물 카드)
  |           이름, 용량(선택), 삭제 버튼
  +-- MedicationSkipButton
```

#### Props 인터페이스

```typescript
interface MedicationInputProps {
  medications: Medication[];
  onAdd: (med: Medication) => void;
  onRemove: (index: number) => void;
  onSkip: () => void;
  onConfirm: () => void;
}

interface Medication {
  name: string;          // "암로디핀"
  dosage?: string;       // "5mg" (선택)
  genericName?: string;  // 검색 매칭용 일반명
}
```

### 3-3. Phase 4-B: BE 상호작용 체크 (nutrition_service Step 3 활성화)

#### 구현 계획

nutrition_service.py Step 3를 활성화하여 FAISS 검색으로 약물-영양소 상호작용 체크:

```python
# Step 3: 약물 상호작용 체크 (Phase 4 활성화)
interaction_warnings: list[dict] = []
if medications:
    for med in medications:
        for cand in selected_cands:
            nutrient_name = cand["name"]
            query = f"{med} {nutrient_name} 상호작용 주의사항 부작용"
            ev = await self._fetch_rag_evidence(nutrient_name, query)
            if ev and _is_interaction_warning(ev):
                interaction_warnings.append({
                    "medication": med,
                    "nutrient": nutrient_name,
                    "severity": _classify_severity(ev),  # "contraindicated" | "caution" | "info"
                    "description": ev.get("detail", "")[:200],
                    "source": ev.get("source", ""),
                })
```

#### 경고 등급 정의

| 등급 | 색상 | 의미 | 예시 |
|------|------|------|------|
| `contraindicated` | 빨강 | 금기 -- 해당 영양소 추천에서 제외 | 와파린 + 비타민K |
| `caution` | 노랑 | 주의 -- 복용 간격 조정 권고 | 갑상선약 + 철분제 |
| `info` | 회색 | 참고 -- 일반적 주의사항 | 혈압약 + 자몽 추출물 |

#### FAISS 문서 적재 계획

- Drug-Nutrient Depletion Chart 3건 (기존 RAG 문서)
- 약물-영양소 상호작용 가이드 357종 추가 적재 필요
- 적재 형식: 기존 FAISS 파이프라인 (`vector_search.py`) 활용

### 3-4. Phase 4-C: FE 경고 표시

#### 와이어프레임

```
+---------------------------------------+
|  [오메가3]  #혈관건강                   |
|  "LDL 콜레스테롤이 160mg/dL로 높은     |
|   편이에요. 오메가3이 도움이 될 수..."   |
|                                       |
|  +----------------------------------+|
|  | ! 주의: 혈압약(암로디핀) 복용 시   ||
|  |   자몽 추출물 주의                 ||
|  +----------------------------------+|
|                                       |
+---------------------------------------+
```

**경고 있는 영양소 처리 규칙**:
- `contraindicated`: 추천 목록에서 제외 (표시하지 않음)
- `caution`: 추천은 유지하되, 카드 하단에 노랑 경고 배너
- `info`: 카드 하단에 회색 참고 배너

---

## 4. 모바일 대응 설계

### 4-1. 반응형 브레이크포인트

| 구간 | 폭 | 레이아웃 | 특수 처리 |
|------|-----|---------|----------|
| Mobile S | < 375px | 1열 풀폭 | 카드 2열 -> 1열 |
| Mobile | 375-767px | 1열 풀폭 | 기본 모바일 |
| Tablet | 768-1023px | 1열 (플래너는 2열) | 패드 최적화 |
| Desktop | 1024px+ | 2열 (컨트롤 | 결과) | 사이드바 형태 |

### 4-2. 터치 최적화

```scss
// _health-planner.scss

// 터치 타겟 최소 크기 (WCAG 2.5.8)
.planner-control {
  min-height: 44px;
  min-width: 44px;
}

// 슬라이더 thumb
.bmi-slider .thumb {
  width: 48px;
  height: 48px;
  // 터치 영역 확대
  &::before {
    content: '';
    position: absolute;
    top: -12px; right: -12px; bottom: -12px; left: -12px;
  }
}

// 카드 선택 (운동/식습관)
.exercise-card, .diet-card {
  min-height: 72px;
  padding: 16px;
  border-radius: 12px;
  // 선택 시 피드백
  &.selected {
    border: 2px solid var(--primary);
    transform: scale(1.02);
    transition: transform 0.15s ease;
  }
  // 터치 시 햅틱 피드백 (CSS로는 안 되지만 구조 대비)
}
```

### 4-3. 모바일 전용 UX 패턴

| 패턴 | 구현 | 근거 |
|------|------|------|
| 바텀시트 | 질환 상세 정보 -> 하단에서 올라오는 시트 | 모바일에서 모달보다 자연스러움 |
| 스와이프 | 질환 카드 좌우 스와이프 | 카카오 인앱 브라우저 사용자 익숙 |
| 스틱 헤더 | 건강나이 delta 고정 상단 | 스크롤 시에도 핵심 결과 보임 |
| 풀 투 리프레시 | 서버 정밀 재계산 트리거 | 모바일 네이티브 패턴 |
| 토스트 | "5세 젊어졌어요!" 간결 피드백 | 바텀 토스트로 결과 요약 |

### 4-4. 성능 고려

- 클라이언트 계산이므로 3G에서도 즉시 반응 (서버 호출 0)
- ratio_table 크기: ~2-3KB JSON (16 질환 x 6 인자 = ~96 항목)
- React 상태 업데이트: `useMemo` + `useCallback`으로 불필요한 리렌더 방지
- 차트 애니메이션: `requestAnimationFrame` 기반 (60fps)

---

## 5. API 스키마 변경

### 5-1. SimulateRequest 확장 (Phase 2)

```diff
 class SimulateRequest(BaseModel):
     bmi_target: Optional[float] = Field(None, ge=15.0, le=45.0)
     weight_delta_kg: Optional[float] = Field(None, ge=0.0, le=100.0)
     smoking_target: Optional[Literal["current", "quit"]] = None
     drinking_target: Optional[Literal["none"]] = None
+    exercise_target: Optional[float] = Field(None, ge=0.0, le=7.0)
+    diet_target: Optional[Literal["low_sodium", "normal"]] = None
     time_horizon_months: Literal[0, 6, 12, 60] = 0
     force: bool = False
```

**하위 호환**: 신규 필드 모두 Optional + None 기본값. 기존 클라이언트 영향 없음.

### 5-2. 리포트 응답 확장 (Phase 3)

```diff
 GET /mediarc-report/{uuid}?include_ratio_table=true

 응답 body:
 {
   "report_data": { ... },           // 기존 그대로
+  "ratio_table": {                  // 신규 (include_ratio_table=true 일 때만)
+    "base": { ... },
+    "deltas": { ... },
+    "attenuation": { ... }
+  }
 }
```

**하위 호환**: 쿼리 파라미터 없으면 ratio_table 미포함. 기존 응답 변화 없음.

### 5-3. 영양소 추천 응답 확장 (Phase 4)

```diff
 NutritionService.recommend() 응답:
 {
   "recommend": [
     {
       "name": "오메가3",
       "tag": "#혈관건강",
       "desc": "...",
-      "caution_text": null,
+      "caution_text": "혈압약(암로디핀) 복용 시 자몽 추출물 주의",
+      "drug_interactions": [
+        {
+          "medication": "암로디핀",
+          "severity": "caution",
+          "description": "자몽 추출물이 약물 대사를 방해할 수 있습니다"
+        }
+      ]
     }
   ],
+  "excluded_by_interaction": [      // 금기로 제외된 영양소
+    {"name": "비타민K", "medication": "와파린", "severity": "contraindicated"}
+  ]
 }
```

**하위 호환**: `drug_interactions` 필드 추가. 기존 FE는 이 필드를 무시하므로 영향 없음.

---

## 6. 워커 분배 + 잠금 매트릭스

### 6-1. 워커 할당

| 워커 | Phase | 범위 | 수정 파일 | 잠금 |
|------|-------|------|----------|------|
| **BE-1** | 2 | 운동/식습관 엔진 확장 | `engine.py` (classify_risk_factors, compute_milestone_scenario) | engine.py 독점 |
| **BE-2** | 3 | ratio_table 응답 추가 | `partner_office.py`, `facade.py` | partner_office.py 독점 |
| **BE-3** | 4 | 약물 상호작용 활성화 | `nutrition_service.py` | nutrition_service.py 독점 |
| **FE-1** | 2 | 인터랙티브 플래너 UI | `HealthPlannerPanel.tsx` (신규), 하위 컴포넌트 | FE 컴포넌트 독점 |
| **FE-2** | 3 | useHealthPlanner 훅 | `useHealthPlanner.ts` (신규) | 훅 파일 독점 |
| **FE-3** | 4 | 약물 입력 + 경고 UI | `MedicationInput.tsx` (신규), `NutritionCard.tsx` 수정 | 약물 관련 독점 |
| **SCSS** | 공통 | 플래너/약물 스타일 | `_health-planner.scss` (신규), `_medication.scss` (신규) | SCSS 독점 |

### 6-2. 파일 잠금 매트릭스 (동시 수정 금지)

| 파일 | BE-1 | BE-2 | BE-3 | FE-1 | FE-2 | FE-3 |
|------|:----:|:----:|:----:|:----:|:----:|:----:|
| engine.py | W | R | - | - | - | - |
| partner_office.py | - | W | - | - | - | - |
| facade.py | - | W | R | - | - | - |
| nutrition_service.py | - | - | W | - | - | - |
| HealthPlannerPanel.tsx | - | - | - | W | R | - |
| useHealthPlanner.ts | - | - | - | R | W | - |
| MedicationInput.tsx | - | - | - | - | - | W |

W = 쓰기(잠금), R = 읽기만, - = 무관

### 6-3. 실행 순서 (의존성 기반)

```
Phase 2:  BE-1 (엔진 확장) --> FE-1 (UI) [병렬 가능: BE-1 stub 제공 후]
Phase 3:  BE-2 (ratio_table) --> FE-2 (훅) [순차]
Phase 4:  BE-3 (상호작용) --> FE-3 (약물 UI) [순차]
SCSS:     FE-1/FE-3와 병렬 가능 (별도 파일)
```

---

## 7. 의존성 DAG

```
Phase 2-B (BE 엔진 확장)
  |
  +---> Phase 2-A (FE 플래너 UI)
  |       |
  |       +---> Phase 2-C (결과 시각화)
  |
  +---> Phase 3 (ratio_table)
          |
          +---> Phase 3 FE (useHealthPlanner)
                  |
                  +---> [배포 1차: Phase 2+3 통합]
                          |
                          +---> Phase 4-B (BE 상호작용)
                                  |
                                  +---> Phase 4-A (FE 약물 입력)
                                  |
                                  +---> Phase 4-C (FE 경고 표시)
                                          |
                                          +---> [배포 2차: Phase 4]

외부 의존성:
  - Phase 2-B: 운동/식습관 효과 논문 PMID 확인 (WebSearch 필요)
  - Phase 4-B: 약물-영양소 상호작용 RAG 문서 357종 FAISS 적재
```

---

## 8. 수용 기준

### Phase 2 수용 기준

- [ ] `exercise_target`, `diet_target` 파라미터가 SimulateRequest에 추가되어 있다
- [ ] engine.py `compute_milestone_scenario()`가 운동/식습관 효과를 계산한다
- [ ] 운동 효과의 혈압 보정값이 PMID 실확인된 논문 근거에 기반한다
- [ ] FE에 HealthPlannerPanel이 렌더링되고, 모든 컨트롤(체중/금연/금주/운동/식습관/시간축)이 동작한다
- [ ] 모바일(375px)에서 1열 레이아웃으로 정상 표시된다
- [ ] 카드 선택형 컨트롤의 터치 영역이 44px 이상이다
- [ ] Before/After 비교가 질환별로 표시된다
- [ ] 기존 simulate API의 하위 호환이 유지된다 (exercise_target/diet_target 없어도 동작)

### Phase 3 수용 기준

- [ ] GET /mediarc-report/{uuid}?include_ratio_table=true 응답에 ratio_table이 포함된다
- [ ] useHealthPlanner 훅이 ratio_table 기반 클라이언트 계산을 수행한다
- [ ] 슬라이더 조작 시 서버 호출 없이 즉시(0ms) 결과가 반영된다
- [ ] 클라이언트 계산 결과와 서버 정밀 계산 결과의 오차가 5% 이내이다
- [ ] ratio_table이 localStorage에 캐시되고, 24시간 TTL이 적용된다
- [ ] 건강나이 카운트 애니메이션이 60fps로 동작한다

### Phase 4 수용 기준

- [ ] 약물 자유 텍스트 입력 + 자동완성이 동작한다
- [ ] nutrition_service Step 3가 medications 배열을 처리한다
- [ ] FAISS에서 약물-영양소 상호작용 문서가 검색된다
- [ ] 금기(contraindicated) 영양소가 추천 목록에서 제외된다
- [ ] 주의(caution) 영양소에 경고 배너가 표시된다
- [ ] 기존 medications=[] 일 때 동작이 변하지 않는다 (하위 호환)
- [ ] 모바일에서 약물 카드 스와이프 삭제가 동작한다

### 공통 수용 기준

- [ ] 모든 API 변경이 하위 호환성을 유지한다 (기존 FE 깨지지 않음)
- [ ] 의학적 소견/진단 표현이 없다 ("~할 수 있어요", "~에 도움이 돼요" 톤 유지)
- [ ] 논문 인용 시 PMID/DOI가 명시되어 있다 (AI 출처 날조 방지)
- [ ] dev-reviewer 검증 PASS 후에만 배포한다
- [ ] E2E 테스트 (frontend/e2e) 기존 케이스가 통과한다

---

## 부록: 페르소나 파이프라인 (별도 기획)

사장님 지시 중 "그때그때 입력받거나 저장하는 파이프라인"은 이번 기획서 범위 밖입니다.
별도 기획서로 분리 예정:

- 모바일 문진 -> 페르소나 판정 -> DB 저장
- 리포트/건기식에 페르소나 활용
- 검진설계(checkup_design) 서비스와 연동
