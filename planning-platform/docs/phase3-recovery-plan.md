# Phase 3 완성 복구 기획서

**작성일**: 2026-04-16
**작성자**: dev-planner (기획 + UI/UX 설계)
**전제 스펙**: `docs/mediarc-report-phase3-spec.md` (1858 lines, master)
**보조 스펙**: `docs/backoffice-ux-phase1-spec.md` (공용 컴포넌트), `docs/mediarc-report-phase1-spec.md`, `docs/mediarc-report-phase0-spec.md`
**감사 인풋**: 세션 3종 (리포트 스펙 10.x / 검진설계+드로워 / North Star RevisitPage)

## 0. 요약 + 판단 근거

### 0.1 한 줄 요약
Phase 3 스펙은 구현됐으나 **셀렉터·누락 컴포넌트·북스타 격차**로 인해 E2E/접근성/정합성 수용 기준 미달. 한 sprint (5 영업일) 팀 모드로 **워커 6개 병렬** 동원해 Phase A (블로커) + Phase B (북스타 정합) + Phase C (접근성/셀렉터) + Phase D (방어 레이어) 순으로 수렴, 6일차 배포.

### 0.2 현 상태 (2026-04-16 기준)

| 항목 | 스펙 요구 | 현 구현 | 격차 |
|---|---|---|---|
| 리포트 data-test 셀렉터 | 36종 (10.2~10.7) | **0개** (`data-testid` 9개만 혼재) | **-36** |
| Phase 3 신규 컴포넌트 | PatientMetaPanel / 디버그 drawer / missing_fields 배너 | **0개** | 누락 3종 |
| `improved.*` 하위 필드 렌더 | `improved-labels/sbp/dbp/fbg/row-{key}-5y/will-rogers` 6종 | 렌더는 있음, 셀렉터 없음 | 속성만 필요 |
| `diseases[i].*` 하위 필드 셀렉터 | `disease-card-{key}-*` 5종 | 셀렉터 없음 | 속성만 필요 |
| `nutrition[i].*` / `gauges[i].*` | 4종 | 상위 `nutrient-card`, `gauge-block`만 | 하위 3종 필요 |
| Phase 3 신규 `/simulate` 결과 | 4종 (`milestone-card-{key}-arr/bodyage`, `row-{key}-override`, `will-rogers-override`) | 미매핑 | 4종 필요 |
| 공유 컴포넌트 재사용 | PageLayout/PageHeader/KpiGrid/TabBar/FilterBar | HealthReportPage OK, **CheckupDesignManagementPage 50%만** | 부분 격차 |
| 프론트 `features/checkup` data-testid | 20+ (추정) | **0개** grep | 전무 |
| FAISS `aretrieve()` | 존재 | `vector_search.py:84`에 **실존** | 감사 오판 — 호출부만 재검증 |
| ES 설정 기본값 | 환경별 분리 | `config.py:140`에 `http://localhost:9200` 기본값 고정 | 개선 필요 (optional) |

### 0.3 핵심 판단
1. **스펙 10.x 매트릭스가 곧 SoT**. E2E 셀렉터 36종을 실 DOM에 부여하는 것이 릴리즈 블로커.
2. **누락 3 컴포넌트**(PatientMetaPanel / 디버그 drawer / missing_fields 배너)는 **환자 안전**과 직결 (missing_fields = 시뮬레이션 결과 신뢰도 결함 공개 의무).
3. **CheckupDesignManagementPage KPI 누락**은 북스타(RevisitPage)와의 격차 — Phase B에서 해결.
4. **FAISS aretrieve 누락은 감사 오판** — 실제 존재. 호출부만 점검 (Phase D).
5. **메인 스펙(`mediarc-report-phase3-spec.md`) Chapter 15와 본 기획서는 스프린트 1회 내 정합**하도록 설계.

### 0.4 하비 승인 포인트
- **Kickoff 시작 승인**: 본 기획서 검토 완료 직후 1회
- **중간 승인**: 없음 (자동 진행)
- **배포 직전 승인**: D5 End dev-reviewer Level 1 + harby-verifier Level 2 PASS 후 최종 배포 직전 1회

---

## 1. Phase 분할 + 배포 범위

### 1.1 Phase 정의

| Phase | 목적 | 소요 | 배포 포함 | 블록 기준 |
|---|---|---|---|---|
| **A: 블로커 해소** | 스펙 요구 누락 3 컴포넌트 + `missing_fields` 경고 배너 + 시뮬레이션 헬스체크 | D1-D3 | ✅ 필수 | 환자 안전, E2E 셀렉터 의존 |
| **B: North Star 정합** | CheckupDesignManagementPage에 KpiGrid/Spinner/FilterBar/ProcessingModal 패턴 적용. 리포트 북스타 레이아웃 보강 | D2-D4 | ✅ 필수 | UX 일관성 |
| **C: 접근성 + 셀렉터 전수** | 36 data-test + aria-* + focus-visible + keyboard nav | D3-D5 | ✅ 필수 | Playwright E2E 불가 |
| **D: 방어 레이어** | FAISS 호출부 회귀 테스트 / ES 설정 검증 / config migration 확정 | D4-D5 | ✅ 선택 | 백엔드 독립, 병행 가능 |

### 1.2 배포 사이클 구성
- **단일 배포** (D6, 1회): A + B + C 통합. D는 병행되어 같은 배포에 포함
- **feature flag**: `REACT_APP_PHASE3_RECOVERY=on` — 초기 OFF, 내부 QA 후 ON
- **롤백 경로**: flag OFF 만으로 Phase 2 UI 복귀

### 1.3 승인 게이트
1. **D1 kickoff**: 본 기획서 하비 승인
2. **D3 mid**: Phase A 산출물 dev-reviewer Level 1 PASS 확인 (자동, 승인 아님)
3. **D5 pre-deploy**: dev-reviewer Level 1 + harby-verifier Level 2 PASS 후 **하비 Level 3 최종 승인**
4. **D6 배포**: ops 워커가 실행

---

## 2. 워커 분배표

### 2.1 팀 구성 (dev-lead 조율, 8 워커)

