-- WELNO Phase 1: LLM 사용량 추적 테이블
-- 적용: ops-team 위임 (dev-lead 승인 후)
-- 2026-05-03

CREATE TABLE IF NOT EXISTS welno.llm_usage_log (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model VARCHAR(64) NOT NULL,
    endpoint VARCHAR(64) NOT NULL,
    session_id VARCHAR(128),
    partner_id VARCHAR(64),
    hospital_id VARCHAR(64),
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    cached_tokens INT NOT NULL DEFAULT 0,
    latency_ms INT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_class VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_ts
    ON welno.llm_usage_log (ts DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_endpoint
    ON welno.llm_usage_log (endpoint, ts DESC);
