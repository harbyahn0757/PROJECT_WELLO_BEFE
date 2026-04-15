# mediArc 리포트 뷰 Phase 1 + Phase 2 실행 스펙

작성일: 2026-04-14
작성자: dev-planner
산출물 위치: `PROJECT_WELNO_BEFE/planning-platform/docs/mediarc-report-phase1-spec.md`
선행 문서:
- `docs/mediarc-report-deepdive.md` (5단계 여정 설계 SoT)
- `docs/mediarc-report-phase0-spec.md` (facade + ReportData 타입 확장 완료 스펙)
- `memory/project-mediarc-report.md` (프로젝트 상태)
- `memory/welno-deploy.md` (배포 절차)
- `memory/mediarc-api-keys.md` (API 키 보안 원칙)

대상 독자: dev-coder 3~4명 (Sub-task A/B/C/D 병렬 실행), dev-reviewer, ops-team

---

## 1. 목적과 범위 (Phase 1 vs Phase 2)

### 1.1 배경

`HealthReportPage`의 Drawer는 현재 네 개의 하위 탭(`diseases` / `gauges` / `nutrition` / `comparison`)으로 분산되어 있다. 수검자(또는 파트너 오피스 운영자)가 질병 위험을 "공포 없는 방식"으로 이해하고, 자신의 개선 여지와 다음 행동을 직관적으로 파악하기 어렵다. `docs/mediarc-report-deepdive.md`는 5단계 여정(Shock → Understand → Motivate → Action → Celebrate)을 제안했고, 이 스펙은 그 설계를 실제 컴포넌트와 엔드포인트로 구현하기 위한 실행 계획이다.

### 1.2 Phase 1 범위

- 기존 Drawer의 4 하위 탭 구조를 제거하고, 단일 `<ReportView>` 컴포넌트로 대체한다.
- 5단계 여정 본문 블록(ShockBlock / RiskFactorsBlock / DiseaseGrid / BeforeAfterBlock / MilestoneSlot / TrendSlot)을 신규 추가한다.
- 기존 Twobecon grid / disease ages / nutrition / gauge / 참고문헌은 `<Disclosure>` 접기 블록으로 본문 하단에 보존한다 (회귀 방지).
- Drawer 폭을 `lg`(720px)에서 `xl`(80%)로 확장한다.
- `verify` 메인 탭, 엑셀 다운로드, 이름 검색, iframe 모드는 **모두 보존**한다 (backward compatible).
- engine.py, facade.py는 **동결**한다 (Phase 0에서 이미 필요한 필드 추가 완료).

### 1.3 Phase 2 범위

- 히어로 영역에 "AI 한 줄 요약 생성" 버튼을 추가한다. 자동 호출은 하지 않는다.
- 버튼 클릭 시 백엔드에 POST `/welno-api/v1/partner-office/mediarc-report/{uuid}/ai-summary?hospital_id=xxx`를 호출한다.
- 백엔드는 Anthropic Claude Haiku (`claude-haiku-4-5-20251001`)로 한 줄 요약을 생성하고 DB에 캐싱한다.
- 이후 GET 호출 시 캐시가 있으면 LLM 재호출 없이 즉시 반환한다.
- API 키는 서버 `.env`에만 존재한다 (`ANTHROPIC_API_KEY`). 프론트엔드 / config.json / git에 절대 커밋 금지 (`memory/mediarc-api-keys.md` 원칙).

### 1.4 Phase 1 / Phase 2 분리 근거

- Phase 1은 클라이언트 전용(BE 변경 없음, 이미 facade가 Phase 0에서 확장 필드 반환). 따라서 BE 장애와 무관하게 배포 가능.
- Phase 2는 LLM 호출 + DB 마이그레이션 + 신규 SDK 추가가 동반된다. Phase 1 배포 안정화 후 독립 배포한다.
- Phase 2의 Fail-open 설계: AI 요약 API 실패 시 버튼은 에러 토스트만 띄우고, 리포트 본문은 정상 동작해야 한다.

### 1.5 제외 범위 (Out of Scope)

- engine.py 재설계 (Phase 0에서 완료)
- `verify` 탭 UX 변경 (별도 이슈)
- 실시간 스트리밍 요약 (on-demand 단건 생성만)
- 수검자용 모바일 앱 (백오피스 SPA만 대상)
- Sentry / 모니터링 통합 (ops-verifier 영역)

---

## 2. 현행 팩트 재검증

Phase 0 완료 후 현재 코드베이스의 상태를 실제 파일:라인으로 재확인한다.

### 2.1 Phase 0 결과 (확정)

#### 2.1.1 facade.py (백엔드)

`backend/app/services/report_engine/facade.py`의 `mediarc_patient_detail()`는 다음 필드를 이미 반환한다:

- `patient_info.imputed_fields: string[]`
- `patient_info.missing_fields: string[]`
- `improved: ImprovedScenario` (optional)
- `disease_ages: Record<string, number>` (optional)
- `diseases[*].chips: DiseaseChip[]`
- `diseases[*].applied_factors: AppliedFactor[]`
- `diseases[*].improved_rr_ci` / `diseases[*].improved_rank` / `diseases[*].improved_risk_level` (optional)

#### 2.1.2 useMediarcApi.ts (프론트엔드)

`backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts`에서 이미 export된 타입:

- `DiseaseChip`, `AppliedFactor`, `WillRogersEntry`
- `ImprovedScenario`
- `PatientInfo` (imputed_fields / missing_fields 포함)
- `BioageGbResult`, `DiseaseDetail` (improved_* 포함)
- `ReportData` (diseases / improved / disease_ages 포함)

#### 2.1.3 확인 방법 (dev-coder 필수 선행)

```bash
# 백엔드 필드 재확인
grep -n "imputed_fields\|missing_fields\|improved\|disease_ages\|applied_factors" \
  backend/app/services/report_engine/facade.py

# 프론트엔드 타입 재확인
grep -n "export (interface|type)" \
  backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts
```

결과가 위 목록과 일치하지 않으면 **즉시 dev-planner에게 에스컬레이션**하고 작업 중단한다.

### 2.2 HealthReportPage 현재 구조

`backoffice/src/pages/HealthReportPage/index.tsx` (442 lines) 주요 구조:

```
PageLayout
  PageHeader
  FilterBar (hospitalId, date range, search)
  KpiGrid cols=4
    KpiCard x 4 (총환자 / 분석완료 / 소견확보 / 발송대기)
  TabBar (items: [patients, verify])
  (patients 탭) 테이블 + Drawer
  (verify 탭) 검증 테이블 (엑셀 다운로드 버튼 포함)

Drawer (open when row clicked)
  width="lg"                 <-- 720px
  DetailTabBar (diseases / gauges / nutrition / comparison)
  DetailContent
    - diseases: DiseaseGridLegacy
    - gauges: GaugeListLegacy
    - nutrition: NutritionListLegacy
    - comparison: ComparisonTableLegacy
```

관련 hooks (`useMediarcApi.ts`):
- `fetchPatients(hospitalId, query)` → `PatientListItem[]`
- `fetchReport(uuid, hospitalId)` → `ReportData`
- `fetchComparison(uuid, hospitalId)` → `ComparisonData`
- `fetchEngineStats(hospitalId)` → `EngineStats`
- `fetchVerifyAll(hospitalId, filters)` → `VerificationData`

### 2.3 공통 컴포넌트 재확인

파일:라인까지 확인 완료:

| 컴포넌트 | 경로 | 핵심 props |
|---|---|---|
| `PageLayout` | `backoffice/src/components/layout/PageLayout.tsx` | header / children |
| `Drawer` | `backoffice/src/components/Drawer/Drawer.tsx` | open / onClose / header / title / width(sm\|md\|lg\|xl\|full) / containment(auto\|container\|viewport) |
| `KpiGrid` | `backoffice/src/components/kpi/KpiGrid.tsx` | cols(2\|3\|4) / children |
| `KpiCard` | `backoffice/src/components/kpi/KpiCard.tsx` | label / value / unit? / hint? / variant(default\|danger\|warning\|success) / onClick? / selected? |
| `TabBar` | `backoffice/src/components/tabs/TabBar.tsx` | items / activeKey / onChange |
| `FilterBar` | `backoffice/src/components/filters/FilterBar.tsx` | fields / values / onChange |
| `HospitalSearch` | `backoffice/src/components/search/HospitalSearch.tsx` | onSelect / value |

Drawer width 매핑: sm=360px / md=480px / lg=720px / xl=80% / full=100%. iframe 안전 모드는 `useEmbedParams()`가 자동으로 감지하여 `containment="container"`로 강제한다.

### 2.4 디자인 토큰 (`backoffice/src/styles/_variables.scss`)

사용 가능한 토큰 (하드코딩 금지, 반드시 import):

- 색상: `$brand-brown #7c746a`, `$beige-cream #FEF9EE`, `$gray-50~900`, `$success #059669`, `$warning #d97706`, `$error #dc2626`, `$chart-blue #4299e1`
- 간격: `$spacing-xs 0.5rem` / `$spacing-sm 0.75rem` / `$spacing-md 1rem` / `$spacing-lg 1.5rem` / `$spacing-xl 2rem`
- 폰트: `$font-2xs 11px` / `$font-xs 12px` / `$font-sm 13px` / `$font-md 14px` / `$font-lg 16px` / `$font-xl 18px` / `$font-2xl 20px` / `$font-3xl 24px`
- 라운드: `$border-radius-sm 4px` / `$border-radius-md 6px` / `$border-radius-lg 8px` / `$border-radius-xl 12px`
- 브레이크포인트: `$bp-mobile-max 767px` / `$bp-tablet-max 1023px` / `$bp-desktop-min 1024px`

### 2.5 DB 및 마이그레이션 컨벤션

기존 테이블 `welno.welno_mediarc_reports`:

```
id             SERIAL PRIMARY KEY
patient_id     INTEGER
patient_uuid   VARCHAR(36)
hospital_id    VARCHAR(20)
raw_response   JSONB
mkt_uuid       VARCHAR(50) UNIQUE
report_url     TEXT
provider       VARCHAR(20) DEFAULT 'twobecon'
created_at     TIMESTAMPTZ DEFAULT NOW()
updated_at     TIMESTAMPTZ DEFAULT NOW()

UNIQUE(patient_uuid, hospital_id)
```

마이그레이션 파일 패턴 (`backend/migrations/*.sql`):

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS welno.<table> (...);
ALTER TABLE welno.<table> ADD COLUMN IF NOT EXISTS <col> <type>;
COMMENT ON COLUMN welno.<table>.<col> IS '<설명>';
CREATE INDEX IF NOT EXISTS idx_<...> ON welno.<table>(<col>);

COMMIT;
```

### 2.6 API 엔드포인트 (`partner_office.py`)

기존 엔드포인트 (line 2480~2907):

- `GET  /mediarc-report/unified-patients`
- `GET  /mediarc-report/stats`
- `GET  /mediarc-report/patients`
- `GET  /mediarc-report/engine/stats`
- `GET  /mediarc-report/verify-all`
- `GET  /mediarc-report/patient/{uuid}`
- `GET  /mediarc-report/{uuid}/compare`
- `GET  /mediarc-report/{uuid}` (line 2857, Phase 0 확장 필드 포함 pass-through)

내부 가드 패턴: `_engine_guard()` + `mediarc_patient_detail(uuid)` 재사용.

### 2.7 LLM SDK 현황

`backend/requirements.txt`:
- 있음: `fastapi 0.104.1`, `asyncpg`, `pydantic 2.5.0`, `tiktoken<0.10`, `llama-index-core`, `llama-index-llms-openai`, `google-genai>=1.0.0`
- 없음: `anthropic` (Phase 2 Sub-task D에서 추가 필요)

`backend/app/core/config.py`:
- 있음: `OPENAI_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `MEDIARC_API_KEY`
- 없음: `ANTHROPIC_API_KEY` (Phase 2에서 추가)

---

## 3. UI 구조 (BEM + JSX 의사 코드)

### 3.1 최상위 네이밍

- 루트 BEM: `.report-view` + `.app-report-view` (namespace)
- 메타 패널: `.report-view__meta`
- 단계별 블록: `.report-view__step--shock` / `.report-view__step--understand` / `.report-view__step--motivate` / `.report-view__step--action` / `.report-view__step--celebrate`
- 부속: `.report-view__disease-grid`, `.report-view__before-after`, `.report-view__cohort-caption`, `.report-view__factor--present`, `.report-view__factor--absent`, `.report-view__disclosure`, `.report-view__disclosure--planned`, `.report-view__pmid-link`
- 히어로 AI 버튼: `.report-view__ai-summary` / `.report-view__ai-summary__button` / `.report-view__ai-summary__text`

### 3.2 JSX 의사 코드 (ReportView)

```tsx
<div className="report-view app-report-view" data-testid="report-view">
  <ReportViewMetaPanel data={data} />

  {/* Step 1: Shock — hero KPI + AI 요약 버튼 */}
  <section className="report-view__step report-view__step--shock">
    <HeroBlock bodyAge={data.body_age} biologicalDifference={data.bio_diff} />
    <AiSummaryButton uuid={uuid} hospitalId={hospitalId} />
    <AiSummaryText value={summary} loading={loading} error={error} />
  </section>

  {/* Step 2: Understand — 위험 인자 + 질환별 카드 */}
  <section className="report-view__step report-view__step--understand">
    <RiskFactorsBlock factors={data.applied_factors} />
    <DiseaseGrid
      diseases={data.diseases}
      onSelect={(code) => setSelectedDisease(code)}
    />
  </section>

  {/* Step 3: Motivate — 전/후 비교 + 코호트 주석 */}
  <section className="report-view__step report-view__step--motivate">
    <BeforeAfterBlock current={data.diseases} improved={data.improved} />
    <WillRogersCaption data={data.will_rogers} />
  </section>

  {/* Step 4: Action — 마일스톤 + 추세 슬롯 (Phase 1은 placeholder) */}
  <section className="report-view__step report-view__step--action">
    <MilestoneSlot diseaseAges={data.disease_ages} />
    <TrendSlot hint="추세 데이터는 Phase 2+에서 제공됩니다." />
  </section>

  {/* Step 5: Celebrate — 기존 상세를 접기 블록으로 보존 */}
  <section className="report-view__step report-view__step--celebrate">
    <Disclosure title="상세 질환 카드 (기존 Twobecon grid)">
      <TwobeconGridView data={data.diseases} />
    </Disclosure>
    <Disclosure title="질환별 추정 연령 (disease_ages)">
      <DiseaseAgeList data={data.disease_ages} />
    </Disclosure>
    <Disclosure title="영양소 상세">
      <NutritionBlock data={data.nutrients} />
    </Disclosure>
    <Disclosure title="건강 게이지">
      <GaugeBlock data={data.gauges} />
    </Disclosure>
    <Disclosure title="참고 문헌 (PMID)">
      <ReferencePmidList data={data.references} />
    </Disclosure>
  </section>

  <DiseaseDetailModal
    open={!!selectedDisease}
    disease={selectedDisease ? data.diseases[selectedDisease] : null}
    onClose={() => setSelectedDisease(null)}
  />
</div>
```

