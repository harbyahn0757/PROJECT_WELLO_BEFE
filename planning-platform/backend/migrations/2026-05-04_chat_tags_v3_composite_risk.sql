-- 마이그레이션 v3 — composite_risk jsonb + intent 필드는 jsonb 안 추가 (스키마 변경 X)
-- SoT: docs/spec/MIGRATION_v3_PLAN.md + MIGRATION_v3_AUDIT.md
-- 적용: ops-team 위임 (dev-lead 승인 후)
-- 2026-05-04
--
-- 변경:
--   1. composite_risk jsonb 컬럼 신규 (4단계 + factors + reason)
--   2. interest_tags 안 intent 필드 — 스키마 변경 X (jsonb 자유)
--   3. tagging_version INT 6 = v3 의미

BEGIN;

-- 1. composite_risk jsonb 컬럼
ALTER TABLE welno.tb_chat_session_tags
    ADD COLUMN IF NOT EXISTS composite_risk JSONB;

COMMENT ON COLUMN welno.tb_chat_session_tags.composite_risk IS
    '4 단계 종합 위험도 (v3) — {overall: critical|high|medium|low, factors: {metric_severity, patient_concern, urgency}, reason: 결정 근거}. v1 risk_level 자동 매핑.';

-- 2. GIN 인덱스 — composite_risk 쿼리 가속 (백오피스 우선순위 큐)
CREATE INDEX IF NOT EXISTS idx_chat_tags_composite_risk_gin
    ON welno.tb_chat_session_tags USING GIN (composite_risk);

-- 3. tagging_version 의미 추가 (6=v3)
COMMENT ON COLUMN welno.tb_chat_session_tags.tagging_version IS
    '태깅 버전 INT (4=v1 병원전용, 5=v2 B2B 산업군, 6=v3 composite_risk + intent). v1 컬럼은 호환 매핑으로 채워짐';

-- 4. 운영 안내 — 재태깅 plan
-- 3,700 v1 row → v3 prompt 로 재태깅 (별도 스크립트). 비용 약 $0.83.
-- 백오피스 7 페이지 = build_v1_compat_fields 자동 매핑으로 호환 유지.

COMMIT;
