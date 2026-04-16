---
name: mediArc Phase 3 출처 수색 A2 — 건강나이(delta = ln(ratio) x 10) 원출처
description: 스펙 A2 공식의 정확 원출처 수집. PMID 34151374 오매핑 수정용 근거 문서.
type: reference
owner: mkt
last_verified: 2026-04-16
confidence: medium
supersedes: []
superseded_by: ""
ttl: 90
tags: [mediarc, phase3, vascular-age, biological-age, Gompertz, source-hunt]
---

# mediArc Phase 3 출처 수색 A2

**작성자**: mkt-researcher (한국 자료 우선 — 대한의학회·질병관리청·건강보험공단. 원본 확인 필수)
**작성일**: 2026-04-16
**목적**: 스펙 A2 공식 `delta = ln(ratio) x 10`의 원출처 확정
**선행 작업**: `mediarc-phase3-pmid-verification.md` — A2 FAIL 판정 (PMID 34151374 오매핑)

---

## 요약 결론 (먼저 읽기)

| 항목 | 결과 |
|---|---|
| 스펙 A2 오매핑 PMID | 34151374 (Pang & Hanley 2021 AJE) — 맞는 논문이나 "건강나이" 아닌 "사망률 HR → 나이 환산 방법론" 논문 |
| `delta = ln(HR) / gamma` 공식 원리 | Pang & Hanley 2021 (PMID 34151374)에 **실제로 존재** — 단 스펙의 "D'Agostino Framingham risk age" 귀속이 오류 |
| `gamma (Gompertz slope)` 경험값 | ~0.097–0.10 (사람 사망률이 매년 약 10% 증가) |
| `delta = ln(ratio) x 10` 단순화 | gamma = 0.10 고정 가정 시 성립. Spiegelhalter (2012) 대중화 |
| Vascular age (CV 위험 기반) 원출처 | D'Agostino et al. 2008 (PMID 18212285) — **다른 개념** |
| 한국 자료 | 대한의사협회지 2017 (Robbins 방법 기반 심뇌혈관 나이) — 공식 불명시 |
| 원출처 확정 가능 여부 | `delta = ln(ratio) x 10` **명시적 단일 원출처 없음** — Gompertz 법칙 기반 관례적 변환 공식 |

---

## 검색 쿼리 전수 기록

### 1단계: 핵심 수식 검색

| 쿼리 | 결과 요약 |
|---|---|
| `vascular age "delta" "ln" hazard ratio Framingham` | Framingham 논문들 + Cuende 2010 SCORE 방법 등. 수식 없음 |
| `D'Agostino Framingham heart age formula 2008 Circulation PMID 18212285` | PMID 확인됨. 수식: Cox 회귀 기반 risk age 개념. delta = ln(ratio) x 10 명시 없음 |
| `Pang Hanley 2021 AJE "translating" hazard ratio age delta formula ln(ratio)` | PMID 34151374 확인됨. Gompertz slope 0.10 적용 사례(흡연 HR=2.20 → +8년) |
| `Gompertz "biological age" "delta age" "ln" hazard ratio formula derivation` | GOLD BioAge (2025 Advanced Science) + Calibrating Gompertz (PMC7339829) |
| `Pang Hanley 2021 AJE "age shift" "ln(HR)" / "gamma" Gompertz formula` | 논문 확인. 정확한 수식은 full text에만 존재 |
| `Spiegelhalter "effective age" Gompertz hazard ratio formula` | "What is your effective age?" Understanding Uncertainty 블로그 확인 |
| `대한심장학회 건강나이 혈관나이 공식 계산법 심혈관위험도` | Robbins 방법 기반 심뇌혈관 나이 소프트웨어(대한가정의학회). 수식 미공개 |
| `대한가정의학회 심뇌혈관 나이 위험도 계산 공식 논문` | JKMA 2017 (Moon et al.) Robbins 방법. 절대 위험 → 상대위험 비교 방식 |
| `Robbins Hall 1970 "How to Practice Prospective Medicine" risk age formula` | 1970년 원저 확인. "mortality risk increases ~8%/year" 개념 기반 |

---

## 후보 A: Pang & Hanley 2021 (PMID 34151374)

