# B2B CRM 액션 매트릭스 v1 (Step 6)

> 작성일: 2026-05-05
> SoT: `B2B_TAGGING_SYSTEM_v2.md` (태깅 정의) + `PARTNER_CRM_POLICY_v1.md` (정책 인프라)
> 트리거: chat_tagging Fix 1~10 적용 후 (high 0% / medium 75% / low 25% 분포 기준)

## 0. 이 문서의 역할

`B2B_TAGGING_SYSTEM_v2` 가 태깅 차원 (5 산업군 × 6 funnel × signals + composite_risk) 을 정의.
`PARTNER_CRM_POLICY_v1` 가 파트너별 정책 jsonb 스키마 + dry_run 인프라 정의.
**본 문서는 "어떤 태깅 결과 → 어떤 CRM 액션" 의 매트릭스** — 30 시나리오 (5×6) + 의료 안전망 overlay.

## 1. 액션 카탈로그 (8 종)

| 코드 | 액션 | 채널 | 비용 | 우선순위 |
|------|------|------|------|---------|
| `A1_DOCTOR_ALERT` | 의료진 Slack 즉시 알림 | Slack push | 무료 | **P0** |
| `A2_KAKAO_HOSPITAL` | 알림톡 — 재검/병원 권장 | 솔라피 | 9원 | P1 |
| `A3_KAKAO_SUPPLEMENT` | 알림톡 — 영양제 콘텐츠 | 솔라피 | 9원 | P2 |
| `A4_KAKAO_FITNESS` | 알림톡 — 운동/체중관리 | 솔라피 | 9원 | P2 |
| `A5_KAKAO_INSURANCE` | 알림톡 — 보험 상담 | 솔라피 | 9원 | P3 |
| `A6_KAKAO_MENTAL` | 알림톡 — 심리상담/수면 | 솔라피 | 9원 | P2 |
| `A7_CONTENT_PUSH` | 백오피스 콘텐츠 큐 (의료진 검토 후) | 수동 | 무료 | P3 |
| `A8_REVISIT_NUDGE` | 재방문 유도 메시지 (postponed → action) | 솔라피 | 9원 | P3 |

## 2. 5×6 액션 매트릭스 (산업군 × funnel)

각 셀: `[액션코드] (조건)`. 조건 = `score≥X AND stage=Y` (B2B_TAGGING v2 기준).

### 2.1 hospital (의료기관)

| stage | none | awareness | interest | consider | decision | action |
|-------|------|-----------|----------|----------|----------|--------|
| score | 0~10 | 10~30 | 30~50 | 50~70 | 70~85 | 85~100 |
| **액션** | (없음) | A7 | A2 | **A2** | **A2 + A1** | **A2 + A1** |
| 발송 빈도 | - | 주1 | 주1 | 즉시 (24h) | 즉시 (1h) | 즉시 (5분) |
| 메시지 톤 | - | 일반 | 정보 | 권장 | 권장 + urgent | 즉시 행동 |

### 2.2 supplement (영양제)

| stage | none | awareness | interest | consider | decision | action |
|-------|------|-----------|----------|----------|----------|--------|
| score | 0~10 | 10~30 | 30~50 | 50~70 | 70~85 | 85~100 |
| **액션** | (없음) | A3 | A3 | A3 + A7 | **A3** | **A3** |
| 발송 빈도 | - | 격주 | 주1 | 주1 (관련 카테고리) | 즉시 (24h) | 즉시 (4h) |
| 메시지 | - | 검진 결과 → 영양 | 카테고리별 정보 | 비교 콘텐츠 | 추천 + 구매 링크 | 즉시 구매 유도 |

### 2.3 fitness (운동)

| stage | none | awareness | interest | consider | decision | action |
|-------|------|-----------|----------|----------|----------|--------|
| **액션** | (없음) | A7 | A4 | A4 | A4 | A4 + A8 |
| 발송 빈도 | - | 격주 | 주1 | 주1 | 24h | 4h |
| 비고 | - | 검진 + 운동 가이드 | 카테고리 (체중/근력 등) | PT/헬스장 비교 | 시작 가이드 | 예약/등록 유도 |

### 2.4 insurance (보험)

| stage | none | awareness | interest | consider | decision | action |
|-------|------|-----------|----------|----------|----------|--------|
| **액션** | (없음) | (없음) | A7 | A5 | A5 | A5 |
| 발송 빈도 | - | - | 격주 | 주1 | 24h | 4h |
| 비고 | 검진 안내 X | 검진 후 검토 콘텐츠만 | 카테고리 (실손/암 등) | 상품 비교 | 가입 유도 | 가입 즉시 |

### 2.5 mental_care (심리상담)

