-- P2-2: TTFT (Time To First Token) 컬럼 추가
-- 2026 LLM observability 표준 — 스트리밍 응답 UX 핵심 SLO (P95 < 500ms 목표)
-- 적용: ops-team 위임 (dev-lead 승인 후)
-- 2026-05-04

ALTER TABLE welno.llm_usage_log
    ADD COLUMN IF NOT EXISTS ttft_ms INT;

COMMENT ON COLUMN welno.llm_usage_log.ttft_ms IS
    'Time To First Token (ms) — 스트리밍 첫 chunk 도달 latency. NULL = 비스트리밍 호출';

-- 인덱스 (TTFT 분포 분석/p95 조회용)
CREATE INDEX IF NOT EXISTS idx_llm_usage_ttft
    ON welno.llm_usage_log (endpoint, ts DESC) WHERE ttft_ms IS NOT NULL;
