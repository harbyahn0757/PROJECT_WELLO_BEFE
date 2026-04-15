# mediArc 리포트 Phase 0 — 엔진-FE 중계 복구 실행 스펙

> 작성일: 2026-04-14
> 작성자: dev-planner
> 상위 문서: `docs/mediarc-report-deepdive.md` (6장/7장)
> 실행 방식: dev-coder A(facade.py) / dev-coder B(useMediarcApi.ts) 병렬
> 제약: 엔진 로직 동결, 기존 ReportData 필드 삭제/이름변경 금지(추가만 허용)

---

## 1장. 범위와 목적

### 1.1 Phase 0 가 해결하는 것

- facade.py 가 FE 로 돌려주는 응답 dict 의 `patient_info` 를 확장해 운영자 메타 패널(imputed_fields / missing_fields) 을 채울 수 있게 한다.
- FE `ReportData` TypeScript 인터페이스에 `improved` / `disease_ages` / `DiseaseDetail` 확장 / `PatientInfo` 등 신규 optional 타입을 추가해, 리포트 뷰 컴포넌트(Phase 1)가 TS 레벨에서 엔진 실데이터에 접근 가능하게 한다.
- 타입 좁힘으로 회귀가 없도록 기존 사용처를 재검증한다.

### 1.2 Phase 0 가 해결하지 않는 것

- 리포트 뷰 컴포넌트(ReportView / BeforeAfterBlock / DiseaseFactorTable 등) 추가 — Phase 1 별도 스펙.
- facade.py 응답 구조 전면 재설계 — Phase 2 이후.
- engine.py 로직 수정(imputed_fields 를 엔진에서 노출) — Phase 2 이후 별도 기획. 이번 Phase 0 는 facade 가 빈 배열 기본값으로 채운다.

### 1.3 입력/출력 정의

| 항목 | 입력 | 출력 |
|---|---|---|
| facade.py | `run_for_patient(name, patient_dict)` 의 raw dict | `ReportData` schema dict (기존 12키 유지 + `patient_info` 내부 2키 추가) |
| useMediarcApi.ts | `/partner-office/mediarc-report/{uuid}` 응답 JSON | `Promise<ReportData>` (타입만 확장, 기존 필드 유지) |

---

## 2장. 현황 팩트 (스펙 작성 전 재검증)

### 2.1 facade.py 현재 반환 (실독 기반)

`backend/app/services/report_engine/facade.py:134-147`:

```python
return {
    "name": name,
    "age": age_val,
    "sex": raw.get("sex"),
    "group": raw.get("group"),
    "bodyage": {"bodyage": bodyage_val, "delta": delta_val, "bioage_gb": bioage_gb_result},
    "rank": raw.get("bodyage_rank"),
    "diseases": raw.get("diseases", {}),
    "gauges": raw.get("gauges", {}),
    "improved": raw.get("improved", {}),
    "disease_ages": raw.get("disease_ages", {}),
    "patient_info": {"age": age_val, "sex": raw.get("sex"), "group": raw.get("group")},
    "nutrition": nutrition_result,
}
```

- `improved`, `disease_ages` 는 이미 pass-through 중. 딥다이브 6.2 정정 근거와 일치.
- `patient_info` 는 `age/sex/group` 3키만 있고 `imputed_fields` / `missing_fields` 없음.

### 2.2 useMediarcApi.ts 기존 `ReportData` 인터페이스 원문

`backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts:40-51`:

```ts
export interface ReportData {
  name: string;
  age: number;
  sex: string;
  group: string;
  bodyage: BodyAge;
  rank: number;
  diseases: Record<string, { rank: number; rate?: number }>;
  nutrition: { recommend: NutrientItem[]; caution?: NutrientItem[] } | null;
  gauges: { all: Record<string, GaugeItem> } | null;
  patient_info: Record<string, any>;
}
```

