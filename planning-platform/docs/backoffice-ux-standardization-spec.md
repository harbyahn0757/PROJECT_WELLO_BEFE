# 백오피스 UX 표준화 계획서

> **작성일**: 2026-04-14
> **대상**: `planning-platform/backoffice/` 전체 (9 페이지)
> **목표**: UX 패턴 통일 + iframe 호환성 유지 + HealthReportPage 재작업

---

## 1. 배경 및 목표

### 1.1 문제 정의
- 9개 페이지 모두 **외부 래퍼 클래스가 다름** (`.revisit-page`, `.cdm-page`, `.patient-page`, `.health-report` …)
- 공용 컴포넌트 부재 (Drawer, KpiCard, FilterBar, PageHeader)
- 최근 작업된 **HealthReportPage** 가 기존 패턴 재사용 안 하고 재발명 → 레이아웃·iframe 미대응 문제
- 일부 페이지에만 iframe(`isEmbedMode`) 처리가 있음 → iframe 지원 범위 불명확

### 1.2 목표
- **페이지 레이아웃 표준**: `RevisitPage` 구조를 기준 (Header + KPI + 탭·필터 + 테이블 + Drawer)
- **Drawer 표준**: 현 `ConsultationPage.__drawer` 를 공용 `Drawer` 컴포넌트로 추출
- **iframe 표준**: 모든 페이지에서 동일한 `isEmbedMode` 처리 패턴 적용 (파트너사 계약 유지)
- **HealthReportPage 재작업**: 표준 패턴으로 전면 재작성
- **기존 파트너사 iframe URL 계약 무손상**: 경로·파라미터·인증 변경 없음

### 1.3 비목표
- 비즈니스 로직 변경 (API 스펙, 데이터 흐름)
- 라우팅 URL 변경 (파트너사 iframe 하드코딩 보호)
- 인증 플로우 수정

---

## 2. 현황 점검 결과

### 2.1 페이지별 현황

| 페이지 | 외부 래퍼 | KPI | 필터 | Drawer | iframe | 테이블 | 리팩토링 필요도 |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **RevisitPage** (기준) | `.revisit-page` | ✅ 4개 | ✅ 다중 | ✗ (테이블+우측 패널 2단) | ✅ | ✅ | 패턴 유지 |
| **ConsultationPage** (흡수됨) | `.consultation-page` | ✗ | 부분 | ✅ (**기준 Drawer**) | - | ✅ | 컴포넌트로 추출 |
| CheckupDesignManagementPage | `.cdm-page` | ✗ | 병원검색만 | (ConsultationPage 내재) | ✅ | - | **중** |
| PatientPage | `.patient-page` | ? | ? | ? | ? | ? | **확인 필요** |
| AnalyticsPage | `.analytics-page` | ? | ? | ? | ? | ? | **확인 필요** |
| EmbeddingPage | `.admin-embedding-page` | - | - | - | ✅ | - | 검토 |
| SurveyPage | `.survey-page` | - | - | - | ✅ | - | 검토 |
| DashboardPage | 커스텀 | - | - | - | - | - | 저 (대시보드는 독자 구조 허용) |
| **HealthReportPage** | `.health-report` | ✅ | 이름검색만 | ✗ (인라인 아코디언) | ✗ | ✅ | **높음 — 전면 재작성** |

### 2.2 iframe 계약
```
useEmbedParams():
  isEmbedMode = !!(apiKey && partnerId)
  URL: ?api_key=xxx&partner_id=yyy&hospital_id=zzz&hospital_name=aaa
```

현재 iframe 대상 확인된 페이지:
- `/backoffice/revisit?api_key=...` (RevisitPage)
- `/backoffice/checkup-design?api_key=...` (CheckupDesignManagementPage)
- `/backoffice/embedding?api_key=...` (EmbeddingPage)
- `/backoffice/survey?api_key=...` (SurveyPage)

HealthReportPage 는 현재 iframe 대상 아님. 향후 파트너사 노출 시 iframe 모드 필요.

### 2.3 iframe 구동 이슈 분석
- `PartnerOfficeLayout` 이 `isEmbedMode` 일 때 사이드바/헤더 숨김 처리 (추정 — 재확인 필요)
- `ProtectedRoute` 가 `EMBED_ALLOWED_PATHS` 체크로 인증 스킵
- 파트너사 iframe 호출 URL은 외부 시스템에 하드코딩됨 → 경로·파라미터명 변경 금지

---

## 3. 표준 패턴 정의

### 3.1 페이지 레이아웃 표준 (RevisitPage 기준)

