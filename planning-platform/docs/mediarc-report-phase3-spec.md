# mediArc 리포트 뷰 — Phase 3 통합 마스터 스펙

**버전**: v1.0 (master)
**작성일**: 2026-04-14
**작성자**: dev-planner (기획/UI·UX 설계)
**상위 문서**:
- `docs/mediarc-report-deepdive.md` — 5단계 여정 SoT (921 lines)
- `docs/mediarc-report-phase0-spec.md` — Phase 0 ReportData 타입 확장 스펙
- `docs/mediarc-report-phase1-spec.md` — Phase 1+2 실행 스펙 (1379 lines, AI summary, 5-step skeleton)
- `p9_mediArc_engine/phase3_our_design/02_mediarc_engine_spec.md` — 엔진 recalculate_with_behavior_change 설계
- `p9_mediArc_engine/phase3_our_design/05_patient_motivation_strategy.md` — 행동경제학 + what-if 설계

**대상 디렉토리**:
- R&D: `/Users/harby/0_workspace/PEERNINE/p9_mediArc_engine/demo/engine.py` (1,787 lines)
- WELNO 이식본: `/Users/harby/0_workspace/PEERNINE/PROJECT_WELNO_BEFE/planning-platform/backend/app/services/report_engine/engine.py` (1,807 lines)
- FE: `/Users/harby/0_workspace/PEERNINE/PROJECT_WELNO_BEFE/planning-platform/backoffice/src/pages/HealthReportPage/`
- BE API: `/Users/harby/0_workspace/PEERNINE/PROJECT_WELNO_BEFE/planning-platform/backend/app/api/v1/endpoints/partner_office.py`

**사전 제약 (요구사항에서 명시된 대로 엄수)**:
1. 이모지 전면 금지 — 스펙 문서, 주석, 커밋 메시지, 코드 리터럴 모두 해당
2. 하위 호환성 엄수 — 기존 ReportData 필드, API 스키마, DB 컬럼 어느 것도 삭제·이름변경 금지
3. PMID 할루시네이션 금지 — 시간축 복구 곡선 인용은 PubMed 직접 확인 또는 "출처 미확인" 명기
4. R&D ↔ WELNO 동기 — `compute_milestone_scenario()` 는 양쪽에 동일하게 이식, 테스트도 양쪽 골든 샘플에 대해 실행
5. 공유 컴포넌트 재사용 — PageLayout/Drawer/KpiGrid/TabBar/FilterBar/HospitalSearch/Disclosure 패턴 준수
6. `.report-view__*` BEM 네임스페이스 안에서만 확장 (글로벌 CSS 클래스 충돌 금지)
7. iframe embedMode 호환 — `containment="container"` 상태에서도 슬라이더/드로어가 깨지지 않을 것
8. API 키 노출 금지 — `ANTHROPIC_API_KEY` 등은 서버 `.env`에만, 코드/config.json/로그 금지

---

## 목차

1. 개요와 목표
2. 배경과 문제 정의
3. 작업 분할 (3-A / 3-B / 3-C / 3-D)
4. 용어 정리와 라벨 정정표 (3-A 본체)
5. 엔진 계약 변경 — `compute_milestone_scenario()`
6. BE API 계약 — `POST /partner-office/mediarc-report/{uuid}/simulate`
7. DB 스키마 — 캐시 테이블 `welno_mediarc_simulations`
8. FE 아키텍처 재설계 — MilestoneSlot + TimeDim
9. 컴포넌트 명세 (Props, State, Events, BEM, iframe)
10. 데이터 매핑 매트릭스 (3-D 본체)
11. SCSS 토큰 연장 및 BEM 확장 목록
12. 회귀 위험 목록과 방지책
13. 테스트 계획 (단위 / E2E / 골든 검증)
14. 롤아웃 / 롤백 / 배포 계획
15. 에이전트 병렬 분담안 (1 sprint 내 완료)
16. 수용 기준 (Acceptance Criteria) 전체 체크리스트
17. 부록 A — PMID 검증 테이블
18. 부록 B — 엔진 ↔ FE 필드 타입 매트릭스
19. 부록 C — 시뮬레이션 예시 payload / response
20. 부록 D — 용어 사전

---

## 1. 개요와 목표

### 1.1 한 줄 요약

건강리포트 뷰의 용어·UX 품질을 교정하고(3-A), "현재 체중 / -2kg / -5kg / -10kg / 정상 BMI" 5단계 체중 감량 마일스톤(3-B), "현재 / 6개월 / 1년 / 5년" 4단계 시간축 복구 곡선(3-C), 그리고 전체 ReportData 필드의 렌더 매트릭스(3-D)를 한 sprint 안에 동시 반영한다.

### 1.2 왜 한 sprint 에 묶는가

- 3-A 라벨 정정은 BodyAgeChart / WillRogersCaption / BeforeAfterRow / AppendixBlock 등 다중 컴포넌트를 가로지른다. 3-B/3-C 가 같은 시점에 BeforeAfterBlock 과 MilestoneSlot 을 재설계하므로, 분리 배포 시 동일 파일이 2회 수정되어 회귀 위험이 2배로 상승한다.
- 3-D 매트릭스 점검은 3-A/3-B/3-C 결과를 대상으로 해야 의미가 있다. 매트릭스를 먼저 쓰고 구현을 나누면 실제 렌더 여부가 달라 재작성이 필수가 된다.
- 엔진 `compute_milestone_scenario()` 는 3-B(BMI 축) 와 3-C(시간 축) 양쪽에서 공유된다. 한 번의 엔진 배포로 두 FE 축이 모두 활성화된다.

### 1.3 성공 지표 (정량)

| 지표 | 기준값 | 측정 방법 |
|---|---|---|
| 3-A 라벨 오표기 | 0 건 | 3-A 정정표 전수 grep 결과 |
| 3-B 마일스톤 카드 렌더 | 5 장 동시 렌더 | Playwright 스크린샷 + DOM 셀렉터 카운트 |
| 3-C 시간축 드롭다운 | 4 옵션 (현재/6m/1y/5y) | `role="option"` 개수 |
| 엔진 회귀 테스트 | 기존 352 골든 편차 0 | `python demo/engine.py` 호출 후 summary JSON diff |
| BE API p95 latency | 800 ms 이하 | `/simulate` 1000회 호출 평균 |
| iframe embedMode 회귀 | 기존 Phase 1 E2E PASS 유지 | `WELNO_E2E_URL=... pytest` |

### 1.4 비목표 (Out of scope)

- 새 질환 추가 (7대 질환 + 고혈압 유지)
- BioAge GB pkl 재학습 (sklearn 버전 이슈는 별건)
- mediArc 자체 RAG 채팅 통합
- 백오피스 외 파트너 앱(WELNO 일반 사용자 앱) 반영 — 파트너 오피스 전용

### 1.5 기간 가정

- 개발: 5 영업일 (3-A 1d / 3-B 2d / 3-C 2d / 3-D 0.5d, 병렬)
- 테스트: 1 영업일 (E2E + 골든 + BE 계약 테스트)
- 배포 + 모니터: 0.5 영업일 (WELNO BE + 백오피스 static)
- 총 6.5 영업일, 1 sprint 내 완료 가능

---

## 2. 배경과 문제 정의

### 2.1 현재 관찰된 문제 (fact)

#### 2.1.1 라벨 부정확성 (3-A 대상)

| 위치 | 파일:라인 | 현재 라벨 | 문제 | 정답 |
|---|---|---|---|---|
| BodyAgeChart Tooltip | `backoffice/src/pages/HealthReportPage/components/BodyAgeChart.tsx:63` | `"추정 건강나이"` | 이 값은 질환별 `disease_ages` (알츠/뇌혈관/심혈관/고혈압/당뇨/대사/CKD) — 신체 "부위별" 이 아니라 "질환별 건강나이 Δ" | `"질환별 건강나이"` 또는 `"질환별 추정 생체나이"` |
| BodyAgeChart 컴포넌트 설명 | 상위 섹션 제목 (ReportView 주변) | "부위별 건강나이" 로 지칭되는 위치 | 엔진 `DISEASE_AGE_MAP` 는 장기가 아닌 질환명 ("알츠하이머"/"뇌혈관질환" 등) | "질환별 건강나이 (Disease-specific Age)" |
| WillRogersCaption 문구 | `backoffice/src/pages/HealthReportPage/components/WillRogersCaption.tsx:9` | `"같은 코호트 기준 등수 — 윌로저스 방지 (Feinstein 1985)"` | 일반 수검자가 "코호트"/"윌로저스" 용어를 이해하지 못함, 이유 설명 누락 | "기준 집단(코호트)을 고정해 계산했습니다 — 생활습관을 바꿔도 비교 대상이 바뀌지 않도록 하는 장치입니다 (Feinstein 1985, PMID 4000199)" |
| BeforeAfterRow "근거" 없음 | `BeforeAfterRow.tsx` | 숫자만 표시 — ratio/rank/ARR 계산식 비공개 | 사용자가 "이 숫자가 어떻게 나왔지?" 라고 묻기 어려움 — Disclosure 로 공식 공개 필요 | 각 행 하단에 접이식 `<Disclosure>` 제공 |

#### 2.1.2 데이터 시각화 축 누락 (3-B, 3-C 대상)

- 현재 `BeforeAfterBlock` 은 **단일 개선 시나리오** (BMI<23 + 금연 + 금주 reset) 만 노출한다. 엔진 `compute_improved_scenario()` 가 고정된 시나리오만 반환한다 (demo/engine.py:1156-1265).
- 체중 단계별(3-B) 또는 시간축 별(3-C) 위험 변화를 시각화할 축 자체가 없다.
- `MilestoneSlot` 은 stub placeholder 로 비어 있다 (components/MilestoneSlot.tsx:4-13).

#### 2.1.3 데이터 매핑 블라인드스팟 (3-D 대상)

- `ReportData` 타입 (useMediarcApi.ts:105-118) 은 12개 최상위 필드를 포함한다 (name/age/sex/group/bodyage/rank/diseases/nutrition/gauges/patient_info/improved/disease_ages).
- 현재 ReportView 및 자식 컴포넌트가 어떤 필드를 어디서 렌더하는지 공식 매트릭스가 없어 회귀 테스트가 어렵다. 예: `patient_info.imputed_fields` 는 AppendixBlock 에서만 사용되는데 문서화 안 됨.

### 2.2 왜 지금 고쳐야 하는가

- 실사용 시작이 임박(2026-04-14 WELNO 백오피스 이식 완료). 라벨 오표기는 사용자 신뢰도에 직결된다.
- 골든 352건 매칭률 48% 가 올라가려면 코호트 고정 로직(윌 로저스) 이 사용자에게 보여져야 피드백이 가능하다.
- 3-B/3-C 없이는 "행동 변화 → 효과" 를 시각적으로 보여줄 수 없다 — 제품 핵심 가치 손상.

### 2.3 변경 원칙

- **엔진 부작용 최소화**: `compute_improved_scenario()` 는 건드리지 않는다. 새 함수 `compute_milestone_scenario()` 를 추가하고 필요한 경우 기존 함수에서 공유 유틸을 호출한다.
- **스키마 후행 호환**: `ReportData.milestones?` 는 옵셔널로 추가 (`?`). 기존 소비자는 영향 없음.
- **백오피스 렌더 우선**: 먼저 BeforeAfterBlock 내부에 TimeDim toggle, MilestoneSlot 내부에 BMI 카드 5종을 추가. 별도 페이지는 만들지 않음.
- **네이밍 1회 확정**: 이 스펙에서 쓰는 용어는 `용어 사전 (부록 D)` 으로 강제 동기화.

---

## 3. 작업 분할 (3-A / 3-B / 3-C / 3-D)

네 개의 하위 작업은 **병렬 처리 가능**하되 충돌 영역을 명시한다.

### 3.1 작업 개요 표

| 코드 | 제목 | 담당 | 소요 | 주 파일 | 충돌 영역 |
|---|---|---|---|---|---|
| 3-A | 라벨 / UX 정정, WillRogersCaption 확장, BeforeAfterRow Disclosure | dev-coder A | 1 d | `BodyAgeChart.tsx`, `WillRogersCaption.tsx`, `BeforeAfterRow.tsx`, `BeforeAfterBlock.tsx`, `AppendixBlock.tsx`, `_report-view.scss` | BeforeAfterRow (3-C 와 겹침) |
| 3-B | 마일스톤 BMI 단계 (5 카드 + 슬라이더) | dev-coder B | 2 d | `MilestoneSlot.tsx` (재작성), `engine.py` (compute_milestone_scenario), `partner_office.py` (/simulate), `useMediarcApi.ts` | MilestoneSlot 새 파일 — 충돌 없음 |
| 3-C | 마일스톤 시간축 (현재/6m/1y/5y) | dev-coder B (3-B 후) | 2 d | `engine.py`, `BeforeAfterBlock.tsx`, 새 컴포넌트 `TimeDimToggle.tsx` | BeforeAfterBlock (3-A 와 겹침) |
| 3-D | 데이터 매핑 매트릭스 + 회귀 검증 | dev-reviewer | 0.5 d | 문서 + Playwright 테스트 케이스 | 없음 (검증 전용) |