- `diseases` 값 타입이 `{ rank, rate? }` 로 좁혀져 있어 `applied_factors` / `chips` / `five_year` / `improved_*` 접근 시 TS 에러.
- `improved` / `disease_ages` 필드 자체가 없음 → `report.improved?.will_rogers` 타입 미존재.
- `patient_info: Record<string, any>` 는 현재 너무 느슨 → `PatientInfo` 로 좁힌다.

### 2.3 engine.py `Report.run()` 반환 top-level 키 (실독 근거)

`p9_mediArc_engine/demo/engine.py:1489-1504` 리턴 dict 에 존재하는 키:

- `name`, `age`, `sex`, `group`
- `diseases` (각 질환 dict: `rank`, `rate`, `individual_rr`, `cohort_mean_rr`, `ratio`, `grade`, `chips`, `chips_present`, `chips_total`, `five_year`, `applied_factors`, 그리고 engine line 1464-1470 근거)
- `bodyage`, `bodyage_delta`, `bodyage_rank`
- `disease_ages`
- `improved` (하위에 `will_rogers` 포함 — line 1263)
- `gauges`

**engine.py 에서 top-level 로 반환하지 않는 키** (facade 가 채워야 하는 키):

- `imputed_fields` — engine 내부 `imputed["_imputed_fields"]` (line 348-353) 는 존재하나, `Report.run()` 반환 dict 에는 포함 안 됨.
- `missing_fields` — engine 에 개념 자체 없음.

**결론**: facade 는 `raw.get("imputed_fields", [])` 가 항상 `[]` 로 떨어진다. Phase 0 는 **빈 배열 기본값을 보장하는 게이트만** 담당. 실제 값 채우기는 엔진 수정을 수반하는 Phase 2+ 작업이다.

### 2.4 기존 `patient_info` 사용처 (grep 결과)

명령:
```bash
cd PROJECT_WELNO_BEFE/planning-platform/backoffice
grep -rn "patient_info" src/
```

결과 (2026-04-14 기준):

```
src/pages/HealthReportPage/hooks/useMediarcApi.ts:50:  patient_info: Record<string, any>;
src/pages/EmbeddingPage/index.tsx:845:... chat.initial_data?.patient_info?.name ...
src/pages/EmbeddingPage/index.tsx:846:... chat.initial_data?.patient_info?.gender ...
src/pages/EmbeddingPage/index.tsx:847:... chat.initial_data?.patient_info?.birth_date ...
src/pages/EmbeddingPage/index.tsx:848:... chat.initial_data?.patient_info?.contact ...
```

- `EmbeddingPage` 의 `patient_info` 는 `chat.initial_data.patient_info` 경로로 **채팅 세션 컨텍스트의 patient_info 이지 ReportData.patient_info 가 아니다**. 타입 원천도 다름 → `ReportData.patient_info` 를 좁혀도 EmbeddingPage 영향 없음.
- `HealthReportPage` 내부에서는 `patient_info` 필드를 렌더에 쓰지 않는다 (`HealthReportPage/index.tsx` grep 결과 0건, 타입 선언 줄 제외).

### 2.5 `ReportData` import 사용처 (grep 결과)

```
src/pages/HealthReportPage/index.tsx:13:  ReportData,
src/pages/HealthReportPage/index.tsx:66:  const [report, setReport] = useState<ReportData | null>(null);
src/pages/HealthReportPage/index.tsx:291:  report: ReportData;
```

- `HealthReportPage` 단일 페이지에서만 사용. 다른 페이지 영향 없음.
- `useMediarcApi` import 도 `HealthReportPage/index.tsx:17` 1곳만.

### 2.6 Phase 0 사전 가정 체크리스트

- [x] engine.py `Report.run()` 은 `improved`, `disease_ages`, `diseases[*].applied_factors/chips/five_year` 를 이미 반환한다.
- [x] facade.py 는 `improved`, `disease_ages` 를 pass-through 중, `patient_info` 만 축소 반환 중.
- [x] FE `ReportData` 는 `improved` / `disease_ages` / `DiseaseDetail 확장` / `PatientInfo` 타입이 없다.
- [x] `ReportData.patient_info` 의 runtime 소비처는 HealthReportPage 내부에 없다.
- [x] `patient_info` grep 상 EmbeddingPage 등은 다른 타입 원천(`chat.initial_data`)을 쓴다.

