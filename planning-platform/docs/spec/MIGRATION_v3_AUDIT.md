# 마이그레이션 v3 — 전수 조사 결과

> 작성: 2026-05-04
> 사용자 지시: "전수 조사부터 잘 해 위에 계획 잘 저장해두고"
> 점검 대상: 수검자 frontend / 백오피스 / API / services / DB 테이블 / 외부 시스템

---

## 1. 핵심 발견 — 두 가지 risk_level 시스템 공존

### chat_tagging 시스템 (이번 v3 대상)
- 컬럼: `tb_chat_session_tags.risk_level` (low/medium/high)
- 결정: LLM (chat_tagging_v2_prompt) + 검진수치 룰 (calculate_risk_level) MAX 채택
- 사용처: 백오피스 7 페이지 + partner_office API

### checkup_design 시스템 (별개, 영향 0)
- 컬럼: `risk_profile.risk_level` (Low/Moderate/High/Very High)
- 결정: 검진설계 LLM (gpt-4o, step1_prompt) 자체 판단
- 사용처: 수검자 frontend (ResultPage / CheckupRecommendationsPage)

→ **마이그레이션 v3 = chat_tagging 만 변경. 검진설계 시스템 영향 0**.

---

## 2. 영향 매트릭스 (전수)

### 변경 없음 ✅ (영향 0)

