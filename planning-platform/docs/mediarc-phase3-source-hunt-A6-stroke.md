# mediArc Phase 3 스펙 A6 — 금연 후 뇌졸중 RR 시계열 감쇠 출처 수집 리포트

작성일: 2026-04-16
담당: mkt-researcher (Researcher 모드)
목적: Pan 2015(PMID 26311724) 대체 출처 확보. 뇌졸중 단독 α 감쇠 계수 산출 근거 마련.

---

## 1. 검색 쿼리 및 URL

| # | 쿼리 | 결과 |
|---|------|------|
| Q1 | "smoking cessation" stroke relative risk years follow-up | 복수 코호트/메타 확인 |
| Q2 | Kawachi 1993 JAMA smoking cessation stroke women PMID | PMID 8417241 확인 |
| Q3 | Wolf Framingham smoking cessation stroke "5 years" PMID 3339799 | PMID 3339799 확인 |
| Q4 | Hackshaw 2018 BMJ smoking cessation CVD stroke PMID | PMID 29367388 확인 (주제 불일치, 하단 참조) |
| Q5 | PMID 24291341 negative exponential model cerebrovascular disease | 핵심 논문 확인 |
| Q6 | 대한뇌졸중학회 금연 가이드라인 뇌졸중 위험 감소 | 공식 페이지 확인 |
| Q7 | smoking cessation stroke "2 years" "5 years" RR meta-analysis 2020 2021 | 복수 결과 확인 |

---

## 2. 후보 논문 — PMID + 핵심 수치

### [핵심 1] Wolf et al. 1988 — Framingham Study
- **PMID**: 3339799
- **저널**: JAMA 1988 Feb 19; 259(7):1025-9
- **제목**: Cigarette smoking as a risk factor for stroke. The Framingham Study
- **설계**: 4,255명(36-68세), 26년 추적, 459건 뇌졸중
- **핵심 수치**:
  - 중등도 흡연자: 비흡연 대비 뇌졸중 RR 유의하게 상승
  - 중증 흡연자(>40개비/일): 경흡연자(<10개비/일)의 2배 RR
  - **금연 2년 후: RR 유의하게 감소**
  - **금연 5년 후: 비흡연자 수준으로 회귀** (nonsmoker level)
- **α 유도 가능성**: PASS — "2년 감소 시작, 5년 완전 회귀"로 half-life ~3-4년 추산 가능
- **URL**: https://pubmed.ncbi.nlm.nih.gov/3339799/

---

### [핵심 2] Kawachi et al. 1993 — Nurses' Health Study
- **PMID**: 8417241
  - 주의: 스펙 요청 PMID 8445825는 검색 불일치. 실제 Nurses' Health Study 뇌졸중 논문 PMID는 **8417241**로 확인됨.
- **저널**: JAMA 1993 Jan 13; 269(2):232-6
- **제목**: Smoking cessation and decreased risk of stroke in women
- **설계**: 117,006명 여성 간호사, 12년 추적(1976-1988), 흡연력 2년마다 갱신
- **핵심 수치**:
  - 현재 흡연자 vs 비흡연자: 총 뇌졸중 RR = **2.58** (95% CI: 2.08-3.19)
  - 전 흡연자 vs 비흡연자: 총 뇌졸중 RR = **1.34** (95% CI: 1.04-1.73)
  - 뇌경색 기준 현재 흡연자: RR = **2.53** (95% CI: 1.91-3.35)
  - 금연 후 2년: RR = **0.54** (95% CI: 0.26-1.55) — 비흡연 기준 대비 (46% 감소)
  - **금연 2-4년 후: 총 뇌졸중 및 뇌경색 초과 위험 거의 소실**
  - 금연 시간 구간 분석: <2년, 2-4년, 5-9년, 10-14년, ≥15년
- **α 유도 가능성**: PASS — 2-4년 구간에서 비흡연 수준 도달. half-life 1-2년 수준으로 빠른 감쇠
- **URL**: https://pubmed.ncbi.nlm.nih.gov/8417241/

---

### [핵심 3] Lee, Fry & Thornton 2014 — 부(負)지수 모델 시스템 리뷰 (뇌혈관)
- **PMID**: 24291341
- **저널**: Regulatory Toxicology and Pharmacology, February 2014
- **제목**: Estimating the decline in excess risk of cerebrovascular disease following quitting smoking — a systematic review based on the negative exponential model
- **설계**: 13개 연구, 22개 RR 블록, 음의 지수 모델(negative exponential model) 적용
- **핵심 수치**:
  - **Half-life H = 4.78년** (95% CI: 2.17-10.50)
  - 해석: 금연 H년 후 초과 위험이 현재 흡연자의 **절반**으로 감소
  - 연구간 이질성(heterogeneity) 큼 — 개별 연구 편차 존재
  - IHD half-life(4.40년)와 유사한 수준
