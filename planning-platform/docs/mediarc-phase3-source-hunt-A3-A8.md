# mediArc Phase 3 스펙 A3 + A8 — 인용 출처 수집 리포트

작성일: 2026-04-16
목적: 스펙 내 "Rothman KJ 2008 Modern Epidemiology" 인용이 실제로는 책(PMID 없음)임을 확인하고,
      A3(piecewise log cohort normalization)·A8(synergy index) 각각의 검증 가능한 출처를 수집한다.

---

## 배경: 스펙 인용 오류 정정

| 항목 | 스펙 내 인용 | 실제 |
|------|------------|------|
| "Rothman KJ 2008" PMID 18212285 | PMID 18212285는 D'Agostino et al. Circulation 2008 (무관 논문) | Rothman *Modern Epidemiology* 3rd ed.는 **책** — PMID 없음 |

---

## 책 인용 (Rothman Modern Epidemiology 3rd ed.)

**정식 인용:**
> Rothman KJ, Greenland S, Lash TL. *Modern Epidemiology*, 3rd ed.
> Philadelphia: Lippincott Williams & Wilkins (Wolters Kluwer Health), 2008.
> ISBN-13: **978-0-7817-5564-1** (hardcover)
> WorldCat OCLC: 169455558
> 총 758 pp.

**확인 경로:**
- Amazon: https://www.amazon.com/Modern-Epidemiology-Kenneth-J-Rothman/dp/0781755646
- WorldCat: https://search.worldcat.org/title/Modern-epidemiology/oclc/169455558

**주의:** 이 책에는 PMID가 없다. 스펙 또는 논문에서 PMID를 부여해 인용하는 것은 오류다.

---

## A3 — Piecewise Log-Linear Cohort Normalization (연령-코호트 표준화)

### 개념 요약
코호트(출생연도)별 사망/발생률을 log-선형 구간별(piecewise) 모형으로 분리해 연령 효과를 표준화하는 방법론. Age-Period-Cohort(APC) 분석의 핵심 도구.

### 검증된 출처 목록

#### 1. Clayton D, Schifflers E (1987) — Part I: Age-period and age-cohort models
- 제목: "Models for temporal variation in cancer rates. I: Age–period and age–cohort models"
- 저널: Statistics in Medicine, Vol. 6, No. 4, pp. 449–467
- 연도: 1987
- **PMID: 3629047**
- DOI: 10.1002/sim.4780060405
- PubMed: https://pubmed.ncbi.nlm.nih.gov/3629047/
- PDF(공개): https://bendixcarstensen.com/APC/ClaytonSchifflers.1987.pdf

#### 2. Clayton D, Schifflers E (1987) — Part II: Age-period-cohort models
- 제목: "Models for temporal variation in cancer rates. II: Age-period-cohort models"
- 저널: Statistics in Medicine, Vol. 6, No. 4, pp. 469–481
- 연도: 1987
- **PMID: 3629048**
- DOI: 10.1002/sim.4780060406
- PubMed: https://pubmed.ncbi.nlm.nih.gov/3629048/

#### 3. Holford TR (1983) — piecewise log-linear APC 정초 논문
- 제목: "The estimation of age, period and cohort effects for vital rates"
- 저널: Biometrics, Vol. 39, No. 2, pp. 311–324
- 연도: 1983
- **PMID: 6626659**
- PubMed: https://pubmed.ncbi.nlm.nih.gov/6626659/
- PDF(공개): http://faculty.washington.edu/jonno/APCmaterial/holford83.pdf

#### 4. Breslow NE, Day NE (1987) — IARC 코호트 연구 방법론 표준
- 제목: *Statistical Methods in Cancer Research. Volume II: The Design and Analysis of Cohort Studies*
- 발행: IARC Scientific Publications No. 82
- 출판: International Agency for Research on Cancer, Lyon, 1987
- **PMID: 3329634** (PubMed indexed)
- PubMed: https://pubmed.ncbi.nlm.nih.gov/3329634/
- IARC: https://publications.iarc.fr/Book-And-Report-Series/Iarc-Scientific-Publications/Statistical-Methods-In-Cancer-Research-Volume-II-The-Design-And-Analysis-Of-Cohort-Studies-1986
- 관련 챕터: Chapter 2 "Rates and Rate Standardization"