| # | 워커 | 모델 | 담당 Phase | 1차 잠금 파일 | 의존성 |
|---|---|---|---|---|---|
| W1 | dev-coder-fe-report-blocker | sonnet | A | PatientMetaPanel.tsx (신규), DebugDrawer.tsx (신규), MissingFieldsBanner.tsx (신규), ReportView.tsx | 없음 (D1 착수) |
| W2 | dev-coder-fe-report-selectors | sonnet | C | BeforeAfterRow.tsx, DiseaseGrid.tsx, NutritionBlock.tsx, GaugeBlock.tsx, HeroBlock.tsx, BodyAgeChart.tsx, MilestoneCard.tsx (data-test 속성 부여) | W1 PatientMetaPanel merge 후 (D2 착수) |
| W3 | dev-coder-fe-checkup-bo | sonnet | B | CheckupDesignManagementPage/index.tsx, CheckupDesignManagementPage/styles.scss, AlimtalkPanel.tsx (KpiGrid/Spinner/FilterBar 통합) | 없음 (D1 착수) |
| W4 | dev-coder-fe-checkup-front | sonnet | C | frontend/features/checkup/CheckupDesignPage.tsx, CheckupRecommendationsPage.tsx, CollectingDataPage.tsx, components/checkup-design/* (data-testid 20종 부여 + aria) | 없음 (D2 착수) |
| W5 | dev-coder-be | sonnet | D | backend/app/api/v1/endpoints/partner_office.py (`/simulate` 헬스체크 추가), backend/app/core/config.py (ES URL env 보강), backend/app/services/checkup_design/vector_search.py (aretrieve 단위 테스트 추가) | 없음 (D1 착수) |
| W6 | dev-coder-scss-tokens | sonnet | B+C | backoffice/src/styles/components/_kpi.scss (이미 존재 시 연장), _filter-bar.scss, _tab-bar.scss, _missing-fields.scss (신규), HealthReportPage/styles.scss 연장 | 없음 (D1 착수) |
| W7 | dev-reviewer | opus | A+B+C+D | (read-only) 각 워커 산출물 병렬 검증 | 각 워커 단위 완료 후 |
| W8 | harby-verifier | opus | 전체 | (read-only) 크로스팀 정합성 | D5 통합 후 |

### 2.2 파일 잠금 매트릭스 (병렬 충돌 방지)

| 파일 | W1 | W2 | W3 | W4 | W5 | W6 | 조율 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| `backoffice/src/pages/HealthReportPage/index.tsx` | R | R | - | - | - | - | W1 미사용, 직접 수정 없음 |
| `backoffice/src/pages/HealthReportPage/components/ReportView.tsx` | **W** | R | - | - | - | - | W1 독점 (PatientMetaPanel 삽입) |
| `backoffice/src/pages/HealthReportPage/components/PatientMetaPanel.tsx` (신규) | **W** | R | - | - | - | - | W1 독점 |
| `backoffice/src/pages/HealthReportPage/components/DebugDrawer.tsx` (신규) | **W** | R | - | - | - | - | W1 독점 |
| `backoffice/src/pages/HealthReportPage/components/MissingFieldsBanner.tsx` (신규) | **W** | R | - | - | - | - | W1 독점 |
| `backoffice/src/pages/HealthReportPage/components/HeroBlock.tsx` | - | **W** | - | - | - | - | W2 (report-name/age/sex/group/bodyage/rank 셀렉터 부여) |
| `backoffice/src/pages/HealthReportPage/components/DiseaseGrid.tsx` | - | **W** | - | - | - | - | W2 (disease-card-{key}-* 5종) |
| `backoffice/src/pages/HealthReportPage/components/BeforeAfterRow.tsx` | - | **W** | - | - | - | - | W2 (row-{key}/row-{key}-5y/row-{key}-override) |
| `backoffice/src/pages/HealthReportPage/components/BeforeAfterBlock.tsx` | - | **W** | - | - | - | - | W2 (before-after-block / improved-labels/sbp/dbp/fbg) |
| `backoffice/src/pages/HealthReportPage/components/MilestoneCard.tsx` | - | **W** | - | - | - | - | W2 (milestone-card-{key}-arr/bodyage) |
| `backoffice/src/pages/HealthReportPage/components/NutritionBlock.tsx` | - | **W** | - | - | - | - | W2 (nutrition-{key}-label/advice) |
| `backoffice/src/pages/HealthReportPage/components/GaugeBlock.tsx` | - | **W** | - | - | - | - | W2 (gauge-{key}-label/value) |
| `backoffice/src/pages/HealthReportPage/components/BodyAgeChart.tsx` | - | **W** | - | - | - | - | W2 (bodyage-value / disease-age-{key}) |
| `backoffice/src/pages/HealthReportPage/components/WillRogersCaption.tsx` | - | **W** | - | - | - | - | W2 (will-rogers / will-rogers-override) |
| `backoffice/src/pages/CheckupDesignManagementPage/index.tsx` | - | - | **W** | - | - | - | W3 독점 |
| `backoffice/src/pages/CheckupDesignManagementPage/styles.scss` | - | - | **W** | - | - | R | W3 독점 (W6 읽기만) |
| `backoffice/src/pages/CheckupDesignManagementPage/components/AlimtalkPanel.tsx` | - | - | **W** | - | - | - | W3 독점 |
| `backoffice/src/pages/HealthReportPage/styles.scss` | - | R | - | - | - | **W** | W6 독점 (ReportView/PatientMetaPanel SCSS 연장) |
| `backoffice/src/styles/components/_*.scss` | - | - | - | - | - | **W** | W6 독점 |
| `frontend/src/features/checkup/CheckupDesignPage.tsx` | - | - | - | **W** | - | - | W4 독점 |
| `frontend/src/features/checkup/CheckupRecommendationsPage.tsx` | - | - | - | **W** | - | - | W4 독점 |
| `frontend/src/features/checkup/CollectingDataPage.tsx` | - | - | - | **W** | - | - | W4 독점 |
| `frontend/src/components/checkup-design/ProcessingModal.tsx` | - | - | - | **W** | - | - | W4 독점 (aria만) |
| `backend/app/api/v1/endpoints/partner_office.py` | - | - | - | - | **W** | - | W5 독점 (`/simulate` 추가 검증) |
| `backend/app/core/config.py` | - | - | - | - | **W** | - | W5 독점 |
| `backend/app/services/checkup_design/vector_search.py` | - | - | - | - | **W** | - | W5 독점 (테스트 추가만) |

범례: **W** = 쓰기 잠금, R = 읽기 허용. 같은 행에 W 2개 이상 금지 (스펙 15.3과 정합).

### 2.3 모드 제안
**TEAM 모드** — 동시 병렬 6 워커 (W1~W6) + dev-reviewer + harby-verifier. dev-lead 조율. CLAUDE.md 원칙 10 준수 (모든 코드 수정 → dev-reviewer).

---

## 3. 각 워커별 작업지시서

> 아래 프롬프트는 **복사-붙여넣기 가능**. 각 워커에게 `Task(subagent_type="dev-coder")` 로 전달.

### 3.1 W1 — dev-coder-fe-report-blocker (Phase A 블로커)

```
너는 W1 워커. WELNO 리포트 Phase 3 블로커 3종을 구현한다.

## 잠금 파일 (독점 쓰기, 다른 워커 수정 금지)
- backoffice/src/pages/HealthReportPage/components/PatientMetaPanel.tsx (신규)
- backoffice/src/pages/HealthReportPage/components/DebugDrawer.tsx (신규)
- backoffice/src/pages/HealthReportPage/components/MissingFieldsBanner.tsx (신규)
- backoffice/src/pages/HealthReportPage/components/ReportView.tsx (import + 렌더 삽입만)

## 참조 SoT
- docs/mediarc-report-phase3-spec.md 10.2 / 10.5 (patient_info 매트릭스)
- docs/mediarc-report-phase3-spec.md 부록 D (용어 사전)
- backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts (PatientInfo 타입)
- backoffice/src/components/Drawer/Drawer.tsx (패턴 참조)
- backoffice/src/pages/RevisitPage/index.tsx (North Star: Drawer 사용 패턴)

## 작업 체크리스트
1. PatientMetaPanel.tsx 신규 작성
   - Props: { patientInfo: PatientInfo, testId?: string }
   - 렌더: BMI / 흡연 / 음주 3개 배지를 `report-view__meta-row` flex 배치
   - data-test 속성 (필수):
     - 최상위 div: `data-test="patient-meta"`
     - BMI 값: `data-test="patient-bmi"`
     - 흡연 값: `data-test="patient-smoking"`
     - 음주 값: `data-test="patient-drinking"`
   - aria-label 부여: 각 배지 `aria-label="BMI 23.5" / "흡연: 없음"` 등
   - SCSS 클래스: `.report-view__meta-panel`, `.report-view__meta-badge` (W6이 정의)
2. MissingFieldsBanner.tsx 신규 작성
   - Props: { missingFields: string[], imputedFields?: string[] }
   - missingFields.length === 0 이면 null 반환
   - 렌더: 상단 경고 배너 (아이콘 + "시뮬레이션 결과 신뢰도 저하: N개 필드 누락 [field1, field2, ...]")
   - data-test 속성:
     - 최상위 div: `data-test="missing-fields"`
   - role="alert", aria-live="polite" 부여
   - SCSS 클래스: `.report-view__missing-fields-banner` (W6이 정의)
3. DebugDrawer.tsx 신규 작성
   - Props: { patientInfo: PatientInfo, open: boolean, onClose: () => void }
   - process.env.NODE_ENV !== 'production' 일 때만 트리거 버튼 노출
   - URL ?debug=1 또는 window.__WELNO_DEBUG__ === true 일 때 활성화
   - 공용 Drawer 사용 (components/Drawer/Drawer.tsx) — width="md", anchor="right"
   - 내용: imputed_fields / missing_fields 전체 JSON 출력 + 원본 patient_info JSON
   - data-test 속성:
     - imputed_fields 영역: `data-test="imputed-fields"`
     - (missing-fields 는 MissingFieldsBanner 에서도 렌더하지만, drawer 내부는 별도 `data-testid` 만)
4. ReportView.tsx 수정 (최소 변경)
   - import 3종 추가
   - HeroBlock 바로 뒤에 <MissingFieldsBanner missingFields={patientInfo?.missing_fields ?? []} imputedFields={patientInfo?.imputed_fields ?? []} />
   - HeroBlock 내부 또는 shock section 안에 <PatientMetaPanel patientInfo={patientInfo} /> (위치: HeroBlock 바로 아래 권장)
   - DebugDrawer 는 report-view 최하단에 <DebugDrawer patientInfo={patientInfo} open={debugOpen} onClose={...} /> (debugOpen state 추가)
   - 기존 렌더 순서(5단계 shock/understand/motivate/action/celebrate) 유지

## 금지 사항
- 기존 컴포넌트 로직 수정 금지 (HeroBlock/RiskFactorsBlock/DiseaseGrid 등)
- data-testid 와 data-test 혼용 금지 — 신규 코드는 **data-test** 사용 (스펙 10.x SoT)
- PatientInfo 타입 변경 금지 (useMediarcApi.ts 는 W2 영역)
- SCSS 직접 수정 금지 (W6에 위임)
- 150줄 초과 단일 Edit/Write 금지 (CLAUDE.md 원칙 5)

## 검증 방법 (셀프)
1. npx tsc --noEmit --skipLibCheck (신규 3 파일 TS 에러 0)
2. grep -rn 'data-test="patient-meta"\|"missing-fields"\|"imputed-fields"\|"patient-bmi"\|"patient-smoking"\|"patient-drinking"' backoffice/src/pages/HealthReportPage/ → 6건 일치
3. ReportView.tsx Edit 후 import 3종 / JSX 3회 렌더 확인

## 산출물 보고 형식
- 신규 파일 3종 라인 수
- ReportView.tsx diff 요약 (import + 렌더 삽입 3곳)
- grep 결과 스크린샷 또는 출력
- 다음 단계: dev-reviewer 호출 대기
```

### 3.2 W2 — dev-coder-fe-report-selectors (Phase C 셀렉터 전수)

```
너는 W2 워커. WELNO 리포트 페이지 전체에 스펙 10.x data-test 셀렉터 36종을 전수 부여한다.

## 잠금 파일 (독점 쓰기)
- backoffice/src/pages/HealthReportPage/components/HeroBlock.tsx
- backoffice/src/pages/HealthReportPage/components/BodyAgeChart.tsx
- backoffice/src/pages/HealthReportPage/components/DiseaseGrid.tsx
- backoffice/src/pages/HealthReportPage/components/BeforeAfterRow.tsx
- backoffice/src/pages/HealthReportPage/components/BeforeAfterBlock.tsx
- backoffice/src/pages/HealthReportPage/components/MilestoneCard.tsx
- backoffice/src/pages/HealthReportPage/components/NutritionBlock.tsx
- backoffice/src/pages/HealthReportPage/components/GaugeBlock.tsx
- backoffice/src/pages/HealthReportPage/components/WillRogersCaption.tsx
- backoffice/src/pages/HealthReportPage/components/Disclosure.tsx
- backoffice/src/pages/HealthReportPage/components/AppendixBlock.tsx
- backoffice/src/pages/HealthReportPage/components/ReferencePmidList.tsx
- backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts (타입만; 신규 필드 없으면 read-only)

## 선행 조건
- W1 이 PatientMetaPanel / MissingFieldsBanner / DebugDrawer merge 완료 후 착수 (D2 시작).

## 참조 SoT
- docs/mediarc-report-phase3-spec.md Chapter 10.2 ~ 10.7 (36종 셀렉터 SoT)
- docs/mediarc-report-phase3-spec.md 16.1 "Chapter 10 의 data-test 셀렉터 100% DOM 에 존재"

## 작업 체크리스트 (셀렉터 36종 SoT)

### 10.2 최상위 필드 (7종 + patient-meta는 W1이 부여)
- [ ] `data-test="report-name"` → HeroBlock.tsx 이름 렌더 span
- [ ] `data-test="report-age"` → HeroBlock.tsx 나이
- [ ] `data-test="report-sex"` → HeroBlock.tsx 성별
- [ ] `data-test="report-group"` → HeroBlock.tsx 코호트 라벨
- [ ] `data-test="bodyage-value"` → BodyAgeChart.tsx 메인 수치
- [ ] `data-test="rank-pill"` → HeroBlock.tsx RankPill 컴포넌트 (있으면) 또는 bodyage 옆
- [ ] `data-test="before-after-block"` → BeforeAfterBlock.tsx 최상위 div

### 10.3 improved 하위 (6종)
- [ ] `data-test="improved-labels"` → BeforeAfterBlock.tsx `labelParts` p 태그
- [ ] `data-test="improved-sbp"` → BeforeAfterBlock.tsx 서브 정보 출력 (없으면 신규 span)
- [ ] `data-test="improved-dbp"` → 동일
- [ ] `data-test="improved-fbg"` → 동일
- [ ] `data-test="will-rogers"` → WillRogersCaption.tsx 최상위

### 10.4 diseases[i] 하위 (6종, key별 반복)
- [ ] `data-test="disease-card-{key}"` → DiseaseGrid.tsx 각 card div
- [ ] `data-test="disease-card-{key}-label"` → card 헤더 label
- [ ] `data-test="disease-card-{key}-ratio"` → card 메인 수치
- [ ] `data-test="disease-card-{key}-rank"` → card 배지
- [ ] `data-test="disease-card-{key}-cohort"` → Disclosure 내부 cohort_mean
- [ ] `data-test="disease-card-{key}-components"` → Disclosure 내부 components 리스트

### 10.6 nutrition[i] / gauges[i] 하위 (4종)
- [ ] `data-test="nutrition-{key}-label"` → NutritionBlock.tsx 각 label
- [ ] `data-test="nutrition-{key}-advice"` → 각 advice body
- [ ] `data-test="gauge-{key}-label"` → GaugeBlock.tsx 각 tick label
- [ ] `data-test="gauge-{key}-value"` → 각 포인터
- (상위 data-testid="nutrient-card" / "gauge-block" / "nutrition-block" 은 이미 존재 — 그대로 유지하되 data-test로 교체 안 함; 둘 다 부여하여 하위호환)

### 10.7 Phase 3 신규 (4종)
- [ ] `data-test="milestone-card-{key}-bodyage"` → MilestoneCard.tsx bodyage 값
- [ ] `data-test="milestone-card-{key}-arr"` → MilestoneCard.tsx ARR 요약
- [ ] `data-test="row-{disease_key}-override"` → BeforeAfterRow.tsx timeDim 모드 시 override 값
- [ ] `data-test="will-rogers-override"` → WillRogersCaption.tsx timeDim 모드 표시
- [ ] `data-test="row-{disease_key}"` → BeforeAfterRow.tsx 최상위 tr
- [ ] `data-test="row-{disease_key}-5y"` → BeforeAfterRow.tsx 5년 예측 td
- [ ] `data-test="disease-age-{key}"` → BodyAgeChart.tsx x축 bar 각각

## 부가 작업 (접근성)
각 컴포넌트에 아래 추가:
- `role="region"` + `aria-label="개선 시나리오 비교"` → BeforeAfterBlock 최상위
- `role="list"` / `role="listitem"` → DiseaseGrid / 각 card
- `aria-expanded`, `aria-controls` → Disclosure.tsx 버튼 (이미 있으면 유지)

## 금지 사항
- 컴포넌트 로직/렌더 로직 변경 금지 — **속성 추가만**
- 새 컴포넌트 생성 금지
- CSS 클래스명 변경 금지
- data-testid 제거 금지 (하위호환)
- useMediarcApi.ts 타입 수정 금지 (필드 자체는 이미 존재)

## 검증 방법 (셀프)
1. `grep -roE 'data-test="[^"]+"' backoffice/src/pages/HealthReportPage/ | sort -u | wc -l` → 36 이상 (key별 반복 포함 시 더 많음)
2. `grep -roE 'data-test="[a-z-]+"' backoffice/src/pages/HealthReportPage/ | grep -oE '"[^"]+"' | sort -u` → 스펙 10.x 목록과 100% 일치 확인
3. npx tsc --noEmit --skipLibCheck → 에러 0

## 산출물 보고
- 수정 파일 11종 diff 요약
- grep 결과 (셀렉터 count)
- 미달 셀렉터 있으면 명시 (0 목표)
```

### 3.3 W3 — dev-coder-fe-checkup-bo (Phase B 북스타 정합)

```
너는 W3 워커. WELNO 백오피스 검진설계 페이지를 North Star(RevisitPage) 수준으로 정합한다.

## 잠금 파일 (독점 쓰기)
- backoffice/src/pages/CheckupDesignManagementPage/index.tsx
- backoffice/src/pages/CheckupDesignManagementPage/styles.scss (W6과 읽기만 협의)
- backoffice/src/pages/CheckupDesignManagementPage/components/AlimtalkPanel.tsx

## 참조 SoT (North Star)
- backoffice/src/pages/RevisitPage/index.tsx (L1-230)
- backoffice/src/pages/RevisitPage/styles.scss
- docs/backoffice-ux-phase1-spec.md (공용 컴포넌트 API)

## 격차 (감사 결과 기준)
- KpiCard 0개 (RevisitPage는 4개)
- Spinner 미사용 (에러/로딩 UX 열위)
- FilterBar 미사용
- ProcessingModal 없음 (검진설계 하위 작업 진행 UX 부재)

## 작업 체크리스트
1. KpiGrid 추가 (cols=4)
   - 총 대상자 (targets.length)
   - 마케팅 동의자 (hospitals[].mkt_consent 합)
   - 금일 발송 완료 (historyList 중 today 필터)
   - 발송 대기 중 (templates.length)
   - 각 KpiCard 는 RevisitPage 의 KpiCard import 패턴 그대로
2. FilterBar 추가 (병원 선택 드롭다운 이미 HospitalSearch로 있음 → 날짜범위 / 상태 / 검색 추가)
   - 날짜 범위 select (전체 / 오늘 / 이번주 / 이번달)
   - 상태 select (전체 / 발송완료 / 대기 / 실패) — history 탭에서만 활성
   - 검색 input (환자 이름 / 병원명)
3. Spinner 적용
   - `loading === true` 시 `<div className="empty-state"><Spinner message="..." /></div>` (기존 p 태그 치환)
   - history 탭 historyLoading 도 동일
4. ProcessingModal 적용 (있으면 import, 없으면 frontend/src/components/checkup-design/ProcessingModal 상속)
   - 캠페인 발송 중 (`sendCampaign` 호출 시) progress 표시
   - 3단계: "대상자 확인 중" → "알림톡 발송 중" → "완료"
5. Error 배너 추가
   - try/catch 에서 catch 시 state 설정 → 상단에 `<div role="alert" className="empty-state--error">` 표시
   - 기존 `console.error` 는 유지하되 UI 에도 노출
6. `role="tablist"` + `aria-selected` 부여 → TabBar (이미 TabBar 사용 중이므로 TabBar 에 전파)
   - **주의**: TabBar 는 공유 컴포넌트. W6이 aria 속성 추가 할 수 있음 → W3은 호출 시 aria-label 만 추가

## 금지 사항
- PartnerOfficeLayout 건드리지 않기 (병원 드롭다운 재구현 금지 — rules/welno-workflow.md)
- iframe embed 모드 분기 변경 금지 (isEmbed 로직 유지)
- 기존 탭 정의 수정 금지 (consultation / campaign / history 3탭)
- 기존 API 호출 로직 수정 금지 (load() 함수는 유지)
- 150줄 초과 단일 Edit 금지

## 검증 방법 (셀프)
1. npm run build → 에러 0
2. npx tsc --noEmit --skipLibCheck → 에러 0 (기존 3건 허용)
3. grep -n "KpiGrid\|KpiCard\|Spinner\|FilterBar\|ProcessingModal" backoffice/src/pages/CheckupDesignManagementPage/index.tsx → 각 1회 이상 등장

## 산출물 보고
- index.tsx diff 요약 (KpiGrid 추가 + FilterBar + Spinner + ProcessingModal 위치)
- styles.scss 추가 클래스 목록
- 스크린샷 (로컬 npm start 로 4탭 UI 확인 — 선택)
```

### 3.4 W4 — dev-coder-fe-checkup-front (Phase C 프론트 data-testid + aria)

```
너는 W4 워커. WELNO 프론트 검진설계 3 페이지에 data-testid 를 전수 부여하고 aria-* 를 추가한다.

## 잠금 파일 (독점 쓰기)
- frontend/src/features/checkup/CheckupDesignPage.tsx
- frontend/src/features/checkup/CheckupRecommendationsPage.tsx
- frontend/src/features/checkup/CollectingDataPage.tsx
- frontend/src/components/checkup-design/ProcessingModal.tsx (aria만)
- frontend/src/components/checkup-design/ChatInterface.tsx (aria만)
- frontend/src/components/checkup-design/ConcernSelection.tsx (aria만)

## 현 상태 (감사)
- data-testid 0개 → Playwright E2E 불가

## 작업 체크리스트 (20+ 셀렉터)

### CheckupDesignPage.tsx (메인 페이지)
- [ ] 최상위 div: `data-testid="checkup-design-page"`
- [ ] 로딩 상태: `data-testid="checkup-design-loading"`, aria-busy="true"
- [ ] 에러 메시지: `data-testid="checkup-design-error"`, role="alert"
- [ ] PasswordModal trigger: `data-testid="session-expired-modal"`
- [ ] ProcessingModal: `data-testid="checkup-processing-modal"`

### CheckupRecommendationsPage.tsx (결과 페이지)
- [ ] 최상위: `data-testid="checkup-recommendations-page"`
- [ ] 각 권장 검사 카드: `data-testid="recommendation-card-{idx}"` (map index)
- [ ] 신청 버튼: `data-testid="apply-button-{idx}"`
- [ ] 전체 확정 버튼: `data-testid="confirm-all-button"`
- [ ] 총 금액 표시: `data-testid="total-price"`
- [ ] 저장된 설계 로드 모달: `data-testid="load-saved-design-modal"`
- [ ] 로딩 Spinner: `data-testid="recommendations-loading"`
- [ ] 빈 상태: `data-testid="recommendations-empty"`

### CollectingDataPage.tsx (데이터 수집 대기)
- [ ] 최상위: `data-testid="collecting-data-page"`
- [ ] Progress bar: `data-testid="collecting-progress"`, role="progressbar", aria-valuenow/min/max
- [ ] 상태 텍스트: `data-testid="collecting-status-text"`

### 공용 컴포넌트 aria 추가
- [ ] ProcessingModal: role="dialog", aria-modal="true", aria-labelledby, aria-describedby
- [ ] ChatInterface: role="log", aria-live="polite"
- [ ] ConcernSelection 각 체크박스: aria-label="{관심사 이름}"
- [ ] 모든 button: focus-visible outline (CSS 는 W6에 위임)

## 금지 사항
- 컴포넌트 로직/렌더 순서 변경 금지 — 속성 추가만
- PasswordModal / ProcessingModal 내부 구조 변경 금지
- 새 컴포넌트 생성 금지
- SCSS 직접 수정 금지

## 검증 방법 (셀프)
1. `grep -roE 'data-testid="[^"]+"' frontend/src/features/checkup/ frontend/src/components/checkup-design/ | wc -l` → 20 이상
2. `grep -roE 'aria-(label|live|busy|expanded|modal|controls|valuenow)="' frontend/src/features/checkup/ | wc -l` → 10 이상
3. `cd frontend && NODE_OPTIONS=--openssl-legacy-provider npx tsc --noEmit --skipLibCheck` → 에러 0

## 산출물 보고
- 수정 파일별 data-testid 부여 개수
- aria-* 부여 개수
- 대상 Playwright selector 목록 (테스트 작성 시 참조용)
```

### 3.5 W5 — dev-coder-be (Phase D 백엔드 방어)

```
너는 W5 워커. WELNO 백엔드의 Phase 3 방어 레이어를 점검하고 보강한다.

## 잠금 파일 (독점 쓰기)
- backend/app/api/v1/endpoints/partner_office.py (`/simulate` 헬스체크 로그만)
- backend/app/core/config.py (ES URL env 기본값 확인)
- backend/app/services/checkup_design/vector_search.py (aretrieve 테스트만)
- backend/tests/test_vector_search_aretrieve.py (신규)
- backend/tests/test_simulate_endpoint.py (신규)

## 감사 결과 재확인 (중요)
1. FAISS `aretrieve()` — **vector_search.py:84 에 실존**. 감사는 오판. 호출부 회귀 테스트만 추가.
2. ES 설정 `elasticsearch_url=http://localhost:9200` — config.py:140 기본값 존재. ENV 로 override 가능. 실서버에서 `ELASTICSEARCH_URL` 환경변수 세팅 여부만 점검.
3. `/simulate` 엔드포인트 — Phase 3 스펙 Chapter 6 정의. 미구현 또는 구현이면 헬스체크 추가.

## 작업 체크리스트
1. partner_office.py 점검
   - `/simulate` 엔드포인트 존재 확인 (`grep "@router.post.*/simulate" partner_office.py`)
     - **존재 시**: 로그 추가 (simulate_request_count, error_rate 기록용 logger.info)
     - **미존재 시**: 스펙 Chapter 6 대로 POST 추가 + DB 테이블 `welno_mediarc_simulations` 마이그레이션 SQL 작성 (backend/migrations/20260416_welno_mediarc_simulations.sql 신규)