### 3.2 충돌 회피 전략

- **BeforeAfterRow** 는 3-A (Disclosure 추가) 와 3-C (시간축 ratio 소비) 둘 다 수정한다.
  - 해결: 3-A 먼저 merge → 3-C 는 3-A merge 후 브랜치 pull rebase.
- **BeforeAfterBlock** 은 3-A (하단 공식 disclosure 추가) 와 3-C (상단 TimeDimToggle 추가) 둘 다 수정한다.
  - 해결: 영역 분리 — 3-A 는 block 하단(`.report-view__before-after-block .report-view__formula`), 3-C 는 block 상단(`.report-view__before-after-block__header`). 서로 다른 JSX 서브트리 수정.
- **engine.py** 는 3-B/3-C 가 둘 다 `compute_milestone_scenario()` 추가. 단일 함수이므로 3-B 개발자가 한 번에 구현하고, 3-C 는 이미 구현된 시그니처를 FE 에서 호출만 한다.

### 3.3 병합 순서

```
Day 1 : 3-A (작은 변경, 빠른 merge)
Day 2 : 3-B 엔진 + API 동시 시작, 3-A merge 완료
Day 3 : 3-B FE 완료, 3-C 엔진 sig 확정 (3-B 와 공유)
Day 4 : 3-C FE 완료
Day 5 : 3-D 매트릭스 검증, 회귀 테스트 전체 통과
Day 6 : 배포 + 모니터
```

---

## 4. 용어 정리와 라벨 정정표 (3-A 본체)

### 4.1 배경 — 엔진 정의에 따른 정확한 용어

`p9_mediArc_engine/demo/engine.py` 의 실제 정의를 검토해서 용어를 재정렬한다. 엔진은 다음 3개 종류의 "나이" 개념을 구분한다.

| 엔진 개념 | 함수 | 반환 구조 | 정답 용어 (수검자용) |
|---|---|---|---|
| 전체 신체 나이 | `run_for_patient` 의 `bodyage` + GB 모델 결과 `bioage_gb` | `{bodyage, delta, bioage_gb}` | **신체 나이** (또는 생체 나이) |
| 질환별 나이 (Δ 포함) | `compute_disease_ages(age, disease_ratios, patient)` at engine.py:638 | `{알츠: {age, delta}, 뇌혈관: {…}, 심혈관: {…}, 고혈압: {…}, 당뇨: {…}, 대사: {…}, CKD: {…}}` | **질환별 건강나이** (Disease-specific Health Age) |
| 5년 후 예상 | `predict_5y(ratio, disease)` at engine.py | 질환별 5 개 연도 배열 | **5년 추적 예측** |

**중요**: `disease_ages` 는 "부위" (장기) 가 아니라 "질환" 기준이다. 알츠하이머, 뇌혈관 등 장기 단위처럼 들리지만 엔진의 분류는 질환 카테고리이다. 따라서 FE 에서 "부위별 건강나이" 라고 지칭하는 것은 잘못이며, "질환별 건강나이" 로 통일한다.

### 4.2 정정 대상 전수 표

다음 grep 결과를 기준으로 수정한다. 모든 수정은 i18n 키가 없으므로 문자열 리터럴 직접 교체다.

#### 4.2.1 BodyAgeChart.tsx 정정

파일: `backoffice/src/pages/HealthReportPage/components/BodyAgeChart.tsx`

| 라인 | 현재 | 정정 |
|---|---|---|
| L63 | `[`${value}세`, '추정 건강나이']` | `[`${value}세`, '질환별 건강나이']` |

또한 컴포넌트 자체의 JSX 외부에서 참조되는 헤딩 (ReportView 또는 Understand 섹션 내부) 에 "부위별 건강나이" 표기가 있을 경우 동일 기준으로 "질환별 건강나이" 로 수정한다.

- grep 실행: `grep -rn "부위별 건강나이\|body ?age" backoffice/src/pages/HealthReportPage/` → 결과 목록을 3-A 작업 시작 시점에 재확인

#### 4.2.2 WillRogersCaption.tsx 재작성

파일: `backoffice/src/pages/HealthReportPage/components/WillRogersCaption.tsx`

**현재 (12 lines)**:
```tsx
export default function WillRogersCaption() {
  return (
    <p className="report-view__cohort-caption">
      같은 코호트 기준 등수 — 윌로저스 방지 (Feinstein 1985)
    </p>
  );
}
```

**개선안**:
```tsx
import { useState } from 'react';

export default function WillRogersCaption() {
  const [open, setOpen] = useState(false);
  return (
    <div className="report-view__cohort-caption">
      <button
        type="button"
        className="report-view__cohort-caption-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        기준 집단을 고정해 계산했습니다 {open ? '(접기)' : '(자세히)'}
      </button>
      {open && (
        <div className="report-view__cohort-caption-body">
          <p>
            생활습관을 바꿔도 비교 대상 집단(코호트)이 바뀌지 않도록 기준을 고정해서 등수를 계산했습니다.
            그렇지 않으면 "금연했더니 비흡연자 그룹으로 이동해 등수가 변하지 않는" 착시가 생깁니다.
          </p>
          <p className="report-view__cohort-caption-ref">
            방법론 근거: Feinstein 1985, Will Rogers phenomenon (PMID 4000199)
          </p>
        </div>
      )}
    </div>
  );
}
```

- 접근성: `<button>` + `aria-expanded` 사용
- 스타일: 기존 `.report-view__cohort-caption` 클래스 유지 + 하위 요소 BEM 네이밍
- 문구 검수: 수검자 친화 (용어 설명 → 이유 → 근거 순서)

#### 4.2.3 BeforeAfterRow Disclosure 추가

파일: `backoffice/src/pages/HealthReportPage/components/BeforeAfterRow.tsx`

**현재 구조**: `<tr>` 하나로 7개 `<td>` (질환명 / 현재ratio / 현재rank / 개선ratio / 개선rank / rank변화 / ARR).

**개선안**: "근거" 컬럼 추가 혹은 드로어 버튼. 테이블 레이아웃 유지를 위해 8번째 `<td>` 에 작은 토글 아이콘 배치, 열릴 때는 아래 `<tr>` 로 상세 공식을 풀어놓는다.

```tsx
import { useState } from 'react';
import type { DiseaseDetail, WillRogersEntry } from '../hooks/useMediarcApi';

interface BeforeAfterRowProps {
  diseaseName: string;
  current: DiseaseDetail;
  willRogers?: WillRogersEntry;
}

export default function BeforeAfterRow({ diseaseName, current, willRogers }: BeforeAfterRowProps) {
  const [open, setOpen] = useState(false);
  // ... 기존 값 계산 로직 그대로 ...

  return (
    <>
      <tr className="report-view__before-after-row">
        <td className="report-view__disease-name">{diseaseName}</td>
        <td>{currentRatio}%</td>
        <td>{currentRank}</td>
        <td>{improvedRatio}%</td>
        <td>{improvedRank}</td>
        <td><span className={rankChangeCls}>{rankChangeLabel}</span></td>
        <td>{arrPct != null ? `${arrPct.toFixed(1)}%` : '-'}</td>
        <td>
          <button
            type="button"
            className="report-view__before-after-row__formula-toggle"
            aria-expanded={open}
            aria-label={open ? '근거 닫기' : '근거 보기'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '−' : '근거'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="report-view__before-after-row__formula">
          <td colSpan={8}>
            <dl>
              <dt>현재 상대위험도 (ratio)</dt>
              <dd>
                (개인 RR) ÷ (같은 연령·성별 코호트 평균 RR) = {currentRatio}%
                <br />
                코호트 평균 = exp(Σ p<sub>i</sub> × ln(RR<sub>i</sub>)) (Holford 1983 + Clayton &amp; Schifflers 1987; Rothman et al. 2008 책 인용, ISBN 978-0-7817-5564-1)
              </dd>
              <dt>등수 (rank)</dt>
              <dd>
                ratio 를 분포에 매핑하여 하위 %. 낮을수록 위험 (하위 1% = 가장 위험).
              </dd>
              <dt>개선 후 상대위험도</dt>
              <dd>
                BMI &lt; 23, 금연, 금주 reset 후 동일 코호트 평균(코호트 고정)으로 나눈 ratio.
              </dd>
              <dt>ARR (절대위험도 감소율)</dt>
              <dd>
                (원래 ratio − 개선 ratio) ÷ 원래 ratio × 100 = {arrPct?.toFixed(1) ?? '-'}%
              </dd>
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}
```

**주의**:
- `<tr>` 형제 2개를 반환하기 위해 `<>` Fragment 사용
- `colSpan={8}` 은 7 → 8 로 늘어난 헤더에 맞춤 (BeforeAfterBlock 헤더 `<th>` 8개로 맞춤)
- Disclosure 펼침 시 테이블 reflow 만 발생 — iframe embedMode 에서도 안전

### 4.3 BeforeAfterBlock 공식 블록 (3-A 일부)

파일: `backoffice/src/pages/HealthReportPage/components/BeforeAfterBlock.tsx`

블록 하단에 `<Disclosure>` (기존 공유 컴포넌트) 로 "계산 방법" 섹션 추가. 각 행별 세부 공식은 Row 의 Disclosure 가 담당하고, 블록 하단은 **공통 방법론 레퍼런스** 를 담는다.

```tsx
<Disclosure title="이 표의 계산 방법 요약">
  <ul>
    <li>개인 RR: 문진·수치로 판정한 위험인자 각각의 RR 를 곱한 값 (Hippisley-Cox 2024 QRISK4)</li>
    <li>코호트 평균 RR: 해당 연령·성별 집단의 기댓값 — piecewise log 정규화 (Holford 1983 PMID 6626659; Clayton &amp; Schifflers 1987 PMID 3629047/3629048; Rothman et al. 2008 책 인용)</li>
    <li>질환별 건강나이 Δ: 10·ln(개인 RR / 코호트 평균) (Pang &amp; Hanley 2021 AJE, PMID 34151374 — Gompertz 사망법칙 + 비례위험 가정, γ=0.10 대입)</li>
    <li>윌 로저스 방지: 개선 후에도 코호트 평균 고정 (Feinstein 1985, PMID 4000199)</li>
    <li>5년 예측: Gompertz 기반 누적 발생률 (국립암센터 α fitting, 코호트 내부 검증)</li>
  </ul>
</Disclosure>
```

---

## 5. 엔진 계약 변경 — `compute_milestone_scenario()`

### 5.1 목적

`compute_improved_scenario()` 는 "고정된 한 시나리오" (BMI<23 + 금연 + 금주) 를 반환한다. Phase 3 는 **매개변수화된 시나리오 계산** 함수를 요구한다 — (1) BMI 축, (2) 시간 축 복구 감쇠 적용.

### 5.2 함수 시그니처

파일: `p9_mediArc_engine/demo/engine.py` (+ `planning-platform/backend/app/services/report_engine/engine.py` 동기)

```python
def compute_milestone_scenario(
    patient: dict,
    disease_results: dict,
    milestone: dict,
) -> dict:
    """
    매개변수화된 마일스톤 시나리오 계산.

    Args:
        patient: 원본 patient dict (run_for_patient 입력과 동일)
        disease_results: 원본 compute_per_disease_risk 결과 (cohort_mean 포함)
        milestone: {
            "bmi_target": float | None,   # 목표 BMI (None = 현재 유지)
            "smoking_target": str | None, # 'current' | 'quit' | None
            "drinking_target": str | None,# 'none' | None
            "time_horizon_months": int,   # 0 | 6 | 12 | 60
        }

    Returns:
        {
            "input": milestone,                   # echo back
            "labels": {bmi, smoking, drinking, time},
            "improved_sbp": float,
            "improved_dbp": float,
            "improved_fbg": float,
            "ratios": {disease: float},          # 개선 후 ratio (시간 감쇠 적용 후)
            "five_year_improved": {disease: [float, ...]},
            "will_rogers": {
                disease: {
                    orig_ratio, improved_ratio,
                    orig_rank, improved_rank,
                    rank_change, arr_pct, cohort_fixed
                }
            },
            "applied_attenuation": {disease: float},  # 시간축 감쇠계수 α
            "has_improvement": bool,
        }
    """
```

### 5.3 핵심 로직 (의사 코드)