### 3.3 반응형

- 데스크탑 (`$bp-desktop-min` 이상): `.report-view`의 본문은 2열 그리드 (`.report-view__step--understand` 내 DiseaseGrid는 3 cols).
- 태블릿 (`$bp-tablet-max` 이하): DiseaseGrid 2 cols, BeforeAfter row 1열.
- 모바일 (`$bp-mobile-max` 이하): 모든 블록 1열, Disclosure 기본 접힘.
- iframe: Drawer `containment="container"`가 자동 적용. 내부 스크롤은 `.report-view` 루트에서 `overflow-y: auto`.

### 3.4 접근성

- `<Disclosure>`는 `<details>/<summary>` 기반, 키보드 접근 자동 지원.
- 모든 인터랙티브 요소 (버튼, 카드, Disclosure)에 `data-testid` 부여.
- 색상만으로 상태를 전달하지 않는다 (variant + 텍스트 라벨 병기).

---

## 4. Drawer 교체 계획

### 4.1 변경 전 (현재)

```tsx
<Drawer open={drawerOpen} onClose={closeDrawer} width="lg" title={patient.name}>
  <TabBar
    items={[
      { key: 'diseases', label: '질환' },
      { key: 'gauges', label: '게이지' },
      { key: 'nutrition', label: '영양' },
      { key: 'comparison', label: '비교' },
    ]}
    activeKey={detailTab}
    onChange={setDetailTab}
  />
  <DetailContent tab={detailTab} uuid={uuid} hospitalId={hospitalId} />
</Drawer>
```

### 4.2 변경 후 (Phase 1)

```tsx
<Drawer
  open={drawerOpen}
  onClose={closeDrawer}
  width="xl"
  title={patient.name}
  testId="mediarc-report-drawer"
>
  <ReportView
    uuid={uuid}
    hospitalId={hospitalId}
    embedMode={embedMode}
  />
</Drawer>
```

### 4.3 제거/보존 매핑

| 기존 | 처리 | 비고 |
|---|---|---|
| `DetailTabBar` (4 tabs) | 제거 | 더이상 하위 탭 없음 |
| `DetailContent` switch 구조 | 제거 | ReportView로 통합 |
| `DiseaseGridLegacy` | Disclosure 내부로 이동 (`TwobeconGridView`) | 렌더 코드 재사용 가능하면 재사용 |
| `GaugeListLegacy` | Disclosure 내부로 이동 (`GaugeBlock`) | 재사용 가능 |
| `NutritionListLegacy` | Disclosure 내부로 이동 (`NutritionBlock`) | 재사용 가능 |
| `ComparisonTableLegacy` | Disclosure 내부로 이동 (메인 시나리오가 아니면 축소) | WillRogersCaption이 상단 대체 |
| `verify` 메인 탭 | 유지 | 별도 흐름, 본 스펙 영향 없음 |
| 엑셀 다운로드 | 유지 | verify 탭 버튼 그대로 |
| 이름 검색 | 유지 | FilterBar 필드 그대로 |

### 4.4 iframe 호환

`Drawer`의 `containment="container"` 모드는 `useEmbedParams()`이 `?api_key=xxx` 또는 `?embed=1`을 감지하면 자동 적용된다. ReportView는 전달받은 `embedMode` 플래그로 다음 2가지만 조정한다:

- iframe일 때 외부 링크 열기는 `window.open(..., '_blank')` 대신 부모로 postMessage (optional, Phase 2+)
- iframe일 때 Disclosure 기본 상태 = 접힘

---

## 5. 공통 컴포넌트 재사용 계약

### 5.1 PageLayout + PageHeader

변경 없음. 기존 그대로 사용한다.

### 5.2 Drawer

- `width` prop만 `lg` → `xl` 변경
- `containment`는 prop으로 override하지 말고 Drawer 내부 자동 감지에 맡긴다

### 5.3 KpiGrid + KpiCard

`HeroBlock` 내부에서 `KpiGrid cols={3}`으로 다음 3개 카드를 구성:

| KpiCard | label | value | variant | hint |
|---|---|---|---|---|
| 1 | 신체 나이 | `{data.body_age.value}` | `default` | `"만 나이 기준 +${diff}세"` |
| 2 | 생체 나이 차이 | `{bio_diff}` | `danger`/`warning`/`success` (음수=success) | `"-=젊음, +=노화"` |
| 3 | 개선 여지 | `{data.improved?.overall_improvement}세` | `success` | `"6개월 생활습관 가정"` |

### 5.4 TabBar

메인 레벨 탭(`patients` / `verify`)는 유지. Drawer 내부 탭은 제거.

### 5.5 FilterBar + HospitalSearch

변경 없음.

---

## 6. 신규 서브 컴포넌트 목록

### 6.1 디렉토리 구조

```
backoffice/src/pages/HealthReportPage/
├── index.tsx                         (Sub-task A, 대폭 수정)
├── hooks/
│   ├── useMediarcApi.ts              (Sub-task C에서 generateAiSummary/fetchAiSummary 추가)
│   └── useAiSummary.ts               (Sub-task C 신규)
├── components/                       (신규 디렉토리)
│   ├── ReportView.tsx                (Sub-task A)
│   ├── ReportViewMetaPanel.tsx       (Sub-task A)
│   ├── HeroBlock.tsx                 (Sub-task A)
│   ├── AiSummaryButton.tsx           (Sub-task C)
│   ├── AiSummaryText.tsx             (Sub-task C)
│   ├── RiskFactorsBlock.tsx          (Sub-task A)
│   ├── DiseaseGrid.tsx               (Sub-task A)
│   ├── DiseaseCard.tsx               (Sub-task A)
│   ├── DiseaseFactorChip.tsx         (Sub-task A)
│   ├── BeforeAfterBlock.tsx          (Sub-task A)
│   ├── BeforeAfterRow.tsx            (Sub-task A)
│   ├── WillRogersCaption.tsx         (Sub-task A)
│   ├── ImprovementLabelsChip.tsx     (Sub-task A)
│   ├── MilestoneSlot.tsx             (Sub-task B)
│   ├── TrendSlot.tsx                 (Sub-task B)
│   ├── Disclosure.tsx                (Sub-task B)
│   ├── TwobeconGridView.tsx          (Sub-task B, 기존 legacy에서 이관)
│   ├── DiseaseAgeList.tsx            (Sub-task B)
│   ├── NutritionBlock.tsx            (Sub-task B)
│   ├── GaugeBlock.tsx                (Sub-task B)
│   ├── ReferencePmidList.tsx         (Sub-task B)
│   ├── DiseaseDetailModal.tsx        (Sub-task A)
│   └── BodyAgeChart.tsx              (Sub-task A)
└── styles/
    ├── _report-view.scss             (Sub-task A, 단일 SoT)
    └── _report-view-tokens.scss      (Sub-task A, variables re-export)
```

### 6.2 주요 컴포넌트 계약

#### 6.2.1 ReportView

```ts
interface ReportViewProps {
  uuid: string;
  hospitalId: string;
  embedMode?: boolean;
}
```