```tsx
<div className="page page--{pageName}">
  <PageHeader title="재환가망고객" actions={<>...</>} />
  <KpiGrid>
    <KpiCard label="총 후보" value={total} unit="명" />
    <KpiCard label="고위험" value={highRisk} unit="명" variant="danger" />
    ...
  </KpiGrid>
  <TabBar items={[...]} value={activeTab} onChange={...} />
  <FilterBar>
    <select>...</select>
    <input type="search" />
  </FilterBar>
  <PageBody split={true}>  {/* 옵션: 2단 */}
    <DataTable>...</DataTable>
    {/* Drawer 로 대체 가능 */}
  </PageBody>
  <Drawer open={drawerOpen} onClose={...} title="...">...</Drawer>
</div>
```

### 3.2 공용 컴포넌트 카탈로그 (신규)

| 컴포넌트 | 경로 | 역할 |
|---|---|---|
| `PageLayout` | `components/layout/PageLayout.tsx` | 외부 래퍼 + 헤더 + body 슬롯 |
| `PageHeader` | `components/layout/PageHeader.tsx` | 제목 + 액션 버튼 영역 |
| `KpiGrid` / `KpiCard` | `components/kpi/` | 4개 고정 그리드, variant 지원 |
| `TabBar` | `components/tabs/TabBar.tsx` | `.tabs` / `.tabs__item` 재사용 |
| `FilterBar` | `components/filters/FilterBar.tsx` | select·input 정렬 |
| `Drawer` | `components/Drawer/Drawer.tsx` | 오른쪽 슬라이드 + overlay + ESC + body lock |
| `HospitalSearch` | `components/HospitalSearch/` | 병원 드롭다운 검색 (cdm-hospital-select 추출) |
| `DataTable` | 기존 `.data-table` 유지 | 네임스페이스 통일 `page-table` 재검토 |

### 3.3 Drawer 공용화 설계

현 `ConsultationPage.__drawer` → `components/Drawer/`
```tsx
<Drawer
  open={boolean}
  onClose={() => void}
  title={ReactNode}
  width="480px" | "720px" | "100%"
  side="right"
  lockBody={true}
  closeOnEsc={true}
  closeOnOverlay={true}
>
  {children}
</Drawer>
```
CSS 네임스페이스: `.app-drawer` / `.app-drawer--open` / `.app-drawer__overlay` / `.app-drawer__header` / `.app-drawer__body`

### 3.4 iframe 표준 훅

```tsx
// useEmbedParams 는 그대로 (로직 변경 없음)
// 페이지 내부에서 레이아웃 분기는 PageLayout이 흡수
<PageLayout embedMode={isEmbedMode}>
  {/* embedMode=true 시 PageHeader 숨김, body padding 축소 등 */}
</PageLayout>
```

### 3.5 CSS 네임스페이스 정책

```
이후 (표준)
.page                                  // 모든 페이지 외부 래퍼 공통
.page--revisit, .page--health-report   // 페이지별 override
.page__header, .page__kpi, .page__body // 구조 요소
.app-drawer                            // Drawer 공용
.kpi-card, .kpi-card--danger           // KPI
.filter-bar, .tab-bar
```

기존 클래스 점진 폐기:
- `.revisit-page__*` → `.page--revisit__*` 또는 공용 패턴
- `.cdm-page__*` → `.page--checkup-design__*` 또는 공용
- `.health-report__*` → 제거 (신규 작성)
- `.consultation-page__drawer*` → `.app-drawer` 공용

### 3.6 iframe 호환성 체크리스트 (모든 페이지 공통)

- [ ] URL 경로 불변 (`/backoffice/<page>`)
- [ ] 쿼리 파라미터 불변 (`api_key`, `partner_id`, `hospital_id`, `hospital_name`)
- [ ] `isEmbedMode=true` 시 사이드바 비표시 (PartnerOfficeLayout 담당)
- [ ] `isEmbedMode=true` 시 `hospital_id` 쿼리로 자동 필터 적용
- [ ] `isEmbedMode=true` 시 인증 스킵 (ProtectedRoute `EMBED_ALLOWED_PATHS`)
- [ ] iframe 내부 scroll 정상 (body height 무한 루프 방지)
- [ ] Drawer open 시 iframe overlay 가 부모 영역 침범 안 함 (position: fixed → iframe 내 fixed 동작 확인 필요)

---

## 4. 페이지별 리팩토링 태스크

### 4.1 Phase 1 — 공용 컴포넌트 구축 (2일)

| 파일 | 작업 | 의존성 |
|---|---|---|
| `components/layout/PageLayout.tsx` | 신규 | - |
| `components/layout/PageHeader.tsx` | 신규 | - |
| `components/kpi/KpiCard.tsx` | 신규 | - |
| `components/kpi/KpiGrid.tsx` | 신규 | KpiCard |
| `components/tabs/TabBar.tsx` | 신규 | - |
| `components/filters/FilterBar.tsx` | 신규 | - |
| `components/Drawer/Drawer.tsx` | 신규 (ConsultationPage drawer 로직 추출) | - |
| `components/HospitalSearch/HospitalSearch.tsx` | 신규 (cdm-hospital-select 추출) | - |
| `styles/_page.scss`, `_drawer.scss`, `_kpi.scss` | 신규 | - |

