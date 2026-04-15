# mediArc 리포트 뷰 통합 설계서

> **작성일**: 2026-04-15
> **목적**: 투비콘 PDF 참조 + mediArc 엔진 현황 + 윌로저스·미션 기능을 통합해 백오피스 Drawer 에 **실제 리포트 한 장** 렌더
> **결론**: **엔진은 이미 준비 완료**. WELNO BE 응답 + FE 렌더 추가만 필요

---

## 1. 한 줄 요약

> 하비가 "미션 설정하면 등수 바뀐다는 기능 왜 없지?" 물었는데 — **엔진(`engine.py` L1156-1265)에는 이미 구현**돼 있고 `improved` + `will_rogers` dict 로 반환됨. 다만 `services/report_engine/facade.py` 의 `generate_report()` 가 해당 필드를 FE 로 전달하지 않고 drop 중. **엔진 로직 수정은 불필요, 3-layer 중계만 추가**하면 됨.

---

## 2. 투비콘 PDF (23p) 구조 — 레퍼런스

### 섹션 구성
| 페이지 | 내용 |
|---|---|
| p1 | 표지 (이름·성별·생년월일) |
| p2 | 목차 |
| p3-4 | **종합 분석** — 건강나이, 질환 매트릭스, 맞춤 영양 3종 |
| p5-11 | **7 주요 질환** (고혈압/당뇨/만성신장병/대사증후군/심혈관/뇌혈관/알츠하이머) — 각 1p, **Before/After 시뮬레이션 포함** |
| p12-15 | **9 암** (대장·담낭·간·폐·췌장·전립선·신장·위·갑상선) — 각 1p, **Before/After 포함** |
| p16 | **건강나이 분석** — 신체 부위별 기관 건강나이 (뇌/신장/심장 인체 다이어그램) |
| p17 | **맞춤 영양성분** — 추천 3종 + 주의 5종 + 외부 구매 링크 (pillgram.kr) |
| p18-19 | **참고문헌** — 40+ 논문 (영문/한글, APA 유사) |
| p20-23 | 기타 (면책/뒷표지) |

### 차트 종류
1. 게이지 차트 — 혈압·BMI 수치 범위 (3단 색상)
2. **가로 막대 Before/After** — 현재 vs 개선 후 N배 (색상 구분) ⭐
3. 도넛 — 50대 남성 유병률 (코호트 비교)
4. 세로 막대 시계열 — 1인당 연간 진료비 2016-2020
5. 등수 순위 바 — "1등(0.3배) ~ 100등(6.0배)"
6. 인체 다이어그램 — 장기별 건강나이 오버레이

### 핵심 메시지 패턴 (Before/After 예시)
```
당뇨 (p6)
  현재:  음주 / 흡연 / BMI 28.73  →  발병 통계 지수 1.8배 (58등)
  개선 후: 금주 / 금연 / BMI <23 →  발병 통계 지수 0.5배

  개인화 멘트:
  "윤철주님은 생활 습관 개선이 필요합니다."
  "금연·금주·정상 체중 유지는 발병 통계 지수 개선에 도움이 됩니다."
```

### 주목할 점
- **"윌로저스" 단어 자체는 PDF 에 없음** (명시 안 됨, 배경 로직으로만)
- **PMID 직접 인용 없음** — 저자-연도-저널 방식 (APA 유사)
- "※ 담당의와 상담 권장" 면책 1-2줄씩

---

## 3. mediArc 엔진 출력 전수 — **기능 커버리지**