```python
def compute_milestone_scenario(patient, disease_results, milestone):
    # 1. patient copy
    p = dict(patient)
    bmi_target = milestone.get("bmi_target")
    smoking_target = milestone.get("smoking_target")
    drinking_target = milestone.get("drinking_target")
    t_months = milestone.get("time_horizon_months", 0) or 0

    # 2. 라벨 구성
    labels = {}
    if bmi_target is not None:
        labels["bmi"] = f"BMI {bmi_target:.1f}"
        p["bmi"] = float(bmi_target)
    if smoking_target == "quit" and patient.get("smoking") == "current":
        labels["smoking"] = "금연"
        p["smoking"] = "former" if t_months < 60 else "never"
    if drinking_target == "none":
        labels["drinking"] = "금주"
        p["drinking"] = "none"
    labels["time"] = _time_label(t_months)

    # 3. 혈압·혈당 보정 (BMI 변화량 기반)
    orig_bmi = patient.get("bmi", 22.0) or 22.0
    bmi_delta = max(orig_bmi - (bmi_target or orig_bmi), 0)
    sbp = patient.get("sbp", 120) or 120
    dbp = patient.get("dbp", 80) or 80
    fbg = patient.get("fbg", 90) or 90

    # 선행 근거:
    # - BMI -1 kg/m² 당 SBP -1.5, DBP -0.8 (보수적, 보편 추정)
    # - 금주 -> SBP -4, DBP -3 (Roerecke 2017 meta, 출처 미확인 — PubMed 재검증 필요)
    alcohol_sbp = 4 if drinking_target == "none" else 0
    alcohol_dbp = 3 if drinking_target == "none" else 0
    improved_sbp = max(sbp - bmi_delta * 1.5 - alcohol_sbp, 100)
    improved_dbp = max(dbp - bmi_delta * 0.8 - alcohol_dbp, 65)
    improved_fbg = max(fbg * (0.7 if bmi_delta >= 2 else 1.0), 70)

    p["sbp"] = improved_sbp
    p["dbp"] = improved_dbp
    p["fbg"] = improved_fbg

    # 4. 개선 후 위험인자 재판정 + N배 재계산
    improved_factors = classify_risk_factors(p)
    improved_ratios = {}
    five_year_improved = {}
    applied_atten = {}

    for disease, orig_data in disease_results.items():
        individual_rr, _ = calculate_individual_rr(disease, improved_factors, p)
        cohort_mean = orig_data["cohort_mean"]  # 코호트 고정 (윌 로저스 방지)
        base_ratio = (individual_rr / cohort_mean) if cohort_mean > 0 else 1.0

        # 5. 시간축 감쇠계수 α 적용
        alpha = _time_attenuation(disease, t_months, smoking_target, bmi_delta)
        # base_ratio == 1.0 (정상) 일 때는 더 내려가지 않음, α >= 1.0 가 의미 없음
        if base_ratio >= 1.0:
            final_ratio = 1.0 + (base_ratio - 1.0) * alpha  # α 0 -> 1.0, α 1 -> base
        else:
            final_ratio = base_ratio  # 보호적(<1.0) 은 감쇠 불필요

        improved_ratios[disease] = round(final_ratio, 2)
        applied_atten[disease] = alpha
        five_year_improved[disease] = predict_5y(final_ratio, disease)

    # 6. 윌 로저스 방지 출력
    will_rogers = _build_will_rogers(disease_results, improved_ratios)

    has_improvement = any(bmi_delta > 0, smoking_target == "quit", drinking_target == "none")

    return {
        "input": milestone,
        "labels": labels,
        "improved_sbp": round(improved_sbp, 1),
        "improved_dbp": round(improved_dbp, 1),
        "improved_fbg": round(improved_fbg, 1),
        "ratios": improved_ratios,
        "five_year_improved": five_year_improved,
        "will_rogers": will_rogers,
        "applied_attenuation": applied_atten,
        "has_improvement": bool(has_improvement),
    }
```

### 5.4 시간축 감쇠계수 α 정의

`_time_attenuation(disease, t_months, smoking_target, bmi_delta)` 는 "0 에서 1 사이 값" 이며, t_months=0 일 때 1 (원래 risk 그대로), t_months 가 길수록 0 에 가까워진다 (완전 회복).

**원칙**:
- α 는 감쇠 비율. `final_ratio = 1.0 + (base_ratio - 1.0) × α`
- 질환/행동 조합별로 독립 곡선 (아래 표)
- α 는 monotonic decreasing (시간이 길면 α 가 작거나 같다)

**α 테이블 (출처 검증 필요 — 부록 A 참조)**:

⚠️ **특수 주의 (논문 근거 기반 로직 조정)**

1. **당뇨-금연 α**: 0-7년 구간은 α = 0 (체중증가로 위험 오히려 상승, Yeh 2010 PMID 20048267 / Hu 2018 PMID 30110591). 7년+ 에서만 감쇠 적용. 엔진 `compute_milestone_scenario` 조건부 처리 필수.
2. **심혈관-BMI감량 α**: 10% 이상 감량만 유의(Look AHEAD 2016 PMID 27595918 HR 0.79). 5-10% 구간 비유의(HR 1.16) → α = 0 처리 권장.

| 질환 | 행동 | 0m | 6m | 12m | 60m | 근거 PMID | 비고 |
|---|---|---|---|---|---|---|---|
| 심혈관 | 금연 | 1.00 | 0.90 | 0.70 | 0.30 | 31429895 (Inoue-Choi 2019 JAMA) + 15914503 (Woodward 2005 보조) | HR 0.61 @<5년, 0.54 @10-15년 기반 |
| 심혈관 | BMI 감량 | 1.00 | 0.85 | 0.70 | 0.50 | 27595918 (Look AHEAD 2016 사후 분석) | ⚠️ 10% 이상 감량만 유의(HR 0.79); 5-10%는 α=0 권장 |
| 당뇨 | BMI 감량 | 1.00 | 0.80 | 0.60 | 0.35 | 11333990 (DPS 2001) + 23093136 (DPS 13년) + 19878986 (DPP 10년) | 58% 위험 감소; HR 0.614 @13년 |
| 당뇨 | 금연 | 1.00 | 1.00 | 1.00 | 0.80 | 20048267 (Yeh 2010 ARIC) + 30110591 (Hu 2018 NEJM) | ⚠️ U형 곡선: 0-7년 α=0 (위험 상승), 7년+ 감쇠 시작 |
| 고혈압 | BMI 감량 | 1.00 | 0.70 | 0.55 | 0.40 | — | 보수적 추정 (출처 미확인) |
| 뇌혈관 | 금연 | 1.00 | 0.87 | 0.75 | 0.49 | 24291341 (Lee/Fry/Thornton 2014 RTP, H=4.78년 지수감쇠 λ=0.145/년) + 3339799 (Wolf 1988 보조) + 8417241 (Kawachi 1993 보조) | 음의 지수 모델 R(t)=exp(-0.145t) 기반 |
| 알츠 | BMI 감량 | 1.00 | 0.98 | 0.95 | 0.85 | — | 인지 회복 느림 — 보수적 추정 (출처 미확인) |
| 대사 | BMI 감량 | 1.00 | 0.70 | 0.50 | 0.30 | — | 직접 대사 기전 (출처 미확인) |
| CKD | BMI 감량 | 1.00 | 0.85 | 0.75 | 0.65 | — | 보수적 추정 (출처 미확인) |
| 폐암 | 금연 | 1.00 | 0.97 | 0.93 | 0.57 | 32603182 (Stapleton 2020 Ann Am Thorac Soc 메타) + 10926586 (Peto 2000 BMJ 보조) | 잔존%: 1년 81.4%, 5년 57.2%, 10년 36.9%, 20년 19.7% |

**구현 가드레일**:
- 표에 없는 조합은 α = 1.0 (변화 없음) 로 폴백
- 테이블은 `reference_data.py` 에 `TIME_ATTENUATION_TABLE` 딕셔너리로 분리 (매직 넘버 아님)
- 엔진 배포 전 `data-verifier` 가 PMID 전수 검증 → 미검증은 **"출처 미확인"** 명기 + 보수적 (α 더 큰) 값으로 저장

### 5.5 `compute_improved_scenario` 대비 차이

| 항목 | `compute_improved_scenario` | `compute_milestone_scenario` |
|---|---|---|
| 시나리오 | 고정 (BMI 22.9 + never + none) | 파라미터로 지정 |
| 시간축 | 없음 (즉시 적용) | time_horizon_months 별 감쇠 α |
| 반환 `input` 필드 | 없음 | 있음 (echo) |
| 반환 `applied_attenuation` | 없음 | 있음 |
| 호출처 | `run_for_patient` 내부 (기본 1회) | `/simulate` 엔드포인트에서 여러 조합 호출 |
| 후행 호환 | 유지 | 신규 — 기존 소비자 영향 없음 |

### 5.6 기존 `run_for_patient` 흐름 수정 여부

**결정**: 수정하지 않는다.

- `run_for_patient` 는 `compute_improved_scenario()` 를 계속 호출해 `improved` 필드를 채운다. Phase 1 FE 는 이 필드에 의존하므로 건드리지 않는 것이 하위 호환에 유리.
- `/simulate` 는 별도 엔드포인트로 only 요청 시 `compute_milestone_scenario()` 만 호출한다.

### 5.7 공유 유틸 리팩토링 (옵션, 최소 범위)

두 함수가 공유하는 부분:
- 위험인자 재판정 (`classify_risk_factors`)
- 개인 RR 재계산 (`calculate_individual_rr`)
- 5년 예측 (`predict_5y`)
- 코호트 고정 유지 (원래 `disease_results[disease]["cohort_mean"]`)

신규 `_build_will_rogers(disease_results, improved_ratios)` 내부 헬퍼를 만들어 `compute_improved_scenario` 내 동일 블록을 재사용하도록 **선택적으로** 리팩토링. (리스크 최소화를 위해 필수는 아님 — Phase 3 기본은 "순수 추가" 전략).

---

## 6. BE API 계약 — `POST /partner-office/mediarc-report/{uuid}/simulate`

### 6.1 엔드포인트 개요

| 항목 | 값 |
|---|---|
| 경로 | `POST /partner-office/mediarc-report/{uuid}/simulate` |
| 인증 | 기존 partner_office 인증 미들웨어 (변경 없음) |
| 캐시 | `welno_mediarc_simulations` (hospital_id + patient_uuid + input_digest UNIQUE) |
| 호출자 | FE MilestoneSlot, TimeDimToggle (BeforeAfterBlock 상단) |
| 의존 | `EngineFacade.run(...)` + `compute_milestone_scenario(...)` |

### 6.2 Request Schema (Pydantic)

```python
class SimulateRequest(BaseModel):
    bmi_target: Optional[float] = Field(None, ge=15.0, le=45.0)
    smoking_target: Optional[Literal["current", "quit"]] = None
    drinking_target: Optional[Literal["none"]] = None
    time_horizon_months: Literal[0, 6, 12, 60] = 0
    force: bool = False

    class Config:
        extra = "forbid"  # 알 수 없는 필드 차단
```

**쿼리 파라미터**: `hospital_id: str = Query(default="")` — partner_office 표준 패턴.

### 6.3 Response Schema

```python
class SimulateResponse(BaseModel):
    uuid: str
    hospital_id: str
    input: dict                          # request echo
    input_digest: str                    # sha256 prefix 16
    labels: dict                         # {bmi, smoking, drinking, time}
    improved_sbp: float
    improved_dbp: float
    improved_fbg: float
    ratios: Dict[str, float]
    five_year_improved: Dict[str, List[float]]
    will_rogers: Dict[str, dict]
    applied_attenuation: Dict[str, float]
    has_improvement: bool
    cached: bool                         # DB hit 여부
    generated_at: str                    # ISO 8601
    engine_version: str                  # 고정값 "v1"
```

### 6.4 엔드포인트 구현 (개략)

```python
@router.post("/mediarc-report/{uuid}/simulate", response_model=SimulateResponse)
async def post_simulate(
    uuid: str,
    body: SimulateRequest,
    hospital_id: str = Query(default=""),
):
    _engine_guard()

    # 1. 현재 리포트 조회 (ai-summary 와 동일 패턴)
    report = await _fetch_report_for_ai(uuid, hospital_id)
    # _fetch_report_for_ai 는 engine.run() 결과 소형화 버전 — 원본 patient 필요하므로
    # _fetch_engine_patient_for_simulate() 별도 헬퍼를 신규 작성

    patient, disease_results = await _fetch_engine_patient_and_disease_results(uuid, hospital_id)

    # 2. digest 계산 (body + patient 지문)
    digest_payload = {
        "body": body.dict(exclude_none=True),
        "patient_sig": _patient_signature(patient),  # age/sex/bmi/sbp/... 해시
    }
    digest = _compute_input_digest(digest_payload)

    # 3. 캐시 조회
    if not body.force:
        cached = await _sim_get_cached(db_manager, uuid, hospital_id, digest)
        if cached:
            return SimulateResponse(**cached, cached=True)

    # 4. 엔진 실행
    try:
        milestone = body.dict(exclude_none=True)
        result = compute_milestone_scenario(patient, disease_results, milestone)
    except Exception as exc:
        logger.exception("simulate 실패 uuid=%s milestone=%s", uuid, body.dict())
        raise HTTPException(status_code=500, detail=f"시뮬레이션 실패: {exc}")

    payload = {
        "uuid": uuid,
        "hospital_id": hospital_id,
        "input": body.dict(),
        "input_digest": digest,
        "labels": result["labels"],
        "improved_sbp": result["improved_sbp"],
        "improved_dbp": result["improved_dbp"],
        "improved_fbg": result["improved_fbg"],
        "ratios": result["ratios"],
        "five_year_improved": result["five_year_improved"],
        "will_rogers": result["will_rogers"],
        "applied_attenuation": result["applied_attenuation"],
        "has_improvement": result["has_improvement"],
        "engine_version": "v1",
    }

    # 5. DB UPSERT (실패해도 응답은 반환 — fail-open)
    try:
        await _sim_upsert(db_manager, **payload)
    except Exception as exc:
        logger.warning("simulate DB UPSERT 실패 uuid=%s: %s", uuid, exc)

    return SimulateResponse(**payload, cached=False, generated_at=datetime.utcnow().isoformat())
```

