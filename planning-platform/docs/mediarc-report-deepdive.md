# mediArc 리포트 딥다이브 — 5단계 여정 기반 운영자 뷰 재설계

> 작성일: 2026-04-14
> 작성자: harby-coordinator (strategist / critic / innovator 3모드 통합)
> 후속: dev-planner 가 Phase 0 스펙을 바로 작성 가능한 수준
> 전제: engine.py 로직 동결, facade.py / useMediarcApi.ts / HealthReportPage 범위에서만 변경

---

## 1장. 경영 판단 요약

1. 엔진 로직은 준비 완료 (improved / will_rogers / disease_ages / applied_factors 전부 실존). FE 가 타입 레벨에서 필드를 "모르는 상태"라 UI 에 표시가 안 됐을 뿐이다. **Phase 0 는 타입 확장 + 컴포넌트 읽기 보강만으로 0.5일 작업**이다. 리스크: 타입 불일치로 런타임 undefined 참조 발생 가능 → graceful 폴백 필수.
2. 정의서의 5단계 여정(충격 → 이해 → 동기부여 → 실행 → 성취)을 **운영자 맥락으로 번역**한다. Step 1~3 은 운영자 검증에도 유효(환자 개별 문제 빠르게 파악), Step 4~5 는 소비자용이라 **운영자 뷰에서는 접이식 미리보기**로만 노출한다. 리스크: 정의서 전체를 복제하면 과잉 연출 → 운영자 업무 속도 저하.
3. 투비콘 복제(23페이지 섹션 그대로 옮기기)는 **부록 1개 블록**으로 축소한다. 운영자 핵심 가치는 "엔진이 뭘 뽑았고, 뽑은 값의 근거가 무엇인지"지, PDF 유사성 자체가 아니다. 리스크: 영업/제안서 용도로 투비콘 레이아웃을 요구할 경우 별도 PDF 경로 필요 → Phase 4 유보.

---

## 2장. 정의서 재정렬 — 리포트가 담아야 할 것

### 2.1 5단계 UX 여정 ↔ 엔진 필드 매핑

| Step | 소비자용 목적 | 운영자용 번역 | 의존 엔진 필드 | FE 컴포넌트 이름 |
|---|---|---|---|---|
| 1. 충격 | "이게 내 몸이다" | "이 환자의 한 줄 상태" | `bodyage.bodyage`, `bodyage.delta`, `rank` | `ReportView__ShockBlock` |
| 2. 이해 | "왜 그런가" | "엔진이 어떤 인자를 적용했나" | `diseases[*].applied_factors[]`, `diseases[*].chips[]`, `diseases[*].individual_rr` | `ReportView__FactorBlock` |
| 3. 동기부여 | "바꾸면 얼마나 좋아지나" | "개선 시나리오 시뮬 값 — 윌로저스 방지 반영됐나 검증" | `improved.ratios`, `improved.will_rogers[*]`, `diseases[*].improved_ratio/improved_rank/arr_pct` | `ReportView__BeforeAfterBlock` |
| 4. 실행 | "뭐부터 할까" | (운영자 미노출) | `improved.labels`, (v2.5 마일스톤 미구현) | `ReportView__MilestonePreview` (접이식) |
| 5. 성취 | "지난번 대비 얼마나 좋아졌나" | (시계열 2회 이상일 때만) | (v3.0 미구현, checkup_date 히스토리 필요) | `ReportView__TrendPreview` (접이식, 데이터 없으면 숨김) |

핵심: **Step 3 가 운영자에게 가장 가치가 크다**. 엔진의 핵심 차별점인 윌로저스 방지 로직이 실제로 어떤 값을 돌려주는지 검증하는 최전선이기 때문이다. Step 4~5 는 향후 소비자 앱 배포 시 필요한 훅 자리만 잡아두고, 현 시점에는 "데이터 준비 중" 플레이스홀더.

### 2.2 행동경제학 5원리 배치

| 원리 | 리포트 섹션 | 운영자 관점 활용 |
|---|---|---|
| 손실 회피 | `BeforeAfterBlock` 좌(현재) 붉은 톤 + 우(개선) 초록 톤 대비 | 시각 대비가 엔진 결과 해석의 방향성 확인용 |
| 현재 편향 깨기 | `MilestonePreview` (접이식, 미구현 상태 표시) | 미구현 단계 공개로 향후 로드맵 가시화 |
| 사회적 비교 | `ShockBlock.rank` 백분위 표시 + 코호트 캡션 | 코호트 정의(group 40M 등)를 운영자가 의심할 근거 제공 |
| 목표 설정·작은 승리 | `BeforeAfterBlock` ARR% + rank_change 뱃지 | "50% 감소 / 26등 상승" 숫자가 일관된지 검증 |
| 시간 여행 시뮬 | `DiseaseDetail.five_year` 미니 스파크라인 | 5년 예측이 급격히 꺾이는지 모니터 |

### 2.3 윌로저스 방지의 시각 표현 (필수 3요소)

```
[BeforeAfterBlock — 질환별 행]
┌─────────────────────────────────────────────────────────┐
│ 당뇨                                                     │
│ 현재 1.8배 (58등)  →  개선 후 0.9배 (32등)               │
│ ARR 50.0% 감소     |   26등 상승                          │
│ [캡션] 같은 코호트(40M, 흡연자 포함) 기준 고정           │
└─────────────────────────────────────────────────────────┘
```

3요소 모두 빠지면 윌로저스 방지의 의미가 사라진다:
- **원본 등수 vs 개선 등수 병기** — `orig_rank`, `improved_rank`, `rank_change`
- **상대비 + 절대 감소율 병기** — `orig_ratio`, `improved_ratio`, `arr_pct`
- **기준 코호트 명시** — `cohort_fixed: true` 플래그 기반 작은 캡션

운영자용 추가 시각 토큰: `rank_change > 10` 일 때 초록 상향 화살표, `arr_pct > 30` 일 때 굵은 글씨. 단순 숫자만 나열하면 운영자가 "이게 큰 변화인지 작은 변화인지" 판단을 못 한다.

---

## 3장. 내 초안 비평 (Critic 모드)

### 3.1 투비콘 복제에 기울어진 지점