---

## 3장. dev-coder A 담당 (facade.py)

### 3.1 수정 파일

- `PROJECT_WELNO_BEFE/planning-platform/backend/app/services/report_engine/facade.py`

### 3.2 변경 사항 (diff 수준)

변경 범위: L145 의 `patient_info` dict literal 1곳만.

#### 변경 전 (L145)
```python
"patient_info": {"age": age_val, "sex": raw.get("sex"), "group": raw.get("group")},
```

#### 변경 후 (8-10줄, 기존 키 순서 유지)
```python
"patient_info": {
    "age": age_val,
    "sex": raw.get("sex"),
    "group": raw.get("group"),
    # engine.py 가 현재 Report.run() 반환 dict 에 이 키를 노출하지 않으므로
    # raw.get("imputed_fields", []) 는 항상 []. Phase 0 는 타입 게이트만 보장.
    # Phase 2+ 에서 engine 이 이 키를 노출하면 자동 pass-through 됨.
    "imputed_fields": raw.get("imputed_fields", []),
    "missing_fields": raw.get("missing_fields", []),
},
```

- **나머지 11개 키 (name/age/sex/group/bodyage/rank/diseases/gauges/improved/disease_ages/nutrition) 순서/이름 전부 유지**.
- 주석 포함 실 변경 라인 약 8-10줄. 주석 제외 시 6줄.
- `raw.get(..., [])` 기본값은 list 로 고정 — None 금지 (FE 가 spread/length 접근 가능해야 함).

### 3.3 수용 조건

1. `python3 -c "import ast; ast.parse(open('app/services/report_engine/facade.py').read())"` OK (종료 코드 0).
2. `generate_report(test_patient)` 반환 dict 에 다음 12 키 존재: `name, age, sex, group, bodyage, rank, diseases, gauges, improved, disease_ages, patient_info, nutrition`.
3. 반환 dict 의 `patient_info` 에 정확히 5 키 존재: `age, sex, group, imputed_fields, missing_fields`.
4. `imputed_fields` 와 `missing_fields` 는 항상 `list` 타입 (engine 미노출 시 `[]`).
5. 기존 엔드포인트 `GET /partner-office/mediarc-report/{uuid}` 응답 JSON 에 새 2 키 포함, 기존 키 손실 0.
6. ENGINE_AVAILABLE=False 분기(L80-81 `return {}`) 는 건드리지 않는다 — 빈 dict 그대로 반환 유지.

### 3.4 검증 명령

```bash
cd /Users/harby/0_workspace/PEERNINE/PROJECT_WELNO_BEFE/planning-platform/backend

# AST 검증
python3 -c "import ast; ast.parse(open('app/services/report_engine/facade.py').read())" && echo "AST OK"

# 반환 키 smoke (로컬 uvicorn 불필요 — 직접 호출)
python3 - <<'PY'
import sys
sys.path.insert(0, '.')
from app.services.report_engine.facade import generate_report

# 최소 입력 (age/sex 필수, 나머지는 engine 내부에서 None-safe)
r = generate_report({
    "_name": "테스트",
    "age": 43, "sex": "M", "bmi": 22.0, "sbp": 120, "dbp": 75, "fbg": 90,
    "height": 170, "weight": 65, "waist": 80, "hemoglobin": 14.0,
    "tc": 180, "hdl": 50, "ldl": 110, "tg": 100,
    "ast": 20, "alt": 20, "ggt": 20, "cr": 1.0, "gfr": 100,
})
assert set(r.keys()) >= {"name","age","sex","group","bodyage","rank","diseases",
                         "gauges","improved","disease_ages","patient_info","nutrition"}, r.keys()
pi = r["patient_info"]
assert set(pi.keys()) >= {"age","sex","group","imputed_fields","missing_fields"}, pi.keys()
assert isinstance(pi["imputed_fields"], list), type(pi["imputed_fields"])
assert isinstance(pi["missing_fields"], list), type(pi["missing_fields"])
print("facade smoke OK", pi)
PY
```