### `Report.run()` 반환 JSON (engine.py 확인)
```jsonc
{
  "name": "string",
  "age": 43, "sex": "M", "group": "40M",

  "bodyage": {
    "bodyage": 36.9,       // 건강나이 (7 질환 Δage 가중평균)
    "delta": -6.1,          // 실제나이 - 건강나이
    "bioage_gb": {          // sklearn GB 모델 (PMID 40231591)
      "score": ..., "percentile": ...
    }
  },
  "rank": 30,                // 0~100 백분위

  "diseases": {
    "당뇨": {
      "individual_rr": 1.5, "cohort_mean_rr": 6.274,
      "ratio": 0.2, "rank": 1, "grade": "정상",
      "chips": [{name, present}, ...],
      "chips_present": 1, "chips_total": 7,
      "five_year": [0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
      "applied_factors": [{factor, rr, pmid, source, confidence}, ...],

      // ⭐ 미션/윌로저스 필드 (FE 에 아직 노출 안 됨)
      "improved_ratio": 0.9,
      "improved_rank": 28,
      "rank_change": 30,
      "arr_pct": 50.0
    },
    ... (16 질환)
  },

  "gauges": {               // 수치별 정상/경계/이상
    "all": { "bmi": {...}, "sbp": {...}, ... }
  },

  "nutrition": {
    "recommend": [...],  "caution": [...]
  },

  // ⭐ 엔진이 반환하지만 WELNO BE 에서 drop 하는 핵심 필드
  "improved": {
    "labels": {"bmi": "BMI 23미만", "smoking": "금연", "drinking": "금주"},
    "improved_sbp": 128.5,
    "improved_dbp": 76.2,
    "improved_fbg": 105.0,
    "ratios": {"당뇨": 0.9, "고혈압": 0.8, ...},
    "five_year_improved": {...},
    "will_rogers": {
      "당뇨": {
        "orig_ratio": 1.8, "improved_ratio": 0.9,
        "orig_rank": 58, "improved_rank": 28,
        "rank_change": 30, "arr_pct": 50.0,
        "cohort_fixed": true
      },
      ... (16 질환 동일 구조)
    },
    "has_improvement": true
  },

  "disease_ages": {"알츠": ..., "뇌혈관": ..., "심혈관": ..., ...},

  "patient_info": {
    "imputed_fields": [...], "missing_fields": [...]
  }
}
```

### 커버리지 체크
| 투비콘 섹션 | mediArc 엔진 대응 | 상태 |
|---|---|---|
| 건강나이 | `bodyage` | ✅ |
| 건강등수 | `rank` | ✅ |
| 질환별 N배 + 등수 | `diseases[N].ratio / rank` | ✅ |
| 위험인자 칩 | `diseases[N].chips` | ✅ |
| 5년 예측 | `diseases[N].five_year` | ✅ |
| **Before/After 시뮬레이션** | `diseases[N].improved_*` + `improved.ratios` | ✅ **엔진엔 있음, FE 미노출** |
| 윌로저스 방지 (cohort 고정 + ARR) | `improved.will_rogers[N]` | ✅ **엔진엔 있음, FE 미노출** |
| 맞춤 영양 추천 + 주의 | `nutrition.recommend / caution` | ✅ |
| 참고문헌 (논문) | `diseases[N].applied_factors[].pmid/source` | ✅ (PMID 84/87) |
| 장기별 건강나이 | `disease_ages` | ✅ |
| 검진 수치 게이지 | `gauges` | ✅ |
| 1인당 연간 진료비 시계열 | ❌ | 엔진 범위 아님 (별건 자료) |
| 코호트 유병률 도넛 | `diseases[N].cohort_mean_rr` 간접 | ⚠️ 시각화 필요 |
| 개인화 멘트 | ❌ | **AI 한 줄 요약 별도 구성 필요** (Haiku) |

### 미구현 기능 (NEXT_STEPS.md)
| 기능 | 상태 |
|---|---|
| 코호트 분모 정확도 48% → 80% | 🔴 미착수 (HIRA opendata 필요) |
| bioage_gb numpy pkl 재학습 | 🟠 null fallback 동작 중 |
| **What-If 동적 슬라이더** (사용자 입력 → 실시간) | 🟠 고정 시나리오만 구현, 동적 미구현 |
| 마일스톤 푸시 (금연 7일/체중 2kg 등) | 🔴 설계만 |
| 시계열 추적 (N회 검진 축적 비교) | 🔴 설계만 |
| PDF 렌더링 | 🔴 JSON 만 반환, PDF 미구현 |

---

## 4. "미션 설정 기능" 진단 — 왜 안 보이는가

### 결론: 엔진 → FE 3-layer 중계 차단됨

```
[mediArc 엔진]                   [WELNO BE facade.py]              [백오피스 Drawer]
Report.run() 반환:               generate_report() 가공:            useMediarcApi.ts:
  - improved ← ⭕                  - bodyage ✅                       - ReportData.improved ❌
  - will_rogers ← ⭕               - rank ✅                          - ReportData.will_rogers ❌
  - improved_ratio etc ← ⭕        - diseases ✅                      - 개선 후 UI ❌
                                   - nutrition ✅                     (엔진에 있는 필드 80%+ 만 노출)
                                   - improved ❌ drop
                                   - disease_ages ❌ drop
                                   - will_rogers ❌ drop
```

