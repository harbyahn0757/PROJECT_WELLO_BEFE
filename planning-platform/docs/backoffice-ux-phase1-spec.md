# 백오피스 UX 표준화 Phase 1 — 공용 컴포넌트 상세 스펙

> **작성일**: 2026-04-14
> **대상**: `planning-platform/backoffice/src/components/`, `src/styles/`
> **전제 스펙**: `docs/backoffice-ux-standardization-spec.md`
> **하비 결정값**
> - Q1 = A: 9페이지 전체 (Phase 1~7 모두)
> - Q2 = A: 신규 `Drawer` 공용 + ConsultationPage 교체
> - Q3 = B: 신구 CSS 병존 (점진 교체)
> - Q4 = A: 실 파트너 iframe 테스트
> - Q5 = A: dev-planner → dev-coder → dev-reviewer → ops-team

---

## 0. 원칙 선언 (Phase 1 수용 경계)

Phase 1은 **공용 컴포넌트를 추가만** 하고 기존 페이지 코드는 **건드리지 않는다**.
기존 `.revisit-page__*`, `.cdm-page__*`, `.consultation-page__*`, `.health-report__*` 클래스와 **병존**한다. 교체(마이그레이션)는 Phase 2~6.

### 수용 경계
- **추가 OK**: 신규 `.tsx`, `.scss`, `src/components/*` 하위, `src/styles/components/*` 하위
- **건드려도 되는 기존 파일**: `src/App.scss` 또는 `src/index.scss`의 `@import` 1 줄만 (신규 SCSS import)
- **건드리면 안 되는 파일**: 9 페이지의 `index.tsx`, `styles.scss`. 또한 `src/styles/_*.scss` 기존 파일 변경 금지 (토큰 재사용만)

### 하위 호환성
- 모든 공용 컴포넌트는 **독립 CSS 네임스페이스** (`.app-*`, `.page`, `.kpi-*`, `.filter-bar`, `.tab-bar`) 를 사용 — 기존 클래스와 충돌 없음
- `src/styles/_variables.scss` 토큰만 **재사용** — 덮어쓰기/추가 금지

---

## 1. 공용 컴포넌트 API

### 1.1 `PageLayout` — 페이지 외부 래퍼

**경로**: `src/components/layout/PageLayout.tsx`
**역할**: 모든 페이지의 최상위 `<div>` 를 표준화. `useEmbedParams` 를 흡수하여 embed 모드일 때 패딩/헤더 축소.

#### Props

```typescript
import { ReactNode } from 'react';

export interface PageLayoutProps {
  /**
   * 페이지 식별자. CSS override 용 `.page--<pageName>` 클래스를 자동 부여.
   * 예: "revisit" | "health-report" | "checkup-design"
   */
  pageName: string;

  /**
   * iframe embed 모드 강제값. 미지정 시 `useEmbedParams()` 결과 사용.
   * 테스트/스토리북 용도 override.
   */
  embedMode?: boolean;

  /**
   * 본문 스크롤 정책.
   * - "page" (기본): 페이지 전체가 스크롤 (현재 RevisitPage 패턴)
   * - "none": 외부는 고정, 내부 컴포넌트가 스크롤 관리 (테이블 sticky 헤더 시)
   */
  scroll?: 'page' | 'none';

  /** 테스트 편의용 data-testid */
  testId?: string;

  children: ReactNode;
}
```

#### JSDoc

```typescript
/**
 * 페이지 표준 외부 래퍼.
 * - 기존 `.revisit-page`, `.cdm-page`, `.health-report` 등 각자 래퍼 통일.
 * - embed 모드 분기를 Layout 이 흡수 → 각 페이지는 `isEmbedMode` 변수 관리 불필요.
 * - Phase 1 에서는 페이지에서 호출하지 않아도 됨 (기존 페이지 유지). Phase 2~6 에서 점진 교체.
 *
 * @example
 * <PageLayout pageName="revisit">
 *   <PageHeader title="재환가망고객" actions={...} />
 *   <KpiGrid>...</KpiGrid>
 * </PageLayout>
 */
```

#### JSX 구조 (pseudocode)

```tsx
import { useEmbedParams } from '../../hooks/useEmbedParams';

export const PageLayout: React.FC<PageLayoutProps> = ({
  pageName, embedMode, scroll = 'page', testId, children,
}) => {
  const { isEmbedMode } = useEmbedParams();
  const isEmbed = embedMode ?? isEmbedMode;

  const className = [
    'page',
    `page--${pageName}`,
    isEmbed && 'page--embed',
    `page--scroll-${scroll}`,
  ].filter(Boolean).join(' ');

  return (
    <div className={className} data-testid={testId ?? `page-${pageName}`}>
      {children}
    </div>
  );
};
```

#### CSS 클래스

| 클래스 | 설명 |
|---|---|
| `.page` | 공통 외부 래퍼 (padding, background, box-sizing) |
| `.page--<pageName>` | 페이지별 override hook (빈 선언이라도 유지) |
| `.page--embed` | embed 모드 시 패딩 축소, 높이 auto |
| `.page--scroll-page` | 페이지 전체 스크롤 (기본) |
| `.page--scroll-none` | 외부 overflow hidden (내부 컴포넌트가 스크롤) |

#### variant

| 값 | 용도 |
|---|---|
| `scroll="page"` | HealthReportPage 처럼 페이지 전체가 위로 흐르는 긴 콘텐츠 |
| `scroll="none"` | RevisitPage 처럼 테이블 sticky 헤더 + Drawer 가 화면에 꽉 차는 구조 |

#### 사용 예시

```tsx
// 예시 1: RevisitPage 마이그레이션 (Phase 3)
<PageLayout pageName="revisit" scroll="none">
  <PageHeader title="재환가망고객" actions={<ExportButtons onExcel={handleExcel} />} />
  <KpiGrid>{/* 4 cards */}</KpiGrid>
  <TabBar items={[...]} value={filterType} onChange={setFilterType} />
  <FilterBar>{/* select, input */}</FilterBar>
  <div className="revisit-page__list">{/* 기존 테이블 */}</div>
  <Drawer open={drawerOpen} onClose={close} title="상세">...</Drawer>
</PageLayout>
```

```tsx
// 예시 2: HealthReportPage 재작성 (Phase 2), embed 모드 강제 해제하여 로컬 디버그
<PageLayout pageName="health-report" embedMode={false} scroll="page">
  <PageHeader title="mediArc 리포트" />
  <KpiGrid>...</KpiGrid>
  <FilterBar>...</FilterBar>
  <table>...</table>
</PageLayout>
```