- `useEffect`로 `fetchReport(uuid, hospitalId)` 호출
- `useState` 관리: `data` / `loading` / `error` / `selectedDiseaseCode`
- 에러 시 fallback UI (`.report-view__error`), 로딩 시 skeleton (`.report-view__skeleton`)

#### 6.2.2 ReportViewMetaPanel

```ts
interface ReportViewMetaPanelProps {
  data: ReportData;
}
```

- 상단 작은 칩 라인: 생성 시각, 엔진 버전, `imputed_fields` 개수, `missing_fields` 개수
- `missing_fields.length > 0` 이면 `.report-view__meta--warning` 스타일 추가

#### 6.2.3 HeroBlock

```ts
interface HeroBlockProps {
  bodyAge: BodyAge;
  biologicalDifference: number;
  improvedOverall?: number;
  uuid: string;
  hospitalId: string;
}
```

- KpiGrid cols=3 + AiSummaryButton + AiSummaryText
- AiSummaryButton/Text는 Sub-task C 산출물. Sub-task A는 `<Slot name="ai-summary" />` 패턴으로 placeholder만 두고, C가 완성되면 import로 교체

#### 6.2.4 AiSummaryButton (Sub-task C)

```ts
interface AiSummaryButtonProps {
  uuid: string;
  hospitalId: string;
  onResult: (summary: AiSummary) => void;
  onError: (err: Error) => void;
  disabled?: boolean;
}
```

- 클릭 시 `useAiSummary().generate(uuid, hospitalId)` 호출
- 기본 라벨: "AI 한 줄 요약 생성"
- 이미 캐시가 있는 경우 "다시 생성" 라벨 + 확인 모달
- 생성 중 `disabled`, 스피너 표시

#### 6.2.5 AiSummaryText (Sub-task C)

```ts
interface AiSummaryTextProps {
  value?: string;
  generatedAt?: string;
  model?: string;
  loading?: boolean;
  error?: Error;
}
```

- 값이 있으면 표시, 없으면 placeholder ("요약을 생성하면 이 영역에 표시됩니다.")
- 메타 라인: 생성 시각 + 모델명 (tooltip)
- 에러 시 인라인 에러 + 재시도 버튼

#### 6.2.6 RiskFactorsBlock

```ts
interface RiskFactorsBlockProps {
  factors: AppliedFactor[];
}
```

- 존재하는 위험 인자 → `.report-view__factor--present` (주황 배경)
- 부재 인자 → `.report-view__factor--absent` (회색 배경)
- 각 factor는 `DiseaseFactorChip`

#### 6.2.7 DiseaseGrid

```ts
interface DiseaseGridProps {
  diseases: Record<string, DiseaseDetail>;
  onSelect?: (code: string) => void;
}
```

- 반응형 그리드: desktop 3 cols / tablet 2 cols / mobile 1 col
- 각 카드: 질환명 / rank (% 백분위) / variant (risk_level 기반)
- 카드 클릭 시 DiseaseDetailModal 오픈

#### 6.2.8 DiseaseCard

```ts
interface DiseaseCardProps {
  code: string;
  detail: DiseaseDetail;
  onClick?: () => void;
}
```

- KpiCard의 variant 규칙 재사용 (high=danger / moderate=warning / low=success)
- hint: `"하위 ${rank}%"`

#### 6.2.9 BeforeAfterBlock

```ts
interface BeforeAfterBlockProps {
  current: Record<string, DiseaseDetail>;
  improved?: ImprovedScenario;
}
```

- `improved`가 없으면 `"개선 시나리오 데이터가 없습니다."` 안내
- 있으면 `BeforeAfterRow` 반복

#### 6.2.10 BeforeAfterRow

```ts
interface BeforeAfterRowProps {
  diseaseCode: string;
  currentRank: number;
  improvedRank: number;
  currentRiskLevel: RiskLevel;
  improvedRiskLevel?: RiskLevel;
}
```

- 좌: 현재 백분위 / 우: 개선 후 백분위
- 화살표 `→` + 변화폭 텍스트 `-${delta}%`
- 개선 후 variant가 다르면 `ImprovementLabelsChip` 추가

#### 6.2.11 Disclosure (Sub-task B)

```ts
interface DisclosureProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'default' | 'planned';
}
```

- `<details><summary>` 기반
- `variant="planned"` → 회색 톤, "예정" 뱃지 표시
- `defaultOpen`은 iframe 모드에서 false로 강제

### 6.3 엔진 필드 매핑 표 (6.4 보조)

| 컴포넌트 | 읽는 필드 | Fallback |
|---|---|---|
| HeroBlock | `body_age.value` / `bio_diff` / `improved.overall_improvement` | `-` / `-` / 숨김 |
| AiSummaryText | `ai_summary.summary` / `ai_summary.generated_at` / `ai_summary.model` | placeholder |
| RiskFactorsBlock | `applied_factors[]` | 빈 상태 메시지 |
| DiseaseGrid | `diseases{}` | 빈 상태 메시지 |
| BeforeAfterBlock | `improved.diseases{}` | 안내 메시지 |
| WillRogersCaption | `will_rogers[]` | 문구만 표시 |
| MilestoneSlot | `disease_ages{}` | "데이터 준비 중" |
| TrendSlot | (Phase 1 없음) | "Phase 2+ 예정" |
| TwobeconGridView | `diseases{}` | 빈 상태 |
| DiseaseAgeList | `disease_ages{}` | 빈 상태 |
| NutritionBlock | `nutrients[]` | 빈 상태 |
| GaugeBlock | `gauges[]` | 빈 상태 |
| ReferencePmidList | `references[]` | 빈 상태 |

---

## 7. SCSS 설계 (`_report-view.scss`)

### 7.1 파일 위치 및 import

`backoffice/src/pages/HealthReportPage/styles/_report-view.scss`

index.tsx에서:

```tsx
import './styles/_report-view.scss';
```

### 7.2 핵심 구조

```scss
@import 'src/styles/variables';

.report-view {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  padding: $spacing-lg;
  color: $gray-900;
  background: $beige-cream;

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
    font-size: $font-xs;
    color: $gray-600;

    &--warning { color: $warning; }
  }

  &__step {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding: $spacing-lg;
    border-radius: $border-radius-lg;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

    &--shock      { border-left: 4px solid $chart-blue; }
    &--understand { border-left: 4px solid $warning; }
    &--motivate   { border-left: 4px solid $success; }
    &--action     { border-left: 4px solid $brand-brown; }
    &--celebrate  { border-left: 4px solid $gray-300; }
  }

  &__ai-summary {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;

    &__button {
      align-self: flex-start;
      padding: $spacing-sm $spacing-md;
      background: $brand-brown;
      color: #fff;
      border: none;
      border-radius: $border-radius-md;
      font-size: $font-sm;
      cursor: pointer;

      &:disabled {
        background: $gray-400;
        cursor: wait;
      }
    }

    &__text {
      font-size: $font-md;
      line-height: 1.5;
      padding: $spacing-sm;
      background: $gray-50;
      border-radius: $border-radius-sm;

      &--loading { color: $gray-400; }
      &--error   { color: $error; }
    }
  }

  &__disease-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $spacing-md;

    @media (max-width: $bp-tablet-max) {
      grid-template-columns: repeat(2, 1fr);
    }
    @media (max-width: $bp-mobile-max) {
      grid-template-columns: 1fr;
    }
  }

  &__before-after {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
  }

  &__cohort-caption {
    font-size: $font-xs;
    color: $gray-500;
  }

  &__factor {
    display: inline-flex;
    align-items: center;
    padding: $spacing-xs $spacing-sm;
    border-radius: $border-radius-sm;
    font-size: $font-xs;

    &--present { background: rgba($warning, 0.15); color: $warning; }
    &--absent  { background: $gray-100; color: $gray-500; }
  }

  &__disclosure {
    border-top: 1px solid $gray-200;
    padding-top: $spacing-sm;

    summary {
      cursor: pointer;
      font-size: $font-sm;
      color: $gray-700;
    }

    &--planned summary { color: $gray-500; }
  }

  &__pmid-link {
    color: $chart-blue;
    text-decoration: underline;
  }

  &__error { color: $error; padding: $spacing-md; }
  &__skeleton { padding: $spacing-md; color: $gray-400; }
}
```