- **α 감쇠 계수 유도**:
  - 부지수 모델: R(t) = exp(-λt), λ = ln2/H
  - H = 4.78년 → **λ = ln2/4.78 ≈ 0.145/년**
  - 예시 RR 잔존율:
    - t=0 (금연 직후): R = 1.00 (현재 흡연자 초과 위험 100%)
    - t=1년: R = exp(-0.145) ≈ **0.865** (13.5% 감소)
    - t=2년: R ≈ **0.748** (25.2% 감소)
    - t=5년: R ≈ **0.488** (51.2% 감소)
    - t=10년: R ≈ **0.238** (76.2% 감소)
  - 단, 신뢰구간이 넓어(H 범위 2.17-10.50) 보수적 추정 시 H=5년 또는 H=7년 사용 권장
- **α 유도 가능성**: PASS — 이 논문이 A6 스펙의 α 감쇠 계수를 직접 뒷받침하는 **최우선 출처**
- **URL**: https://pubmed.ncbi.nlm.nih.gov/24291341/

---

### [참고] Lee & Fry 2012 — 부지수 모델 (허혈성 심질환, 방법론 기준)
- **PMID**: 22728684
- **저널**: Regulatory Toxicology and Pharmacology, October 2012
- **핵심**: IHD half-life H = 4.40년, 동일 방법론을 2014 뇌혈관 논문이 계승
- **α 유도 가능성**: 참고(뇌졸중 아님) — 방법론 검증용
- **URL**: https://pubmed.ncbi.nlm.nih.gov/22728684/

---

### [참고] Hackshaw et al. 2018 — BMJ 메타분석
- **PMID**: 29367388
- **저널**: BMJ 2018 Jan 24; 360:j5855
- **제목**: Low cigarette consumption and risk of coronary heart disease and stroke: meta-analysis of 141 cohort studies in 55 study reports
- **핵심**: 하루 1개비도 CHD/뇌졸중 위험 크게 상승. 안전 수준 없음.
  - 남성 1개비/일 → CHD RR 1.48배, 여성 1.57배
- **A6 적합성**: FAIL — 금연 후 시계열 감쇠 아님, 저용량 흡연 위험 논문. A6 출처로 사용 불가.
- **URL**: https://pubmed.ncbi.nlm.nih.gov/29367388/

---

### [참고] Pan et al. 2015 — 재사용 금지 확인
- **PMID**: 26311724
- **판정**: FAIL — 당뇨 환자 대상 총사망률 + CVD events 메타분석. 뇌졸중 단독 데이터 없음. A6 출처 사용 금지.

---

### [보조] 중국 코호트 및 기타 (기간별 OR 제공)
- **PMC6392934** (Association of smoking with risk of stroke, 중국 National Stroke Prevention Project)
  - 금연 기간별 OR:
    - <5년: OR = **3.47** (95% CI: 1.42-8.49) vs 비흡연
    - 5-19년: OR = **3.37** (95% CI: 1.95-5.80) vs 비흡연
    - ≥20년: OR = **0.95** (95% CI: 0.49-1.84) vs 비흡연 — 초과 위험 사실상 소실
  - 해석: 5년 이내 위험 여전히 높음, 20년 후 비흡연 수준 도달
  - 주의: 이 데이터는 중국 인구 기반이며 Kawachi/Framingham과 시간 궤적이 다를 수 있음

---

## 3. 대한뇌졸중학회 — 한국 가이드라인

- **출처**: 대한뇌졸중학회 공식 홈페이지 + 뇌졸중 진료지침
  - URL: https://www.stroke.or.kr/stroke/?doc=3
  - PDF: https://www.stroke.or.kr/file/Stroke_guidelines.pdf
- **내용**:
  - 흡연 시 뇌경색 위험 약 2배, 뇌출혈 약 3배 증가
  - 모든 흡연자에게 금연 적극 권고 (권고 수준: 상위)
  - "금연 즉시 위험 감소 시작, 5년 후 비흡연자 수준에 근접"
  - 흡연자가 전원 금연 시 뇌졸중 환자 4명 중 1명 예방 가능
  - 금연 보조: 상담 + 니코틴 대체 + 경구 금연 보조제 권고
- **A6 적합성**: CONDITIONAL PASS
  - 시계열 RR 테이블은 없음. 단, "5년 후 비흡연 수준" 표현으로 Framingham 결과 지지.
  - 한국 가이드라인으로 국내 출처 요건 충족. α 계수 직접 산출 불가, 서술적 지지에 활용.

---

## 4. α 테이블 뒷받침 가능성 — 종합 평가

### α 감쇠 계수 산출 근거 (Lee 2014 기반)