---

### 1.2 `PageHeader` — 제목 + 액션 영역

**경로**: `src/components/layout/PageHeader.tsx`
**역할**: 페이지 상단 제목 + 오른쪽 액션 버튼 그룹. `revisit-page__header`, `health-report__header` 등 중복 제거.

#### Props

```typescript
export interface PageHeaderProps {
  /** 페이지 제목 (h2 로 렌더) */
  title: ReactNode;

  /** 부제 (옵션, title 아래 회색 텍스트) */
  subtitle?: ReactNode;

  /** 오른쪽 액션 영역 (버튼, 드롭다운 등) */
  actions?: ReactNode;

  /**
   * embed 모드에서 헤더를 숨길지 여부.
   * 기본 false (embed 에서도 표시). Layout 의 pageHeader 는 이미 PartnerOfficeLayout 헤더가 있어 중복 시 true 권장.
   */
  hideOnEmbed?: boolean;
}
```

#### JSX 구조

```tsx
import { useEmbedParams } from '../../hooks/useEmbedParams';

export const PageHeader: React.FC<PageHeaderProps> = ({
  title, subtitle, actions, hideOnEmbed = false,
}) => {
  const { isEmbedMode } = useEmbedParams();
  if (hideOnEmbed && isEmbedMode) return null;

  return (
    <header className="page__header">
      <div className="page__header-title-group">
        <h2 className="page__header-title">{title}</h2>
        {subtitle && <p className="page__header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page__header-actions">{actions}</div>}
    </header>
  );
};
```

#### CSS 클래스

- `.page__header` (flex, space-between, align-center, margin-bottom: 16px, flex-shrink: 0)
- `.page__header-title` (font-3xl, bold, gray-900)
- `.page__header-subtitle` (font-sm, gray-500)
- `.page__header-actions` (flex, gap: 8px, align-center)

#### 사용 예시

```tsx
<PageHeader title="재환가망고객" actions={<>
  <button className="btn-excel" onClick={openEmbed}>상담 이력관리</button>
  <ExportButtons onExcel={handleExcel} />
</>} />

<PageHeader title="mediArc 리포트" subtitle="전체 환자 질환 예측 현황" />
```

---

### 1.3 `KpiGrid` + `KpiCard` — KPI 카드

**경로**: `src/components/kpi/KpiGrid.tsx`, `src/components/kpi/KpiCard.tsx`
**역할**: RevisitPage 의 4개 KPI 카드 패턴을 표준화. `revisit-page__kpi`, `health-report__stats-grid` 중복 제거.

#### Props

```typescript
export interface KpiGridProps {
  /** 컬럼 수. 기본 4. 반응형으로 1024px 이하에서 2열, 767px 이하에서 1열로 자동 전환. */
  cols?: 2 | 3 | 4;
  children: ReactNode;
}

export interface KpiCardProps {
  /** 상단 라벨 (작은 회색 텍스트) */
  label: ReactNode;

  /** 중앙 값 (크고 bold) */
  value: ReactNode;

  /** 값 옆의 단위 (작은 텍스트, 예: "명", "건", "%") */
  unit?: ReactNode;

  /** 추가 메타 (값 아래 회색 텍스트, 예: "전주 대비 +5") */
  hint?: ReactNode;

  /** 시각적 강조 */
  variant?: 'default' | 'danger' | 'warning' | 'success';

  /** 클릭 가능 여부 (필터 토글 등) */
  onClick?: () => void;

  /** 선택 상태 (클릭형 카드용) */
  selected?: boolean;

  testId?: string;
}
```

#### JSX 구조

```tsx
export const KpiGrid: React.FC<KpiGridProps> = ({ cols = 4, children }) => (
  <div className={`kpi-grid kpi-grid--cols-${cols}`}>{children}</div>
);

export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, unit, hint, variant = 'default', onClick, selected, testId,
}) => {
  const cls = [
    'kpi-card',
    `kpi-card--${variant}`,
    onClick && 'kpi-card--clickable',
    selected && 'kpi-card--selected',
  ].filter(Boolean).join(' ');

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={cls} onClick={onClick} data-testid={testId}>
      <span className="kpi-card__label">{label}</span>
      <span className="kpi-card__value">
        {value}{unit && <small className="kpi-card__unit">{unit}</small>}
      </span>
      {hint && <span className="kpi-card__hint">{hint}</span>}
    </Tag>
  );
};
```

#### variant 정의

| 값 | 값 텍스트 색상 | 배경/보더 | 용도 |
|---|---|---|---|
| `default` | `$gray-900` | 흰 배경, shadow-sm | 기본 수치 |
| `danger` | `$error` | 흰 배경 | 고위험, 긴급 |
| `warning` | `$warning` | 흰 배경 | 경고 |
| `success` | `$success` | 흰 배경 | 긍정 지표 |

#### CSS 클래스

- `.kpi-grid` (display: grid, gap: 12px, margin-bottom: 16px, flex-shrink: 0)
- `.kpi-grid--cols-4 { grid-template-columns: repeat(4, 1fr); }` + media queries
- `.kpi-card` (white bg, radius-lg, padding: 16px, shadow-sm)
- `.kpi-card--danger .kpi-card__value { color: $error; }`
- `.kpi-card--clickable` (cursor, hover bg)
- `.kpi-card--selected` (border-color: $brand-brown)

#### 사용 예시

```tsx
// 예시 1: 정적 KPI (Revisit)
<KpiGrid>
  <KpiCard label="총 후보" value={total} unit="명" />
  <KpiCard label="고위험" value={highRisk} unit="명" variant="danger" />
  <KpiCard label="이번주 신규" value={weeklyNew} unit="명" />
  <KpiCard label="평균 참여도" value={avgEngagement} unit="점" />
</KpiGrid>

// 예시 2: 클릭형 KPI (HealthReport — 카드 클릭으로 필터 토글)
<KpiGrid cols={3}>
  <KpiCard
    label="고혈압 의심" value={hypertensionCount} unit="명" variant="danger"
    onClick={() => toggleFilter('hypertension')}
    selected={activeFilter === 'hypertension'}
  />
  <KpiCard label="당뇨 의심" value={diabetesCount} unit="명" variant="warning"
    onClick={() => toggleFilter('diabetes')}
    selected={activeFilter === 'diabetes'} />
  <KpiCard label="정상" value={normalCount} unit="명" variant="success" />
</KpiGrid>
```