초안 `mediarc-report-view-integration-spec.md` 6장 ASCII 다이어그램은 투비콘 PDF 섹션을 거의 그대로 나열했다:
- 4 KPI (건강나이 / 등수 / 투비콘 / AI 요약) → 투비콘 p3 복제
- 16 질환 4×4 그리드 → 투비콘 p5-15 축소 배열
- 신체 부위별 건강나이 다이어그램 → 투비콘 p16 복제
- 맞춤 영양 → 투비콘 p17 복제
- 참고문헌 PMID → 투비콘 p18-19 복제

결과적으로 "투비콘을 mediArc 용어로 다시 그린 페이지"가 됐다. 정의서 05 가 명확히 선언한 **"숫자를 보여주는 게 아니라 행동을 바꾸게 만드는 리포트"** 원칙이 실종됐다. 투비콘 자체가 Step 1~2 까지만 커버하는 정적 리포트인데, 그걸 복제하면 Step 3~5 가 날아간다.

### 3.2 5단계 여정을 놓친 이유

초안이 구조를 "섹션(종합/질환/영양/참고문헌)"으로 잡았기 때문이다. 이는 PDF 의 물리적 페이지 순서다. 정의서는 **시간축(환자가 리포트를 읽어 내려가며 감정/행동이 변하는 순서)**으로 구성돼 있는데, 이 차이를 인지하지 못하고 "큰 문서의 목차"를 따라갔다.

### 3.3 운영자 vs 소비자 관점 혼동

초안 "AI 요약" KPI 는 소비자용("간수치 우수, 대사증후군 경계 — 금주+BMI 감량 시 5년 위험 50% 감소")인데, 운영자 관점에서는:
- 운영자는 "엔진이 왜 그 결론을 냈나"가 핵심 질문 — AI 한 줄은 보조
- 운영자는 **imputed_fields / missing_fields** 를 먼저 본다 — "이 환자 데이터 어디가 추정값인가"
- 운영자는 **applied_factors 의 PMID** 를 누르면 논문 메타가 떠야 한다 — 소비자는 이 흐름을 안 본다

초안은 운영자 필요 정보(imputed/missing, PMID 검증, bioage_gb 로드 상태)를 그리드 안에 녹이지 못했다.

### 3.4 재설계 필요 지점 3가지

1. **레이아웃 축을 "시간축(Step 1~5)"으로 전환** — 섹션 축이 아니라 여정 축
2. **운영자 전용 메타 패널 추가** — imputed / missing / bioage_loaded / cohort_size 4종
3. **투비콘 복제는 부록 접이식 1블록**으로 축소 — "투비콘 호환 뷰" 토글 버튼 하나로 접근

---

## 4장. 재설계 — 5단계 여정 기반 레이아웃

### 4.1 최상위 구조 (Drawer 내 React JSX pseudocode)

```tsx
<Drawer open={!!expandedUuid} onClose={closeDrawer} width="xl" title={patient.name}>
  <div className="report-view">

    {/* 운영자 메타 — 항상 상단 고정 */}
    <ReportViewMetaPanel
      patient={report.patient_info}
      engineStats={stats}
      imputedFields={report.patient_info?.imputed_fields}
      missingFields={report.patient_info?.missing_fields}
    />

    {/* Step 1: 충격 — 3 KPI (건강나이 / 등수 / 델타) */}
    <section className="report-view__step report-view__step--shock">
      <h4 className="report-view__step-title">
        <span className="report-view__step-num">1</span> 현재 상태
      </h4>
      <KpiGrid cols={3}>
        <KpiCard label="건강나이" value={bodyage.toFixed(1)} unit="세"
                 hint={`${delta > 0 ? '+' : ''}${delta.toFixed(1)} vs 실나이`}
                 variant={delta > 3 ? 'danger' : delta < -2 ? 'success' : 'default'} />
        <KpiCard label="등수" value={`${rank}`} unit="/ 100"
                 hint={`상위 ${rank}%`}
                 variant={rank <= 30 ? 'success' : rank > 60 ? 'danger' : 'warning'} />
        <KpiCard label="bioage_gb" value={bioage_gb?.bioage_gb?.toFixed(1) ?? 'N/A'}
                 unit="세"
                 hint={bioage_gb ? `percentile ${bioage_gb.percentile}` : '모델 미로드'}
                 variant={bioage_gb ? 'default' : 'warning'} />
      </KpiGrid>
    </section>

    {/* Step 2: 이해 — 질환별 applied_factors 테이블 */}
    <section className="report-view__step report-view__step--understand">
      <h4 className="report-view__step-title">
        <span className="report-view__step-num">2</span> 위험 인자
      </h4>
      <DiseaseFactorTable diseases={report.diseases} />
    </section>

    {/* Step 3: 동기부여 — Before/After + 윌로저스 3요소 (핵심) */}
    <section className="report-view__step report-view__step--motivate">
      <h4 className="report-view__step-title">
        <span className="report-view__step-num">3</span> 개선 시나리오
      </h4>
      <ImprovementLabelsChip labels={report.improved?.labels} />
      <BeforeAfterBlock
        willRogers={report.improved?.will_rogers}
        cohortFixed={true}
      />
    </section>

    {/* Step 4: 실행 (접이식, 미구현 상태 배지) */}
    <Disclosure title="4. 실행 계획 (v2.5 예정)">
      <MilestonePreview improved={report.improved} status="planned" />
    </Disclosure>

    {/* Step 5: 성취 (접이식, 시계열 데이터 없으면 자동 숨김) */}
    {report.trend && (
      <Disclosure title="5. 재검진 추이">
        <TrendPreview trend={report.trend} />
      </Disclosure>
    )}

    {/* 부록: 투비콘 호환 뷰 (16 질환 4×4 그리드) */}
    <Disclosure title="부록 · 투비콘 호환 뷰 (16 질환 그리드)">
      <TwobeconGridView diseases={report.diseases} />
    </Disclosure>

    {/* 부록: 장기별 건강나이 */}
    {report.disease_ages && (
      <Disclosure title="부록 · 장기별 건강나이">
        <DiseaseAgeList diseaseAges={report.disease_ages} />
      </Disclosure>
    )}

    {/* 부록: 영양 권고 */}
    {report.nutrition && (
      <Disclosure title="부록 · 영양 권고">
        <NutritionBlock nutrition={report.nutrition} />
      </Disclosure>
    )}

    {/* 부록: 검진 수치 게이지 */}
    {report.gauges && (
      <Disclosure title="부록 · 검진 수치 게이지">
        <GaugeBlock gauges={report.gauges} />
      </Disclosure>
    )}

    {/* 부록: 참고 PMID */}
    <Disclosure title="부록 · 참고 문헌 (PMID)">
      <ReferencePmidList diseases={report.diseases} />
    </Disclosure>
  </div>
</Drawer>
```