| stage | none | awareness | interest | consider | decision | action |
|-------|------|-----------|----------|----------|----------|--------|
| **액션** | (없음) | A7 | A6 | A6 | A6 + A1 | A6 + A1 |
| 발송 빈도 | - | 주1 | 주1 | 주1 | 즉시 (24h) | 즉시 (1h) |
| 비고 | - | 일반 정신건강 정보 | 카테고리 (수면/스트레스 등) | 상담 옵션 비교 | 상담 권장 + 의료진 통보 | 즉시 연결 |

## 3. 의료 안전망 Overlay (P5 강제룰)

**Overlay 1 — composite_risk.overall = "critical"**:
- 모든 산업군 stage 무시. **A1 (의료진 Slack) 즉시 발송**.
- 추가: hospital A2 (재검 알림톡) 1시간 내 자동 발송.
- 사유: P6 룰에 따라 "metric_severity=high AND patient_concern=high AND urgency=urgent". 환자 응급 상황.

**Overlay 2 — composite_risk.overall = "high"**:
- A1 (의료진 Slack) 24시간 내 발송 (Slack thread 1건).
- 다른 산업군 액션은 대기 — 의료진이 hospital 우선 권장 시 그 후 발동.

**Overlay 3 — abnormal_count ≥ 3 AND risk_level = "low"** (Fix 5 안전망 2):
- follow_up_needed = True 강제.
- A2 (재검 알림톡) **24시간 내 발송**.
- 영양제/보험/운동 액션 1주일 보류 (의료진 검토 우선).

**Overlay 4 — sentiment = "negative" 또는 user_feedback = "complaint"**:
- 모든 자동 발송 일시 정지 (1주일).
- CS 콜백 큐로 이관 (수동 처리).

## 4. 발동 조건 코드 (의사코드)

```python
def determine_actions(tags: dict, abnormal_count: int) -> List[str]:
    actions = []
    cr = tags.get("composite_risk", {})
    overall = cr.get("overall", "low")

    # Overlay 1: critical
    if overall == "critical":
        return ["A1_DOCTOR_ALERT", "A2_KAKAO_HOSPITAL"]

    # Overlay 4: complaint
    if tags.get("sentiment") == "negative" and tags.get("user_feedback") == "complaint":
        return []  # CS 큐 별도 이관

    # Overlay 2: high
    if overall == "high":
        actions.append("A1_DOCTOR_ALERT")

    # Overlay 3: abnormal 다수 + low
    if abnormal_count >= 3 and tags.get("risk_level") == "low":
        actions.append("A2_KAKAO_HOSPITAL")

    # 5×6 매트릭스
    industry_scores = tags.get("industry_scores", {})
    for industry, info in industry_scores.items():
        score = info.get("score", 0)
        stage = info.get("stage", "none")
        if score < 10:  # none
            continue
        action_code = MATRIX[industry][stage]
        if action_code:
            actions.append(action_code)

    return actions
```

## 5. 파트너별 활성화 (PARTNER_CRM_POLICY_v1 기준)

### 5.1 medilinx (Day 1, dry_run=True)
- 활성: A1 (의료진 알림), A2 (재검), A3 (영양제) — 검진 핵심 파트너
- 비활성: A4-A6 (운동/보험/심리) — 의료기관 영업 외
- dry_run=True (1주일) → tb_high_risk_dry_run_log 기록만, 실 발송 X

### 5.2 kindhabit (자체 풀스택 검증용)
- 모든 액션 활성. 직원 테스트 phone 만 dry_run=False.

### 5.3 신규 파트너 (default)
- A1 (의료진 알림) 만 활성. 다른 액션 명시 동의 후 ON.

## 6. 모니터링 KPI

매주 측정:
| KPI | 목표 | 알림 |
|-----|------|------|
| A1 발동율 | 5% 미만 (critical 희소) | 10% 초과 시 over-reach 의심 |
| A2 클릭율 | 15% 이상 | 5% 미만 시 메시지 톤 점검 |
| A3-A6 발송 / 환자 비율 | 산업군별 score≥30 환자의 80% | 누락 시 매트릭스 점검 |
| follow_up_needed → A2 발동 | 95% (안전망) | 누락 시 의료진 누락 위험 |
| sentiment=negative 후 dry_run 진입 | 100% | 미진입 시 CS 큐 이관 누락 |

## 7. 향후 확장 (v2)

- composite_risk × industry 별 우선순위 가중치
- 시간대별 발송 (am/pm, 주중/주말)
- 환자 historical action 기반 다음 액션 추천
- A/B 테스트 인프라 — 메시지 템플릿 비교

## 8. 참조

- `B2B_TAGGING_SYSTEM_v2.md` — 5 산업군 × funnel 정의
- `PARTNER_CRM_POLICY_v1.md` — 파트너 정책 jsonb + dry_run 인프라
- `chat_tagging_service.py` Fix 1~10 — 의료 안전망 코드
- `chat_tagging_v2_prompt.py` P5 강제룰 — risk_level over-reach 방지
- 의료법 56조 — 의학적 소견/진단 표현 금지 (메시지 템플릿 검수 시 준수)