---

### 1.4 `TabBar` — 탭 전환

**경로**: `src/components/tabs/TabBar.tsx`
**역할**: 기존 `.tabs` / `.tabs__item` SCSS 를 React 컴포넌트로 포장.

#### Props

```typescript
export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  /** 라벨 옆 뱃지 카운트 */
  badge?: number | string;
  /** 비활성 여부 */
  disabled?: boolean;
}

export interface TabBarProps<K extends string = string> {
  items: ReadonlyArray<TabItem<K>>;
  value: K;
  onChange: (key: K) => void;
  /** 탭 크기. 기본 "md" */
  size?: 'sm' | 'md';
  /** 우측 여백에 배치될 보조 요소 (예: 병원 드롭다운) */
  trailing?: ReactNode;
}
```

#### JSX 구조

```tsx
export function TabBar<K extends string>({
  items, value, onChange, size = 'md', trailing,
}: TabBarProps<K>) {
  return (
    <div className={`tab-bar tab-bar--${size}`}>
      <div className="tab-bar__items">
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            className={`tab-bar__item${item.key === value ? ' tab-bar__item--active' : ''}`}
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
          >
            {item.label}
            {item.badge != null && item.badge !== 0 && (
              <span className="tab-bar__badge">{item.badge}</span>
            )}
          </button>
        ))}
      </div>
      {trailing && <div className="tab-bar__trailing">{trailing}</div>}
    </div>
  );
}
```

#### CSS 클래스

- `.tab-bar` (flex, space-between, align-end, border-bottom)
- `.tab-bar__items` (flex, gap: 4px)
- `.tab-bar__item` (padding, cursor, text color)
- `.tab-bar__item--active` (border-bottom 2px $brand-brown, bold)
- `.tab-bar__badge` (inline-block, 원형 뱃지)
- `.tab-bar__trailing` (flex-shrink: 0)

#### 사용 예시

```tsx
type TabKey = 'consultation' | 'campaign' | 'history';
const TAB_ITEMS: TabItem<TabKey>[] = [
  { key: 'consultation', label: '상담 요청', badge: pendingCount },
  { key: 'campaign', label: '캠페인 발송' },
  { key: 'history', label: '발송 이력' },
];
<TabBar items={TAB_ITEMS} value={activeTab} onChange={setActiveTab}
  trailing={<HospitalSearch ... />} />
```

---

### 1.5 `FilterBar` — 필터 영역

**경로**: `src/components/filters/FilterBar.tsx`
**역할**: `revisit-page__filters` 등 select+input 배치 패턴 통일.

#### Props

```typescript
export interface FilterBarProps {
  children: ReactNode;
  /** 오른쪽 정렬 영역 (검색창 등) */
  trailing?: ReactNode;
  /** 여러 줄 허용 (기본 false — 한 줄, flex-wrap 허용은 "wrap") */
  layout?: 'nowrap' | 'wrap';
}
```

#### JSX 구조

```tsx
export const FilterBar: React.FC<FilterBarProps> = ({
  children, trailing, layout = 'wrap',
}) => (
  <div className={`filter-bar filter-bar--${layout}`}>
    <div className="filter-bar__main">{children}</div>
    {trailing && <div className="filter-bar__trailing">{trailing}</div>}
  </div>
);
```

#### CSS 클래스

- `.filter-bar` (flex, gap: 8px, margin-bottom: 12px, flex-shrink: 0)
- `.filter-bar--wrap .filter-bar__main { flex-wrap: wrap; }`
- `.filter-bar select, .filter-bar input` (padding, border, radius-md, focus border-brand)

#### 사용 예시

```tsx
<FilterBar trailing={<input type="search" placeholder="이름/병원 검색" />}>
  <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
    <option value="">위험도 전체</option>
    <option value="high">고위험</option>
  </select>
  <select value={intentFilter} onChange={e => setIntentFilter(e.target.value)}>
    <option value="">의향 전체</option>
  </select>
</FilterBar>
```

---

### 1.6 `Drawer` — 오른쪽 슬라이드 패널 (최중요)

**경로**: `src/components/Drawer/Drawer.tsx` + `Drawer.scss`
**역할**: ConsultationPage `.consultation-page__drawer` 를 공용화.

#### Props

```typescript
export interface DrawerProps {
  /** 열림 상태 */
  open: boolean;

  /** 닫기 콜백 (ESC, overlay 클릭, 닫기 버튼) */
  onClose: () => void;

  /** 헤더 영역 — title 대신 완전 커스텀 시 사용 */
  header?: ReactNode;

  /** 간단한 제목 (header 미지정 시 기본 헤더 렌더) */
  title?: ReactNode;

  /** 드로어 너비. 기본 "lg" */
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | string; // 'sm'=360 | 'md'=480 | 'lg'=720 | 'xl'=80% | 'full'=100%

  /** overlay 클릭으로 닫기 (기본 true) */
  closeOnOverlay?: boolean;

  /** ESC 로 닫기 (기본 true) */
  closeOnEsc?: boolean;

  /** body scroll lock (기본 true. iframe 내에서 false 권장 — 아래 iframe 안전 설계 참조) */
  lockBody?: boolean;

  /**
   * 컨테이너 기준 렌더 모드 (iframe 안전 핵심).
   * - "viewport" (기본): `position: fixed` 로 viewport 기준 고정. 일반 페이지에서는 안전
   * - "container": `position: absolute` 로 부모 `.page` 컨테이너 기준. iframe 내에서 부모 페이지 침범 방지
   */
  containment?: 'viewport' | 'container';

  /** 외부 영역 테스트용 data-testid */
  testId?: string;

  children: ReactNode;
}
```

#### JSDoc

```typescript
/**
 * 오른쪽에서 슬라이드하는 공용 Drawer.
 * - focus trap + ESC + overlay click + body scroll lock (options)
 * - iframe 안전 모드 `containment="container"` 지원 (부모 페이지 영역 침범 방지)
 * - ConsultationPage drawer 로직 추출. HealthReportPage 인라인 아코디언 대체.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <Drawer open={open} onClose={() => setOpen(false)} title="환자 상세" width="xl">
 *   <PatientDetail id={selected} />
 * </Drawer>
 */
```