- 로컬에 engine.pkl 이 없으면 bioage_gb 는 None 이 되지만, patient_info 확장은 영향 없음.
- 스모크 실패 시 즉시 dev-reviewer 에 보고 후 원복.

### 3.5 커밋 메시지 초안

```
feat(backend): mediArc facade patient_info 에 imputed/missing 게이트 추가

Phase 0: FE 운영자 메타 패널이 imputed_fields/missing_fields 에
접근할 수 있도록 facade 반환 dict 에 키를 추가한다.

engine.py 는 Report.run() 반환에 이 키를 노출하지 않으므로
현 시점에는 raw.get(..., []) 기본값이 항상 [] 로 떨어진다.
Phase 2+ 에서 engine 이 이 키를 노출하면 자동 pass-through 된다.

기존 11개 키(name/age/.../nutrition) 순서/이름 무변경.
```

---

## 4장. dev-coder B 담당 (useMediarcApi.ts + 사용처 확인)

### 4.1 수정 파일

- `PROJECT_WELNO_BEFE/planning-platform/backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts`

### 4.2 추가할 TypeScript 타입

다음 인터페이스를 신규 export 로 **추가**(기존 인터페이스 삭제/이름변경 0).

```ts
// ── 신규 타입 (모두 optional 필드로 구성) ──

export interface DiseaseChip {
  name: string;
  present: boolean;
}

export interface AppliedFactor {
  /** engine applied_factors 의 키 — engine 버전에 따라 factor 또는 name 로 나올 수 있어 둘 다 optional */
  factor?: string;
  name?: string;
  /** 상대위험도 */
  rr: number;
  pmid?: string;
  source?: string;
  confidence?: string;
}

export interface WillRogersEntry {
  orig_ratio: number;
  improved_ratio: number;
  orig_rank: number;
  improved_rank: number;
  rank_change: number;
  arr_pct: number;
  cohort_fixed: boolean;
}

export interface ImprovedScenario {
  labels?: {
    bmi?: string;
    smoking?: string;
    drinking?: string;
    [k: string]: string | undefined;
  };
  improved_sbp?: number;
  improved_dbp?: number;
  improved_fbg?: number;
  ratios?: Record<string, number>;
  five_year_improved?: Record<string, number[]>;
  will_rogers?: Record<string, WillRogersEntry>;
  has_improvement?: boolean;
}

export interface PatientInfo {
  /** 기존 3키는 facade 가 항상 채워주므로 non-optional 유지 가능하지만,
   *  하위호환을 위해 전부 optional 로 선언 — FE 가 graceful 로 안전 */
  age?: number;
  sex?: string;
  group?: string;
  imputed_fields?: string[];
  missing_fields?: string[];
}

/** bioage_gb 서브 결과. pkl 미로드 시 null */
export interface BioageGbResult {
  bioage_gb?: number;
  score?: number;
  percentile?: number;
  [k: string]: any;
}
```

### 4.3 기존 인터페이스 확장

#### 4.3.1 `BodyAge` 에 `bioage_gb` 추가

```ts
export interface BodyAge {
  bodyage: number;
  delta: number;
  bioage_gb?: BioageGbResult | null;  // 추가 (optional)
}
```

#### 4.3.2 `DiseaseDetail` 신규 export + ReportData 내부 참조

현재 `diseases` 값 타입은 인라인 `{ rank: number; rate?: number }`. 다음 순서로 확장:

1. 신규 interface `DiseaseDetail` 를 export.
2. `ReportData.diseases` 를 `Record<string, DiseaseDetail>` 로 교체.