2. config.py 확인
   - `settings.elasticsearch_url` 호출부 3곳 (partner_office.py:532/669/830) 회귀
   - ENV 우선순위: `os.environ['ELASTICSEARCH_URL'] > default`
   - 실서버에서 환경변수 미세팅 시 커리시켜 알림 (logger.warning)
3. vector_search.py aretrieve 테스트 (신규)
   - backend/tests/test_vector_search_aretrieve.py 작성
   - import FAISSVectorSearch → 인스턴스 생성 → `await vs.aretrieve("고혈압", top_k=3)` → 결과 리스트 length > 0 확인
   - pytest-asyncio 기반
4. /simulate 컨트랙트 테스트 (신규)
   - backend/tests/test_simulate_endpoint.py 작성
   - 스펙 부록 C.1/C.2 payload 기준
   - assert: status 200, response schema 일치 (bodyage / ratios / will_rogers / arr_avg)
   - 에러 케이스: 404 (존재 없는 uuid), 400 (bmi_target 범위 초과)

## 금지 사항
- compute_improved_scenario 수정 금지 (스펙 16.2 "소스 변경 없음")
- engine.py 수정 금지 (R&D repo 동기화는 별도 경로)
- DB 스키마 변경은 마이그레이션 SQL **파일만** 작성, 실행은 ops 워커가 배포 단계에서
- `/simulate` 신규 구현 시 하비 승인 필요 — 단독 진행 금지
- 150줄 초과 단일 Edit 금지