### 4.2 BEM 클래스명 규약

기존 `.app-drawer`, `.kpi-grid`, `.kpi-card`, `.tab-bar`, `.page` 네임스페이스는 그대로 유지. 신규는 `.report-view` 로 분리.

| 클래스 | 역할 |
|---|---|
| `.report-view` | 루트 컨테이너 (Drawer body 직속) |
| `.report-view__meta` | 상단 고정 메타 패널 |
| `.report-view__step` | 5단계 여정 섹션 공통 |
| `.report-view__step--shock` | Step 1 변형자 |
| `.report-view__step--understand` | Step 2 변형자 |
| `.report-view__step--motivate` | Step 3 변형자 (핵심) |
| `.report-view__step-num` | 단계 번호 원형 뱃지 |
| `.report-view__step-title` | 섹션 제목 |
| `.report-view__before-after` | Step 3 내 Before/After 블록 |
| `.report-view__before-after__row` | 질환별 행 |
| `.report-view__before-after__delta` | rank_change / arr_pct 뱃지 |
| `.report-view__cohort-caption` | 기준 코호트 캡션 |
| `.report-view__factor` | Step 2 인자 칩 |
| `.report-view__factor--present` | 적용된 인자 |
| `.report-view__disclosure` | 접이식 블록 (부록) |
| `.report-view__disclosure--planned` | 미구현 상태 배지 |
| `.report-view__pmid-link` | PMID 호버 링크 |

### 4.3 단계별 엔진 필드 의존 정리

| Step | 필수 필드 | 선택 필드 | 필드 부재 시 동작 |
|---|---|---|---|
| 1 | `bodyage.bodyage`, `bodyage.delta`, `rank` | `bodyage.bioage_gb` | bioage_gb 없으면 3번째 KPI `variant=warning` + "모델 미로드" |
| 2 | `diseases[*].applied_factors`, `diseases[*].chips` | `diseases[*].individual_rr` | applied_factors 빈 배열 → "인자 없음" 행 |
| 3 | `improved.will_rogers`, `improved.labels` | `improved.has_improvement` | will_rogers 빈 객체 → 섹션 전체 `hidden` + 플레이스홀더 "개선 시나리오 데이터 없음" |
| 4 | (v2.5 대기) | `improved.labels` | 현재 상태: "v2.5 예정" 배지, 접이식 기본 닫힘 |
| 5 | (v3.0 대기, checkup_date 시계열) | 없음 | 데이터 없으면 섹션 자체 null 반환 |
| 부록 투비콘 | `diseases` 전체 | 없음 | 비어있으면 접이식 숨김 |
| 부록 장기 | `disease_ages` | 없음 | null/{} → 숨김 |
| 부록 영양 | `nutrition.recommend` | `nutrition.caution` | null → 숨김 |
| 부록 게이지 | `gauges.all` | 없음 | null → 숨김 |
| 부록 PMID | `diseases[*].applied_factors[*].pmid` | `source`, `confidence` | pmid 없는 factor → "출처 미확인" 표기 |

### 4.4 반응형 / iframe 고려

- `Drawer width="xl"` (80%) — iframe 모드에서는 `containment="container"` 가 자동 적용되어 부모 페이지 영역 침범 방지 (`Drawer.tsx:76`)
- `KpiGrid` 는 1024px 이하 2열, 767px 이하 1열 자동 (`KpiGrid.tsx:7-8`)
- `BeforeAfterBlock` 은 flex row → 767px 이하 column wrap
- `Disclosure` 는 `<details>/<summary>` 시맨틱 태그 사용, 키보드 접근성 자동 확보
- 모든 섹션 간 간격 `$spacing-lg` (1.5rem)

---

## 5장. 공용 컴포넌트 재사용 계약

### 5.1 재사용 (수정 금지, import 만)

| 컴포넌트 | 위치 | 리포트 뷰 내 용도 |
|---|---|---|
| `PageLayout` | `components/layout/PageLayout.tsx` | HealthReportPage 루트 — 그대로 유지, 수정 없음 |
| `PageHeader` | `components/layout/PageHeader.tsx` | 페이지 상단 제목 + 엑셀 버튼 — 그대로 유지 |
| `Drawer` | `components/Drawer/Drawer.tsx` | `width="xl"` 로 환자 상세 전개 — props `width` 만 `lg` → `xl` 변경 |
| `KpiGrid` | `components/kpi/KpiGrid.tsx` | Step 1 3열 배치 — `cols={3}` |
| `KpiCard` | `components/kpi/KpiCard.tsx` | Step 1 카드 3장, 부록 없음 — variant 활용 |
| `TabBar` | `components/tabs/TabBar.tsx` | 페이지 상단 메인 탭(환자/전수검증) — 기존 유지. Drawer 내부 서브탭은 제거 (리포트 1장으로 통합) |
| `FilterBar` | `components/filters/FilterBar.tsx` | 환자 목록 검색 — 기존 유지 |
| `HospitalSearch` | `components/HospitalSearch/HospitalSearch.tsx` | 병원 필터 — 기존 유지 |
| `Spinner` | `components/Spinner` | 로딩 — 기존 유지 |

### 5.2 신규 하위 컴포넌트 (리포트 뷰 전용)

모두 `pages/HealthReportPage/components/` 하위에 생성.