```ts
export interface DiseaseDetail {
  // 기존 필드 (유지)
  rank: number;
  rate?: number;

  // 신규 optional 필드 — engine 이 반환하지만 FE 는 graceful
  individual_rr?: number;
  cohort_mean_rr?: number;
  ratio?: number;
  grade?: string;
  chips?: DiseaseChip[];
  chips_present?: number;
  chips_total?: number;
  five_year?: number[];
  applied_factors?: AppliedFactor[];

  // 질환별 improved (improved.will_rogers 와 중복 가능, 둘 다 optional)
  improved_ratio?: number;
  improved_rank?: number;
  rank_change?: number;
  arr_pct?: number;
}
```

- **하위호환**: 기존 `{ rank: number; rate?: number }` 사용처(HealthReportPage index.tsx:291 등)는 `DiseaseDetail` 로도 동일하게 접근 가능 (`rank` 필수, `rate?` optional). TS 구조적 타이핑상 회귀 0.

#### 4.3.3 `ReportData` 필드 추가

```ts
export interface ReportData {
  name: string;
  age: number;
  sex: string;
  group: string;
  bodyage: BodyAge;
  rank: number;
  diseases: Record<string, DiseaseDetail>;  // 타입만 확장 — 기존 rank/rate 접근 유지
  nutrition: { recommend: NutrientItem[]; caution?: NutrientItem[] } | null;
  gauges: { all: Record<string, GaugeItem> } | null;
  patient_info: PatientInfo;  // Record<string, any> → PatientInfo 로 좁힘

  // 신규 optional 필드
  improved?: ImprovedScenario;
  disease_ages?: Record<string, number>;
}
```

**유지 조건**:
- `patient_info` 를 `Record<string, any>` → `PatientInfo` 로 좁힘. 2.4 grep 결과 상 `ReportData.patient_info` 의 런타임 소비처가 없으므로 회귀 0. 
- EmbeddingPage 의 `chat.initial_data.patient_info` 는 별도 타입(ReportData 무관) → 영향 없음.
- 기존 `name/age/sex/group/bodyage/rank/nutrition/gauges` 8개 필드 이름/optional 여부 무변경.

### 4.4 사용처 영향 확인 (dev-coder B 가 수정 전/후 수행)

```bash
cd /Users/harby/0_workspace/PEERNINE/PROJECT_WELNO_BEFE/planning-platform/backoffice

# 1) ReportData.patient_info 직접 소비처 (좁힘 회귀 검사)
grep -rn "patient_info" src/

# 2) ReportData import 사용처 (확장 영향 범위)
grep -rn "ReportData" src/

# 3) useMediarcApi 훅 import
grep -rn "useMediarcApi" src/

# 4) diseases[*].rank / diseases[*].rate 사용처 (기존 좁은 타입 의존 재검사)
grep -rn "diseases\[" src/
grep -rnE "\.diseases\s*\." src/
```

예상 결과 (2026-04-14 grep 기반):
- `patient_info`: 5건 — useMediarcApi.ts 정의 1건 + EmbeddingPage `chat.initial_data.patient_info` 4건. EmbeddingPage 는 별도 타입 원천이므로 좁힘 영향 없음.
- `ReportData`: 5건 — useMediarcApi.ts 2건 + HealthReportPage/index.tsx 3건. HealthReportPage 외 없음.
- `useMediarcApi`: 1건 — HealthReportPage/index.tsx:17.
- `diseases` 접근은 HealthReportPage 내부 DetailContent 에서 `d.rank` / `d.rate` 위주 — `DiseaseDetail` 로 확장해도 구조적 호환.

### 4.5 수용 조건

1. `npx tsc --noEmit --skipLibCheck` 에러 0 건 (기존 에러 3건 허용 범위 안, 신규 에러 0).
2. `npm run build` (backoffice) 성공.
3. 4.4 grep 결과가 스펙 예상값과 일치 (수정 전 캡처 / 수정 후 회귀 비교).
4. HealthReportPage 런타임 회귀 0: 로컬 dev 서버 기동 후 환자 목록 / Drawer 서브탭 4종 렌더 동일 (콘솔 에러 0).
5. 신규 타입 접근 가능 smoke (dev-coder B 가 로컬 파일에서만 확인, 커밋 하지 않음):
   ```ts
   const r: ReportData = /* ... */;
   r.improved?.will_rogers?.["당뇨"]?.arr_pct;   // TS 통과
   r.diseases["당뇨"].applied_factors?.[0]?.pmid; // TS 통과
   r.patient_info.imputed_fields?.length;          // TS 통과
   r.disease_ages?.["뇌"];                         // TS 통과
   ```