### 6.5 헬퍼 함수 신규

- `_fetch_engine_patient_and_disease_results(uuid, hospital_id)` — `mediarc_patient_detail` 재사용 + `to_engine_patient` 변환 + 엔진 full run → patient + disease_results 획득. 별칭 엔드포인트 `GET /mediarc-report/{uuid}` 의 내부 흐름과 공유.
- `_patient_signature(patient: dict) -> str` — 시뮬레이션에 영향을 주는 patient 필드만 추출해 sha256. `{age, sex, bmi, sbp, dbp, fbg, smoking, drinking, hx_* , ... }`
- `_compute_input_digest(payload: dict) -> str` — `ai_summary.compute_input_digest` 동일 방식 (sha256 json sort_keys, prefix 16)
- `_sim_get_cached(db_manager, uuid, hospital_id, digest)` / `_sim_upsert(db_manager, **payload)` — 새 테이블 전용

### 6.6 에러 매트릭스

| 상황 | HTTP | detail |
|---|---|---|
| uuid 미존재 | 404 | "환자 없음" |
| body validation fail | 422 | Pydantic 기본 에러 |
| 엔진 예외 | 500 | "시뮬레이션 실패: {exc}" |
| DB 조회 실패 | 502 | "DB 조회 실패" |
| engine_guard unavailable | 503 | "엔진 미로드" |
| 타임아웃 (LLM 없음이므로 거의 없음) | 504 | "시간 초과" |

### 6.7 Rate Limiting

- LLM 호출이 없으므로 계산 비용만 있다. 평균 50-200 ms 예상. 별도 rate limit 도입 불필요.
- 그러나 FE 슬라이더에서 drag 시 과도한 연속 호출을 막기 위해 FE 측 debounce (300ms) 적용.

### 6.8 Observability

- 로그 필드: `uuid`, `hospital_id`, `input_digest`, `cached`, `duration_ms`, `engine_version`
- Slack 알림: `/simulate` 500 응답 5분 내 5건 이상 → mediArc Slack Rules 에 추가 (mediarc-slack 스킬 사용)

---

## 7. DB 스키마 — 캐시 테이블 `welno_mediarc_simulations`

### 7.1 테이블 DDL

```sql
CREATE TABLE IF NOT EXISTS welno.welno_mediarc_simulations (
    id              BIGSERIAL PRIMARY KEY,
    patient_uuid    VARCHAR(64) NOT NULL,
    hospital_id     VARCHAR(32) NOT NULL DEFAULT '',
    input_digest    VARCHAR(64) NOT NULL,
    input_json      JSONB        NOT NULL,
    result_json     JSONB        NOT NULL,
    engine_version  VARCHAR(16)  NOT NULL DEFAULT 'v1',
    generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_welno_mediarc_simulations UNIQUE (patient_uuid, hospital_id, input_digest)
);

CREATE INDEX IF NOT EXISTS ix_welno_mediarc_sim_updated
    ON welno.welno_mediarc_simulations (updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_welno_mediarc_sim_patient
    ON welno.welno_mediarc_simulations (patient_uuid, hospital_id);
```

### 7.2 마이그레이션 파일

- 경로: `planning-platform/backend/migrations/` 아래 기존 컨벤션(날짜 prefix + 설명)
- 파일명: `20260415_add_welno_mediarc_simulations.sql`
- 적용: 기존 DB 스키마 변경 절차 준수 (team-governance Level 3 승인 + ops-verifier 확인).

### 7.3 주의

- 캐시 invalidation: `patient_signature` 변경 시 (수치 재입력 등) 새 digest 로 자동 신규 row 생성. 기존 row 는 TTL 없이 보관 (분석 용도).
- 장기 보관 주의: JSONB 용량 증가 시 월 1회 `VACUUM (ANALYZE)` 필요. ops-monitor 가 PostgreSQL 디스크 사용량 알림.
- PII 주의: `input_json` 에 민감 수치는 들어가지 않지만(`bmi_target` 등 시나리오 파라미터만), `result_json` 에는 revision 기록용 `input` echo 가 들어간다. hospital_id + patient_uuid 는 기존 테이블과 동일 수준의 보안 적용.

### 7.4 기존 테이블과의 관계

| 테이블 | 역할 | 관계 |
|---|---|---|
| `welno.welno_mediarc_reports` | 골든 리포트 (Twobecon 역공학) | 독립 |
| `welno.welno_mediarc_ai_summaries` | AI 한 줄 요약 캐시 | 독립 |
| `welno.welno_mediarc_simulations` (신규) | 시나리오 계산 결과 캐시 | (patient_uuid, hospital_id) 조합으로 report 와 logical 연결 |

---

## 8. FE 아키텍처 재설계 — MilestoneSlot + TimeDim

### 8.1 전체 변화 개요

```
ReportView
├── HeroBlock (변경 없음)
├── Understand 섹션
│   ├── RiskFactorsBlock (변경 없음)
│   └── DiseaseGrid (변경 없음)
├── Motivate 섹션 (BeforeAfterBlock 재구성)
│   ├── [NEW] TimeDimToggle (3-C) — 현재/6m/1y/5y 탭
│   ├── BeforeAfterTable (기존)
│   │   └── BeforeAfterRow * N
│   │       └── [NEW] Row Disclosure (3-A)
│   ├── [NEW] BlockFormulaDisclosure (3-A)
│   └── WillRogersCaption (3-A 확장)
├── Action 섹션 (MilestoneSlot 재작성)
│   └── [NEW] MilestoneSlot
│       ├── MilestoneHeader (타이틀 + 안내 문구)
│       ├── BmiSlider (슬라이더 + 현재/-2/-5/-10/정상 앵커 5개)
│       ├── MilestoneCardGrid (카드 5장)
│       │   └── MilestoneCard * 5
│       └── ComparisonSummary (선택된 카드 vs 현재 ARR)
├── Celebrate 섹션 (TrendSlot — 변경 없음 또는 최소 연계)
└── AppendixBlock (필드 공개 매트릭스 — 3-D 반영)
```

### 8.2 데이터 흐름

```
ReportView
  ├─ data: ReportData (기존)
  ├─ state: milestones (Action) / timeDim (Motivate) — 두 섹션이 독립적으로 관리
  ├─ useSimulation() hook (신규) — 
  │    { call(bmi_target, smoking_target, drinking_target, time_horizon_months)
  │      result, loading, error, reset() }
  └─ BeforeAfterBlock
       ├─ timeDim state (자체 관리)
       ├─ timeDim 값에 따라 useSimulation().call({time_horizon_months})
       └─ 결과 ratios → BeforeAfterRow props 주입
```

### 8.3 `useSimulation()` hook 사양

파일: `backoffice/src/pages/HealthReportPage/hooks/useSimulation.ts` (신규)

```ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { getApiBase, fetchWithAuth } from '../../../utils/api';

export interface SimulationInput {
  bmi_target?: number;
  smoking_target?: 'quit';
  drinking_target?: 'none';
  time_horizon_months?: 0 | 6 | 12 | 60;
}

export interface SimulationResult {
  input: SimulationInput;
  input_digest: string;
  labels: { bmi?: string; smoking?: string; drinking?: string; time?: string };
  improved_sbp: number;
  improved_dbp: number;
  improved_fbg: number;
  ratios: Record<string, number>;
  five_year_improved: Record<string, number[]>;
  will_rogers: Record<string, {
    orig_ratio: number;
    improved_ratio: number;
    orig_rank: number;
    improved_rank: number;
    rank_change: number;
    arr_pct: number;
    cohort_fixed: boolean;
  }>;
  applied_attenuation: Record<string, number>;
  has_improvement: boolean;
  cached: boolean;
  generated_at: string;
  engine_version: string;
}

export function useSimulation(uuid: string, hospitalId?: string) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const call = useCallback(async (input: SimulationInput) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const qs = hospitalId ? `?hospital_id=${encodeURIComponent(hospitalId)}` : '';
      const r = await fetchWithAuth(
        `${getApiBase()}/partner-office/mediarc-report/${uuid}/simulate${qs}`,
        {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
        },
      );
      if (!r.ok) throw new Error(`simulate 실패 (HTTP ${r.status})`);
      const data = (await r.json()) as SimulationResult;
      if (!ctrl.signal.aborted) setResult(data);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e as Error);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [uuid, hospitalId]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { call, result, loading, error, reset };
}
```

**AbortController 필수**: FE 슬라이더 drag 중 이전 요청 취소 — race condition 방지.

### 8.4 MilestoneSlot 상태 관리

```
MilestoneSlot
  ├── state: selectedBmi: number | null  (기본 = patient.bmi)
  ├── useSimulation hook 1 instance
  ├── debounce (300ms) onChange → call({bmi_target: selectedBmi})
  └── 카드 5장은 고정 계산 (슬라이더와 독립적 프리로드)
      - 병렬 5 회 simulate 호출 (useSimulation 5 instance? 또는 단일 hook 순차)
      - 권장: "현재 / -2 / -5 / -10 / 정상 BMI" 5개 카드는 mount 시 1회씩 호출 → 결과 캐시됨 (DB UNIQUE 로 같은 BMI 반복 시 즉시 반환)
```

**권장 구현**:
- MilestoneCardGrid 내부에서 `Promise.all([call1, call2, call3, call4, call5])` 초기 로드
- BmiSlider 는 하단 "상세 미리보기" 전용으로, 슬라이더 움직임 → 즉시 simulate → 카드와 별도로 표시

### 8.5 BMI 목표 앵커 계산

| 카드 라벨 | 목표 BMI 계산 |
|---|---|
| "현재" | `patient.bmi` (변화 없음) |
| "-2 kg" | 현재 체중에서 2 kg 감량 시 BMI — FE 에서 `(weight - 2) / (height/100)^2` 계산, 없으면 서버가 제공 |
| "-5 kg" | 동일 방식 5 kg 감량 |
| "-10 kg" | 동일 방식 10 kg 감량 |
| "정상 BMI" | 22.9 (Asian BMI <23 기준, Choo 2002 등 — 기존 엔진에서 사용 중인 값과 동일) |

**patient.height / weight 가용 여부**: 기존 `ReportData` 에는 `height` / `weight` 가 없다. 따라서 `/simulate` body 는 BMI 만 받고, FE 는 height/weight 를 얻지 못해 "-2kg"/"-5kg"/"-10kg" 을 BMI 변환하지 못한다.

**해결안** (A 또는 B 중 선택):
- **안 A (권장)**: `/simulate` 는 `bmi_target` 대신 `weight_delta_kg` 도 받도록 확장. BE 가 patient.height (엔진 원본 입력) 로 변환.
- **안 B**: `ReportData` 에 `patient_info.height` / `patient_info.weight` 를 추가하여 FE 에서 계산. 그러나 schema 확장 필요.

Phase 3 에서는 **안 A 를 채택**. SimulateRequest 에 `weight_delta_kg: Optional[float]` 추가. 내부에서 `bmi_target = (weight - weight_delta_kg) / (height/100)**2` 로 계산 후 `compute_milestone_scenario` 에 전달.

### 8.6 TimeDim Toggle 상태 관리

```
BeforeAfterBlock
  ├── state: timeDim: 0 | 6 | 12 | 60 (기본 0 = 현재)
  ├── useSimulation hook 1 instance
  ├── timeDim 변경 시 call({time_horizon_months: timeDim})
  └── 결과가 있으면 ratios/will_rogers 를 BeforeAfterRow 에 주입
      (timeDim=0 일 때는 data.improved 의 기존 will_rogers 사용)
```

**주의**: timeDim=0 일 때는 엔진 기본 개선 시나리오와 동일해야 한다. `/simulate` 에서 `{time_horizon_months: 0}` 를 보내면 `_time_attenuation` 에서 α=1.0 이 되어 결과가 기본 `compute_improved_scenario` 와 일치하는지 회귀 테스트 필수.

### 8.7 iframe embedMode 고려

- 슬라이더 `<input type="range">` 는 iframe 내부에서 정상 작동
- MilestoneCardGrid 는 가로 스크롤 대신 grid wrap 사용 (`display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));`)
- TimeDimToggle 은 탭 UI (TabBar 공유 컴포넌트 재사용 검토, 없으면 `<div role="tablist">`)
- `containment="container"` 시 width 400px 이하에서도 카드 2열, 슬라이더 full width

---

## 9. 컴포넌트 명세 (Props, State, Events, BEM, iframe)

### 9.1 MilestoneSlot (신규 전면 재작성)

**파일**: `backoffice/src/pages/HealthReportPage/components/MilestoneSlot.tsx`