#### JSX 구조

```tsx
import { useEffect, useRef } from 'react';
import { useEmbedParams } from '../../hooks/useEmbedParams';

const WIDTH_MAP: Record<string, string> = {
  sm: '360px', md: '480px', lg: '720px', xl: '80%', full: '100%',
};

export const Drawer: React.FC<DrawerProps> = ({
  open, onClose, header, title,
  width = 'lg',
  closeOnOverlay = true,
  closeOnEsc = true,
  lockBody,
  containment,
  testId,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { isEmbedMode } = useEmbedParams();

  // iframe 기본값: containment=container, lockBody=false
  const resolvedContainment = containment ?? (isEmbedMode ? 'container' : 'viewport');
  const resolvedLockBody = lockBody ?? !isEmbedMode;

  // ESC
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onClose]);

  // body scroll lock
  useEffect(() => {
    if (!open || !resolvedLockBody) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, resolvedLockBody]);

  // focus trap (진입 시 panel 로 포커스)
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const widthValue = WIDTH_MAP[width] ?? width;

  return (
    <>
      {open && (
        <div
          className={`app-drawer__overlay app-drawer__overlay--${resolvedContainment}`}
          onClick={closeOnOverlay ? onClose : undefined}
          aria-hidden
        />
      )}
      <aside
        ref={panelRef}
        className={[
          'app-drawer',
          `app-drawer--${resolvedContainment}`,
          open && 'app-drawer--open',
        ].filter(Boolean).join(' ')}
        style={{ width: widthValue }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        data-testid={testId ?? 'app-drawer'}
      >
        {(header || title) && (
          <div className="app-drawer__header">
            {header ?? <h3 className="app-drawer__title">{title}</h3>}
            <button className="app-drawer__close" onClick={onClose} aria-label="닫기">&times;</button>
          </div>
        )}
        <div className="app-drawer__body">{children}</div>
      </aside>
    </>
  );
};
```

#### CSS 클래스 + variant

```scss
// src/styles/components/_drawer.scss
.app-drawer {
  top: 0; right: 0; bottom: 0;
  background: $white;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  z-index: 910;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);

  &--viewport { position: fixed; height: 100vh; height: 100dvh; }
  &--container { position: absolute; height: 100%; }

  &--open { transform: translateX(0); }

  &__overlay {
    background: rgba(0, 0, 0, 0.35);
    z-index: 900;
    &--viewport { position: fixed; inset: 0; }
    &--container { position: absolute; inset: 0; }
  }

  &__header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid $gray-200;
    flex-shrink: 0;
  }
  &__title { font-size: $font-lg; font-weight: 700; color: $gray-900; margin: 0; }
  &__close { background: none; border: none; font-size: 24px; cursor: pointer; color: $gray-500; &:hover { color: $gray-800; } }

  &__body { flex: 1; overflow-y: auto; padding: 24px; }
}
```

**width variant**: `sm`(360), `md`(480), `lg`(720, 기본), `xl`(80%), `full`(100%), 또는 custom 문자열

#### 사용 예시

```tsx
// 예시 1: 일반 페이지 (RevisitPage 마이그레이션)
<Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="환자 상세" width="xl">
  <ConsultationDetail id={selectedId} />
</Drawer>

// 예시 2: iframe 페이지 (CheckupDesignManagementPage)
<Drawer open={open} onClose={close} title="상담 상세" width="lg" containment="container">
  <DetailPanel ... />
</Drawer>
```

---

### 1.7 `HospitalSearch` — 병원 검색 드롭다운

**경로**: `src/components/HospitalSearch/HospitalSearch.tsx` + `HospitalSearch.scss`
**역할**: `cdm-hospital-select` 의 로컬 state/필터/드롭다운 로직을 추출.

#### Props

```typescript
export interface HospitalOption {
  hospital_id?: string;  // partner 포맷 (PartnerOfficeLayout)
  hosnm?: string;        // cdm 포맷 (CheckupDesign)
  hospital_name?: string;
  mkt_consent?: number;  // 선택: cdm 서브 텍스트용
  pln_sent?: number;
}

export interface HospitalSearchProps {
  /** 병원 목록 */
  hospitals: HospitalOption[];
  /** 선택된 값 (hospital_id 또는 hosnm 중 컴포넌트 소비자가 결정) */
  value: string;
  /** 선택 콜백. 빈 문자열이면 "전체 병원" */
  onChange: (value: string) => void;
  /**
   * 값 추출 함수. 기본: `h => h.hospital_id ?? h.hosnm ?? ''`
   */
  getValue?: (h: HospitalOption) => string;
  /** 표시 텍스트. 기본: `h => h.hospital_name ?? h.hosnm ?? ''` */
  getLabel?: (h: HospitalOption) => string;
  /** 서브 텍스트 (옵션) */
  getSubtitle?: (h: HospitalOption) => string | null;
  /** placeholder 텍스트 */
  placeholder?: string;
  /** "전체 병원" 옵션 표시 여부 (기본 true) */
  showAllOption?: boolean;
  /** 너비 (기본 240px) */
  width?: string;
}
```

#### JSX 구조

```tsx
import { useState, useRef, useEffect, useMemo } from 'react';

export const HospitalSearch: React.FC<HospitalSearchProps> = ({
  hospitals, value, onChange,
  getValue = h => h.hospital_id ?? h.hosnm ?? '',
  getLabel = h => h.hospital_name ?? h.hosnm ?? '',
  getSubtitle,
  placeholder,
  showAllOption = true,
  width = '240px',
}) => {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!filter) return hospitals;
    const lc = filter.toLowerCase();
    return hospitals.filter(h => getLabel(h).toLowerCase().includes(lc));
  }, [hospitals, filter, getLabel]);

  const selectedLabel = hospitals.find(h => getValue(h) === value);
  const displayText = selectedLabel ? getLabel(selectedLabel) : (showAllOption ? '전체 병원' : (placeholder ?? '선택'));

  const ph = placeholder ?? `병원 검색 (${hospitals.length}개)`;

  return (
    <div className="hospital-search" ref={ref} style={{ width }}>
      <button className="hospital-search__trigger" onClick={() => setOpen(!open)}>
        <span className="hospital-search__label">{displayText}</span>
        <span className="hospital-search__arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="hospital-search__dropdown">
          <input
            className="hospital-search__input"
            type="text"
            placeholder={ph}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            autoFocus
          />
          <div className="hospital-search__list">
            {showAllOption && (
              <div
                className={`hospital-search__item${!value ? ' hospital-search__item--active' : ''}`}
                onClick={() => { onChange(''); setOpen(false); setFilter(''); }}
              >전체 병원</div>
            )}
            {filtered.length === 0 && <div className="hospital-search__empty">검색 결과 없음</div>}
            {filtered.slice(0, 50).map(h => {
              const v = getValue(h);
              const sub = getSubtitle?.(h);
              return (
                <div
                  key={v}
                  className={`hospital-search__item${value === v ? ' hospital-search__item--active' : ''}`}
                  onClick={() => { onChange(v); setOpen(false); setFilter(''); }}
                >
                  <span className="hospital-search__item-name">{getLabel(h)}</span>
                  {sub && <span className="hospital-search__item-sub">{sub}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
```

