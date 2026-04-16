---
name: mediArc Phase 3 PMID 검증 리포트
description: mediArc Phase 3 스펙 내 PMID/DOI를 PubMed 대조하여 환각/불일치 식별. mkt-verifier 독립 검증 산출물.
type: reference
owner: mkt
last_verified: 2026-04-16
confidence: high
supersedes: []
superseded_by: ""
ttl: 0
tags: [mediarc, phase3, pmid, verification, mkt-verifier]
---

# mediArc Phase 3 PMID 전수 검증 리포트

**검증자**: mkt-verifier (PASS는 싸게 주지 않는다)
**검증일**: 2026-04-16
**대상 SoT**: `planning-platform/docs/mediarc-report-phase3-spec.md` (1852줄)
**판정**: **FAIL** (블로커 — 엔진 배포 전 수정 필수)

## 판정 요약

| 구분 | 건수 |
|---|---|
| 총 검증 PMID (unique) | 7 |
| 책 인용 (PMID 없음) | 1 (A9 VanderWeele) |
| **PASS** | 4 (A1 / A4-T1 / A5-T10 / A7-T2) |
| **FAIL** (저자·저널 날조 수준 불일치) | 2 (A2=34151374, A3/A8=18212285) |
| **CONDITIONAL** (저자 맞으나 주제 불일치) | 1 (A6=26311724) |
| α 테이블 내 출처 없음 `—` | 6행/10행 |

## 상세 대조표

| # | 스펙 위치 | 제안 PMID | 스펙 인용 | PubMed 실제 | 판정 |
|---|---|---|---|---|---|
| A1 | 부록A, 105, 236, 341, 1137, 1630, 1819 | 4000199 | Feinstein AR 1985 NEJM Will Rogers | ✅ Feinstein AR, *N Engl J Med* 1985;312(25):1604-8 | **PASS** |
| A2 | 부록A, 340, 1817 | **34151374** | D'Agostino Framingham risk age, `delta = ln(ratio) × 10` | ❌ **Pang M & Hanley JA**, *Am J Epidemiol* 2021;190(12):2664-70 "Translating All-Cause Mortality Rate Ratios or Hazard Ratios to Age-, Longevity-, and Probability-Based Measures" | **FAIL** |
| A3 | 부록A, 301, 339 | **18212285** | Rothman KJ 2008 *Epidemiology* piecewise log cohort normalization | ❌ **D'Agostino RB Sr et al.**, *Circulation* 2008;117(6):743-53 "General CV risk profile: Framingham Heart Study" | **FAIL** (역설적으로 A2 자리에 적합) |
| A4/T1 | 부록A, 499 (심혈관 금연) | 15914503 | Woodward 2005 금연 후 CVD RR | ✅ Woodward M, *Int J Epidemiol* 2005;34(5):1036-45 | **PASS** (α 수치 별도 검증 필요) |
| A5/T10 | 부록A, 508 (폐암 금연) | 17893872 | Gandini 2008 흡연-암 메타 | ✅ Gandini S, *Int J Cancer* 2008;122(1):155-64 | **PASS** (α 수치 별도 검증 필요) |
| A6/T4 | 부록A, 502, 505 | 26311724 | Pan A 2015 Circulation 뇌혈관 관련 | ⚠️ Pan A et al., *Circulation* 2015 — **당뇨환자** total mortality + CVD events (뇌졸중 단독 아님) | **CONDITIONAL** |
| A7/T2 | 부록A, 500 (심혈관 BMI감량) | 21593294 | Wing 2011 Look AHEAD 당뇨 | ✅ Wing RR (Look AHEAD), *Diabetes Care* 2011;34(7):1481-6 | **PASS** (당뇨환자 내 CVD risk factor 개선) |
| A8 | 부록A (재사용) | 18212285 | Rothman synergy index (multiplicative vs additive) | ❌ A3와 동일 — 책 인용, PMID 없음 | **FAIL** |
| A9 | 부록A 1708 | — | VanderWeele 4-way decomposition | 책 인용 | 스펙 이미 `—` 마킹 OK |

## α 감쇠 테이블 수치 검증 불가 (차후 원문 대조 필수)

- PMID 일치 4건도 **α 값(0m/6m/12m/60m)이 논문 table에서 직접 유도 가능한지 abstract 수준 확인 불가**
- Woodward 2005: Asia-Pacific 관상동맥 RR=2.34(남)/2.86(여) 제시, 스펙의 0.90/0.70/0.30 감쇠 곡선 직접 유도 필요
- Wing 2011 Look AHEAD: 1년차 결과 중심, 60m α=0.50은 장기 추적 별도 논문 필요
- Pan 2015 / Gandini 2008: 시계열 감쇠 곡선 아님 → **스펙 α 값은 자체 추정**
- 스펙 501, 503, 504-507, 509 (6행): `— (보수적 추정)` — 출처 자체 없음