### 7.3 하드코딩 금지

- 모든 색/간격/폰트는 위 변수 사용.
- 새 색이 필요하면 `_variables.scss`에 추가 (dev-reviewer 확인 후).
- `px` 리터럴은 `1px` border만 허용.

### 7.4 기존 `.hr-*` / `.health-report__*`와의 공존

- `.report-view`는 Drawer 내부에만 사용 → 메인 페이지의 `.hr-*` / `.health-report__*`와 **범위 충돌 없음**.
- `verify` 탭 스타일은 건드리지 않는다.

---

## 8. AI 한 줄 요약 시스템 (Phase 2)

### 8.1 UX 흐름

1. 운영자가 Drawer를 연다 → ReportView 렌더 → 히어로 영역의 "AI 한 줄 요약 생성" 버튼 표시
2. 최초 렌더 시 GET 요청으로 캐시 확인 (선택적 자동 호출, 아래 8.2.1 참고) — **기본은 "생성 버튼 누를 때만" 전략**
3. 버튼 클릭 시 POST → 서버가 LLM 호출 → DB 저장 → 응답 반환
4. 응답 받으면 AiSummaryText에 표시, 버튼 라벨이 "다시 생성"으로 바뀜
5. 재생성 시 확인 모달 ("기존 요약을 덮어씁니다. 진행할까요?") → 확인 시 POST 재호출
6. 에러 시 인라인 에러 + 재시도 버튼, 리포트 본문은 정상 동작

### 8.2 BE API 계약

#### 8.2.1 GET (캐시 조회)

```
GET /welno-api/v1/partner-office/mediarc-report/{uuid}/ai-summary?hospital_id=xxx
```

응답 (200):

```json
{
  "uuid": "831b1be7-...",
  "hospital_id": "PEERNINE",
  "summary": "체지방률은 높지만 혈압·혈당은 양호합니다. 체중 관리에 집중하면 당뇨 위험을 크게 낮출 수 있어요.",
  "model": "claude-haiku-4-5-20251001",
  "generated_at": "2026-04-14T10:23:11Z"
}
```

응답 (404): 캐시 없음
응답 (401): api_key 또는 session 인증 실패

#### 8.2.2 POST (생성 or 재생성)

```
POST /welno-api/v1/partner-office/mediarc-report/{uuid}/ai-summary?hospital_id=xxx
Content-Type: application/json
Body: { "force": false }
```

- `force=false`: 기존 캐시 있으면 바로 반환 (LLM 호출 없음)
- `force=true`: 기존 캐시 덮어쓰기

응답 (200): GET과 동일 스키마
응답 (429): rate limit 초과
응답 (502): LLM 호출 실패

### 8.3 DB 스키마 (신규 테이블)

새 테이블 `welno.welno_mediarc_ai_summaries` 생성한다. `welno_mediarc_reports`를 ALTER하지 않는 이유:

- AI 요약은 mediarc 리포트가 없는 환자(채팅/캠페인 경로)에도 장기적으로 확장 가능해야 한다.
- 스키마 관심사 분리.
- UNIQUE(patient_uuid, hospital_id)로 캐시 키가 명확하다.

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS welno.welno_mediarc_ai_summaries (
  id SERIAL PRIMARY KEY,
  patient_uuid VARCHAR(36) NOT NULL,
  hospital_id VARCHAR(20) NOT NULL,
  summary TEXT NOT NULL,
  model VARCHAR(64) NOT NULL,
  prompt_version VARCHAR(16) NOT NULL DEFAULT 'v1',
  input_digest VARCHAR(64),
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_uuid, hospital_id)
);

COMMENT ON TABLE welno.welno_mediarc_ai_summaries IS 'mediArc 리포트 AI 한 줄 요약 캐시. on-demand 생성.';
COMMENT ON COLUMN welno.welno_mediarc_ai_summaries.input_digest IS '입력 리포트 해시(sha256 hex). 리포트가 재생성되면 달라져 재생성 유도.';
COMMENT ON COLUMN welno.welno_mediarc_ai_summaries.prompt_version IS '프롬프트 스키마 버전. v1 = 2026-04-14 초기.';

CREATE INDEX IF NOT EXISTS idx_ai_sum_patient_hospital
  ON welno.welno_mediarc_ai_summaries(patient_uuid, hospital_id);
CREATE INDEX IF NOT EXISTS idx_ai_sum_created_at
  ON welno.welno_mediarc_ai_summaries(created_at DESC);

COMMIT;
```

### 8.4 Haiku 프롬프트 설계

#### 8.4.1 모델

- `claude-haiku-4-5-20251001`
- `max_tokens`: 200
- `temperature`: 0.3
- `system`: 한국어 건강 요약 전문가 페르소나
- `user`: 구조화된 리포트 JSON의 핵심 필드만 전달

#### 8.4.2 프롬프트 템플릿 (`ai_summary.py`)

```
SYSTEM:
당신은 한국어 건강검진 결과를 수검자 본인에게 설명하는 조력자입니다.
다음 규칙을 엄격히 따르세요.

- 한 문단, 최대 2문장, 80자 이내.
- 의학적 진단 금지. "전문의 상담 권장" 같은 가이드라인 표현은 허용.
- 긍정 프레이밍 우선 (강점 먼저, 위험 뒤).
- 공포 유발 금지 ("큰일납니다", "위험합니다" 금지).
- 숫자는 가공하지 말고 입력 그대로 사용.
- 입력에 없는 정보는 만들어내지 말 것.

USER:
아래 건강 요약을 한 문단으로 써주세요.

신체 나이: {body_age_value}세 (만 나이 대비 {bio_diff:+d}세)
상위 위험 질환:
{top_diseases_block}

현존 위험 인자:
{present_factors_block}