## 검증 방법 (셀프)
1. `cd backend && python -m pytest tests/test_vector_search_aretrieve.py -v` → PASS
2. `cd backend && python -m pytest tests/test_simulate_endpoint.py -v` → PASS (또는 SKIP if endpoint 미구현)
3. `grep "elasticsearch_url" backend/app/core/config.py` → Field(default="http://localhost:9200", env="ELASTICSEARCH_URL") 확인
4. `grep -c "async def aretrieve" backend/app/services/checkup_design/vector_search.py` → 1

## 산출물 보고
- 점검 결과: /simulate 존재 여부, aretrieve 호출부 N곳, ES ENV 세팅 여부
- 신규 테스트 2종 PASS/FAIL
- 마이그레이션 SQL 작성 여부 (파일 경로)
- 다음 단계: dev-reviewer Phase D 검증
```

### 3.6 W6 — dev-coder-scss-tokens (Phase B+C SCSS 토큰 확장)

```
너는 W6 워커. WELNO 백오피스의 공용 SCSS 토큰을 확장하여 W1/W3의 신규 컴포넌트를 스타일링한다.

## 잠금 파일 (독점 쓰기)
- backoffice/src/styles/components/_missing-fields.scss (신규)
- backoffice/src/styles/components/_patient-meta.scss (신규)
- backoffice/src/styles/components/_debug-drawer.scss (신규)
- backoffice/src/pages/HealthReportPage/styles.scss (연장, section 추가만)
- backoffice/src/styles/_index.scss (import 라인 3개 추가만)