### 4.6 커밋 메시지 초안

```
feat(backoffice): mediArc ReportData 타입 Phase 0 확장

Phase 0: 리포트 뷰 컴포넌트(Phase 1) 가 엔진 실데이터에
TS 레벨로 안전 접근하도록 타입만 확장. 기존 필드 전부 유지.

추가: DiseaseChip/AppliedFactor/WillRogersEntry/ImprovedScenario/
      PatientInfo/BioageGbResult/DiseaseDetail
확장: BodyAge.bioage_gb?, ReportData.improved?/disease_ages?
좁힘: ReportData.patient_info Record<string,any> → PatientInfo
      (HealthReportPage 에서 patient_info 소비 0건 확인, EmbeddingPage 는 별도 타입)

기존 필드 삭제 0 · 이름변경 0 · 런타임 회귀 0.
```

---

## 5장. 회귀 범위

### 5.1 백엔드

- `services/mediarc/` (Twobecon 레거시) — 미변경. 호출 인터페이스 동일.
- `app/api/v1/endpoints/partner_office.py` 의 `/mediarc-report/{uuid}` 엔드포인트 — 반환 스키마 superset. 기존 키 손실 0.
- `report_engine/engine.py`, `nutrition_rules.py`, `reference_data.py` — 미변경.
- `report_engine/facade.py` `run()`, `compute_stats()`, `warmup()` — 미변경 (`generate_report()` 내부의 `patient_info` dict 만 확장).

### 5.2 프론트엔드

- `HealthReportPage/index.tsx` — 미변경. `ReportData` 참조는 구조적 호환.
- `HealthReportPage/hooks/useMediarcApi.ts` — 이 파일만 수정.
- 타 8 페이지 (EmbeddingPage 포함) — `ReportData` import 없음 or 다른 타입 원천. 영향 없음.

### 5.3 iframe 계약

- `/partner-office/*` 쿼리 파라미터, URL 경로 무변경.
- 응답 body 확장(superset) — iframe 소비자는 몰라도 되는 필드. 기존 읽던 키 전부 유지.

### 5.4 데이터 계약

- DB 스키마 변경 0.
- Redis/캐시 키 변경 0.
- engine pkl/json 변경 0.

---

## 6장. 롤백 계획

### 6.1 묶음 단위

- 백엔드 1 커밋 (facade.py) + 프론트 1 커밋 (useMediarcApi.ts) 로 **분리**. 두 코더가 독립 커밋.
- 둘 다 문제 없을 경우 하나의 PR 로 squash 또는 개별 push.

### 6.2 원복 절차

#### 백엔드만 문제
```bash
git revert <facade-commit>
sudo -u welno pm2 restart WELNO_BE
```

#### 프론트만 문제
```bash
git revert <useMediarcApi-commit>
# backoffice 는 정적 빌드 — 재배포 필요
cd backoffice && npm run build
# static 반영 절차는 welno-deploy.md 참조
```

#### 전체 원복
```bash
git revert <facade-commit> <useMediarcApi-commit>
# 서버: git pull → pm2 restart WELNO_BE → backoffice static 재반영
```

### 6.3 재배포 순서 (복구 확인)

1. WELNO_BE pm2 restart 후 `/welno-api/v1/partner-office/mediarc-report/engine/stats` 200.
2. 임의 환자 uuid 로 `/mediarc-report/{uuid}` 호출, 기존 12 키 모두 존재 확인.
3. backoffice 접속 → 건강리포트 탭 정상 렌더 (콘솔 에러 0).

---

## 7장. 배포 전 체크리스트