개선 시나리오 (6개월 생활습관 가정):
{improved_block}
```

#### 8.4.3 입력 블록 생성 규칙

- `top_diseases_block`: 상위 risk_level=high 최대 3개, `{name} 하위 {rank}%`
- `present_factors_block`: `AppliedFactor`에서 presence=true인 항목 최대 5개
- `improved_block`: `improved.overall_improvement`와 top 2개 질환의 rank 개선치

#### 8.4.4 입력 다이제스트 (캐시 무효화)

`input_digest = sha256(json.dumps(input_payload, sort_keys=True))[:64]`

리포트 원본이 변경되면 digest가 달라진다. GET 시 서버는:
1. 저장된 summary.input_digest vs 현재 리포트의 digest 비교
2. 다르면 summary를 stale로 표시 (응답에 `stale: true` 플래그)
3. 클라이언트는 stale이면 "재생성 권장" 배지 표시

### 8.5 비용 / rate limit

- Haiku 입력/출력 토큰 예상: 입력 400 / 출력 80 → 약 $0.0005/건
- 일일 예상 볼륨: 최대 500건 → 약 $0.25/일
- Rate limit: 서버 레벨에서 `hospital_id` 당 분당 20건으로 제한한다 (FastAPI 미들웨어 또는 endpoint 내부 체크)
- 동시 생성 방지: `(patient_uuid, hospital_id)` 조합에 대해 Redis lock (60초 TTL) 또는 DB advisory lock

### 8.6 보안

- `ANTHROPIC_API_KEY`는 `backend/config.env`에만 존재.
- `config.py`에서 `os.getenv("ANTHROPIC_API_KEY")`로 로드.
- `config.json` 또는 프론트엔드 코드에 넣으면 **절대 커밋 금지** (git pre-commit hook 또는 GitHub Secret Scanning 대응).
- 엔드포인트는 기존 `partner_auth` 미들웨어의 `api_key` 체크 재사용.
- 요약 응답에 원본 환자 PII는 포함되지 않는다 (이름, 주민번호 등 없음).

---

## 9. 백엔드 구현

### 9.1 파일 변경 목록 (Sub-task D)

| 파일 | 변경 유형 | 라인 수(예상) |
|---|---|---|
| `backend/migrations/2026-04-14_ai_summary.sql` | 신규 | 40 |
| `backend/app/services/report_engine/ai_summary.py` | 신규 | 200 |
| `backend/app/api/v1/endpoints/partner_office.py` | 추가 (GET/POST 2개) | +120 |
| `backend/requirements.txt` | 추가 (anthropic) | +1 |
| `backend/app/core/config.py` | 추가 (ANTHROPIC_API_KEY) | +1 |
| `backend/config.env.example` | 추가 (ANTHROPIC_API_KEY=) | +1 |

### 9.2 `ai_summary.py` 주요 함수

```python
# backend/app/services/report_engine/ai_summary.py
from anthropic import AsyncAnthropic
from app.core.config import settings

MODEL = "claude-haiku-4-5-20251001"
PROMPT_VERSION = "v1"

async def build_input_payload(report: dict) -> dict:
    """facade에서 받은 리포트에서 LLM 입력용 핵심 필드만 추출."""

async def compute_input_digest(payload: dict) -> str:
    """sha256 다이제스트 (캐시 무효화용)."""

async def generate_summary(report: dict) -> tuple[str, dict]:
    """LLM 호출 → (summary_text, meta{input_tokens, output_tokens})"""

async def get_cached_summary(patient_uuid: str, hospital_id: str) -> dict | None:
    """DB에서 캐시 조회. 없으면 None."""

async def upsert_summary(
    patient_uuid: str, hospital_id: str, summary: str,
    model: str, input_digest: str, input_tokens: int, output_tokens: int
) -> dict:
    """UPSERT. (patient_uuid, hospital_id) 유니크 충돌 시 업데이트."""
```

### 9.3 엔드포인트 (partner_office.py)

```python
@router.get("/mediarc-report/{uuid}/ai-summary")
async def get_ai_summary(uuid: str, hospital_id: str = Query(...), ...):
    _engine_guard()
    cached = await ai_summary.get_cached_summary(uuid, hospital_id)
    if not cached:
        raise HTTPException(404, "no summary cache")
    # stale 판정 (선택)
    return cached


@router.post("/mediarc-report/{uuid}/ai-summary")
async def post_ai_summary(
    uuid: str,
    hospital_id: str = Query(...),
    body: AiSummaryRequest = Body(...),
    ...,
):
    _engine_guard()
    # force=false + 캐시 있음 → 그대로 반환
    if not body.force:
        cached = await ai_summary.get_cached_summary(uuid, hospital_id)
        if cached:
            return cached

    # 리포트 로드 (facade 재사용)
    report = await mediarc_patient_detail(uuid, hospital_id=hospital_id)
    payload = await ai_summary.build_input_payload(report)
    digest = await ai_summary.compute_input_digest(payload)

    # rate limit 체크 (hospital_id 당 분당 20건)
    await ratelimit.check("ai_summary", hospital_id)

    summary_text, meta = await ai_summary.generate_summary(payload)

    saved = await ai_summary.upsert_summary(
        patient_uuid=uuid,
        hospital_id=hospital_id,
        summary=summary_text,
        model=ai_summary.MODEL,
        input_digest=digest,
        input_tokens=meta["input_tokens"],
        output_tokens=meta["output_tokens"],
    )
    return saved
```

### 9.4 requirements.txt 추가

```
anthropic>=0.34.0
```

### 9.5 config.py / config.env

```python
# config.py
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
```

```
# config.env.example (커밋)
ANTHROPIC_API_KEY=
# 실제 값은 서버 /home/welno/.../config.env 에서만 입력 (git 미추적)
```

---

## 10. 4인 병렬 작업 분배

### 10.1 Sub-task 매핑

| Sub-task | 담당 | 핵심 산출물 | 파일 수 | 예상 LOC |
|---|---|---|---|---|
| A | dev-coder #1 (FE 메인) | ReportView, HeroBlock, RiskFactorsBlock, DiseaseGrid/Card, BeforeAfterBlock/Row, WillRogersCaption, ImprovementLabelsChip, BodyAgeChart, DiseaseDetailModal, `index.tsx` 수정, `_report-view.scss`, Drawer width 변경 | ~15 | 1400 |
| B | dev-coder #2 (FE appendix) | Disclosure, MilestoneSlot, TrendSlot, TwobeconGridView, DiseaseAgeList, NutritionBlock, GaugeBlock, ReferencePmidList | ~8 | 700 |
| C | dev-coder #3 (FE AI) | AiSummaryButton, AiSummaryText, `useAiSummary.ts`, `useMediarcApi.ts` 추가 함수 (generateAiSummary / fetchAiSummary) | 4 | 300 |
| D | dev-coder #4 (BE) | migration .sql, `ai_summary.py`, `partner_office.py` 엔드포인트 추가, requirements.txt, config.py, config.env.example | 6 | 400 |

### 10.2 파일 잠금 (동시 수정 금지)

- `index.tsx` → A 전용
- `useMediarcApi.ts` → C 전용 (A는 수정 금지, 기존 타입만 import)
- `partner_office.py` → D 전용
- `requirements.txt` → D 전용
- `_variables.scss` → 수정 금지 (토큰 부족 시 dev-reviewer 승인 후 별도 커밋)

### 10.3 Sub-task 간 계약

- A ↔ C: `HeroBlock`이 `AiSummaryButton`, `AiSummaryText`를 prop으로 받는다. A는 placeholder 컴포넌트 2개(최소 껍데기)를 `components/__stubs__/`에 만들어둔 뒤, C가 완성되면 import 경로 교체.
- C ↔ D: API URL/스키마는 본 스펙 8.2.1 / 8.2.2 기준 (URL은 `${API_BASE}/partner-office/mediarc-report/{uuid}/ai-summary`).
- A ↔ B: `ReportView`가 B 컴포넌트들을 import한다. B는 모두 default export + displayName 필수.

### 10.4 커밋 단위

- 각 Sub-task는 feature 브랜치(`feat/mediarc-report-phase1-A` 등)에서 작업.
- 커밋은 기능 단위 + 150줄 이하. 초과 시 분할.
- 각 Sub-task 마지막 커밋에 `Co-Authored-By: Claude <noreply@anthropic.com>` 필수.

### 10.5 진행 순서

```
병렬:
  A (FE 메인) ──┐
  B (FE appendix) ──┤
  C (FE AI) ──┤   dev-reviewer 합동 리뷰
  D (BE + migration + LLM) ──┘
                │
                ▼
       통합 빌드 (메인)
                │
                ▼
       dev-reviewer 재검증
                │
                ▼
       ops-team (migration 먼저, 이후 배포)
                │
                ▼
       ops-verifier smoke + 5분 모니터링