| 영역 | 사용 | 평가 |
|---|---|---|
| **수검자 frontend** | chat_tagging 컬럼 0건 | ResultPage / CheckupRecommendationsPage 는 검진설계 risk_level 만 사용 |
| **수검자 frontend embed/** | chat_tagging 컬럼 0건 | WelnoRagChatWidget / SurveyWidget — 위젯이라 태그 안 봄 |
| **백오피스 components/hooks/utils** | chat_tagging 컬럼 0건 | 페이지 안에서만 사용 |
| **알림톡 발송 (campaigns/alimtalk_service)** | chat_tagging 컬럼 0건 | mdx_agr_list 기반 별개 흐름 |
| **mediarc 시스템** | 별개 chat_history 테이블 | 무관 |
| **kakao_templates 14개** | 사용처 무관 | 템플릿 정의만 |
| **mdx_agr_list 354K 명** | 마케팅 동의 + 발송 추적 | chat 태그 무관 |
| **welno_trigger_log** | 트리거 이력 | 별개 jsonb result |
| **DB 외래키** | 0건 | tb_chat_session_tags 참조 외래키 없음 → ALTER 안전 |

### 변경 있음 ⚠️ (호환 매핑으로 보호)

| 영역 | hits | 호환 평가 |
|---|---|---|
| **partner_office.py** | 135 | risk_level 32 / sentiment 27 / interest_tags 20 / engagement_score 19 — 가장 많이 사용. v1 호환 매핑 정확성이 결정적 |
| **consultation.py** | 26 | 16개 컬럼 균등 사용 (3 hits 씩) |
| **embedding_management.py** | 22 | interest_tags 8 / sentiment 6 / conversation_summary 6 |
| **partner_rag_chat.py** | 1 | 미미 |
| **chat_tagging_service.py** | (본 함수) | prompt v3 + UPSERT 변경 대상 |
| **welno_rag_chat_service.py** | 5 import | tag_chat_session 호출 트리거 |
| **백오피스 7 페이지** | 위 영향 매핑 | UI 컬럼 표시 — 호환 매핑 정확하면 변경 0 |

---

## 3. 백오피스 페이지 컬럼 사용 (재정리)

| 페이지 | v1 컬럼 사용 | 신규 v2/v3 jsonb |
|---|---|---|
| DashboardPage | 2 (interest_tags, sentiment) | - |
| PatientPage | 9 | - |
| ConsultationPage | **15** (모든 v1 컬럼) | - |
| RevisitPage | **15** (ConsultationPage 동일) | - |
| AnalyticsPage | 11 | - |
| EmbeddingPage | 7 | - |
| **IndustryPage (신규)** | 3 | **industry_scores / health_concerns / signals / evidence_quotes** |

→ **백오피스 6 페이지 (Dashboard~Embedding) = v1 컬럼만 사용**. v3 가 v1 호환 매핑 유지하면 변경 0.

---

## 4. tb_chat_session_tags 46 컬럼 분석

### 영구 메타 (14개) — 변경 X
```
session_id / partner_id / created_at / updated_at / tagging_model / tagging_version
llm_attempted / llm_failed / llm_error / conversion_flag / user_feedback
consultation_requested / consultation_type / consultation_status / consultation_consent_at
```

### v1 컬럼 (deprecated 마킹 14개, 백오피스 호환 위해 유지) — v3 호환 매핑 채움
```
interest_tags / risk_tags / keyword_tags / sentiment / conversation_summary
risk_level / key_concerns / follow_up_needed / counselor_recommendations
conversation_depth / engagement_score / action_intent / nutrition_tags
commercial_tags / buying_signal / suggested_revisit_messages
medical_tags / lifestyle_tags / medical_urgency / anxiety_level
prospect_type / hospital_prospect_score / classification_confidence
conversation_intent / data_quality_score / has_discrepancy
```

### v2 jsonb (이미 추가, v3 도 활용) — 5개
```
industry_scores / health_concerns / signals / evidence_quotes / tagging_version (정수 4=v1, 5=v2, 6=v3 예정)
```

### v3 신규 jsonb (예정) — 1개
```
composite_risk  (overall + factors + reason)
```

---

## 5. 트리거 흐름

```
사용자 chat 1턴 (welno-api/v1/rag-chat/partner/...)
  ↓
welno_rag_chat_service.handle_user_message_stream
  ↓ (응답 후 백그라운드)
  ├─ chat_tagging_service.tag_chat_session
  │    ↓
  │    llm_analyze_session (chat_tagging endpoint)
  │      ↓
  │      build_prompt_v2 (현재 v2.1) → LLM 호출 (gemini-2.5-flash-lite)
  │      ↓
  │      normalize_v2_tags + validate_v2_tags
  │      ↓
  │      build_v1_compat_fields (자동 매핑)
  │      ↓
  │    _save_tags_to_db (tb_chat_session_tags UPSERT)
  │
  └─ chat_session_manager (Redis history)
```

→ v3 변경 = `chat_tagging_v2_prompt.py` + `chat_tagging_service.py` 의 prompt + 매핑만.
→ welno_rag_chat_service / partner_office API 코드 변경 0.

---

## 6. 외부 시스템 영향 (전수 확인)

| 시스템 | 영향 | 근거 |
|---|---|---|
| **MZSENDTRAN MySQL** (카카오 발송) | ❌ 0 | mdx_agr_list 기반, chat 태그 무관 |
| **kakao_templates** | ❌ 0 | 템플릿 정의 변경 X |
| **mediarc partner.kindhabit API** | ❌ 0 | dynamic_config 별개 |
| **Tilko 건보공단** | ❌ 0 | 검진 데이터 입력 시스템 |
| **Inicis 결제** | ❌ 0 | tb_campaign_payments — chat 태그 무관 |
| **Slack 알림** | ❌ 0 | 별개 alert system |
| **백엔드 동시성** | ⚠️ | UPSERT 시 GIN 인덱스 3개 → composite_risk 추가 시 4개. UPSERT 속도 약간 ↓ 가능 |

---

## 7. 자체 점검 결과

- ✅ 수검자 frontend 영향 0 (검진설계 별개 시스템)
- ✅ 외부 시스템 영향 0 (알림톡/카카오/mediarc/Tilko/Inicis)
- ✅ DB 외래키 0 → ALTER 안전
- ⚠️ partner_office.py 135 hits — v1 호환 매핑 정확성 검증 필수 (정확하지 않으면 백오피스 7 페이지 깨짐)
- ⚠️ 동시성 — UPSERT GIN 인덱스 4개 시 운영 트래픽 영향 측정 필요

**독립 verifier 미실시**. 사용자 합의 후 진행.

---

## 8. 결정 필요 항목 (4개 — MIGRATION_v3_PLAN.md 와 동일)

### Q1. v3 prompt 추가 항목 범위
- 최소 (Fix 1+2): risk_level 룰 + interest_tags.intent
- 중간 (Fix 1~3): + signals few-shot
- 전체 (Fix 1~6): + composite_risk + abnormal 정규화 + 임계 재조정

### Q2. composite_risk 도입?
- 4 단계 + 결정 근거
- v1 호환 자동 매핑

### Q3. interest_tags intent 필드 방식
- A: 기존 jsonb 안 intent 추가
- B: health_concerns 별도 분리

### Q4. 재태깅 시점
- 즉시 / 점진 / 선택적

---

## 9. 참조

- `MIGRATION_v3_PLAN.md` — 본 plan + 6 fix
- `B2B_TAGGING_SYSTEM_v2.md` — v2 정의
- `PARTNER_CRM_POLICY_v1.md` — 파트너 정책
- `chat_tagging_service.py` — 본 함수
- `chat_tagging_v2_prompt.py` — prompt v2.1