**Props**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `patientUuid` | `string` | ✅ | `/simulate` 호출 시 경로 파라미터 |
| `hospitalId` | `number \| null` | ✅ | 파트너오피스 컨텍스트 병원 id |
| `baseBmi` | `number` | ✅ | `data.patient_info.bmi` 또는 엔진 입력 BMI |
| `baseWeight` | `number \| null` | ❌ | 있으면 `-N kg` 카드 계산에 사용 (없으면 BE 가 patient.height 로 역산) |
| `baseHeight` | `number \| null` | ❌ | 상동 |
| `timeHorizonMonths` | `0 \| 6 \| 12 \| 60` | ✅ | 3-C TimeDim 에서 하향 전달 |
| `embedMode` | `boolean` | ❌ | iframe 내부 여부. true 시 카드 간격 축소 |

**State**:
- `cardsState`: `Record<MilestoneKey, 'idle' | 'loading' | 'ok' | 'error'>`
- `cardsResult`: `Record<MilestoneKey, SimulateResponse>`
- `sliderBmi`: `number` (기본값 = baseBmi)
- `sliderResult`: `SimulateResponse | null`
- `sliderState`: `'idle' | 'loading' | 'ok' | 'error'`

**Events**:
- `onCardClick(key: MilestoneKey)` — 상위에 선택 이벤트 브로드캐스트 (상위는 해당 카드 ratios 를 BeforeAfterBlock 에 반영하기 위해 수신)
- `onSliderChange(bmi: number)` — 사용자 상호작용 로깅용

**BEM 클래스**:
- `.report-view__milestone-slot`
- `.report-view__milestone-grid`
- `.report-view__milestone-card`
- `.report-view__milestone-card--selected`
- `.report-view__milestone-card-label`
- `.report-view__milestone-card-bodyage`
- `.report-view__milestone-card-arr`
- `.report-view__milestone-slider`
- `.report-view__milestone-slider-track`
- `.report-view__milestone-slider-value`

**iframe 동작**:
- `embedMode=true` 시 `.report-view__milestone-grid` `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`
- 슬라이더는 `width: 100%` 고정, label/value 는 상단 inline 배치

### 9.2 MilestoneCard (신규)

**파일**: `backoffice/src/pages/HealthReportPage/components/MilestoneCard.tsx`

**Props**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `label` | `string` | ✅ | "현재" / "-2 kg" / "-5 kg" / "-10 kg" / "정상 BMI" |
| `bmi` | `number` | ✅ | 이 카드가 대표하는 BMI |
| `bodyage` | `number \| null` | ✅ | 시뮬 결과 신체나이 (null = 미로딩) |
| `arrPct` | `number \| null` | ✅ | 평균 ARR(%) (계산은 상위에서 disease_results 평균) |
| `selected` | `boolean` | ✅ | 선택 상태 |
| `state` | `'idle' \| 'loading' \| 'ok' \| 'error'` | ✅ | 표시 상태 |
| `onClick` | `() => void` | ✅ | 카드 클릭 핸들러 |

**State**: 없음 (순수 표시 컴포넌트)

**Events**: onClick 만 위임

**BEM 클래스**:
- `.report-view__milestone-card`
- `.report-view__milestone-card--selected`
- `.report-view__milestone-card--loading`
- `.report-view__milestone-card--error`
- `.report-view__milestone-card-label`
- `.report-view__milestone-card-bodyage`
- `.report-view__milestone-card-arr`

**iframe 동작**:
- 최소 너비 140px (embedMode) / 160px (desktop)
- 세로 레이아웃: 라벨(상) → 신체나이(중, 굵게) → ARR 하단 보조

### 9.3 BmiSlider (신규)

**파일**: `backoffice/src/pages/HealthReportPage/components/BmiSlider.tsx`

**Props**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `min` | `number` | ✅ | BMI 최솟값 (권장 17.0) |
| `max` | `number` | ✅ | BMI 최댓값 (권장 40.0) |
| `step` | `number` | ✅ | 0.1 |
| `value` | `number` | ✅ | 현재 선택 BMI |
| `onChange` | `(bmi: number) => void` | ✅ | 값 변경 (debounce 는 상위에서 처리) |
| `disabled` | `boolean` | ❌ | 로딩 중 비활성화 |

**State**: 없음 (controlled)

**Events**: onChange 만

**BEM 클래스**:
- `.report-view__milestone-slider`
- `.report-view__milestone-slider-track`
- `.report-view__milestone-slider-value`
- `.report-view__milestone-slider--disabled`

**iframe 동작**:
- `<input type="range">` 네이티브 사용 (iframe 터치 이벤트 호환성 최상)
- 현재값 텍스트는 슬라이더 오른쪽에 `aria-live="polite"` 로 표시
- 300ms debounce 는 상위 hook 에서 처리 (컴포넌트는 raw onChange 만)

### 9.4 TimeDimToggle (신규)

**파일**: `backoffice/src/pages/HealthReportPage/components/TimeDimToggle.tsx`

**Props**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `value` | `0 \| 6 \| 12 \| 60` | ✅ | 현재 선택 개월 수 |
| `onChange` | `(months: 0\|6\|12\|60) => void` | ✅ | 변경 핸들러 |
| `disabled` | `boolean` | ❌ | 로딩 중 비활성화 |

**State**: 없음

**Events**: onChange

**BEM 클래스**:
- `.report-view__timedim-toggle`
- `.report-view__timedim-toggle-option`
- `.report-view__timedim-toggle-option--selected`
- `.report-view__timedim-toggle-option--disabled`

**라벨 매핑**:
- 0 → "현재"
- 6 → "6개월 후"
- 12 → "1년 후"
- 60 → "5년 후"

**iframe 동작**: 4 옵션 가로 tab 배열, 너비 400px 이하 시 2×2 wrap

### 9.5 BeforeAfterBlock (리팩토링)

**파일**: `backoffice/src/pages/HealthReportPage/components/BeforeAfterBlock.tsx`

**추가 Props** (기존 유지 + 확장):
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `timeHorizonMonths` | `0\|6\|12\|60` | ❌ | 3-C 추가 (기본 0) |
| `onTimeDimChange` | `(m) => void` | ❌ | 3-C 추가 |
| `overrideRatios` | `SimulateResponse \| null` | ❌ | 3-C 시뮬 결과 주입 (null 시 기존 data.improved 사용) |

**State**: 없음 (상위 ReportView 가 timeDim 관리)

**구조 변경**:
- 블록 상단 헤더에 `<TimeDimToggle>` 추가 (3-C)
- 블록 하단 `.report-view__formula` 영역 유지 (3-A 수식 설명)
- `BeforeAfterRow` 로 전달되는 ratios 는 `overrideRatios || data.improved` 로 분기

**BEM 추가**:
- `.report-view__before-after-block__header`
- `.report-view__before-after-block__timedim`
- `.report-view__before-after-block__formula` (3-A)

### 9.6 BeforeAfterRow (리팩토링, 3-A)

**파일**: `backoffice/src/pages/HealthReportPage/components/BeforeAfterRow.tsx`

**추가 Props**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `formulaDetail` | `FormulaDetail` | ❌ | 근거 Disclosure 내용 (3-A) |

`FormulaDetail` 타입:
```typescript
interface FormulaDetail {
  disease_key: string;
  orig_ratio: number;
  improved_ratio: number;
  formula: string;       // e.g., "RR(금연) × RR(BMI 22.9) × RR(혈압 정상)"
  components: Array<{ label: string; rr: number; source_pmid?: string }>;
  arr_formula: string;   // "(현재 ratio - 개선 ratio) / 현재 ratio × 100"
}
```

**State**:
- `disclosureOpen`: `boolean` (기본 false)

**구조 변경**:
- 기존 7 `<td>` → 8번째 `<td>` 추가: `<button aria-expanded>근거</button>`
- `disclosureOpen=true` 시 아래 `<tr>` 한 줄이 `colSpan=8` 로 추가 렌더
- 추가 `<tr>` 내부: "개선 공식", "구성 RR", "ARR 계산" 3섹션

**BEM 추가**:
- `.report-view__before-after-row__disclosure-trigger`
- `.report-view__before-after-row__disclosure-panel`
- `.report-view__before-after-row__disclosure-panel--open`
- `.report-view__before-after-row__formula-line`

### 9.7 WillRogersCaption (리팩토링, 3-A)

**파일**: `backoffice/src/pages/HealthReportPage/components/WillRogersCaption.tsx`

**추가 Props**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `willRogers` | `WillRogersEntry[]` | ❌ | 있으면 카운트/요약 표시 |

**State**:
- `expanded`: `boolean` (기본 false)

**구조 변경**:
```
<section class="report-view__will-rogers">
  <button aria-expanded onClick=toggle>
    코호트 기준 등수 설명 (윌로저스 방지)
  </button>
  {expanded && (
    <div class="report-view__will-rogers-detail">
      <p>... Feinstein 1985 (PMID 4000199) 설명 ...</p>
      <p>cohort_fixed: true 가 의미하는 것 ...</p>
      <ul>
        <li>현재 rank → 개선 rank 변화 계산 방식</li>
        <li>rank 개선 수치가 보이는 이유</li>
      </ul>
    </div>
  )}
</section>
```

**BEM 추가**:
- `.report-view__will-rogers`
- `.report-view__will-rogers-trigger`
- `.report-view__will-rogers-detail`
- `.report-view__will-rogers-detail--open`

### 9.8 BodyAgeChart (레이블 수정, 3-A)

**파일**: `backoffice/src/pages/HealthReportPage/components/BodyAgeChart.tsx`

**수정 라인**: L63 `tooltip formatter`

**Before**:
```tsx
formatter={(value) => [`${value}세`, '추정 건강나이']}
```

**After**:
```tsx
formatter={(value) => [`${value}세`, '질환별 건강나이']}
```

**기타 한국어 라벨**: `ORGAN_LABEL_MAP` 의 "알츠" → "알츠하이머" 로 확장 (BodyAgeChart.tsx L~30 부근)

### 9.9 AppendixBlock (레이블 수정, 3-A)

**파일**: `backoffice/src/pages/HealthReportPage/components/AppendixBlock.tsx`

기존 "추정 건강나이" / "보정 건강나이" 문구가 있다면 "질환별 건강나이" 로 통일.

grep 명령으로 전체 파일 대상 검색 후 수정:
```bash
grep -rn "추정 건강나이" backoffice/src/pages/HealthReportPage/
```

---

## 10. 데이터 매핑 매트릭스 (3-D 본체)

### 10.1 목적

`ReportData` 의 **모든 최상위 필드와 중첩 필드**가 어느 컴포넌트에서 렌더되는지 추적하고, 누락된 매핑을 Phase 3 종료 시점에 0건 으로 만든다. Playwright 셀렉터를 함께 등록하여 회귀 테스트 자동화 준비.

### 10.2 최상위 매핑 매트릭스

| ReportData 필드 | 타입 | 렌더 컴포넌트 | 화면 위치 | Playwright 셀렉터 |
|---|---|---|---|---|
| `name` | `string` | `ReportHeader` | 최상단 제목 | `[data-test="report-name"]` |
| `age` | `number` | `ReportHeader` | 이름 옆 | `[data-test="report-age"]` |
| `sex` | `"male" \| "female"` | `ReportHeader` | 이름 옆 | `[data-test="report-sex"]` |
| `group` | `string` | `ReportHeader` | 코호트 표기 | `[data-test="report-group"]` |
| `bodyage` | `number` | `BodyAgeChart` | Shock 섹션 메인 차트 | `[data-test="bodyage-value"]` |
| `rank` | `{percentile, n_used}` | `RankPill` | bodyage 우측 | `[data-test="rank-pill"]` |
| `diseases` | `DiseaseResult[]` | `DiseaseCardGrid` | Understand 섹션 | `[data-test="disease-card-{key}"]` |
| `nutrition` | `NutritionResult[]` | `NutritionPanel` | Understand 섹션 하단 | `[data-test="nutrition-{key}"]` |
| `gauges` | `GaugeResult[]` | `GaugeStrip` | Understand 섹션 상단 | `[data-test="gauge-{key}"]` |
| `patient_info` | `PatientInfo` | `PatientMetaPanel` + 디버그 drawer | 상단 배지 / 우측 drawer | `[data-test="patient-meta"]` |
| `improved` | `ImprovedScenario` | `BeforeAfterBlock` | Motivate 섹션 | `[data-test="before-after-block"]` |
| `disease_ages` | `Record<string, number>` | `BodyAgeChart` | 차트 x축 분포 | `[data-test="disease-age-{key}"]` |

### 10.3 중첩 필드 매트릭스 — `improved`