#### CSS 클래스

- `.hospital-search` (relative)
- `.hospital-search__trigger` (button, padding, border, radius-md)
- `.hospital-search__dropdown` (absolute, top 100%, max-height 300, overflow-y, shadow-md, z-index 100)
- `.hospital-search__input` (padding, border-bottom)
- `.hospital-search__list`, `.hospital-search__item`, `.hospital-search__item--active`
- `.hospital-search__empty`

#### 사용 예시

```tsx
// 예시 1: CheckupDesign (hosnm 기반)
<HospitalSearch
  hospitals={hospitalsWithStats}
  value={selectedHospital}
  onChange={v => { setSelectedHospital(v); setSelectedTargets([]); }}
  getValue={h => h.hosnm!}
  getLabel={h => h.hosnm!}
  getSubtitle={h => `${h.mkt_consent}명 / ${h.pln_sent}명 발송`}
/>

// 예시 2: 일반 (hospital_id 기반, PartnerOfficeLayout 과 동일)
<HospitalSearch
  hospitals={hospitals}
  value={selectedId}
  onChange={setSelectedId}
/>
```

---

## 2. Drawer iframe 안전 설계 (최중요)

### 2.1 문제 정의

`position: fixed` 는 viewport 기준. iframe 내부에서 `position: fixed` 는 **iframe 내부의 viewport (iframe 요소 크기)** 기준으로 작동하는 것이 표준 스펙이지만:
- 구형 iOS Safari 버전에서 `fixed` 가 부모 window viewport 로 탈출하는 버그
- iframe 이 부모 페이지의 작은 영역(예: 600x800)에 끼워져 있을 때 `fixed inset: 0` overlay 가 iframe 영역 가득 채우는 건 OK 지만, scroll lock 이 **부모 body 를 잠그지 않고 iframe 내부 body 만 잠금** — 부모 쪽 스크롤은 계속 움직일 수 있음. 반대로 `document.body.style.overflow = 'hidden'` 은 iframe 내부 document 만 영향 (cross-origin 이면 부모 제어 불가 = 정상 의도)
- Drawer width `80%` 가 iframe 폭 기준으로 계산 → iframe 이 작으면 Drawer 도 작아짐 → 내용 짤림

### 2.2 옵션 비교

#### 옵션 A: `position: absolute` + 부모 `PageLayout` 컨테이너 기준

```scss
.page { position: relative; }  // PageLayout 에 이미 relative 부여
.app-drawer--container {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  height: 100%;
}
.app-drawer__overlay--container {
  position: absolute;
  inset: 0;
}
```

**장점**:
- iframe 내부든 밖이든 **동일하게 동작** — 부모 `.page` 크기 안으로 제한
- iframe 크기 = Drawer 가 차지하는 최대 크기 → 예측 가능
- overlay 가 부모 페이지 영역으로 탈출하지 않음 (iframe 영역 = `.page` 영역)

**단점**:
- `.page` 가 `position: relative` + 충분한 height 필요
- 여러 섹션에 걸친 긴 페이지에서 Drawer 를 열면 Drawer 도 페이지 전체 길이만큼 늘어남 → viewport 보다 긴 Drawer
- 이를 막으려면 `PageLayout scroll="none"` + `height: 100%` 필요

#### 옵션 B: iframe 감지 시 portal 없이 일반 렌더 (containment="viewport" 유지)

```tsx
const resolvedContainment = containment ?? (isEmbedMode ? 'container' : 'viewport');
```

iframe 내부에서는 무조건 `container` 로 강제. Embed 아님일 때는 `fixed` 사용.

**장점**:
- 일반 페이지 사용자 경험은 기존 ConsultationPage 와 동일 (`fixed` 전체 화면 덮음)
- Embed 시만 안전하게 컨테이너 모드

**단점**:
- `useEmbedParams` 의존 — 테스트 시 embed 모드 mock 필요
- 같은 컴포넌트가 두 가지 레이아웃 모드를 가짐 → 회귀 테스트 복잡

#### 옵션 C: body 대신 `PageLayout` 컨테이너에 portal

```tsx
import { createPortal } from 'react-dom';
const portalTarget = useContext(PageLayoutContext)?.portalNode ?? document.body;
return createPortal(..., portalTarget);
```

**장점**:
- DOM 구조상 Drawer 가 페이지 안에 "속함" — CSS 격리 명확
- `position: absolute` 모드와 자연 결합

**단점**:
- Context 필요 → PageLayout 이 ref 를 Context 로 공유
- Portal 타겟이 `null` 일 때 폴백 처리 복잡

### 2.3 추천

**옵션 A + B 조합** — 기본은 옵션 A (`containment="container"`), embed 아닐 때는 `viewport` 로 자동 전환 (옵션 B).

**결정 근거**:
1. 단순성: Context/Portal 없이 CSS 만으로 해결
2. 예측 가능성: 각 사용처에서 `containment` 명시 가능
3. 기본값이 환경 의존 (embed → container / 그 외 → viewport) — 호출부 수정 최소화
4. 옵션 C 는 과설계 — 현재 한 페이지에 Drawer 1개만 열리므로 Portal 불필요

#### 디폴트 매트릭스

| 환경 | 기본 `containment` | 기본 `lockBody` |
|---|---|---|
| 일반 페이지 (`isEmbedMode=false`) | `viewport` | `true` |
| iframe embed (`isEmbedMode=true`) | `container` | `false` (iframe 내부 body lock 의미 약함) |
| 명시 override | props 값 우선 | props 값 우선 |

### 2.4 검증 방법