- [ ] facade.py AST 검증 OK (`python3 -c "import ast; ast.parse(open(...).read())"`)
- [ ] facade smoke 스크립트 성공 (3.4 절 PY 블록)
- [ ] `npx tsc --noEmit --skipLibCheck` 에러 증가 0
- [ ] `npm run build` (backoffice) exit 0
- [ ] 4.4 grep 결과가 2.4 / 2.5 기준과 일치 (patient_info 소비처 / ReportData 소비처)
- [ ] `/partner-office/mediarc-report/{uuid}` 응답 JSON 에 `patient_info.imputed_fields`, `patient_info.missing_fields` 2 키 포함
- [ ] 기존 12 top-level 키 손실 0 (name/age/sex/group/bodyage/rank/diseases/gauges/improved/disease_ages/patient_info/nutrition)
- [ ] HealthReportPage 로컬 기동 시 환자 목록 + Drawer 서브탭 4종 렌더 회귀 0
- [ ] EmbeddingPage 렌더 회귀 0 (별도 타입 원천이라 이론상 영향 없으나 타입 빌드 레벨 재확인)
- [ ] ConsultationPage 등 기타 페이지 영향 없음 재확인
- [ ] 3.5 / 4.6 커밋 메시지 초안 준비 완료
- [ ] dev-reviewer 통합 견제 PASS

---

## 8장. 배포 절차

`memory/welno-deploy.md` + `.claude/rules/ops-workflow.md` 2홉 SSH 표준 패턴 기준.

### Step 1: 로컬 빌드

```bash
cd /Users/harby/0_workspace/PEERNINE/PROJECT_WELNO_BEFE/planning-platform
# 프론트 + 백오피스 + 위젯 통합 빌드 (npm run deploy:simple 는 frontend 기준이므로 backoffice 는 별도)
cd backoffice && npm run build && cd ..
cd frontend && npm run deploy:simple && cd ..
```

- backoffice 빌드 산출물이 backend/static/backoffice 또는 해당 경로에 반영되는지 확인(welno-deploy.md 기준).

### Step 2: git 커밋 + push

```bash
cd /Users/harby/0_workspace/PEERNINE/PROJECT_WELNO_BEFE
git add planning-platform/backend/app/services/report_engine/facade.py
git add planning-platform/backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts
git add planning-platform/backend/static/  # backoffice 빌드 산출물 (경로는 welno-deploy.md 확인)
git commit  # 3.5 + 4.6 메시지 병합 또는 개별 커밋 유지
git push origin main
```

### Step 3: 서버 배포 (2홉 SSH, sshpass + ProxyCommand)

`.claude/rules/ops-workflow.md` SSH 표준 패턴 적용:

```bash
sshpass -p '<TARGET_PW>' ssh \
  -o ProxyCommand='sshpass -p "<JUMP_PW>" ssh -W %h:%p -o StrictHostKeyChecking=no root@223.130.142.105' \
  -o StrictHostKeyChecking=no \
  root@10.0.1.6 'bash -s' <<'EOF'
cd /home/welno/workspace/PROJECT_WELNO_BEFE
sudo -u welno git pull origin main
sudo -u welno pm2 restart WELNO_BE
sudo -u welno pm2 restart WELNO_FE
sudo -u welno pm2 logs WELNO_BE --lines 20 --nostream
EOF
```

- `expect` 스크립트 금지 (ops-workflow.md 2026-04-14 규칙).
- pm2 restart 후 20줄 로그로 crash loop 여부 즉시 확인.

### Step 4: 배포 후 smoke

```bash
# engine/stats 200
curl -sS -o /dev/null -w "%{http_code}\n" \
  https://welno.kindhabit.com/welno-api/v1/partner-office/mediarc-report/engine/stats

# 임의 환자 uuid 로 report 200 + patient_info 신규 키 확인
curl -sS "https://welno.kindhabit.com/welno-api/v1/partner-office/mediarc-report/<UUID>" \
  | python3 -c "import sys,json;r=json.load(sys.stdin);pi=r.get('patient_info',{});\
print('keys=',sorted(pi.keys()));\
assert 'imputed_fields' in pi and 'missing_fields' in pi, pi;\
print('OK')"
```