### 원인
- `services/report_engine/facade.py:generate_report()` 가 `run_for_patient()` 원본 raw 중 일부만 pick 해서 반환
- FE `useMediarcApi.ts ReportData` 타입에 `improved` / `will_rogers` 필드 없음
- `HealthReportPage/index.tsx` Drawer 컨텐츠에 Before/After 렌더 영역 없음

### 해결 방향
1. `facade.py:generate_report()` 반환에 `improved` + `disease_ages` + 질환별 `improved_*` 필드 포함 (grand total ~3 lines)
2. FE `ReportData` 타입에 `ImprovedScenario` 추가
3. Drawer 질환별 카드에 "현재 / 개선 후" 2열 표시 + 전체 Before/After 요약 카드

**엔진 수정 0줄. 중계·뷰만 추가.**

---

## 5. 윌로저스 현상 — 자료 정리

### 개념 (IMPROVEMENT_LOG.md L90-94 원문)
> - 문제: 금연하면 비흡연자 그룹으로 이동 → 그 그룹 내 등수 낮음 → "노력해도 안 변해요"
> - 비유: 보통반 80점 → 우등반 이동 → 우등반에서 꼴찌 (점수는 그대로인데 등수 하락)
> - 해결: 기준 코호트 고정 + ARR(절대 위험도 감소율) 동시 표시
> - 출처: Feinstein 1985 NEJM, PMID 4000199

### mediArc 방식 (phase3_patient_motivation_strategy L192-205 원문)
```
⚠️ 기존 방식의 함정:
  금연 전: 흡연자 그룹에서 58등
  금연 후: 비흡연자 그룹에서 55등 ← "3등밖에 안 올랐네?"

✅ mediArc 방식:
  금연 전: 전체 그룹에서 58등 (기준 고정)
  금연 후: 같은 그룹에서 32등 ← "26등이나 올랐다!"

  + 절대 감소율도 표시:
  "당뇨 위험 절대값 17.7 → 12.8 (28% 감소)"
```

### 엔진 구현 (engine.py:L1228-1254 주석+코드)
```python
# ── 윌 로저스 방지 (Feinstein 1985 PMID 4000199) ──
# 핵심: 개선 후에도 원래 코호트(흡연자 포함) 기준으로 비교
# 기존 문제: 금연 → 비흡연자 그룹 이동 → 등수 안 변함
# 해결: cohort_mean은 개선 전 값 고정 + ARR 동시 계산
arr_pct = round((orig_ratio - improved_ratio) / orig_ratio * 100, 1)
will_rogers[d] = {
    "orig_ratio": orig_ratio, "improved_ratio": improved_ratio,
    "orig_rank": orig_rank,   "improved_rank": improved_rank,
    "rank_change": rank_change,
    "arr_pct": arr_pct,
    "cohort_fixed": True,
}
```

### UI 에서 반드시 보여야 할 3요소
1. **원본 등수 vs 개선 등수** — "58등 → 32등 (26등 ↑)"
2. **상대비 vs 절대 감소** — "1.8배 → 0.9배 (50% 감소)"
3. **기준 코호트 명시** — "같은 그룹(흡연자 포함) 기준" 작은 캡션

### 미해결: dual cohort
- 현재 코호트 하나(datalake)만 사용
- 설계서는 datalake vs national 이중 제공 권장 (Sprint 1)
- 미구현 이유: HIRA opendata 미확보

---

## 6. 리포트 뷰 제안 구조 (Drawer 내 1장)

### 레이아웃 — 투비콘 참조 + 운영자 뷰 최적화