#### 로컬 모사 테스트
1. `backoffice/public/test-iframe.html` 추가 (**수정 허용** — Phase 1 에서 예외적으로 신규 파일):
   ```html
   <!DOCTYPE html>
   <html>
   <head><title>Drawer iframe test</title></head>
   <body style="margin:0">
     <div style="height:2000px;background:#eee">부모 스크롤 영역</div>
     <div style="position:fixed;top:100px;left:100px;width:800px;height:600px;border:2px solid red">
       <iframe src="/backoffice/health-report?api_key=x&partner_id=y&hospital_id=z"
               style="width:100%;height:100%;border:0"></iframe>
     </div>
   </body>
   </html>
   ```
2. 브라우저에서 `/test-iframe.html` 접속
3. iframe 안에서 테이블 행 클릭 → Drawer 열기
4. 확인:
   - [ ] Drawer 가 iframe 영역(800x600) 안에 들어가 있는가 (빨간 테두리 밖으로 탈출 X)
   - [ ] overlay 가 부모 회색 영역으로 넘치지 않는가
   - [ ] 부모 페이지 스크롤이 정상 (iframe body lock 이 부모까지 영향 X)
   - [ ] iframe 내부 스크롤은 Drawer 열림 시 잠기는가 (`lockBody=false` 기본값 시 X. 필요 시 `lockBody=true` 명시)

#### 실 파트너 iframe smoke test
- 파트너가 실제로 사용하는 iframe URL 을 Playwright 로 로드
- Drawer open → overlay 렌더 좌표 확인 (`getBoundingClientRect()` 가 iframe 영역 내부)

#### 자동화 (Playwright)
```python
# frontend/e2e/tests/test_drawer_iframe.py (신규)
def test_drawer_bounded_by_iframe(page):
    page.goto("/test-iframe.html")
    iframe = page.frame_locator("iframe")
    iframe.locator(".health-report__row").first.click()
    drawer_box = iframe.locator(".app-drawer").bounding_box()
    iframe_box = page.locator("iframe").bounding_box()
    assert drawer_box["x"] >= 0  # iframe 기준 좌표
    assert drawer_box["width"] <= iframe_box["width"]
```

---

## 3. CSS 설계

### 3.1 파일 구조

```
src/styles/
├── _variables.scss       ← 기존, 수정 없음 (토큰 재사용)
├── _buttons.scss         ← 기존
├── _cards.scss           ← 기존
├── _tabs.scss            ← 기존 (.tabs 유지, 새 .tab-bar 는 아래 신규)
├── ...
└── components/            ← ★ 신규 디렉토리
    ├── _page.scss        ← .page, .page__header, .page--embed
    ├── _kpi.scss         ← .kpi-grid, .kpi-card
    ├── _drawer.scss      ← .app-drawer, .app-drawer__overlay
    ├── _filter-bar.scss  ← .filter-bar
    └── _tab-bar.scss     ← .tab-bar (기존 .tabs 와 병존)
```

### 3.2 토큰 재사용 확인

`_variables.scss` 에 이미 다음 토큰 존재 (수정 불필요):
- 색상: `$gray-100..900`, `$brand-brown`, `$error`, `$success`, `$warning`, `$white`
- 크기: `$border-radius-md/lg`, `$shadow-sm/md`, `$font-xs..3xl`, `$spacing-xs..xl`
- 레이아웃: `$sidebar-width`, `$header-height`, `$bp-tablet-max`, `$bp-mobile-max`

모든 신규 컴포넌트 SCSS 는 **이 토큰만** 사용 (하드코딩 금지).

### 3.3 신구 클래스 병존 전략 (Q3=B)

Phase 1 에서는 **추가만** — 기존 클래스와 독립 네임스페이스 사용하여 충돌 없음.

| 구 클래스 (유지) | 신 클래스 (추가) | 충돌 여부 |
|---|---|---|
| `.revisit-page`, `.revisit-page__kpi` | `.page`, `.kpi-grid` | 없음 (다른 이름) |
| `.cdm-page`, `.cdm-hospital-select` | `.page`, `.hospital-search` | 없음 |
| `.consultation-page__drawer` | `.app-drawer` | 없음 |
| `.tabs`, `.tabs__item` | `.tab-bar`, `.tab-bar__item` | 없음 |
| `.health-report`, `.health-report__stats-grid` | `.page`, `.kpi-grid` | 없음 |

**import 추가 1 줄**:
```scss
// src/App.scss 또는 src/index.scss 하단에 추가
@import './styles/components/page';
@import './styles/components/kpi';
@import './styles/components/drawer';
@import './styles/components/filter-bar';
@import './styles/components/tab-bar';
```
> **실제 수정은 1 파일, 5 줄만**. 기존 import 순서 변경 금지.

### 3.4 z-index 조정

현재 사용 중 z-index (grep 확인):
- `.consultation-page__overlay`: 900
- `.consultation-page__drawer`: 910
- `.po-layout__backdrop`: ??? (아마 800 이하)

**신규 할당**:
- `.app-drawer__overlay`: **900** (기존과 동일)
- `.app-drawer`: **910** (기존과 동일)

동시 렌더 시 기존 Consultation Drawer 와 새 `.app-drawer` 가 공존하면 최상단 규칙은 불명확하지만, Phase 1 에서는 **같은 페이지에서 둘 중 하나만 열림** 보장 → 문제 없음.

---

## 4. 마이그레이션 예시 (Phase 2~6 미리보기)

Phase 1 에서는 구현 안 함. 참고용.

### 4.1 RevisitPage (Phase 3)

```diff
- <div className="revisit-page">
-   <div className="revisit-page__header">
-     <h2 className="revisit-page__title">재환가망고객</h2>
-     <div>...actions</div>
-   </div>
-   <div className="revisit-page__kpi">
-     <div className="revisit-page__kpi-card">
-       <span className="revisit-page__kpi-label">총 후보</span>
-       <span className="revisit-page__kpi-value">{total}<small>명</small></span>
-     </div>
-     ...
-   </div>
+ <PageLayout pageName="revisit" scroll="none">
+   <PageHeader title="재환가망고객" actions={<><button>...</button><ExportButtons /></>} />
+   <KpiGrid>
+     <KpiCard label="총 후보" value={total} unit="명" />
+     <KpiCard label="고위험" value={highRisk} unit="명" variant="danger" />
+     <KpiCard label="이번주 신규" value={weeklyNew} unit="명" />
+     <KpiCard label="평균 참여도" value={avgEngagement} unit="점" />
+   </KpiGrid>
```