## 참조 SoT
- backoffice/src/styles/_variables.scss (토큰: $brand-brown, $gray-*, $font-*, $border-radius-*)
- backoffice/src/pages/RevisitPage/styles.scss (북스타 패턴)
- backoffice/src/styles/components/*.scss (기존 공용 컴포넌트 스타일)

## 작업 체크리스트

### _missing-fields.scss (신규)
```scss
.report-view__missing-fields-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin: 16px 0;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-left: 4px solid #ea580c;
  border-radius: $border-radius-md;
  color: #9a3412;
  font-size: $font-sm;

  &__icon { font-size: 18px; }
  &__text strong { font-weight: 600; }
  &__fields { font-family: monospace; font-size: $font-xs; color: #7c2d12; }

  &[role="alert"]:focus-visible { outline: 2px solid $brand-brown; }
}
```

### _patient-meta.scss (신규)
```scss
.report-view__meta-panel {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: $gray-50;
  border-radius: $border-radius-md;
  margin-bottom: 16px;
}

.report-view__meta-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: $white;
  border: 1px solid $gray-300;
  border-radius: $border-radius-sm;
  font-size: $font-sm;
  color: $gray-800;

  &__label { font-weight: 600; color: $gray-600; font-size: $font-xs; }
  &__value { font-weight: 500; }

  &--danger { border-color: #fecaca; background: #fef2f2; color: #b91c1c; }
  &--warning { border-color: #fed7aa; background: #fff7ed; color: #9a3412; }
}
```

### _debug-drawer.scss (신규)
```scss
.report-view__debug-drawer {
  &__trigger {
    position: fixed;
    bottom: 16px;
    right: 16px;
    padding: 8px 12px;
    background: $gray-900;
    color: $white;
    border-radius: $border-radius-md;
    font-size: $font-xs;
    z-index: 100;
  }

  &__content pre {
    font-family: monospace;
    font-size: $font-xs;
    background: $gray-50;
    padding: 12px;
    border-radius: $border-radius-sm;
    overflow-x: auto;
  }
}
```

### _index.scss 연장
```scss
@import 'components/missing-fields';
@import 'components/patient-meta';
@import 'components/debug-drawer';
```

### HealthReportPage/styles.scss 연장 (section 추가만)
- `.report-view__section--shock` 에 `position: relative;` 추가 (PatientMetaPanel absolute 위치 대응)
- focus-visible 토큰 정의:
  ```scss
  .report-view :focus-visible {
    outline: 2px solid $brand-brown;
    outline-offset: 2px;
  }
  ```

## 금지 사항
- 기존 클래스 변경 금지 (`.report-view__hero`, `.report-view__section` 등 변경 금지)
- _variables.scss 변경 금지 (토큰 재사용만)
- HealthReportPage/styles.scss 전면 재작성 금지 — **append만**
- CheckupDesignManagementPage/styles.scss 수정 금지 (W3 영역, 읽기만)

## 검증 방법 (셀프)
1. `npm run build` → SCSS 컴파일 에러 0
2. `grep -rn "missing-fields\|patient-meta\|debug-drawer" backoffice/src/styles/` → 최소 3 import
3. 브라우저에서 http://localhost:9283 열어 HealthReportPage 렌더 확인 (선택)

## 산출물 보고
- 신규 SCSS 파일 3종 라인 수
- _index.scss import 라인 추가 확인
- 기존 styles.scss diff (append 영역만)
```

### 3.7 W7 — dev-reviewer (공통 검증)

```
너는 dev-reviewer. W1~W6 산출물을 Level 1 독립 검증한다. Generator ≠ Evaluator 원칙 준수.

## 검증 대상
- W1 (Phase A 블로커): PatientMetaPanel / DebugDrawer / MissingFieldsBanner + ReportView
- W2 (Phase C 셀렉터): 10.x 36종 셀렉터 전수 DOM 부여
- W3 (Phase B 북스타): CheckupDesignManagementPage KPI/Filter/Spinner/Modal
- W4 (Phase C 프론트): features/checkup data-testid 20+
- W5 (Phase D 백엔드): FAISS aretrieve / ES / /simulate 헬스
- W6 (SCSS): 토큰 확장 + focus-visible

## 검증 체크리스트

### 각 워커 공통
1. 잠금 파일 준수 여부 (다른 워커 영역 수정 없음)
2. CLAUDE.md 절대 원칙 11 준수 (크리티컬 파일 수정 없음)
3. 150줄 단일 Edit 초과 여부 (원칙 5)
4. tsc --noEmit 에러 0
5. 기존 테스트 회귀 없음

### Phase A (W1)
1. 신규 3 컴포넌트 존재 + import 경로 일치
2. data-test 속성 6종 (patient-meta / patient-bmi / patient-smoking / patient-drinking / missing-fields / imputed-fields) 부여 완료
3. ReportView 렌더 순서 기존 5단계 유지
4. MissingFieldsBanner missingFields.length === 0 시 null 반환 로직 존재
5. DebugDrawer NODE_ENV production 에서 비활성화

### Phase C (W2)
1. `grep -roE 'data-test="[a-z-]+' backoffice/src/pages/HealthReportPage/ | grep -oE '"[a-z-]+"' | sort -u | wc -l` → 스펙 10.x SoT (36종) 와 비교하여 100% 일치
2. key 변수 치환 부분 (`disease-card-${key}` 등) 리터럴 템플릿 사용 확인
3. 기존 컴포넌트 로직 변경 0 (diff에서 속성 추가만)

### Phase B (W3)
1. KpiGrid 4 KpiCard 렌더 확인
2. FilterBar / Spinner / ProcessingModal import 존재
3. iframe 모드 분기 미변경 (isEmbed 조건문 보존)

### Phase C (W4)
1. 3 페이지에 data-testid 20+ 부여
2. aria-* (live/busy/modal/label) 10+ 부여
3. 기존 로직 변경 없음

### Phase D (W5)
1. aretrieve 테스트 PASS
2. /simulate 존재 여부 명시 (존재/미존재 리포트)
3. compute_improved_scenario 0 변경 확인 (git diff)
4. ES ENV 체크 결과 명시

### SCSS (W6)
1. _variables.scss 미변경 확인
2. @import 순서 기존 파일 뒤 추가 (override 없음)
3. `:focus-visible` CSS 존재

## 보고 형식
각 워커마다:
```
### W{N} — {이름} 검증 결과
**판정**: PASS / CONDITIONAL PASS / FAIL
**HIGH**: ...
**MEDIUM**: ...
**LOW**: ...
**회귀 위험**: ...
**다음 단계**: {워커에게 수정 요청 / harby-verifier로 진행}
```

## 금지 사항
- 본인이 코드 수정 (read-only)
- 모호한 판정 ("대략 맞다" 금지, 근거 3개 필수)
```

### 3.8 W8 — harby-verifier (Level 2 크로스팀 정합성)

```
너는 harby-verifier. Level 2 크로스팀 정합성을 최종 검증한다. Self-Evaluation Bias 방지.

## 검증 대상
전체 Phase A+B+C+D 통합. dev-reviewer Level 1 PASS 완료된 산출물.

## 검증 체크리스트

### 타입 정합성 (크로스팀)
1. 엔진 SimulateResponse (Python) ↔ BE schema (Pydantic) ↔ FE SimulateResult (TS) 타입 일치
   - `ratios: Record<string, {orig, improved}>` 엔진/BE/FE 3자 동일
   - `will_rogers: WillRogersEntry[]` 동일
2. ReportData.patient_info (useMediarcApi.ts) missing_fields / imputed_fields optional 처리 일관
3. MilestoneKey ('current' | 'minus2' | 'minus5' | 'minus10' | 'normal') FE 전역 일관

### 스펙 16.1 (수용 기준) 전수 확인
- [ ] "추정 건강나이" 문구 0건 (`grep -r "추정 건강나이" backoffice/src`)
- [ ] "알츠" 단독 0건 (`grep -rn '"알츠"' backoffice/src` — "알츠하이머" 만 허용)
- [ ] WillRogersCaption Feinstein 1985 PMID 4000199 문구 존재
- [ ] MilestoneSlot 5 카드 렌더 (current/minus2/minus5/minus10/normal)
- [ ] BmiSlider 17~40 범위, step 0.1
- [ ] TimeDimToggle 4 옵션 (0/6/12/60)
- [ ] TimeDim=0 data.improved 와 결과 일치 (α=1.0)
- [ ] **Chapter 10 data-test 셀렉터 100% DOM 존재** (W2 영역)

### 접근성 체크
- [ ] `aria-expanded`, `aria-controls` Disclosure (스펙 16.4)
- [ ] `role="alert"` MissingFieldsBanner
- [ ] focus-visible 전역 CSS 적용

### 회귀 (기존 기능)
1. `data-testid` 제거 없음 (W2가 추가만 했는지)
2. PartnerOfficeLayout / useEmbedParams 변경 없음
3. 기존 API 호출 경로 변경 없음

### 노션 페이지 생성 (CLAUDE.md rules/notion-dedup.md)
- [ ] 배포 직전 notion-deploy 로 배포 기록 준비

## 판정 형식
```
📊 harby-verifier Level 2 최종 판정

1. 타입 정합성: PASS/FAIL + 근거 3개
2. 수용 기준: PASS/FAIL + 미달 항목 리스트
3. 접근성: PASS/FAIL
4. 회귀: PASS/FAIL
5. 배포 승인: YES/NO

**배포 승인 조건**: 5개 모두 PASS. 1건이라도 FAIL 시 배포 보류 + 하비 에스컬레이션.
```

## 금지 사항
- dev-reviewer Level 1 결과를 그대로 신뢰 — 팩트 3개 이상 재검증 (feedback_always_review.md)
- 코드 직접 수정 금지 (read-only)
```

---

## 4. 의존성 DAG + 실행 순서

### 4.1 DAG

```
D1  ┌──────────────────────────────────────────────────┐
    │ W1 (blocker) ─┐                                  │
    │ W3 (checkup-bo)                                  │
    │ W5 (backend)                                     │
    │ W6 (scss)                                        │
    └──────────────┬───────────────────────────────────┘
                   │
D2  ┌──────────────┴───────────────────────────────────┐
    │ W1 merge    → W2 (selectors) 착수                │
    │ W3 진행     → W4 (checkup-front) 착수            │
    │ W5 진행                                          │
    │ W6 진행 → W1 SCSS 사용 가능                      │
    └──────────────┬───────────────────────────────────┘
                   │
D3  ┌──────────────┴───────────────────────────────────┐
    │ W1 완료 → W7(dev-reviewer) Phase A 검증          │
    │ W3 완료 → W7 Phase B 검증                        │
    │ W5 완료 → W7 Phase D 검증                        │
    │ W6 완료 → W7 SCSS 검증                           │
    │ W2, W4 진행 중                                   │
    └──────────────┬───────────────────────────────────┘
                   │
D4  ┌──────────────┴───────────────────────────────────┐
    │ W2 완료 → W7 Phase C 검증 (리포트)              │
    │ W4 완료 → W7 Phase C 검증 (체크업 프론트)        │
    │ W7 전체 PASS 수집                                │
    └──────────────┬───────────────────────────────────┘
                   │
D5  ┌──────────────┴───────────────────────────────────┐
    │ W8 (harby-verifier) Level 2 통합 검증            │
    │ 하비 Level 3 배포 승인                           │
    └──────────────┬───────────────────────────────────┘
                   │
D6  ┌──────────────┴───────────────────────────────────┐
    │ ops 배포 (git push → 서버 pull → pm2 restart)    │
    │ 배포 후 E2E + 5분 모니터링                       │
    └──────────────────────────────────────────────────┘
```

### 4.2 병렬 시작 가능 워커 (D1)
- W1, W3, W5, W6 → 즉시 병렬 시작 (의존성 없음)
- W2 → W1 PatientMetaPanel merge 완료 후 (D2)
- W4 → W6 focus-visible 토큰 merge 후 (D2)

### 4.3 dev-reviewer (W7) 투입 시점
- 각 워커 개별 완료 직후 (D3, D4) — 단일 페이즈씩 수신
- 종합 리포트는 D4 말 전체 통합본
- CLAUDE.md 절대원칙 10 준수: 모든 수정 → dev-reviewer 필수

### 4.4 harby-verifier (W8) 투입 시점
- D5 시작 시점, dev-reviewer 전체 PASS 수신 후
- Level 2 크로스팀 정합성 점검
- FAIL 시 D5 안에서 재수정 → D6 지연

### 4.5 dev-lead 조율 지점
- D1 kickoff: 파일 잠금 재확인, 하비 승인 획득
- D2 시작: W2, W4 착수 가능성 확인 (W1, W6 진행률 체크)
- D3 End: Phase A 검증 PASS 확인 → 배포 계획 확정
- D5 End: harby-verifier PASS 후 배포 승인 요청
- D6: 배포 진행, ops 워커와 공조

---

## 5. 검증 + 배포 체크리스트

### 5.1 개발 중 (매 워커)

```
□ npm run build 에러 0 (frontend / backoffice 각각)
□ npx tsc --noEmit --skipLibCheck 에러 0 (기존 3건 허용)
□ python3 -m py_compile backend/app/**/*.py 에러 0 (W5)
□ dev-reviewer 개별 PASS
□ 잠금 파일 외 수정 없음 (git diff로 확인)
```

### 5.2 배포 전 (D5 End)

```
□ dev-reviewer Level 1 전 워커 PASS
□ harby-verifier Level 2 PASS
□ Playwright E2E 실행:
  cd frontend && WELNO_E2E_URL=http://localhost:9282 python3 -m pytest e2e/ -v
  → PASS ≥ 8 시나리오