### 4.2 Phase 2 — HealthReportPage 재작성 (0.5일)

- 외부 래퍼 → `PageLayout`
- `health-report__stats-grid` → `KpiGrid` + `KpiCard` 4개
- 이름검색 `<input>` → `FilterBar` + `HospitalSearch` 조합
- 환자 테이블 행 클릭 인라인 아코디언 → `Drawer` (질환예측/검진수치/영양추천/투비콘 비교 탭은 Drawer 안으로)
- iframe `isEmbedMode` 지원 추가
- 기존 FE 파일 재배치: `HealthReportPage/` 구조 유지 (index.tsx + hooks + styles)

### 4.3 Phase 3 — RevisitPage 마이그레이션 (0.5일)

- 외부 래퍼 `.revisit-page` → `.page--revisit` (PageLayout 경유)
- `revisit-page__kpi` → `KpiGrid`
- 기존 2단 테이블+상세 패널 → Drawer 로 전환 (옵션) 또는 기존 유지
- **iframe 회귀 검증 최우선** (파트너사 연결)

### 4.4 Phase 4 — CheckupDesignManagementPage + ConsultationPage (1일)

- `cdm-page` → `PageLayout` + tabs
- 병원 검색 `cdm-hospital-select` → `HospitalSearch` 공용
- ConsultationPage drawer 로직 → `Drawer` 컴포넌트로 교체 (상세 정보는 Drawer children 으로 이동)
- 탭 내 contents 는 그대로 유지
- iframe 회귀 검증

### 4.5 Phase 5 — 기타 페이지 (PatientPage / AnalyticsPage / EmbeddingPage / SurveyPage) (1일)

- 각 페이지 외부 래퍼만 `PageLayout` 으로 교체
- 내부 UX 는 당장 유지 (스코프 관리)
- EmbeddingPage / SurveyPage iframe 회귀 검증

### 4.6 Phase 6 — DashboardPage 검토 (0.5일)

- 차트 중심이라 표준 구조 강제 안 함
- PageHeader 정도만 교체

### 4.7 Phase 7 — 정리·문서화 (0.5일)

- 기존 미사용 클래스 제거 (`.revisit-page__*` 등)
- Storybook 대체로 `COMPONENTS.md` 가이드 작성
- 회귀 테스트 수동 체크리스트 갱신

**총 공수**: 약 6일 (1주 sprint)

---

## 5. 실행 순서 (Phase 의존성)

```
Phase 1 (공용 컴포넌트) ──┬── Phase 2 (HealthReportPage) ──┐
                        │                                 │
                        ├── Phase 3 (RevisitPage) ────────┤
                        │                                 ├── Phase 7 (정리)
                        ├── Phase 4 (CheckupDesign+Consult)┤
                        │                                 │
                        ├── Phase 5 (기타 4개) ──────────── ┤
                        │                                 │
                        └── Phase 6 (Dashboard) ────────── ┘
```

Phase 1 완료 후 Phase 2~6 병렬 가능 (Agent 5개 동시).

---

## 6. 리스크 & 완화

| 리스크 | 심각도 | 완화 방안 |
|---|---|---|
| 파트너사 iframe 에서 레이아웃 깨짐 (CSS 변경 영향) | 🔴 Critical | 각 Phase 완료 후 iframe smoke test (실 파트너 URL 모사) 필수 |
| Drawer `position: fixed` 가 iframe 내부에서 부모로 누출 | 🔴 Critical | Drawer 컨테이너를 `position: absolute` + 부모 컨테이너 기준으로 테스트 |
| 공용 컴포넌트 props 설계 미흡으로 페이지별 요구 못 수용 | 🟠 Major | Phase 1 완료 후 2개 페이지(HealthReport, Revisit) 적용해보고 피드백 |
| CSS 네임스페이스 변경으로 기존 파트너 override 깨짐 | 🟠 Major | 파트너사가 backoffice CSS 직접 override 안 함 확인 (iframe 원칙) |
| 리팩토링 중 기존 페이지 회귀 | 🟡 Minor | 각 Phase 완료 시 dev-reviewer + 수동 UI 확인 |
| 빌드 증가 (공용 CSS 추가) | 🟢 Info | Phase 7 에서 미사용 삭제로 순증 최소화 |

---

## 7. 테스트 플랜

### 7.1 단위 확인 (Phase 1 후)
- Drawer: open/close/ESC/overlay 클릭/body lock 동작
- KpiCard: label/value/unit/variant 렌더
- HospitalSearch: 드롭다운 필터링, 선택, 닫기 외부 클릭
- PageLayout: embedMode=true/false 분기