```
┌──────────────────────────────────────────────────────────┐
│ [Drawer 헤더]                                             │
│ 김도현 · 43세 · M · 코호트 40M                           │
├──────────────────────────────────────────────────────────┤
│ 🎯 요약 블록                                              │
│ ┌────────────┬────────────┬────────────┬────────────┐   │
│ │ 건강나이   │ 등수       │ Twobecon   │ AI 요약    │   │
│ │ 36.9세     │ 30등       │ 42세 / 15등│ "간수치 우수│   │
│ │ -6.1 ↓     │ 상위 30%   │ (비교)     │ ..."       │   │
│ └────────────┴────────────┴────────────┴────────────┘   │
├──────────────────────────────────────────────────────────┤
│ 🏥 16 질환 그리드 (4×4)                                   │
│ ┌──────────┬──────────┬──────────┬──────────┐          │
│ │ 당뇨     │ 고혈압   │ 심혈관   │ ... 16개  │          │
│ │ 0.2배    │ 0.8배    │ 0.6배    │          │          │
│ │ 1등 정상 │ 35등 경계│ 28등 정상│          │          │
│ │ ─────    │ ─────    │ ─────    │          │          │
│ │ 개선 후:  │ 개선 후:  │ 개선 후:  │          │          │
│ │ 0.15배   │ 0.7배    │ 0.5배    │          │          │
│ │ ↑ 상승없음│ +8등     │ +5등     │          │          │
│ │ 50% ↓    │ 13% ↓    │ 17% ↓    │          │          │
│ └──────────┴──────────┴──────────┴──────────┘          │
│ 클릭 시 질환 상세 모달: applied_factors + 5년 예측       │
├──────────────────────────────────────────────────────────┤
│ 📊 Before / After 종합 시뮬레이션                         │
│                                                           │
│ 현재 상태                    개선 후 (금연/금주/BMI<23)   │
│ ─────────────────────       ─────────────────────         │
│ 건강나이 36.9세             건강나이 34.2세 (-2.7)        │
│ 고혈압  1.2배  35등         고혈압  0.8배  27등 (+8)      │
│ 당뇨    0.2배   1등         당뇨    0.15배  1등 (-)      │
│ ...                                                        │
│                                                           │
│ ⓘ 같은 코호트(흡연자 포함) 기준 등수 — 윌로저스 방지       │
├──────────────────────────────────────────────────────────┤
│ 🧬 신체 부위별 건강나이                                   │
│ 뇌 ●────────● 40.2세   심장 ●───────● 38.5세            │
│ 신장 ●──────● 37.8세   간 ●────────● 36.9세             │
├──────────────────────────────────────────────────────────┤
│ 💊 맞춤 영양                                              │
│ 추천: 오메가3 · CoQ10 · 밀크씨슬                          │
│ 주의: 카페인 · 고염 · 알코올                              │
├──────────────────────────────────────────────────────────┤
│ 🩺 검진 수치 게이지 (접이식)                              │
│ BMI · 혈압 · 혈당 · 콜레스테롤 · ...                      │
├──────────────────────────────────────────────────────────┤
│ 📚 참고문헌 (PMID)                                        │
│ 질환별 applied_factors 펼치면 원 PMID 링크                │
└──────────────────────────────────────────────────────────┘
```

### Drawer 폭: `width="xl"` (1024px) 권장
- 현재 `lg` (720px) 는 그리드 4열 부담
- `xl` (1024) 로 확장 시 4열 x 3행 여유

---

## 7. 구현 계획 (Phase 별)

### Phase 0 — 중계 레이어 복구 (0.5일) ⭐ 최우선
| 작업 | 파일 |
|---|---|
| facade.py generate_report 에 `improved`, `disease_ages`, 질환별 `improved_*` 필드 포함 | `services/report_engine/facade.py` |
| FE `ReportData` 타입에 `ImprovedScenario` 추가 | `useMediarcApi.ts` |
| 기존 Drawer 컨텐츠 레벨에서 안 깨지게 graceful | `HealthReportPage/index.tsx` |

### Phase 1 — 리포트 뷰 컴포넌트 신규 (2-3일)
| 작업 | 파일 |
|---|---|
| `ReportView` 컴포넌트 신규 (위 6장 레이아웃) | `HealthReportPage/components/ReportView.tsx` |
| 질환 그리드 `DiseaseGrid` + 카드 `DiseaseCard` | 하위 |
| Before/After 시뮬레이션 `ComparisonBlock` | 하위 |
| 신체 부위별 건강나이 `BodyAgeChart` | 하위 |
| 영양 `NutritionBlock` | 하위 |
| 검진 수치 게이지 `GaugeBlock` | 하위 (기존 로직 재활용) |
| Drawer 안에 `<ReportView data={report} />` 교체 | `index.tsx` |
| Drawer width "lg" → "xl" | |