□ 회귀 테스트:
  grep -rn "추정 건강나이" backoffice/src → 0건
  grep -rn '"알츠"' backoffice/src → 0건 (알츠하이머만 허용)
  grep -roE 'data-test="[a-z-]+"' backoffice/src/pages/HealthReportPage/ | sort -u | wc -l → 36 이상
  grep -roE 'data-testid="[a-z-]+"' frontend/src/features/checkup/ | wc -l → 20 이상
□ 하비 Level 3 승인
□ 롤백 계획 문서화 (feature flag OFF 경로)
```

### 5.3 배포 실행 (D6)

```
# 1. 프론트엔드 빌드 + static 복사
cd frontend && npm run deploy:simple

# 2. 백오피스 빌드
cd backoffice && npm run build

# 3. 커밋 + 푸시
git add -A
git commit -m "feat(phase3-recovery): 블로커 3컴포넌트 + 셀렉터 36종 + 북스타 정합

- PatientMetaPanel / DebugDrawer / MissingFieldsBanner 신규
- HealthReportPage data-test 36종 전수 부여
- CheckupDesignManagementPage KpiGrid/FilterBar/Spinner/ProcessingModal 적용
- frontend/features/checkup data-testid 20+ + aria-*
- SCSS 토큰 확장 (_missing-fields / _patient-meta / _debug-drawer)
- FAISS aretrieve 회귀 테스트 + /simulate 헬스체크

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main