```tsx
// ReportView.tsx — 최상위 오케스트레이터
interface ReportViewProps {
  report: ReportData;
  engineStats: EngineStats | null;
}

// ReportViewMetaPanel.tsx — 운영자 메타 (imputed / missing / bioage_loaded)
interface ReportViewMetaPanelProps {
  patient: { age: number; sex: string; group: string };
  imputedFields?: string[];
  missingFields?: string[];
  bioageLoaded: boolean;
}

// ShockBlock.tsx — Step 1 (KpiGrid 래퍼만)
interface ShockBlockProps {
  bodyage: BodyAge;
  rank: number;
}

// DiseaseFactorTable.tsx — Step 2
interface DiseaseFactorTableProps {
  diseases: Record<string, DiseaseDetail>;
  /** 테이블 모드: 'compact' (질환명 + 주요 인자 3) | 'full' (전 인자) */
  mode?: 'compact' | 'full';
  /** PMID 클릭 시 외부 링크 여부 (기본 true) */
  pmidLinkEnabled?: boolean;
}

// DiseaseFactorChip.tsx — applied_factor 1건 표시
interface DiseaseFactorChipProps {
  factor: AppliedFactor;  // { factor, rr, pmid, source, confidence }
  present: boolean;       // chips_present 반영
}

// BeforeAfterBlock.tsx — Step 3 핵심 (윌로저스 3요소)
interface BeforeAfterBlockProps {
  willRogers: Record<string, WillRogersEntry>;
  cohortFixed: boolean;
  /** 표시 제한 — 기본 전체 (16질환). 'top-risk' 시 rank 낮은 상위 5개만 */
  filter?: 'all' | 'top-risk' | 'has-improvement';
}

// BeforeAfterRow.tsx — Step 3 각 질환 1행
interface BeforeAfterRowProps {
  diseaseName: string;
  entry: WillRogersEntry;
}

// ImprovementLabelsChip.tsx — improved.labels 표시 ("BMI 23 미만" / "금연" / "금주")
interface ImprovementLabelsChipProps {
  labels?: Record<string, string>;
}

// MilestonePreview.tsx — Step 4 (v2.5 플레이스홀더)
interface MilestonePreviewProps {
  improved?: ImprovedScenario;
  status: 'planned' | 'partial' | 'ready';
}

// TrendPreview.tsx — Step 5 (v3.0 플레이스홀더)
interface TrendPreviewProps {
  trend?: TrendSeries;
}

// Disclosure.tsx — 접이식 블록 공용
interface DisclosureProps {
  title: string;
  defaultOpen?: boolean;
  plannedBadge?: boolean;
  children: React.ReactNode;
}

// TwobeconGridView.tsx — 부록 (16 질환 4×4)
interface TwobeconGridViewProps {
  diseases: Record<string, DiseaseDetail>;
}

// DiseaseAgeList.tsx — 부록 (장기별 건강나이)
interface DiseaseAgeListProps {
  diseaseAges: Record<string, number>;
}

// NutritionBlock.tsx — 부록 (기존 로직 재활용 가능)
interface NutritionBlockProps {
  nutrition: { recommend: NutrientItem[]; caution?: NutrientItem[] };
}

// GaugeBlock.tsx — 부록 (기존 테이블 재활용)
interface GaugeBlockProps {
  gauges: { all: Record<string, GaugeItem> };
}

// ReferencePmidList.tsx — 부록 (전 질환 applied_factors 의 unique PMID 집계)
interface ReferencePmidListProps {
  diseases: Record<string, DiseaseDetail>;
}
```

### 5.3 신규 SCSS 파일 `_report-view.scss`

토큰 사용 예 (하드코딩 금지):

```scss
@import '../../styles/variables';

.report-view {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  font-family: $font-family-base;
  color: $gray-900;

  &__meta {
    padding: $spacing-sm $spacing-md;
    background: $gray-50;
    border: 1px solid $gray-300;
    border-radius: $border-radius-md;
    font-size: $font-xs;
    color: $gray-700;
  }

  &__step {
    padding-top: $spacing-md;
    border-top: 1px solid $gray-200;

    &--shock .kpi-card__value { font-size: $font-3xl; }
    &--motivate { background: $beige-cream; padding: $spacing-md; border-radius: $border-radius-lg; }
  }

  &__step-num {
    display: inline-flex;
    width: 22px; height: 22px;
    align-items: center; justify-content: center;
    background: $brand-brown;
    color: $white;
    border-radius: 50%;
    font-size: $font-xs;
    font-weight: $font-weight-bold;
    margin-right: $spacing-xs;
  }

  &__step-title {
    font-size: $font-lg;
    font-weight: $font-weight-semibold;
    margin: 0 0 $spacing-md;
    color: $brand-brown-darker;
  }

  &__before-after {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;

    &__row {
      display: grid;
      grid-template-columns: 120px 1fr 1fr auto;
      align-items: center;
      gap: $spacing-sm;
      padding: $spacing-xs $spacing-sm;
      border-radius: $border-radius-sm;

      &:nth-child(even) { background: $gray-50; }
    }

    &__delta {
      display: inline-flex;
      align-items: center;
      padding: 2px $spacing-xs;
      border-radius: $border-radius-sm;
      font-size: $font-xs;
      font-weight: $font-weight-bold;

      &--improve { background: rgba($success, 0.12); color: $success; }
      &--no-change { background: $gray-100; color: $gray-600; }
      &--worse { background: rgba($error, 0.12); color: $error; }
    }
  }

  &__cohort-caption {
    font-size: $font-2xs;
    color: $gray-500;
    margin-top: $spacing-xs;
  }

  &__factor {
    display: inline-flex;
    padding: 2px $spacing-xs;
    margin: 2px;
    border-radius: $border-radius-sm;
    font-size: $font-xs;

    &--present { background: $brand-brown-light; color: $brand-brown-darker; }
    &--absent { background: $gray-100; color: $gray-500; }
  }

  &__disclosure {
    border: 1px solid $gray-300;
    border-radius: $border-radius-md;

    &--planned summary { color: $warning; }
  }

  &__pmid-link {
    color: $chart-blue;
    text-decoration: underline;
    font-size: $font-xs;

    &:hover { color: $chart-deep-blue; }
  }
}

@media (max-width: $bp-mobile-max) {
  .report-view__before-after__row {
    grid-template-columns: 1fr;
  }
}
```

병존 원칙: 기존 `.hr-expanded__*`, `.health-report__*` 클래스는 삭제하지 않는다. 리포트 뷰 도입 후 기존 서브탭 코드(DetailContent) 가 unused 로 판정되면 Phase 1 마지막 단계에서 삭제.

---