| 하위 필드 | 타입 | 렌더 위치 | 셀렉터 |
|---|---|---|---|
| `improved.labels` | `string[]` | `BeforeAfterBlock` 헤더 | `[data-test="improved-labels"]` |
| `improved.improved_sbp` | `number` | `BeforeAfterBlock` 서브 | `[data-test="improved-sbp"]` |
| `improved.improved_dbp` | `number` | 상동 | `[data-test="improved-dbp"]` |
| `improved.improved_fbg` | `number` | 상동 | `[data-test="improved-fbg"]` |
| `improved.ratios` | `Record<string, {orig, improved}>` | `BeforeAfterRow` 각 행 | `[data-test="row-{disease_key}"]` |
| `improved.five_year_improved` | `Record<string, number>` | `BeforeAfterRow` ARR 열 | `[data-test="row-{disease_key}-5y"]` |
| `improved.will_rogers` | `WillRogersEntry[]` | `WillRogersCaption` 상세 + `BeforeAfterRow` rank 열 | `[data-test="will-rogers"]` |
| `improved.has_improvement` | `boolean` | `BeforeAfterBlock` 렌더 guard | (없으면 블록 숨김) |

### 10.4 중첩 필드 매트릭스 — `diseases[i]`

| 하위 필드 | 타입 | 렌더 위치 | 셀렉터 |
|---|---|---|---|
| `diseases[i].key` | `string` | `DiseaseCard` 타이틀 | `[data-test="disease-card-{key}"]` |
| `diseases[i].label` | `string` | `DiseaseCard` 헤더 | `[data-test="disease-card-{key}-label"]` |
| `diseases[i].ratio` | `number` | `DiseaseCard` 메인 수치 | `[data-test="disease-card-{key}-ratio"]` |
| `diseases[i].rank` | `{percentile, n_used}` | `DiseaseCard` 배지 | `[data-test="disease-card-{key}-rank"]` |
| `diseases[i].band` | `"low"\|"mid"\|"high"` | `DiseaseCard` 색상 | data attr |
| `diseases[i].cohort_mean` | `number` | Disclosure 내부 | `[data-test="disease-card-{key}-cohort"]` |
| `diseases[i].components` | `RRComponent[]` | Disclosure 구성 RR 리스트 | `[data-test="disease-card-{key}-components"]` |

### 10.5 중첩 — `patient_info`

| 하위 필드 | 렌더 위치 | 셀렉터 |
|---|---|---|
| `patient_info.bmi` | `PatientMetaPanel` + `MilestoneSlot` 기준 BMI | `[data-test="patient-bmi"]` |
| `patient_info.smoking` | `PatientMetaPanel` | `[data-test="patient-smoking"]` |
| `patient_info.drinking` | `PatientMetaPanel` | `[data-test="patient-drinking"]` |
| `patient_info.imputed_fields` | 디버그 drawer (개발 모드) | `[data-test="imputed-fields"]` |
| `patient_info.missing_fields` | 디버그 drawer + 경고 배너 | `[data-test="missing-fields"]` |

### 10.6 중첩 — `nutrition[i]` / `gauges[i]`

| 필드 | 위치 | 셀렉터 |
|---|---|---|
| `nutrition[i].label` | `NutritionPanel` 항목 제목 | `[data-test="nutrition-{key}-label"]` |
| `nutrition[i].advice` | `NutritionPanel` 본문 | `[data-test="nutrition-{key}-advice"]` |
| `nutrition[i].severity` | 색상 | data attr |
| `gauges[i].label` | `GaugeStrip` tick | `[data-test="gauge-{key}-label"]` |
| `gauges[i].value` | `GaugeStrip` 포인터 | `[data-test="gauge-{key}-value"]` |
| `gauges[i].band` | 색상 | data attr |

### 10.7 신규 필드 매핑 (Phase 3 추가)

| 필드 | 출처 | 렌더 위치 | 셀렉터 |
|---|---|---|---|
| `SimulateResponse.bodyage` | `/simulate` | `MilestoneCard` 신체나이 | `[data-test="milestone-card-{key}-bodyage"]` |
| `SimulateResponse.ratios` | `/simulate` | `BeforeAfterRow` (timeDim 모드 시 override) | `[data-test="row-{disease_key}-override"]` |
| `SimulateResponse.will_rogers` | `/simulate` | `WillRogersCaption` 상세 (timeDim 모드) | `[data-test="will-rogers-override"]` |
| `SimulateResponse.arr_avg` | FE 파생 | `MilestoneCard` ARR 요약 | `[data-test="milestone-card-{key}-arr"]` |

### 10.8 매핑 누락 체크 절차

Phase 3 완료 기준으로 모든 셀렉터가 DOM 에 존재해야 한다. 검증 방법:

1. `backoffice/src/pages/HealthReportPage` 하위에서 `data-test="*"` grep 카운트
2. 10.2 ~ 10.7 표 항목 수 == grep 카운트 (±0)
3. Playwright E2E (Chapter 13) 에서 각 셀렉터 존재 여부 검증

### 10.9 Phase 2 에서 이미 렌더되는 것 vs Phase 3 추가분

- **Phase 2 완료**: 10.2 ~ 10.6 (대부분 이미 렌더 중이나 `data-test` 속성 누락 가능)
- **Phase 3 신규**: 10.7 (시뮬레이션 결과) + 10.2~10.6 중 `data-test` 미부여 항목 보강
- **3-D 작업**: 위 누락된 `data-test` 속성을 일괄 부여 (dev-reviewer + dev-coder 공동)

---

## 11. SCSS 토큰 연장 및 BEM 확장 목록

### 11.1 추가 토큰 (기존 `_tokens.scss` 연장)

```scss
// Milestone 카드 전용
$rv-milestone-card-min-width: 160px;
$rv-milestone-card-min-width-embed: 140px;
$rv-milestone-card-radius: 12px;
$rv-milestone-card-gap: 12px;
$rv-milestone-card-selected-border: 2px solid $rv-color-primary;

// Slider
$rv-slider-track-height: 6px;
$rv-slider-thumb-size: 18px;
$rv-slider-thumb-color: $rv-color-primary;

// TimeDim toggle
$rv-timedim-tab-height: 36px;
$rv-timedim-tab-gap: 4px;
$rv-timedim-tab-selected-bg: $rv-color-primary-soft;

// Disclosure panel
$rv-disclosure-panel-bg: $rv-color-surface-soft;
$rv-disclosure-panel-padding: 16px;
$rv-disclosure-panel-border-left: 3px solid $rv-color-primary;

// Formula mono
$rv-formula-font-family: "JetBrains Mono", "D2Coding", monospace;
$rv-formula-font-size: 13px;
```

### 11.2 신규 BEM 클래스 전체 목록

```
.report-view__milestone-slot
.report-view__milestone-grid
.report-view__milestone-card
.report-view__milestone-card--selected
.report-view__milestone-card--loading
.report-view__milestone-card--error
.report-view__milestone-card-label
.report-view__milestone-card-bodyage
.report-view__milestone-card-arr
.report-view__milestone-slider
.report-view__milestone-slider-track
.report-view__milestone-slider-value
.report-view__milestone-slider--disabled

.report-view__timedim-toggle
.report-view__timedim-toggle-option
.report-view__timedim-toggle-option--selected
.report-view__timedim-toggle-option--disabled

.report-view__before-after-block__header
.report-view__before-after-block__timedim
.report-view__before-after-block__formula
.report-view__before-after-row__disclosure-trigger
.report-view__before-after-row__disclosure-panel
.report-view__before-after-row__disclosure-panel--open
.report-view__before-after-row__formula-line

.report-view__will-rogers
.report-view__will-rogers-trigger
.report-view__will-rogers-detail
.report-view__will-rogers-detail--open
```

### 11.3 SCSS 파일 분할

- 신규 파일: `backoffice/src/pages/HealthReportPage/styles/_milestone.scss`
- 신규 파일: `backoffice/src/pages/HealthReportPage/styles/_timedim.scss`
- 기존 `_disclosure.scss` 확장 또는 `_before_after.scss` 하단에 Disclosure 패널 스타일 추가

**iframe 대응**: 각 scss 파일 최하단에 `:host-context(.report-view--embed)` 미디어 쿼리로 embed 시 grid 재정의.

---

## 12. 회귀 위험 목록과 방지책

### 12.1 R&D engine 회귀

| 위험 | 가능성 | 방지책 |
|---|:---:|---|
| `compute_improved_scenario` 수정으로 기존 결과 변경 | 중 | **수정 금지** — 신규 `compute_milestone_scenario` 만 추가. 기존 함수는 read-only |
| 골든 352 케이스 편차 | 저 | Phase 3 완료 후 pytest 재실행, 편차 > 0 시 롤백 |
| Will Rogers cohort_fixed 로직 손상 | 중 | `compute_milestone_scenario` 도 `cohort_mean = orig_data["cohort_mean"]` 유지 (하드 어서트) |
| `_time_attenuation(months=0)` 이 α≠1.0 반환 | 저 | 테스트: `time_horizon_months=0` → 기존 scenario 와 ratio 편차 0.0001 이내 |
| RR coefficient 키 오타 | 중 | ATTENUATION_PAIRS 키는 engine 내 disease_key 와 일치해야 함. 단위 테스트로 키 존재 검증 |

### 12.2 WELNO 백엔드 회귀

| 위험 | 방지책 |
|---|---|
| `/simulate` 추가로 기존 `/ai-summary` 영향 | 영향 없음 — 독립 엔드포인트, 별도 DB 테이블 |
| DB 마이그레이션 rollback | `welno_mediarc_simulations` DROP 가능 (외래키 없음) |
| Haiku 호출 비용 증가 | `/simulate` 는 Haiku 호출하지 않음 — 엔진만 사용. ANTHROPIC_API_KEY 불필요 |
| asyncpg connection pool 고갈 | `/simulate` 는 DB 읽기/쓰기 1회씩, 기존 pool 재사용 |

### 12.3 FE 회귀

| 위험 | 방지책 |
|---|---|
| `BeforeAfterBlock` 수정으로 기존 UI 붕괴 | 기존 props 유지 + 신규 props 는 optional. timeHorizonMonths=0 기본값 |
| BMI 슬라이더 race condition | AbortController + 300ms debounce |
| iframe embedMode grid 깨짐 | Chromium + Safari 양 브라우저 시각 회귀 테스트 |
| `useMediarcApi` ReportData 타입 변경 | 변경 없음 — `SimulateResponse` 는 신규 별도 타입 |
| 기존 `/partner-office/mediarc-report/{uuid}` GET 응답에 필드 추가 | 추가 없음 (시뮬은 /simulate 에서만) |

### 12.4 데이터 매핑 회귀 (3-D)

| 위험 | 방지책 |
|---|---|
| `data-test` 추가로 기존 CSS 셀렉터 충돌 | `data-test` 는 순수 attribute, CSS 에 사용 금지 |
| Playwright E2E 셀렉터 불일치 | Chapter 10.2 ~ 10.7 표를 SoT 로 하여 E2E 스펙 작성 |

### 12.5 전체 회귀 테스트 순서

1. R&D engine: pytest 골든 352 + time_horizon=0 regression
2. WELNO backend: `/simulate` unit + contract test
3. FE: Vitest/Jest 단위 + Playwright E2E
4. E2E iframe: `containment="container"` + 400px 너비 시각 검증
5. 기존 리포트 뷰 스냅샷 회귀 (Phase 2 완료 시점 스냅샷 vs Phase 3 배포 후 — timeDim=0 에서 픽셀 diff 0)

---

## 13. 테스트 계획 (단위 / E2E / 골든 검증)

### 13.1 R&D engine 단위 테스트

**위치**: `p9_mediArc_engine/tests/test_milestone_scenario.py` (신규)

```python
def test_milestone_time_zero_equals_improved():
    """time_horizon_months=0 일 때 compute_improved_scenario 결과와 일치"""
    patient = load_fixture("patient_52m_smoker_htn.json")
    disease_results = compute_disease_results(patient)
    original = compute_improved_scenario(patient, disease_results)
    milestone = compute_milestone_scenario(
        patient, disease_results,
        bmi_target=22.9, time_horizon_months=0
    )
    for key in original["ratios"]:
        assert abs(milestone["ratios"][key]["improved"] - original["ratios"][key]["improved"]) < 0.0001

def test_milestone_bmi_current_equals_current_ratio():
    """bmi_target == patient.bmi 일 때 현재 ratio 와 일치"""
    # ...

def test_milestone_5y_attenuation_monotonic():
    """5년 후 ratio 가 6개월 후 ratio 보다 개선 효과가 작아야 함 (α 감쇠)"""
    # ...

def test_will_rogers_cohort_fixed_preserved():
    """compute_milestone_scenario 도 cohort_mean 을 원본에서 고정해야 함"""
    # ...

def test_arr_computation():
    """ARR = (orig - improved) / orig * 100"""
    # ...

def test_milestone_golden_352():
    """골든 352 케이스 중 20개 샘플 회귀 (time=0, bmi=22.9)"""
    # ...
```

### 13.2 WELNO backend contract test

**위치**: `planning-platform/backend/tests/test_mediarc_simulate.py` (신규)

```python
def test_simulate_endpoint_returns_ratios(client, mock_patient):
    response = client.post(
        f"/api/v1/partner-office/mediarc-report/{TEST_UUID}/simulate",
        json={"bmi_target": 22.9, "time_horizon_months": 0},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200
    body = response.json()
    assert "ratios" in body
    assert "will_rogers" in body
    assert "bodyage" in body

def test_simulate_cache_hit(client, mock_patient):
    """동일 input_digest 두 번째 호출 시 DB 에서 즉시 반환"""
    # ...

def test_simulate_invalid_bmi(client):
    """BMI 범위 초과 400"""
    # ...

def test_simulate_missing_patient(client):
    """존재하지 않는 uuid 404"""
    # ...
```