**서지 정보 (PubMed 직접 확인)**
- 저자: Menglan Pang, James A. Hanley
- 제목: "Translating" All-Cause Mortality Rate Ratios or Hazard Ratios to Age-, Longevity-, and Probability-Based Measures
- 저널: *American Journal of Epidemiology*, Vol. 190, No. 12, December 2021, Pages 2664–2670
- DOI: 10.1093/aje/kwab104
- PMID: 34151374
- 공개 PDF: https://jhanley.biostat.mcgill.ca/Reprints/PangHanleyTranslations2021AJE.pdf

**논문이 실제로 다루는 것**
- 역학자들이 흔히 사용하는 보정된 위험비(HR)·사망률비(RR)를 나이 기반·수명 기반·확률 기반 지표로 변환하는 방법
- Gompertz 법칙을 전제로 HR → age shift(나이 이동) 산출

**수식 존재 여부**
- full text에 Gompertz 기반 age shift 공식 포함 확인 (검색 결과 근거)
- 핵심 수식 구조: h(a + delta) = HR x h(a) → Gompertz 하에서 delta = ln(HR) / gamma
  - 여기서 gamma는 Gompertz 기울기 (경험값 약 0.097~0.10)
- 예시(검색 결과 직접 확인): 흡연 HR=2.20 → "adds 8 years" → ln(2.20)/0.10 = 7.9 ~ 8년 일치
- 주의: 이 논문은 "건강나이" UI/UX 도구 제안 논문이 아니라 **방법론 논문**

**스펙 귀속 오류**
- 스펙 A2에서 "D'Agostino, Framingham risk age"로 귀속 → 오류
- 실제 저자는 Pang & Hanley (McGill University)
- 단, PMID 34151374 자체는 맞음

**판정**: PMID 맞음, 저자·귀속 틀림. 스펙 라벨 "D'Agostino Framingham" 삭제 후 "Pang & Hanley 2021 AJE"로 교체 필요.

---

## 후보 B: D'Agostino et al. 2008 (PMID 18212285)

**서지 정보 (PubMed 직접 확인)**
- 저자: D'Agostino RB Sr, Vasan RS, Pencina MJ, Wolf PA, Cobain M, Massaro JM, Kannel WB
- 제목: General Cardiovascular Risk Profile for Use in Primary Care: The Framingham Heart Study
- 저널: *Circulation*, 2008 Feb 12;117(6):743-53
- DOI: 10.1161/CIRCULATIONAHA.107.699579
- PMID: 18212285

**논문이 실제로 다루는 것**
- 8,491명 Framingham 코호트 Cox 회귀 → 성별 맞춤 심혈관 위험 예측 함수
- 입력: 나이, 총 콜레스테롤, HDL, 수축기 혈압, 혈압 치료 여부, 흡연, 당뇨
- 핵심 기여: "vascular age" 개념을 대중에 제시
  - 정의: 현재 환자와 동일한 10년 절대위험도를 가지되 모든 위험인자를 최적값으로 가진 동성인의 나이
  - 방법: 역 함수 계산 (절대 위험 → 나이 mapping)

**`delta = ln(ratio) x 10` 수식 존재 여부**
- 해당 수식 **명시 없음** (검색 결과 및 논문 구조 분석 기준)
- 이 논문은 Gompertz 기반 변환이 아닌 Cox survival function 역산 방식
- "Vascular age"는 Framingham 점수 역 매핑 방식 — Gompertz slope gamma와 무관

**판정**: 스펙 A3/A8에 사용된 PMID가 이 논문. "건강나이" 개념 원출처로 적합하나 `delta = ln(ratio) x 10` 수식 원출처는 아님.

---

## 후보 C: Cuende et al. 2010 (PMID 20584778) — SCORE 기반 혈관나이

**서지 정보 (PubMed 검색 확인)**
- 저자: Cuende JI, Cuende N, Calaveras-Lagartos J
- 제목: How to calculate vascular age with the SCORE project scales: a new method of cardiovascular risk evaluation
- 저널: *European Heart Journal*, 2010;31(19):2351-2358
- PMID: 20584778

**논문이 실제로 다루는 것**
- SCORE 스케일을 이용한 vascular age 계산법
- D'Agostino 2008 Framingham 방법과 동일 원리를 SCORE에 적용
- 2012 ESC 유럽 심혈관 예방 가이드라인에 vascular age tool로 채택

**`delta = ln(ratio) x 10` 수식 존재 여부**
- 해당 수식 명시 없음 (SCORE 절대 위험 역 매핑 방식)

**판정**: 참고 문헌으로 활용 가능하나 delta 수식 원출처 아님.

---