```

### 10.6 역할 요약

- dev-coder: 각자 Sub-task 수행 후 완료 보고 (파일 리스트 + LOC + 테스트 결과)
- dev-reviewer: 4 Sub-task를 합쳐서 영향도 분석, 중복 / 미사용 / 하위 호환성 체크
- ops-team: migration 실행 → git pull → npm run deploy:simple → pm2 restart
- ops-verifier: smoke test 5건 수행 (아래 11장)

---

## 11. 테스트 / 인수 기준

### 11.1 단위 테스트 (각 Sub-task)

- A/B/C: 각 컴포넌트 렌더 스냅샷 + prop 변화 snapshot (Jest + React Testing Library)
- D: `ai_summary.py`의 `build_input_payload`, `compute_input_digest`, `upsert_summary` 단위 테스트 (pytest)
- D: endpoint 통합 테스트 2건 (GET 200 / 404, POST 200 / 429)

### 11.2 타입체크

```bash
cd planning-platform/backoffice
npx tsc --noEmit --skipLibCheck
# 기존 에러 N건 대비 증가 0
```

### 11.3 빌드

```bash
cd planning-platform/backoffice && npm run build
# exit 0 + dist 산출물 생성 확인
```

### 11.4 E2E 수동 체크리스트 (ops-verifier)

1. [ ] Drawer 열림 → ReportView 렌더, 에러 없음
2. [ ] 5단계 블록(Shock/Understand/Motivate/Action/Celebrate) 모두 표시
3. [ ] Drawer 폭 `xl`(80%)로 넓어짐
4. [ ] KpiGrid 3 카드 (body_age / bio_diff / improved) 표시
5. [ ] DiseaseGrid 카드 클릭 → DiseaseDetailModal 오픈
6. [ ] BeforeAfterBlock이 `improved` 필드가 있을 때 변화폭 표시
7. [ ] Disclosure 5개(기존 Twobecon, disease_ages, nutrition, gauges, references) 접기/펼치기 동작
8. [ ] `verify` 메인 탭 정상 동작 + 엑셀 다운로드 버튼 정상
9. [ ] 이름 검색 필터 정상 동작
10. [ ] iframe 모드 (`?api_key=xxx`) → Drawer containment=container, 외부 스크롤 영향 없음
11. [ ] AI 요약 버튼 클릭 → 10초 이내 응답, 텍스트 표시
12. [ ] AI 요약 "다시 생성" → 확인 모달 → force=true 호출, 새 요약 반영
13. [ ] BE 다운 시 AI 요약 버튼만 에러 토스트, 본문은 정상

### 11.5 성능

- Drawer 오픈 → 초기 렌더 완료: 1.5초 이내 (로컬)
- AI 요약 생성 응답: 95-percentile 5초 이내
- ReportView 첫 페인트 → FCP: 1초 이내

### 11.6 회귀 방지

- `verify` 탭 관련 모든 기능은 그대로 작동해야 한다 (dev-reviewer 별도 체크리스트).
- 기존 엑셀 다운로드 URL 변경 없음.
- 기존 `/mediarc-report/*` API 응답 하위 호환: 필드 추가만 가능, 기존 필드 타입/이름 변경 금지.

### 11.7 인수 기준 (PASS 조건)

- 11.1 ~ 11.6 전 항목 통과
- dev-reviewer PASS + 잔여 이슈 0건 (CONDITIONAL은 hotfix 계획 첨부)
- ops-verifier 배포 후 5분 모니터링 에러 0건
- 하비 최종 승인

---

## 12. 배포 절차

### 12.1 사전 준비

- [ ] 모든 Sub-task dev-reviewer PASS 확인
- [ ] `config.env`에 `ANTHROPIC_API_KEY` 입력 완료 (서버 관리자 수작업, git 미추적)
- [ ] 롤백 계획 문서화 (아래 12.5)
- [ ] 하비 승인 획득

### 12.2 Migration 선행 (반드시 먼저)

배포 서버: `10.0.1.6`, 유저: `welno`

```bash
# 1. 로컬에서 push
cd PROJECT_WELNO_BEFE/planning-platform
git push origin feat/mediarc-report-phase1

# 2. 2-hop SSH (memory/welno-deploy.md 표준 패턴)
sshpass -p '<SRV2_PW>' ssh \
  -o ProxyCommand='sshpass -p "<JUMP_PW>" ssh -W %h:%p -o StrictHostKeyChecking=no root@223.130.142.105' \
  -o StrictHostKeyChecking=no \
  root@10.0.1.6 'bash -s' <<'EOF'
cd /home/welno/workspace/PROJECT_WELNO_BEFE
sudo -u welno git pull origin feat/mediarc-report-phase1

# migration 적용
sudo -u welno psql "postgresql://<user>:<pw>@10.0.1.10:5432/p9_mkt_biz" \
  -f planning-platform/backend/migrations/2026-04-14_ai_summary.sql

# 테이블 생성 확인
sudo -u welno psql "postgresql://<user>:<pw>@10.0.1.10:5432/p9_mkt_biz" \
  -c "\\d welno.welno_mediarc_ai_summaries"
EOF
```

- expect 스크립트 금지. `sshpass + ProxyCommand` 표준 (`memory/ops-workflow`).
- migration 실행 전 DB 백업이 있는지 확인 (일일 백업 crontab 존재).

### 12.3 FE/BE 배포

```bash
# 1. 프론트엔드 빌드 + static 복사 (로컬)
cd planning-platform/backoffice
npx tsc --noEmit --skipLibCheck  # 기존 에러 N건 허용
npm run build
cd ../frontend
npm run build
npm run deploy:simple  # static 복사

# 2. 커밋 + 푸시
git add -A
git commit -m "feat(mediarc-report): Phase 1+2 5단계 여정 + AI 요약 캐싱

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main

# 3. 서버 pull + restart
sshpass -p '<SRV2_PW>' ssh \
  -o ProxyCommand='sshpass -p "<JUMP_PW>" ssh -W %h:%p -o StrictHostKeyChecking=no root@223.130.142.105' \
  -o StrictHostKeyChecking=no \
  root@10.0.1.6 'bash -s' <<'EOF'
cd /home/welno/workspace/PROJECT_WELNO_BEFE
sudo -u welno git pull origin main
sudo -u welno pip install -r planning-platform/backend/requirements.txt
sudo -u welno pm2 restart WELNO_BE
sleep 3
sudo -u welno pm2 logs WELNO_BE --lines 30 --nostream
EOF
```

### 12.4 Smoke test (ops-verifier)

```bash
# 1. 기존 엔드포인트 회귀
curl -sS "https://welno.kindhabit.com/welno-api/v1/partner-office/mediarc-report/{UUID}?hospital_id=PEERNINE" | jq .

# 2. 신규 AI GET (첫 호출은 404 기대)
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://welno.kindhabit.com/welno-api/v1/partner-office/mediarc-report/{UUID}/ai-summary?hospital_id=PEERNINE"

# 3. 신규 AI POST (force=false)
curl -sS -X POST \
  "https://welno.kindhabit.com/welno-api/v1/partner-office/mediarc-report/{UUID}/ai-summary?hospital_id=PEERNINE" \
  -H "Content-Type: application/json" \
  -d '{"force":false}' | jq .

# 4. GET 재호출 (200 캐시)
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://welno.kindhabit.com/welno-api/v1/partner-office/mediarc-report/{UUID}/ai-summary?hospital_id=PEERNINE"
```

- 브라우저에서 `HealthReportPage` → 환자 선택 → Drawer 내 ReportView 5단계 렌더링 및 AI 요약 버튼 동작 확인
- 브라우저 콘솔 에러 0건 확인

### 12.5 롤백 계획

#### FE 롤백
```bash
# 이전 커밋으로 리버트
git revert <commit>
git push origin main
# 서버: git pull + deploy:simple + pm2 restart WELNO_BE
```

#### BE 롤백
```bash
# FE와 동일하되 requirements.txt 충돌 가능성 체크
# anthropic 패키지 자체는 제거할 필요 없음 (의존성 없는 상태로 둬도 무해)
git revert <commit>
# 이후 동일
```

#### Migration 롤백 (최후 수단)
```sql
BEGIN;
DROP TABLE IF EXISTS welno.welno_mediarc_ai_summaries;
COMMIT;
```

- 데이터가 축적된 후 DROP은 주의. 가능하면 FE/BE 코드만 롤백하고 테이블은 유지.

### 12.6 모니터링

- PM2 logs: `sudo -u welno pm2 logs WELNO_BE --lines 100 --nostream`
- DB 테이블 증가 추이: `SELECT COUNT(*) FROM welno.welno_mediarc_ai_summaries;` 일일 모니터링
- Anthropic 사용량: `dashboard.anthropic.com` 주간 확인
- ES 에러 로그: ops-monitor가 평소 절차대로 감시

### 12.7 후속 작업 (post-deploy)

- 배포 기록 노션 게시 (ops-team, `/notion-deploy`)
- Phase 2+ 트렌드 데이터 슬롯 구현 (별도 이슈)
- Haiku → Sonnet 업그레이드 검토 (비용 vs 품질, fin-advisor 검토)

---

## 부록 A — 다음 에이전트 플랜

1. **dev-coder #1 (A)** 실행 — 본 스펙 10.1 A 항목
2. **dev-coder #2 (B)** 실행 — 병렬
3. **dev-coder #3 (C)** 실행 — 병렬
4. **dev-coder #4 (D)** 실행 — 병렬 (BE)
5. **dev-reviewer** 통합 리뷰 — 4 Sub-task 합친 diff 영향도, 중복/미사용 체크
6. **ops-team** — migration 실행 → 배포
7. **ops-verifier** — 본 스펙 11.4 smoke test + 5분 모니터링

`harby-routing.md` 견제 규칙: dev-coder × 4 → dev-reviewer (필수) → ops-team → ops-verifier (Level 1). 배포는 Level 3(하비 승인) 필수.

## 부록 B — 참고 문서 링크 (상대 경로)

- `planning-platform/docs/mediarc-report-deepdive.md`
- `planning-platform/docs/mediarc-report-phase0-spec.md`
- `memory/project-mediarc-report.md`
- `memory/welno-deploy.md`
- `memory/mediarc-api-keys.md`
- `memory/infra-master.md`
- `.claude/rules/welno-workflow.md`
- `.claude/rules/ops-workflow.md`
- `.claude/rules/team-governance.md`

## 부록 C — 변경 파일 전체 목록 (배포 단위)

신규 파일 (27):
- `backoffice/src/pages/HealthReportPage/components/ReportView.tsx`
- `backoffice/src/pages/HealthReportPage/components/ReportViewMetaPanel.tsx`
- `backoffice/src/pages/HealthReportPage/components/HeroBlock.tsx`
- `backoffice/src/pages/HealthReportPage/components/AiSummaryButton.tsx`
- `backoffice/src/pages/HealthReportPage/components/AiSummaryText.tsx`
- `backoffice/src/pages/HealthReportPage/components/RiskFactorsBlock.tsx`
- `backoffice/src/pages/HealthReportPage/components/DiseaseGrid.tsx`
- `backoffice/src/pages/HealthReportPage/components/DiseaseCard.tsx`
- `backoffice/src/pages/HealthReportPage/components/DiseaseFactorChip.tsx`
- `backoffice/src/pages/HealthReportPage/components/BeforeAfterBlock.tsx`
- `backoffice/src/pages/HealthReportPage/components/BeforeAfterRow.tsx`
- `backoffice/src/pages/HealthReportPage/components/WillRogersCaption.tsx`
- `backoffice/src/pages/HealthReportPage/components/ImprovementLabelsChip.tsx`
- `backoffice/src/pages/HealthReportPage/components/MilestoneSlot.tsx`
- `backoffice/src/pages/HealthReportPage/components/TrendSlot.tsx`
- `backoffice/src/pages/HealthReportPage/components/Disclosure.tsx`
- `backoffice/src/pages/HealthReportPage/components/TwobeconGridView.tsx`
- `backoffice/src/pages/HealthReportPage/components/DiseaseAgeList.tsx`
- `backoffice/src/pages/HealthReportPage/components/NutritionBlock.tsx`
- `backoffice/src/pages/HealthReportPage/components/GaugeBlock.tsx`
- `backoffice/src/pages/HealthReportPage/components/ReferencePmidList.tsx`
- `backoffice/src/pages/HealthReportPage/components/DiseaseDetailModal.tsx`
- `backoffice/src/pages/HealthReportPage/components/BodyAgeChart.tsx`
- `backoffice/src/pages/HealthReportPage/hooks/useAiSummary.ts`
- `backoffice/src/pages/HealthReportPage/styles/_report-view.scss`
- `backend/app/services/report_engine/ai_summary.py`
- `backend/migrations/2026-04-14_ai_summary.sql`

수정 파일 (5):
- `backoffice/src/pages/HealthReportPage/index.tsx`
- `backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts`
- `backend/app/api/v1/endpoints/partner_office.py`
- `backend/app/core/config.py`
- `backend/requirements.txt`

수정 없음 (보존):
- `backend/app/services/report_engine/facade.py` (Phase 0 완료)
- `backend/app/services/report_engine/engine.py` (동결)
- `backoffice/src/components/Drawer/Drawer.tsx` (인터페이스 변경 없음)
- `backoffice/src/components/kpi/*` / `backoffice/src/components/tabs/*`

## 부록 D — dev-coder 온보딩 체크리스트

각 Sub-task 착수 전:

- [ ] 본 스펙 1 ~ 7장 숙지
- [ ] 본 스펙 10장의 자기 담당 Sub-task 확인
- [ ] 본 스펙 부록 C에서 자기가 수정할 파일만 확인
- [ ] 2.1.3의 grep 명령으로 Phase 0 결과 재확인
- [ ] `_variables.scss` 토큰 목록 확인, 하드코딩 금지 재확인
- [ ] `memory/mediarc-api-keys.md` 보안 원칙 재확인
- [ ] 파일 잠금 (10.2) 준수 서약
- [ ] 커밋 단위 150줄 이하 준수 서약
- [ ] Co-Authored-By 포함 서약

완료 보고 시:

- [ ] 변경 파일 리스트
- [ ] LOC 실적 vs 예상
- [ ] 단위 테스트 결과 (pass / fail 건수)
- [ ] 타입체크 + 빌드 결과
- [ ] 잔여 TODO / 이슈
- [ ] dev-reviewer 호출 요청