## 6장. 엔진-FE 중계 (facade.py + ReportData 타입)

### 6.1 facade.py 현재 상태 (실독)

`backend/app/services/report_engine/facade.py:134-147` 에서 이미 반환 중:

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
    "improved": raw.get("improved", {}),       # 이미 포함
    "disease_ages": raw.get("disease_ages", {}), # 이미 포함
    "patient_info": {"age": age_val, "sex": raw.get("sex"), "group": raw.get("group")},
    "nutrition": nutrition_result,
}
```

**중요 팩트 정정**: 내 초안이 "facade 에서 drop 중"이라 적은 건 **오판**이다. facade 는 이미 improved / disease_ages 를 포함해 반환한다. 실제 gap 은 (1) `patient_info` 가 단순 dict 로 축소돼 `imputed_fields` / `missing_fields` 가 빠진다. (2) FE `ReportData` 타입에 `improved`, `disease_ages`, `applied_factors` 필드 정의가 없어 타입 레벨에서 접근 불가. (3) `diseases` 가 `Record<string, { rank: number; rate?: number }>` 로 너무 좁아 chips/applied_factors/improved_* 를 TypeScript 가 모른다.

### 6.2 facade.py 에 필요한 최소 변경 (Phase 0)

```python
# facade.py:144 근처 patient_info 확장
"patient_info": {
    "age": age_val,
    "sex": raw.get("sex"),
    "group": raw.get("group"),
    "imputed_fields": raw.get("imputed_fields", []),
    "missing_fields": raw.get("missing_fields", []),
},
```

변경 라인 수: 3-4 줄. `raw` 가 이 필드를 반환하는지 먼저 engine.py 쪽에서 확인 필요 (engine.py 수정 금지 원칙 준수 — 이미 있으면 OK, 없으면 facade 단에서 빈 배열 기본값).

### 6.3 ReportData TypeScript interface 확장 (하위 호환)

`backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts` 기존 타입은 **삭제하지 않고 확장**한다.

```ts
// ── 기존 타입 (유지) ──
export interface BodyAge {
  bodyage: number;
  delta: number;
  bioage_gb?: BioageGbResult | null;  // 추가 (optional)
}

export interface BioageGbResult {
  bioage_gb: number;
  score?: number;
  percentile?: number;
}

// ── 신규 타입 (추가) ──
export interface AppliedFactor {
  factor: string;          // 인자명 (예: "BMI 과체중")
  rr: number;              // 상대위험도 배수
  pmid?: string;           // 예: "15914503"
  source?: string;         // 예: "Woodward 2005"
  confidence?: 'high' | 'medium' | 'low';
}

export interface DiseaseChip {
  name: string;
  present: boolean;
}

export interface DiseaseDetail {
  // 기존 rank / rate 유지
  rank: number;
  rate?: number;

  // 신규 선택 필드 (엔진 반환, FE 는 optional 로 graceful)
  individual_rr?: number;
  cohort_mean_rr?: number;
  ratio?: number;
  grade?: '정상' | '경계' | '이상';
  chips?: DiseaseChip[];
  chips_present?: number;
  chips_total?: number;
  five_year?: number[];
  applied_factors?: AppliedFactor[];

  // 질환별 improved (engine 은 반환하지만 improved.will_rogers 랑 중복이라 optional)
  improved_ratio?: number;
  improved_rank?: number;
  rank_change?: number;
  arr_pct?: number;
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
  labels?: Record<string, string>;  // {bmi: "BMI 23미만", smoking: "금연", ...}
  improved_sbp?: number;
  improved_dbp?: number;
  improved_fbg?: number;
  ratios?: Record<string, number>;
  five_year_improved?: Record<string, number[]>;
  will_rogers?: Record<string, WillRogersEntry>;
  has_improvement?: boolean;
}

export interface PatientInfo {
  age: number;
  sex: string;
  group?: string;
  imputed_fields?: string[];
  missing_fields?: string[];
}

// ── ReportData 확장 (기존 필드는 전부 유지) ──
export interface ReportData {
  name: string;
  age: number;
  sex: string;
  group: string;
  bodyage: BodyAge;
  rank: number;
  diseases: Record<string, DiseaseDetail>;  // 타입만 확장 (rank/rate 여전히 접근 가능)
  nutrition: { recommend: NutrientItem[]; caution?: NutrientItem[] } | null;
  gauges: { all: Record<string, GaugeItem> } | null;
  patient_info: PatientInfo;  // Record<string, any> → PatientInfo 로 좁힘

  // 신규 optional 필드
  improved?: ImprovedScenario;
  disease_ages?: Record<string, number>;
  trend?: TrendSeries;  // Step 5 미구현, placeholder
}