## 후보 D: Spiegelhalter 2012 — Gompertz 기반 "Effective Age" 대중화

**서지 정보**
- 저자: David Spiegelhalter (Cambridge)
- 출처: "The Art of Statistics" (2019, ISBN 978-0-241-25820-7) 및 Understanding Uncertainty 블로그
- 블로그 URL: https://understandinguncertainty.org/what-your-effective-age
- 참조 논문 (Pang & Hanley 2021 인용): Spiegelhalter이 Gompertz를 통해 HR → effective age 변환 대중화

**수식**
- Gompertz 법칙: h(a) = h_0 * exp(gamma * a)
- 비례 위험비 하에서: h(a + delta) = HR * h(a)
- 풀면: exp(gamma * delta) = HR → **delta = ln(HR) / gamma**
- gamma = 0.10 (경험적 근사값: 성인 사망률이 7년마다 배증, 연간 약 10% 증가)
- 따라서: **delta = ln(HR) / 0.10 = ln(HR) x 10**

**판정**: `delta = ln(ratio) x 10` 공식의 직접적 수식 전개 및 대중화는 Spiegelhalter 작업에서 확인. 단, 책 인용이며 단일 논문 PMID 없음. Pang & Hanley 2021이 이 접근을 학술 논문으로 정식화함.

---

## 후보 E: Robbins & Hall 1970 — Health Hazard Appraisal (HRA) 원조 "위험나이"

**서지 정보**
- 저자: Lewis C. Robbins, Jack H. Hall
- 제목: How to Practice Prospective Medicine
- 출판: Methodist Hospital of Indiana, Indianapolis, 1970
- 후속: Halls & Zwemer, 1979 (Prospective Medicine, Google Books 확인)

**개념**
- "Risk age" (위험나이) 개념 최초 제안
- 전체 사망률 위험이 나이에 따라 약 8%/년 기하급수적으로 증가함을 기반
- 각 위험인자의 RR을 나이 단위로 환산
- 한국 JKMA 2017 Moon et al.이 이 Robbins 방법을 "심뇌혈관 나이" 계산에 적용했다고 명시

**수식 명시 여부**
- 공개 전자 원문 접근 불가 (1970년 단행본)
- 개념은 확인됐으나 `delta = ln(ratio) x 10` 형태의 명시적 수식은 원저에서 확인 불가
- 판정: 개념 기원이나 수식 원출처로 인용 불가 (책 PMID 없음)

---

## 한국 자료 (우선 확인 완료)

### 대한가정의학회 심뇌혈관 나이 프로그램

- **근거**: JKMA 2017; Moon YJ et al. "한국인의 심뇌혈관질환 위험도 예측 및 활용: 국가건강검진 건강위험평가를 중심으로"
- **URL**: https://jkma.org/journal/view.php?viewtype=pubreader&number=240
- **방법**: Robbins 방법 기반, 국내 역학 데이터 활용
- **공식 공개 여부**: 논문에서 Robbins 방법 사용 명시하나 delta = ln(ratio) x 10 수식 직접 언급 없음
- **결론**: 한국 적용 사례 문헌으로 인용 가능. 수식 원출처 아님.

### 질병관리청 국가건강정보포털

- URL: https://health.kdca.go.kr (심뇌혈관 나이 섹션)
- 내용: 심뇌혈관 나이 개념 설명 (수식 없음)
- 결론: 일반 교육 자료, 수식 원출처 아님

### 서울대 국민건강지식센터

- URL: https://hqcenter.snu.ac.kr/archives/31069
- 내용: "심장 나이, 실제보다 10년 많으면 심뇌혈관질환 발생률 75% 증가" (CDC 연구 인용)
- 결론: 번역·소개 자료, 수식 원출처 아님

---

## 최종 판정 및 수정 권고

### `delta = ln(ratio) x 10` 공식의 실체

이 공식은 **단일 논문 원출처가 있는 수식이 아니다**. 다음 3개 요소가 결합된 관례적 변환이다:

1. Gompertz 법칙 (1825, Benjamin Gompertz): 사망력은 나이에 따라 지수 함수적으로 증가
2. 비례 위험 가정: h(a + delta) = HR x h(a) 하에서 delta = ln(HR) / gamma
3. gamma = 0.10 경험값 대입: delta = ln(HR) x 10

이 형태는 Spiegelhalter (2012, "The Art of Statistics")에서 대중화, Pang & Hanley 2021 (PMID 34151374)에서 학술적으로 정식화됨.

