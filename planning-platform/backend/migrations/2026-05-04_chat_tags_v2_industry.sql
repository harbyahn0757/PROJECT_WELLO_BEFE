-- B2B 태깅 v2 — 산업군 차원 + funnel + signals 추가
-- SoT: docs/spec/B2B_TAGGING_SYSTEM_v2.md
-- 적용: ops-team 위임 (dev-lead 승인 후)
-- 2026-05-04
--
-- 핵심:
--   - 신규 jsonb 3개 (industry_scores / health_concerns / signals)
--   - 기존 컬럼 (prospect_type 등) DROP 안 함 — 1개월 후 별도 마이그레이션
--   - 파트너별 정책 (tb_partner_config.config.crm_policy 섹션) — 코드 측에서 사용 시작 (DDL 변경 없음, jsonb 안 추가)

BEGIN;

-- ─── 1. tb_chat_session_tags 신규 컬럼 ───────────────────────

-- tagging_version 은 이미 INT 로 존재 (4=v1, 5=v2 의미로 재정의). 신규 컬럼 4개만 추가.
ALTER TABLE welno.tb_chat_session_tags
    ADD COLUMN IF NOT EXISTS industry_scores JSONB,
    ADD COLUMN IF NOT EXISTS health_concerns JSONB,
    ADD COLUMN IF NOT EXISTS signals JSONB,
    ADD COLUMN IF NOT EXISTS evidence_quotes JSONB;

COMMENT ON COLUMN welno.tb_chat_session_tags.industry_scores IS
    'B2B 산업군별 lead score (5 산업군: hospital/supplement/fitness/insurance/mental_care). 형식: {"hospital":{"score":82,"stage":"decision","sub_categories":["recall"]},...}';

COMMENT ON COLUMN welno.tb_chat_session_tags.health_concerns IS
    '건강 관심사 jsonb 배열. 형식: [{"topic":"혈압","intensity":"high","evidence":"..."}]. 9 카테고리: 혈압/혈당/콜레스테롤/간/신장/비만/정신건강/일반/갑상선';

COMMENT ON COLUMN welno.tb_chat_session_tags.signals IS
    '행동 신호 jsonb. 형식: {"urgency":"normal","readiness":"considering","timeline_days":30,"anxiety_level":"medium","buying_intent":"exploring"}';

COMMENT ON COLUMN welno.tb_chat_session_tags.evidence_quotes IS
    '점수 근거 인용문 (정확도 검증용). 형식: ["혈압 약 먹어야 하나요","오메가3 효과 있나요"]';

COMMENT ON COLUMN welno.tb_chat_session_tags.tagging_version IS
    '태깅 버전 INT (4=v1 병원전용, 5=v2 B2B 산업군). industry_scores 채워지면 v2. 1개월 병행 후 v1 컬럼 DROP 예정';

-- ─── 2. 인덱스 — GIN (jsonb 전체 쿼리 가속) ────────────────────
-- ::int DESC NULLS LAST 식 인덱스는 jsonb 캐스팅이 IMMUTABLE 아니라 거부됨.
-- → GIN 인덱스 1개로 5 산업군 + signals 쿼리 모두 가속.
CREATE INDEX IF NOT EXISTS idx_chat_tags_industry_scores_gin
    ON welno.tb_chat_session_tags USING GIN (industry_scores);

CREATE INDEX IF NOT EXISTS idx_chat_tags_signals_gin
    ON welno.tb_chat_session_tags USING GIN (signals);

CREATE INDEX IF NOT EXISTS idx_chat_tags_health_concerns_gin
    ON welno.tb_chat_session_tags USING GIN (health_concerns);

-- ─── 3. 기존 컬럼 deprecated 마킹 (DROP 안 함) ────────────────────

COMMENT ON COLUMN welno.tb_chat_session_tags.prospect_type IS
    '[DEPRECATED v1] 병원 전용 5분류 (chronic_management/needs_visit/borderline_worried/lifestyle_improvable/low_engagement). v2 industry_scores.hospital.stage 로 대체. 1개월 병행 후 DROP 예정 (~2026-06-04)';

COMMENT ON COLUMN welno.tb_chat_session_tags.hospital_prospect_score IS
    '[DEPRECATED v1] 병원 점수 단일. v2 industry_scores.hospital.score 로 대체';

COMMENT ON COLUMN welno.tb_chat_session_tags.buying_signal IS
    '[DEPRECATED v1] 구매 의도 단일. v2 signals.buying_intent + industry_scores.<industry>.stage 조합으로 대체';

COMMENT ON COLUMN welno.tb_chat_session_tags.action_intent IS
    '[DEPRECATED v1] 행동 의도. v2 signals.readiness + industry_scores 조합으로 대체';

COMMENT ON COLUMN welno.tb_chat_session_tags.anxiety_level IS
    '[v1 호환 유지] v2 signals.anxiety_level 과 동기화 (병행기간)';

COMMENT ON COLUMN welno.tb_chat_session_tags.interest_tags IS
    '[v1 호환 유지] v2 health_concerns 와 동기화 (병행기간)';

-- ─── 4. 기존 백오피스 5 페이지 호환 — 5월 한 달 두 형식 모두 채움 ──

-- 마이그레이션 후 LLM v2 prompt 가:
--   - 신규 컬럼 (industry_scores / health_concerns / signals) 채움
--   - 기존 컬럼 (interest_tags / risk_level / sentiment / prospect_type / ...) 도 호환 형식으로 채움
--   - 1개월 안정화 후 백오피스 점진 전환 → DROP

COMMIT;