## 수정 요청 (블로커)

### 1. A2 (line 1701) — 저자·저널 재매핑 또는 "출처 미확인"
**현재**: `| A2 | ... 공식 delta = ln(ratio) × 10 | 34151374 | D'Agostino, Framingham risk age |`

**선택지**:
- **Option 1**: PMID를 **18212285**(D'Agostino 2008 Circulation)로 교체. 단 "General CV risk profile" 논문이 `delta = ln(ratio) × 10` 공식을 **명시**했는지 원문 확인 필요
- **Option 2**: PMID 34151374 유지 + 저자를 **Pang & Hanley 2021 *Am J Epidemiol***로 정정, "D'Agostino Framingham" 인용 삭제
- **Option 3**: `# 출처 미확인 (요검증)` 마킹 + 코드 주석에서 공식 유래 표현 제거

### 2. A3 (line 1702) — 책 인용으로 분리
**현재**: `| A3 | Piecewise log cohort normalization | 18212285 | Rothman KJ, 2008, "Epidemiology" |`
**실제**: 18212285는 **D'Agostino Circulation 2008** — Rothman 아님. 본문 인용(line 301, 339) 모두 "Rothman 2008, PMID 18212285" → **허위**

**권고**:
- Rothman KJ *Modern Epidemiology* 3rd ed. (2008, Lippincott) — **책 인용, PMID 없음**
- 코드 주석: `Rothman KJ, Modern Epidemiology 3rd ed., 2008 (책 인용 — PMID 없음)`

### 3. A8 (line 1707) — A3와 동일
synergy index는 Rothman *Modern Epidemiology* 교과서 전용 개념 → **PMID 삭제 + "책 인용" 마킹**

### 4. A6 (line 1705) — 대상 질환 정정 또는 교체
**현재**: `| A6 | 금연 후 뇌졸중 RR | 26311724 | Pan A, 2015, Circulation | 뇌혈관 관련 |`
**실제**: Pan 2015 = **당뇨환자** total mortality + CVD events 메타

**선택지**:
- **Option 1**: 뇌혈관 금연 RR은 별도 출처 재검색 (예: Kawachi 1993 JAMA nurses study, PMID 8445825 — 미확인, 재검색 필요)
- **Option 2**: 라벨을 "당뇨환자 흡연-사망·CVD RR"로 정정 + T4(당뇨·금연) 위치로 이동

### 5. α 테이블 출처 없는 6행 (501, 503, 504-507, 509)
- 엔진 배포 전 코드 주석에 `# 출처 미확인 (요검증)` 의무 마킹 (스펙 1696행 자체 요구)
- **보수적 (α 더 큰) 값으로 저장** (스펙 513 가드레일 준수)

## 메타 경고

스펙 line 22, 513, 1696-1717, 1848은 **모두 "PMID 할루시네이션 금지"·"직접 검증 필수"·"AI 제안 PMID 검증 없이 그대로 넣지 말 것"을 명시**. 그러나 스펙 **자체가** 저자/저널 불일치 PMID 2건 포함 제출됨.

dev-coder가 본 스펙 PMID를 그대로 코드 주석에 복사하면 **CLAUDE.md 반복실수 "논문 출처 날조 (2026-03-30)" 재발**. 엔진 구현 착수 전 A2·A3·A6·A8 수정 필수.

## 재검증 필요 항목

1. WebFetch 권한 복구 후 PMID 4000199 / 15914503 / 17893872 / 21593294 **초록 전문** 직접 대조 (수치 일치)
2. PMID 34151374, 18212285 → **제거 또는 올바른 출처로 교체** (data-verifier 협업)
3. Rothman synergy index·piecewise normalization → **책 인용** 분리 처리
4. 뇌혈관 금연 RR → **대체 논문 재검색** 또는 "출처 미확인" 마킹
5. α 감쇠 테이블 6행 → 엔진 배포 전 `# 출처 미확인` 의무 마킹 + 보수적 값

## 참조

- 스펙 SoT: `planning-platform/docs/mediarc-report-phase3-spec.md`
- 규칙: `.claude/rules/marketing-rules.md` §19-23 (출처 검증)
- 규칙: `.claude/rules/data-workflow.md` §논문/가이드라인 인용
- CLAUDE.md 반복실수 테이블 2026-03-30: 논문 출처 날조 / 수치 오독 / 교과서 편향