### 4.2 ConsultationPage Drawer (Phase 4)

```diff
- {drawerOpen && <div className="consultation-page__overlay" onClick={...} />}
- <div className={`consultation-page__drawer${drawerOpen ? ' consultation-page__drawer--open' : ''}`}>
-   <DrawerHeader ... />
-   <div className="consultation-page__drawer-body">
-     {detail && <DetailPanel ... />}
-   </div>
- </div>
+ <Drawer
+   open={drawerOpen}
+   onClose={() => setDrawerOpen(false)}
+   header={<DrawerHeader ... />}  // 기존 DrawerHeader 재사용
+   width="xl"
+   containment="container"  // iframe 안전
+ >
+   {detailLoading && <Spinner />}
+   {!detailLoading && detail && <DetailPanel ... />}
+ </Drawer>
```

### 4.3 CheckupDesign 병원 검색 (Phase 4)

```diff
- <div className="cdm-hospital-select" ref={hospitalRef} style={{position:'relative'}}>
-   <div className="cdm-hospital-search">
-     <input ... />
-     {selectedHospital && <button>✕</button>}
-     {showHospitalDropdown && <div className="cdm-hospital-dropdown">...</div>}
-   </div>
- </div>
+ <HospitalSearch
+   hospitals={hospitalsWithStats}
+   value={selectedHospital}
+   onChange={v => { setSelectedHospital(v); setSelectedTargets([]); }}
+   getValue={h => h.hosnm!}
+   getLabel={h => h.hosnm!}
+   getSubtitle={h => `${h.mkt_consent}명 / ${h.pln_sent}명 발송`}
+ />
```

---

## 5. 파일 신규/수정 목록

### 5.1 신규 파일 (13개)

```
src/components/layout/
├── PageLayout.tsx
└── PageHeader.tsx

src/components/kpi/
├── KpiCard.tsx
├── KpiGrid.tsx
└── index.ts                ← re-export

src/components/tabs/
└── TabBar.tsx

src/components/filters/
└── FilterBar.tsx

src/components/Drawer/
├── Drawer.tsx
└── index.ts                ← re-export

src/components/HospitalSearch/
├── HospitalSearch.tsx
├── HospitalSearch.scss
└── index.ts

src/styles/components/
├── _page.scss
├── _kpi.scss
├── _drawer.scss
├── _filter-bar.scss
└── _tab-bar.scss
```

### 5.2 수정 파일 (1개)

```
src/App.scss (또는 src/index.scss — 기존 styles import 가 있는 파일)
  + @import './styles/components/page';
  + @import './styles/components/kpi';
  + @import './styles/components/drawer';
  + @import './styles/components/filter-bar';
  + @import './styles/components/tab-bar';
```

### 5.3 테스트/데모 파일 (선택)

```
backoffice/public/test-iframe.html           ← iframe smoke test 용 (선택)
src/components/Drawer/Drawer.demo.tsx        ← 단독 렌더 데모 (선택, 수용 조건 #5 만족용)
```

**건드리면 안 되는 파일 (명시)**:
- `src/pages/**/*.tsx`
- `src/pages/**/styles.scss`
- `src/styles/_variables.scss`
- `src/styles/_buttons.scss`, `_cards.scss`, `_tabs.scss`, `_tables.scss`, `_forms.scss`, `_modals.scss`, `_responsive.scss`, `_sidebar.scss`
- `src/hooks/useEmbedParams.ts`
- `src/layouts/PartnerOfficeLayout/index.tsx`

---

## 6. 작업 분할 (dev-coder 병렬 sub-task)

Phase 1 내부를 2개 병렬 트랙으로 나눔. **동일 파일 수정 금지 원칙** 준수.

### Sub-task A: 레이아웃/KPI/필터 계열 (한 사람이 일괄)

**이유**: 이들은 CSS 토큰/구조가 밀접. 한 명이 일관된 style 로 작성하는 것이 효율적.

| 파일 | 의존 |
|---|---|
| `components/layout/PageLayout.tsx` | useEmbedParams |
| `components/layout/PageHeader.tsx` | useEmbedParams |
| `components/kpi/KpiCard.tsx`, `KpiGrid.tsx`, `index.ts` | - |
| `components/tabs/TabBar.tsx` | - |
| `components/filters/FilterBar.tsx` | - |
| `styles/components/_page.scss` | _variables |
| `styles/components/_kpi.scss` | _variables |
| `styles/components/_filter-bar.scss` | _variables |
| `styles/components/_tab-bar.scss` | _variables |

**산출**: 9 파일 신규.

### Sub-task B: Drawer + HospitalSearch (독립)

**이유**: Drawer 는 iframe 안전 로직 + focus trap 으로 복잡. HospitalSearch 는 드롭다운 + outside-click 으로 복잡. 둘 다 독립적이므로 병렬 가능.

| 파일 | 의존 |
|---|---|
| `components/Drawer/Drawer.tsx`, `index.ts` | useEmbedParams |
| `components/HospitalSearch/HospitalSearch.tsx`, `HospitalSearch.scss`, `index.ts` | - |
| `styles/components/_drawer.scss` | _variables |

**산출**: 6 파일 신규.

### 공통 (둘 다 완료 후 메인 또는 sub-task A 마지막 단계)

- `src/App.scss` 또는 `src/index.scss` 에 `@import` 5 줄 추가

### TEAM 모드 파일 잠금 선언

- Sub-task A 잠금: `src/components/layout/**`, `src/components/kpi/**`, `src/components/tabs/**`, `src/components/filters/**`, `src/styles/components/_page.scss`, `_kpi.scss`, `_filter-bar.scss`, `_tab-bar.scss`
- Sub-task B 잠금: `src/components/Drawer/**`, `src/components/HospitalSearch/**`, `src/styles/components/_drawer.scss`
- **둘 다 `App.scss` 수정 금지** — 공통 단계에서 메인이 처리

---

## 7. 테스트 항목

### 7.1 단위 테스트 (isolated render)

**도구**: React Testing Library (이미 `@testing-library/react` 있는지 `package.json` 확인 — 없다면 설치 생략, Playwright E2E 로 대체).