# 4. 서버 배포 (2-hop SSH — rules/ops-workflow.md 참조)
sshpass -p '<JUMP_PW>' ssh -o ProxyCommand='...' welno@10.0.1.6 'bash -s' <<'EOF'
cd /home/welno/workspace/PROJECT_WELNO_BEFE/planning-platform
sudo -u welno git pull origin main
# 마이그레이션 있으면 먼저:
# PGPASSWORD=... psql -h 10.0.1.10 -U peernine -d p9_mkt_biz -f backend/migrations/20260416_welno_mediarc_simulations.sql
sudo -u welno pm2 restart WELNO_BE
sudo -u welno pm2 logs WELNO_BE --lines 10 --nostream
EOF

# 5. 배포 후 헬스체크
curl -s https://welno.kindhabit.com/welno-api/v1/health → 200
curl -s https://welno.kindhabit.com/welno-api/v1/partner-office/mediarc-report/stats → 200

# 6. ops-monitor 5분 감시
# 7. feature flag 토글 (초기 OFF → 내부 QA → ON)
```

### 5.4 배포 후 (D6 + 24시간)

```
□ pm2 logs WELNO_BE 에러 0건 / 1시간
□ DB: SELECT COUNT(*) FROM welno_mediarc_simulations (W5 마이그 시)
□ ES 에러율 배포 전 대비 증가 없음
□ Playwright E2E 실서버 대상 재실행:
  WELNO_E2E_URL=https://welno.kindhabit.com python3 -m pytest e2e/ -v