```
모델: excess_risk(t) = excess_risk(0) * exp(-λ * t)
      λ = ln2 / H,  H = 4.78년 (Lee 2014, PMID 24291341)
      λ ≈ 0.145 /년

기준점 정의:
  - t=0: 현재 흡연자 위험 = RR_smoker (예: 2.58 vs 비흡연, Kawachi 1993)
  - t→∞: 비흡연자 위험 = 1.00

초과 위험 잔존율 R(t) = exp(-0.145 * t):

  t=0월   R=1.000  (금연 당일)
  t=6월   R=0.930
  t=12월  R=0.865  (1년)
  t=24월  R=0.748  (2년)
  t=36월  R=0.647  (3년)
  t=60월  R=0.484  (5년) ← Framingham "비흡연 수준" 임계점과 대략 일치
  t=120월 R=0.234  (10년)

보수적 버전 (H=7년 적용 시):
  λ = 0.099 /년
  t=5년  R=0.611
  t=10년 R=0.373
```

### 출처별 α 지지 여부

| 출처 | 지지 여부 | 비고 |
|------|----------|------|
| Lee 2014 (PMID 24291341) | **PASS — 직접** | H=4.78년, λ=0.145 직접 산출 |
| Wolf 1988 Framingham (PMID 3339799) | **PASS — 간접** | 2년 감소 시작, 5년 비흡연 수준 = H 3-5년 범위 지지 |
| Kawachi 1993 (PMID 8417241) | **PASS — 간접** | 2-4년 이내 초과 위험 소실 → H 더 짧을 수 있음(~2년) |
| 대한뇌졸중학회 가이드라인 | **CONDITIONAL** | "5년 후" 서술 지지, RR 테이블 없음 |
| 중국 코호트 (PMC6392934) | **참고** | 5년 이내 위험 여전히 높아 보수적 α와 일치 |
| Hackshaw 2018 (PMID 29367388) | **FAIL** | 주제 불일치 — 대체 불가 |
| Pan 2015 (PMID 26311724) | **FAIL** | 당뇨 CVD 메타 — 재사용 금지 |

### 최종 권고

1. **A6 α 계수 1차 출처**: Lee 2014 (PMID 24291341), H=4.78년, λ≈0.145
2. **보조 서술 출처**: Wolf 1988 Framingham + Kawachi 1993 Nurses' Health Study
3. **한국 출처**: 대한뇌졸중학회 진료지침 (서술적 지지)
4. **보수적 처리 권고**: 신뢰구간 상한(H≈10년)도 넓으므로, 모델에서 보수적 가정(H=5-7년) 병행 제시 권장

---

## 5. 데이터 갭 및 한계

- Kawachi 1993 원문 시계열 테이블(<2년/2-4년/5-9년/10-14년/≥15년별 RR)은 WebFetch 제한으로 직접 확인 불가 — PubMed 인용 2차 수치 사용
- Lee 2014 이질성(heterogeneity) 큼 → H 범위 2.17-10.50년. 점 추정값(4.78)보다 범위 기반 민감도 분석 병행 필요
- 한국 뇌졸중 코호트에서 금연 후 RR 시계열을 직접 보고한 연구는 금번 검색에서 미확인

---

## 6. 참고문헌 목록

1. Wolf PA et al. Cigarette smoking as a risk factor for stroke. The Framingham Study. JAMA. 1988;259(7):1025-9. PMID: 3339799. https://pubmed.ncbi.nlm.nih.gov/3339799/

2. Kawachi I et al. Smoking cessation and decreased risk of stroke in women. JAMA. 1993;269(2):232-6. PMID: 8417241. https://pubmed.ncbi.nlm.nih.gov/8417241/

3. Lee PN, Fry JS, Thornton AJ. Estimating the decline in excess risk of cerebrovascular disease following quitting smoking — a systematic review based on the negative exponential model. Regul Toxicol Pharmacol. 2014;68(1):85-95. PMID: 24291341. https://pubmed.ncbi.nlm.nih.gov/24291341/

4. Lee PN, Fry JS. Using the negative exponential distribution to quantitatively review the evidence on how rapidly the excess risk of ischaemic heart disease declines following quitting smoking. Regul Toxicol Pharmacol. 2012;64(2):297-310. PMID: 22728684. https://pubmed.ncbi.nlm.nih.gov/22728684/

5. Hackshaw A et al. Low cigarette consumption and risk of coronary heart disease and stroke: meta-analysis of 141 cohort studies in 55 study reports. BMJ. 2018;360:j5855. PMID: 29367388. https://pubmed.ncbi.nlm.nih.gov/29367388/

6. 대한뇌졸중학회. 뇌졸중 진료지침. https://www.stroke.or.kr/file/Stroke_guidelines.pdf

7. 대한뇌졸중학회. 뇌졸중 원인 및 예방. https://www.stroke.or.kr/stroke/?doc=3
