# WELNO Chat 트래픽 · 실패 사례 · 비용 분석 리포트

작성일: 2026-05-04
범위: 5/3 20:55 (paid 키 적용 시점) ~ 5/4 09:12 KST
SoT: `welno.llm_usage_log` (총 145건) + WELNO_BE PM2 로그 (`/data/wello_logs/pm2/welno-be/`)

---

## 1. 요약 (TL;DR)

- **rag_chat 실패 2건 — 둘 다 503 아님, `MAX_TOKENS (4096)` 초과**.
  - 5/3 22:32:00 KST · greetings retry 2회차 토큰 한도 도달
  - 5/4 01:35:42 KST · greetings 첫 시도 토큰 한도 도달
  - **결론**: 503/Quota/네트워크 문제 X. **prompt 길이 폭주** + **max_tokens=4096 부족** + **retry 효과 없음** (같은 prompt 재시도).
- 비용: 5/3+5/4 합계 **$0.0185 (≈25원)**. 4월 100만원 사고 추정치($700/일) 대비 **0.0026%**. paid 키 + chat_tagging 무한 retry fix 후 정상 트래픽.
- **session_id / partner_id / hospital_id 145건 전부 NULL** — `llm_usage_logger.log()` 호출자 9곳에서 인자 미전달. **session 단위 retry loop 추적 불가** = P0 안전장치 결함.
- 분당 최고 spike: rag_chat 6건/분 (5/3 22:47), chat_tagging 4건/분. 평소 EWMA <2건/분.
- 시간당 max: rag_chat 39 / chat_tagging 29 (둘 다 5/3 22시).

---

## 2. 데이터 범위 한계

| 항목 | 상태 |
|---|---|
| `welno.llm_usage_log` 시작 | 2026-05-03 20:55 — **paid 키 적용 시점부터** |
| 4월 사고 (100만원) 직접 추적 | **불가** — DDL 적용 5/3 |
| PM2 로그 보관 | 2026-03-31 부터 (rag_chat 503 패턴 있음) |
| 4월 비용 사고 root cause | 별도 회고 (`memory/`, `c1c8b32` 커밋) — chat_tagging 무한 retry + warmup 19x 폭주 |

**의미**: 본 리포트는 **현재 운영 베이스라인 + 예방 권고**. 4월 사고 메커니즘은 코드 수정으로 차단됨 (별도 검증 필요 시 PM2 로그 grep).

---

## 3. 실패 2건 상세

### 3-1. 5/3 22:32:00 KST · session=`fefc03e64177bb2c72e0f88941b385eb`

```
22:31:13 partner_rag warmup 시작 (병원=1BE5C355...)
22:31:13 Gemini call_api attempt 1/3 (gemini-3-flash-preview)
22:31:17 ⚠️ 503 UNAVAILABLE → 1초 후 재시도
22:31:18 Gemini attempt 2/3 → 성공
22:31:39 [greetings] attempt=1 success=True (190 chars)
22:31:39 ⚠️ JSON 파싱 실패: Extra data line 2 col 1 (char 178)
22:31:39 [greetings] attempt=2 시작 (gemini-3-flash-preview)
22:32:00 ⚠️ 비정상 종료: FinishReason.MAX_TOKENS
22:32:00 ❌ 토큰 제한 초과 (max: 4096)
22:32:00 [greetings] attempt=2 success=False
22:32:00 ✅ 웜업 완료 (폴백 hook/greeting 사용)
```

원인: greetings retry 시 동일 prompt 사용 → 응답이 4096 token 도달 → 비정상 종료.

### 3-2. 5/4 01:35:42 KST · session=`69c02eec13cb58c003019939549b1731`

```
01:35:22 partner_rag warmup 시작 (병원=85F96009...)
01:35:22 Gemini call_api attempt 1/3 (gemini-3-flash-preview)
01:35:42 ⚠️ FinishReason.MAX_TOKENS (max: 4096)  ← 첫 시도 바로 한도 도달
01:35:42 [LLMRouter] failure: provider=gemini class=UNKNOWN
01:35:42 [greetings] attempt=1 success=False
01:35:42 [greetings] attempt=2 시작
... (이후 폴백 hook/greeting 사용)
```

원인: prompt 자체가 첫 시도부터 4096 token 응답 유도 → 비정상 종료.

### 3-3. 공통 패턴

- **JSON 파싱 실패 다발** — 5/3, 5/4 모두 `Extra data` 발생. JSON 자체는 valid, 코드펜스/설명 부착 의심.
- **MAX_TOKENS retry 무의미** — 동일 prompt 재시도 시 같은 결과. retry 정책에 finish_reason=MAX_TOKENS 분기 없음.
- **error_class=GEMINI_FAIL** 로 일괄 기록 — 503 vs MAX_TOKENS 구분 안 됨 → 모니터링 분류 부실.

---

## 4. 트래픽 분포

### 일별