□ notion-deploy 배포 기록 생성
□ docs/work-tracker.md 갱신
□ docs/work-history.md ## 2026-04-16 — [WELNO] Phase 3 복구 배포 엔트리 추가
```

### 5.5 Migration 필요 여부
- **W5가 `/simulate` 엔드포인트 미존재 판정 시**: `backend/migrations/20260416_welno_mediarc_simulations.sql` 신규 — 배포 전 실행
- **존재 판정 시**: 마이그레이션 불필요

### 5.6 롤백 계획
1. **Level 1 (FE 깨짐)**: feature flag `REACT_APP_PHASE3_RECOVERY=off` 재배포 (5분)
2. **Level 2 (BE 에러)**: git revert + pm2 restart (10분)
3. **Level 3 (DB 손상)**: `DROP TABLE welno_mediarc_simulations;` (외래키 없음 안전)
4. **Level 4 (전체 장애)**: 1커밋 전으로 reset (SSH + git reset --hard + pm2 restart)

---

## 6. 리스크 + 완화

### 6.1 고위험 리스크

| # | 리스크 | 발생확률 | 영향 | 완화 |
|---|---|:-:|:-:|---|
| R1 | 40-53시간 추정을 6 워커 병렬로 5일 압축 실패 | 중 | 고 | 파일 잠금 매트릭스 강제 + dev-lead 일일 체크포인트. 늦으면 Phase D를 별도 sprint로 분리 |
| R2 | W2 36 셀렉터 부여 시 key 변수(disease key) 템플릿 리터럴 오타로 E2E 실패 | 중 | 중 | Playwright E2E spec 을 W2 완료 직후 dev-reviewer가 grep 검증 — 문자열 대조 3회 |
| R3 | W1 ReportView 렌더 순서 변경으로 기존 Phase 2 회귀 | 낮 | 고 | dev-reviewer Level 1에서 5단계 렌더 순서 diff 확인 필수 |
| R4 | W3 CheckupDesignManagementPage KPI 추가로 iframe embed 모드 레이아웃 깨짐 | 중 | 중 | iframe 모드 E2E 별도 시나리오 작성 (WELNO_E2E_URL + ?api_key=xxx) |
| R5 | W5 `/simulate` 미존재 판정 시 신규 구현 범위 폭증 | 중 | 고 | 신규 구현이 필요하면 본 sprint에서 **제외**하고 별도 티켓 — 하비 즉시 에스컬레이션 |
| R6 | W6 SCSS @import 순서 오류로 기존 스타일 override | 낮 | 중 | _index.scss 기존 import 뒤에만 append. specificity 유지 |
| R7 | 메인 스펙 Chapter 15와 본 기획서 워커 매핑 충돌 | 낮 | 중 | 본 기획서는 Chapter 15 확장판 — BeforeAfterBlock 공간 분리 규칙 계승 (W2 내부 작업) |
| R8 | Playwright E2E 로컬 환경 의존 (WELNO_E2E_URL) 실서버 테스트 미실행 | 중 | 중 | D5 로컬 PASS 후 D6 배포 직후 실서버 재실행 |
| R9 | PM2 재시작 중 OOM (기존 1G 제한 78회 재시작 이슈) | 중 | 고 | 배포 직전 pm2 reset-metadata. 메모리 peak 모니터. rules/welno-workflow.md 준수 |
| R10 | 서브에이전트 허구 보고 (feedback_always_review.md 사례) | 중 | 고 | dev-reviewer + harby-verifier 2단계 견제. "FAISS aretrieve 누락" 감사 오판 재발 방지 |

### 6.2 파일 충돌 가능 영역
- **ReportView.tsx**: W1 전용. W2는 읽기만. 충돌 위험 낮음.
- **HealthReportPage/styles.scss**: W6 전용. W2 읽기만.
- **BeforeAfterBlock.tsx**: W2 전용. 스펙 Chapter 15 의 "3-A 먼저 merge → 3-C rebase" 규칙은 이미 merge 완료 상태 가정.

### 6.3 비침습 원칙 위반 가능 지점
- **PartnerOfficeLayout**: W3이 병원 드롭다운 재구현 금지 → rules/welno-workflow.md 검증
- **useEmbedParams**: 전 워커 수정 금지
- **compute_improved_scenario**: W5가 건드리지 않도록 git diff 확인
- **_variables.scss**: W6이 토큰 재사용만, 추가/수정 금지

---

## 7. 성공 기준 (Acceptance Criteria)

### 7.1 기능 (Phase A 블로커)
- [ ] PatientMetaPanel 렌더 존재 (`[data-test="patient-meta"]` DOM)
- [ ] MissingFieldsBanner — missing_fields 있을 때만 렌더
- [ ] DebugDrawer — ?debug=1 로 토글 가능 (production 비활성)
- [ ] `patient-bmi`, `patient-smoking`, `patient-drinking`, `missing-fields`, `imputed-fields` 5종 셀렉터 DOM 존재

### 7.2 셀렉터 (Phase C 리포트)
- [ ] `grep -roE 'data-test="[a-z-]+' backoffice/src/pages/HealthReportPage/ | grep -oE '"[^"]+"' | sort -u | wc -l` ≥ 36
- [ ] 스펙 Chapter 10.2 ~ 10.7 100% DOM 일치
- [ ] data-testid 기존 9종 제거 없음 (하위호환)

### 7.3 북스타 정합 (Phase B)
- [ ] CheckupDesignManagementPage 에 KpiGrid (4 cards) + FilterBar (3 filter) + Spinner 렌더
- [ ] ProcessingModal 캠페인 발송 중 표시
- [ ] iframe embed 모드 레이아웃 기존 동일 (회귀 없음)

### 7.4 프론트 접근성 (Phase C 프론트)
- [ ] `grep -roE 'data-testid="[a-z-]+' frontend/src/features/checkup/ | wc -l` ≥ 20
- [ ] ProcessingModal role="dialog" aria-modal="true"
- [ ] 각 button focus-visible 적용

### 7.5 백엔드 (Phase D)
- [ ] `pytest backend/tests/test_vector_search_aretrieve.py` PASS
- [ ] `/simulate` 존재 확인 리포트 (존재 or 신규 구현 스코프 보고)
- [ ] ES ENV 체크 결과 명시

### 7.6 접근성 전역
- [ ] 리포트 페이지에서 Tab 키로 모든 interactive 요소 도달
- [ ] focus-visible outline 적용
- [ ] MissingFieldsBanner role="alert" aria-live="polite"

### 7.7 회귀
- [ ] Playwright E2E 기존 시나리오 전부 PASS
- [ ] Phase 1 / Phase 2 기능 0회귀 (BodyAgeChart / BeforeAfterBlock / MilestoneSlot 렌더 정상)
- [ ] `/api/v1/partner-office/mediarc-report/*` 엔드포인트 기존 호출 정상

### 7.8 배포 + 모니터
- [ ] pm2 logs WELNO_BE 배포 후 에러 0건 / 1시간
- [ ] 실서버 Playwright E2E 8 시나리오 PASS
- [ ] notion-deploy 페이지 생성
- [ ] work-tracker.md / work-history.md 갱신

### 7.9 Generator ≠ Evaluator
- [ ] W1~W6 코드 → dev-reviewer (W7) Level 1 PASS
- [ ] dev-reviewer → harby-verifier (W8) Level 2 PASS
- [ ] 하비 Level 3 최종 승인

---

## 8. 부록 — 실행 프롬프트 템플릿

### 8.1 메인이 워커 스폰 시 사용할 Task 호출

```
# 동시 병렬 4 워커 (D1 시작)
Task(dev-coder W1): 위 3.1 프롬프트 전문 전달
Task(dev-coder W3): 위 3.3 프롬프트 전문 전달
Task(dev-coder W5): 위 3.5 프롬프트 전문 전달
Task(dev-coder W6): 위 3.6 프롬프트 전문 전달

# D2 추가 2 워커 (W1/W6 merge 후)
Task(dev-coder W2): 위 3.2 프롬프트 전문 전달
Task(dev-coder W4): 위 3.4 프롬프트 전문 전달

# D3~D5 검증
Task(dev-reviewer): 위 3.7 프롬프트 전달 + 각 워커 산출물 경로
Task(harby-verifier): 위 3.8 프롬프트 전달 + dev-reviewer PASS 리포트
```

### 8.2 하비 최종 승인 요청 형식

```
📊 Phase 3 복구 배포 승인 요청

1. 상황 요약: W1~W6 6 워커 병렬 완료, dev-reviewer + harby-verifier 전체 PASS
2. 변경 범위:
   - 신규 3 컴포넌트 (PatientMetaPanel / DebugDrawer / MissingFieldsBanner)
   - 셀렉터 36종 전수 부여 (리포트) + 20종 (프론트 검진)
   - KpiGrid/FilterBar/Spinner/ProcessingModal 체크업 BO 적용
   - SCSS 토큰 3 신규
   - 백엔드 테스트 2 신규
3. 배포 대상: WELNO_BE (pm2 restart) + static (deploy:simple)
4. 롤백 경로: feature flag OFF (5분 내)
5. 리스크: R1~R10 모두 완화 완료

**배포 진행 승인하시겠습니까? (YES/NO)**
```

---

## 9. 스펙 간 정합성

본 기획서는 다음 스펙과 정합:

| 스펙 | 정합 방식 |
|---|---|
| `docs/mediarc-report-phase3-spec.md` Chapter 15 (에이전트 분담) | 본 기획서는 확장판 — 3-A/B/C/D 를 Phase A(블로커)/B(북스타)/C(셀렉터+접근성)/D(백엔드 방어) 로 재편 |
| `docs/backoffice-ux-phase1-spec.md` (공용 컴포넌트) | Phase B (W3) 에서 PageLayout/KpiGrid/FilterBar/TabBar 재사용 원칙 준수 |
| `docs/mediarc-report-phase1-spec.md` (5단계 여정) | ReportView 기존 순서 유지 (W1 독점) |
| `docs/mediarc-report-phase0-spec.md` (ReportData 타입) | useMediarcApi.ts 타입 변경 없음 |
| CLAUDE.md 절대원칙 5 (150줄) / 10 (dev-reviewer 필수) / 11 (크리티컬 파일 보호) | 본 기획서 전체에서 준수 |
| `.claude/rules/welno-workflow.md` (배포 절차, PartnerOfficeLayout 재사용) | Phase B (W3) 에서 명시 |
| `.claude/rules/team-governance.md` (Generator ≠ Evaluator) | W7 (Level 1) + W8 (Level 2) + 하비 (Level 3) 3단계 견제 |
| `.claude/rules/verify.md` (Task-Do-Verify) | 각 워커 셀프검증 + dev-reviewer 순서 |

---

## 10. 결론

**6 워커 × 5일 병렬 + 2일 검증/배포 = 총 7일 sprint** 로 Phase 3 완성 복구 가능.

하비 승인 시 즉시 D1 착수. 본 기획서는 단일 sprint SoT 이며, 구현 중 스펙 불일치 발견 시 dev-planner (본 문서 소유자) 에게 에스컬레이션 후 스펙 수정 후 작업 진행. 스펙 수정 없이 코드 변경 금지.

**승인 대기**:
- 하비 (Level 3) — Kickoff 승인 1회 + 배포 승인 1회
- 이외 중간 승인 없음, 자동 진행

---

*기획서 끝*