### 13.3 FE 단위 테스트 (Vitest)

**위치**: `backoffice/src/pages/HealthReportPage/components/__tests__/`

- `MilestoneCard.test.tsx`: 렌더 4 상태(idle/loading/ok/error)
- `BmiSlider.test.tsx`: onChange 호출 확인, disabled 상태
- `TimeDimToggle.test.tsx`: 4 옵션 클릭, selected 토글
- `BeforeAfterRow.test.tsx`: Disclosure open/close, formulaDetail 렌더
- `WillRogersCaption.test.tsx`: expanded toggle
- `useSimulation.test.tsx`: AbortController, debounce

### 13.4 Playwright E2E

**위치**: `backoffice/e2e/mediarc-report.spec.ts` (확장)

핵심 시나리오:
1. 리포트 페이지 진입 → Chapter 10 의 모든 `data-test` 셀렉터 존재 확인
2. MilestoneCard "-5kg" 클릭 → BeforeAfterRow ratios 업데이트
3. BmiSlider drag 20.0 → 25.0 → 300ms 후 결과 갱신 (1회만 호출)
4. TimeDimToggle "5년 후" 선택 → ratios 가 현재와 달라짐
5. TimeDimToggle "현재" 복귀 → ratios 가 data.improved 와 일치
6. BeforeAfterRow "근거" 클릭 → Disclosure 열림, 수식 표시
7. WillRogersCaption 클릭 → 상세 설명 열림, Feinstein PMID 표시 확인
8. iframe embedMode (containment="container"): 400px 너비에서 카드 2열 wrap

### 13.5 iframe 시각 회귀 (Percy / Chromatic)

- containment="container" ON/OFF × width {400, 600, 900, 1200} 매트릭스
- Phase 2 종료 시점 baseline 스냅샷 저장
- Phase 3 배포 후 timeDim=0 상태에서 diff 허용 오차 0

### 13.6 성능 테스트

- `/simulate` p95 응답 시간 < 800ms (DB 캐시 hit 시 < 50ms)
- MilestoneCard 5장 동시 로드 시 전체 완료 < 2초
- BmiSlider drag 100회 중 `/simulate` 호출 수 <= (drag-count / 2) (debounce 효과 검증)

---

## 14. 롤아웃 / 롤백 / 배포 계획

### 14.1 배포 순서

1. **R&D engine** (`p9_mediArc_engine`)
   - `compute_milestone_scenario` 추가 + ATTENUATION_PAIRS 테이블
   - pytest 350 + 신규 테스트 통과 확인
   - GitHub main merge

2. **WELNO backend** (`planning-platform/backend`)
   - DB 마이그레이션 `welno_mediarc_simulations` CREATE
   - `/simulate` 엔드포인트 추가
   - R&D engine 버전 sync (git submodule or pip install 경로 확인)
   - 배포: `memory/welno-deploy.md` 절차 — git pull + pm2 restart WELNO_BE
   - 헬스체크: `curl /api/v1/partner-office/mediarc-report/{uuid}/simulate` 200 확인

3. **WELNO frontend (backoffice)**
   - Phase 3 컴포넌트 머지
   - `NODE_OPTIONS=--openssl-legacy-provider yarn build` 또는 WELNO 동등 빌드
   - `npm run deploy:simple` — static 복사
   - git push → 서버 git pull → pm2 restart
   - 브라우저 hard reload

4. **feature flag**
   - 초기 배포는 내부 QA 만 접근 가능한 feature flag (`localStorage.mediarc_phase3 = '1'`)
   - 1주 모니터링 후 전원 공개

### 14.2 롤백 계획

| 단계 | 롤백 방법 |
|---|---|
| FE 깨짐 | git revert + redeploy (5분 이내) |
| /simulate 500 | 엔드포인트 일시 unregister + pm2 restart |
| DB 마이그레이션 | `DROP TABLE welno_mediarc_simulations;` (외래키 없어서 안전) |
| engine 회귀 | R&D 이전 커밋 체크아웃 + WELNO BE 재배포 |
| 전체 롤백 | feature flag OFF → Phase 2 UI 로 강제 복귀 |

### 14.3 배포 후 모니터링 (24시간)

- pm2 logs WELNO_BE — /simulate 호출 수, 에러율
- DB 쿼리: `SELECT COUNT(*) FROM welno_mediarc_simulations` 증가 확인
- ES 로그 (만약 통합) — 에러율 baseline 대비 증가 없음
- 백오피스 사용자 피드백 (slack)

### 14.4 배포 담당

- engine: dev-coder A (R&D repo)
- backend: dev-coder B (WELNO backend)
- frontend: dev-coder B (WELNO backoffice) — engine 배포 후
- 검증: dev-reviewer + 하비 (Level 3)

---

## 15. 에이전트 병렬 분담안 (1 sprint 내 완료)

### 15.1 팀 구성

- **dev-planner** (오케스트레이터): 본 스펙 소유, 충돌 조율, Daily 체크
- **dev-coder A**: 3-A (라벨/근거) — FE 전담
- **dev-coder B**: 3-B (BMI 5카드) + 3-C (시간 4옵션 + engine) — BE + FE
- **dev-reviewer**: 3-D (데이터 매핑 매트릭스 + data-test 부여) + Level 1 검증
- **harby-verifier**: Level 2 크로스팀 정합성 (engine ↔ BE ↔ FE 타입 일치)

### 15.2 Day-by-Day 일정

| Day | dev-coder A (3-A) | dev-coder B (3-B/3-C) | dev-reviewer (3-D) |
|---|---|---|---|
| **D1** | 라벨 수정 (BodyAgeChart/Appendix) + WillRogersCaption 확장 | engine `compute_milestone_scenario` 구현 + 골든 테스트 | data-test 셀렉터 gap 분석 (Chapter 10 대비 누락 리스트) |
| **D2** | BeforeAfterRow Disclosure 구현 + 단위 테스트 | `/simulate` 엔드포인트 + DB 마이그레이션 + contract 테스트 | data-test 부여 작업 1/2 (diseases, improved) |
| **D3** | 3-A merge + Playwright 업데이트 (라벨/Disclosure) | MilestoneSlot + MilestoneCard + BmiSlider 구현 | data-test 부여 작업 2/2 (nutrition, gauges, patient_info, simulation) |
| **D4** | (버퍼 / 3-B 지원) | TimeDimToggle + BeforeAfterBlock 리팩토링 + useSimulation hook | Playwright E2E 전체 매트릭스 실행, FAIL 케이스 리턴 |
| **D5** | 회귀 검증 | 전체 회귀 + feature flag 배포 | 최종 data-test 매트릭스 100% 확인 |

### 15.3 파일 잠금 (병렬 충돌 방지)

| 파일 | 소유자 | 비고 |
|---|---|---|
| `BodyAgeChart.tsx` | dev-coder A | 3-A 전용 |
| `AppendixBlock.tsx` | dev-coder A | 3-A 전용 |
| `WillRogersCaption.tsx` | dev-coder A | 3-A 전용 |
| `BeforeAfterRow.tsx` | dev-coder A → dev-coder B | 3-A 먼저 merge → 3-C rebase |
| `BeforeAfterBlock.tsx` | dev-coder A (footer) / dev-coder B (header) | 공간 분리 — 3-A 먼저 merge |
| `MilestoneSlot.tsx` | dev-coder B | 3-B 전용 |
| `MilestoneCard.tsx` | dev-coder B | 신규 |
| `BmiSlider.tsx` | dev-coder B | 신규 |
| `TimeDimToggle.tsx` | dev-coder B | 신규 |
| `useSimulation.ts` | dev-coder B | 신규 hook |
| `useMediarcApi.ts` | 공유 read / dev-coder B 타입 확장만 | SimulateResponse 타입 추가 |
| `engine.py` | dev-coder B | R&D repo, WELNO port 동기화 필수 |
| `partner_office.py` | dev-coder B | `/simulate` 엔드포인트 추가 |
| scss 신규 파일 | dev-coder B | `_milestone.scss`, `_timedim.scss` |
| scss 기존 파일 | dev-coder A (Disclosure), dev-coder B (TimeDim) | 섹션 헤더로 공간 분리 |
| Playwright spec | dev-coder A + dev-reviewer | 마지막 day 통합 |

### 15.4 체크포인트

- D1 End: engine 신규 함수 회귀 0 (골든 352 통과)
- D2 End: `/simulate` 로컬 curl 200 + DB 캐시 hit 확인
- D3 End: MilestoneCard 5장 렌더 + 스토리북 스냅샷
- D4 End: TimeDim 4옵션 동작 + iframe embed 검증
- D5 End: 전체 Playwright E2E PASS + harby-verifier Level 2 통과

### 15.5 병렬 확인 원칙 (Generator ≠ Evaluator)

- dev-coder A/B 가 구현한 코드는 반드시 dev-reviewer 가 **독립 검증**
- dev-planner 가 컨플릭트 조율 + 하비에게 일일 리포트
- 최종 릴리즈 전 harby-verifier 크로스팀 정합성 확인

---

## 16. 수용 기준 (Acceptance Criteria) 전체 체크리스트

### 16.1 기능 수용 기준

- [ ] 리포트 전 화면에 "추정 건강나이" 문구 0건 — 모두 "질환별 건강나이" 로 통일
- [ ] "알츠" 라벨 0건 — 모두 "알츠하이머"
- [ ] WillRogersCaption 접힌 상태에서 1줄 요약 + 펼침 시 Feinstein 1985 (PMID 4000199) 설명 노출
- [ ] BeforeAfterRow 마다 "근거" 버튼 존재 + 클릭 시 개선 공식/구성 RR/ARR 계산 식 노출
- [ ] MilestoneSlot 에 5개 카드 렌더: "현재 / -2kg / -5kg / -10kg / 정상 BMI"
- [ ] 각 MilestoneCard 는 신체나이 + 평균 ARR 을 표시
- [ ] BmiSlider 17~40 범위, step 0.1, debounce 300ms 동작
- [ ] BeforeAfterBlock 헤더에 TimeDimToggle 4옵션 ("현재 / 6개월 / 1년 / 5년")
- [ ] TimeDim 변경 시 `/simulate` 호출 → ratios/will_rogers 갱신
- [ ] TimeDim "현재" 선택 시 data.improved 와 결과 일치 (α=1.0)
- [ ] Chapter 10 의 data-test 셀렉터 100% DOM 에 존재

### 16.2 엔진 수용 기준

- [ ] `compute_milestone_scenario(patient, disease_results, *, bmi_target, time_horizon_months, weight_delta_kg)` 함수 존재
- [ ] `compute_improved_scenario` **소스 변경 없음** (git diff 0줄)
- [ ] 골든 352 케이스 time=0 결과 편차 0.0001 이내
- [ ] `_time_attenuation(months, disease)` 단조 감소 (6개월 > 1년 > 5년)
- [ ] α 테이블 9 조합 모두 출처 PMID 주석 포함 (또는 "출처 미확인" 명시)
- [ ] ATTENUATION_PAIRS 에 Rothman synergy / VanderWeele 4-way decomposition 주석

### 16.3 백엔드 수용 기준

- [ ] `POST /api/v1/partner-office/mediarc-report/{uuid}/simulate` 200 응답
- [ ] SimulateRequest: `bmi_target` (optional) + `weight_delta_kg` (optional) + `time_horizon_months` ∈ {0,6,12,60}
- [ ] SimulateResponse: `bodyage`, `ratios`, `will_rogers`, `arr_avg` 필드
- [ ] `welno.welno_mediarc_simulations` 테이블 존재 + UNIQUE (patient_uuid, hospital_id, input_digest)
- [ ] 동일 input 2번째 호출 시 DB 에서 즉시 반환 (< 50ms)
- [ ] 인증: 기존 `/ai-summary` 동일 가드 재사용
- [ ] 에러 코드 표 (Chapter 6) 대로 400/404/409/500 처리

### 16.4 FE 수용 기준

- [ ] iframe embedMode (containment="container") + 400px 너비에서 카드 2열 wrap 정상
- [ ] AbortController 로 race 방지 (빠른 드래그 시 마지막 결과만 반영)
- [ ] MilestoneSlot mount 시 5 카드 병렬 `/simulate` 호출 → 캐시 hit 으로 2회차부터 즉시
- [ ] 슬라이더 disabled 상태 표시 (로딩 중)
- [ ] Disclosure 접근성: `aria-expanded`, `aria-controls` 속성 세팅

### 16.5 테스트 수용 기준

- [ ] R&D engine pytest 신규 테스트 6종 PASS
- [ ] WELNO backend contract 테스트 4종 PASS
- [ ] FE Vitest 단위 테스트 6종 PASS
- [ ] Playwright E2E 8 시나리오 PASS
- [ ] iframe 시각 회귀 픽셀 diff 0 (timeDim=0 baseline 비교)
- [ ] `/simulate` p95 < 800ms (캐시 miss), < 50ms (캐시 hit)