- 두 키가 없으면 즉시 롤백 (6장).
- 브라우저에서 `https://welno.kindhabit.com/backoffice` → 건강리포트 탭 접속 → 환자 1명 Drawer 오픈 → 콘솔 에러 0건 확인.

### Step 5: ops-verifier 넘기기

- 로그 20줄 스냅샷, smoke curl 결과, 브라우저 스크린샷(또는 콘솔 로그 캡처) 3종 첨부해 ops-verifier 에게 최종 PASS/WATCH 판정 요청.

---

## 9장. 다음 스폰 계획

| 순서 | 에이전트 | 담당 | 산출물 |
|---|---|---|---|
| 1-A (병렬) | dev-coder A | 3장 (facade.py) | backend/app/services/report_engine/facade.py 커밋 |
| 1-B (병렬) | dev-coder B | 4장 (useMediarcApi.ts + 사용처 grep) | backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts 커밋 |
| 2 | dev-reviewer | 통합 견제 | 3장 수용 조건 / 4장 수용 조건 / 5장 회귀 범위 재검증 리포트 |
| 3 | ops-team (planner+deployer) | 8장 배포 절차 | git push + 2홉 SSH + pm2 restart + smoke 4종 |
| 4 | ops-verifier | 배포 후 검증 | /engine/stats + /{uuid} + 브라우저 smoke + 로그 PASS/WATCH 판정 |

**병렬 실행 가능성**: YES. 두 파일은 언어 / 레이어 / 빌드 파이프라인이 완전 분리. 파일 잠금 분리 선언 후 동시 작업 OK.

---

## 10장. 이번에 하지 않는 것

- 리포트 뷰 컴포넌트 (`ReportView`, `ShockBlock`, `BeforeAfterBlock`, `DiseaseFactorTable` 등) 추가 — Phase 1 별도 스펙.
- facade 응답 구조 재설계 (키 이름 변경 / 그룹화) — Phase 2.
- engine.py 로직 수정 (imputed_fields 실제 노출) — Phase 2 이상, 엔진팀과 조율 후 별도 기획.
- SCSS `_report-view.scss` 추가 — Phase 1.
- Drawer width `lg` → `xl` 변경 — Phase 1.
- TwobeconGridView 부록 통합 — Phase 1 후반.
- TrendPreview / MilestonePreview 플레이스홀더 — Phase 3+.

---

## 부록 A. Phase 0 체크리스트 요약 (1페이지)

```
[dev-coder A]
  [ ] facade.py L145 patient_info 확장 (8-10줄)
  [ ] python3 -c "ast.parse(...)" OK
  [ ] facade smoke: 12 top-level 키 + patient_info 5 키 + list 타입
  [ ] 커밋 1

[dev-coder B]
  [ ] useMediarcApi.ts 타입 7종 신규 export
  [ ] BodyAge.bioage_gb? 추가
  [ ] DiseaseDetail 신규 export + ReportData.diseases 교체
  [ ] ReportData: improved?/disease_ages? 추가, patient_info PatientInfo 로 좁힘
  [ ] grep 4종 (patient_info / ReportData / useMediarcApi / diseases) 회귀 0
  [ ] tsc --noEmit --skipLibCheck 에러 증가 0
  [ ] backoffice build OK
  [ ] HealthReportPage 로컬 렌더 회귀 0
  [ ] 커밋 1

[dev-reviewer]
  [ ] 3장 수용 조건 6 / 4장 수용 조건 5 / 5장 회귀 범위 재검증
  [ ] PASS / WATCH / FAIL 판정

[ops-team]
  [ ] git push + 2홉 SSH + pm2 restart
  [ ] smoke curl 2종 + 브라우저 확인

[ops-verifier]
  [ ] 로그 / smoke / 브라우저 3종 증거 기반 최종 판정
```