// 시계열 (v3.0 대비, 현재는 undefined)
export interface TrendSeries {
  checkups: Array<{
    date: string;
    bodyage: number;
    rank: number;
  }>;
}
```

### 6.4 하위 호환 보장

- 기존 필드(`rank`, `rate`, `bodyage.bodyage`, `bodyage.delta` 등) 전부 유지
- 신규 필드는 전부 optional (`?`) — 엔진이 반환 안 해도 런타임 안전
- `diseases[*].rank` 는 모든 질환에 여전히 존재 (engine 보장) — 기존 DetailContent `diseases` 탭의 `d.rank` 참조 유지됨
- `patient_info` 가 `Record<string, any>` → `PatientInfo` 로 좁혀지면서 기존 코드에서 `patient_info.xxx` 임의 접근은 없었는지 grep 필요 (실제로 HealthReportPage 에서는 `patient_info` 를 렌더하지 않고 있어 영향 없음 — `index.tsx` 전체 grep 결과 `patient_info` 사용 0건)

### 6.5 응답 예시 JSON (Phase 0 완료 후)

```json
{
  "name": "안광수",
  "age": 43,
  "sex": "M",
  "group": "40M",
  "bodyage": {
    "bodyage": 36.9,
    "delta": -6.1,
    "bioage_gb": { "bioage_gb": 37.4, "score": 0.34, "percentile": 42 }
  },
  "rank": 30,
  "diseases": {
    "당뇨": {
      "rank": 1, "rate": 0.2,
      "individual_rr": 1.5, "cohort_mean_rr": 6.274,
      "ratio": 0.2, "grade": "정상",
      "chips": [
        {"name": "가족력", "present": false},
        {"name": "BMI 과체중", "present": true}
      ],
      "chips_present": 1, "chips_total": 7,
      "five_year": [0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
      "applied_factors": [
        {"factor": "BMI 과체중", "rr": 3.0, "pmid": "20220108", "source": "Abdullah 2010", "confidence": "high"}
      ],
      "improved_ratio": 0.15, "improved_rank": 1, "rank_change": 0, "arr_pct": 25.0
    }
  },
  "nutrition": {
    "recommend": [{"name": "오메가3", "tag": "심혈관", "desc": "..."}],
    "caution": []
  },
  "gauges": { "all": { "bmi": { "value": 28.73, "label": "이상", "range": "정상 18.5-23" } } },
  "patient_info": {
    "age": 43, "sex": "M", "group": "40M",
    "imputed_fields": ["ldl"],
    "missing_fields": ["hdl", "tg"]
  },
  "improved": {
    "labels": { "bmi": "BMI 23미만", "smoking": "금연" },
    "improved_sbp": 128.5, "improved_dbp": 76.2, "improved_fbg": 105.0,
    "ratios": { "당뇨": 0.15 },
    "will_rogers": {
      "당뇨": {
        "orig_ratio": 0.2, "improved_ratio": 0.15,
        "orig_rank": 1, "improved_rank": 1,
        "rank_change": 0, "arr_pct": 25.0,
        "cohort_fixed": true
      }
    },
    "has_improvement": true
  },
  "disease_ages": { "뇌": 40.2, "심장": 38.5, "신장": 37.8, "간": 36.9 }
}
```

---

## 7장. Phase 별 실행 로드맵

### Phase 0 — 중계/타입 확장 (0.5일)

**변경 파일**
- `backend/app/services/report_engine/facade.py` — `patient_info` 에 `imputed_fields` / `missing_fields` 추가 (3-4줄)
- `backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts` — 타입 확장 (약 80줄 추가, 기존 삭제 0줄)

**AST 변경 요약**
- facade.py: `patient_info` dict literal 확장 1곳
- useMediarcApi.ts: `BodyAge`, `ReportData` interface 에 optional 필드 추가 + `ImprovedScenario`, `WillRogersEntry`, `DiseaseDetail`, `AppliedFactor`, `DiseaseChip`, `PatientInfo`, `BioageGbResult`, `TrendSeries` 신규 export

**수용 조건**
- [ ] `fetchReport(uuid)` 호출 시 `report.improved?.will_rogers?.당뇨?.arr_pct` 가 타입 에러 없이 접근 가능
- [ ] `report.diseases["당뇨"].applied_factors` 가 타입 에러 없이 접근 가능
- [ ] 기존 `report.diseases["당뇨"].rank` 접근이 여전히 정상 작동 (회귀 0)
- [ ] `tsc --noEmit` 에러 0건
- [ ] 브라우저 콘솔 에러 0건 (기존 DetailContent 렌더 동일)
- [ ] pytest (backend) 통과 — facade.generate_report 반환 키 `improved`, `disease_ages` 존재 확인

**회귀 범위**
- HealthReportPage 전체 (환자 목록 / Drawer / 서브탭 4종)
- `ReportData` 를 import 하는 다른 페이지 grep 필요 (`grep -r 'ReportData' backoffice/src/`)

**iframe 영향**: 없음 (타입만 확장)

**롤백 계획**
- facade.py: `patient_info` 딕셔너리 원복 (git revert 대상 1 commit)
- useMediarcApi.ts: 신규 interface 삭제, `ReportData` 원복 (git revert)
- 롤백 자동 가능 — 기존 코드는 신규 필드를 참조하지 않으므로

---

### Phase 1 — 리포트 뷰 컴포넌트 (2-3일)

**변경 파일**
- 신규: `backoffice/src/pages/HealthReportPage/components/ReportView.tsx` (오케스트레이터)
- 신규: `components/ReportViewMetaPanel.tsx`, `ShockBlock.tsx`, `DiseaseFactorTable.tsx`, `DiseaseFactorChip.tsx`, `BeforeAfterBlock.tsx`, `BeforeAfterRow.tsx`, `ImprovementLabelsChip.tsx`, `MilestonePreview.tsx`, `TrendPreview.tsx`, `Disclosure.tsx`, `TwobeconGridView.tsx`, `DiseaseAgeList.tsx`, `NutritionBlock.tsx`, `GaugeBlock.tsx`, `ReferencePmidList.tsx`
- 신규: `backoffice/src/pages/HealthReportPage/components/_report-view.scss`
- 수정: `backoffice/src/pages/HealthReportPage/index.tsx` — Drawer 내부 `DetailContent` 를 `<ReportView data={report} engineStats={stats} />` 로 교체. Drawer width `lg` → `xl`. 서브탭 TabBar 제거(리포트 1장 통합).

**150줄 분할 정책 준수**
- `ReportView.tsx` — 약 70줄 (섹션 오케스트레이션만)
- 각 하위 컴포넌트 — 50~120줄 범위
- `_report-view.scss` — 약 130줄
- `index.tsx` 수정 — 최대 40줄 변경 (DetailContent 제거 + ReportView 삽입)

**수용 조건**
- [ ] Step 1~3 3개 섹션이 Drawer 안에 모두 렌더
- [ ] Step 3 BeforeAfterBlock 의 모든 행에 orig_rank / improved_rank / rank_change / arr_pct 4개 수치 표시
- [ ] cohort_fixed 캡션이 BeforeAfterBlock 하단에 표시
- [ ] 부록 5종(투비콘 / 장기 / 영양 / 게이지 / PMID) 접이식, 기본 닫힘
- [ ] `report.improved` undefined 시 Step 3 섹션에 플레이스홀더 렌더, 에러 없음
- [ ] `report.disease_ages` 없으면 부록 "장기별 건강나이" 자동 숨김
- [ ] iframe 모드(`?embed=1`)에서 Drawer xl 폭이 부모 영역 침범 없음 (`containment="container"` 자동)
- [ ] 1024px 이하 태블릿에서 KpiGrid 2열 / BeforeAfterBlock row 세로 전환
- [ ] 767px 이하 모바일에서 KpiGrid 1열
- [ ] 브라우저 콘솔 에러 0건

**회귀 범위**
- 기존 DetailContent 의 4 서브탭(질환예측 / 검진수치 / 영양추천 / 투비콘 비교) 기능이 ReportView 내부에 전부 녹아있어야 함
- `comparison` 탭 → 부록 "투비콘 비교"로 이관 or 별도 "투비콘 비교" Disclosure 하나 추가 (comparison 데이터 있을 때만)
- 전수검증 탭(`activeTab === 'verify'`)은 영향 없음

**iframe 영향**
- Drawer `width="xl"` 은 80% — iframe 부모 페이지 폭에 상대적. `containment="container"` 자동 적용으로 부모 침범 없음
- `useEmbedParams()` 로 hospital_id 필터 기존 동작 유지

**롤백 계획**
- `index.tsx` 의 `<ReportView>` 를 기존 `<DetailContent>` 로 revert (1 commit 범위)
- 신규 컴포넌트/SCSS 파일은 delete 가능 (deploy 번들 크기만 영향)
- ReportData 타입 확장은 Phase 0 이라 유지해도 무해

---

### Phase 2 — AI 한 줄 요약 (0.5일, 선택)

**변경 파일**
- `backend/app/services/report_engine/ai_summary.py` (신규) — Claude Haiku 호출
- `backend/app/services/report_engine/facade.py` — 응답에 `ai_summary: string | null` 추가
- `backoffice/src/pages/HealthReportPage/components/ReportView.tsx` — Step 1 상단에 요약 문장 표시

**캐시**
- Redis `mediarc:summary:{uuid}:{checkup_date}` TTL 30일
- 요약 입력: bodyage, delta, rank, improved.has_improvement, top 3 위험 질환
- 프롬프트: "운영자용 1줄 요약. 의학적 소견 금지, 가이드라인 제시 OK. 한국어 40자 이내."

**비용**
- Haiku 입력 ~500 토큰, 출력 ~60 토큰, 건당 $0.0002
- 환자 1000명 = $0.20, 월 5000건 기준 $1/월 (초안 $5~10 추정은 과다)

**수용 조건**
- [ ] Redis 연결 실패 시 `ai_summary: null` 반환, FE 섹션 숨김 (graceful)
- [ ] 한글 40자 이내 보장
- [ ] 의학적 소견("당뇨입니다" 등) 포함 시 필터 (`marketing-rules.md` 3항)
- [ ] 3회 테스트로 동일 uuid 에 대해 동일 요약 반환(캐시 검증)

**회귀 범위**: ReportView 헤더만 — 없으면 null 이라 렌더 없음

**iframe 영향**: 없음

**롤백 계획**: facade.py `ai_summary` 키 제거 + FE 조건 렌더 제거 (2 commit)

---

### Phase 3 — What-If 동적 슬라이더 (Sprint 3, 유보, 2주)

**변경 파일**
- `p9_mediArc_engine/demo/engine.py` — `recalculate_with_behavior_change(patient, changes)` 신규 함수 (R&D sandbox 에서 먼저 검증)
- WELNO 이식: `backend/app/services/report_engine/engine.py` 수동 복사
- `backend/app/services/report_engine/facade.py` — `recalculate_report(uuid, behavior_changes)` 파사드 추가
- `backend/app/api/v1/endpoints/partner_office.py` — 신규 엔드포인트 `POST /partner-office/mediarc-report/{uuid}/whatif`
- `useMediarcApi.ts` — `recalculateReport(uuid, changes)` 함수
- `ReportView.tsx` — Step 3 위에 WhatIfSliderPanel 추가
- 신규: `WhatIfSliderPanel.tsx` (BMI / 금연 / 금주 / 운동 4 슬라이더, debounce 500ms)

**유보 사유**
- engine 로직 수정 금지 원칙에 반함 → Sprint 3 로 격리
- Phase 0~1 완료 후 운영자 피드백(정적 Before/After 로 충분한가? 슬라이더 필요한가?) 보고 결정
- What-If 재계산 시 PMID 근거 체인이 그대로 유지되는지 검증 필요

---

### Phase 4 — PDF 렌더링 (유보)

정의서 기술 로드맵 v1.0(8주) 수준의 별건 프로젝트. 본 딥다이브 범위 외.

---

## 8장. 라우팅 · 에이전트 스폰 계획

### 8.1 Phase 0 (즉시 실행 가능)

| 순서 | 에이전트 | 작업 | 참조 파일 | 파일 잠금 |
|---|---|---|---|---|
| 1 | dev-planner | 본 딥다이브 6.2, 6.3 섹션 읽고 Phase 0 스펙 문서 작성 (TypeScript interface 전문 + facade.py diff 전문 + 수용 조건 체크리스트) | `docs/mediarc-report-deepdive.md` 6장 | 없음 (docs 만 작성) |
| 2 | dev-coder A | facade.py `patient_info` 확장 (backend 단독) | `backend/app/services/report_engine/facade.py` | facade.py |
| 3 | dev-coder B | useMediarcApi.ts 타입 확장 (frontend 단독) | `backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts` | useMediarcApi.ts |
| 4 | dev-reviewer | 2+3 완료 후 타입 일관성 검증 + `tsc --noEmit` + pytest backend | 변경 파일 2개 | read-only |
| 5 | ops-team | `npm run build` (backoffice) + `uvicorn --reload` (backend) 빌드 검증 | — | read-only |

2, 3 은 **파일이 완전히 분리돼 있어 병렬 가능**. dev-lead 가 2명 dev-coder 병렬 spawn.

### 8.2 Phase 1 (dev-planner 스펙 확정 후)

| 순서 | 에이전트 | 작업 | 파일 잠금 |
|---|---|---|---|
| 1 | dev-planner | Phase 1 상세 스펙 (각 컴포넌트 Props + 빈 상태 + 반응형 상세) | 없음 |
| 2 | dev-coder A | `_report-view.scss` + `Disclosure.tsx` + `ReportView.tsx` (오케스트레이터) | _report-view.scss, Disclosure.tsx, ReportView.tsx |
| 3 | dev-coder B | Step 1~2 컴포넌트 (`ShockBlock`, `ReportViewMetaPanel`, `DiseaseFactorTable`, `DiseaseFactorChip`) | 해당 4파일 |
| 4 | dev-coder C | Step 3 컴포넌트 (`BeforeAfterBlock`, `BeforeAfterRow`, `ImprovementLabelsChip`, `MilestonePreview`, `TrendPreview`) | 해당 5파일 |
| 5 | dev-coder D (2~4 완료 후 순차) | `index.tsx` 의 DetailContent 제거 + `<ReportView>` 삽입 + Drawer width xl | index.tsx |
| 6 | dev-coder E (5 이후 병렬 가능) | 부록 컴포넌트 (`TwobeconGridView`, `DiseaseAgeList`, `NutritionBlock`, `GaugeBlock`, `ReferencePmidList`) | 해당 5파일 |
| 7 | dev-reviewer | 전체 리뷰 — 공용 컴포넌트 재사용 적절성 / 하드코딩 없음 / BEM 네임스페이스 / iframe containment / 반응형 | 전체 read-only |
| 8 | ops-team | 백오피스 빌드 + Playwright E2E (Drawer 열기 / Step 3 에서 윌로저스 3요소 표시 확인) | — |
| 9 | ops-verifier | 배포 후 브라우저 콘솔 에러 0 / iframe 에서 Drawer 정상 동작 / 운영자 피드백 대기 | read-only |

2, 3, 4 병렬 가능(파일 무교차). 5 는 index.tsx 단독 수정이라 2~4 완료 후 시작. 6 은 5 이후 병렬.

### 8.3 에이전트에게 전달할 공통 스펙 이름

- 본 문서: `docs/mediarc-report-deepdive.md`
- Phase 0 상세: (dev-planner 신규 작성 예정) `docs/mediarc-report-phase0-spec.md`
- Phase 1 상세: (dev-planner 신규 작성 예정) `docs/mediarc-report-phase1-spec.md`
- 엔진 필드 원천: `PEERNINE/p9_mediArc_engine/demo/engine.py` (읽기 전용, 수정 금지)
- 정의서: `PEERNINE/p9_mediArc_engine/phase3_our_design/05_patient_motivation_strategy.md`
- 초안 (이번 비평 대상): `PROJECT_WELNO_BEFE/planning-platform/docs/mediarc-report-view-integration-spec.md`

---

## 부록 A — 전략 / 비판 / 혁신 3모드 통합 메모

### Strategist — 포지셔닝 고수

백오피스 = "엔진 품질 검증 도구" 로 포지셔닝. 소비자용 리포트와 **다른 제품**. Porter 전략 관점으로 "어느 고객에게 무엇을 팔지"가 분명해야 한다.
- 소비자용: 행동변화 유도, 감정 자극, PDF 렌더링, 마일스톤/게이미피케이션
- 운영자용(백오피스): 엔진 출력 검증, 근거 추적, imputed/missing 확인, 배치 전수검증
- 두 제품은 UI 설계가 달라야 한다. 정의서 5단계 여정을 그대로 운영자에 복사하면 두 제품 경계가 흐려지고, 결국 "운영자가 감정 자극 UI 를 보고 있다"는 이상한 상황 발생.

이번 재설계는 **정의서의 정신(5단계 여정)은 유지하되 정의서의 표현(이모지, 시나리오 텍스트)은 운영자 맥락으로 번역**하는 접근. Step 4~5 접이식 + 운영자 메타 패널 + 부록 블록화가 그 장치.

### Critic — 재발 방지

이번 초안이 투비콘에 기울어진 근본 원인은 "참조 자료로 투비콘 PDF 를 먼저 읽었기 때문"이다. 정의서 05(운영 DNA) 를 먼저 읽고, 투비콘은 "부록 부동산 참조"로 두는 순서가 옳다.

dev-planner 에게 전달할 때: "5단계 여정을 운영자 맥락으로 번역하라. 투비콘 복제는 부록 1블록으로만."

팩트 검증 재발 방지:
- facade.py 현재 상태를 초안이 잘못 기술했다("drop 중" → 실제 반환 중). 실제 코드 읽기 우선 원칙 재확인.
- dev-planner 는 Phase 0 스펙 작성 전 facade.py line 134-147 을 직접 Read 하도록 명시.

### Innovator — 10x 시나리오 (Phase 1 이후 검토)

1. **환자 간 키보드 네비** — Drawer 열린 상태에서 `←/→` 로 이전/다음 환자 전환, `Ctrl+K` 로 환자 검색. 운영자가 N 명 검증 시 10배 빠름.
2. **PMID 호버 미리보기** — PMID 칩 호버 시 툴팁에 논문 메타(저자, 저널, 연도, abstract 첫 문장). 별도 페이지 이동 없이 근거 확인.
3. **Before/After 슬라이더(운영자 버전)** — Step 3 에 엔진 호출 없이 클라이언트 사이드로 `improved.labels` 4종 on/off 토글 → `improved.ratios` 에서 부분 집합 즉시 계산. What-If 엔진 재호출 없이 "금연만 껐을 때 값" 확인 가능. (Phase 3 대체 저비용 안)
4. **Diff 뷰** — 두 환자 선택 시 Step 1~3 값 diff 하이라이트. 엔진 회귀 테스트 시 동일 프로필인데 결과 다른 케이스 즉시 발견.
5. **imputed_fields 편집 가능** — 메타 패널에서 추정값을 운영자가 수동 덮어쓰기 → 실시간 재계산. 데이터 품질 개선 루프.

10x 아이디어는 Phase 1 완료 + 운영자 피드백 후 innovator 모드로 재평가. 현 단계에서는 범위 확장 금지.

---

## 부록 B — 이모티콘 제거 현황

본 문서 전체에서 이모티콘 / 이모지 사용 0건. 기존 초안의 이모지는 정의서 복사 과정에서 유입된 것이며, 본 딥다이브 및 이후 생성되는 스펙 / BEM 클래스 / 컴포넌트 이름 / 한 줄 요약 프롬프트 전부에서 사용 금지. 시각 강조는 SCSS 토큰(색상 / variant)으로만 수행.

---

*EOF — Phase 0 실행 지시 대기. 다음 단계: dev-planner spawn → Phase 0 스펙 문서(`docs/mediarc-report-phase0-spec.md`) 작성.*