| 날짜 | endpoint | 호출 | 성공 | 실패 | in_tok | out_tok | avg latency |
|---|---|---|---|---|---|---|---|
| 5/4 | rag_chat | 36 | 35 | 1 | 27,713 | 4,015 | 12.3s |
| 5/4 | chat_tagging | 5 | 5 | 0 | 8,305 | 1,128 | 3.9s |
| 5/3 | rag_chat | 57 | 56 | 1 | 32,377 | 3,440 | 10.8s |
| 5/3 | chat_tagging | 45 | 45 | 0 | 82,862 | 14,646 | 7.3s |

**관찰**:
- chat_tagging 의 input_tokens/호출 평균이 **rag_chat 의 2~3배** — tagging prompt 가 큰 편 (history 첨부 의심)
- rag_chat avg latency **10~12s** — Gemini 응답 자체가 길어서 P95 latency 가 사용자 체감 결정. 503 retry 1회 fix 로 30s → ~12s 단축 효과 큼
- 실패 2건 latency **20s** — MAX_TOKENS 도달까지 streaming 시간

### 시간대 (5/3 ~ 5/4 통합)

```
rag_chat:    22시 39건 → 23시 14건 → 다음날 0~9시 1~10건
chat_tagging: 22시 29건 → 23시 16건 → 다음날 0~9시 1~5건
```

**카카오 인앱 광고 패턴** — 22~23시 집중. 9시까지 부드럽게 감소. 0~9시 평균 분당 0.3건 미만.

### 분당 spike (지난 7일)

| 분 | endpoint | 호출수 |
|---|---|---|
| 5/3 22:47 | rag_chat | 6 |
| 5/3 22:34 | chat_tagging | 4 |
| 5/3 22:30 | chat_tagging | 4 |
| 5/3 22:27 | chat_tagging | 4 |

분당 max 6 → **EWMA 평균 1.5건/분 × 4배** 수준. 정상 사용자 burst 가능. 폭주 임계는 더 높게 설정 필요.

---

## 5. 비용 분석

### 단가 가정 (Google AI Studio 표시 단가)
- gemini-3-flash-preview: in $0.075 / out $0.30 (per 1M tokens)
- gemini-2.5-flash-lite: in $0.075 / out $0.30
- gpt-4o-mini (폴백 시): in $0.15 / out $0.60

### 일별

| 날짜 | model | calls | in_tok | out_tok | USD |
|---|---|---|---|---|---|
| 5/4 | gemini-3-flash-preview | 37 | 28,536 | 4,087 | $0.0034 |
| 5/4 | gemini-2.5-flash-lite | 5 | 8,305 | 1,128 | $0.0010 |
| 5/3 | gemini-3-flash-preview | 57 | 32,377 | 3,440 | $0.0035 |
| 5/3 | gemini-2.5-flash-lite | 45 | 82,862 | 14,646 | $0.0106 |

**합계 2일 = $0.0185 (≈25원)**.

### 4월 사고 비교
- 1개월 100만원 ≈ $700 / 30일 = **일 평균 $23**
- 현재 일 평균 $0.009 → **4월 사고 트래픽이 현재 ~2,500배 폭주 시 도달**
- chat_tagging 무한 retry (commit `c1c8b32` fix) + warmup 19x (별도 fix) 가 폭주 메커니즘이었음. 코드 fix 완료 → 동일 폭주 재발 위험 낮음

---

## 6. 핵심 결함 정리

| ID | 결함 | 영향 | 우선순위 |
|---|---|---|---|
| **F-1** | session_id/partner_id/hospital_id 100% NULL (호출자 9곳 미전달) | session retry loop 추적 불가, 환자 단위 fail rate 불가 | **P0** |
| **F-2** | greetings prompt MAX_TOKENS 4096 초과 (실패 2건 100%) | 사용자 폴백 hook/greeting 노출 (품질 저하) | **P0** |
| **F-3** | JSON 파싱 실패 다발 (코드펜스/설명 부착) | retry 강제 발생 → 비용 + latency 증가 | P1 |
| **F-4** | error_class=GEMINI_FAIL 일괄 — 503/MAX_TOKENS/UNKNOWN 구분 X | 알림 분류 부실 | P1 |
| **F-5** | MAX_TOKENS retry 분기 없음 (동일 prompt 재시도 = 무의미) | 비용 ↑, 사용자 대기 ↑ | P0 |
| **F-6** | 비용 cap 부재 — 일별 ceiling만 존재 (5000) | 4월 사고 패턴 재발 시 일별 도달 전 폭주 가능 | **P0** |
| **F-7** | 분당/시간당 spike 감지 부재 | 무한 retry / 봇 트래픽 폭주 즉시 감지 불가 | **P0** |

---

## 7. 권고 작업 (P0+P1 plan 보강)

기존 plan `effervescent-booping-prism.md` 에 다음 P0 4건 추가:

### P0-E0. **session_id 채우기 (F-1)**
- 호출자 9곳 (`grep -rn "llm_router.call_api(" backend/app/`) 모두에 `session_id=`, `partner_id=`, `hospital_id=` 전달
- `llm_router.call_api` 시그니처 → `llm_usage_logger.log()` 까지 propagate
- 검증: `SELECT COUNT(*) FILTER (WHERE session_id IS NOT NULL) FROM welno.llm_usage_log WHERE ts >= NOW() - INTERVAL '1 hour'` > 0
- 영향: retry loop 감지 (Layer 2) 가능해짐

### P0-E4. **MAX_TOKENS 분기 처리 (F-2 + F-5)**
- 파일: `app/services/gemini_service.py` finish_reason 체크 부분
- 변경: `FinishReason.MAX_TOKENS` 시 retry 즉시 중단 + 호출자에게 명시적 에러 코드 (`MAX_TOKENS_EXCEEDED`) 반환
- greetings 호출 시 max_tokens 8192 로 상향 검토 (또는 prompt 단축)
- error_class 세분화: `GEMINI_503`, `GEMINI_MAX_TOKENS`, `GEMINI_QUOTA`, `GEMINI_UNKNOWN`

### P0-E5. **비용 cap (F-6)**
- 일별 USD 누적 = `(input × in_rate + output × out_rate) / 1e6` × model별 단가
- $5/일 도달 시 Slack DAILY_COST_SUMMARY 사전 경고 (현재 $0.009/일 → 555배 헤드룸)
- $20/일 도달 시 차단 (현재 4월 사고 $23/일 직전 차단)
- model 단가 표는 `app/core/llm_pricing.py` 상수로 분리

### P0-E6. **분당 spike 감지 (F-7)**
- `QuotaGuard` 에 sliding 5분 window 카운터 추가
- 임계: `>20 calls/5min` (현재 정상 max 6 × 3.3배 헤드룸) 또는 EWMA × 5
- 발화 시 Slack `QUOTA_THRESHOLD` (`5min_spike` 라벨) + 자동 OpenAI 폴백 강제 전환

### P0-E7 (선택). **JSON 파싱 robustness (F-3)**
- `partner_rag_chat_service.py` greetings JSON 파싱 부분
- 코드펜스 (` ```json ... ``` `) 자동 strip + Extra data 발생 시 첫 valid JSON 만 추출
- retry 횟수 줄임 (비용 ↓)

---

## 8. ceiling 권고 (재조정)

| 설정 env | default | 실 P95 일사용 | 권고 | 80% 알림 시점 |
|---|---|---|---|---|
| `WELNO_LLM_QUOTA_RAG_CHAT_DAILY` | 5000 | 57 | **500** | 400/일 (현재 7배) |
| `WELNO_LLM_QUOTA_CHAT_TAGGING_DAILY` | 2000 | 45 | **500** | 400/일 |
| `WELNO_LLM_QUOTA_CHECKUP_DESIGN_DAILY` | 1000 | (미관측) | 500 | 400/일 |
| `WELNO_LLM_QUOTA_HOURLY_MULTIPLIER` | 0.15 | rag_chat max 39/h | **0.20** | 100/h (현재 max 39 × 2.5배) |

근거:
- 정상 트래픽 7배 헤드룸 → 진짜 사용자 spike 흡수 가능
- 4월 사고 (~수만/일) 1/100 수준에서 자동 차단
- 80% 알림으로 운영팀 사전 인지 (ceiling 일시 상향 vs 폭주 차단 결정)

---

## 9. 다음 작업 순서 (Day 1 P0 확장)

```
0. 본 리포트 검토 + 하비 승인 (👉 현재 단계)
1. P0-E0 session_id propagate (호출자 9곳) — 1h
2. P0-E4 MAX_TOKENS 분기 + error_class 세분화 — 1.5h
3. P0-E5 비용 cap + DAILY_COST_SUMMARY 알림 — 2h
4. P0-E6 분당 spike 감지 — 2h
5. dev-reviewer 1차 견제 (E0+E4+E5+E6 + 기존 E1/E2/E3)
6. ceiling env 재조정 (rag_chat 500, hourly 0.20)
7. 운영 적용 + WELNO_BE 재시작
8. 1시간 sanity (실패 분류 정확성, session_id 채워짐, 알림 0건)
9. P1 (페르소나/length/CTA/cache/history 압축) 진행
```

---

## 10. 참조

- 기존 plan: `/Users/harby/.claude/plans/effervescent-booping-prism.md`
- DB 스키마: `welno.llm_usage_log` (DDL `migrations/2026-05-03_llm_usage_log.sql`)
- 4월 사고 회고: `commit c1c8b32` + `memory/` 의 chat_tagging 무한 retry fix 기록
- PM2 로그 경로: `/data/wello_logs/pm2/welno-be/{out,error}.log` (10.0.1.6)