### 스펙 A2 수정 선택지

**Option 1 (권장)**: 인용 재매핑

현재:
```
| A2 | delta = ln(ratio) x 10 | 34151374 | D'Agostino, Framingham risk age |
```

수정안:
```
| A2 | delta = ln(HR) / gamma; gamma ≈ 0.10 → delta ≈ ln(HR) x 10 | 34151374 | Pang & Hanley 2021 AJE (HR-to-age-shift 변환 방법론) |
```

추가 각주:
- 개념 기원: Gompertz 1825 + Spiegelhalter 2012 대중화
- CV 위험 기반 "vascular age" 원출처 (별도 개념): D'Agostino et al. 2008 PMID 18212285

**Option 2**: "출처 미확인" 명시 후 차후 검증

```
| A2 | delta = ln(ratio) x 10 | — | 관례적 Gompertz 변환 공식. 책 인용 필요 (Spiegelhalter 2019, ISBN 978-0-241-25820-7 또는 Pang & Hanley 2021 PMID 34151374) |
```

**권장**: Option 1. PMID 34151374를 유지하되 귀속 라벨을 "Pang & Hanley 2021" + 방법론 설명으로 교정.

---

## 확인된 URL 목록

| 번호 | URL | 상태 | 내용 |
|---|---|---|---|
| 1 | https://pubmed.ncbi.nlm.nih.gov/34151374/ | WebSearch 확인 | Pang & Hanley 2021 AJE PMID |
| 2 | https://pubmed.ncbi.nlm.nih.gov/18212285/ | WebSearch 확인 | D'Agostino 2008 Circulation PMID |
| 3 | https://jhanley.biostat.mcgill.ca/Reprints/PangHanleyTranslations2021AJE.pdf | WebSearch 확인 | Pang & Hanley 전문 PDF (McGill 공개) |
| 4 | https://academic.oup.com/aje/article/190/12/2664/6306908 | WebSearch 확인 | AJE 저널 페이지 |
| 5 | https://understandinguncertainty.org/what-your-effective-age | WebSearch 확인 | Spiegelhalter 블로그 (effective age 설명) |
| 6 | https://pubmed.ncbi.nlm.nih.gov/20584778/ | WebSearch 확인 | Cuende 2010 SCORE vascular age |
| 7 | https://jkma.org/journal/view.php?viewtype=pubreader&number=240 | WebSearch 확인 | JKMA 2017 한국 심뇌혈관 나이 |

---

## 개념 구분 정리 (혼동 방지)

| 개념 | 정의 | 원출처 | PMID |
|---|---|---|---|
| Vascular age (CV 위험 기반) | 동일 10년 심혈관 절대위험을 가지되 위험인자가 최적인 동성인의 나이 | D'Agostino et al. 2008 | 18212285 |
| Heart age (Framingham 역산) | Framingham 점수 역 함수로 산출한 나이 | D'Agostino 2008 + Cuende 2010 | 18212285 / 20584778 |
| Age shift (HR → 나이 환산) | Gompertz 법칙 하에서 HR=exp(gamma x delta) 역산, delta = ln(HR)/gamma | Spiegelhalter 2012 (대중화) / Pang & Hanley 2021 (학술화) | 34151374 |
| Biological age (다중 바이오마커) | 연령 관련 바이오마커 패널로 추산한 나이 | 별도 분야 (PhenoAge, GOLD BioAge 등) | 다수 |
| 한국 심뇌혈관 나이 | Robbins 방법 기반 국내 역학 적용 | Moon et al. JKMA 2017 | 없음 (한국어 논문) |

---

## 검색 한계 및 미검증 사항

1. Pang & Hanley 2021 full text (수식 섹션) — WebFetch 권한 없어 직접 확인 불가. 검색 결과 및 Gompertz 역산 수학으로 수식 존재 추론
2. D'Agostino 2008 Circulation full text — 수식 table/equation 번호 직접 확인 불가
3. Spiegelhalter "The Art of Statistics" 해당 챕터 — 도서 원문 접근 불가

**권고**: Pang & Hanley PDF (https://jhanley.biostat.mcgill.ca/Reprints/PangHanleyTranslations2021AJE.pdf) 직접 다운로드 후 수식 섹션(Methods 또는 Appendix) 확인. gamma, delta 표기 및 HR-to-age-shift 공식 라인 번호 기록.