### 7.2 페이지별 시각 확인 (각 Phase 후)
- 로컬 `npm start`: `?api_key=xxx&partner_id=yyy&hospital_id=zzz` 로 iframe 모드 테스트
- 데스크톱 1440px / 태블릿 1024px / 모바일 375px 3종 화면 점검
- 기존 기능 회귀 (필터/정렬/검색/엑셀/페이지네이션)

### 7.3 iframe 통합 테스트 (Phase 완료 시)
- 실 파트너 iframe URL 각 페이지 접속
- 사이드바 비표시 확인
- hospital_id 자동 필터 적용 확인
- Drawer 가 iframe 내부에서만 렌더되고 부모로 안 누출 확인
- 브라우저 콘솔 에러 0건

### 7.4 E2E 테스트
- Playwright Python (`e2e/tests/`) 기존 테스트 모두 통과
- 신규: Drawer open → 상세 탭 전환 → close 시나리오

---

## 8. 배포 플랜

### 8.1 Phase 단위 배포 (점진적)

각 Phase 완료 시 독립 배포 가능:
```bash
cd planning-platform/backoffice
npm run build
cd ..
cd backend && # static 복사는 deploy:simple 이 담당
cd frontend && NODE_OPTIONS=--openssl-legacy-provider npm run deploy:simple
git commit && git push
sshpass … ssh 10.0.1.6 "pm2 restart WELNO_BE"
```

### 8.2 롤백
- git revert 단일 Phase commit
- PM2 restart
- 파트너사 iframe 영향 없음 (URL 계약 불변)

### 8.3 Feature flag (선택)
- `localStorage.getItem('use_new_layout')` 기반 점진 노출
- 이번 sprint 에서는 **사용 안 함** (전체 일괄 전환)

---

## 9. 하비 검토 포인트 (계획 승인 전 결정 필요)

### Q1. 스코프 확정
- **A. 9페이지 전체 표준화** (Phase 1~7 모두) — 6일
- **B. HealthReportPage + 공용 컴포넌트 + Revisit·CheckupDesign 마이그레이션만** — 3일
- **C. HealthReportPage 만 RevisitPage 레이아웃 베끼기 + Drawer 공용 없이 페이지 내부** — 1일

### Q2. ConsultationPage Drawer 공용화 방식
- **A. 새 `Drawer` 컴포넌트 생성, ConsultationPage 도 교체** (권장)
- **B. ConsultationPage 는 유지, HealthReportPage 만 새 Drawer 사용**

### Q3. 기존 `.revisit-page__*` / `.cdm-page__*` 클래스
- **A. 즉시 제거 + 표준 class 로 교체** (정합성 高, 회귀 위험)
- **B. 표준 class 추가하되 기존 class 병존, 추후 제거** (안전, 중복 유지)

### Q4. iframe 회귀 테스트 깊이
- **A. 실 파트너 URL 로 각 Phase 후 수동 확인** (안전)
- **B. 로컬 모사만** (빠름)

### Q5. 작업 에이전트 구성
- **A. dev-planner 가 Phase 별 상세 스펙 → dev-coder 병렬 5개 → dev-reviewer 통합 → ops-team 배포** (정석)
- **B. 메인이 Phase 1 직접 구현 → 2~6 을 dev-coder 분할** (빠름)

---

## 10. 권장 시작 방식

**권장**: Q1=A, Q2=A, Q3=B, Q4=A, Q5=A

1. 이 계획서를 하비가 승인
2. dev-planner 가 Phase 1 공용 컴포넌트 상세 스펙 작성 (props, CSS 변수, Storybook 예시)
3. dev-coder 가 Phase 1 구현
4. dev-reviewer 견제 + 테스트
5. 로컬 iframe 모사 smoke test
6. 배포
7. Phase 2~6 병렬 진행 (각 Phase 완료 시 회귀 검증)
8. Phase 7 정리·문서화
9. sprint 종료 시 전체 E2E + 파트너 iframe 체크

---

## 11. 참조

- RevisitPage (기준): `planning-platform/backoffice/src/pages/RevisitPage/index.tsx:298`
- ConsultationPage Drawer: `planning-platform/backoffice/src/pages/ConsultationPage/index.tsx:411-423`
- useEmbedParams: `planning-platform/backoffice/src/hooks/useEmbedParams.ts`
- 기존 mediArc 이식 설계서: `planning-platform/docs/mediarc-engine-backoffice-spec.md`
- 재환 네이밍 원칙: `memory/feedback-jaehwan-not-jaehwal.md` (archive → rules 흡수됨)

*작성: 2026-04-14 / 승인 대기*