### Phase 2 — 자동 AI 요약 (0.5일, 선택)
- facade.py 에 Claude Haiku 호출 (1줄 요약 생성, 캐시)
- 리포트 헤더에 표시

### Phase 3 — What-If 슬라이더 (장기, Sprint 3)
- 엔진 `recalculate_with_behavior_change(input, behavior_changes)` 신규 구현
- FE 슬라이더 컴포넌트
- 실시간 재계산 (debounce 500ms)

### Phase 4 — PDF 렌더링 (선택, Sprint 4)
- HTML 템플릿 + Puppeteer PDF → ncloudstorage
- `report_url` 추가 반환

---

## 8. 기본 수정 (5장 관련) — 엔진 로직 검토 결과

하비가 "로직이나 수정" 물어봤음 — 엔진 자체는 최근 5건 개선 완료 (IMPROVEMENT_LOG.md):

| # | 개선 | 날짜 |
|---|---|---|
| 1 | 곱셈 → 로그-선형 코호트 (Rothman PMID 18212285) | 2026-04-11 |
| 2 | MetS-BMI 순환논리 제거 → ATP III 5 기준 | 2026-04-11 |
| 3 | Gompertz α 16질환 한국 실측 재피팅 (KCCR PMID 40083085) | 2026-04-10 |
| 4 | PMID 환각 4건 추가 발견·수정 | 2026-04-12 |
| 5 | WELNO BE 이식 | 2026-04-14 |

**현재 알려진 제약**
- 골든셋 적중률 48% (투비콘 vs mediArc 구조 차이)
- bioage_gb null (numpy mismatch)
- dual cohort 미완
- What-If 슬라이더 동적 재계산 미구현

**엔진 로직 자체는 최신이고, 로직 수정 필요 없음**. 코호트 정확도는 HIRA opendata 확보 + 재검증 필요 (Sprint 1).

---

## 9. 하비 확인 필요

### Q1. Phase 0 + 1 바로 진행할지
- Phase 0 (중계 복구) + Phase 1 (리포트 뷰 컴포넌트) = **2.5-3.5일**
- 현재 백오피스 Drawer 를 **mediArc 리포트 1장** 으로 완전 교체

### Q2. 기존 4 서브탭 구조 처리
- 현재 Drawer 안: 질환예측 / 검진수치 / 영양추천 / 투비콘 비교 4탭
- 리포트 뷰로 통합 시 4탭 **제거** (모두 리포트 안에 녹임)
- 또는 "리포트 / Twobecon 비교" 2탭만 유지

### Q3. AI 한 줄 요약 포함 여부 (Phase 2)
- Claude Haiku 월 $5~10 비용
- "이 환자는 간수치 우수, 대사증후군 경계 — 금주+BMI 감량 시 5년 위험 50% ↓" 자동 생성

### Q4. Drawer 폭 확대
- `lg` (720px) → `xl` (1024px) 권장
- 모바일/태블릿 responsive 대응 필요

### Q5. What-If 동적 슬라이더 우선순위
- Phase 3 (Sprint 3, 4주 후)
- Phase 0+1 완료 후 운영자 피드백 보고 결정

---

## 10. 참조 파일

| 종류 | 경로 |
|---|---|
| 엔진 본체 | `PEERNINE/p9_mediArc_engine/demo/engine.py:L1156-1265` (compute_improved_scenario) |
| 개선 이력 | `PEERNINE/p9_mediArc_engine/IMPROVEMENT_LOG.md:L90-94` (윌로저스 섹션) |
| 설계서 | `PEERNINE/p9_mediArc_engine/phase3_our_design/02_mediarc_engine_spec.md:L62-186` |
| 동기 전략 | `PEERNINE/p9_mediArc_engine/phase3_our_design/05_patient_motivation_strategy.md:L166-205` |
| 다음 단계 | `PEERNINE/p9_mediArc_engine/NEXT_STEPS.md` + `TODO_NEXT_SESSION.md` |
| WELNO 이식본 | `PROJECT_WELNO_BEFE/planning-platform/backend/app/services/report_engine/facade.py` |
| 백오피스 FE | `PROJECT_WELNO_BEFE/planning-platform/backoffice/src/pages/HealthReportPage/` |
| 투비콘 레퍼런스 | `PEERNINE/p9_mediArc_engine/samples/윤철주_e5d656aa.pdf` (23p) |

*작성: 2026-04-15 / 승인 대기*