### 16.6 릴리즈 수용 기준

- [ ] DB 마이그레이션 성공 + rollback 스크립트 검증
- [ ] feature flag 초기 OFF → 내부 QA ON → 일주일 후 전원 ON
- [ ] pm2 logs WELNO_BE 배포 후 에러 로그 0건 / 1시간
- [ ] 노션 배포 페이지 생성 (notion-deploy 스킬)
- [ ] work-history.md 세션 엔트리 기록

### 16.7 Generator ≠ Evaluator 수용 기준

- [ ] dev-coder A 가 작성한 3-A 코드 → dev-reviewer 가 Level 1 검증 PASS
- [ ] dev-coder B 가 작성한 3-B/3-C 코드 → dev-reviewer 가 Level 1 검증 PASS
- [ ] dev-reviewer 가 작성한 3-D data-test → dev-coder A 또는 B 가 크로스 검증 PASS (Reviewer ≠ Self)
- [ ] harby-verifier Level 2 크로스팀 정합성 PASS
- [ ] 하비 Level 3 승인 후 배포 (배포는 하비 요청 시에만)

---

## 부록 A — PMID 검증 테이블

각 RR 계수와 α 감쇠 값의 출처 PMID. **구현 시 dev-coder 는 PubMed 에서 직접 검색하여 제목/초록이 주장과 일치하는지 확인한 뒤 코드 주석에 인용**한다. 불일치 또는 접근 불가 시 `# 출처 미확인 (요검증)` 마킹.

| # | 항목 | PMID / 출처 | 저자·저널·연도 | 판정 | 비고 |
|---|---|---|---|---|---|
| A1 | Will Rogers phenomenon | **4000199** | Feinstein AR, *N Engl J Med* 1985;312(25):1604-8 | PASS | 초록에 "staging" + "migration" 확인 |
| A2 | 질환별 건강나이 공식 `delta = ln(HR)/γ; γ≈0.10 → delta≈ln(HR)×10` | **34151374** | **Pang M & Hanley JA**, *Am J Epidemiol* 2021;190(12):2664-70 | PASS (저자 정정) | ⚠️ 스펙 구 귀속 "D'Agostino Framingham" 삭제. 개념 기원: Gompertz 1825 사망법칙 + Spiegelhalter 2012 대중화; CV 위험 기반 vascular age 원출처(별도 개념): D'Agostino et al. 2008 PMID 18212285 |
| A3 | Piecewise log cohort normalization | **6626659** (Holford 1983) + **3629047** / **3629048** (Clayton & Schifflers 1987) | Holford TR, *Biometrics* 1983;39(2):311-24 / Clayton D & Schifflers E, *Stat Med* 1987;6(4):449-67 + 469-81 | PASS (교체) | ⚠️ 구 PMID 18212285는 D'Agostino 2008 Circulation — 무관 논문. 삭제. 방법론 원리 서술: Rothman et al. *Modern Epidemiology* 3rd ed. 2008 ISBN 978-0-7817-5564-1 (책 인용) |
| A4 | 금연 후 심혈관 RR 회복 곡선 | **15914503** | Woodward M et al., *Int J Epidemiol* 2005;34(5):1036-45 | PASS | 아시아태평양 코호트 CHD HR 0.71, 뇌졸중 HR 0.84 (전 흡연자 vs 현재흡연) |
| A5 | 금연 암 RR | **17893872** | Gandini S et al., *Int J Cancer* 2008;122(1):155-64 | PASS | cross-sectional 성격 — 시계열 감쇠 직접 산출 불가, 폐암은 Stapleton 2020 (PMID 32603182) 병용 |
| A6 | 금연 후 뇌졸중 RR (시계열 감쇠) | **24291341** (1차) + **3339799** (보조) + **8417241** (보조) | **Lee PN, Fry JS, Thornton AJ**, *Regul Toxicol Pharmacol* 2014;68(1):85-95 / Wolf PA et al., JAMA 1988 / **Kawachi I et al.**, JAMA 1993;269(2):232-6 | PASS (교체) | ⚠️ 구 PMID 26311724 (Pan 2015)는 당뇨환자 CVD 메타 — 뇌졸중 단독 아님. 삭제. Lee 2014: H=4.78년 지수감쇠, λ=0.145/년. ※ 구 스펙 PMID 8445825는 오류 — 올바른 Kawachi 1993 PMID는 **8417241** |
| A7 | 체중 감량 CVD RR | **21593294** | Wing RR et al. (Look AHEAD), *Diabetes Care* 2011;34(7):1481-6 | PASS | 보조: Look AHEAD 2016 사후 분석 PMID 27595918 (10년 추적 — 10% 이상 감량만 유의, HR 0.79) |
| A8 | Rothman synergy index | **1274952** | **Rothman KJ**, *Am J Epidemiol* 1976;103(5):506-11 "The estimation of synergy or antagonism" | PASS (교체) | ⚠️ 구 PMID 18212285는 D'Agostino Circulation — 무관. 삭제. 교과서 2차 출처: Rothman et al. *Modern Epidemiology* 3rd ed. 2008 ISBN 978-0-7817-5564-1 |
| A9 | VanderWeele 4-way decomposition | — | VanderWeele TJ, "Explanation in Causal Inference" (책) | PASS | 책 인용 — PMID 없음 |
| 책 공통 | Rothman *Modern Epidemiology* 3rd ed. | — (책) | Rothman KJ, Greenland S, Lash TL. *Modern Epidemiology*, 3rd ed. Lippincott Williams & Wilkins, 2008. ISBN 978-0-7817-5564-1 (WorldCat OCLC 169455558) | 추가 | A3·A8 방법론 원리 서술용 2차 출처 |

**검증 절차**:
1. PubMed (https://pubmed.ncbi.nlm.nih.gov/) 에서 PMID 직접 검색
2. 제목/저자/연도 일치 확인
3. 초록 또는 본문 일부에서 주장 근거 확인
4. 불일치 시 대체 PMID 탐색 또는 "출처 미확인" 마킹
5. 결과를 본 스펙 14.1 테이블에 업데이트

**금지**: AI 가 제안한 PMID 를 검증 없이 그대로 코드 주석에 넣는 것 — 논문 출처 날조 위반 (CLAUDE.md 반복실수 2026-03-30)

---

## 부록 B — 엔진 ↔ FE 필드 타입 매트릭스

| 엔진 출력 (Python) | FE 타입 (TypeScript) | 비고 |
|---|---|---|
| `dict[str, Any]` (compute_milestone_scenario return) | `SimulateResponse` | Chapter 6 참조 |
| `ratios[key] = {"orig": float, "improved": float}` | `ratios: Record<string, {orig: number; improved: number}>` | |
| `will_rogers = [{disease_key, orig_rank, improved_rank, ...}]` | `will_rogers: WillRogersEntry[]` | `useMediarcApi.ts` WillRogersEntry 재사용 |
| `bodyage = float` | `bodyage: number` | |
| `arr_avg = float` (평균 ARR%) | `arr_avg: number` | FE 파생도 가능 |
| `cohort_fixed = True` | `cohort_fixed: true` (literal) | |
| `time_horizon_months = 0 | 6 | 12 | 60` | `time_horizon_months: 0 \| 6 \| 12 \| 60` | literal union |

**null 처리**: Python `None` ↔ TypeScript `null | undefined`. FE 에서는 optional field 로 선언하되, 필수 필드(bodyage/ratios)는 None 반환 금지.

**정확도**: 서버는 float 4자리, FE 렌더 시 1자리 반올림 (`Math.round(v * 10) / 10`).

---

## 부록 C — 시뮬레이션 예시 payload / response

### C.1 요청 (5kg 감량, 1년 후)

```json
POST /api/v1/partner-office/mediarc-report/831b1be7-677b-4899-803d-f69622f919dd/simulate
Content-Type: application/json

{
  "weight_delta_kg": 5.0,
  "time_horizon_months": 12
}
```

### C.2 응답 (정상)

```json
{
  "bodyage": 48.3,
  "ratios": {
    "cvd": {"orig": 1.42, "improved": 1.18},
    "dm": {"orig": 1.85, "improved": 1.32},
    "htn": {"orig": 1.62, "improved": 1.25},
    "stroke": {"orig": 1.31, "improved": 1.14},
    "alz": {"orig": 1.22, "improved": 1.15}
  },
  "will_rogers": [
    {
      "disease_key": "cvd",
      "orig_ratio": 1.42,
      "improved_ratio": 1.18,
      "orig_rank": 72,
      "improved_rank": 58,
      "rank_change": -14,
      "arr_pct": 16.9,
      "cohort_fixed": true
    }
  ],
  "arr_avg": 18.2,
  "time_horizon_months": 12,
  "bmi_target": 24.1,
  "input_digest": "a3b5c7d9..."
}
```

### C.3 응답 (에러 — 환자 없음)

```json
HTTP/1.1 404 Not Found
{
  "detail": "Patient not found or no report data available"
}
```

### C.4 응답 (에러 — BMI 범위 초과)

```json
HTTP/1.1 400 Bad Request
{
  "detail": "bmi_target must be in range [15.0, 45.0]"
}
```

### C.5 응답 (시뮬레이션 엔진 미동의)

```json
HTTP/1.1 409 Conflict
{
  "detail": "Patient lacks required fields for simulation: [height, sbp]"
}
```

---

## 부록 D — 용어 사전

| 용어 | 의미 | 사용 위치 |
|---|---|---|
| **질환별 건강나이** (disease-age) | 질환별 ratio 를 연령으로 환산한 값. `delta = ln(HR)/γ; γ≈0.10` (Pang & Hanley 2021 AJE, PMID 34151374) | BodyAgeChart, AppendixBlock |
| **코호트** (cohort) | 동일 연령/성별/유사 조건 환자 집단. 리포트에서 비교 기준 | WillRogersCaption, rank 계산 |
| **윌로저스 현상** (Will Rogers phenomenon) | 환자가 다른 집단으로 이동해도 양 집단 평균이 개선되어 보이는 통계 착시 (Feinstein 1985, PMID 4000199) | WillRogersCaption |
| **ARR** (Absolute Risk Reduction) | 절대 위험 감소율. `(orig - improved) / orig × 100` | BeforeAfterRow, MilestoneCard |
| **RR** (Relative Risk) | 상대 위험. 각 위험 요인의 기여도. 곱셈 모델 또는 Rothman synergy | engine.py 내부 |
| **Will Rogers 방지** | 개선 시나리오에서도 `cohort_mean` 을 원본에서 고정하여 착시 제거 | compute_improved/milestone_scenario |
| **TimeDim** | 시간 축 토글 (현재/6개월/1년/5년) | TimeDimToggle |
| **Milestone** | 체중 감량 목표 (현재/-2/-5/-10kg/정상 BMI) | MilestoneSlot |
| **Disclosure** | 근거/수식을 접었다 펼치는 UI 패턴 | BeforeAfterRow, WillRogersCaption |
| **α (time attenuation)** | 시간 경과에 따른 개선 효과 감쇠 계수 [0, 1] | engine `_time_attenuation` |
| **BeforeAfterBlock** | 개선 전/후 비교 전체 블록 (Motivate 섹션) | 리포트 중반 |
| **input_digest** | 요청 파라미터의 sha256 해시. 캐싱 키 | /simulate + welno_mediarc_simulations |
| **containment="container"** | HTML container query attribute. iframe 임베드 모드 | ReportView 최상위 |
| **embedMode** | containment 활성화 상태. 레이아웃 축소 | props 전파 |
| **BEM** | Block Element Modifier. CSS 네이밍 규칙 (`.report-view__milestone-card--selected`) | 전체 SCSS |

---

## 스펙 끝

본 스펙은 **단일 sprint (5 영업일) 내 1개 dev-planner + 2 dev-coder + 1 dev-reviewer** 로 3-A/B/C/D 를 병렬 처리하기 위한 계약서다. 각 항목은 파일:라인 인용과 PMID 를 근거로 하며, 추측을 포함하지 않는다. 구현 중 본 스펙과 현실 코드 사이에 불일치가 발견되면 즉시 dev-planner 에게 에스컬레이션하여 스펙을 수정한 뒤 작업한다. 스펙 수정 없이 코드 변경 금지.

**승인 필요**:
- 하비 (Level 3) — 시작 승인 + 최종 배포 승인
- dev-reviewer (Level 1) — 각 작업 단위 검증
- harby-verifier (Level 2) — 크로스팀 정합성 최종 확인

**관련 문서**:
- `memory/project-mediarc-report.md` — 프로젝트 현황
- `memory/welno-deploy.md` — 배포 절차
- `memory/infra-master.md` — 서버 인프라
- `CLAUDE.md` 반복실수 테이블 — 논문 PMID 날조 금지
- `.claude/rules/workflow.md` — 수정 전 전체 영향 분석
- `.claude/rules/verify.md` — Task-Do-Verify
- `.claude/rules/team-governance.md` — Generator ≠ Evaluator