### A3 권장 인용 순서
1. Holford 1983 (PMID 6626659) — log-linear APC 기초
2. Clayton & Schifflers 1987 Part I (PMID 3629047) — age-cohort 분리 모형
3. Clayton & Schifflers 1987 Part II (PMID 3629048) — 완전 APC 모형
4. Breslow & Day 1987 (PMID 3329634) — 코호트 연령표준화 실무
5. Rothman et al. 2008 (책, ISBN 978-0-7817-5564-1) — 방법론 원리 서술

---

## A8 — Synergy Index (시너지 지수, 상가모형 상호작용)

### 개념 요약
두 위험인자의 결합효과가 상가모형(additive model)에서 기대치를 초과하는지 측정.
Rothman이 정의한 3대 척도: RERI (Relative Excess Risk due to Interaction), AP (Attributable Proportion), S (Synergy Index).

시너지 지수(S) 정의:
> S = (RR₁₁ − 1) / [(RR₁₀ − 1) + (RR₀₁ − 1)]
> S = 1: 상가성 (no interaction)  /  S > 1: 양의 상호작용  /  S < 1: 음의 상호작용

### 검증된 출처 목록

#### 1. Rothman KJ (1976) — 시너지 지수 원형 제안 논문 [1차 출처]
- 제목: "The estimation of synergy or antagonism"
- 저널: American Journal of Epidemiology, Vol. 103, No. 5, pp. 506–511
- 연도: May 1976
- **PMID: 1274952**
- DOI: 10.1093/oxfordjournals.aje.a112252
- PubMed: https://pubmed.ncbi.nlm.nih.gov/1274952/
- Oxford Academic: https://academic.oup.com/aje/article-abstract/103/5/506/119867

#### 2. Rothman KJ, Greenland S, Lash TL (2008) — 교과서 정의 [2차 출처]
- 책: *Modern Epidemiology*, 3rd ed.
- 출판: Lippincott Williams & Wilkins, Philadelphia, 2008
- ISBN-13: 978-0-7817-5564-1
- 관련 챕터: Chapter 5 "Measures of Effect and Measures of Association" 및 Chapter 18 "Interaction"
- PMID 없음 — 책으로 인용

#### 선행 논문 (맥락 참고)
- Rothman KJ (1974) "Synergy and antagonism in cause-effect relationships" *AJE* Vol. 99, No. 6, pp. 385–388. PMID: 4841816. PubMed: https://pubmed.ncbi.nlm.nih.gov/4841816/

### A8 권장 인용 순서
1. Rothman KJ 1976 (PMID 1274952) — 시너지 지수 원형, 1차 출처
2. Rothman KJ 1974 (PMID 4841816) — 상가적 상호작용 개념 정초
3. Rothman et al. 2008 (책, ISBN 978-0-7817-5564-1) — 교과서 정의

---

## 결론 및 적용 지침

| 스펙 항목 | 올바른 1차 출처 | PMID | 비고 |
|----------|--------------|------|------|
| A3 piecewise log cohort | Holford 1983 + Clayton & Schifflers 1987 | 6626659 / 3629047 / 3629048 | 3편 병기 권장 |
| A8 synergy index | Rothman KJ 1976 AJE | **1274952** | 기존 스펙 PMID 18212285는 오류 |
| 책 공통 | Rothman et al. *Modern Epidemiology* 3rd ed. 2008 | 없음 (책) | ISBN 978-0-7817-5564-1 |

**PMID 18212285 (D'Agostino Circulation 2008)는 A3/A8과 무관. 스펙에서 삭제 필요.**