| 컴포넌트 | 테스트 케이스 |
|---|---|
| `PageLayout` | `embedMode={true/false}` 에 따라 `.page--embed` 클래스 토글 |
| `PageHeader` | `hideOnEmbed` + embed 모드 시 null 렌더 |
| `KpiCard` | variant 별 className, clickable 시 button 태그 |
| `KpiGrid` | `cols` prop 에 따른 className |
| `TabBar` | 클릭 시 `onChange` 호출, `badge` 렌더 |
| `FilterBar` | trailing 영역 렌더 |
| `Drawer` | open=false 시 overlay 미렌더 / ESC 시 onClose / overlay 클릭 시 onClose / `containment` 별 CSS 클래스 |
| `HospitalSearch` | 필터 입력 → 목록 축소 / outside click → 닫힘 / 선택 → onChange |

### 7.2 통합 테스트 (데모 페이지)

`Drawer.demo.tsx` 를 개발 중 단독 렌더:
- `npm start` 후 `/backoffice/_demo/drawer` 또는 Storybook 없이도 임시 route 로 확인

체크:
- [ ] Drawer open/close 애니메이션 0.28s 부드러움
- [ ] width="xl" 시 80% 폭
- [ ] body lock 동작 (스크롤 불가)
- [ ] focus 가 drawer 패널로 이동

### 7.3 iframe 테스트 (최중요)

#### 로컬 모사
1. `backoffice/public/test-iframe.html` 생성 (위 2.4 참조)
2. `npm start` → `http://localhost:9283/test-iframe.html`
3. URL 파라미터: `?api_key=test&partner_id=dev&hospital_id=123`
4. 체크리스트:
   - [ ] iframe 내부 Drawer 가 iframe 박스 안에 렌더
   - [ ] overlay 가 iframe 영역 내에서만 어둡게
   - [ ] 부모 페이지 스크롤 정상 동작
   - [ ] Drawer 내부 스크롤은 콘텐츠 길이에 따라 동작

#### 실 파트너 iframe smoke test (Q4=A)
- 파트너 계약된 URL (예: medilinx.co.kr 파트너 페이지) 에서 **Phase 1 완료 후 배포 전** 직접 확인.
- 확인 대상 페이지는 Phase 1 에서는 Drawer 미사용이므로 **회귀 영향 0**이어야 함 → "Phase 1 배포 후에도 기존 페이지 동일하게 보이는가" 만 체크.

### 7.4 a11y 테스트

| 항목 | 체크 |
|---|---|
| Drawer | `role="dialog" aria-modal="true" aria-label` 존재 |
| Drawer | Tab 키 focus trap (첫 포커스: 닫기 버튼 또는 패널) |
| Drawer | ESC → 닫기 |
| TabBar | 버튼 태그 사용, disabled 상태 전달 |
| HospitalSearch | 드롭다운 `aria-expanded`, `aria-controls` (옵션) |
| KpiCard (clickable) | `<button>` 태그, `aria-pressed={selected}` 옵션 |

Playwright 검증 (E2E):
```python
def test_drawer_esc_closes(page):
    page.goto("/backoffice/_demo/drawer")
    page.locator('[data-testid="open-drawer"]').click()
    assert page.locator('.app-drawer--open').is_visible()
    page.keyboard.press("Escape")
    assert not page.locator('.app-drawer--open').is_visible()
```

---

## 8. 수용 조건

Phase 1 완료 판정은 **모든 항목 PASS** 시에만.

- [ ] **8.1 AST OK**: 13 신규 파일 TypeScript 컴파일 에러 0
  ```bash
  cd backoffice && npx tsc --noEmit
  ```
- [ ] **8.2 빌드 성공**:
  ```bash
  cd backoffice && npm run build
  # exit 0, `build/` 디렉토리 생성, index.html 내 신규 CSS 클래스 포함
  ```
- [ ] **8.3 기존 페이지 코드 변경 0건** (Phase 1 = 추가만):
  ```bash
  git diff --stat backoffice/src/pages/ backoffice/src/styles/_variables.scss backoffice/src/styles/_buttons.scss ...
  # 모두 0 lines changed
  ```
- [ ] **8.4 기존 9 페이지 회귀 없음**: 로컬에서 각 페이지 접속 → 시각적 변화 0
  - dashboard, patients, embedding, survey, revisit, analytics, checkup-design, health-report, consultation (cdm 내부)
- [ ] **8.5 Drawer 단독 데모 동작**: `Drawer.demo.tsx` 또는 test-iframe.html 로 open/close/ESC/overlay-click 확인
- [ ] **8.6 iframe 안전 검증**: `test-iframe.html` 에서 Drawer 가 iframe 영역 이탈 없음
- [ ] **8.7 토큰 하드코딩 없음**: 신규 SCSS grep 으로 색상/px 하드코딩 검출 0
  ```bash
  grep -rE '#[0-9a-fA-F]{3,6}\b' src/styles/components/ | grep -v _variables
  # 출력 0 줄 (토큰만 사용)
  ```
- [ ] **8.8 dev-reviewer PASS**: `git diff` 리뷰 후 Generator ≠ Evaluator 원칙대로 별도 에이전트 견제

---

## 9. 리스크 및 완화

| 리스크 | 완화 |
|---|---|
| `useEmbedParams` 를 Drawer 가 import 하여 테스트 시 window.location 모킹 부담 | `embedMode` / `containment` props 로 override 가능 — 테스트 시 명시 |
| 신규 CSS 로 빌드 크기 증가 | Phase 1 추가량은 ~10KB gzip 미만 예상. Phase 7 에서 기존 중복 제거 시 순증 0 |
| `@import` 순서가 잘못되면 토큰 해석 안됨 | `_variables` 가 먼저 import 되어야 — 신규 `@import` 는 기존 `@import './styles/variables'` 뒤에 추가 |
| TabBar 제네릭 `K extends string` TS 설정 호환성 | backoffice tsconfig `strict` 여부 선확인 (이미 TypeScript 4.x+ 이면 OK) |

---

## 10. 다음 단계 (Phase 1 완료 후)

1. dev-coder 병렬 A/B 실행 → 13 파일 신규
2. 메인: `App.scss` import 5 줄 추가 + `tsc --noEmit` + `npm run build`
3. dev-reviewer 견제 (Generator ≠ Evaluator)
4. 로컬 iframe smoke test
5. Phase 2 시작: `HealthReportPage` 재작성 (별도 스펙 필요)

---

*작성: 2026-04-14 / Phase 1 상세 스펙 완료*
